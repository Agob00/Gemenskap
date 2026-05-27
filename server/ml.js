/**
 * Klusterbaserad ML — tilldelar en grupp till varje användare.
 *
 * Bytet jämfört med den gamla ml.js: vi har slängt det handgjorda neurala
 * nätet + den falska "collaborative filter". Istället bygger vi
 * communities offline via DBSCAN per stad (i scripts/generate-synthetic-dataset.js),
 * och vid runtime tilldelas varje ny användare det kluster som ligger
 * närmast hens intressen.
 *
 * Likhetsmått: Jaccard mellan användarens intressen och klustrets
 * topp-intressen. Generiska intressen (Promenader/Fika/Resor) viktas ned
 * så de inte ensamma styr tilldelningen.
 *
 * Geografi: vi föredrar samma stad. Endast om ingen plats finns i staden
 * faller vi tillbaka till närmsta stad (haversine).
 */

const { db, MAX_MEMBERS } = require('./db');

// Måste matcha generatorn och frontend (public/js/interests.js)
const GENERIC_INTERESTS = new Set(['Promenader', 'Fika', 'Resor']);

// Stadskoordinater för fallback när användarens stad saknar lediga kluster
const CITY_COORDS = {
  'stockholm':   [59.3293, 18.0686],
  'göteborg':    [57.7089, 11.9746],
  'malmö':       [55.6050, 13.0038],
  'uppsala':     [59.8586, 17.6389],
  'västerås':    [59.6099, 16.5448],
  'örebro':      [59.2753, 15.2134],
  'linköping':   [58.4108, 15.6214],
  'helsingborg': [56.0465, 12.6945],
  'norrköping':  [58.5877, 16.1924],
  'lund':        [55.7047, 13.1910],
  'umeå':        [63.8258, 20.2630],
  'jönköping':   [57.7826, 14.1618],
  'borås':       [57.7210, 12.9401],
  'sundsvall':   [62.3908, 17.3069],
  'gävle':       [60.6749, 17.1413],
  'karlstad':    [59.3793, 13.5036],
  'växjö':       [56.8777, 14.8091],
  'halmstad':    [56.6745, 12.8578],
  'kristianstad':[56.0294, 14.1567],
  'eskilstuna':  [59.3666, 16.5077],
  'kalmar':      [56.6634, 16.3567],
  'falun':       [60.6065, 15.6355],
  'trollhättan': [58.2837, 12.2886],
  'östersund':   [63.1766, 14.6361],
};

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
          + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
          * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function cityDistance(cityA, cityB) {
  if (!cityA || !cityB) return 9999;
  const a = CITY_COORDS[cityA.toLowerCase()];
  const b = CITY_COORDS[cityB.toLowerCase()];
  if (!a || !b) return 9999;
  return haversineKm(a[0], a[1], b[0], b[1]);
}

/**
 * Viktad Jaccard mellan två intresseuppsättningar. Generiska intressen
 * får halverad vikt så ett delat "Fika" inte väger lika mycket som ett
 * delat "Schack".
 */
function weightedJaccard(userInterests, communityInterests) {
  const u = userInterests instanceof Set ? userInterests : new Set(userInterests);
  const c = communityInterests instanceof Set ? communityInterests : new Set(communityInterests);
  if (u.size === 0 || c.size === 0) return 0;
  let interW = 0, unionW = 0;
  const seen = new Set();
  for (const it of u) {
    const w = GENERIC_INTERESTS.has(it) ? 0.5 : 1.0;
    if (c.has(it)) interW += w;
    unionW += w;
    seen.add(it);
  }
  for (const it of c) {
    if (seen.has(it)) continue;
    const w = GENERIC_INTERESTS.has(it) ? 0.5 : 1.0;
    unionW += w;
  }
  if (unionW === 0) return 0;
  return interW / unionW;
}

/**
 * Hämtar alla communities + deras intressen + medlemsantal från DB.
 * Returnerar bara grupper som har plats kvar (< MAX_MEMBERS).
 */
function loadOpenCommunities() {
  // En query med JOIN + GROUP_CONCAT istället för N+1.
  const rows = db
    .prepare(
      `SELECT c.id, c.name, c.description, c.city,
              COALESCE(COUNT(DISTINCT m.user_id), 0) AS member_count,
              (SELECT GROUP_CONCAT(interest, '')
                 FROM community_interests
                WHERE community_id = c.id) AS interests_csv
         FROM communities c
         LEFT JOIN memberships m ON m.community_id = c.id
        GROUP BY c.id`
    )
    .all();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    city: r.city,
    memberCount: r.member_count,
    interests: r.interests_csv ? r.interests_csv.split('') : [],
  }));
}

/**
 * Tilldela bästa community åt en användare baserat på intressen + stad.
 *
 * Algoritm:
 *   1. Filtrera bort communities användaren redan är medlem i + de hen
 *      explicit avvisat (user_community_rejections) + fulla grupper.
 *   2. För varje kandidat: räkna weightedJaccard mot dess intressen och
 *      en stadspoäng (samma stad = 1.0, nära = 0.7, långt = 0.4).
 *   3. Slutpoäng = jaccard * 0.7 + cityScore * 0.3.
 *   4. Returnera bäst rankade. Om bäst < 0.05, returnera null (verkligen
 *      ingen passform — bör vara extremt sällsynt med 43 grupper).
 */
function assignBestCommunity(userId) {
  const user = db
    .prepare('SELECT id, city FROM users WHERE id = ?')
    .get(userId);
  if (!user) return null;

  const interests = db
    .prepare('SELECT interest FROM user_interests WHERE user_id = ?')
    .all(userId)
    .map((r) => r.interest);
  const userSet = new Set(interests);

  const joinedRows = db
    .prepare('SELECT community_id FROM memberships WHERE user_id = ?')
    .all(userId);
  const excludeSet = new Set(joinedRows.map((r) => r.community_id));

  const rejectedRows = db
    .prepare('SELECT community_id FROM user_community_rejections WHERE user_id = ?')
    .all(userId);
  for (const r of rejectedRows) excludeSet.add(r.community_id);

  const allCommunities = loadOpenCommunities();
  const candidates = allCommunities.filter(
    (c) => !excludeSet.has(c.id) && c.memberCount < MAX_MEMBERS
  );

  if (candidates.length === 0) return null;

  let best = null;
  let bestScore = -1;
  let bestDetail = null;
  for (const c of candidates) {
    const jacc = weightedJaccard(userSet, new Set(c.interests));
    let cityScore;
    if (!user.city || !c.city) {
      cityScore = 0.5;
    } else if (user.city.toLowerCase() === c.city.toLowerCase()) {
      cityScore = 1.0;
    } else {
      const km = cityDistance(user.city, c.city);
      if (km < 80) cityScore = 0.8;
      else if (km < 200) cityScore = 0.55;
      else cityScore = 0.30;
    }
    const score = jacc * 0.7 + cityScore * 0.3;
    if (score > bestScore) {
      bestScore = score;
      best = c;
      bestDetail = { jaccard: jacc, cityScore, score };
    }
  }

  // Hård tröskel: om till och med bästa är < 0.05 vill vi inte tvinga in
  // hen i en irrelevant grupp. Med 43 kluster och 33 intressen är detta
  // i praktiken bara om användaren har 0 intressen — och den vägen
  // stoppas på frontend.
  if (bestScore < 0.05) return null;

  return {
    communityId: best.id,
    name: best.name,
    city: best.city,
    description: best.description,
    interests: best.interests,
    memberCount: best.memberCount,
    sharedInterests: best.interests.filter((i) => userSet.has(i)),
    score: Math.round(bestScore * 100),
    jaccard: Math.round(bestDetail.jaccard * 100),
    cityMatch: bestDetail.cityScore === 1.0,
    cityScore: Math.round(bestDetail.cityScore * 100),
  };
}

/**
 * Räkna Jaccard mellan en användares intressen och en specifik communitys
 * intressen. Används för att flagga "matchen är inte längre bra" efter att
 * användaren ändrat intressen på profilsidan.
 *
 * Returnerar { jaccard, sharedInterests } eller null om gruppen saknas.
 * Tröskeln för mismatch-banner sätts av anroparen (typiskt 0.15).
 */
function scoreUserAgainstCommunity(userId, communityId) {
  const c = db
    .prepare('SELECT id FROM communities WHERE id = ?')
    .get(communityId);
  if (!c) return null;
  const userInterests = db
    .prepare('SELECT interest FROM user_interests WHERE user_id = ?')
    .all(userId)
    .map((r) => r.interest);
  const communityInterests = db
    .prepare('SELECT interest FROM community_interests WHERE community_id = ?')
    .all(communityId)
    .map((r) => r.interest);
  const userSet = new Set(userInterests);
  const commSet = new Set(communityInterests);
  const jacc = weightedJaccard(userSet, commSet);
  return {
    jaccard: jacc,
    sharedInterests: communityInterests.filter((i) => userSet.has(i)),
  };
}

/**
 * Spara att en användare avvisat ett community så vi inte föreslår det
 * igen vid nästa "leave + ny grupp"-cykel.
 */
function rejectCommunity(userId, communityId) {
  db.prepare(
    `INSERT OR IGNORE INTO user_community_rejections
     (user_id, community_id, rejected_at) VALUES (?, ?, ?)`
  ).run(userId, communityId, Date.now());
}

/**
 * Rensa avvisningshistoriken — användbart om man vill "starta om"
 * matchningsrundan. Anropas idag inte automatiskt; sparad för admin/UI.
 */
function clearRejections(userId) {
  db.prepare('DELETE FROM user_community_rejections WHERE user_id = ?').run(userId);
}

module.exports = {
  assignBestCommunity,
  scoreUserAgainstCommunity,
  rejectCommunity,
  clearRejections,
  weightedJaccard,
  GENERIC_INTERESTS,
};
