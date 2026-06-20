// ── Search ───────────────────────────────────────────────
  function focusSearch() {
    const input = document.getElementById('searchInput');
    input.classList.add('open');
    input.focus();
    input.select();
  }

  function clearSearch() {
    const input = document.getElementById('searchInput');
    searchQuery = '';
    input.value = '';
    input.classList.remove('open');
    document.getElementById('searchClear').classList.remove('show');
    document.getElementById('searchCount').classList.remove('show');
    renderCalendar();
  }

  function sessionMatchesSearch(s) {
    if (!searchQuery) return true;
    const q = searchQuery;
    return s.topic.toLowerCase().includes(q) ||
           (s.subject || '').toLowerCase().includes(q) ||
           (s.notes   || '').toLowerCase().includes(q) ||
           (s.tags    || []).some(t => t.toLowerCase().includes(q));
  }

  (() => {
    const input = document.getElementById('searchInput');
    input.addEventListener('input', e => {
      searchQuery = e.target.value.trim().toLowerCase();
      const hasQ  = searchQuery.length > 0;
      document.getElementById('searchClear').classList.toggle('show', hasQ);

      if (hasQ) {
        const count = sessions.filter(sessionMatchesSearch).length;
        const el    = document.getElementById('searchCount');
        el.textContent = count === 0 ? 'No matches' : count === 1 ? '1 match' : `${count} matches`;
        el.classList.add('show');
      } else {
        document.getElementById('searchCount').classList.remove('show');
      }
      renderCalendar();
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.stopPropagation(); clearSearch(); }
    });
  })();

  // ── Tag helpers ──────────────────────────────────────────

  function renderModalTagChips() {
    const wrap  = document.getElementById('tagInputWrap');
    const input = document.getElementById('tagChipInput');
    // Remove existing chips (all children except the input)
    Array.from(wrap.children).forEach(c => { if (c !== input) c.remove(); });
    editTags.forEach((tag, i) => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = `${tag}<button type="button" class="tag-chip-remove" title="Remove tag" onclick="removeEditTag(${i})">×</button>`;
      wrap.insertBefore(chip, input);
    });
  }

  function addEditTag(raw) {
    const tag = raw.trim().toLowerCase().replace(/[,#]/g, '').slice(0, 32);
    if (!tag || editTags.includes(tag)) return false;
    editTags.push(tag);
    renderModalTagChips();
    return true;
  }

  function removeEditTag(i) {
    editTags.splice(i, 1);
    renderModalTagChips();
    document.getElementById('tagChipInput').focus();
  }

  function resetEditTags(initial = []) {
    editTags = [...initial];
    renderModalTagChips();
    document.getElementById('tagChipInput').value = '';
  }

  function filterByTag(tag) {
    activeTagFilter = activeTagFilter === tag ? null : tag;
    renderTagFilterBar();
    renderCalendar();
  }

  function renderTagFilterBar() {
    const bar  = document.getElementById('tagFilterBar');
    bar.innerHTML = '';
    const allTags = [...new Set(sessions.flatMap(s => s.tags || []))].sort();
    if (!allTags.length) return;
    allTags.forEach(tag => {
      const pill = document.createElement('button');
      pill.className = 'tag-pill' + (activeTagFilter === tag ? ' active' : '');
      pill.innerHTML = `<span class="tag-pill-hash">#</span>${tag}`;
      pill.onclick = () => filterByTag(tag);
      bar.appendChild(pill);
    });
  }

  // Tag input IIFE
  (() => {
    const input = document.getElementById('tagChipInput');
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        if (addEditTag(input.value)) input.value = '';
      } else if (e.key === 'Backspace' && !input.value && editTags.length) {
        removeEditTag(editTags.length - 1);
      }
    });
    input.addEventListener('blur', () => {
      if (input.value.trim()) { addEditTag(input.value); input.value = ''; }
    });
    // prevent Enter from submitting the form when in the tag input
    input.addEventListener('keypress', e => { if (e.key === 'Enter') e.preventDefault(); });
  })();
