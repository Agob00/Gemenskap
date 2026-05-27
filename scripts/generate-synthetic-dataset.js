#!/usr/bin/env node
/**
 * Genererar ett rent syntetiskt dataset av äldre användare och kör DBSCAN
 * per stad för att bilda communities. Output: data/dataset.json.
 *
 * Pipeline:
 *   1. Slumpa fram ~500 användare över 9 städer
 *   2. Tilldela varje användare 1–2 "personas" + några vanliga intressen
 *   3. Kör DBSCAN per stad på Jaccard-avstånd över intressen
 *   4. Splitta kluster > 40 medlemmar
 *   5. Återplacera noise i närmaste kluster om Jaccard når tröskel
 *   6. Namnge varje kluster med kategori-baserad logik (generiska intressen nedviktas)
 *   7. Skriv ut dataset.json med kluster som communities
 *
 * Allt är syntetiskt och deterministiskt (sätter seed). Inga Meetup-data används
 * — det gamla mappet var snävt och fakeade "Fika". Detta dataset är ärligare
 * märkt som syntetiskt.
 */

const fs = require('fs');
const path = require('path');

// ── Deterministisk PRNG så datasetet är reproducerbart ───────────────
let _seed = 1337;
function srand(seed) { _seed = seed >>> 0; }
function rand() {
  // xorshift32
  _seed ^= _seed << 13;
  _seed ^= _seed >>> 17;
  _seed ^= _seed << 5;
  return ((_seed >>> 0) / 0xFFFFFFFF);
}
function randInt(min, max) { return Math.floor(rand() * (max - min + 1)) + min; }
function pickWeighted(items) {
  const total = items.reduce((s, it) => s + it.w, 0);
  let r = rand() * total;
  for (const it of items) { r -= it.w; if (r <= 0) return it.v; }
  return items[items.length - 1].v;
}
function sample(arr, n) {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length > 0) {
    const i = Math.floor(rand() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

// ── Intressetaxonomi (matchar public/js/interests.js) ────────────────
const ALL_INTERESTS = [
  // outdoor
  'Promenader', 'Trädgård', 'Resor', 'Vandring', 'Cykling', 'Fågelskådning',
  // sport
  'Schack', 'Bridge', 'Kortspel', 'Korsord', 'Boule', 'Golf', 'Pingis',
  // create
  'Hantverk', 'Stickning', 'Måleri', 'Konst', 'Foto', 'Musik', 'Sång', 'Dans',
  // culture
  'Bokläsning', 'Filmklubb', 'Teater', 'Museum', 'Historia',
  // food
  'Matlagning', 'Bakning', 'Fika', 'Vinprovning',
  // health
  'Yoga', 'Pilates', 'Meditation', 'Simning',
];

// Generiska intressen — bra fyllnad men ska inte styra klustringen ensam.
const GENERIC_INTERESTS = new Set(['Promenader', 'Fika', 'Resor']);

// Personas: koherent kluster av relaterade intressen.
// Varje användare får 1 primär persona (~ 60% av deras intressen kommer
// härifrån) + ev. en sekundär (lättare touch).
const PERSONAS = [
  { key: 'walker',    interests: ['Promenader', 'Vandring', 'Fågelskådning', 'Cykling', 'Fika'] },
  { key: 'reader',    interests: ['Bokläsning', 'Filmklubb', 'Teater', 'Historia', 'Museum', 'Fika'] },
  { key: 'cook',      interests: ['Matlagning', 'Bakning', 'Vinprovning', 'Fika'] },
  { key: 'artisan',   interests: ['Hantverk', 'Stickning', 'Måleri', 'Konst'] },
  { key: 'musician',  interests: ['Musik', 'Sång', 'Dans', 'Teater'] },
  { key: 'gamer',     interests: ['Schack', 'Bridge', 'Kortspel', 'Korsord'] },
  { key: 'athlete',   interests: ['Boule', 'Golf', 'Pingis', 'Cykling', 'Promenader'] },
  { key: 'wellness',  interests: ['Yoga', 'Pilates', 'Meditation', 'Simning'] },
  { key: 'photographer', interests: ['Foto', 'Konst', 'Måleri', 'Resor', 'Promenader'] },
  { key: 'gardener',  interests: ['Trädgård', 'Promenader', 'Fågelskådning', 'Fika'] },
  { key: 'traveler',  interests: ['Resor', 'Historia', 'Museum', 'Foto', 'Vandring'] },
];

const PERSONA_WEIGHTS = [
  { v: 'walker', w: 1.0 },
  { v: 'reader', w: 0.9 },
  { v: 'cook', w: 0.9 },
  { v: 'artisan', w: 0.7 },
  { v: 'musician', w: 0.8 },
  { v: 'gamer', w: 0.6 },
  { v: 'athlete', w: 0.55 },
  { v: 'wellness', w: 0.7 },
  { v: 'photographer', w: 0.5 },
  { v: 'gardener', w: 0.6 },
  { v: 'traveler', w: 0.7 },
];

const COMMON_FILLER = ['Promenader', 'Fika', 'Resor', 'Bokläsning', 'Matlagning'];

// ── Städer ──────────────────────────────────────────────────────────
const CITIES = [
  { name: 'Stockholm',   weight: 0.28 },
  { name: 'Göteborg',    weight: 0.16 },
  { name: 'Malmö',       weight: 0.11 },
  { name: 'Uppsala',     weight: 0.10 },
  { name: 'Västerås',    weight: 0.08 },
  { name: 'Örebro',      weight: 0.08 },
  { name: 'Linköping',   weight: 0.07 },
  { name: 'Helsingborg', weight: 0.06 },
  { name: 'Norrköping',  weight: 0.06 },
];

// ── Namn (vanliga svenska seniornamn) ──────────────────────────────
const FIRST_F = ['Margareta', 'Birgitta', 'Ingrid', 'Kristina', 'Elisabeth', 'Eva', 'Karin', 'Marie', 'Anna', 'Britt', 'Inger', 'Gun', 'Barbro', 'Marianne', 'Gunilla', 'Ulla', 'Anita', 'Solveig', 'Lena', 'Astrid', 'Siv', 'Berit', 'Agneta', 'Gerd', 'Elsa', 'Greta', 'Inga', 'Viola', 'Maj', 'Yvonne', 'Monica', 'Christina'];
const FIRST_M = ['Lars', 'Karl', 'Anders', 'Per', 'Erik', 'Sven', 'Nils', 'Gunnar', 'Lennart', 'Bengt', 'Ove', 'Rune', 'Bertil', 'Göran', 'Arne', 'Bo', 'Leif', 'Hans', 'Ingemar', 'Torsten', 'Jan', 'Olle', 'Ragnar', 'Folke', 'Rolf', 'Harald', 'Einar', 'Tore', 'Stig', 'Kjell', 'Roland', 'Gösta'];
const LAST = ['Andersson', 'Johansson', 'Karlsson', 'Nilsson', 'Eriksson', 'Larsson', 'Olsson', 'Persson', 'Svensson', 'Gustafsson', 'Pettersson', 'Jonsson', 'Lindberg', 'Lindström', 'Holm', 'Nyström', 'Ek', 'Berg', 'Sjöberg', 'Wallin', 'Hedlund', 'Frisk', 'Ström', 'Öhman', 'Lind', 'Björk', 'Lundberg', 'Lundgren', 'Bergström', 'Forsberg'];

// ── 1. Generera användare ────────────────────────────────────────────
function generateUsers(targetCount) {
  const users = [];
  for (let i = 1; i <= targetCount; i++) {
    const city = pickWeighted(CITIES.map((c) => ({ v: c.name, w: c.weight })));
    const female = rand() > 0.45;
    const first = (female ? FIRST_F : FIRST_M)[randInt(0, (female ? FIRST_F : FIRST_M).length - 1)];
    const last = LAST[randInt(0, LAST.length - 1)];

    // Primär persona
    const primaryKey = pickWeighted(PERSONA_WEIGHTS);
    const primary = PERSONAS.find((p) => p.key === primaryKey);

    // Sekundär persona (50% chans, alltid annan än primär)
    let secondaryKey = null;
    if (rand() < 0.5) {
      const others = PERSONAS.filter((p) => p.key !== primaryKey);
      secondaryKey = others[randInt(0, others.length - 1)].key;
    }
    const secondary = secondaryKey ? PERSONAS.find((p) => p.key === secondaryKey) : null;

    const interestSet = new Set();
    // 3–5 ur primär persona
    const primaryPick = sample(primary.interests, Math.min(primary.interests.length, randInt(3, 5)));
    for (const it of primaryPick) interestSet.add(it);
    // 1–2 ur sekundär persona
    if (secondary) {
      const secPick = sample(secondary.interests, Math.min(secondary.interests.length, randInt(1, 2)));
      for (const it of secPick) interestSet.add(it);
    }
    // 0–1 vanligt filler om vi har < 4 intressen
    if (interestSet.size < 4 && rand() < 0.6) {
      const filler = COMMON_FILLER[randInt(0, COMMON_FILLER.length - 1)];
      interestSet.add(filler);
    }

    users.push({
      id: i,
      phone: '070' + String(1000000 + i).slice(-7),
      display_name: `${first} ${last}`,
      city,
      interests: [...interestSet],
      _persona: primaryKey + (secondaryKey ? '+' + secondaryKey : ''),
    });
  }
  return users;
}

// ── 2. Jaccard-avstånd ───────────────────────────────────────────────
function jaccard(a, b) {
  const setA = a instanceof Set ? a : new Set(a);
  const setB = b instanceof Set ? b : new Set(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  let inter = 0;
  for (const x of setA) if (setB.has(x)) inter++;
  const union = setA.size + setB.size - inter;
  if (union === 0) return 1;
  return inter / union;
}
function jaccardDist(a, b) { return 1 - jaccard(a, b); }

// ── 3. DBSCAN ────────────────────────────────────────────────────────
//
// Klassisk DBSCAN: en punkt är "core" om den har >= minSamples grannar
// inom eps. Kluster växer från core till core + deras grannar (border).
// Punkter som varken är core eller granne till någon core = noise.
function dbscan(points, eps, minSamples) {
  const n = points.length;
  const labels = new Array(n).fill(undefined); // undefined = ej besökt, -1 = noise, >=0 = klusterId
  let clusterId = -1;

  function neighbors(i) {
    const out = [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (jaccardDist(points[i], points[j]) <= eps) out.push(j);
    }
    return out;
  }

  for (let i = 0; i < n; i++) {
    if (labels[i] !== undefined) continue;
    const N = neighbors(i);
    if (N.length < minSamples) {
      labels[i] = -1;
      continue;
    }
    clusterId++;
    labels[i] = clusterId;
    const queue = [...N];
    const inQueue = new Set(queue);
    while (queue.length > 0) {
      const j = queue.shift();
      if (labels[j] === -1) labels[j] = clusterId; // border-punkt
      if (labels[j] !== undefined) continue;
      labels[j] = clusterId;
      const Nj = neighbors(j);
      if (Nj.length >= minSamples) {
        for (const k of Nj) {
          if (!inQueue.has(k)) { queue.push(k); inQueue.add(k); }
        }
      }
    }
  }
  return labels;
}

// ── 4. Splitta för stora kluster ─────────────────────────────────────
//
// Om ett kluster blir > MAX_MEMBERS — dela det rekursivt med hierarkisk
// binär split: hitta de två "mest olika" medlemmarna, dela övriga efter
// vilken av dem de är närmast. Enkelt och stabilt utan k-means.
function splitCluster(memberIndices, points, max) {
  if (memberIndices.length <= max) return [memberIndices];

  // Hitta mest avlägsna par
  let bestI = memberIndices[0], bestJ = memberIndices[1], bestD = 0;
  for (let a = 0; a < memberIndices.length; a++) {
    for (let b = a + 1; b < memberIndices.length; b++) {
      const d = jaccardDist(points[memberIndices[a]], points[memberIndices[b]]);
      if (d > bestD) { bestD = d; bestI = memberIndices[a]; bestJ = memberIndices[b]; }
    }
  }
  const groupA = [bestI];
  const groupB = [bestJ];
  for (const k of memberIndices) {
    if (k === bestI || k === bestJ) continue;
    const dA = jaccardDist(points[k], points[bestI]);
    const dB = jaccardDist(points[k], points[bestJ]);
    if (dA <= dB) groupA.push(k); else groupB.push(k);
  }
  return [...splitCluster(groupA, points, max), ...splitCluster(groupB, points, max)];
}

// ── 5. Återplacera noise i närmaste kluster ──────────────────────────
function reassignNoise(noiseIndices, clusters, points, jaccardThreshold) {
  const reassigned = [];
  const stillNoise = [];
  // Centroid per kluster = intressen som finns hos > 50% av medlemmarna
  const centroids = clusters.map((c) => clusterCentroid(c, points));
  for (const ni of noiseIndices) {
    let bestCi = -1, bestSim = 0;
    for (let i = 0; i < clusters.length; i++) {
      const sim = jaccard(points[ni], centroids[i]);
      if (sim > bestSim) { bestSim = sim; bestCi = i; }
    }
    if (bestCi >= 0 && bestSim >= jaccardThreshold && clusters[bestCi].length < 40) {
      clusters[bestCi].push(ni);
      // Uppdatera centroid efter insättning
      centroids[bestCi] = clusterCentroid(clusters[bestCi], points);
      reassigned.push(ni);
    } else {
      stillNoise.push(ni);
    }
  }
  return { reassigned, stillNoise };
}

function clusterCentroid(memberIndices, points) {
  const count = new Map();
  for (const i of memberIndices) {
    for (const it of points[i]) count.set(it, (count.get(it) || 0) + 1);
  }
  const half = memberIndices.length / 2;
  const result = new Set();
  for (const [it, c] of count) if (c >= half) result.add(it);
  // Om centroiden blir tom — ta de 3 vanligaste
  if (result.size === 0) {
    const sorted = [...count.entries()].sort((a, b) => b[1] - a[1]);
    for (const [it] of sorted.slice(0, 3)) result.add(it);
  }
  return result;
}

// ── 6. Klusterets viktigaste intressen (för namn + community.interests) ──
function clusterTopInterestsFromUsers(userObjs, topN = 5) {
  const count = new Map();
  for (const u of userObjs) {
    for (const it of u.interests) count.set(it, (count.get(it) || 0) + 1);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN).map(([it]) => it);
}

// ── 7. Kategori-baserad namnsättning (port av Python-skriptet) ──────
const CATEGORY_MAP = {
  'Konst': 'Kultur', 'Museum': 'Kultur', 'Filmklubb': 'Kultur', 'Teater': 'Kultur', 'Historia': 'Kultur',
  'Bokläsning': 'Bok',
  'Musik': 'Musik', 'Dans': 'Musik', 'Sång': 'Musik',
  'Schack': 'Spel', 'Bridge': 'Spel', 'Korsord': 'Spel', 'Kortspel': 'Spel',
  'Matlagning': 'Matlagning', 'Bakning': 'Matlagning', 'Vinprovning': 'Matlagning',
  'Trädgård': 'Trädgård',
  'Hantverk': 'Hantverk', 'Stickning': 'Hantverk',
  'Måleri': 'Skapande', 'Foto': 'Skapande',
  'Yoga': 'Hälsa', 'Pilates': 'Hälsa', 'Meditation': 'Hälsa', 'Simning': 'Hälsa',
  'Vandring': 'Natur', 'Cykling': 'Natur', 'Fågelskådning': 'Natur',
  'Golf': 'Sport', 'Boule': 'Sport', 'Pingis': 'Sport',
};
const CATEGORY_NAMES = {
  'Kultur': 'Kulturgruppen',
  'Bok': 'Bokcirkeln',
  'Musik': 'Musikgruppen',
  'Spel': 'Spelgruppen',
  'Matlagning': 'Matlagningsgruppen',
  'Trädgård': 'Trädgårdsgruppen',
  'Hantverk': 'Hantverksgruppen',
  'Skapande': 'Skapandegruppen',
  'Hälsa': 'Hälsogruppen',
  'Natur': 'Naturgruppen',
  'Sport': 'Sportgruppen',
};

function makeName(city, interests, suffix) {
  const specific = interests.filter((i) => !GENERIC_INTERESTS.has(i));
  const generic = interests.filter((i) => GENERIC_INTERESTS.has(i));
  const catCounter = new Map();
  for (const it of specific) {
    const cat = CATEGORY_MAP[it] || it;
    catCounter.set(cat, (catCounter.get(cat) || 0) + 1);
  }
  const sortedCats = [...catCounter.entries()].sort((a, b) => b[1] - a[1]);

  let base;
  if (sortedCats.length === 0) {
    if (generic.includes('Promenader') && generic.includes('Fika')) base = 'Promenad & fika';
    else if (generic.includes('Promenader')) base = 'Promenadgruppen';
    else if (generic.includes('Fika')) base = 'Fikagruppen';
    else if (generic.includes('Resor')) base = 'Resegruppen';
    else base = 'Gemenskapsgruppen';
  } else if (sortedCats.length === 1) {
    base = CATEGORY_NAMES[sortedCats[0][0]] || (sortedCats[0][0] + 'gruppen');
  } else {
    base = `${sortedCats[0][0]} & ${sortedCats[1][0]}`;
  }
  return suffix ? `${base} ${city} ${suffix}` : `${base} ${city}`;
}

function makeDescription(interests, city) {
  const specific = interests.filter((i) => !GENERIC_INTERESTS.has(i));
  const list = specific.length ? specific.slice(0, 4).join(', ') : interests.slice(0, 3).join(', ');
  return `Vi i ${city} träffas regelbundet kring ${list}. Alla välkomna oavsett tidigare erfarenhet.`;
}

// ── 8. Bygg communities från kluster ─────────────────────────────────
function buildCommunitiesFromClusters(users, cityClusters) {
  const communities = [];
  const memberships = [];
  let cid = 1;
  const usedNames = new Map(); // namn|stad → räknare för suffix

  for (const [city, clusters] of cityClusters) {
    for (const cluster of clusters) {
      const memberUsers = cluster.map((idx) => users[idx]);
      const memberIds = memberUsers.map((u) => u.id);
      const interests = clusterTopInterestsFromUsers(memberUsers, 5);
      const baseName = makeName(city, interests, null);
      const key = baseName + '|' + city;
      const seen = usedNames.get(key) || 0;
      usedNames.set(key, seen + 1);
      const name = seen === 0 ? baseName : `${baseName} ${String.fromCharCode(65 + seen)}`; // A, B, C...

      const community = {
        id: cid++,
        name,
        description: makeDescription(interests, city),
        city,
        interests,
        clusterMemberCount: memberIds.length,
      };
      communities.push(community);
      const now = Date.now();
      for (const uid of memberIds) {
        memberships.push({ userId: uid, communityId: community.id, joinedAt: now });
      }
    }
  }
  return { communities, memberships };
}

// ── 9. Inlägg + event (lite kosmetisk realism) ──────────────────────
const SAMPLE_POSTS = [
  'Härligt väder idag, någon som vill ta en kaffe?',
  'Tack alla för en trevlig kväll igår!',
  'Kommer någon på söndag? Jag kan baka bullar.',
  'Vilken fin promenad det blev idag!',
  'Någon som vill hänga med på bio nästa vecka?',
  'Ny bok att diskutera: har ni förslag?',
  'Underbar konsert i lördags, tack för sällskapet!',
  'Min tomat har äntligen blivit röd!',
  'Finns det plats för en till på utflykten?',
  'Påminnelse: vi ses kl 14 på onsdag!',
];
const EVENT_TITLES = ['Träff på torget', 'Söndagspromenad', 'Fikaträff', 'Spelkväll', 'Utflykt', 'Kreativ kväll', 'Bokprat', 'Konsertbesök', 'Filmvisning'];

function generatePosts(memberships) {
  const posts = [];
  let pid = 1;
  const now = Date.now();
  // ~1 inlägg per 3:e medlemskap
  for (let i = 0; i < memberships.length; i += 3) {
    const m = memberships[i];
    posts.push({
      id: pid++,
      communityId: m.communityId,
      authorId: m.userId,
      body: SAMPLE_POSTS[randInt(0, SAMPLE_POSTS.length - 1)],
      createdAt: now - randInt(0, 7 * 24 * 3600 * 1000),
    });
  }
  return posts;
}

function generateEvents(communities, memberships) {
  const events = [];
  let eid = 1;
  const now = Date.now();
  for (const c of communities) {
    const member = memberships.find((m) => m.communityId === c.id);
    if (!member) continue;
    events.push({
      id: eid++,
      communityId: c.id,
      creatorId: member.userId,
      title: EVENT_TITLES[randInt(0, EVENT_TITLES.length - 1)],
      description: 'Alla välkomna, vi ses på det vanliga stället!',
      location: `${c.city} centrum`,
      startsAt: now + randInt(1, 14) * 24 * 3600 * 1000,
    });
  }
  return events;
}

// ── Main ─────────────────────────────────────────────────────────────
function main() {
  srand(1337);
  const N_USERS = 1500;
  const MAX_MEMBERS = 40;

  console.log(`Steg 1/4: Genererar ${N_USERS} syntetiska användare …`);
  const users = generateUsers(N_USERS);

  // Gruppera per stad och kör DBSCAN
  console.log('Steg 2/4: DBSCAN per stad …');
  const cityClusters = new Map();
  const unmatchedIds = [];
  const allClusterAssignments = []; // { userId, clusterKey }

  // Per-stad params: tightare eps gör att fler distinkta kluster bildas
  // (vilket är vad vi vill med 1500 användare — annars äts alla av få
  // mega-kluster som bara splittas på MAX_MEMBERS-gränsen).
  const CITY_PARAMS = {
    'Stockholm':   { eps: 0.38, minSamples: 3 },
    'Göteborg':    { eps: 0.42, minSamples: 3 },
    'Malmö':       { eps: 0.42, minSamples: 3 },
    'Uppsala':     { eps: 0.45, minSamples: 3 },
    'Västerås':    { eps: 0.48, minSamples: 3 },
    'Örebro':      { eps: 0.48, minSamples: 3 },
    'Linköping':   { eps: 0.48, minSamples: 3 },
    'Helsingborg': { eps: 0.48, minSamples: 3 },
    'Norrköping':  { eps: 0.48, minSamples: 3 },
  };

  const NOISE_REASSIGN_THRESHOLD = 0.20;

  for (const city of CITIES.map((c) => c.name)) {
    const cityUsers = users.filter((u) => u.city === city);
    if (cityUsers.length < 3) continue;
    const points = cityUsers.map((u) => new Set(u.interests));
    const params = CITY_PARAMS[city] || { eps: 0.5, minSamples: 3 };

    const labels = dbscan(points, params.eps, params.minSamples);

    // Gruppera per label
    const labelGroups = new Map();
    for (let i = 0; i < labels.length; i++) {
      const lab = labels[i];
      if (lab === -1) continue;
      if (!labelGroups.has(lab)) labelGroups.set(lab, []);
      labelGroups.get(lab).push(i);
    }
    let clusters = [...labelGroups.values()];

    // Splitta för stora kluster
    const splitClusters = [];
    for (const c of clusters) {
      const parts = splitCluster(c, points, MAX_MEMBERS);
      for (const p of parts) splitClusters.push(p);
    }
    clusters = splitClusters;

    // Återplacera noise
    const noiseIdx = [];
    for (let i = 0; i < labels.length; i++) if (labels[i] === -1) noiseIdx.push(i);
    const { stillNoise } = reassignNoise(noiseIdx, clusters, points, NOISE_REASSIGN_THRESHOLD);

    // Översätt punktindex → user-index över hela datasetet (via cityUsers)
    const mappedClusters = clusters.map((c) => c.map((idx) => users.indexOf(cityUsers[idx])));
    cityClusters.set(city, mappedClusters);

    for (const idx of stillNoise) unmatchedIds.push(cityUsers[idx].id);

    // Storleksdistribution per stad — hjälper att hitta misskonfigurerad eps
    // (för många singleton-kluster = för tight, ett enda mega-kluster = för löst).
    const sizes = clusters.map((c) => c.length).sort((a, b) => a - b);
    const median = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0;
    const tiny = sizes.filter((n) => n < 5).length;
    const tinyPct = sizes.length ? Math.round((tiny / sizes.length) * 100) : 0;
    console.log(
      `  ${city.padEnd(12)} users=${cityUsers.length} clusters=${clusters.length}` +
      ` size[min=${sizes[0] || 0} med=${median} max=${sizes[sizes.length - 1] || 0}]` +
      ` tiny(<5)=${tiny}(${tinyPct}%) unmatched=${stillNoise.length}`
    );
    if (tinyPct > 30) {
      console.log(`    ⚠  ${city}: >30% små kluster — överväg lösare eps`);
    }
  }

  console.log('Steg 3/4: Bygger communities från kluster …');
  const { communities, memberships } = buildCommunitiesFromClusters(users, cityClusters);

  // Användare utan kluster: vi placerar dem ändå i sin stads största kluster
  // efter Jaccard till centroid — annars blir de "föräldralösa" och kan inte
  // testa appen. (Vid riktig användning är detta ML-motorn som assignar.)
  const userById = new Map(users.map((u) => [u.id, u]));
  for (const uid of unmatchedIds) {
    const u = userById.get(uid);
    const candidates = communities.filter((c) => c.city === u.city);
    if (candidates.length === 0) continue;
    let best = null, bestSim = 0;
    for (const c of candidates) {
      const sim = jaccard(new Set(u.interests), new Set(c.interests));
      if (sim > bestSim) { bestSim = sim; best = c; }
    }
    if (best) {
      memberships.push({ userId: uid, communityId: best.id, joinedAt: Date.now() });
    }
  }

  // Statistik
  const usersWithMembership = new Set(memberships.map((m) => m.userId));
  const orphanCount = users.length - usersWithMembership.size;

  console.log('Steg 4/4: Genererar inlägg + event …');
  const posts = generatePosts(memberships);
  const events = generateEvents(communities, memberships);

  // Sanity: räkna intressefördelning
  const interestCount = {};
  for (const u of users) for (const it of u.interests) interestCount[it] = (interestCount[it] || 0) + 1;
  const sortedInts = Object.entries(interestCount).sort((a, b) => b[1] - a[1]);

  const dataset = {
    metadata: {
      generatedAt: new Date().toISOString(),
      source: 'Synthetic — generated by scripts/generate-synthetic-dataset.js',
      description: 'Synthetic Swedish senior user dataset; communities formed by per-city DBSCAN over Jaccard distance with max-40 split and noise reassignment.',
      numUsers: users.length,
      numCommunities: communities.length,
      numMemberships: memberships.length,
      numPosts: posts.length,
      numEvents: events.length,
      numUnmatched: orphanCount,
      interestVocabulary: ALL_INTERESTS,
      genericInterests: [...GENERIC_INTERESTS],
      interestDistribution: Object.fromEntries(sortedInts),
      cityParams: CITY_PARAMS,
      maxMembersPerCommunity: MAX_MEMBERS,
      noiseReassignThreshold: NOISE_REASSIGN_THRESHOLD,
    },
    users: users.map(({ _persona, ...u }) => u),
    communities,
    memberships,
    posts,
    events,
  };

  const outPath = path.join(__dirname, '..', 'data', 'dataset.json');
  // Skapa data/-mappen om den inte finns (kan saknas vid fresh deploy
  // eftersom `data/` är gitignorerad och därför inte i repot).
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(dataset, null, 2));

  console.log('\nKlart:');
  console.log(`  ${users.length} användare, varav ${usersWithMembership.size} matchade till ett kluster`);
  console.log(`  ${communities.length} communities (DBSCAN-genererade)`);
  console.log(`  ${memberships.length} medlemskap`);
  console.log(`  ${posts.length} inlägg, ${events.length} event`);
  console.log(`  Topp-5 intressen: ${sortedInts.slice(0, 5).map(([k, v]) => `${k}(${v})`).join(', ')}`);
  console.log(`  Botten-5 intressen: ${sortedInts.slice(-5).map(([k, v]) => `${k}(${v})`).join(', ')}`);
  console.log(`\nSparad till ${outPath}`);
}

main();
