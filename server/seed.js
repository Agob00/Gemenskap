const { db } = require('./db');
const fs = require('fs');
const path = require('path');

const now = Date.now();

function reset() {
  db.exec(`
    DELETE FROM event_rsvps;
    DELETE FROM events;
    DELETE FROM messages;
    DELETE FROM posts;
    DELETE FROM memberships;
    DELETE FROM community_interests;
    DELETE FROM communities;
    DELETE FROM user_interests;
    DELETE FROM sessions;
    DELETE FROM auth_codes;
    DELETE FROM users;
    DELETE FROM sqlite_sequence;
  `);
}

function run() {
  // Load dataset (genererat av scripts/generate-synthetic-dataset.js)
  const dataPath = path.join(__dirname, '..', 'data', 'dataset.json');
  if (!fs.existsSync(dataPath)) {
    console.error('Ingen dataset hittad. Kör först: npm run build-dataset');
    process.exit(1);
  }
  const dataset = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  console.log(`Laddar dataset (källa: ${dataset.metadata.source || 'okänd'})`);

  reset();

  // Prepared statements
  const insertUser = db.prepare(
    'INSERT INTO users (phone, display_name, city, language, created_at) VALUES (?, ?, ?, ?, ?)'
  );
  const insertUserInterest = db.prepare(
    'INSERT OR IGNORE INTO user_interests (user_id, interest) VALUES (?, ?)'
  );
  const insertCommunity = db.prepare(
    'INSERT INTO communities (name, description, city, created_at) VALUES (?, ?, ?, ?)'
  );
  const insertCommunityInterest = db.prepare(
    'INSERT OR IGNORE INTO community_interests (community_id, interest) VALUES (?, ?)'
  );
  const insertMembership = db.prepare(
    'INSERT OR IGNORE INTO memberships (user_id, community_id, joined_at) VALUES (?, ?, ?)'
  );
  const insertPost = db.prepare(
    'INSERT INTO posts (community_id, author_id, body, created_at) VALUES (?, ?, ?, ?)'
  );
  const insertEvent = db.prepare(
    'INSERT INTO events (community_id, creator_id, title, description, location, address, starts_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  // -- Users --
  const userIdMap = {}; // dataset id → db id
  const insertUsers = db.transaction(() => {
    for (const u of dataset.users) {
      const info = insertUser.run(u.phone, u.display_name, u.city, 'sv', now);
      userIdMap[u.id] = Number(info.lastInsertRowid);
      for (const interest of u.interests) {
        insertUserInterest.run(Number(info.lastInsertRowid), interest);
      }
    }
  });
  insertUsers();

  // -- Communities --
  const commIdMap = {}; // dataset id → db id
  const insertCommunities = db.transaction(() => {
    for (const c of dataset.communities) {
      const info = insertCommunity.run(c.name, c.description, c.city, now);
      commIdMap[c.id] = Number(info.lastInsertRowid);
      for (const interest of c.interests) {
        insertCommunityInterest.run(Number(info.lastInsertRowid), interest);
      }
    }
  });
  insertCommunities();

  // -- Memberships --
  const insertMemberships = db.transaction(() => {
    for (const m of dataset.memberships) {
      const uid = userIdMap[m.userId];
      const cid = commIdMap[m.communityId];
      if (uid && cid) insertMembership.run(uid, cid, now);
    }
  });
  insertMemberships();

  // -- Posts --
  const insertPosts = db.transaction(() => {
    for (const p of dataset.posts) {
      const uid = userIdMap[p.authorId];
      const cid = commIdMap[p.communityId];
      if (uid && cid) insertPost.run(cid, uid, p.body, p.createdAt || now);
    }
  });
  insertPosts();

  // -- Events --
  const insertEvents = db.transaction(() => {
    for (const e of dataset.events) {
      const uid = userIdMap[e.creatorId];
      const cid = commIdMap[e.communityId];
      if (uid && cid) {
        insertEvent.run(cid, uid, e.title, e.description, e.location, e.address || null, e.startsAt || now, now);
      }
    }
  });
  insertEvents();

  // Summary
  const nUsers = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  const nComm = db.prepare('SELECT COUNT(*) AS n FROM communities').get().n;
  const nMem = db.prepare('SELECT COUNT(*) AS n FROM memberships').get().n;
  const nPosts = db.prepare('SELECT COUNT(*) AS n FROM posts').get().n;
  const nEvents = db.prepare('SELECT COUNT(*) AS n FROM events').get().n;

  console.log(`\nSeedat från syntetiskt dataset (DBSCAN-genererade kluster):`);
  console.log(`  ${nUsers} användare`);
  console.log(`  ${nComm} communities`);
  console.log(`  ${nMem} medlemskap (${(nMem / nUsers).toFixed(1)} snitt per användare)`);
  console.log(`  ${nPosts} inlägg`);
  console.log(`  ${nEvents} event`);
  console.log(`\nTestanvändare för inloggning:`);
  const testUsers = db.prepare('SELECT phone, display_name, city FROM users LIMIT 5').all();
  for (const u of testUsers) {
    console.log(`  ${u.phone} — ${u.display_name} (${u.city})`);
  }
}

if (require.main === module) {
  run();
}

module.exports = { run };
