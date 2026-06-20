// ── API ──────────────────────────────────────────────────
  async function loadSessions() {
    const [sessRes, linksRes] = await Promise.all([
      authFetch('/api/sessions'),
      authFetch('/api/links')
    ]);
    const data      = await sessRes.json();
    const linksData = await linksRes.json();
    sessions = data.sessions;
    links    = linksData.links || [];
    if (data.newRecurrences > 0) {
      const n = data.newRecurrences;
      showToast(`🔁 ${n} recurring session${n > 1 ? 's' : ''} auto-logged`);
    }
  }

  async function loadSettings() {
    const res = await authFetch('/api/settings');
    const data = await res.json();
    intervals = data.intervals;
  }

  async function loadDecks() {
    try {
      const res  = await authFetch('/api/decks');
      const data = await res.json();
      decks = data.decks || [];
    } catch { decks = []; }
  }

  function getDeckForSession(sessionId) {
    return decks.find(d => d.session_id === sessionId) || null;
  }
