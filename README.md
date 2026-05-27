# Gemenskap

En åldersanpassad community-sajt där äldre kan hitta små grupper för promenader, fika, hantverk, schack och mycket annat. Frontend i ren HTML/CSS/JS, backend som lokal Node + SQLite-mockserver. SMS-koden är simulerad: koden visas i serverloggen och i en gul banner i webbläsaren under utveckling.

## Krav

- Node.js 18 eller senare
- npm

## Komma igång

```bash
npm install
npm run seed     # skapar databas och exempeldata (~15 användare, 7 communities)
npm run dev      # startar servern på http://localhost:3000
```

Öppna `http://localhost:3000` i en webbläsare.

## Logga in i demo

Använd valfritt mobilnummer (minst 8 siffror), t.ex. `070-111 22 33`. Koden visas både i terminalen och i en gul banner i UI:t. Skriv in koden för att logga in.

Vill du logga in som någon av exempelanvändarna kan du använda dessa nummer (kod visas på samma sätt):

- `0700000001` — Margareta Lind, Stockholm
- `0700000006` — Karl-Erik Holm, Göteborg
- `0700000010` — Lars Andersson, Malmö

## Funktioner

- **Inloggning via SMS-kod** (simulerad). Max 3 steg: nummer → kod → klar. Auto-inloggning vid återbesök via cookie. "Skicka ny kod" aktiveras efter 30 sekunder.
- **Onboarding** med stad och intressen. Systemet föreslår tre communities baserat på överlapp.
- **Communities** med max 40 medlemmar, inläggsflöde, medlemslista och eventfunktion.
- **Direktmeddelanden** mellan medlemmar (polling var 5:e sekund).
- **Eventlista** över alla kommande aktiviteter i dina grupper, med RSVP.
- **Profil** med bio, intressen, mina communities, möjlighet att starta om tutorial.
- **Tutorial** för förstagångsanvändare.
- **Svenska som standard, engelska valbart** via knappen uppe till höger.
- **Felmeddelanden är alltid lösningsorienterade** – aldrig anklagande.

## Projektstruktur

```
arbete/
├── server/
│   ├── server.js
│   ├── db.js
│   ├── seed.js
│   ├── matching.js
│   └── routes/
│       ├── auth.js
│       ├── users.js
│       ├── communities.js
│       ├── posts.js
│       ├── events.js
│       └── messages.js
├── public/
│   ├── *.html
│   ├── css/styles.css
│   └── js/
│       ├── api.js, auth.js, components.js, i18n.js, tutorial.js
│       └── page/
└── data/        (SQLite-fil hamnar här efter seed)
```

## Återställa databasen

Kör `npm run seed` igen. Det rensar och fyller på med ny exempeldata. Användarens cookie kommer då bli ogiltig och man får logga in igen.

## Vad som inte är riktig produktion

- SMS skickas inte på riktigt – koden visas i UI:t. Byt ut i `server/routes/auth.js` mot en riktig leverantör (t.ex. 46elks eller Twilio) för produktion.
- Sessioner lagras enkelt i SQLite utan rotation.
- Ingen WebSocket – meddelanden hämtas via polling.
- Bilder/profilbilder är stiliserade initialer.

## Tillgänglighet

- Bas-fontstorlek 20 px, knappar minst 56 px höga
- Hög kontrast, tydlig fokus-ring (orange)
- Etiketter för alla formulärfält
- Inga popup-fönster eller annonser
- Max 2-3 huvudval per vy

## Licens

Privat / utbildningsdemo.
