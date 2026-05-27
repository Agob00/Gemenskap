/**
 * Moderering: blockera användare + rapportera innehåll.
 *
 * Designat för att skydda äldre användare från romansbedrägerier
 * och scammers — en aktiv risk när en plattform har meddelandefunktion.
 *
 * Endpoints:
 *   POST   /api/moderation/blocks/:userId        — blockera användare
 *   DELETE /api/moderation/blocks/:userId        — ta bort blockering
 *   GET    /api/moderation/blocks                 — lista mina blockerade
 *   POST   /api/moderation/reports                — rapportera innehåll/användare
 *
 * Rapporter sparas i DB även om ingen agerar på dem under demo —
 * det viktiga är att kanalen finns och att data fångas upp.
 */
const express = require('express');
const { db } = require('./db');
const { requireAuth } = require('./auth');
const { rateLimit } = require('./rate-limit');

const router = express.Router();

// Max 5 rapporter per minut per användare. Skydd mot spam-bots som
// flooder rapportsystemet. Dubbletter (samma reporter+target) blockeras
// dessutom permanent — se reportRoute nedan.
const reportRateLimit = rateLimit({
  key: (req) => `report:${req.userId}`,
  max: 5,
  windowMs: 60 * 1000,
  messageSv: 'Du har rapporterat flera saker nyligen. Vänta en stund.',
  messageEn: 'You have reported several things recently. Please wait a moment.',
});

// ── Blockeringar ────────────────────────────────────────────────────

router.post('/blocks/:userId', requireAuth, (req, res) => {
  const me = req.userId;
  const target = Number(req.params.userId);
  if (!target || target === me) {
    return res.status(400).json({
      error: 'invalid_target',
      message_sv: 'Det går inte att blockera sig själv.',
      message_en: 'You cannot block yourself.',
    });
  }
  const exists = db.prepare('SELECT 1 FROM users WHERE id = ?').get(target);
  if (!exists) return res.status(404).json({ error: 'not_found' });

  db.prepare(
    'INSERT OR IGNORE INTO user_blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)'
  ).run(me, target, Date.now());

  res.json({ ok: true });
});

router.delete('/blocks/:userId', requireAuth, (req, res) => {
  const me = req.userId;
  const target = Number(req.params.userId);
  db.prepare('DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?').run(me, target);
  res.json({ ok: true });
});

router.get('/blocks', requireAuth, (req, res) => {
  const me = req.userId;
  const blocked = db
    .prepare(
      `SELECT u.id, u.display_name, u.city, b.created_at
       FROM user_blocks b JOIN users u ON u.id = b.blocked_id
       WHERE b.blocker_id = ? ORDER BY b.created_at DESC`
    )
    .all(me);
  res.json({ blocked });
});

// ── Rapporter ───────────────────────────────────────────────────────

const ALLOWED_TARGETS = ['post', 'user', 'message'];

router.post('/reports', requireAuth, reportRateLimit, (req, res) => {
  const me = req.userId;
  const { target_type, target_id, reason } = req.body || {};

  if (!ALLOWED_TARGETS.includes(target_type)) {
    return res.status(400).json({
      error: 'invalid_target_type',
      message_sv: 'Vi kunde inte ta emot anmälan. Försök igen.',
      message_en: 'We could not accept the report. Please try again.',
    });
  }
  const tid = Number(target_id);
  if (!tid) {
    return res.status(400).json({
      error: 'invalid_target_id',
      message_sv: 'Vi kunde inte ta emot anmälan. Försök igen.',
      message_en: 'We could not accept the report. Please try again.',
    });
  }

  // Verifiera att målet finns
  let exists = false;
  if (target_type === 'user') {
    exists = !!db.prepare('SELECT 1 FROM users WHERE id = ?').get(tid);
  } else if (target_type === 'post') {
    exists = !!db.prepare('SELECT 1 FROM posts WHERE id = ?').get(tid);
  } else if (target_type === 'message') {
    exists = !!db.prepare('SELECT 1 FROM messages WHERE id = ?').get(tid);
  }
  if (!exists) {
    return res.status(404).json({
      error: 'not_found',
      message_sv: 'Innehållet kunde inte hittas. Det kanske redan är borttaget.',
      message_en: 'The content could not be found. It may already be removed.',
    });
  }

  // Dubblettskydd — samma användare kan inte rapportera samma sak två
  // gånger inom 24 timmar. Hindrar att rapportsystemet floodas.
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const existing = db
    .prepare(
      `SELECT 1 FROM reports
       WHERE reporter_id = ? AND target_type = ? AND target_id = ?
         AND created_at > ? LIMIT 1`
    )
    .get(me, target_type, tid, dayAgo);
  if (existing) {
    return res.status(409).json({
      error: 'duplicate',
      message_sv: 'Du har redan rapporterat detta. Vi har det noterat.',
      message_en: 'You have already reported this. We have it on record.',
    });
  }

  const cleanReason = reason ? String(reason).trim().slice(0, 500) : null;

  db.prepare(
    'INSERT INTO reports (reporter_id, target_type, target_id, reason, created_at, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(me, target_type, tid, cleanReason, Date.now(), 'open');

  res.json({ ok: true });
});

module.exports = router;
