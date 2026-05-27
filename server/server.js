const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

require('./db');

// Klusterbaserad ML — ingen träning vid startup. Tilldelningen sker
// just-in-time via Jaccard-jämförelse mot DBSCAN-formade kluster (kommer
// från generate-synthetic-dataset.js och seedas in i DB).
require('./ml');

const { router: authRouter } = require('./auth');
const usersRouter = require('./users');
const communitiesRouter = require('./communities');
const postsRouter = require('./posts');
const eventsRouter = require('./events');
const messagesRouter = require('./messages');
const moderationRouter = require('./moderation');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/communities', communitiesRouter);
app.use('/api/communities/:communityId/posts', postsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/moderation', moderationRouter);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'not_found' });
  }
  next();
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: 'server_error',
    message_sv:
      'Något gick fel hos oss, men din information är trygg. Försök igen om en stund.',
    message_en: 'Something went wrong on our side, but your information is safe. Please try again soon.',
  });
});

app.listen(PORT, () => {
  console.log(`\nGemenskap körs på http://localhost:${PORT}`);
  console.log('Tips: kör "npm run seed" om databasen är tom.');
});
