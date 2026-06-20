// ── Flashcard Deck System ────────────────────────────────

  function openDeckPrompt(sessionId, topic) {
    document.getElementById('deckPromptTopic').textContent = `"${topic}"`;
    document.getElementById('deckPromptModal')._pendingSession = { id: sessionId, topic };
    document.getElementById('deckPromptModal').classList.add('active');
  }

  function closeDeckPrompt() {
    document.getElementById('deckPromptModal').classList.remove('active');
  }

  function _pendingDeckSession() {
    return document.getElementById('deckPromptModal')._pendingSession || null;
  }

  function openDeckEditorNew() {
    const pending = _pendingDeckSession();
    if (!pending) return;
    closeDeckPrompt();
    _initDeckEditor(null, pending.id, pending.topic, 'create');
  }

  function openDeckImportNew() {
    const pending = _pendingDeckSession();
    if (!pending) return;
    closeDeckPrompt();
    _initDeckEditor(null, pending.id, pending.topic, 'import');
  }

  function openDeckEditorForSession(sessionId, topic) {
    _initDeckEditor(null, sessionId, topic, 'create');
  }

  function _initDeckEditor(deckId, sessionId, topic, tab) {
    if (deckId) {
      const deck = decks.find(d => d.id === deckId);
      if (!deck) return;
      editingDeckId = deckId;
      deckEditorSession = { id: deck.session_id, topic: deck.name };
      deckEditorCards = deck.cards.map(c => ({
        _tempId: Date.now() + '-' + Math.floor(Math.random() * 9999),
        id: c.id, front: c.front, back: c.back
      }));
      document.getElementById('deckNameInput').value = deck.name;
      document.getElementById('deckModalTitle').textContent = 'Edit Flashcard Deck';
      document.getElementById('deckModalSubtitle').textContent = '';
    } else {
      editingDeckId = null;
      deckEditorSession = { id: sessionId, topic };
      deckEditorCards = [];
      document.getElementById('deckNameInput').value = topic;
      document.getElementById('deckModalTitle').textContent = deckId ? 'Edit Flashcard Deck' : 'Create Flashcard Deck';
      document.getElementById('deckModalSubtitle').textContent = '';
    }
    importedParsedCards = [];
    document.getElementById('importPreview').innerHTML = '';
    document.getElementById('importTextarea').value = '';
    document.getElementById('fileImportStatus').textContent = '';
    document.getElementById('exportDeckBtn').style.display = deckId ? '' : 'none';
    document.getElementById('deleteDeckBtn').style.display = deckId ? '' : 'none';
    switchDeckTab(tab || 'create');
    renderCardList();
    document.getElementById('deckModal').classList.add('active');
    if (!deckId && tab !== 'import') {
      setTimeout(() => { if (!deckEditorCards.length) addCardRow(); }, 150);
    }
  }

  function closeDeckModal() {
    document.getElementById('deckModal').classList.remove('active');
    editingDeckId = null;
    deckEditorSession = null;
    deckEditorCards = [];
    importedParsedCards = [];
  }

  function editCurrentDeck() {
    if (!studyState) return;
    const deckId = studyState.deckId;
    closeStudyModal();
    _initDeckEditor(deckId, null, null, 'create');
  }

  function switchDeckTab(tab) {
    const isCreate = tab === 'create';
    document.getElementById('deckCreatePane').style.display = isCreate ? '' : 'none';
    document.getElementById('deckImportPane').style.display = isCreate ? 'none' : '';
    document.getElementById('tabCreate').classList.toggle('active', isCreate);
    document.getElementById('tabImport').classList.toggle('active', !isCreate);
  }

  function addCardRow(front = '', back = '') {
    deckEditorCards.push({
      _tempId: Date.now() + '-' + Math.floor(Math.random() * 9999),
      id: crypto.randomUUID(),
      front, back
    });
    renderCardList();
    const list = document.getElementById('cardList');
    list.scrollTop = list.scrollHeight;
    setTimeout(() => {
      const inputs = document.querySelectorAll('#cardList .card-front');
      inputs[inputs.length - 1]?.focus();
    }, 20);
  }

  function renderCardList() {
    const list = document.getElementById('cardList');
    list.innerHTML = '';
    deckEditorCards.forEach((card, i) => {
      const row = document.createElement('div');
      row.className = 'card-row';

      const num = document.createElement('span');
      num.className = 'card-num';
      num.textContent = i + 1;

      const buildCardSide = (side) => {
        const val = card[side];
        const wrap = document.createElement('div');
        wrap.className = 'card-side-wrap';

        if (val && val.startsWith('data:image/')) {
          const thumb = document.createElement('img');
          thumb.src = val;
          thumb.className = 'card-img-thumb';

          const rmBtn = document.createElement('button');
          rmBtn.className = 'card-img-remove';
          rmBtn.title = 'Remove image';
          rmBtn.textContent = '×';
          rmBtn.onclick = () => { card[side] = ''; renderCardList(); updateDeckCardCount(); };

          wrap.append(thumb, rmBtn);
        } else {
          const input = document.createElement('input');
          input.className = side === 'front' ? 'card-front' : 'card-back';
          input.type = 'text';
          input.placeholder = side === 'front' ? 'Front — question' : 'Back — answer';
          input.value = val;
          input.oninput = () => { card[side] = input.value; updateDeckCardCount(); };

          if (side === 'back') {
            input.onkeydown = e => {
              if (e.key === 'Tab' && !e.shiftKey && i === deckEditorCards.length - 1) {
                e.preventDefault();
                addCardRow();
              }
            };
          }

          input.addEventListener('paste', e => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
              if (item.type.startsWith('image/')) {
                e.preventDefault();
                const reader = new FileReader();
                reader.onload = ev => { card[side] = ev.target.result; renderCardList(); updateDeckCardCount(); };
                reader.readAsDataURL(item.getAsFile());
                return;
              }
            }
          });

          const fileInput = document.createElement('input');
          fileInput.type = 'file';
          fileInput.accept = 'image/*';
          fileInput.style.display = 'none';
          fileInput.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => { card[side] = ev.target.result; renderCardList(); updateDeckCardCount(); };
            reader.readAsDataURL(file);
          };

          const imgBtn = document.createElement('label');
          imgBtn.className = 'card-img-btn';
          imgBtn.title = 'Add image';
          imgBtn.textContent = '📷';
          imgBtn.appendChild(fileInput);

          wrap.append(input, imgBtn);
        }
        return wrap;
      };

      const del = document.createElement('button');
      del.className = 'card-del';
      del.title = 'Remove card';
      del.textContent = '×';
      del.onclick = () => {
        deckEditorCards = deckEditorCards.filter(c => c._tempId !== card._tempId);
        renderCardList();
      };

      row.append(num, buildCardSide('front'), buildCardSide('back'), del);
      list.appendChild(row);
    });
    updateDeckCardCount();
  }

  function updateDeckCardCount() {
    const valid = collectDeckCards().length;
    const el = document.getElementById('deckCardCount');
    if (el) el.textContent = valid ? `${valid} card${valid !== 1 ? 's' : ''}` : '';
  }

  function sortCardsByDifficulty() {
    deckEditorCards.sort((a, b) => {
      const avg = c => c.scores?.length
        ? c.scores.reduce((s,x) => s+x, 0) / c.scores.length : 0;
      return avg(a) - avg(b);
    });
    renderCardList();
    showToast('Sorted hardest first');
  }

  function collectDeckCards() {
    return deckEditorCards
      .filter(c => c.front.trim() || c.back.trim())
      .map(c => ({ id: c.id || crypto.randomUUID(), front: c.front.trim(), back: c.back.trim() }));
  }

  function renderImportPreview() {
    const preview = document.getElementById('importPreview');
    preview.innerHTML = '';
    if (!importedParsedCards.length) {
      const msg = document.createElement('p');
      msg.style.cssText = 'font-size:13px;color:var(--tx-3);margin:8px 0';
      msg.textContent = 'No cards found. Use "Question | Answer" format, one per line.';
      preview.appendChild(msg);
      return;
    }
    const shown = importedParsedCards.slice(0, 5);
    const more  = importedParsedCards.length - shown.length;

    const count = document.createElement('p');
    count.style.cssText = 'font-size:13px;font-weight:500;color:var(--accent);margin:8px 0';
    count.textContent = `${importedParsedCards.length} card${importedParsedCards.length !== 1 ? 's' : ''} found`;

    const listEl = document.createElement('div');
    listEl.style.cssText = 'font-size:12px;background:var(--surface-2);border-radius:var(--r-sm);padding:8px;margin-bottom:10px';
    shown.forEach(c => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;padding:3px 0;border-bottom:1px solid var(--border-soft)';
      const f = document.createElement('span');
      f.style.cssText = 'flex:1;font-weight:500;color:var(--tx);overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      f.textContent = c.front;
      const sep = document.createElement('span');
      sep.style.cssText = 'color:var(--tx-3)';
      sep.textContent = '→';
      const b = document.createElement('span');
      b.style.cssText = 'flex:1;color:var(--tx-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      b.textContent = c.back;
      row.append(f, sep, b);
      listEl.appendChild(row);
    });
    if (more > 0) {
      const moreEl = document.createElement('div');
      moreEl.style.cssText = 'font-size:11px;color:var(--tx-3);padding-top:4px';
      moreEl.textContent = `+${more} more…`;
      listEl.appendChild(moreEl);
    }

    const addBtn = document.createElement('button');
    addBtn.className = 'btn-save';
    addBtn.style.width = '100%';
    addBtn.textContent = `Add ${importedParsedCards.length} card${importedParsedCards.length !== 1 ? 's' : ''} to deck`;
    addBtn.onclick = addImportedCards;

    preview.append(count, listEl, addBtn);
  }

  function addImportedCards() {
    if (!importedParsedCards.length) return;
    importedParsedCards.forEach(c => {
      deckEditorCards.push({
        _tempId: Date.now() + '-' + Math.floor(Math.random() * 9999),
        id: crypto.randomUUID(),
        front: c.front, back: c.back
      });
    });
    importedParsedCards = [];
    switchDeckTab('create');
    renderCardList();
    document.getElementById('importTextarea').value = '';
    document.getElementById('importPreview').innerHTML = '';
    const list = document.getElementById('cardList');
    list.scrollTop = list.scrollHeight;
  }

  // ── File import ──────────────────────────────────────────

  function setFileImportStatus(msg, isError = false) {
    const el = document.getElementById('fileImportStatus');
    if (!el) return;
    el.textContent = msg;
    el.style.color = isError ? '#ef4444' : 'var(--tx-3)';
  }

  async function handleApkgFile(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;

    setFileImportStatus(`Uploading "${file.name}"…`);
    try {
      const arrayBuf = await file.arrayBuffer();
      const res  = await authFetch('/api/decks/parse-apkg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: arrayBuf
      });
      const data = await res.json();
      if (!res.ok) { setFileImportStatus(data.error || 'Failed to parse .apkg', true); return; }
      importedParsedCards = data.cards;
      setFileImportStatus(`Parsed "${file.name}" — ${data.cards.length} card${data.cards.length !== 1 ? 's' : ''} found`);
      renderImportPreview();
    } catch {
      setFileImportStatus('Error reading file — check console', true);
    }
  }

  async function handleTxtFile(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;

    setFileImportStatus(`Reading "${file.name}"…`);
    try {
      const text = await file.text();
      importedParsedCards = parseCardText(text);
      setFileImportStatus(`Parsed "${file.name}" — ${importedParsedCards.length} card${importedParsedCards.length !== 1 ? 's' : ''} found`);
      renderImportPreview();
    } catch {
      setFileImportStatus('Error reading file', true);
    }
  }

  function parseCardText(text) {
    const results = [];
    text.split('\n').forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      // Tab-separated (Anki export format)
      const tab = line.indexOf('\t');
      if (tab >= 0) {
        const front = line.slice(0, tab).trim();
        const back  = line.slice(tab + 1).trim();
        if (front || back) { results.push({ front, back }); return; }
      }
      // Pipe-separated
      const pipe = line.indexOf('|');
      if (pipe >= 0) {
        const front = line.slice(0, pipe).trim();
        const back  = line.slice(pipe + 1).trim();
        if (front || back) { results.push({ front, back }); return; }
      }
      // Comma-separated (simple CSV — no quoted fields)
      const comma = line.indexOf(',');
      if (comma >= 0) {
        const front = line.slice(0, comma).trim();
        const back  = line.slice(comma + 1).trim();
        if (front || back) results.push({ front, back });
      }
    });
    return results;
  }

  function parseImport() {
    const text = document.getElementById('importTextarea').value;
    importedParsedCards = parseCardText(text);
    renderImportPreview();
  }

  // ── Deck export ──────────────────────────────────────────

  function exportDeck(deckId) {
    const deck = decks.find(d => d.id === deckId);
    if (!deck || !deck.cards.length) { showToast('No cards to export'); return; }
    const tsv  = deck.cards.map(c => `${c.front}\t${c.back}`).join('\n');
    const blob = new Blob([tsv], { type: 'text/tab-separated-values;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = deck.name.replace(/[^a-z0-9\-_ ]/gi, '_') + '.tsv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported "${deck.name}" — ${deck.cards.length} cards (.tsv, Anki-compatible)`);
  }

  function exportEditorDeck() {
    if (editingDeckId) exportDeck(editingDeckId);
  }

  function exportStudyDeck() {
    if (studyState) exportDeck(studyState.deckId);
  }

  async function deleteDeck() {
    if (!editingDeckId) return;
    const deck = decks.find(d => d.id === editingDeckId);
    if (!confirm(`Delete "${deck.name}"? This cannot be undone.`)) return;
    try {
      await authFetch(`/api/decks/${editingDeckId}`, { method: 'DELETE' });
      decks = decks.filter(d => d.id !== editingDeckId);
      closeDeckModal();
      showToast('Deck deleted');
    } catch {
      showToast('Error deleting deck');
    }
  }

  async function saveDeck() {
    const name  = document.getElementById('deckNameInput').value.trim();
    if (!name) { document.getElementById('deckNameInput').focus(); return; }
    const cards = collectDeckCards();
    if (!cards.length) { showToast('Add at least one card'); return; }

    const btn = document.getElementById('saveDeckBtn');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
      if (editingDeckId) {
        await authFetch(`/api/decks/${editingDeckId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, cards })
        });
        const d = decks.find(x => x.id === editingDeckId);
        if (d) { d.name = name; d.cards = cards; }
        showToast(`Deck updated — ${cards.length} card${cards.length !== 1 ? 's' : ''}`);
      } else {
        const id = crypto.randomUUID();
        await authFetch('/api/decks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, sessionId: deckEditorSession.id, name, cards })
        });
        decks.push({ id, session_id: deckEditorSession.id, name, cards, created_at: new Date().toISOString() });
        showToast(`Deck saved — ${cards.length} card${cards.length !== 1 ? 's' : ''}`);
      }
      closeDeckModal();
    } catch {
      showToast('Error saving deck — is the server running?');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Deck';
    }
  }

  // ── Flashcard Study Mode ─────────────────────────────────

  function openStudyModal(deckId, opts = {}) {
    const deck = decks.find(d => d.id === deckId);
    if (!deck || !deck.cards.length) { showToast('This deck has no cards yet'); return; }
    const weakOnly = !!opts.weakOnly;
    let cards = [...deck.cards];
    if (opts.requeueIds && opts.requeueIds.length) {
      const idSet = new Set(opts.requeueIds);
      cards = cards.filter(c => idSet.has(c.id));
      if (!cards.length) { showToast('No cards to re-study'); return; }
    } else if (weakOnly) {
      cards = cards.filter(c => { const a = getCardAvg(c); return a === null || a < 3; });
      if (!cards.length) { showToast('No weak cards yet — great job!'); return; }
    }
    studyState = { deckId, cards, idx: 0, flipped: false, seen: new Set(), sessionScores: new Map(), dirty: false, weakOnly };
    document.getElementById('studyTitle').textContent = deck.name;
    const label = weakOnly ? `${cards.length} weak card${cards.length !== 1 ? 's' : ''}` : `${deck.cards.length} card${deck.cards.length !== 1 ? 's' : ''}`;
    document.getElementById('studySubtitle').textContent = label;
    document.getElementById('studyComplete').style.display = 'none';
    document.getElementById('fcWrap').style.display = '';
    document.getElementById('fcHint').style.display = '';
    document.querySelector('.fc-controls').style.display = '';
    document.getElementById('fcReveal').style.display = '';
    document.getElementById('fcRating').style.display = 'none';
    document.getElementById('studyCompleteBreakdown').innerHTML = '';
    const weakBtn = document.getElementById('fcWeakBtn');
    if (weakBtn) weakBtn.classList.toggle('active', weakOnly);
    document.getElementById('studyModal').classList.add('active');
    renderStudyCard();
  }

  function closeStudyModal() {
    if (window.speechSynthesis) speechSynthesis.cancel();
    if (studyState && studyState.dirty) saveCardScores();
    document.getElementById('studyModal').classList.remove('active');
    document.getElementById('studyComplete').style.display = 'none';
    document.getElementById('fcWrap').style.display = '';
    document.getElementById('fcHint').style.display = '';
    document.querySelector('.fc-controls').style.display = '';
    document.getElementById('fcReveal').style.display = '';
    document.getElementById('fcRating').style.display = 'none';
    const weakBtn = document.getElementById('fcWeakBtn');
    if (weakBtn) weakBtn.classList.remove('active');
    studyState = null;
  }

  function showStudyComplete() {
    if (!studyState) return;
    const { cards, seen, sessionScores, deckId } = studyState;
    const ratedCount = sessionScores.size;
    const total = cards.length;
    document.getElementById('studyCompleteLabel').textContent = ratedCount === total
      ? 'All cards reviewed!' : 'Session complete';
    document.getElementById('studyCompleteScore').textContent =
      `${ratedCount} of ${total} card${total !== 1 ? 's' : ''} rated`;

    // Breakdown pills
    if (ratedCount > 0) {
      const counts = [0,0,0,0,0];
      sessionScores.forEach(s => counts[s-1]++);
      document.getElementById('studyCompleteBreakdown').innerHTML =
        RATINGS.map((r, i) => counts[i]
          ? `<span class="complete-rating-pill" style="--rc:${r.color};--rbg:${r.bg}">${r.emoji} ${counts[i]}</span>`
          : ''
        ).join('');
    }

    // Re-queue weak cards button
    const prevRequeue = document.getElementById('requeueBtn');
    if (prevRequeue) prevRequeue.remove();
    const weakIds = [];
    sessionScores.forEach((score, cardId) => { if (score < 3) weakIds.push(cardId); });
    if (weakIds.length > 0) {
      const actions = document.querySelector('#studyComplete .study-complete-actions');
      const reqBtn = document.createElement('button');
      reqBtn.id = 'requeueBtn';
      reqBtn.className = 'btn-ghost requeue-btn';
      reqBtn.textContent = `↻ Re-study ${weakIds.length} weak card${weakIds.length !== 1 ? 's' : ''}`;
      const capturedDeckId = deckId;
      const capturedIds = [...weakIds];
      reqBtn.onclick = () => { closeStudyModal(); openStudyModal(capturedDeckId, { requeueIds: capturedIds }); };
      actions.insertBefore(reqBtn, actions.firstChild);
    }

    document.getElementById('fcWrap').style.display = 'none';
    document.getElementById('fcHint').style.display = 'none';
    document.querySelector('.fc-controls').style.display = 'none';
    document.getElementById('fcRating').style.display = 'none';
    document.getElementById('studyComplete').style.display = 'flex';
    if (studyState.dirty) saveCardScores();
  }

  function restartFromComplete() {
    if (!studyState) return;
    const prevRequeue = document.getElementById('requeueBtn');
    if (prevRequeue) prevRequeue.remove();
    studyState.idx = 0;
    studyState.flipped = false;
    studyState.seen = new Set();
    studyState.sessionScores = new Map();
    document.getElementById('studyComplete').style.display = 'none';
    document.getElementById('studyCompleteBreakdown').innerHTML = '';
    document.getElementById('fcWrap').style.display = '';
    document.getElementById('fcHint').style.display = '';
    document.querySelector('.fc-controls').style.display = '';
    document.getElementById('fcReveal').style.display = '';
    document.getElementById('fcRating').style.display = 'none';
    renderStudyCard();
  }

  function renderStudyCard() {
    if (!studyState) return;
    const { cards, idx, flipped } = studyState;
    const card = cards[idx];

    document.getElementById('fcProgress').textContent = `${idx + 1} / ${cards.length}`;

    // Card faces with markdown, image, and TTS support
    const buildFace = (el, text) => {
      el.innerHTML = '';
      if (text && text.startsWith('data:image/')) {
        const img = document.createElement('img');
        img.src = text;
        img.className = 'fc-card-image';
        el.appendChild(img);
      } else {
        el.innerHTML = renderMarkdown(text || '');
        if (window.speechSynthesis) {
          const btn = document.createElement('button');
          btn.className = 'tts-btn';
          btn.title = 'Read aloud';
          btn.innerHTML = '🔊';
          btn.onclick = e => { e.stopPropagation(); speakText(text); };
          el.appendChild(btn);
        }
      }
    };
    buildFace(document.getElementById('fcFront'), card.front);
    buildFace(document.getElementById('fcBack'), card.back);
    document.getElementById('fcCard').classList.toggle('flipped', flipped);
    document.getElementById('fcPrev').disabled = idx === 0;

    // Difficulty dot
    const avg = getCardAvg(card);
    const dotEl = document.getElementById('fcDiffDot');
    if (avg !== null) {
      dotEl.style.cssText = `background:${cardDifficultyColor(avg)};display:inline-block`;
      dotEl.title = `Avg score: ${avg.toFixed(1)}`;
    } else {
      dotEl.style.display = 'none';
    }

    const revealBtn = document.getElementById('fcReveal');
    const ratingEl  = document.getElementById('fcRating');
    const hintEl    = document.getElementById('fcHint');

    if (flipped) {
      revealBtn.style.display = 'none';
      hintEl.textContent = 'How well did you know this? (keys 1–5)';
      ratingEl.style.display = 'flex';
      ratingEl.innerHTML = RATINGS.map(r =>
        `<button class="fc-rating-btn" style="--rc:${r.color};--rbg:${r.bg}" onclick="rateCard(${r.score})" title="${r.label} (${r.score})">
          <span class="fc-rating-emoji">${r.emoji}</span>
          <span class="fc-rating-label">${r.label}</span>
        </button>`
      ).join('');
    } else {
      revealBtn.style.display = '';
      hintEl.textContent = 'Click card to reveal answer';
      ratingEl.style.display = 'none';
      ratingEl.innerHTML = '';
    }
  }

  function flipCard() {
    if (!studyState) return;
    if (window.speechSynthesis) speechSynthesis.cancel();
    studyState.flipped = !studyState.flipped;
    if (studyState.flipped) studyState.seen.add(studyState.idx);
    renderStudyCard();
  }

  function nextCard() {
    if (!studyState) return;
    if (studyState.idx === studyState.cards.length - 1) {
      showStudyComplete();
      return;
    }
    studyState.idx++;
    studyState.flipped = false;
    renderStudyCard();
  }

  function prevCard() {
    if (!studyState || studyState.idx === 0) return;
    studyState.idx--;
    studyState.flipped = false;
    renderStudyCard();
  }

  function shuffleDeck() {
    if (!studyState) return;
    for (let i = studyState.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [studyState.cards[i], studyState.cards[j]] = [studyState.cards[j], studyState.cards[i]];
    }
    studyState.idx = 0;
    studyState.flipped = false;
    renderStudyCard();
    showToast('Cards shuffled');
  }

  function restartDeck() {
    if (!studyState) return;
    studyState.idx = 0;
    studyState.flipped = false;
    renderStudyCard();
  }

  // ── Per-card rating ──────────────────────────────────────
  function rateCard(score) {
    if (!studyState) return;
    const { cards, idx } = studyState;
    const card = cards[idx];

    // studyState.cards is a shallow-copy of deck.cards — same object references,
    // so mutating card here automatically updates deck.cards too.
    if (!card.scores) card.scores = [];
    card.scores.push(score);
    studyState.seen.add(idx);
    studyState.sessionScores.set(card.id, score);
    studyState.dirty = true;

    if (idx === cards.length - 1) {
      showStudyComplete();
    } else {
      studyState.idx++;
      studyState.flipped = false;
      renderStudyCard();
    }
  }

  async function saveCardScores() {
    if (!studyState) return;
    const deck = decks.find(d => d.id === studyState.deckId);
    if (!deck) return;
    studyState.dirty = false;
    try {
      await authFetch(`/api/decks/${deck.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: deck.name, cards: deck.cards })
      });
    } catch { /* scores stay in memory even if save fails */ }
  }

  function toggleWeakFilter() {
    if (!studyState) return;
    const { deckId, weakOnly, dirty } = studyState;
    if (dirty) saveCardScores();
    closeStudyModal();
    openStudyModal(deckId, { weakOnly: !weakOnly });
  }

  // ── Card Search ──────────────────────────────────────────
  function openCardSearch() {
    document.getElementById('cardSearchModal').classList.add('active');
    const inp = document.getElementById('cardSearchInput');
    inp.value = '';
    inp.focus();
    document.getElementById('cardSearchResults').innerHTML = '';
  }

  function closeCardSearch() {
    document.getElementById('cardSearchModal').classList.remove('active');
  }

  function searchCards() {
    const q = document.getElementById('cardSearchInput').value.toLowerCase().trim();
    const el = document.getElementById('cardSearchResults');
    if (!q) { el.innerHTML = ''; return; }

    const hits = [];
    decks.forEach(deck => {
      deck.cards.forEach(card => {
        if (card.front.toLowerCase().includes(q) || card.back.toLowerCase().includes(q)) {
          hits.push({ deck, card });
        }
      });
    });

    if (!hits.length) {
      el.innerHTML = '<div class="card-search-empty">No cards found</div>';
      return;
    }

    el.innerHTML = hits.slice(0, 60).map(({ deck, card }) => {
      const avg = getCardAvg(card);
      const dc  = cardDifficultyColor(avg);
      const dotTitle = avg !== null ? `Avg: ${avg.toFixed(1)}` : 'Unrated';
      return `<div class="card-search-result" onclick="jumpToCard('${deck.id}','${card.id}')">
        <div class="csr-header">
          <span class="csr-deck">${escHtml(deck.name)}</span>
          <span class="csr-dot" style="background:${dc}" title="${dotTitle}"></span>
        </div>
        <div class="csr-front">${hlMatch(card.front, q)}</div>
        <div class="csr-back">${hlMatch(card.back, q)}</div>
      </div>`;
    }).join('');
  }

  function hlMatch(text, q) {
    const i = text.toLowerCase().indexOf(q);
    if (i < 0) return escHtml(text);
    return escHtml(text.slice(0, i))
      + `<mark>${escHtml(text.slice(i, i + q.length))}</mark>`
      + escHtml(text.slice(i + q.length));
  }

  function jumpToCard(deckId, cardId) {
    closeCardSearch();
    openStudyModal(deckId);
    requestAnimationFrame(() => {
      if (!studyState) return;
      const idx = studyState.cards.findIndex(c => c.id === cardId);
      if (idx >= 0) { studyState.idx = idx; studyState.flipped = false; renderStudyCard(); }
    });
  }

  // ── Confidence Rating Modal ──────────────────────────────
  function openRatingModal(sessionId, reviewIdx, dateStr) {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const review  = session.reviews[reviewIdx];

    // Check if late
    const today     = todayStr();
    const isLate    = review.date < today;
    const daysMissed = isLate
      ? Math.round((new Date(today + 'T00:00:00') - new Date(review.date + 'T00:00:00')) / 86400000)
      : 0;
    const hasNext = reviewIdx + 1 < session.reviews.length;

    pendingRating = { sessionId, reviewIdx, dateStr };

    // Subtitle
    const reviewNum = reviewIdx + 1;
    document.getElementById('ratingSubtitle').textContent =
      `Review ${reviewNum} of 5 — "${session.topic}"`;

    // Late recovery row
    const lateRow = document.getElementById('lateRecoveryRow');
    if (isLate && hasNext) {
      lateRow.style.display = '';
      document.getElementById('lateRecoveryText').textContent =
        `Reschedule next review from today (was ${daysMissed} day${daysMissed !== 1 ? 's' : ''} late)`;
    } else {
      lateRow.style.display = 'none';
    }

    // Build rating buttons
    const grid = document.getElementById('ratingGrid');
    grid.innerHTML = '';
    RATINGS.forEach(r => {
      const btn = document.createElement('button');
      btn.className = 'rating-btn';
      btn.style.cssText = `color:${r.color};`;
      btn.innerHTML = `<span class="rating-emoji">${r.emoji}</span><span class="rating-label">${r.label}</span>`;
      btn.onclick = () => submitRating(r.score);
      grid.appendChild(btn);
    });

    document.getElementById('ratingModal').classList.add('active');
  }

  function closeRatingModal() {
    document.getElementById('ratingModal').classList.remove('active');
    pendingRating = null;
  }

  async function submitRating(confidence) {
    if (!pendingRating) return;
    const { sessionId, reviewIdx, dateStr } = pendingRating;
    const rescheduleFromToday = document.getElementById('rescheduleCheck')?.checked ?? false;
    closeRatingModal();
    await markDone(sessionId, reviewIdx, dateStr, true, confidence, rescheduleFromToday);
  }

  async function skipRating() {
    if (!pendingRating) return;
    const { sessionId, reviewIdx, dateStr } = pendingRating;
    const rescheduleFromToday = document.getElementById('rescheduleCheck')?.checked ?? false;
    closeRatingModal();
    await markDone(sessionId, reviewIdx, dateStr, true, null, rescheduleFromToday);
  }

  async function deleteSession(sessionId, dateStr) {
    if (!confirm('Delete this study session and all its scheduled reviews?')) return;
    await authFetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
    sessions = sessions.filter(s => s.id !== sessionId);
    renderCalendar();
    openDayModal(dateStr);
    showToast('Session deleted.');
  }
