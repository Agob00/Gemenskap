const express = require('express');
const { db } = require('./db');
const { requireAuth } = require('./auth');

const router = express.Router();

function isMember(userId, communityId) {
  return !!db
    .prepare('SELECT 1 FROM memberships WHERE user_id = ? AND community_id = ?')
    .get(userId, communityId);
}

router.get('/upcoming', requireAuth, (req, res) => {
  const events = db
    .prepare(
      `SELECT e.id, e.title, e.description, e.location, e.address, e.starts_at, e.community_id, c.name AS community_name
       FROM events e
       JOIN memberships m ON m.community_id = e.community_id
       JOIN communities c ON c.id = e.community_id
       WHERE m.user_id = ? AND e.starts_at >= ?
       ORDER BY e.starts_at ASC LIMIT 100`
    )
    .all(req.userId, Date.now());
  for (const e of events) {
    const r = db
      .prepare('SELECT status FROM event_rsvps WHERE event_id = ? AND user_id = ?')
      .get(e.id, req.userId);
    e.myRsvp = r ? r.status : null;
    e.goingCount = db
      .prepare("SELECT COUNT(*) AS n FROM event_rsvps WHERE event_id = ? AND status = 'going'")
      .get(e.id).n;
  }
  res.json({ events });
});

router.get('/community/:communityId', requireAuth, (req, res) => {
  const cid = Number(req.params.communityId);
  // Endast medlemmar ser eventlistan — annars läcker vi gruppens aktivitet
  // till alla inloggade.
  if (!isMember(req.userId, cid)) {
    return res.status(403).json({
      error: 'not_member',
      message_sv: 'Du måste vara medlem i gruppen för att se dess event.',
      message_en: 'You must be a member of this group to see its events.',
    });
  }
  const events = db
    .prepare(
      'SELECT id, title, description, location, address, starts_at, creator_id FROM events WHERE community_id = ? AND starts_at >= ? ORDER BY starts_at ASC'
    )
    .all(cid, Date.now() - 24 * 3600 * 1000);
  for (const e of events) {
    const r = db
      .prepare('SELECT status FROM event_rsvps WHERE event_id = ? AND user_id = ?')
      .get(e.id, req.userId);
    e.myRsvp = r ? r.status : null;
    e.goingCount = db
      .prepare("SELECT COUNT(*) AS n FROM event_rsvps WHERE event_id = ? AND status = 'going'")
      .get(e.id).n;
  }
  res.json({ events });
});

// Längdbegränsningar — stoppar spam-bots och DB-uppblåsning. Värdena är
// generösare än normala behov: en lång eventbeskrivning är ~500 tecken,
// max 2000 räcker långt även för engagerade arrangörer.
const TITLE_MAX = 100;
const LOCATION_MAX = 100;
const ADDRESS_MAX = 200;
const DESCRIPTION_MAX = 2000;

function tooLong(field, max, lang) {
  return {
    error: 'too_long',
    message_sv: `${field} är för långt (max ${max} tecken).`,
    message_en: `${field} is too long (max ${max} characters).`,
  };
}

router.post('/community/:communityId', requireAuth, (req, res) => {
  const cid = Number(req.params.communityId);
  if (!isMember(req.userId, cid)) return res.status(403).json({ error: 'not_member' });
  const { title, description, location, address, starts_at } = req.body || {};
  if (!title || !starts_at) {
    return res.status(400).json({
      error: 'missing',
      message_sv: 'Fyll i åtminstone titel och datum så vi kan visa eventet för andra.',
      message_en: 'Please fill in at least a title and date so we can show the event to others.',
    });
  }
  // Trimma och längdvalidera samtliga text-fält.
  const tTitle = String(title).trim();
  const tDescription = description ? String(description).trim() : '';
  const tLocation = location ? String(location).trim() : '';
  const tAddress = address ? String(address).trim() : '';
  if (tTitle.length > TITLE_MAX)            return res.status(400).json(tooLong('Titeln', TITLE_MAX));
  if (tLocation.length > LOCATION_MAX)      return res.status(400).json(tooLong('Platsnamnet', LOCATION_MAX));
  if (tAddress.length > ADDRESS_MAX)        return res.status(400).json(tooLong('Adressen', ADDRESS_MAX));
  if (tDescription.length > DESCRIPTION_MAX) return res.status(400).json(tooLong('Beskrivningen', DESCRIPTION_MAX));
  const ts = new Date(starts_at).getTime();
  if (Number.isNaN(ts)) {
    return res.status(400).json({
      error: 'bad_date',
      message_sv: 'Datumet ser konstigt ut. Välj ett datum och en tid och försök igen.',
      message_en: 'The date looks odd. Pick a date and time and try again.',
    });
  }
  // Eventet måste ligga i framtiden. Vi tillåter 1 timme bakåt (tidszon-glitches,
  // klockor som går lite fel) och 5 år framåt (rimlig planeringshorisont).
  const now = Date.now();
  const maxFuture = now + 5 * 365 * 24 * 60 * 60 * 1000;
  if (ts < now - 60 * 60 * 1000) {
    return res.status(400).json({
      error: 'past_date',
      message_sv: 'Datumet har redan passerat. Välj en tidpunkt i framtiden.',
      message_en: 'That date is already in the past. Please choose a future time.',
    });
  }
  if (ts > maxFuture) {
    return res.status(400).json({
      error: 'too_far_future',
      message_sv: 'Datumet ligger för långt fram i tiden. Välj inom de närmaste fem åren.',
      message_en: 'The date is too far in the future. Please choose within the next five years.',
    });
  }
  const info = db
    .prepare(
      'INSERT INTO events (community_id, creator_id, title, description, location, address, starts_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(cid, req.userId, tTitle, tDescription || null, tLocation || null, tAddress || null, ts, Date.now());
  res.json({ ok: true, id: info.lastInsertRowid });
});

router.post('/:id/rsvp', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const status = (req.body && req.body.status) || '';
  if (!['going', 'maybe', 'no'].includes(status)) {
    return res.status(400).json({ error: 'invalid_status' });
  }
  const ev = db.prepare('SELECT community_id FROM events WHERE id = ?').get(id);
  if (!ev) return res.status(404).json({ error: 'not_found' });
  if (!isMember(req.userId, ev.community_id)) return res.status(403).json({ error: 'not_member' });
  db.prepare(
    `INSERT INTO event_rsvps (event_id, user_id, status) VALUES (?, ?, ?)
     ON CONFLICT(event_id, user_id) DO UPDATE SET status = excluded.status`
  ).run(id, req.userId, status);
  res.json({ ok: true });
});

module.exports = router;
