// ── Events for a date ────────────────────────────────────
  function getEventsForDate(dateStr) {
    const today  = todayStr();
    const events = [];
    sessions
      .filter(s => activeSubject === null || s.subject === activeSubject)
      .filter(s => activeTagFilter === null || (s.tags || []).includes(activeTagFilter))
      .filter(sessionMatchesSearch)
      .forEach(session => {
        if (session.studiedDate === dateStr)
          events.push({ type: 'study', session });
        session.reviews.forEach((rev, i) => {
          if (rev.date === dateStr)
            events.push({
              type: 'review', reviewIndex: i, session, done: rev.done,
              overdue: !rev.done && rev.date < today
            });
        });
      });
    return events;
  }

  // ── Streak ───────────────────────────────────────────────
  function calcStreak() {
    // count any day with a study session OR a completed review
    const activeDays = new Set();
    sessions.forEach(s => {
      activeDays.add(s.studiedDate);
      s.reviews.forEach(r => { if (r.done) activeDays.add(r.date); });
    });
    if (!activeDays.size) return 0;
    let streak = 0;
    const check = new Date(todayStr() + 'T00:00:00');
    while (true) {
      const s = ymd(check.getFullYear(), check.getMonth() + 1, check.getDate());
      if (activeDays.has(s)) { streak++; check.setDate(check.getDate() - 1); }
      else break;
    }
    return streak;
  }

  // ── Due Today panel ──────────────────────────────────────
  function renderDueToday() {
    const today    = todayStr();
    const overdue  = [];
    const dueToday = [];

    sessions.forEach(session => {
      session.reviews.forEach((rev, i) => {
        if (rev.done) return;
        if (rev.date < today)       overdue.push({ session, reviewIndex: i, date: rev.date });
        else if (rev.date === today) dueToday.push({ session, reviewIndex: i, date: rev.date });
      });
    });

    const container = document.getElementById('dueToday');
    if (!overdue.length && !dueToday.length) { container.innerHTML = ''; return; }

    container.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'due-today';

    // header label
    const parts = [];
    if (overdue.length)  parts.push(`<span style="color:#dc2626;font-weight:700">${overdue.length} overdue</span>`);
    if (dueToday.length) parts.push(`${dueToday.length} due today`);
    const totalCount = overdue.length + dueToday.length;

    const allPending = [
      ...overdue.map(x => ({ sessionId: x.session.id, reviewIdx: x.reviewIndex })),
      ...dueToday.map(x => ({ sessionId: x.session.id, reviewIdx: x.reviewIndex }))
    ];

    const header = document.createElement('div');
    header.className = 'due-today-header';
    header.innerHTML =
      `<div class="due-today-title">
        📋 ${parts.join(' · ')}
        <span class="due-count" style="${overdue.length ? 'background:#ef4444' : ''}">${totalCount}</span>
      </div>
      ${totalCount >= 2 ? `<button class="mark-all-btn" id="markAllBtn">✓ Mark all done</button>` : ''}
      <span class="due-toggle" id="dueTodayToggle">▲ hide</span>`;
    panel.appendChild(header);

    if (totalCount >= 2) {
      header.querySelector('#markAllBtn').addEventListener('click', e => {
        e.stopPropagation();
        markAllDone(allPending);
      });
    }

    const body = document.createElement('div');
    body.className = 'due-today-body';
    body.id = 'dueTodayBody';

    const makeItem = ({ session, reviewIndex, date }, isOverdue) => {
      const col  = getSubjectColor(session.subject);
      const item = document.createElement('div');
      item.className = 'due-item';
      if (isOverdue) item.style.borderColor = '#fecaca';

      const daysDiff = Math.round((new Date(today + 'T00:00:00') - new Date(date + 'T00:00:00')) / 86400000);
      const overdueLabel = isOverdue ? ` · ${daysDiff}d overdue` : '';

      item.innerHTML =
        `<div class="due-dot" style="background:${isOverdue ? '#ef4444' : col.border}"></div>
         <div class="due-info">
           <div class="due-topic">${session.topic}</div>
           <div class="due-meta">${session.subject ? session.subject + ' · ' : ''}${intervalLabel(intervals[reviewIndex] ?? reviewIndex)} review${overdueLabel}${session.reviewStreak >= 2 ? ` · <span class="streak-badge">🔥 ${session.reviewStreak}</span>` : ''}</div>
         </div>`;
      const reviewDeck = getDeckForSession(session.id);
      if (reviewDeck) {
        const practiceBtn = document.createElement('button');
        practiceBtn.className = 'practice-btn';
        practiceBtn.textContent = 'Practice';
        practiceBtn.title = `Practice flashcards (${reviewDeck.cards.length} cards)`;
        practiceBtn.onclick = () => openStudyModal(reviewDeck.id);
        item.appendChild(practiceBtn);
      }
      const btn = document.createElement('button');
      btn.className = 'due-done-btn';
      btn.textContent = 'Mark done';
      if (isOverdue) btn.style.borderColor = '#fca5a5';
      btn.onclick = () => openRatingModal(session.id, reviewIndex, null);
      item.appendChild(btn);
      return item;
    };

    // overdue first, then due today
    overdue.sort((a, b) => a.date.localeCompare(b.date))
      .forEach(item => body.appendChild(makeItem(item, true)));
    dueToday.forEach(item => body.appendChild(makeItem(item, false)));

    panel.appendChild(body);
    container.appendChild(panel);

    let collapsed = false;
    header.onclick = () => {
      collapsed = !collapsed;
      body.style.display = collapsed ? 'none' : '';
      document.getElementById('dueTodayToggle').textContent = collapsed ? '▼ show' : '▲ hide';
    };
  }

  // ── Filter bar ───────────────────────────────────────────
  function renderFilters() {
    renderTagFilterBar();
    const bar = document.getElementById('filterBar');
    bar.innerHTML = '';
    const subjects = [...new Set(sessions.map(s => s.subject).filter(Boolean))].sort();
    if (!subjects.length) return;

    const allPill = document.createElement('button');
    allPill.className = 'filter-pill' + (activeSubject === null ? ' active-all' : '');
    allPill.textContent = 'All';
    allPill.onclick = () => { activeSubject = null; renderCalendar(); };
    bar.appendChild(allPill);

    subjects.forEach(subj => {
      const col  = getSubjectColor(subj);
      const pill = document.createElement('button');
      pill.className = 'filter-pill';
      pill.textContent = subj;
      if (activeSubject === subj) {
        pill.style.background  = col.bg;
        pill.style.color       = col.text;
        pill.style.borderColor = col.border;
      }
      pill.onclick = () => { activeSubject = subj; renderCalendar(); };
      bar.appendChild(pill);
    });
  }

  // ── Legend ───────────────────────────────────────────────
  function renderLegend() {
    const leg = document.getElementById('legend');
    leg.innerHTML = '<div class="legend-item"><div class="legend-swatch" style="background:#6366f1"></div> Studied</div>';
    intervals.forEach((days, i) => {
      const col      = REVIEW_COLORS[i] || REVIEW_COLORS[REVIEW_COLORS.length - 1];
      const shortLbl = `+${days}d`;
      leg.innerHTML += `<div class="legend-item"><div class="legend-swatch" style="background:${col}"></div> Review ${i + 1} <span style="color:#94a3b8">(${shortLbl})</span></div>`;
    });
  }

  // ── Calendar render ──────────────────────────────────────
  function renderCalendar() {
    const isEmpty = sessions.length === 0;
    document.getElementById('emptyState').style.display = isEmpty ? '' : 'none';

    const grid = document.getElementById('calendarGrid');
    // Remove all data rows, keeping the header row
    Array.from(grid.querySelectorAll('.cal-row:not(:first-child)')).forEach(el => el.remove());
    document.getElementById('monthYear').textContent = `${MONTH_NAMES[currentMonth]} ${currentYear}`;

    const today    = todayStr();
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const dimMax   = new Date(currentYear, currentMonth + 1, 0).getDate();
    const prevDays = new Date(currentYear, currentMonth, 0).getDate();

    const prevM = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevY = currentMonth === 0 ? currentYear - 1 : currentYear;
    const nextM = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextY = currentMonth === 11 ? currentYear + 1 : currentYear;

    // Build flat cell list then arrange into row containers of 7
    const cells = [];
    for (let i = firstDay - 1; i >= 0; i--)
      cells.push(makeCell(prevDays - i, ymd(prevY, prevM + 1, prevDays - i), true, today));
    for (let d = 1; d <= dimMax; d++)
      cells.push(makeCell(d, ymd(currentYear, currentMonth + 1, d), false, today));
    const tail = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7);
    for (let d = 1; d <= tail; d++)
      cells.push(makeCell(d, ymd(nextY, nextM + 1, d), true, today));

    // today-column tint
    const todayCol = new Date().getDay();
    cells.forEach((cell, i) => { if (i % 7 === todayCol) cell.classList.add('today-col'); });

    // Append cells in rows of 7 — each row is its own flex container so
    // chip content in one row cannot push the SAT column out of view
    for (let r = 0; r < cells.length / 7; r++) {
      const row = document.createElement('div');
      row.className = 'cal-row';
      for (let c = 0; c < 7; c++) row.appendChild(cells[r * 7 + c]);
      grid.appendChild(row);
    }

    // empty-month watermark (appended to outer wrapper which has position:relative)
    const calGrid = document.getElementById('calendarOuter');
    const existing = document.getElementById('emptyMonthMsg');
    if (existing) existing.remove();
    const monthHasEvents = sessions
      .filter(s => activeSubject === null || s.subject === activeSubject)
      .some(s => {
        const inMonth = (d) => { const [y,m] = d.split('-'); return +y === currentYear && +m - 1 === currentMonth; };
        return inMonth(s.studiedDate) || s.reviews.some(r => inMonth(r.date));
      });
    if (!monthHasEvents) {
      const msg = document.createElement('div');
      msg.id = 'emptyMonthMsg';
      msg.className = 'empty-month';
      msg.innerHTML = '<span>Nothing studied this month</span>';
      calGrid.appendChild(msg);
    }

    renderFilters();
    renderDueToday();
    renderLegend();
    document.getElementById('streakBadge').textContent =
      calcStreak() > 0 ? `🔥 ${calcStreak()}-day streak` : 'No streak yet';
  }

  function makeCell(day, dateStr, other, today) {
    const cell = document.createElement('div');
    cell.className = 'day-cell' + (other ? ' other-month' : '') + (dateStr === today ? ' today' : '');
    cell.dataset.date = dateStr;
    cell.onclick = () => openDayModal(dateStr);

    // ── Drop target ──────────────────────────────────────────
    cell.addEventListener('dragover', evt => {
      if (!dragReview) return;
      evt.preventDefault();
      evt.dataTransfer.dropEffect = 'move';
      cell.classList.add('drag-over');
    });
    cell.addEventListener('dragleave', evt => {
      // only remove if leaving to outside the cell (not to a child)
      if (!cell.contains(evt.relatedTarget)) cell.classList.remove('drag-over');
    });
    cell.addEventListener('drop', async evt => {
      evt.preventDefault();
      cell.classList.remove('drag-over');
      if (!dragReview) return;
      const newDate = cell.dataset.date;
      if (newDate === dragReview.fromDate) return;
      const { sessionId, reviewIndex } = dragReview;
      dragReview = null;
      const res = await authFetch(`/api/sessions/${sessionId}/reviews/${reviewIndex}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newDate })
      });
      if (res.ok) {
        await loadSessions();
        renderCalendar();
        showToast(`Review rescheduled to ${displayDate(newDate)}`);
      }
    });

    const num = document.createElement('div');
    num.className = 'day-number';
    num.textContent = day;
    cell.appendChild(num);

    const evWrap = document.createElement('div');
    evWrap.className = 'events';
    const evs = getEventsForDate(dateStr);

    evs.slice(0, 3).forEach((ev, i) => {
      const e = document.createElement('div');
      if (ev.type === 'study') {
        const col = getSubjectColor(ev.session.subject);
        e.className = 'event';
        e.style.background = col.bg;
        e.style.color = col.text;
        e.style.borderLeft = `3px solid ${col.border}`;
      } else if (ev.overdue) {
        e.className = 'event overdue';
      } else {
        const idx = Math.min(ev.reviewIndex, REVIEW_COLORS.length - 1);
        e.className = `event review-${idx}${ev.done ? ' done' : ''}`;
      }
      e.style.animationDelay = `${i * 30}ms`;
      const isRecurring = !!ev.session.recurrenceRule;
      if (isRecurring) e.classList.add('recurring');
      const topicLabel = ev.type === 'study' ? ev.session.topic : `↻ ${ev.session.topic}`;
      if (getDeckForSession(ev.session.id)) {
        e.classList.add('has-deck');
        e.innerHTML = `<span class="chip-text">${topicLabel}</span><span class="deck-chip-dot" title="Has flashcards"></span>`;
      } else {
        e.textContent = topicLabel;
      }

      // ── Draggable review chips (undone only) ─────────────
      if (ev.type === 'review' && !ev.done) {
        e.draggable = true;
        e.classList.add('draggable-review');
        e.addEventListener('dragstart', evt => {
          dragReview = { sessionId: ev.session.id, reviewIndex: ev.reviewIndex, fromDate: dateStr };
          evt.dataTransfer.effectAllowed = 'move';
          evt.dataTransfer.setData('text/plain', dateStr);
          evt.stopPropagation();
          // use setTimeout so the "dragging" class is applied after the drag image is captured
          setTimeout(() => e.classList.add('dragging'), 0);
        });
        e.addEventListener('dragend', () => {
          e.classList.remove('dragging');
          // clean up any lingering drag-over highlights
          document.querySelectorAll('.day-cell.drag-over').forEach(c => c.classList.remove('drag-over'));
          dragReview = null;
        });
      }

      evWrap.appendChild(e);
    });

    if (evs.length > 3) {
      const more = document.createElement('div');
      more.className = 'more-events';
      more.textContent = `+${evs.length - 3} more`;
      evWrap.appendChild(more);
    }

    cell.appendChild(evWrap);
    return cell;
  }
