const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { db, uploadsDir } = require('./db');

const router = express.Router();

const CODE_TTL_MS = 10 * 60 * 1000;
const SESSION_COOKIE = 'sid';
const MAX_VERIFY_ATTEMPTS = 5; // Max felaktiga försök per kod innan den invalideras

// Säker cookie i produktion (kräver HTTPS), avslappnad i dev (HTTP localhost).
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 år
const SESSION_INACTIVE_MS = 90 * 24 * 60 * 60 * 1000; // 90 dagar för "gammal" session
const MAX_SESSIONS_PER_USER = 10;
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: IS_PRODUCTION,
  maxAge: SESSION_TTL_MS,
};

// Vid serverstart: rensa sessioner äldre än TTL (= cookien har redan
// gått ut hos klienten, ingen kommer återanvända dem). Stops sessions-
// tabellen från att växa monotont.
try {
  const cutoff = Date.now() - SESSION_TTL_MS;
  const info = db.prepare('DELETE FROM sessions WHERE created_at < ?').run(cutoff);
  if (info.changes > 0) {
    console.log(`[auth] Rensade ${info.changes} utgångna sessioner vid uppstart.`);
  }
} catch (e) { /* sessions-tabellen kanske inte finns ännu */ }

function normalizePhone(raw) {
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 12) return null;
  return digits;
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

router.post('/request-code', (req, res) => {
  const phone = normalizePhone(req.body && req.body.phone);
  if (!phone) {
    return res.status(400).json({
      error: 'invalid_phone',
      message_sv:
        'Numret behöver vara minst 8 siffror, t.ex. 070-123 45 67. Kontrollera och försök igen.',
      message_en: 'The number needs to be at least 8 digits, e.g. 070-123 45 67. Please check and try again.',
    });
  }

  const recent = db
    .prepare('SELECT COUNT(*) AS n FROM auth_codes WHERE phone = ? AND created_at > ?')
    .get(phone, Date.now() - 60 * 60 * 1000).n;
  if (recent >= 5) {
    return res.status(429).json({
      error: 'too_many_codes',
      message_sv:
        'Vi har skickat flera koder till det här numret. Vänta några minuter och försök sedan igen.',
      message_en: 'Several codes have already been sent. Please wait a few minutes and try again.',
    });
  }

  const code = generateCode();
  const now = Date.now();
  db.prepare('INSERT INTO auth_codes (phone, code, expires_at, created_at) VALUES (?, ?, ?, ?)').run(
    phone,
    code,
    now + CODE_TTL_MS,
    now
  );

  console.log(`[DEV-SMS] Kod till ${phone}: ${code} (giltig 10 min)`);
  res.json({ ok: true, dev_code: code });
});

router.post('/verify', (req, res) => {
  const phone = normalizePhone(req.body && req.body.phone);
  const code = req.body && req.body.code && String(req.body.code).trim();
  if (!phone || !code) {
    return res.status(400).json({
      error: 'missing',
      message_sv: 'Fyll i både telefonnummer och kod.',
      message_en: 'Please fill in both phone number and code.',
    });
  }

  const row = db
    .prepare('SELECT rowid, code, expires_at, attempts FROM auth_codes WHERE phone = ? ORDER BY rowid DESC LIMIT 1')
    .get(phone);

  if (!row) {
    return res.status(400).json({
      error: 'no_code',
      message_sv:
        'Vi hittar ingen kod för det här numret. Tryck på Skicka ny kod nedan.',
      message_en: 'No code found for this number. Tap Send new code below.',
    });
  }

  if (row.expires_at < Date.now()) {
    return res.status(400).json({
      error: 'expired',
      message_sv: 'Koden är för gammal. Tryck på Skicka ny kod nedan.',
      message_en: 'The code has expired. Tap Send new code below.',
    });
  }

  // Brute-force-skydd: invalidera koden om den redan har felaktiga försök >= MAX
  const attempts = row.attempts || 0;
  if (attempts >= MAX_VERIFY_ATTEMPTS) {
    db.prepare('DELETE FROM auth_codes WHERE phone = ?').run(phone);
    return res.status(429).json({
      error: 'too_many_attempts',
      message_sv:
        'För många försök. För din säkerhet behöver du begära en ny kod. Tryck på Skicka ny kod.',
      message_en:
        'Too many attempts. For your security, please request a new code. Tap Send new code.',
    });
  }

  // Timing-safe jämförelse: `===` läcker hur många initiala tecken som
  // matchar via mätbar tidsskillnad. timingSafeEqual tar konstant tid
  // oavsett var skillnaden ligger. Kräver buffrar av samma längd —
  // annars returnerar false direkt (men det är ok eftersom vår kod
  // alltid är 6 siffror).
  const expectedBuf = Buffer.from(String(row.code), 'utf8');
  const givenBuf = Buffer.from(String(code), 'utf8');
  const codeMatches =
    expectedBuf.length === givenBuf.length &&
    crypto.timingSafeEqual(expectedBuf, givenBuf);

  if (!codeMatches) {
    // Räkna upp försök
    const newAttempts = attempts + 1;
    db.prepare('UPDATE auth_codes SET attempts = ? WHERE rowid = ?').run(newAttempts, row.rowid);

    // Om vi just nådde gränsen, invalidera direkt
    if (newAttempts >= MAX_VERIFY_ATTEMPTS) {
      db.prepare('DELETE FROM auth_codes WHERE phone = ?').run(phone);
      return res.status(429).json({
        error: 'too_many_attempts',
        message_sv:
          'För många felaktiga försök. För din säkerhet behöver du begära en ny kod. Tryck på Skicka ny kod.',
        message_en:
          'Too many wrong attempts. For your security, please request a new code. Tap Send new code.',
      });
    }

    const remaining = MAX_VERIFY_ATTEMPTS - newAttempts;
    return res.status(400).json({
      error: 'wrong_code',
      message_sv:
        `Koden stämmer inte. Du har ${remaining} försök kvar innan koden låses. Vill du ha en ny?`,
      message_en:
        `The code is incorrect. You have ${remaining} attempts left before the code is locked. Want a new one?`,
    });
  }

  db.prepare('DELETE FROM auth_codes WHERE phone = ?').run(phone);

  let user = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
  let created = false;
  if (!user) {
    const info = db
      .prepare('INSERT INTO users (phone, language, created_at) VALUES (?, ?, ?)')
      .run(phone, 'sv', Date.now());
    user = { id: info.lastInsertRowid };
    created = true;
  }

  // Säkerhets-housekeeping: rensa gamla sessioner för denna användare
  // så att tabellen inte växer obegränsat. En användare som loggar in
  // från flera enheter kan ha flera samtidigt — men vi kapar vid 10.
  const inactiveCutoff = Date.now() - SESSION_INACTIVE_MS;
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND created_at < ?')
    .run(user.id, inactiveCutoff);

  // Om användaren ändå har för många aktiva sessioner kvar, ta bort
  // de äldsta så bara de MAX_SESSIONS_PER_USER nyaste behålls.
  const excess = db
    .prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?')
    .get(user.id).n;
  if (excess >= MAX_SESSIONS_PER_USER) {
    const toRemove = excess - MAX_SESSIONS_PER_USER + 1;
    db.prepare(
      `DELETE FROM sessions
       WHERE token IN (
         SELECT token FROM sessions
         WHERE user_id = ?
         ORDER BY created_at ASC
         LIMIT ?
       )`
    ).run(user.id, toRemove);
  }

  const token = generateToken();
  db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)').run(
    token,
    user.id,
    Date.now()
  );

  res.cookie(SESSION_COOKIE, token, COOKIE_OPTS);

  const needsOnboarding =
    created ||
    !db.prepare('SELECT display_name, city FROM users WHERE id = ?').get(user.id).display_name;

  res.json({ ok: true, needsOnboarding });
});

router.get('/me', (req, res) => {
  const token = req.cookies && req.cookies[SESSION_COOKIE];
  if (!token) return res.json({ user: null });
  const row = db
    .prepare(
      'SELECT u.id, u.phone, u.display_name, u.city, u.bio, u.language FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?'
    )
    .get(token);
  if (!row) return res.json({ user: null });
  // Check for avatar
  let avatarUrl = null;
  for (const ext of ['.jpg', '.png', '.webp']) {
    if (fs.existsSync(path.join(uploadsDir, `${row.id}${ext}`))) {
      avatarUrl = `/uploads/${row.id}${ext}`;
      break;
    }
  }
  const interests = db
    .prepare('SELECT interest FROM user_interests WHERE user_id = ?')
    .all(row.id)
    .map((r) => r.interest);
  const memberships = db
    .prepare(
      'SELECT c.id, c.name, c.city FROM memberships m JOIN communities c ON c.id = m.community_id WHERE m.user_id = ?'
    )
    .all(row.id);
  // Skapade grupper — användaren behåller alltid en koppling till dessa,
  // även efter att de lämnat. Visas separat i profil/UI så de kan hitta tillbaka.
  const createdCommunities = db
    .prepare(
      'SELECT id, name, city FROM communities WHERE creator_id = ? ORDER BY created_at DESC'
    )
    .all(row.id);
  res.json({ user: { ...row, avatarUrl, interests, memberships, createdCommunities } });
});

router.post('/logout', (req, res) => {
  const token = req.cookies && req.cookies[SESSION_COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies[SESSION_COOKIE];
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  const session = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token);
  if (!session) return res.status(401).json({ error: 'unauthorized' });
  req.userId = session.user_id;
  next();
}

module.exports = { router, requireAuth };
