/**
 * local-api.js — Offline-first local storage layer for Recall
 *
 * Uses IndexedDB — a standard browser API that works in every WebView
 * (Capacitor, PWA, desktop Chrome) with no plugin or native setup required.
 *
 * Mirrors every server endpoint and returns identical JSON shapes so
 * index.html needs zero changes to its data-handling code.
 */

const LocalAPI = (() => {
  const { addDays, todayUTC, computeSM2, nextRecurDate } = SharedUtils;

  // ── IndexedDB ──────────────────────────────────────────────────────────────

  const DB_NAME    = 'recall-local';
  const DB_VERSION = 2;
  let _dbPromise   = null;

  function openDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = e => resolve(e.target.result);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('sessions'))
          db.createObjectStore('sessions', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('links'))
          db.createObjectStore('links', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('settings'))
          db.createObjectStore('settings', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('decks'))
          db.createObjectStore('decks', { keyPath: 'id' });
      };
    });
    return _dbPromise;
  }

  async function dbGetAll(store) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(store, 'readonly').objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror  = () => reject(req.error);
    });
  }

  async function dbGet(store, key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(store, 'readonly').objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror  = () => reject(req.error);
    });
  }

  async function dbPut(store, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(store, 'readwrite').objectStore(store).put(value);
      req.onsuccess = () => resolve();
      req.onerror  = () => reject(req.error);
    });
  }

  async function dbDel(store, key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(store, 'readwrite').objectStore(store).delete(key);
      req.onsuccess = () => resolve();
      req.onerror  = () => reject(req.error);
    });
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  async function getIntervals() {
    const row = await dbGet('settings', 'local:intervals');
    return row ? row.value : [1, 3, 7, 14, 30];
  }

  async function buildReviews(studiedDate) {
    const ivs = await getIntervals();
    return ivs.map(days => ({ date: addDays(studiedDate, days), done: false }));
  }

  // Convert stored session to the camelCase shape index.html expects
  function toResponse(s) {
    return {
      id:             s.id,
      topic:          s.topic,
      studiedDate:    s.studied_date,
      notes:          s.notes          || '',
      subject:        s.subject        || '',
      tags:           Array.isArray(s.tags) ? s.tags : [],
      reviews:        Array.isArray(s.reviews) ? s.reviews : [],
      easeFactor:     s.ease_factor    ?? 2.5,
      reviewStreak:   s.review_streak  ?? 0,
      recurrenceRule: s.recurrence_rule || null,
      recurrenceId:   s.recurrence_id  || null,
    };
  }

  // ── Recurrences ────────────────────────────────────────────────────────────

  async function createRecurrences() {
    const today    = todayUTC();
    const sessions = await dbGetAll('sessions');
    const recurring = sessions.filter(s => s.recurrence_id);
    if (!recurring.length) return 0;

    // Latest session per recurrence series
    const latest = {};
    for (const s of recurring) {
      const rid = s.recurrence_id;
      if (!latest[rid] || s.studied_date > latest[rid].studied_date) latest[rid] = s;
    }

    let created = 0;
    for (const s of Object.values(latest)) {
      let nextDate = nextRecurDate(s.studied_date, s.recurrence_rule);
      let count = 0;
      while (nextDate && nextDate <= today && count < 14) {
        const exists = sessions.some(
          x => x.recurrence_id === s.recurrence_id && x.studied_date === nextDate
        );
        if (!exists) {
          const reviews = await buildReviews(nextDate);
          await dbPut('sessions', {
            id:              crypto.randomUUID(),
            topic:           s.topic,
            subject:         s.subject         || '',
            notes:           s.notes           || '',
            tags:            s.tags            || [],
            studied_date:    nextDate,
            reviews,
            ease_factor:     2.5,
            review_streak:   0,
            recurrence_rule: s.recurrence_rule,
            recurrence_id:   s.recurrence_id,
          });
          created++;
        }
        nextDate = nextRecurDate(nextDate, s.recurrence_rule);
        count++;
      }
    }
    return created;
  }

  // ── Response helpers ───────────────────────────────────────────────────────

  function resp(data, status = 200) {
    return {
      ok:     status >= 200 && status < 300,
      status,
      json:   () => Promise.resolve(data),
      headers: { get: () => null },
    };
  }

  // ── Main router ────────────────────────────────────────────────────────────

  async function handle(url, options = {}) {
    try {
      const method = (options.method || 'GET').toUpperCase();
      const body   = options.body ? JSON.parse(options.body) : {};
      const path   = url.split('?')[0].replace(/\/$/, '');

      // ── Auth stubs ──
      if (path === '/api/auth/me')
        return resp({ user: { id: 'local', email: 'local' } });
      if (path === '/api/auth/login' || path === '/api/auth/register')
        return resp({ token: 'local-token', user: { id: 'local', email: body.email || 'local' } });

      // ── Settings ──
      if (path === '/api/settings') {
        if (method === 'GET')
          return resp({ intervals: await getIntervals() });
        if (method === 'PUT') {
          const { intervals } = body;
          if (!Array.isArray(intervals) || intervals.some(n => !Number.isInteger(n) || n < 1))
            return resp({ error: 'intervals must be an array of positive integers' }, 400);
          await dbPut('settings', { key: 'local:intervals', value: intervals });
          return resp({ ok: true });
        }
      }

      // ── GET /api/sessions ──
      if (path === '/api/sessions' && method === 'GET') {
        const newRecurrences = await createRecurrences();
        const sessions = await dbGetAll('sessions');
        sessions.sort((a, b) => b.studied_date.localeCompare(a.studied_date));
        return resp({ sessions: sessions.map(toResponse), newRecurrences });
      }

      // ── POST /api/sessions ──
      if (path === '/api/sessions' && method === 'POST') {
        const { id, topic, studiedDate, notes, subject, tags, reviews, recurrenceRule, recurrenceId } = body;
        if (!id || !topic || !studiedDate || !Array.isArray(reviews))
          return resp({ error: 'Missing required fields' }, 400);
        await dbPut('sessions', {
          id, topic,
          studied_date:    studiedDate,
          notes:           notes   || '',
          subject:         subject || '',
          tags:            Array.isArray(tags) ? tags.map(t => String(t).trim()).filter(Boolean) : [],
          reviews,
          ease_factor:     2.5,
          review_streak:   0,
          recurrence_rule: recurrenceRule || null,
          recurrence_id:   recurrenceRule ? (recurrenceId || crypto.randomUUID()) : null,
        });
        return resp({ ok: true });
      }

      // ── PUT /api/sessions/:id ──
      const sessMatch = path.match(/^\/api\/sessions\/([^/]+)$/);
      if (sessMatch && method === 'PUT') {
        const s = await dbGet('sessions', sessMatch[1]);
        if (!s) return resp({ error: 'Not found' }, 404);
        if (!body.topic) return resp({ error: 'topic required' }, 400);
        await dbPut('sessions', {
          ...s,
          topic:   body.topic,
          subject: body.subject || '',
          notes:   body.notes   || '',
          tags:    Array.isArray(body.tags) ? body.tags.map(t => String(t).trim()).filter(Boolean) : [],
        });
        return resp({ ok: true });
      }

      // ── DELETE /api/sessions/:id ──
      if (sessMatch && method === 'DELETE') {
        await dbDel('sessions', sessMatch[1]);
        const links = await dbGetAll('links');
        for (const l of links) {
          if (l.from_id === sessMatch[1] || l.to_id === sessMatch[1])
            await dbDel('links', l.id);
        }
        return resp({ ok: true });
      }

      // ── PATCH /api/sessions/:id/reviews/:index ──
      const revMatch = path.match(/^\/api\/sessions\/([^/]+)\/reviews\/(\d+)$/);
      if (revMatch && method === 'PATCH') {
        const s = await dbGet('sessions', revMatch[1]);
        if (!s) return resp({ error: 'Session not found' }, 404);

        const idx     = parseInt(revMatch[2], 10);
        const reviews = Array.isArray(s.reviews) ? s.reviews.map(r => ({ ...r })) : [];
        if (idx < 0 || idx >= reviews.length) return resp({ error: 'Invalid index' }, 400);

        // Drag-to-reschedule
        if (body?.newDate) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(body.newDate))
            return resp({ error: 'Invalid date format' }, 400);
          reviews[idx].date = body.newDate;
          await dbPut('sessions', { ...s, reviews });
          return resp({ ok: true, reviews });
        }

        const done                = body?.done !== undefined ? Boolean(body.done) : true;
        const confidence          = body?.confidence ? parseInt(body.confidence, 10) : null;
        const rescheduleFromToday = Boolean(body?.rescheduleFromToday);

        reviews[idx].done = done;
        if (done && confidence)  reviews[idx].confidence = confidence;
        else if (!done)          delete reviews[idx].confidence;

        let easeFactor   = parseFloat(s.ease_factor)    || 2.5;
        let reviewStreak = parseInt(s.review_streak, 10) || 0;

        if (done && idx + 1 < reviews.length) {
          if (confidence) {
            const prevDate     = idx === 0 ? s.studied_date : reviews[idx - 1].date;
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

        await dbPut('sessions', { ...s, reviews, ease_factor: easeFactor, review_streak: reviewStreak });
        return resp({ ok: true, reviews, easeFactor, reviewStreak });
      }

      // ── GET /api/links ──
      if (path === '/api/links' && method === 'GET')
        return resp({ links: await dbGetAll('links') });

      // ── POST /api/links ──
      if (path === '/api/links' && method === 'POST') {
        const { fromId, toId, relation } = body;
        if (!fromId || !toId || fromId === toId)
          return resp({ error: 'Invalid link: fromId and toId required and must differ' }, 400);
        const links = await dbGetAll('links');
        if (links.some(l =>
          (l.from_id === fromId && l.to_id === toId) ||
          (l.from_id === toId   && l.to_id === fromId)
        )) return resp({ error: 'A link between these sessions already exists' }, 409);
        const valid = ['related', 'builds-on', 'prerequisite', 'see-also'];
        const id = crypto.randomUUID();
        await dbPut('links', {
          id,
          from_id:  fromId,
          to_id:    toId,
          relation: valid.includes(relation) ? relation : 'related',
        });
        return resp({ ok: true, id });
      }

      // ── DELETE /api/links/:id ──
      const linkMatch = path.match(/^\/api\/links\/([^/]+)$/);
      if (linkMatch && method === 'DELETE') {
        await dbDel('links', linkMatch[1]);
        return resp({ ok: true });
      }

      // ── GET /api/decks ──
      if (path === '/api/decks' && method === 'GET')
        return resp({ decks: await dbGetAll('decks') });

      // ── POST /api/decks ──
      if (path === '/api/decks' && method === 'POST') {
        const { id, sessionId, name, cards } = body;
        if (!id || !sessionId || !name || !Array.isArray(cards))
          return resp({ error: 'Missing required fields' }, 400);
        const sanitized = cards
          .map(c => ({ id: c.id || crypto.randomUUID(), front: String(c.front || '').trim(), back: String(c.back || '').trim() }))
          .filter(c => c.front || c.back);
        await dbPut('decks', { id, session_id: sessionId, name, cards: sanitized, created_at: new Date().toISOString() });
        return resp({ ok: true });
      }

      // ── PUT/DELETE /api/decks/:id ──
      const deckMatch = path.match(/^\/api\/decks\/([^/]+)$/);
      if (deckMatch && method === 'PUT') {
        const d = await dbGet('decks', deckMatch[1]);
        if (!d) return resp({ error: 'Not found' }, 404);
        const { name, cards } = body;
        if (!name || !Array.isArray(cards)) return resp({ error: 'name and cards required' }, 400);
        const sanitized = cards
          .map(c => ({ id: c.id || crypto.randomUUID(), front: String(c.front || '').trim(), back: String(c.back || '').trim() }))
          .filter(c => c.front || c.back);
        await dbPut('decks', { ...d, name, cards: sanitized });
        return resp({ ok: true });
      }
      if (deckMatch && method === 'DELETE') {
        await dbDel('decks', deckMatch[1]);
        return resp({ ok: true });
      }

      return resp({ error: `No handler for ${method} ${path}` }, 404);

    } catch (err) {
      console.error('[LocalAPI]', err);
      return resp({ error: 'Local database error: ' + (err?.message || err) }, 500);
    }
  }

  return { handle };
})();
