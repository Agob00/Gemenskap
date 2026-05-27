const express = require('express');
const { db } = require('./db');
const { requireAuth } = require('./auth');
const { rateLimit } = require('./rate-limit');

const router = express.Router();

// Max 20 meddelanden per minut till samma mottagare. Stoppar spam-bots
// utan att blockera normal konversation (det är många meddelanden för
// en pensionär — räcker långt).
const messageRateLimit = rateLimit({
  key: (req) => `msg:${req.userId}->${req.params.userId}`,
  max: 20,
  windowMs: 60 * 1000,
  messageSv: 'Du skickar meddelanden för snabbt. Vänta en stund och försök igen.',
  messageEn: 'You are sending messages too fast. Please wait a moment and try again.',
});

// ── Server-Sent Events: en aktiv anslutning per öppen flik ──────────
// Map<userId, Set<res>>  (en användare kan ha flera flikar/enheter)
const sseClients = new Map();

function addClient(userId, res) {
  if (!sseClients.has(userId)) sseClients.set(userId, new Set());
  sseClients.get(userId).add(res);
}

function removeClient(userId, res) {
  const set = sseClients.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) sseClients.delete(userId);
}

function sendEvent(userId, eventName, payload) {
  const set = sseClients.get(userId);
  if (!set || set.size === 0) return;
  const data = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) {
    try { res.write(data); } catch (_) { /* res-stream stängd */ }
  }
}

// ── Hjälpfunktioner ─────────────────────────────────────────────────

function isBlocked(a, b) {
  return !!db
    .prepare(
      'SELECT 1 FROM user_blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)'
    )
    .get(a, b, b, a);
}

// ── Endpoints ───────────────────────────────────────────────────────

router.get('/threads', requireAuth, (req, res) => {
  const me = req.userId;
  // Hämta blockerade IDs (båda riktningar)
  const blockedIds = db
    .prepare(
      'SELECT blocked_id AS id FROM user_blocks WHERE blocker_id = ? UNION SELECT blocker_id AS id FROM user_blocks WHERE blocked_id = ?'
    )
    .all(me, me)
    .map((r) => r.id);
  const blockedSet = new Set(blockedIds);

  const rows = db
    .prepare(
      `SELECT
         CASE WHEN sender_id = ? THEN recipient_id ELSE sender_id END AS partner_id,
         MAX(created_at) AS last_at
       FROM messages
       WHERE sender_id = ? OR recipient_id = ?
       GROUP BY partner_id
       ORDER BY last_at DESC`
    )
    .all(me, me, me);
  const threads = rows.filter((r) => !blockedSet.has(r.partner_id)).map((r) => {
    const partner = db
      .prepare('SELECT id, display_name, city FROM users WHERE id = ?')
      .get(r.partner_id);
    const last = db
      .prepare(
        `SELECT body, sender_id, created_at FROM messages
         WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
         ORDER BY created_at DESC LIMIT 1`
      )
      .get(me, r.partner_id, r.partner_id, me);
    const unread = db
      .prepare(
        'SELECT COUNT(*) AS n FROM messages WHERE recipient_id = ? AND sender_id = ? AND read_at IS NULL'
      )
      .get(me, r.partner_id).n;
    return { partner, last, unread };
  });
  res.json({ threads });
});

router.get('/with/:userId', requireAuth, (req, res) => {
  const me = req.userId;
  const other = Number(req.params.userId);
  const partner = db
    .prepare('SELECT id, display_name, city FROM users WHERE id = ?')
    .get(other);
  if (!partner) return res.status(404).json({ error: 'not_found' });
  if (isBlocked(me, other)) {
    return res.status(403).json({
      error: 'blocked',
      message_sv: 'Den här konversationen är inte tillgänglig.',
      message_en: 'This conversation is not available.',
    });
  }
  const messages = db
    .prepare(
      `SELECT id, sender_id, recipient_id, body, created_at
       FROM messages
       WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
       ORDER BY created_at ASC LIMIT 500`
    )
    .all(me, other, other, me);
  // Markera som lästa ENDAST om det finns olästa — undviker onödig skriv-amplifiering.
  const unreadCount = db
    .prepare(
      'SELECT COUNT(*) AS n FROM messages WHERE recipient_id = ? AND sender_id = ? AND read_at IS NULL'
    )
    .get(me, other).n;
  if (unreadCount > 0) {
    db.prepare(
      'UPDATE messages SET read_at = ? WHERE recipient_id = ? AND sender_id = ? AND read_at IS NULL'
    ).run(Date.now(), me, other);
    // Underrätta avsändaren via SSE: deras meddelanden har lästs
    sendEvent(other, 'read', { by: me, at: Date.now() });
  }
  res.json({ partner, messages });
});

const MESSAGE_MAX_LEN = 2000;

router.post('/with/:userId', requireAuth, messageRateLimit, (req, res) => {
  const me = req.userId;
  const other = Number(req.params.userId);
  const body = req.body && String(req.body.body || '').trim();
  if (!body) {
    return res.status(400).json({
      error: 'empty',
      message_sv: 'Skriv ett meddelande innan du trycker på Skicka.',
      message_en: 'Write a message before you tap Send.',
    });
  }
  if (body.length > MESSAGE_MAX_LEN) {
    return res.status(400).json({
      error: 'too_long',
      message_sv: `Meddelandet är för långt (max ${MESSAGE_MAX_LEN} tecken). Korta ned det och försök igen.`,
      message_en: `The message is too long (max ${MESSAGE_MAX_LEN} characters). Please shorten it and try again.`,
    });
  }
  const partner = db.prepare('SELECT id FROM users WHERE id = ?').get(other);
  if (!partner) return res.status(404).json({ error: 'not_found' });
  if (isBlocked(me, other)) {
    return res.status(403).json({
      error: 'blocked',
      message_sv:
        'Det går inte att skicka meddelanden till den här användaren.',
      message_en: 'You cannot send messages to this user.',
    });
  }
  const now = Date.now();
  const info = db
    .prepare(
      'INSERT INTO messages (sender_id, recipient_id, body, created_at) VALUES (?, ?, ?, ?)'
    )
    .run(me, other, body, now);

  const msg = {
    id: Number(info.lastInsertRowid),
    sender_id: me,
    recipient_id: other,
    body,
    created_at: now,
  };

  // Pusha till mottagaren (alla deras öppna flikar) — momentan leverans.
  sendEvent(other, 'message', msg);
  // Pusha även till avsändaren (för synkronisering över t.ex. flera enheter/flikar).
  sendEvent(me, 'message', msg);

  res.json({ ok: true, id: msg.id });
});

// ── SSE-stream: ersätter polling av meddelanden ────────────────────
//
// Klienten ansluter via EventSource('/api/messages/stream') och håller
// en hängande HTTP-respons. När ett nytt meddelande sparats anropas
// sendEvent() ovan som skriver till alla relevanta strömmar.
router.get('/stream', requireAuth, (req, res) => {
  const me = req.userId;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable proxy buffering
  res.flushHeaders && res.flushHeaders();

  // Inledande hälsning så klienten vet att anslutningen är levande.
  res.write(`event: ready\ndata: {"ok":true}\n\n`);

  addClient(me, res);

  // Heartbeat var 25:e sekund som kommentar — håller connection levande
  // genom proxies och låter klienten upptäcka tappade anslutningar.
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch (_) { /* stängd */ }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(me, res);
  });
});

module.exports = router;
