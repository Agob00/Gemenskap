const express = require('express');
const path = require('path');
const fs = require('fs');
const { db, uploadsDir } = require('./db');
const { requireAuth } = require('./auth');

const router = express.Router();

// Den kanoniska listan måste matcha public/js/interests.js OCH
// scripts/generate-synthetic-dataset.js. Hålls i synk manuellt — om den
// växer på ett ställe ska den växa på alla.
const ALL_INTERESTS = new Set([
  'Promenader', 'Trädgård', 'Resor', 'Vandring', 'Cykling', 'Fågelskådning',
  'Schack', 'Bridge', 'Kortspel', 'Korsord', 'Boule', 'Golf', 'Pingis',
  'Hantverk', 'Stickning', 'Måleri', 'Konst', 'Foto', 'Musik', 'Sång', 'Dans',
  'Bokläsning', 'Filmklubb', 'Teater', 'Museum', 'Historia',
  'Matlagning', 'Bakning', 'Fika', 'Vinprovning',
  'Yoga', 'Pilates', 'Meditation', 'Simning',
]);

// Helper: check if user has an avatar file
function avatarUrl(userId) {
  const exts = ['.jpg', '.png', '.webp'];
  for (const ext of exts) {
    if (fs.existsSync(path.join(uploadsDir, `${userId}${ext}`))) {
      return `/uploads/${userId}${ext}`;
    }
  }
  return null;
}

// Längdgränser — gäller även om frontend skickar för långa värden.
// Skydd mot direkta API-anrop som skickar 100KB-strängar och bloatar DB
// + bryter UI-layouten när andra ser profilen.
const NAME_MAX = 60;
const CITY_MAX = 60;
const BIO_MAX = 1000;

function tooLongMsg(field, max) {
  return {
    error: 'too_long',
    message_sv: `${field} är för långt (max ${max} tecken).`,
    message_en: `${field} is too long (max ${max} characters).`,
  };
}

router.put('/me', requireAuth, (req, res) => {
  const { display_name, city, bio, language, interests } = req.body || {};
  if (!display_name || !city) {
    return res.status(400).json({
      error: 'missing_fields',
      message_sv: 'Fyll i både namn och stad så hittar vi rätt grupper åt dig.',
      message_en: 'Please fill in both name and city so we can find groups for you.',
    });
  }
  const trimmedName = String(display_name).trim();
  const trimmedCity = String(city).trim();
  const trimmedBio = bio ? String(bio).trim() : '';
  if (trimmedName.length > NAME_MAX) return res.status(400).json(tooLongMsg('Namnet', NAME_MAX));
  if (trimmedCity.length > CITY_MAX) return res.status(400).json(tooLongMsg('Stadsnamnet', CITY_MAX));
  if (trimmedBio.length > BIO_MAX)   return res.status(400).json(tooLongMsg('Beskrivningen', BIO_MAX));
  db.prepare(
    'UPDATE users SET display_name = ?, city = ?, bio = ?, language = ? WHERE id = ?'
  ).run(
    trimmedName,
    trimmedCity,
    trimmedBio || null,
    language === 'en' ? 'en' : 'sv',
    req.userId
  );
  if (Array.isArray(interests)) {
    // Filtrera bort allt som inte är ett känt intresse — servern är källan
    // till sanning. Klienten kan inte längre skriva in egna intressen, så
    // vad som kommer in härifrån ska redan vara begränsat. Detta är ett
    // skyddsnät mot direkta API-anrop som försöker injicera fri text.
    const filtered = [];
    for (const i of interests) {
      const trimmed = String(i).trim();
      if (trimmed && ALL_INTERESTS.has(trimmed)) filtered.push(trimmed);
    }
    db.prepare('DELETE FROM user_interests WHERE user_id = ?').run(req.userId);
    const ins = db.prepare('INSERT OR IGNORE INTO user_interests (user_id, interest) VALUES (?, ?)');
    for (const i of filtered) ins.run(req.userId, i);
  }
  res.json({ ok: true });
});

// Upload avatar (base64 image in JSON body)
// Validera att en buffer börjar med rätt magic bytes för JPEG/PNG/WebP.
// Förhindrar att en angripare smyger förbi en HTML-sida eller skript som
// fil med `data:image/...`-prefix — Content-Type-headern är inte att lita på.
function detectImageType(buf) {
  if (!buf || buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return 'png';
  // WebP: "RIFF"...."WEBP"
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return 'webp';
  return null;
}

router.post('/me/avatar', requireAuth, (req, res) => {
  const { image } = req.body || {};
  if (!image || typeof image !== 'string') {
    return res.status(400).json({
      error: 'no_image',
      message_sv: 'Ingen bild hittades. Försök välja en bild igen.',
      message_en: 'No image found. Please try selecting a photo again.',
    });
  }

  // Parse data URL: data:image/jpeg;base64,/9j/4...
  const match = image.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
  if (!match) {
    return res.status(400).json({
      error: 'bad_format',
      message_sv: 'Bilden kunde inte läsas. Prova med en annan bild (JPG eller PNG).',
      message_en: 'The image could not be read. Try another picture (JPG or PNG).',
    });
  }

  // Base64-decoding kan kasta vid trasig data — fånga och ge mjukt fel.
  let buf;
  try {
    buf = Buffer.from(match[2], 'base64');
  } catch (e) {
    return res.status(400).json({
      error: 'bad_base64',
      message_sv: 'Bilden kunde inte läsas. Prova med en annan bild.',
      message_en: 'The image could not be decoded. Please try another one.',
    });
  }

  // Limit to 5 MB
  if (buf.length > 5 * 1024 * 1024) {
    return res.status(400).json({
      error: 'too_large',
      message_sv: 'Bilden är för stor. Välj en mindre bild.',
      message_en: 'The image is too large. Please pick a smaller one.',
    });
  }

  // Verifiera att buffern faktiskt är en bild — Content-Type-headern går
  // att fejka, men magic-bytes är svårare att förfalska.
  const detected = detectImageType(buf);
  if (!detected) {
    return res.status(400).json({
      error: 'not_an_image',
      message_sv: 'Filen verkar inte vara en bild. Välj en JPG, PNG eller WebP.',
      message_en: 'The file does not look like an image. Please pick a JPG, PNG or WebP.',
    });
  }
  // Använd det DETEKTERADE formatet — inte vad data-URL:en påstod.
  const ext = '.' + detected;

  // Remove old avatars
  ['.jpg', '.png', '.webp'].forEach((e) => {
    const old = path.join(uploadsDir, `${req.userId}${e}`);
    if (fs.existsSync(old)) fs.unlinkSync(old);
  });

  const filePath = path.join(uploadsDir, `${req.userId}${ext}`);
  fs.writeFileSync(filePath, buf);

  res.json({ ok: true, avatarUrl: `/uploads/${req.userId}${ext}?t=${Date.now()}` });
});

// Ta bort profilbilden — användaren kan när som helst återgå till
// initial-avatar (genererat från namn). Idempotent: rensar alla möjliga
// extensions även om inget finns där (returnerar 200 ändå).
router.delete('/me/avatar', requireAuth, (req, res) => {
  let removed = false;
  try {
    ['.jpg', '.png', '.webp'].forEach((ext) => {
      const p = path.join(uploadsDir, `${req.userId}${ext}`);
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
        removed = true;
      }
    });
  } catch (e) {
    console.error('[delete-avatar]', e);
    return res.status(500).json({
      error: 'server_error',
      message_sv: 'Vi kunde inte ta bort fotot just nu. Försök igen om en stund.',
      message_en: 'We could not remove the photo right now. Please try again shortly.',
    });
  }
  res.json({ ok: true, removed });
});

// Export all user data (GDPR artikel 20 — dataportabilitet)
router.get('/me/export', requireAuth, (req, res) => {
  const userId = req.userId;

  const user = db
    .prepare('SELECT id, phone, display_name, city, bio, language, created_at FROM users WHERE id = ?')
    .get(userId);
  if (!user) return res.status(404).json({ error: 'not_found' });

  const interests = db
    .prepare('SELECT interest FROM user_interests WHERE user_id = ?')
    .all(userId)
    .map((r) => r.interest);

  const memberships = db
    .prepare(
      `SELECT c.id AS community_id, c.name, c.city, m.joined_at
       FROM memberships m JOIN communities c ON c.id = m.community_id
       WHERE m.user_id = ?`
    )
    .all(userId);

  const posts = db
    .prepare(
      `SELECT p.id, p.community_id, c.name AS community_name, p.body, p.created_at
       FROM posts p JOIN communities c ON c.id = p.community_id
       WHERE p.author_id = ? ORDER BY p.created_at ASC`
    )
    .all(userId);

  const events = db
    .prepare(
      `SELECT id, community_id, title, description, location, address, starts_at, created_at
       FROM events WHERE creator_id = ? ORDER BY starts_at ASC`
    )
    .all(userId);

  const eventRsvps = db
    .prepare(
      `SELECT er.event_id, e.title, er.status
       FROM event_rsvps er JOIN events e ON e.id = er.event_id
       WHERE er.user_id = ?`
    )
    .all(userId);

  const messagesSent = db
    .prepare(
      'SELECT id, recipient_id, body, created_at FROM messages WHERE sender_id = ? ORDER BY created_at ASC'
    )
    .all(userId);

  const messagesReceived = db
    .prepare(
      'SELECT id, sender_id, body, created_at, read_at FROM messages WHERE recipient_id = ? ORDER BY created_at ASC'
    )
    .all(userId);

  const blocks = db
    .prepare('SELECT blocked_id, created_at FROM user_blocks WHERE blocker_id = ?')
    .all(userId);

  const exportData = {
    exportedAt: new Date().toISOString(),
    notice:
      'Detta är en export av all data vi lagrar om dig enligt GDPR artikel 20. Du kan flytta den till en annan tjänst.',
    user,
    interests,
    memberships,
    posts,
    events,
    eventRsvps,
    messagesSent,
    messagesReceived,
    blockedUsers: blocks,
  };

  // Skicka som nedladdningsbar JSON-fil
  const filename = `gemenskap-mina-data-${userId}-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(JSON.stringify(exportData, null, 2));
});

// Delete account (GDPR)
router.delete('/me', requireAuth, (req, res) => {
  const userId = req.userId;

  // Remove avatar file
  ['.jpg', '.png', '.webp'].forEach((e) => {
    const file = path.join(uploadsDir, `${userId}${e}`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });

  // Delete all user data (ON DELETE CASCADE handles most, but be explicit)
  db.prepare('DELETE FROM event_rsvps WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM messages WHERE sender_id = ? OR recipient_id = ?').run(userId, userId);
  db.prepare('DELETE FROM posts WHERE author_id = ?').run(userId);
  db.prepare('DELETE FROM memberships WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM user_interests WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM auth_codes WHERE phone = (SELECT phone FROM users WHERE id = ?)').run(userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);

  res.clearCookie('sid');
  res.json({ ok: true });
});

router.get('/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!id || !Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid_id' });
  }
  const u = db
    .prepare('SELECT id, display_name, city, bio FROM users WHERE id = ?')
    .get(id);
  if (!u) return res.status(404).json({ error: 'not_found' });

  // Privacy: endast egen profil eller medlemmar i samma community får se
  // detaljerna. Förhindrar IDOR där en autentiserad användare scrapar
  // alla profiler genom att iterera /api/users/1, /2, /3...
  if (id !== req.userId) {
    const sharesCommunity = db
      .prepare(
        `SELECT 1 FROM memberships m1
         JOIN memberships m2 ON m1.community_id = m2.community_id
         WHERE m1.user_id = ? AND m2.user_id = ?
         LIMIT 1`
      )
      .get(req.userId, id);
    // Blockerade åt något håll? Då nekas också.
    const blocked = db
      .prepare(
        `SELECT 1 FROM user_blocks
         WHERE (blocker_id = ? AND blocked_id = ?)
            OR (blocker_id = ? AND blocked_id = ?)
         LIMIT 1`
      )
      .get(req.userId, id, id, req.userId);
    if (!sharesCommunity || blocked) {
      return res.status(403).json({
        error: 'not_visible',
        message_sv: 'Den här profilen är inte synlig för dig.',
        message_en: 'This profile is not visible to you.',
      });
    }
  }

  u.avatarUrl = avatarUrl(id);
  const interests = db
    .prepare('SELECT interest FROM user_interests WHERE user_id = ?')
    .all(id)
    .map((r) => r.interest);
  const communities = db
    .prepare(
      'SELECT c.id, c.name FROM memberships m JOIN communities c ON c.id = m.community_id WHERE m.user_id = ?'
    )
    .all(id);
  res.json({ user: { ...u, interests, communities } });
});

module.exports = router;
