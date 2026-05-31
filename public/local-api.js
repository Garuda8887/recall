/**
 * local-api.js — Offline-first local database layer for Recall
 *
 * Mirrors every server endpoint using @capacitor-community/sqlite.
 * Used when the app runs in "local mode" (no server configured).
 * All responses match the exact JSON shape the server returns so
 * index.html needs zero changes to its parsing logic.
 *
 * Only active inside a Capacitor native app (window.Capacitor defined).
 * Browser PWA always uses server mode.
 */

const LocalAPI = (() => {
  let _db = null;

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function uuid() {
    if (crypto?.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function addDays(dateStr, days) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
  }

  function todayUTC() {
    return new Date().toISOString().slice(0, 10);
  }

  function computeSM2(quality, easeFactor, intervalDays) {
    if (quality < 3) {
      return { nextInterval: 1, easeFactor: Math.max(1.3, easeFactor - 0.2), pass: false };
    }
    const q     = quality;
    const newEF = Math.max(1.3, easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
    return { nextInterval: Math.max(1, Math.round(intervalDays * newEF)), easeFactor: newEF, pass: true };
  }

  function nextRecurDate(lastDateStr, ruleJson) {
    const rule = typeof ruleJson === 'string' ? JSON.parse(ruleJson) : ruleJson;
    if (rule.type === 'interval') return addDays(lastDateStr, rule.days);
    if (rule.type === 'weekly') {
      const [y, m, d] = lastDateStr.split('-').map(Number);
      const cur = new Date(Date.UTC(y, m - 1, d + 1));
      while (cur.getUTCDay() !== rule.weekday) cur.setUTCDate(cur.getUTCDate() + 1);
      return cur.toISOString().slice(0, 10);
    }
    return null;
  }

  async function getIntervals() {
    const r = await _db.query('SELECT value FROM settings WHERE key = ?', ['local:intervals']);
    return r.values?.length ? JSON.parse(r.values[0].value) : [1, 3, 7, 14, 30];
  }

  async function buildReviewsForDate(studiedDate) {
    const ivs = await getIntervals();
    return ivs.map(days => ({ date: addDays(studiedDate, days), done: false }));
  }

  // ── Init ─────────────────────────────────────────────────────────────────────

  async function init() {
    if (_db) return;

    const { CapacitorSQLite } = await import('./capacitor-community-sqlite.js').catch(() => null) || {};
    // Use the globally registered plugin if available
    const sqlite = window.CapacitorSQLite || (window.Capacitor?.Plugins?.CapacitorSQLite);
    if (!sqlite) throw new Error('SQLite plugin not available');

    await sqlite.createConnection({
      database: 'recall',
      version: 1,
      encrypted: false,
      mode: 'no-encryption'
    });
    await sqlite.open({ database: 'recall' });
    _db = {
      execute: (sql, values = []) => sqlite.execute({ database: 'recall', statements: sql, values }),
      query:   (sql, values = []) => sqlite.query({ database: 'recall', statement: sql, values }),
      run:     (sql, values = []) => sqlite.run({ database: 'recall', statement: sql, values })
    };

    // Schema
    await _db.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        id              TEXT PRIMARY KEY,
        topic           TEXT NOT NULL,
        studied_date    TEXT NOT NULL,
        notes           TEXT DEFAULT '',
        subject         TEXT DEFAULT '',
        tags            TEXT DEFAULT '[]',
        reviews         TEXT NOT NULL,
        ease_factor     REAL DEFAULT 2.5,
        review_streak   INTEGER DEFAULT 0,
        recurrence_rule TEXT DEFAULT NULL,
        recurrence_id   TEXT DEFAULT NULL
      );
      CREATE TABLE IF NOT EXISTS links (
        id       TEXT PRIMARY KEY,
        from_id  TEXT NOT NULL,
        to_id    TEXT NOT NULL,
        relation TEXT NOT NULL DEFAULT 'related'
      );
      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  // ── Recurrences ──────────────────────────────────────────────────────────────

  async function createRecurrences() {
    const today = todayUTC();
    const r = await _db.query(
      'SELECT * FROM sessions WHERE recurrence_id IS NOT NULL ORDER BY studied_date ASC', []
    );
    const recurring = r.values || [];
    if (!recurring.length) return 0;

    const latestBySeries = {};
    recurring.forEach(s => {
      const rid = s.recurrence_id;
      if (!latestBySeries[rid] || s.studied_date > latestBySeries[rid].studied_date) {
        latestBySeries[rid] = s;
      }
    });

    let created = 0;
    for (const s of Object.values(latestBySeries)) {
      let nextDate = nextRecurDate(s.studied_date, s.recurrence_rule);
      let count = 0;
      while (nextDate && nextDate <= today && count < 14) {
        const ex = await _db.query(
          'SELECT id FROM sessions WHERE recurrence_id = ? AND studied_date = ?',
          [s.recurrence_id, nextDate]
        );
        if (!ex.values?.length) {
          const reviews = await buildReviewsForDate(nextDate);
          await _db.run(
            `INSERT INTO sessions (id, topic, subject, notes, studied_date, reviews, ease_factor, review_streak, recurrence_rule, recurrence_id)
             VALUES (?, ?, ?, ?, ?, ?, 2.5, 0, ?, ?)`,
            [uuid(), s.topic, s.subject || '', s.notes || '', nextDate,
             JSON.stringify(reviews), s.recurrence_rule, s.recurrence_id]
          );
          created++;
        }
        nextDate = nextRecurDate(nextDate, s.recurrence_rule);
        count++;
      }
    }
    return created;
  }

  // ── Route handler ────────────────────────────────────────────────────────────
  // Parses the URL + method and dispatches to the right handler.
  // Returns a Response-like object with { ok, status, json() }

  function makeResp(data, status = 200) {
    return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(data) };
  }

  async function handle(url, options = {}) {
    try {
      await init();
    } catch (err) {
      console.error('LocalAPI init failed:', err);
      return makeResp({ error: 'Local database unavailable' }, 500);
    }

    const method = (options.method || 'GET').toUpperCase();
    const body   = options.body ? JSON.parse(options.body) : {};

    // Strip query params for matching
    const path = url.split('?')[0].replace(/\/$/, '');

    // ── Auth (stubs — local mode has no real auth) ──────────────────────────
    if (path === '/api/auth/me')       return makeResp({ user: { id: 'local', email: 'local' } });
    if (path === '/api/auth/login')    return makeResp({ token: 'local-token', user: { id: 'local', email: body.email || 'local' } });
    if (path === '/api/auth/register') return makeResp({ token: 'local-token', user: { id: 'local', email: body.email || 'local' } });

    // ── Settings ────────────────────────────────────────────────────────────
    if (path === '/api/settings') {
      if (method === 'GET') {
        const ivs = await getIntervals();
        return makeResp({ intervals: ivs });
      }
      if (method === 'PUT') {
        const { intervals } = body;
        if (!Array.isArray(intervals) || intervals.some(n => !Number.isInteger(n) || n < 1)) {
          return makeResp({ error: 'Invalid intervals' }, 400);
        }
        await _db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
          ['local:intervals', JSON.stringify(intervals)]);
        return makeResp({ ok: true });
      }
    }

    // ── Sessions ─────────────────────────────────────────────────────────────
    if (path === '/api/sessions' && method === 'GET') {
      const newRecurrences = await createRecurrences();
      const r = await _db.query('SELECT * FROM sessions ORDER BY studied_date DESC', []);
      const sessions = (r.values || []).map(s => ({
        id:             s.id,
        topic:          s.topic,
        studiedDate:    s.studied_date,
        notes:          s.notes,
        subject:        s.subject || '',
        tags:           s.tags ? JSON.parse(s.tags) : [],
        reviews:        JSON.parse(s.reviews),
        easeFactor:     s.ease_factor   ?? 2.5,
        reviewStreak:   s.review_streak ?? 0,
        recurrenceRule: s.recurrence_rule ? JSON.parse(s.recurrence_rule) : null,
        recurrenceId:   s.recurrence_id  || null,
      }));
      return makeResp({ sessions, newRecurrences });
    }

    if (path === '/api/sessions' && method === 'POST') {
      const { id, topic, studiedDate, notes, subject, tags, reviews, recurrenceRule, recurrenceId } = body;
      if (!id || !topic || !studiedDate || !Array.isArray(reviews)) {
        return makeResp({ error: 'Missing required fields' }, 400);
      }
      const tagsJson = JSON.stringify(Array.isArray(tags) ? tags.map(t => String(t).trim()).filter(Boolean) : []);
      await _db.run(
        `INSERT INTO sessions (id, topic, studied_date, notes, subject, tags, reviews, recurrence_rule, recurrence_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, topic, studiedDate, notes || '', subject || '', tagsJson, JSON.stringify(reviews),
         recurrenceRule ? JSON.stringify(recurrenceRule) : null,
         recurrenceRule ? (recurrenceId || uuid()) : null]
      );
      return makeResp({ ok: true });
    }

    // PUT /api/sessions/:id
    const putMatch = path.match(/^\/api\/sessions\/([^/]+)$/);
    if (putMatch && method === 'PUT') {
      const { topic, subject, notes, tags } = body;
      if (!topic) return makeResp({ error: 'topic required' }, 400);
      const tagsJson = JSON.stringify(Array.isArray(tags) ? tags.map(t => String(t).trim()).filter(Boolean) : []);
      await _db.run(
        'UPDATE sessions SET topic = ?, subject = ?, notes = ?, tags = ? WHERE id = ?',
        [topic, subject || '', notes || '', tagsJson, putMatch[1]]
      );
      return makeResp({ ok: true });
    }

    // DELETE /api/sessions/:id
    if (putMatch && method === 'DELETE') {
      await _db.run('DELETE FROM sessions WHERE id = ?', [putMatch[1]]);
      await _db.run('DELETE FROM links WHERE from_id = ? OR to_id = ?', [putMatch[1], putMatch[1]]);
      return makeResp({ ok: true });
    }

    // PATCH /api/sessions/:id/reviews/:index
    const patchMatch = path.match(/^\/api\/sessions\/([^/]+)\/reviews\/(\d+)$/);
    if (patchMatch && method === 'PATCH') {
      const sessionId = patchMatch[1];
      const idx       = parseInt(patchMatch[2], 10);
      const r = await _db.query('SELECT * FROM sessions WHERE id = ?', [sessionId]);
      if (!r.values?.length) return makeResp({ error: 'Session not found' }, 404);
      const session = r.values[0];
      const reviews = JSON.parse(session.reviews);
      if (idx < 0 || idx >= reviews.length) return makeResp({ error: 'Invalid index' }, 400);

      // Drag-to-reschedule
      if (body?.newDate) {
        reviews[idx].date = body.newDate;
        await _db.run('UPDATE sessions SET reviews = ? WHERE id = ?', [JSON.stringify(reviews), sessionId]);
        return makeResp({ ok: true, reviews });
      }

      const done                = body?.done !== undefined ? Boolean(body.done) : true;
      const confidence          = body?.confidence ? parseInt(body.confidence, 10) : null;
      const rescheduleFromToday = Boolean(body?.rescheduleFromToday);

      reviews[idx].done = done;
      if (done && confidence) reviews[idx].confidence = confidence;
      else if (!done) delete reviews[idx].confidence;

      let easeFactor   = parseFloat(session.ease_factor)    || 2.5;
      let reviewStreak = parseInt(session.review_streak, 10) || 0;

      if (done && idx + 1 < reviews.length) {
        if (confidence) {
          const prevDate     = idx === 0 ? session.studied_date : reviews[idx - 1].date;
          const [py,pm,pd]   = prevDate.split('-').map(Number);
          const [ty,tm,td]   = reviews[idx].date.split('-').map(Number);
          const intervalDays = Math.max(1, Math.round(
            (Date.UTC(ty, tm-1, td) - Date.UTC(py, pm-1, pd)) / 86400000
          ));
          const sm2 = computeSM2(confidence, easeFactor, intervalDays);
          easeFactor   = sm2.easeFactor;
          reviewStreak = sm2.pass ? reviewStreak + 1 : 0;
          const base = rescheduleFromToday ? todayUTC() : reviews[idx].date;
          reviews[idx + 1].date = addDays(base, sm2.nextInterval);
          reviews[idx + 1].done = false;
          delete reviews[idx + 1].confidence;
        } else if (rescheduleFromToday) {
          const [ay,am,ad] = reviews[idx].date.split('-').map(Number);
          const [by,bm,bd] = reviews[idx + 1].date.split('-').map(Number);
          const gap = Math.max(1, Math.round(
            (Date.UTC(by, bm-1, bd) - Date.UTC(ay, am-1, ad)) / 86400000
          ));
          reviews[idx + 1].date = addDays(todayUTC(), gap);
        }
      } else if (!done) {
        reviewStreak = Math.max(0, reviewStreak - 1);
      }

      await _db.run(
        'UPDATE sessions SET reviews = ?, ease_factor = ?, review_streak = ? WHERE id = ?',
        [JSON.stringify(reviews), easeFactor, reviewStreak, sessionId]
      );
      return makeResp({ ok: true, reviews, easeFactor, reviewStreak });
    }

    // ── Links ──────────────────────────────────────────────────────────────
    if (path === '/api/links' && method === 'GET') {
      const r = await _db.query('SELECT * FROM links', []);
      return makeResp({ links: r.values || [] });
    }

    if (path === '/api/links' && method === 'POST') {
      const { fromId, toId, relation } = body;
      if (!fromId || !toId || fromId === toId) {
        return makeResp({ error: 'Invalid link' }, 400);
      }
      const valid = ['related', 'builds-on', 'prerequisite', 'see-also'];
      const rel = valid.includes(relation) ? relation : 'related';
      const ex = await _db.query(
        'SELECT id FROM links WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)',
        [fromId, toId, toId, fromId]
      );
      if (ex.values?.length) return makeResp({ error: 'Link already exists' }, 409);
      const id = uuid();
      await _db.run('INSERT INTO links (id, from_id, to_id, relation) VALUES (?, ?, ?, ?)',
        [id, fromId, toId, rel]);
      return makeResp({ ok: true, id });
    }

    const linkMatch = path.match(/^\/api\/links\/([^/]+)$/);
    if (linkMatch && method === 'DELETE') {
      await _db.run('DELETE FROM links WHERE id = ?', [linkMatch[1]]);
      return makeResp({ ok: true });
    }

    return makeResp({ error: 'Not found' }, 404);
  }

  return { handle, init };
})();
