const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const db = new Database(path.join(dataDir, 'app.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE NOT NULL,
  display_name TEXT,
  city TEXT,
  bio TEXT,
  language TEXT DEFAULT 'sv',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_interests (
  user_id INTEGER NOT NULL,
  interest TEXT NOT NULL,
  PRIMARY KEY (user_id, interest),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS communities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  city TEXT NOT NULL,
  creator_id INTEGER,
  empty_since INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS community_interests (
  community_id INTEGER NOT NULL,
  interest TEXT NOT NULL,
  PRIMARY KEY (community_id, interest),
  FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS memberships (
  user_id INTEGER NOT NULL,
  community_id INTEGER NOT NULL,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, community_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  community_id INTEGER NOT NULL,
  author_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  community_id INTEGER NOT NULL,
  creator_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  address TEXT,
  starts_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE,
  FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS event_rsvps (
  event_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  PRIMARY KEY (event_id, user_id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL,
  recipient_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  read_at INTEGER,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_codes (
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS auth_codes_phone_idx ON auth_codes(phone);

CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id INTEGER NOT NULL,
  blocked_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id),
  FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL,
  target_type TEXT NOT NULL,    -- 'post' eller 'user' eller 'message'
  target_id INTEGER NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',  -- 'open' / 'reviewed' / 'dismissed'
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS reports_target_idx ON reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_community_rejections (
  user_id INTEGER NOT NULL,
  community_id INTEGER NOT NULL,
  rejected_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, community_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS memberships_community_idx ON memberships(community_id);
CREATE INDEX IF NOT EXISTS memberships_user_idx ON memberships(user_id);
CREATE INDEX IF NOT EXISTS messages_pair_idx ON messages(sender_id, recipient_id, created_at);
CREATE INDEX IF NOT EXISTS posts_community_idx ON posts(community_id, created_at DESC);
CREATE INDEX IF NOT EXISTS events_community_idx ON events(community_id, starts_at);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
`);

// Migration: lägg till attempts-kolumnen om den saknas i en befintlig DB
try {
  const cols = db.prepare("PRAGMA table_info(auth_codes)").all();
  if (!cols.some((c) => c.name === 'attempts')) {
    db.exec('ALTER TABLE auth_codes ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0');
  }
} catch (e) { /* tabellen kanske inte finns ännu */ }

// Migration: lägg till creator_id på communities om den saknas, och försök
// fylla i den för AI-skapta grupper baserat på heuristiken "första
// medlemmen som joinade exakt vid skapande är creator".
try {
  const cols = db.prepare("PRAGMA table_info(communities)").all();
  if (!cols.some((c) => c.name === 'creator_id')) {
    db.exec('ALTER TABLE communities ADD COLUMN creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL');
    db.exec(`
      UPDATE communities
      SET creator_id = (
        SELECT m.user_id FROM memberships m
        WHERE m.community_id = communities.id AND m.joined_at = communities.created_at
        LIMIT 1
      )
      WHERE creator_id IS NULL
    `);
  }
  // OBS: vi raderar INTE längre tomma communities vid uppstart. Den
  // tidigare migrationen ("DELETE FROM communities WHERE id NOT IN
  // (SELECT community_id FROM memberships)") kunde radera precis nyskapade
  // grupper eller grupper där sista medlemmen råkat lämna och var farlig
  // mot riktig data. Tom-cleanup ska vara en explicit task, inte ett
  // sidoeffekt vid serverstart.
} catch (e) { /* tabellen kanske inte finns ännu */ }

const MAX_MEMBERS = 40;

module.exports = { db, MAX_MEMBERS, uploadsDir };
