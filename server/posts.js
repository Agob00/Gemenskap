const express = require('express');
const { db } = require('./db');
const { requireAuth } = require('./auth');
const { rateLimit } = require('./rate-limit');

const router = express.Router({ mergeParams: true });

// Max 10 inlägg per minut per (användare, community). En aktiv användare
// hinner inte skriva mer än så manuellt — höga siffror = bot.
const postRateLimit = rateLimit({
  key: (req) => `post:${req.userId}@${req.params.communityId}`,
  max: 10,
  windowMs: 60 * 1000,
  messageSv: 'Du publicerar inlägg för snabbt. Vänta en stund och försök igen.',
  messageEn: 'You are posting too fast. Please wait a moment and try again.',
});

function isMember(userId, communityId) {
  return !!db
    .prepare('SELECT 1 FROM memberships WHERE user_id = ? AND community_id = ?')
    .get(userId, communityId);
}

router.get('/', requireAuth, (req, res) => {
  const cid = Number(req.params.communityId);
  // Filtrera bort inlägg från författare som blockerats av oss ELLER
  // som blockerat oss. En blockerad person ska inte se eller bli sedd
  // av blockaren — det är hela poängen med blockering.
  const posts = db
    .prepare(
      `SELECT p.id, p.body, p.created_at, u.id AS author_id, u.display_name AS author_name
       FROM posts p JOIN users u ON u.id = p.author_id
       WHERE p.community_id = ?
         AND p.author_id NOT IN (
           SELECT blocked_id FROM user_blocks WHERE blocker_id = ?
           UNION
           SELECT blocker_id FROM user_blocks WHERE blocked_id = ?
         )
       ORDER BY p.created_at DESC LIMIT 100`
    )
    .all(cid, req.userId, req.userId);
  res.json({ posts });
});

const POST_MAX_LEN = 4000;

router.post('/', requireAuth, postRateLimit, (req, res) => {
  const cid = Number(req.params.communityId);
  if (!isMember(req.userId, cid)) return res.status(403).json({ error: 'not_member' });
  const body = req.body && String(req.body.body || '').trim();
  if (!body) {
    return res.status(400).json({
      error: 'empty',
      message_sv: 'Skriv något i rutan innan du trycker på Skicka.',
      message_en: 'Write something in the box before you tap Send.',
    });
  }
  if (body.length > POST_MAX_LEN) {
    return res.status(400).json({
      error: 'too_long',
      message_sv: `Inlägget är för långt (max ${POST_MAX_LEN} tecken). Korta ned det och försök igen.`,
      message_en: `The post is too long (max ${POST_MAX_LEN} characters). Please shorten it and try again.`,
    });
  }
  const info = db
    .prepare('INSERT INTO posts (community_id, author_id, body, created_at) VALUES (?, ?, ?, ?)')
    .run(cid, req.userId, body, Date.now());
  res.json({ ok: true, id: info.lastInsertRowid });
});

module.exports = router;
