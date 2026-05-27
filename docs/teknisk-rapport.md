# Teknisk Projektrapport — Gemenskap

## 1. Inledning

**Gemenskap** är en webbaserad community-plattform riktad till äldre användare (65+) i Sverige. Tjänsten hjälper seniorer att hitta och gå med i lokala aktivitetsgrupper — för promenader, fika, hantverk, schack och liknande. Projektet är byggt som en fullstack-webbapplikation med fokus på tillgänglighet, enkelhet och en varm, inbjudande design.

**Teknisk stack:**
- **Frontend:** Vanilla HTML, CSS och JavaScript (inga ramverk)
- **Backend:** Node.js med Express.js
- **Databas:** SQLite via better-sqlite3
- **ML-motor:** Egenutvecklat neuralt nätverk + collaborative filtering (inga externa ML-bibliotek)
- **Internationalisering:** Svenska (standard) och engelska, växlingsbart i realtid

---

## 2. Frontend-arkitektur

### 2.1 Översikt

Frontenden följer en **modulär IIFE-arkitektur** (Immediately Invoked Function Expression) utan ramverk. Varje JavaScript-modul kapslar in sin logik i en anonym funktion och exponerar ett publikt API via `window`-objektet. Detta ger tydlig inkapsling utan globala namnkonflikter.

Mönstret ser ut så här:

```javascript
(function () {
  // Privat state och funktioner
  const privateState = {};
  function privateHelper() { ... }
  
  // Publikt API exponerat globalt
  window.ModuleName = { publicFunc, publicData };
})();
```

### 2.2 Sidstruktur

Applikationen består av **9 HTML-sidor** i `public/`-katalogen. Varje sida är ett eget HTML-dokument som laddas med full sidnavigering (inga client-side routes):

| Sida | Fil | Syfte |
|------|-----|-------|
| Landningssida | `index.html` | Välkomstsida med CTA till inloggning |
| Inloggning | `login.html` | SMS-baserad autentisering i 2 steg |
| Onboarding | `onboarding.html` | Profilskapande: namn, stad, intressen, community-val |
| Hem | `home.html` | Dashboard: nästa event, senaste inlägg, tutorial |
| Community | `community.html` | Community-vy med flikar: Inlägg/Medlemmar/Event |
| Event | `events.html` | Alla kommande event med RSVP-knappar |
| Meddelanden | `messages.html` | Direktmeddelanden med 5-sekunders polling |
| Profil | `profile.html` | Egen profil (redigering) eller andras (visning) |
| Utforska | `browse.html` | Lista och sök bland alla communities |

### 2.3 JavaScript-moduler

Skripten laddas i en **bestämd ordning** i varje HTML-sida, eftersom senare moduler beror på tidigare:

```
1. i18n.js      → window.I18n      (översättningar, måste laddas först)
2. api.js       → window.API       (HTTP-klient)
3. auth.js      → window.Auth      (sessionshantering)
4. components.js → window.UI       (delade UI-komponenter)
5. interests.js → window.Interests (valfri, intressekategorier)
6. tutorial.js  → window.Tutorial  (valfri, tutorial-overlay)
7. page/*.js    (sidspecifikt skript, ett per sida)
```

**`api.js` — HTTP-klient** (`window.API`)

Wrapperfunktioner kring `fetch()` med automatisk JSON-parsning, felhantering och cookie-baserad autentisering:

- `API.get(path)` — GET-anrop, returnerar parsad JSON
- `API.post(path, body)` — POST med JSON-kropp
- `API.put(path, body)` — PUT
- `API.del(path)` — DELETE

Alla anrop sätter `credentials: 'same-origin'` så att sessionskakan (`sid`) skickas automatiskt. Vid felaktigt HTTP-svar skapas ett felobjekt med:
- `err.code` — felkod (t.ex. `'network'`, `'not_found'`)
- `err.status` — HTTP-statuskod
- `err.userMessage` — lokaliserat felmeddelande (svenska eller engelska beroende på valt språk)

**`auth.js` — Sessionshantering** (`window.Auth`)

Hanterar inloggningsstatus med en cachad användarmodell:

- `Auth.getCurrentUser()` — Hämtar `/api/auth/me`, cachar resultatet i en modulvariabel
- `Auth.requireUser()` — Omdirigerar till `/login.html` om ej inloggad
- `Auth.requireOnboardedUser()` — Omdirigerar till `/onboarding.html` om profilen saknar namn/stad
- `Auth.logout()` — Anropar logout-endpoint, rensar cache och localStorage, omdirigerar till `/`
- `Auth.clearCache()` — Tvingar om-hämtning vid nästa `getCurrentUser()`-anrop

**`i18n.js` — Internationalisering** (`window.I18n`)

Innehåller **340+ översättningsnycklar** i ett inbäddat `STRINGS`-objekt med svenska och engelska strängar. Funktioner:

- `I18n.t(key, params)` — Returnerar översatt sträng med parameterbyte (`{{name}}` → värde)
- `I18n.getLang()` — Läser språk från `localStorage.lang` (standard: `'sv'`)
- `I18n.setLang(lang)` — Sparar i localStorage, uppdaterar alla `[data-i18n]`-element i DOM:en, avfyrar `langchange`-event
- `I18n.applyTranslations(root)` — Skannar `[data-i18n]`, `[data-i18n-placeholder]`, `[data-i18n-aria-label]` och sätter text/attribut
- `I18n.relativeTime(ts)` — Formaterar tidsstämpel som "för 5 min sedan", "igår"
- `I18n.formatEventTime(ts)` — Formaterar som "torsdag 7 maj kl. 14:30" (locale-anpassat)

Språkväxling sker via SV/EN-knappar i sidhuvudet. Vid byte avfyras ett `CustomEvent('langchange')` på `document` — sidspecifika skript lyssnar och renderar om dynamiskt innehåll.

**`components.js` — Delade UI-komponenter** (`window.UI`)

- `UI.escape(str)` — HTML-entity-escape (förhindrar XSS)
- `UI.avatar(name, size, avatarUrl)` — Genererar avatar-HTML (bild eller initialer med gradient)
- `UI.renderHeader(opts)` — Skapar sticky sidhuvud med logotyp, profilknapp och språkväxlare
- `UI.renderBottomNav(active)` — Skapar fast bottennavigering med 4 flikar (Hem, Community, Event, Meddelanden) med emoji-ikoner och aktiv markering
- `UI.showAlert(container, type, text)` — Visar felmeddelande, succé eller info-banner
- `UI.showDevBanner(text)` — Visar gul dev-banner (för SMS-kod under utveckling)

**`interests.js` — Intressekategorier** (`window.Interests`)

Definierar **6 kategorier med 34 intressen** som delas mellan onboarding och profilredigering:

| Kategori | Ikon | Intressen |
|----------|------|-----------|
| Utomhus | 🌳 | Promenader, Trädgård, Resor, Vandring, Cykling, Fågelskådning |
| Spel & Sport | ♟️ | Schack, Bridge, Kortspel, Korsord, Boule, Golf, Pingis |
| Skapande | 🎨 | Hantverk, Stickning, Måleri, Konst, Foto, Musik, Sång, Dans |
| Kultur | 📚 | Bokläsning, Filmklubb, Teater, Museum, Historia |
| Mat & Dryck | ☕ | Matlagning, Bakning, Fika, Vinprovning |
| Hälsa | 🧘 | Yoga, Pilates, Meditation, Simning |

Funktioner:
- `Interests.all()` — Platt lista med alla 34 fördefinierade intressen
- `Interests.categoryOf(interest)` — Returnerar kategorinyckel eller `null` för egna intressen
- `Interests.render(container, selected, onChange)` — Renderar chip-väljare grupperade per kategori med `aria-pressed` för tillstånd

**`tutorial.js` — Tutorial-overlay** (`window.Tutorial`)

Modal overlay med 4 steg som visas vid första besöket på hemsidan. Stegen beskriver Hem, Community, Event och Meddelanden med ikoner och text. Sparar `tutorial_done=1` i localStorage. Kan startas om via profilsidan. Inkluderar en "Hoppa över introduktionen"-länk.

### 2.4 Designsystem (CSS)

**Fil:** `public/css/styles.css` (~1 050 rader)

**Typsnitt:** Atkinson Hyperlegible Next (Google Fonts) — specifikt designat för personer med nedsatt syn. Laddas via `@import url(...)`.

**Designtokens (CSS-variabler):**

```css
/* Typografi — stor bas för äldre */
--font-base: 20px;      --font-sm: 18px;    --font-xs: 16px;
--font-h1: 38px;         --font-h2: 28px;    --font-h3: 23px;

/* Tryckytor — större än standard 48px */
--btn-min-height: 58px;  --tap-target: 52px;

/* Varm skandinavisk färgpalett */
--color-bg: #f8f5f0;            /* Linne-vit bakgrund */
--color-text: #2c2418;          /* Varm mörkbrun text */
--color-primary: #3a7d5e;       /* Djup salviagrön (svensk skog) */
--color-secondary: #c0593e;     /* Varm sienna/terrakotta */
--color-accent: #cc8e1e;        /* Svensk guld/honung */
--color-muted: #6b5e4f;         /* Dämpad gråbrun */

/* Kontrast — uppfyller WCAG AA */
/* Rubrik >= 14:1, brödtext >= 12:1, dämpad text >= 5.2:1, knappar >= 5.1:1 */

/* Fokusring — tydlig för tangentbordsnavigering */
--focus-ring: 4px solid #e8923a; /* varm orange med 3px offset */
```

**Responsiv design:**
- Maxbredd: 680px container
- Chip-grid: 2 kolumner (mobil) → 3 kolumner (520px+)
- Knapprader: staplade (mobil) → horisontella (520px+)
- `prefers-reduced-motion` mediafråga för reducerade animationer

**Nyckelkomponenter:** `.btn` / `.btn-secondary` / `.btn-quiet` (knappar), `.card` / `.card-warm` / `.card-accent` (kort med sidokant), `.chip` (valbar intresseknapp), `.pill` (icke-interaktiv badge), `.alert` (felmeddelande), `.avatar` / `.avatar-lg` (profilavatar), `.empty-state` (tom-tillstånd med streckad ram), `.event-location-block` (platsblock med kartlänk), `.tutorial-overlay` (modal), `.tab-row` (horisontella flikar)

---

## 3. Backend-arkitektur

### 3.1 Översikt

Backenden är en **Express.js-server** som serverar statiska filer och ett REST-API. Alla databasoperationer sker synkront via better-sqlite3 (ingen ORM). ML-modellen tränas vid serverstart.

**Fil:** `server/server.js`

**Middleware-stack:**
1. `express.json({ limit: '5mb' })` — JSON-body parsing
2. `cookieParser()` — Utläsning av session-cookie
3. Routmonterade under `/api/*`
4. Statisk filservering från `public/`

**Routmontering:**
```
/api/auth                    → server/auth.js
/api/users                   → server/users.js
/api/communities             → server/communities.js
/api/communities/:id/posts   → server/posts.js
/api/events                  → server/events.js
/api/messages                → server/messages.js
```

**Vid uppstart:**
1. Databasschemat skapas (om det inte redan finns)
2. ML-motorn tränar neurala nätverket (~0.5s, non-blocking try-catch)
3. Modellvikter sparas till `data/model.json`
4. Servern lyssnar på port 3000

### 3.2 Felhantering

Alla API-svar följer ett standardformat vid fel:

```json
{
  "error": "felkod",
  "message_sv": "Svenskt meddelande med lösning",
  "message_en": "English message with solution"
}
```

HTTP-statuskoder:
- `400` — Valideringsfel (saknade fält, ogiltigt format)
- `401` — Ej autentiserad (saknad/ogiltig session)
- `403` — Ej behörig (t.ex. inte medlem i community)
- `404` — Resurs finns inte
- `409` — Konflikt (t.ex. community fullt)
- `429` — Rate-limited (för många SMS-koder)
- `500` — Serverfel (obehandlat undantag)

Felmeddelanden är alltid **lösningsorienterade**: "Koden stämmer inte. Vill du att vi skickar en ny?" istället för "Fel kod".

---

## 4. Kommunikation mellan frontend och backend

### 4.1 Protokoll och format

All kommunikation sker via **HTTP/JSON REST-anrop** över `localhost:3000`. Frontenden använder `fetch()` med JSON-kropp och `credentials: 'same-origin'` för att inkludera sessionskakan.

### 4.2 Request-flöde

```
[Webbläsare]                              [Express-server]
     |                                           |
     |--- GET /api/auth/me (cookie: sid=xxx) --->|
     |<-- 200 { user: {...} } ------------------|
     |                                           |
     |--- POST /api/communities/5/join --------->|
     |    (cookie: sid=xxx)                      |
     |<-- 200 { ok: true } ---------------------|
```

### 4.3 Felhantering i frontenden

Alla API-anrop wrappas i `try/catch`. Vid fel visas ett lokaliserat meddelande via `window.UI.showAlert()`:

```javascript
try {
  await window.API.post('/api/communities/5/join');
} catch (e) {
  // e.userMessage = "Den här gruppen är full. Vi hjälper dig hitta en plats."
  window.UI.showAlert('#alert', 'error', e.userMessage);
}
```

### 4.4 Realtidskommunikation

Meddelandesystemet använder **HTTP-polling var 5:e sekund** istället för WebSocket:

```javascript
// messages.js — pollningsloop
pollInterval = setInterval(async () => {
  const res = await window.API.get(`/api/messages/with/${partnerId}`);
  renderMessages(res.messages);
}, 5000);
```

Pollningen startar när en konversation öppnas och stoppas (`clearInterval`) när användaren navigerar tillbaka till trådlistan. Backenden markerar meddelanden som lästa (`read_at = timestamp`) vid varje hämtning.

---

## 5. Autentisering

### 5.1 Flödesöversikt

Autentiseringen är **SMS-kodbaserad** i max 3 steg, designad för att vara enkel för äldre användare. I utvecklingsläge simuleras SMS:et — koden visas i serverkonsolen och i en gul banner i webbläsaren.

```
┌─────────────────┐     POST /api/auth/request-code     ┌─────────────────┐
│  Steg 1:        │ ──────────────────────────────────> │  Server:         │
│  Ange telefon-  │     { phone: "0701234567" }         │  Generera 6-     │
│  nummer         │ <────────────────────────────────── │  siffrig kod,    │
│                 │     { ok: true, dev_code: "541958"}  │  spara i DB     │
└─────────────────┘                                      └─────────────────┘
        |
        v
┌─────────────────┐     POST /api/auth/verify            ┌─────────────────┐
│  Steg 2:        │ ──────────────────────────────────> │  Server:         │
│  Ange kod       │     { phone, code: "541958" }       │  Verifiera kod,  │
│                 │ <────────────────────────────────── │  skapa session,  │
│                 │     Set-Cookie: sid=<64-hex-token>   │  sätt cookie     │
│                 │     { ok: true, needsOnboarding }    │                  │
└─────────────────┘                                      └─────────────────┘
        |
        v
┌─────────────────┐
│  Steg 3:        │  needsOnboarding = true  -> /onboarding.html
│  Klar!          │  needsOnboarding = false -> /home.html
└─────────────────┘
```

### 5.2 SMS-kodgenerering

```javascript
// server/auth.js
const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 siffror
// Kod giltig i 10 minuter (CODE_TTL_MS = 600 000 ms)
// Rate limit: max 5 koder per telefonnummer per timme
```

Telefonnumret normaliseras genom att ta bort alla icke-siffror och validera att längden är 8-12 tecken.

### 5.3 Sessionstokens

Vid lyckad verifiering genereras en **kryptografiskt säker sessionstoken**:

```javascript
const token = crypto.randomBytes(32).toString('hex'); // 64 tecken hex
```

Tokenen sparas i `sessions`-tabellen (kopplad till `user_id`) och sätts som en HTTP-cookie:

```javascript
res.cookie('sid', token, {
  httpOnly: true,        // Ej åtkomlig via JavaScript (skyddar mot XSS)
  sameSite: 'lax',       // Skickas enbart vid same-site-anrop
  maxAge: 365 * 24 * 3600 * 1000  // 1 år
});
```

### 5.4 Autentiseringsmiddleware

Alla skyddade endpoints använder `requireAuth`-middleware:

```javascript
function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies['sid'];
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  const session = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token);
  if (!session) return res.status(401).json({ error: 'unauthorized' });
  req.userId = session.user_id;  // Bifoga användar-ID till request
  next();
}
```

### 5.5 Auto-inloggning

Vid varje sidladdning anropar frontenden `GET /api/auth/me`. Om en giltig cookie finns returneras fullt användarobjekt (inklusive intressen, communities och avatarUrl). Resultatet cachas i `window.Auth` och återanvänds under sessionen.

---

## 6. Databasdesign

### 6.1 Översikt

Databasen är **SQLite** med WAL-läge (Write-Ahead Logging) för bättre läsprestanda och `PRAGMA foreign_keys = ON` för referensintegritet. Alla tidsstämplar lagras som Unix-millisekunder (INTEGER).

**Fil:** `data/app.db`

### 6.2 ER-diagram (textuellt)

```
users ──< user_interests
  |
  |──< memberships >── communities ──< community_interests
  |                        |
  |──< posts ──────────────┘
  |                        |
  |──< events ─────────────┘
  |     |
  |     └──< event_rsvps
  |
  |──< messages (sender)
  |──< messages (recipient)
  |
  |──< auth_codes
  └──< sessions
```

### 6.3 Tabellschema

**`users`** — Användarregister

| Kolumn | Typ | Begränsning | Beskrivning |
|--------|-----|-------------|-------------|
| id | INTEGER | PK, AUTOINCREMENT | Unikt ID |
| phone | TEXT | UNIQUE, NOT NULL | Normaliserat telefonnummer |
| display_name | TEXT | — | Visningsnamn (sätts vid onboarding) |
| city | TEXT | — | Stad för geografisk matchning |
| bio | TEXT | — | Fritext om användaren |
| language | TEXT | DEFAULT 'sv' | Språkpreferens ('sv' eller 'en') |
| created_at | INTEGER | NOT NULL | Skapelsetid (Unix ms) |

**`user_interests`** — Användarens intressen (N:N)

| Kolumn | Typ | Begränsning |
|--------|-----|-------------|
| user_id | INTEGER | FK -> users, ON DELETE CASCADE |
| interest | TEXT | NOT NULL |
| | | PK (user_id, interest) |

**`communities`** — Aktivitetsgrupper

| Kolumn | Typ | Begränsning |
|--------|-----|-------------|
| id | INTEGER | PK, AUTOINCREMENT |
| name | TEXT | NOT NULL |
| description | TEXT | — |
| city | TEXT | NOT NULL |
| created_at | INTEGER | NOT NULL |

Max 40 medlemmar per community (hårdkodat `MAX_MEMBERS = 40` i `db.js`).

**`community_interests`** — Communityns intressen (N:N)

| Kolumn | Typ | Begränsning |
|--------|-----|-------------|
| community_id | INTEGER | FK -> communities, ON DELETE CASCADE |
| interest | TEXT | NOT NULL |
| | | PK (community_id, interest) |

**`memberships`** — Koppling användare <-> community

| Kolumn | Typ | Begränsning |
|--------|-----|-------------|
| user_id | INTEGER | FK -> users, ON DELETE CASCADE |
| community_id | INTEGER | FK -> communities, ON DELETE CASCADE |
| joined_at | INTEGER | NOT NULL |
| | | PK (user_id, community_id) |

**`posts`** — Inlägg i communities

| Kolumn | Typ | Begränsning |
|--------|-----|-------------|
| id | INTEGER | PK, AUTOINCREMENT |
| community_id | INTEGER | FK -> communities, ON DELETE CASCADE |
| author_id | INTEGER | FK -> users, ON DELETE CASCADE |
| body | TEXT | NOT NULL |
| created_at | INTEGER | NOT NULL |

**`events`** — Community-event

| Kolumn | Typ | Begränsning |
|--------|-----|-------------|
| id | INTEGER | PK, AUTOINCREMENT |
| community_id | INTEGER | FK -> communities, ON DELETE CASCADE |
| creator_id | INTEGER | FK -> users, ON DELETE CASCADE |
| title | TEXT | NOT NULL |
| description | TEXT | — |
| location | TEXT | — (platsnamn, t.ex. "Cafe Husaren") |
| address | TEXT | — (gatuadress, t.ex. "Haga Nygata 28, 413 01 Goteborg") |
| starts_at | INTEGER | NOT NULL (Unix ms) |
| created_at | INTEGER | NOT NULL |

**`event_rsvps`** — OSA-status per event

| Kolumn | Typ | Begränsning |
|--------|-----|-------------|
| event_id | INTEGER | FK -> events, ON DELETE CASCADE |
| user_id | INTEGER | FK -> users, ON DELETE CASCADE |
| status | TEXT | NOT NULL ('going' / 'maybe' / 'no') |
| | | PK (event_id, user_id) |

**`messages`** — Direktmeddelanden

| Kolumn | Typ | Begränsning |
|--------|-----|-------------|
| id | INTEGER | PK, AUTOINCREMENT |
| sender_id | INTEGER | FK -> users, ON DELETE CASCADE |
| recipient_id | INTEGER | FK -> users, ON DELETE CASCADE |
| body | TEXT | NOT NULL |
| created_at | INTEGER | NOT NULL |
| read_at | INTEGER | NULL om oläst |

**`auth_codes`** — Temporära SMS-koder

| Kolumn | Typ | Begränsning |
|--------|-----|-------------|
| phone | TEXT | NOT NULL |
| code | TEXT | NOT NULL |
| expires_at | INTEGER | NOT NULL |
| created_at | INTEGER | NOT NULL |

Index: `auth_codes_phone_idx ON auth_codes(phone)`

**`sessions`** — Aktiva sessioner

| Kolumn | Typ | Begränsning |
|--------|-----|-------------|
| token | TEXT | PK (64 tecken hex) |
| user_id | INTEGER | FK -> users, ON DELETE CASCADE |
| created_at | INTEGER | NOT NULL |

### 6.4 Seed-data

Databasen seedas från `data/dataset.json` (genererat från verklig Meetup.com-data, KDD 2012). Efter enrichment (via `scripts/enrich-dataset.js`) innehåller den:

- **300 användare** med svenska namn, städer och intressen
- **57 communities** (23 original + 17 nischade tillägg som Yogagruppen, Boule-klubben, Fotoklubben)
- **1 027 medlemskap** (~3.4 per användare i snitt)
- **313 inlägg**
- **38 event** med riktiga svenska platsnamn och gatuadresser

---

## 7. API-struktur

### 7.1 Autentisering (`/api/auth`)

| Metod | Endpoint | Auth | Beskrivning |
|-------|----------|------|-------------|
| POST | `/api/auth/request-code` | Nej | Begär SMS-kod. Body: `{ phone }`. Svar: `{ ok, dev_code }` |
| POST | `/api/auth/verify` | Nej | Verifiera kod. Body: `{ phone, code }`. Sätter `sid`-cookie. Svar: `{ ok, needsOnboarding }` |
| GET | `/api/auth/me` | Nej* | Hämta inloggad användare. Svar: `{ user }` eller `{ user: null }` |
| POST | `/api/auth/logout` | Nej | Logga ut, rensa cookie och session |

*Kräver ingen auth men returnerar `null` om ej inloggad.

### 7.2 Användare (`/api/users`)

| Metod | Endpoint | Auth | Beskrivning |
|-------|----------|------|-------------|
| PUT | `/api/users/me` | Ja | Uppdatera profil. Body: `{ display_name, city, bio, language, interests[] }` |
| POST | `/api/users/me/avatar` | Ja | Ladda upp avatar. Body: `{ image: "data:image/jpeg;base64,..." }` |
| DELETE | `/api/users/me` | Ja | Radera konto (GDPR) — kaskadradering av allt användardata |
| GET | `/api/users/:id` | Ja | Hämta annan användares profil (publikt) |

### 7.3 Communities (`/api/communities`)

| Metod | Endpoint | Auth | Beskrivning |
|-------|----------|------|-------------|
| GET | `/api/communities` | Ja | Lista alla communities med medlemsantal och intressen |
| GET | `/api/communities/suggest` | Ja | ML-drivna förslag (3 åt gången). Query: `?offset=0`. Svar: `{ suggestions[], hasMore }` |
| GET | `/api/communities/:id` | Ja | Hämta community-detaljer inkl. `isMember`-flagga |
| GET | `/api/communities/:id/members` | Ja | Lista medlemmar |
| POST | `/api/communities/:id/join` | Ja | Gå med (kontrollerar 40-taket, idempotent) |
| POST | `/api/communities/:id/leave` | Ja | Lämna community |

### 7.4 Inlägg (`/api/communities/:id/posts`)

| Metod | Endpoint | Auth | Beskrivning |
|-------|----------|------|-------------|
| GET | `/api/communities/:id/posts` | Ja | Hämta inlägg (senaste 100, nyast först) |
| POST | `/api/communities/:id/posts` | Ja | Skapa inlägg. Kräver medlemskap. Body: `{ body }` |

### 7.5 Event (`/api/events`)

| Metod | Endpoint | Auth | Beskrivning |
|-------|----------|------|-------------|
| GET | `/api/events/upcoming` | Ja | Kommande event för användarens communities |
| GET | `/api/events/community/:id` | Ja | Event i specifikt community (24h bakåt och framåt) |
| POST | `/api/events/community/:id` | Ja | Skapa event. Body: `{ title, starts_at, location, address, description }` |
| POST | `/api/events/:id/rsvp` | Ja | OSA. Body: `{ status: 'going'|'maybe'|'no' }`. Upsert med `ON CONFLICT DO UPDATE` |

### 7.6 Meddelanden (`/api/messages`)

| Metod | Endpoint | Auth | Beskrivning |
|-------|----------|------|-------------|
| GET | `/api/messages/threads` | Ja | Alla konversationer med senaste meddelande och oläst-räknare |
| GET | `/api/messages/with/:userId` | Ja | Hämta meddelanden med en specifik användare (markerar som lästa) |
| POST | `/api/messages/with/:userId` | Ja | Skicka meddelande. Body: `{ body }` |

---

## 8. State management

### 8.1 Strategi

Applikationen har **ingen global state-container** (som Redux eller Vuex). Istället används tre nivåer av tillståndshantering:

### 8.2 Sessionscookie (Server-state)

**Cookie `sid`** — 64 tecken lång hex-token, `httpOnly`, `sameSite: lax`, giltig 1 år. Verifieras mot `sessions`-tabellen vid varje API-anrop. Enda serverhanterade tillståndet.

### 8.3 localStorage (Persisterande klient-state)

| Nyckel | Sätts i | Syfte |
|--------|---------|-------|
| `lang` | `i18n.js` | Valt språk (`'sv'` eller `'en'`) |
| `tutorial_done` | `tutorial.js` | Om tutorial visats (`'1'` eller saknar) |
| `current_community_id` | `page/home.js` | Senast besökta community (för kontext vid navigering) |

### 8.4 In-memory state (Temporärt klient-state)

Varje sidskript hanterar eget tillstånd i modulvariabler:

- **`auth.js`:** `cachedUser` — cachat användarobjekt, rensas vid logout eller `clearCache()`
- **`page/login.js`:** `currentPhone`, `resendTimer`, `resendSecondsLeft`
- **`page/onboarding.js`:** `selected` (Set med valda intressen), `customInterests` (Set), `suggestOffset`
- **`page/community.js`:** `community` (det inladdade community-objektet)
- **`page/messages.js`:** `activePartner` (nuvarande konversationspartner), `pollInterval` (setInterval-ID)

### 8.5 URL-parametrar

| Sida | Parameter | Syfte |
|------|-----------|-------|
| `community.html` | `?id=5` | Community att visa |
| `profile.html` | `?id=15` | Annan användares profil |
| `messages.html` | `?with=15` | Öppna konversation med specifik användare |

### 8.6 DOM-state

Interaktiva element lagrar tillstånd via HTML-attribut:
- Flikar: `aria-selected="true"` / `"false"` på `[role="tab"]`-element
- Intressechips: `aria-pressed="true"` / `"false"` på `.chip`-knappar
- RSVP-knappar: aktiv/inaktiv via CSS-klass (`.btn` vs `.btn-secondary`)

---

## 9. ML-driven community-matchning

### 9.1 Översikt

Community-matchningen presenteras som "AI-matchning" i gränssnittet och kombinerar fyra algoritmer i en ensemble-modell. Systemet prioriterar intresseöverlapp starkt och använder geografi som en mjuk viktningsmekanism.

### 9.2 Ensemble-vikter

```
Slutpoäng = Jaccard * 0.45 + Cosinus * 0.25 + Neuralt nätverk * 0.15 + Collaborative filtering * 0.15
```

### 9.3 Algoritmerna

**Jaccard-likhet (45%)** — Direkt intresseöverlapp:
```
Jaccard = |A n B| / |A u B|
där A = användarens intressen, B = communityns intressen
```

**Cosinus-likhet (25%)** — Feature-vektor med intressen + stad:
```
Feature-vektor: 43 intressen (one-hot) + 9 städer (one-hot) = 52 dimensioner
cosine = dot(userVec, communityVec) / (||userVec|| * ||communityVec||)
```

**Neuralt nätverk (15%)** — Tränat på medlemskapsmönster:
```
Arkitektur: 52 -> 32 (ReLU) -> 16 (ReLU) -> N communities (Sigmoid)
Träning: 80 epoker, SGD, lr=0.005, binary cross-entropy
Träningsdata: alla användare -> community-medlemskap (1=medlem, 0=ej)
```

**Collaborative filtering (15%)** — "Användare lika dig gick med i X":
```
1. Hitta k=10 mest lika användare (cosinus-likhet på feature-vektorer)
2. Aggregera communities de gått med i (viktat med likhet)
```

### 9.4 Noll-överlapp-straff

Om användaren har angivit intressen men ett community har noll gemensamma intressen multipliceras poängen med **0.25** (75% avdrag). Detta förhindrar att geografiskt nära men irrelevanta communities hamnar högt.

### 9.5 Geografisk viktning

Appliceras **efter** ensemble-poängen som en mjuk multiplikator:

| Avstånd | Faktor | Etikett |
|---------|--------|---------|
| Samma stad | x 1.00 | `same_city` |
| < 80 km | x 0.90 | `nearby` |
| < 200 km | x 0.75 | `medium` |
| >= 200 km | x 0.55 | `far` |

Avstånd beräknas med **Haversine-formeln** mellan 24 fördefinierade svenska städer.

### 9.6 Regelbaserad fallback

Om ML-motorn ej är redo (t.ex. vid startfel) används en enklare regelbaserad poäng:
```
rawScore = (antal gemensamma intressen * 8) + (samma stad ? 2 : 0)
om noll överlapp -> rawScore * 0.25
finalScore = rawScore * geoFactor * 10
```

---

## 10. Deployment / Driftsättning

### 10.1 Systemkrav

- **Node.js** 18 eller senare
- **npm** (ingår med Node.js)
- Inga externa tjänster (databas, ML, allt kör lokalt)

### 10.2 Installationssteg

```bash
npm install              # Installerar express, better-sqlite3, cookie-parser
npm run seed             # Skapar data/app.db med 300 användare, 57 communities
node scripts/enrich-dataset.js  # (valfritt) Berikar dataset med nya intressen
npm run seed             # Om enrich kördes: omseeda med berikad data
npm start                # Startar server på http://localhost:3000
```

### 10.3 Miljövariabler

| Variabel | Standard | Beskrivning |
|----------|----------|-------------|
| `PORT` | `3000` | HTTP-port |

### 10.4 Filstruktur vid drift

```
arbete/
├── data/
│   ├── app.db              <- SQLite-databas (skapas vid seed)
│   ├── app.db-wal          <- WAL-logg
│   ├── app.db-shm          <- WAL delat minne
│   ├── dataset.json        <- Seed-data (300 användare)
│   └── model.json          <- Tränade ML-vikter (skapas vid serverstart)
├── public/
│   └── uploads/            <- Avatarbilder ({userId}.jpg)
├── server/                 <- Backend-kod
├── scripts/                <- Engångsskript
└── package.json
```

### 10.5 Vad som behövs för produktion

Projektet är en **funktionell prototyp**. För produktionsdrift behövs:

| Område | Nuläge | Produktionsbehov |
|--------|--------|------------------|
| SMS | Simulerad (kod i UI) | Integrera Twilio eller 46elks i `server/auth.js` |
| Databas | SQLite (filbaserad) | PostgreSQL eller liknande för skalbarhet |
| Sessioner | Enkel tokenlagring, ingen rotation | Session-rotation, expiry-cleanup-jobb |
| HTTPS | Ej konfigurerat | TLS-certifikat, `secure: true` på cookies |
| Realtid | HTTP-polling (5 sek) | WebSocket (Socket.io) för meddelanden |
| Rate limiting | Enbart SMS-koder (5/h) | Express-rate-limit på alla endpoints |
| Bildhantering | Base64 i filsystem | CDN/objektlagring (S3), bildkomprimering |
| Felspårning | Console.log | Sentry eller liknande |
| Övervakning | Ingen | Health-check endpoint, upptime-monitoring |
| Backup | Ingen | Automatisk databasbackup |

### 10.6 Utvecklarverktyg

- **Dev-banner:** Gul banner i webbläsaren visar SMS-kod automatiskt
- **Serverlogg:** Alla SMS-koder loggas till konsolen: `[DEV-SMS] Kod till 0701234567: 541958`
- **Testanvändare:** Inloggningsnummer: `0701000001` (Inga Ek, Göteborg), `0701000004` (Marie Nyström, Stockholm) etc.
- **Databas-reset:** `npm run seed` rensar och återskapar all data

---

## 11. Sammanfattning

Gemenskap är en tekniskt välstrukturerad prototyp som balanserar enkelhet med sofistikerad funktionalitet. Nyckelstyrkor:

- **Ingen ramverksberoende** — snabb laddning, enkel att debugga, långsiktig underhållbarhet
- **Tillgänglig design** — Atkinson Hyperlegible-typsnitt, 20px bas, 58px-knappar, WCAG AA-kontrast
- **Smart matchning** — ML-ensemble med 4 algoritmer, Jaccard-dominerad (45%) för intresseträffsäkerhet
- **Säker autentisering** — HttpOnly cookies, prepared statements (SQL injection-skydd), XSS-escape
- **Tvåspråkighet** — Realtidsväxling utan sidladdning via event-system
- **Lösningsorienterade fel** — Varje felmeddelande föreslår en åtgärd, aldrig anklagande

Arkitekturen ger en stabil grund att bygga vidare på för produktion genom att adressera SMS-integration, databasbyte och realtidskommunikation.
