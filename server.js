const express  = require('express');
const Database = require('better-sqlite3');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const path     = require('path');
const crypto   = require('crypto');
const os       = require('os');
const fs       = require('fs');
const AdmZip   = require('adm-zip');
const { computeSM2, addDays, todayUTC, nextRecurDate, toResponse, sanitizeCards } = require('./public/shared-utils');

const app  = express();
const dbPath = process.env.DB_PATH || path.join(__dirname, 'recall.db');
const db   = new Database(dbPath);
const PORT = process.env.PORT || 3000;
const JWT_SECRET  = process.env.JWT_SECRET || 'recall-dev-secret-please-change-in-production';
const JWT_EXPIRES = '7d';
const SALT_ROUNDS = 12;

// ── Schema ────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,
    email        TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at   TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL DEFAULT '',
    topic        TEXT NOT NULL,
    studied_date TEXT NOT NULL,
    notes        TEXT DEFAULT '',
    subject      TEXT DEFAULT '',
    reviews      TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS links (
    id       TEXT PRIMARY KEY,
    user_id  TEXT NOT NULL,
    from_id  TEXT NOT NULL,
    to_id    TEXT NOT NULL,
    relation TEXT NOT NULL DEFAULT 'related'
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS decks (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    session_id TEXT NOT NULL,
    name       TEXT NOT NULL,
    cards      TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
  )
`);

// Migrations
try { db.exec(`ALTER TABLE sessions ADD COLUMN subject         TEXT DEFAULT ''`); } catch {}
try { db.exec(`ALTER TABLE sessions ADD COLUMN user_id         TEXT NOT NULL DEFAULT ''`); } catch {}
try { db.exec(`ALTER TABLE sessions ADD COLUMN ease_factor     REAL DEFAULT 2.5`); } catch {}
try { db.exec(`ALTER TABLE sessions ADD COLUMN review_streak   INTEGER DEFAULT 0`); } catch {}
try { db.exec(`ALTER TABLE sessions ADD COLUMN recurrence_rule TEXT DEFAULT NULL`); } catch {}
try { db.exec(`ALTER TABLE sessions ADD COLUMN recurrence_id   TEXT DEFAULT NULL`); } catch {}
try { db.exec(`ALTER TABLE sessions ADD COLUMN tags            TEXT DEFAULT '[]'`); } catch {}

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(express.json({ limit: '25mb' }));

// CORS — allow Capacitor WebView and any self-hosted origin to reach the API
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin',  '*');
  res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// index.html must never be served from browser or proxy cache — always fresh
app.get(['/', '/index.html'], (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve auth page at root if no token — the SPA handles this on the client side;
// we still serve all static files normally.
app.use(express.static(path.join(__dirname, 'public')));

function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── Recurrence helpers ────────────────────────────────────────────────────────

// Build a reviews array from a studied date using the user's custom intervals
function buildReviewsForDate(studiedDate, userId) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(`${userId}:intervals`);
  const ivs = row ? JSON.parse(row.value) : [1, 3, 7, 14, 30];
  return ivs.map(days => ({ date: addDays(studiedDate, days), done: false }));
}

// Auto-create any due recurring sessions; returns count of newly created rows
function createRecurrences(userId) {
  const today = todayUTC();

  const recurring = db.prepare(
    `SELECT * FROM sessions WHERE user_id = ? AND recurrence_id IS NOT NULL ORDER BY studied_date ASC`
  ).all(userId);
  if (!recurring.length) return 0;

  // Find the latest session per recurrence series
  const latestBySeries = {};
  recurring.forEach(s => {
    const rid = s.recurrence_id;
    if (!latestBySeries[rid] || s.studied_date > latestBySeries[rid].studied_date) {
      latestBySeries[rid] = s;
    }
  });

  const insert = db.prepare(
    `INSERT INTO sessions
       (id, user_id, topic, subject, notes, studied_date, reviews, ease_factor, review_streak, recurrence_rule, recurrence_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, 2.5, 0, ?, ?)`
  );

  let created = 0;
  const MAX_PER_SERIES = 14; // safety: at most 14 catch-up instances per load

  for (const s of Object.values(latestBySeries)) {
    let nextDate = nextRecurDate(s.studied_date, s.recurrence_rule);
    let count = 0;
    while (nextDate && nextDate <= today && count < MAX_PER_SERIES) {
      const exists = db.prepare(
        `SELECT id FROM sessions WHERE recurrence_id = ? AND studied_date = ? AND user_id = ?`
      ).get(s.recurrence_id, nextDate, userId);

      if (!exists) {
        const reviews = buildReviewsForDate(nextDate, userId);
        insert.run(
          crypto.randomUUID(), userId,
          s.topic, s.subject || '', s.notes || '',
          nextDate, JSON.stringify(reviews),
          s.recurrence_rule, s.recurrence_id
        );
        created++;
      }
      nextDate = nextRecurDate(nextDate, s.recurrence_rule);
      count++;
    }
  }

  return created;
}

// ── Auth routes ───────────────────────────────────────────────────────────────

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (exists) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }
  const id   = crypto.randomUUID();
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .run(id, email.toLowerCase().trim(), hash, new Date().toISOString());
  const token = jwt.sign({ id, email: email.toLowerCase().trim() }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.json({ token, user: { id, email: email.toLowerCase().trim() } });
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.json({ token, user: { id: user.id, email: user.email } });
});

// GET /api/auth/me  — verify token and return user info
app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, email, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// ── Settings (per-user) ───────────────────────────────────────────────────────

app.get('/api/settings', requireAuth, (req, res) => {
  const key = `${req.user.id}:intervals`;
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  res.json({ intervals: row ? JSON.parse(row.value) : [1, 3, 7, 14, 30] });
});

app.put('/api/settings', requireAuth, (req, res) => {
  const { intervals } = req.body;
  if (!Array.isArray(intervals) || intervals.length < 1 ||
      intervals.some(n => !Number.isInteger(n) || n < 1)) {
    return res.status(400).json({ error: 'intervals must be an array of positive integers' });
  }
  const key = `${req.user.id}:intervals`;
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    .run(key, JSON.stringify(intervals));
  res.json({ ok: true });
});

// ── Study Sessions (per-user) ─────────────────────────────────────────────────

app.get('/api/sessions', requireAuth, (req, res) => {
  // Auto-create any due recurring sessions before returning
  const newRecurrences = createRecurrences(req.user.id);

  const rows = db.prepare(
    'SELECT * FROM sessions WHERE user_id = ? ORDER BY studied_date DESC'
  ).all(req.user.id);

  res.json({
    sessions: rows.map(r => toResponse({
      ...r,
      tags:            r.tags ? JSON.parse(r.tags) : [],
      reviews:         JSON.parse(r.reviews),
      recurrence_rule: r.recurrence_rule ? JSON.parse(r.recurrence_rule) : null,
    })),
    newRecurrences
  });
});

app.post('/api/sessions', requireAuth, (req, res) => {
  const { id, topic, studiedDate, notes, subject, tags, reviews, recurrenceRule, recurrenceId } = req.body;
  if (!id || !topic || !studiedDate || !Array.isArray(reviews)) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const tagsJson = Array.isArray(tags) ? JSON.stringify(tags.map(t => String(t).trim()).filter(Boolean)) : '[]';
  db.prepare(
    `INSERT INTO sessions (id, user_id, topic, studied_date, notes, subject, tags, reviews, recurrence_rule, recurrence_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, req.user.id, topic, studiedDate, notes || '', subject || '', tagsJson, JSON.stringify(reviews),
    recurrenceRule ? JSON.stringify(recurrenceRule) : null,
    recurrenceRule ? (recurrenceId || crypto.randomUUID()) : null
  );
  res.json({ ok: true });
});

app.patch('/api/sessions/:id/reviews/:index', requireAuth, (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const reviews  = JSON.parse(session.reviews);
  const idx      = parseInt(req.params.index, 10);
  if (idx < 0 || idx >= reviews.length) return res.status(400).json({ error: 'Invalid index' });

  // ── Drag-to-reschedule: just update the date, skip SM-2 ──
  if (req.body?.newDate) {
    const nd = req.body.newDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nd)) return res.status(400).json({ error: 'Invalid date format' });
    reviews[idx].date = nd;
    db.prepare('UPDATE sessions SET reviews = ? WHERE id = ? AND user_id = ?')
      .run(JSON.stringify(reviews), req.params.id, req.user.id);
    return res.json({ ok: true, reviews });
  }

  const done               = req.body?.done !== undefined ? Boolean(req.body.done) : true;
  const confidence         = req.body?.confidence ? parseInt(req.body.confidence, 10) : null;
  const rescheduleFromToday = Boolean(req.body?.rescheduleFromToday);

  reviews[idx].done = done;
  if (done && confidence) reviews[idx].confidence = confidence;
  else if (!done) delete reviews[idx].confidence;

  let easeFactor   = parseFloat(session.ease_factor)   || 2.5;
  let reviewStreak = parseInt(session.review_streak, 10) || 0;

  if (done && idx + 1 < reviews.length) {
    if (confidence) {
      // SM-2: use scheduled interval (original due dates) as the rep interval
      const prevDate     = idx === 0 ? session.studied_date : reviews[idx - 1].date;
      const [py,pm,pd]   = prevDate.split('-').map(Number);
      const [ty,tm,td]   = reviews[idx].date.split('-').map(Number);
      const intervalDays = Math.max(1, Math.round(
        (Date.UTC(ty, tm-1, td) - Date.UTC(py, pm-1, pd)) / 86400000
      ));
      const sm2 = computeSM2(confidence, easeFactor, intervalDays);
      easeFactor   = sm2.easeFactor;
      reviewStreak = sm2.pass ? reviewStreak + 1 : 0;

      // Anchor next review to today (if late/opted-in) or to scheduled due date
      const base = rescheduleFromToday ? todayUTC() : reviews[idx].date;
      reviews[idx + 1].date = addDays(base, sm2.nextInterval);
      reviews[idx + 1].done = false;
      delete reviews[idx + 1].confidence;

    } else if (rescheduleFromToday) {
      // Skipped rating but wants late recovery — preserve original gap, shift base to today
      const [ay,am,ad] = reviews[idx].date.split('-').map(Number);
      const [by,bm,bd] = reviews[idx + 1].date.split('-').map(Number);
      const originalGap = Math.max(1, Math.round(
        (Date.UTC(by, bm-1, bd) - Date.UTC(ay, am-1, ad)) / 86400000
      ));
      reviews[idx + 1].date = addDays(todayUTC(), originalGap);
    }

  } else if (!done) {
    // Undo: roll streak back one step (floor at 0)
    reviewStreak = Math.max(0, reviewStreak - 1);
  }

  db.prepare('UPDATE sessions SET reviews = ?, ease_factor = ?, review_streak = ? WHERE id = ? AND user_id = ?')
    .run(JSON.stringify(reviews), easeFactor, reviewStreak, req.params.id, req.user.id);

  res.json({ ok: true, reviews, easeFactor, reviewStreak });
});

app.put('/api/sessions/:id', requireAuth, (req, res) => {
  const { topic, subject, notes, tags } = req.body;
  if (!topic) return res.status(400).json({ error: 'topic required' });
  const tagsJson = Array.isArray(tags) ? JSON.stringify(tags.map(t => String(t).trim()).filter(Boolean)) : '[]';
  const result = db.prepare(
    'UPDATE sessions SET topic = ?, subject = ?, notes = ?, tags = ? WHERE id = ? AND user_id = ?'
  ).run(topic, subject || '', notes || '', tagsJson, req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

app.delete('/api/sessions/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  // Also remove any links referencing this session
  db.prepare('DELETE FROM links WHERE user_id = ? AND (from_id = ? OR to_id = ?)')
    .run(req.user.id, req.params.id, req.params.id);
  res.json({ ok: true });
});

// ── Links ─────────────────────────────────────────────────────────────────────

app.get('/api/links', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM links WHERE user_id = ?').all(req.user.id);
  res.json({ links: rows });
});

app.post('/api/links', requireAuth, (req, res) => {
  const { fromId, toId, relation } = req.body;
  if (!fromId || !toId || fromId === toId) {
    return res.status(400).json({ error: 'Invalid link: fromId and toId required and must differ' });
  }
  const valid = ['related', 'builds-on', 'prerequisite', 'see-also'];
  const rel = valid.includes(relation) ? relation : 'related';

  // Prevent duplicate links in either direction
  const exists = db.prepare(
    `SELECT id FROM links WHERE user_id = ? AND
     ((from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?))`
  ).get(req.user.id, fromId, toId, toId, fromId);
  if (exists) return res.status(409).json({ error: 'A link between these sessions already exists' });

  const id = crypto.randomUUID();
  db.prepare('INSERT INTO links (id, user_id, from_id, to_id, relation) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.user.id, fromId, toId, rel);
  res.json({ ok: true, id });
});

app.delete('/api/links/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM links WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ── Anki HTML stripper ───────────────────────────────────────────────────────
function stripAnkiHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// ── Flashcard Decks ───────────────────────────────────────────────────────────

app.get('/api/decks', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM decks WHERE user_id = ?').all(req.user.id);
  res.json({ decks: rows.map(r => ({ ...r, cards: JSON.parse(r.cards) })) });
});

app.post('/api/decks', requireAuth, (req, res) => {
  const { id, sessionId, name, cards } = req.body;
  if (!id || !sessionId || !name || !Array.isArray(cards)) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const sanitized = sanitizeCards(cards, () => crypto.randomUUID());
  db.prepare('INSERT INTO decks (id, user_id, session_id, name, cards, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, req.user.id, sessionId, name, JSON.stringify(sanitized), new Date().toISOString());
  res.json({ ok: true });
});

app.put('/api/decks/:id', requireAuth, (req, res) => {
  const { name, cards } = req.body;
  if (!name || !Array.isArray(cards)) return res.status(400).json({ error: 'name and cards required' });
  const sanitized = sanitizeCards(cards, () => crypto.randomUUID());
  const result = db.prepare('UPDATE decks SET name = ?, cards = ? WHERE id = ? AND user_id = ?')
    .run(name, JSON.stringify(sanitized), req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

app.delete('/api/decks/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM decks WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// POST /api/decks/parse-apkg — receive raw .apkg bytes, return parsed cards
app.post('/api/decks/parse-apkg', requireAuth,
  express.raw({ type: '*/*', limit: '100mb' }),
  (req, res) => {
    if (!req.body || !req.body.length) {
      return res.status(400).json({ error: 'No file data received' });
    }
    const tmpPath = path.join(os.tmpdir(), `recall-anki-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    try {
      const zip = new AdmZip(req.body);
      const entry  = zip.getEntry('collection.anki21') || zip.getEntry('collection.anki2');
      if (!entry) return res.status(400).json({ error: 'Not a valid .apkg file — no collection database found' });

      fs.writeFileSync(tmpPath, entry.getData());
      const ankiDb = new Database(tmpPath, { readonly: true, fileMustExist: true });
      const notes  = ankiDb.prepare('SELECT flds FROM notes').all();
      ankiDb.close();

      const SEP   = '\x1f';
      const cards = notes
        .map(n => {
          const fields = n.flds.split(SEP);
          return { front: stripAnkiHtml(fields[0] || ''), back: stripAnkiHtml(fields[1] || '') };
        })
        .filter(c => c.front || c.back);

      res.json({ cards });
    } catch (err) {
      res.status(400).json({ error: 'Failed to parse .apkg: ' + (err.message || 'unknown error') });
    } finally {
      try { fs.unlinkSync(tmpPath); } catch {}
    }
  }
);

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Recall running at http://localhost:${PORT}`);
});
