const express = require('express');
const { db, MAX_MEMBERS } = require('./db');
const { requireAuth } = require('./auth');
const { assignBestCommunity, rejectCommunity, scoreUserAgainstCommunity } = require('./ml');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const list = db
    .prepare('SELECT id, name, description, city FROM communities ORDER BY name')
    .all()
    .map((c) => {
      const memberCount = db
        .prepare('SELECT COUNT(*) AS n FROM memberships WHERE community_id = ?')
        .get(c.id).n;
      const interests = db
        .prepare('SELECT interest FROM community_interests WHERE community_id = ?')
        .all(c.id)
        .map((r) => r.interest);
      return { ...c, memberCount, maxMembers: MAX_MEMBERS, interests };
    });
  res.json({ communities: list });
});

// ── Auto-assign: ML väljer grupp åt användaren ─────────────────────
// POST /api/communities/auto-assign
//   Om användaren redan är medlem i en grupp returneras den.
//   Annars körs assignBestCommunity och användaren joinas automatiskt.
//   Returnerar { community } eller { community: null } om ingen match.
router.post('/auto-assign', requireAuth, (req, res) => {
  // Är användaren redan medlem i en grupp? Returnera den första.
  const existing = db
    .prepare(
      `SELECT c.id, c.name, c.description, c.city
         FROM memberships m JOIN communities c ON c.id = m.community_id
        WHERE m.user_id = ?
        ORDER BY m.joined_at DESC LIMIT 1`
    )
    .get(req.userId);
  if (existing) {
    return res.json({ community: existing, alreadyMember: true });
  }

  // Försök tilldela + joina atomärt. Om gruppen råkar bli full mellan
  // assignBestCommunity och insert, avvisa den och pröva en gång till.
  // Hela proceduren sker inom en transaktion så två samtidiga auto-assigns
  // inte kan båda läsa memberCount=39 och båda lyckas inserta.
  function tryAssignOnce(prevAssignment) {
    const assignment = prevAssignment || assignBestCommunity(req.userId);
    if (!assignment) return { assignment: null };
    const txn = db.transaction(() => {
      const n = db
        .prepare('SELECT COUNT(*) AS n FROM memberships WHERE community_id = ?')
        .get(assignment.communityId).n;
      if (n >= MAX_MEMBERS) return { full: true };
      db.prepare(
        'INSERT OR IGNORE INTO memberships (user_id, community_id, joined_at) VALUES (?, ?, ?)'
      ).run(req.userId, assignment.communityId, Date.now());
      return { full: false };
    });
    return { assignment, ...txn() };
  }

  let r = tryAssignOnce(null);
  if (r.assignment && r.full) {
    rejectCommunity(req.userId, r.assignment.communityId);
    r = tryAssignOnce(null);
  }
  if (!r.assignment) {
    return res.json({
      community: null,
      message_sv:
        'Vi hittade ingen grupp som passar dina intressen just nu. Lägg till fler intressen eller försök igen senare.',
      message_en:
        'We could not find a group matching your interests yet. Add more interests or try again later.',
    });
  }
  if (r.full) {
    // Båda försöken blev fulla samtidigt — extremt osannolikt men returnera null.
    return res.json({ community: null });
  }
  // Normalisera så frontend alltid kan läsa community.id (oavsett om
  // svaret kommer från DB-queryn ovan eller från ML-tilldelningen).
  res.json({ community: { id: r.assignment.communityId, ...r.assignment }, assigned: true });
});

router.get('/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const c = db.prepare('SELECT id, name, description, city, creator_id FROM communities WHERE id = ?').get(id);
  if (!c) return res.status(404).json({ error: 'not_found' });
  const memberCount = db
    .prepare('SELECT COUNT(*) AS n FROM memberships WHERE community_id = ?')
    .get(id).n;
  const interests = db
    .prepare('SELECT interest FROM community_interests WHERE community_id = ?')
    .all(id)
    .map((r) => r.interest);
  const isMember = !!db
    .prepare('SELECT 1 FROM memberships WHERE community_id = ? AND user_id = ?')
    .get(id, req.userId);
  const isCreator = c.creator_id === req.userId;
  // Räkna Jaccard mot användaren bara om hen är medlem — annars är fältet
  // irrelevant (vi visar inte mismatch-banner för icke-medlemmar).
  let interestMatch = null;
  if (isMember) {
    const s = scoreUserAgainstCommunity(req.userId, id);
    if (s) interestMatch = s.jaccard;
  }
  res.json({ community: { ...c, memberCount, maxMembers: MAX_MEMBERS, interests, isMember, isCreator, interestMatch } });
});

router.get('/:id/members', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  // Medlemslistan är privat — bara medlemmar i gruppen ska kunna se vilka
  // de andra är. Annars läcker vi kontaktinformation till hela userbase:n.
  const isMember = !!db
    .prepare('SELECT 1 FROM memberships WHERE community_id = ? AND user_id = ?')
    .get(id, req.userId);
  if (!isMember) {
    return res.status(403).json({
      error: 'not_member',
      message_sv: 'Du måste vara medlem i gruppen för att se medlemslistan.',
      message_en: 'You must be a member of this group to see its member list.',
    });
  }
  const members = db
    .prepare(
      'SELECT u.id, u.display_name, u.city, m.joined_at FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.community_id = ? ORDER BY u.display_name'
    )
    .all(id);
  res.json({ members });
});

router.post('/:id/join', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const c = db.prepare('SELECT id FROM communities WHERE id = ?').get(id);
  if (!c) return res.status(404).json({ error: 'not_found' });

  // Atomär count+insert: två samtidiga join-requests kan annars båda läsa
  // memberCount=39 och båda lyckas inserta över 40-gränsen.
  const joinTxn = db.transaction(() => {
    const memberCount = db
      .prepare('SELECT COUNT(*) AS n FROM memberships WHERE community_id = ?')
      .get(id).n;
    if (memberCount >= MAX_MEMBERS) return { full: true };
    db.prepare(
      'INSERT OR IGNORE INTO memberships (user_id, community_id, joined_at) VALUES (?, ?, ?)'
    ).run(req.userId, id, Date.now());
    return { full: false };
  });
  const result = joinTxn();
  if (result.full) {
    return res.status(409).json({
      error: 'full',
      message_sv:
        'Den här gruppen är redan full (40 medlemmar). Vi visar gärna ett annat förslag som passar dig.',
      message_en: 'This group is already full (40 members). We can suggest another one that fits you.',
    });
  }
  res.json({ ok: true });
});

// POST /api/communities/:id/leave
//   Lämnar gruppen, registrerar avvisning (så ML inte föreslår den igen),
//   och tilldelar automatiskt nästa bästa grupp om query-param
//   `reassign=1` är satt (default true). Returnerar { deleted, nextCommunity }.
router.post('/:id/leave', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const reassign = req.query.reassign !== '0'; // default = true

  const leaveTxn = db.transaction(() => {
    db.prepare('DELETE FROM memberships WHERE user_id = ? AND community_id = ?').run(req.userId, id);
    // Spara avvisning så ML inte föreslår samma grupp igen
    rejectCommunity(req.userId, id);
    const remaining = db
      .prepare('SELECT COUNT(*) AS n FROM memberships WHERE community_id = ?')
      .get(id).n;
    if (remaining === 0) {
      // Tack vare ON DELETE CASCADE rensas posts, events, community_interests
      // och event_rsvps automatiskt.
      db.prepare('DELETE FROM communities WHERE id = ?').run(id);
      return true;
    }
    return false;
  });
  const deleted = leaveTxn();

  if (!reassign) {
    return res.json({ ok: true, deleted, nextCommunity: null });
  }

  // Försök tilldela + joina atomärt. Om destinationsgruppen råkar bli
  // full mellan assignBestCommunity och INSERT, avvisa den och pröva en
  // gång till. Samma mönster som /auto-assign.
  function tryAssignOnce() {
    const candidate = assignBestCommunity(req.userId);
    if (!candidate) return { candidate: null };
    const txn = db.transaction(() => {
      const n = db
        .prepare('SELECT COUNT(*) AS n FROM memberships WHERE community_id = ?')
        .get(candidate.communityId).n;
      if (n >= MAX_MEMBERS) return { full: true };
      db.prepare(
        'INSERT OR IGNORE INTO memberships (user_id, community_id, joined_at) VALUES (?, ?, ?)'
      ).run(req.userId, candidate.communityId, Date.now());
      return { full: false };
    });
    return { candidate, ...txn() };
  }

  let r = tryAssignOnce();
  if (r.candidate && r.full) {
    rejectCommunity(req.userId, r.candidate.communityId);
    r = tryAssignOnce();
  }
  if (!r.candidate) {
    return res.json({
      ok: true,
      deleted,
      nextCommunity: null,
      message_sv:
        'Vi hittade ingen ny grupp som passar just nu. Du kan ändra dina intressen på din profil och försöka igen.',
      message_en:
        'We could not find a new group right now. You can update your interests on your profile and try again.',
    });
  }
  if (r.full) {
    // Båda försöken hamnade i full grupp — extremt osannolikt.
    return res.json({ ok: true, deleted, nextCommunity: null });
  }
  res.json({ ok: true, deleted, nextCommunity: { id: r.candidate.communityId, ...r.candidate } });
});

module.exports = router;
