# Recall — Production Readiness Roadmap

This file is the canonical list of everything standing between the current state of Recall and a genuinely production-grade, publicly shippable application. Items are grouped by concern and tagged with a priority level:

- **P0** — security or data-loss risk. Must be closed before any public exposure.
- **P1** — operational necessity. Fine for private use; blocking for anything shared.
- **P2** — important quality and maintainability work.
- **P3** — meaningful product improvements and future directions.

---

## 1. Security

### 1.1 · No rate limiting on auth endpoints `P0`

`POST /api/auth/login` and `POST /api/auth/register` accept unlimited requests. A basic credential-stuffing script can exhaust the bcrypt work factor and enumerate passwords.

**Fix:** `express-rate-limit` — 10 attempts per 15-minute window on `/api/auth`, separate stricter limiter (3/hour) on `/api/auth/register` to prevent account spam.

```bash
npm install express-rate-limit
```

```js
const rateLimit = require('express-rate-limit');
app.use('/api/auth/login',    rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }));
app.use('/api/auth/register', rateLimit({ windowMs: 60 * 60 * 1000, max: 3  }));
```

Also consider `express-slow-down` to progressively delay rather than hard-block — better UX for legitimate users who mis-type.

---

### 1.2 · JWT_SECRET has a public default `P0`

Line 13 of `server.js`:
```js
const JWT_SECRET = process.env.JWT_SECRET || 'recall-dev-secret-please-change-in-production';
```

The fallback is a known string committed to a public repo. Any deployment that forgets to set the env var is signing tokens with a secret that anyone can look up on GitHub — every token becomes forgeable.

**Fix:** Refuse to start if the env var is missing or matches the default.

```js
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'recall-dev-secret-please-change-in-production') {
  console.error('FATAL: JWT_SECRET env var is not set or is the default. Refusing to start.');
  process.exit(1);
}
```

Add a `scripts/generate-secret.js` helper that prints `crypto.randomBytes(64).toString('hex')` so deployers have a one-liner to generate a strong secret.

---

### 1.3 · CORS is a wildcard `P0`

```js
res.header('Access-Control-Allow-Origin', '*');
```

This allows any origin to make cross-origin requests using a victim's Bearer token (if the attacker can get the token into a request). For a self-hosted tool this is tolerable, but for anything accessible on the public internet it should be locked to the actual serving origin.

**Fix:** Reflect the `Origin` header only for allowed origins, or simply lock to the configured `BASE_URL` env var:

```js
const ALLOWED_ORIGIN = process.env.BASE_URL || 'http://localhost:3000';
app.use((req, res, next) => {
  if (req.headers.origin === ALLOWED_ORIGIN) {
    res.header('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  }
  // ... rest unchanged
});
```

---

### 1.4 · No HTTP security headers `P1`

The server sends no `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, or `Permissions-Policy` headers. A CSP alone would prevent an entire class of XSS escalation paths.

**Fix:** `helmet` in one line:

```bash
npm install helmet
```

```js
app.use(require('helmet')());
```

Then tune the CSP to allow the Google Fonts import and inline styles the app currently uses.

---

### 1.5 · Unvalidated input lengths `P1`

Topic, notes, subject, tags, and card content fields have no server-side length limits. A malicious or buggy client can POST arbitrarily large strings that bloat the database and potentially cause memory issues when `JSON.parse`-ing large reviews arrays.

**Fix:** Add explicit length checks at the route level before any DB write:

```js
if (topic?.length > 500)  return res.status(400).json({ error: 'Topic too long' });
if (notes?.length > 10000) return res.status(400).json({ error: 'Notes too long' });
```

Define constants at the top of the file so they're easy to adjust.

---

### 1.6 · No token revocation `P2`

JWTs expire after 7 days but there is no way to invalidate a token before expiry — not on password change, not on explicit logout. If a token is leaked, it remains valid until natural expiry.

**Fix (lightweight):** Store a `token_version` integer per user. Embed it in the JWT payload. On `requireAuth`, verify the claimed version matches the database. Increment the version on password change or explicit logout to immediately invalidate all prior tokens.

**Fix (thorough):** Maintain a `revoked_tokens` table with a TTL index, or use short-lived access tokens (15 min) paired with a refresh token flow.

---

### 1.7 · innerHTML used in some render paths `P2`

Several places in `index.html` construct HTML strings with user-supplied values interpolated directly (session topic in day modal link targets, subject names in filter bar, etc.). Most are read from the server and therefore stored-XSS risks rather than reflected, but they exist.

**Fix:** Audit every `innerHTML =` and `innerHTML +=` assignment. Replace with `textContent` for plain text or a small `sanitise(str)` helper (replaces `<>&"'`) for values that must go into attribute positions. The DOM-based approach already used in the card editor and link renderer is the right pattern — extend it everywhere.

---

## 2. Reliability & Operations

### 2.1 · No process manager `P0`

One unhandled exception crashes the server and it stays down until someone SSHes in. There is no auto-restart, no memory limit, no log persistence.

**Fix:** Add `ecosystem.config.js` to the repo:

```js
module.exports = {
  apps: [{
    name: 'recall',
    script: 'server.js',
    restart_delay: 2000,
    max_restarts: 10,
    env_file: '.env',
    out_file: 'logs/out.log',
    error_file: 'logs/err.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }]
};
```

Update README: `pm2 start ecosystem.config.js && pm2 save && pm2 startup`.

Alternatively a `recall.service` systemd unit file achieves the same without PM2 as a dependency.

---

### 2.2 · No graceful shutdown `P1`

The process receives SIGTERM (e.g., from PM2 restart or `docker stop`) and dies immediately, potentially mid-write. SQLite's WAL mode protects against corruption but in-flight HTTP responses are dropped.

**Fix:**

```js
process.on('SIGTERM', () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
});
```

Where `server` is the return value of `app.listen(...)`.

---

### 2.3 · No structured logging `P1`

Errors are swallowed or logged as unformatted strings. In production, knowing *which* route failed, *which* user triggered it, and *what* the error was is essential for debugging silent failures.

**Fix:** Replace `console.error` with a minimal structured logger. `pino` is the right choice — near-zero overhead, JSON output, compatible with log aggregators:

```bash
npm install pino pino-http
```

Each log line should include: `timestamp`, `level`, `route`, `userId` (from JWT if available), `durationMs`, `statusCode`, and `error` (message + stack on 5xx).

---

### 2.4 · No health check endpoint `P1`

Uptime monitors, load balancers, and Docker health checks need a `GET /health` route. Without it there is no automated way to detect that the app is down.

**Fix:**

```js
app.get('/health', (req, res) => {
  try {
    db.prepare('SELECT 1').get(); // verify DB is reachable
    res.json({ status: 'ok', uptime: process.uptime() });
  } catch (e) {
    res.status(503).json({ status: 'error', detail: e.message });
  }
});
```

---

### 2.5 · No database backup `P1`

`recall.db` is a single file. Accidental deletion, filesystem corruption, or a botched migration = total permanent data loss for every user.

**Fix (minimal):** Add a `scripts/backup.sh`:

```bash
#!/bin/bash
DEST="backups/recall-$(date +%F-%H%M).db"
mkdir -p backups
sqlite3 recall.db ".backup $DEST"
find backups -name "*.db" -mtime +30 -delete  # keep 30 days
echo "Backup written to $DEST"
```

Document a daily cron: `0 3 * * * /path/to/recall/scripts/backup.sh`.

**Fix (thorough):** If the server has S3 or Backblaze access, pipe the backup to `aws s3 cp` or `rclone` for off-site storage. One lost server should not mean lost data.

---

### 2.6 · SQLite WAL mode not explicitly enabled `P2`

`better-sqlite3` opens the database in the default journal mode (DELETE), not WAL. WAL allows concurrent reads during a write and is materially better for a web server where reads and writes interleave constantly.

**Fix:** Add immediately after `new Database(...)`:

```js
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL'); // safe with WAL, faster than FULL
db.pragma('foreign_keys = ON');    // also: enforce FK constraints (currently unenforced)
```

The `foreign_keys` pragma is separately important — the `links`, `sessions`, and `decks` tables reference other tables but SQLite ignores those relationships without this pragma.

---

## 3. Data Integrity

### 3.1 · Migration system is try/catch ALTER TABLE `P1`

The current approach:
```js
try { db.exec(`ALTER TABLE sessions ADD COLUMN tags TEXT DEFAULT '[]'`); } catch {}
```

This works for additive changes but has no concept of version, no rollback path, no record of what has been applied, and silently swallows errors from legitimate failures (e.g., out-of-disk-space during ALTER).

**Fix:** A simple versioned migration table:

```js
db.exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)`);

const migrations = [
  [1, `ALTER TABLE sessions ADD COLUMN tags TEXT DEFAULT '[]'`],
  [2, `ALTER TABLE sessions ADD COLUMN ease_factor REAL DEFAULT 2.5`],
  // ...
];

const current = db.prepare('SELECT MAX(version) as v FROM schema_version').get().v || 0;
for (const [v, sql] of migrations) {
  if (v > current) {
    db.exec(sql);
    db.prepare('INSERT INTO schema_version VALUES (?)').run(v);
  }
}
```

Each migration is idempotent, versioned, and logged. A failed migration aborts startup rather than continuing silently.

---

### 3.2 · Reviews and cards stored as JSON blobs `P2`

`reviews` and `cards` are JSON strings in TEXT columns. This means:
- You can't query "all reviews due today" in SQL — you must load every session into memory and filter in JS.
- There are no foreign key relationships between cards and decks, or reviews and sessions, at the DB layer.
- A single malformed JSON string silently breaks an entire session or deck.

**Fix (long-term):** Normalise into proper tables:

```sql
CREATE TABLE reviews (
  id         TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  due_date   TEXT NOT NULL,
  done       INTEGER NOT NULL DEFAULT 0,
  confidence INTEGER,
  completed_at TEXT
);

CREATE TABLE cards (
  id       TEXT PRIMARY KEY,
  deck_id  TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  front    TEXT NOT NULL,
  back     TEXT NOT NULL
);
```

This is a breaking schema change and requires a migration that reads all existing JSON, writes rows, then drops the old columns. It pays for itself immediately in query efficiency and data correctness guarantees.

---

### 3.3 · No transaction wrapping on multi-step writes `P2`

Creating a session also calls `buildReviewsForDate` and writes. Creating recurrences in a loop runs multiple inserts. If the process crashes mid-loop, the database is left in a partially-written state.

**Fix:** Wrap any operation touching more than one row in a `better-sqlite3` transaction:

```js
const createSession = db.transaction((data) => {
  // insert session
  // insert reviews
});
createSession({ ... });
```

`better-sqlite3` transactions are synchronous and auto-rollback on throw.

---

## 4. Account Management

### 4.1 · No password reset `P1`

A user who forgets their password has no recovery path. Their data is permanently inaccessible. This is a hard blocker for any public deployment.

**Implementation path:**
1. Add `password_reset_tokens` table: `(token TEXT PRIMARY KEY, user_id TEXT, expires_at TEXT)`.
2. `POST /api/auth/reset-request { email }` — generate a cryptographically random token, store it with a 1-hour expiry, send an email with a reset link.
3. `POST /api/auth/reset-confirm { token, newPassword }` — verify token not expired, bcrypt hash new password, delete token, increment `token_version`.
4. Email sending via `nodemailer` with SMTP credentials in env vars. For simple self-hosting, a transactional email service (Resend, Postmark) is far more reliable than self-hosted SMTP.

This is the most work on the entire list (~1 day) but is non-negotiable for anything public.

---

### 4.2 · No email verification `P2`

Anyone can register with any email address. For a personal tool this is fine. For a shared or public instance it enables account enumeration and spam.

**Fix:** After registration, set `email_verified = 0` and send a verification link. Restrict access to read-only or show a banner until verified. Same infrastructure as password reset — implement both together.

---

### 4.3 · No account deletion `P2`

Users have no way to delete their account and all associated data. This is a GDPR requirement if the service is offered to EU residents.

**Fix:** `DELETE /api/auth/account` — requires password confirmation in the request body, then deletes the user row plus all sessions, reviews, links, decks, and settings via cascading delete (requires FK enforcement from 2.6).

---

### 4.4 · No full data export `P2`

Users cannot get their own data out. This is a trust issue and a GDPR right-of-access requirement.

**Fix:** `GET /api/export` — returns a JSON object with all of the authenticated user's sessions, decks, links, and settings. Trivial to implement, high trust signal.

```js
app.get('/api/export', requireAuth, (req, res) => {
  const uid = req.user.id;
  res.json({
    exported_at: new Date().toISOString(),
    sessions: db.prepare('SELECT * FROM sessions WHERE user_id = ?').all(uid),
    decks:    db.prepare('SELECT * FROM decks    WHERE user_id = ?').all(uid),
    links:    db.prepare('SELECT * FROM links    WHERE user_id = ?').all(uid),
    settings: db.prepare('SELECT * FROM settings WHERE key LIKE ?').all(`${uid}:%`),
  });
});
```

---

### 4.5 · Password strength is only length >= 8 `P3`

No complexity requirements, no check against common passwords. `zxcvbn` is a browser-side library that scores password strength without sending it anywhere — add it to the registration form to nudge users toward stronger passwords.

---

## 5. Testing

### 5.1 · SM-2 algorithm has no unit tests `P0`

`computeSM2` and `buildReviewsForDate` are the core value proposition of the application. A subtle off-by-one in interval calculation or an incorrect ease factor floor silently corrupts every future review date for every user. This class of bug is invisible to the eye and undetectable without automated tests.

**Fix:** Extract to `lib/sm2.js`, write Jest unit tests covering:
- `quality < 3` resets interval to 1 and decrements ease factor
- Ease factor never falls below 1.3
- `quality = 5` grows ease factor correctly
- Interval rounding is correct
- `buildReviewsForDate` generates the right number of review dates at the right offsets
- Custom intervals are respected

```bash
npm install --save-dev jest
```

```js
// lib/sm2.test.js
const { computeSM2 } = require('./sm2');
test('quality < 3 resets interval', () => {
  const result = computeSM2(2, 2.5, 7);
  expect(result.nextInterval).toBe(1);
  expect(result.easeFactor).toBeCloseTo(2.3);
  expect(result.pass).toBe(false);
});
```

---

### 5.2 · No API integration tests `P1`

Every route is untested. A refactor that breaks session creation or the PATCH reviews endpoint would ship silently. Integration tests that hit a real in-memory SQLite database are far more valuable than mocks here.

**Fix:** `supertest` + Jest:

```bash
npm install --save-dev supertest
```

Test each route: auth flow, session CRUD, SM-2 schedule mutation, deck operations, recurrence creation. Use a fresh in-memory database per test file: `new Database(':memory:')`.

---

### 5.3 · No CI pipeline `P1`

There is no GitHub Actions workflow. Nothing runs on push. A broken commit reaches `master` without any automated gate.

**Fix:** `.github/workflows/ci.yml`:

```yaml
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm test
```

Once Playwright tests are stable, add them as a second job.

---

### 5.4 · Playwright tests are ad-hoc, not in CI `P2`

The E2E tests written during development are not committed, not repeatable, and not running on every push. The browser flow is where the most user-visible bugs live.

**Fix:** Commit the Playwright test suite to `tests/e2e/`. Run it in CI against a test server started with an in-memory database. Gate merges on it passing.

---

## 6. Performance & Scalability

### 6.1 · No database indexes `P1`

Queries like `SELECT * FROM sessions WHERE user_id = ?` do a full table scan. Fine with 100 sessions, noticeably slow at 10,000.

**Fix:** Add indexes for every column that appears in a WHERE clause:

```sql
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_studied_date ON sessions(user_id, studied_date);
CREATE INDEX IF NOT EXISTS idx_links_from_id ON links(from_id);
CREATE INDEX IF NOT EXISTS idx_links_to_id ON links(to_id);
CREATE INDEX IF NOT EXISTS idx_decks_session_id ON decks(session_id);
CREATE INDEX IF NOT EXISTS idx_decks_user_id ON decks(user_id);
```

---

### 6.2 · Recurrence creation runs on every GET /sessions `P2`

`createRecurrences(userId)` runs synchronously on every session load. For a user with many recurring sessions and a long absence, this could block the event loop for hundreds of milliseconds.

**Fix:** Move recurrence creation to a background job (a `setInterval` running every hour, or a proper job queue). Return sessions immediately and let the client poll or use a WebSocket notification when new recurrences are created.

---

### 6.3 · All sessions loaded into memory `P2`

`GET /api/sessions` returns every session the user has ever created. At large scale this is a significant payload.

**Fix:** Add pagination and date-range filtering to the sessions endpoint. The client only needs the current month's sessions for the calendar view — load adjacent months lazily on navigation.

---

### 6.4 · No response compression `P2`

The server sends uncompressed JSON and static assets. `index.html` alone is large enough to benefit from gzip.

**Fix:**

```bash
npm install compression
```

```js
app.use(require('compression')());
```

---

## 7. Deployment

### 7.1 · No Docker setup `P1`

There is no `Dockerfile` or `docker-compose.yml`. Deploying requires manual Node.js setup, manual PM2 installation, and manual reverse proxy configuration. This is a significant friction barrier for self-hosters.

**Fix — `Dockerfile`:**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p data logs
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
```

**Fix — `docker-compose.yml` with Caddy for automatic HTTPS:**

```yaml
services:
  recall:
    build: .
    restart: unless-stopped
    environment:
      - JWT_SECRET=${JWT_SECRET}
      - PORT=3000
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports: ["80:80", "443:443", "443:443/udp"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    depends_on: [recall]

volumes:
  caddy_data:
```

**`Caddyfile`:**

```
recall.yourdomain.com {
  reverse_proxy recall:3000
}
```

This gives HTTPS via Let's Encrypt, automatic cert renewal, HTTP→HTTPS redirect, and HTTP/2 — all without touching nginx config. Deployers run `docker compose up -d` and they're done.

---

### 7.2 · Database path is hardcoded `P1`

```js
const db = new Database(path.join(__dirname, 'recall.db'));
```

In a Docker container this file lives inside the container layer and is destroyed on every `docker compose down`. The path needs to be configurable via env var so it can be volume-mounted.

**Fix:**

```js
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'recall.db');
const db = new Database(DB_PATH);
```

In Docker: mount `./data:/app/data` and set `DB_PATH=/app/data/recall.db`.

---

### 7.3 · No `.env.example` file `P1`

New deployers have to read the README and guess which env vars are needed. A missing `JWT_SECRET` means the server refuses to start (after fix 1.2) with an opaque error.

**Fix:** Commit a `.env.example`:

```
# Required
JWT_SECRET=your-very-long-random-secret-here

# Optional
PORT=3000
DB_PATH=./recall.db
BASE_URL=https://recall.yourdomain.com
NODE_ENV=production
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_USER=recall@yourdomain.com
SMTP_PASS=yourpassword
SMTP_FROM=Recall <recall@yourdomain.com>
```

---

## 8. Code Architecture

### 8.1 · `index.html` is 3000+ lines `P2`

The entire frontend — state management, routing, rendering, business logic, keyboard shortcuts, SM-2 client-side display logic, flashcard system — lives in a single file. Finding a bug means searching through thousands of lines. Adding a feature risks breaking something unrelated. Testing any piece in isolation is impossible.

**Fix:** Split into native ES modules — no bundler required, all modern browsers support `<script type="module">`:

```
public/
  index.html          ← shell: imports, DOM skeleton, style links only
  js/
    api.js            ← authFetch, all server calls
    state.js          ← sessions, decks, settings, currentDayDate (shared state)
    calendar.js       ← renderCalendar, renderDueToday, drag-drop
    modals/
      day.js          ← openDayModal, closeDayModal
      add.js          ← openAddModal, saveStudySession
      study.js        ← openStudyModal, flipCard, score screen
      deck.js         ← openDeckEditor, saveDeck, importParsing
      rating.js       ← openRatingModal, SM-2 display
      curve.js        ← forgetting curve chart
      graph.js        ← knowledge graph SVG simulation
      stats.js        ← stats modal, heatmap
    sm2.js            ← pure SM-2 functions (shared with server via lib/)
    themes.js         ← THEMES array, applyTheme
    keyboard.js       ← global keydown handler
```

Each module exports named functions. `index.html` imports only what it needs. This is a large refactor but the payoff is immediate — every subsequent feature becomes faster and safer to add.

---

### 8.2 · SM-2 logic is duplicated `P2`

`computeSM2` exists in `server.js` and the client independently reimplements display logic. A shared `lib/sm2.js` used by both eliminates drift.

---

### 8.3 · Global mutable state everywhere `P2`

`sessions`, `decks`, `links`, `settings`, `studyState`, `currentDayDate`, etc. are all bare `let` variables in the global script scope. Any function can mutate any state at any time. Bugs from unexpected mutation are very hard to track.

**Fix:** Move toward a single immutable state object with explicit update functions — not necessarily Redux, but at minimum:

```js
const state = {
  sessions: [],
  decks: [],
  links: [],
  settings: {},
};
function setState(patch) {
  Object.assign(state, patch);
  render(); // or targeted re-renders
}
```

---

## 9. Feature Gaps

### 9.1 · No push notifications for due reviews `P2`

The PWA infrastructure (service worker) is already in place. Browser push notifications would let users know reviews are due without opening the app. This is the single highest-leverage engagement feature for a spaced-repetition tool — the whole point is showing up on the right day.

**Implementation:** Web Push API + `web-push` npm package on the server. Store push subscriptions in a `push_subscriptions` table. Send a notification from a daily cron job (or on session load) when reviews are due.

---

### 9.2 · Flashcard practice stats are not tracked `P2`

The score screen shows how many cards were practiced in a single session, but nothing is persisted. Over time, users have no way to know which cards they consistently skip, which topics they practice most, or whether their recall is improving card-by-card.

**Implementation:** Add a `practice_sessions` table: `(id, deck_id, user_id, cards_seen, cards_total, practiced_at)`. Write a row on study modal close. Surface a "Practice history" section in the stats modal.

---

### 9.3 · Per-card spaced repetition `P3`

Currently SM-2 is applied at the session level, not the card level. The flashcard system is active-recall practice but not itself scheduled — the same deck appears on every review regardless of which cards the user knows well.

**Implementation:** Add `ease_factor`, `interval`, and `next_due` to each card row. After each card review (flip = seen, then user self-rates), run SM-2 on that card individually. Only surface due cards in a practice session. This transforms the deck system from a passive study aid into a first-class spaced repetition system for individual facts.

---

### 9.4 · No shared/public decks `P3`

Every deck is private to the user who created it. There is no way to share a deck with another user or publish one publicly.

**Implementation:** Add a `public` boolean and optional `share_token` to the `decks` table. A shareable link lets anyone view and import the deck into their own account. An optional public gallery (decks with `listed = true`) lets the community browse and import.

---

### 9.5 · No Obsidian / external integrations `P3`

Recall's knowledge graph and session structure map naturally onto note-taking tools, but there is no integration path. An authenticated REST API or webhook system would allow:
- An Obsidian plugin that creates Recall sessions from note front matter
- A browser extension that logs sessions from any webpage
- Zapier/Make integrations for habit trackers, Notion, etc.

**Implementation:** Document the existing API formally. Add API key auth (separate from JWT, long-lived, scoped to read/write sessions) as an alternative to Bearer tokens for programmatic access.

---

### 9.6 · Local mode and server mode have diverged `P2`

`local-api.js` (IndexedDB) cannot support binary file parsing (`.apkg`), server-side SM-2 recalculation, or any feature that requires actual compute on the server. The two modes are now meaningfully different products, and the gap will widen with every new feature.

**Decision to make:** Either invest in keeping local mode fully featured (move `.apkg` parsing to a WASM SQLite build running in the browser), or formally deprecate local mode and document the Docker path as the supported zero-config deployment story. Trying to maintain both indefinitely is expensive.

---

## Summary — Suggested Execution Order

| Phase | Items | Outcome |
|---|---|---|
| **Phase 1** — Safe to share | 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.4, 7.3 | Secure, stays up, observable |
| **Phase 2** — Data trustworthy | 2.5, 2.6, 3.1, 3.3, 5.1, 6.1, 7.1, 7.2 | Backups, WAL, indexes, Docker, SM-2 tested |
| **Phase 3** — User complete | 4.1, 4.3, 4.4, 5.2, 5.3 | Password reset, deletion, export, CI |
| **Phase 4** — Scale and quality | 1.5, 1.6, 1.7, 3.2, 6.2, 6.3, 8.1, 8.2, 8.3 | Normalised DB, split frontend, no global state |
| **Phase 5** — Product | 9.1, 9.2, 9.3, 9.4, 9.5, 9.6 | Notifications, card-level SR, sharing, integrations |
