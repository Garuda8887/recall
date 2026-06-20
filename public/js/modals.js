// ── Add Modal ────────────────────────────────────────────
  function openAddModal() { openAddModalForDate(todayStr()); }

  function openEditModal(session) {
    closeDayModal();
    editingSessionId = session.id;
    document.querySelector('#addModal h3').textContent = 'Edit Session';
    document.getElementById('dateInput').value    = session.studiedDate;
    document.getElementById('dateInput').disabled = true;
    document.getElementById('topicInput').value   = session.topic;
    document.getElementById('subjectInput').value = session.subject || '';
    document.getElementById('notesInput').value   = session.notes || '';
    resetEditTags(session.tags || []);
    document.getElementById('saveBtn').textContent = 'Save Changes';
    buildReviewChips(session.studiedDate);
    // hide review preview and recurrence on edit
    document.querySelector('.review-preview').style.display = 'none';
    document.getElementById('recurGroup').style.display = 'none';
    document.getElementById('addModal').classList.add('active');
    setTimeout(() => document.getElementById('topicInput').focus(), 220);
  }

  function openAddModalForDate(dateStr) {
    closeDayModal();
    editingSessionId  = null;
    addModalTargetDate = dateStr;
    document.querySelector('#addModal h3').textContent = 'Log Study Session';
    document.getElementById('dateInput').disabled  = false;
    document.getElementById('saveBtn').textContent = 'Save & Schedule';
    document.querySelector('.review-preview').style.display = '';
    document.getElementById('recurGroup').style.display = '';
    document.getElementById('dateInput').value    = dateStr;
    document.getElementById('topicInput').value   = '';
    document.getElementById('subjectInput').value = activeSubject || '';
    document.getElementById('notesInput').value   = '';
    resetEditTags([]);
    resetRecurUI(dateStr);

    const list = document.getElementById('subjectList');
    list.innerHTML = '';
    [...new Set(sessions.map(s => s.subject).filter(Boolean))].sort().forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      list.appendChild(opt);
    });

    buildReviewChips(dateStr);
    document.getElementById('addModal').classList.add('active');
    setTimeout(() => document.getElementById('topicInput').focus(), 220);
  }

  function closeAddModal() {
    document.getElementById('addModal').classList.remove('active');
  }

  // ── Recurrence UI helpers ────────────────────────────────
  function toggleRecurOptions() {
    const checked = document.getElementById('recurCheck').checked;
    document.getElementById('recurOptions').style.display = checked ? '' : 'none';
  }

  function syncRecurPreview() {
    // No-op preview for now; rule is read at save time
  }

  function resetRecurUI(dateStr) {
    document.getElementById('recurCheck').checked = false;
    document.getElementById('recurOptions').style.display = 'none';
    // Pre-select the weekday matching the chosen study date
    const wd = new Date(dateStr + 'T00:00:00').getDay();
    document.getElementById('recurWeekday').value = wd;
    document.getElementById('recurTypeWeekly').checked = true;
    document.getElementById('recurDays').value = 7;
  }

  function getRecurrenceRule() {
    if (!document.getElementById('recurCheck').checked) return null;
    const isWeekly = document.getElementById('recurTypeWeekly').checked;
    if (isWeekly) {
      return { type: 'weekly', weekday: parseInt(document.getElementById('recurWeekday').value) };
    }
    const days = Math.max(1, parseInt(document.getElementById('recurDays').value) || 7);
    return { type: 'interval', days };
  }

  function recurRuleLabel(rule) {
    if (!rule) return '';
    if (rule.type === 'weekly') {
      const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      return `every ${days[rule.weekday]}`;
    }
    return `every ${rule.days}d`;
  }

  function buildReviewChips(dateStr) {
    const wrap = document.getElementById('reviewChips');
    wrap.innerHTML = '';
    intervals.forEach((days, i) => {
      const col = REVIEW_COLORS[Math.min(i, REVIEW_COLORS.length - 1)];
      const chip = document.createElement('div');
      chip.className = 'review-chip';
      chip.innerHTML =
        `<span class="chip-interval" style="color:${col}">${intervalLabel(days)}</span>` +
        `<span>${displayDate(addDays(dateStr, days))}</span>`;
      wrap.appendChild(chip);
    });
  }

  document.getElementById('dateInput').addEventListener('change', e => {
    addModalTargetDate = e.target.value;
    buildReviewChips(addModalTargetDate);
    // Keep weekly weekday in sync with the chosen date
    if (!document.getElementById('recurCheck').checked) {
      const wd = new Date(addModalTargetDate + 'T00:00:00').getDay();
      document.getElementById('recurWeekday').value = wd;
    }
  });

  async function saveStudySession() {
    const topic   = document.getElementById('topicInput').value.trim();
    const subject = document.getElementById('subjectInput').value.trim();
    const date    = document.getElementById('dateInput').value;
    const notes   = document.getElementById('notesInput').value.trim();
    if (!topic) { document.getElementById('topicInput').focus(); return; }

    const btn = document.getElementById('saveBtn');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    const recurrenceRule = getRecurrenceRule();
    const recurrenceId   = recurrenceRule ? crypto.randomUUID() : null;
    const tags           = [...editTags];

    const session = {
      id:          Date.now().toString(),
      topic, subject, studiedDate: date, notes, tags,
      reviews: intervals.map(d => ({ date: addDays(date, d), done: false })),
      recurrenceRule, recurrenceId
    };

    try {
      if (editingSessionId) {
        await authFetch(`/api/sessions/${editingSessionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic, subject, notes, tags })
        });
        const s = sessions.find(x => x.id === editingSessionId);
        if (s) { s.topic = topic; s.subject = subject; s.notes = notes; s.tags = tags; }
        showToast(`"${topic}" updated`);
      } else {
        await authFetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(session)
        });
        sessions.push(session);
        const recurSuffix = recurrenceRule ? ` · 🔁 ${recurRuleLabel(recurrenceRule)}` : '';
        showToast(`"${topic}" saved — ${intervals.length} reviews scheduled${recurSuffix}`);
        closeAddModal();
        renderCalendar();
        openDeckPrompt(session.id, topic);
        return;
      }
      closeAddModal();
      renderCalendar();
    } catch {
      showToast('Error saving — is the server running?');
    } finally {
      btn.disabled = false;
      btn.textContent = editingSessionId ? 'Save Changes' : 'Save & Schedule';
    }
  }

  // ── Day Modal ────────────────────────────────────────────
  function openDayModal(dateStr) {
    currentDayDate = dateStr;
    document.getElementById('dayModalTitle').textContent = displayDate(dateStr);

    const wrap = document.getElementById('dayModalEvents');
    wrap.innerHTML = '';
    const evs = getEventsForDate(dateStr);

    if (!evs.length) {
      wrap.innerHTML = '<div class="empty-day">No events — click "+ Add Study" to log a session.</div>';
    } else {
      evs.forEach(ev => {
        const item = document.createElement('div');
        item.className = 'event-item';

        const dot = document.createElement('div');
        dot.className = 'event-dot';
        dot.style.background = ev.type === 'study'
          ? getSubjectColor(ev.session.subject).border
          : REVIEW_COLORS[Math.min(ev.reviewIndex, REVIEW_COLORS.length - 1)];

        const info = document.createElement('div');
        info.className = 'event-info';
        const tagsHtml = ev.type === 'study' && (ev.session.tags || []).length
          ? `<div class="session-tags">${ev.session.tags.map(t =>
              `<span class="session-tag" onclick="filterByTag('${t}');closeDayModal()">#${t}</span>`
            ).join('')}</div>`
          : '';
        info.innerHTML =
          `<div class="event-title">${ev.type === 'study' ? ev.session.topic : 'Review: ' + ev.session.topic}</div>` +
          `<div class="event-meta">${ev.type === 'study'
            ? (ev.session.notes || 'Initial study session') + (ev.session.reviewStreak >= 2 ? ` &nbsp;<span class="streak-badge">🔥 ${ev.session.reviewStreak}-review streak</span>` : '')
            : `Spaced review (${intervalLabel(intervals[ev.reviewIndex] ?? ev.reviewIndex)})${ev.done ? ' — Done ✓' + (ev.session.reviews[ev.reviewIndex]?.confidence ? ' · ' + RATINGS[ev.session.reviews[ev.reviewIndex].confidence - 1]?.emoji : '') : ''}`
          }</div>${tagsHtml}`;

        item.appendChild(dot);
        item.appendChild(info);

        if (ev.type === 'review') {
          if (ev.done) {
            const btn = document.createElement('button');
            btn.className = 'undo-btn';
            btn.textContent = 'Undo';
            btn.title = 'Mark as not done';
            btn.onclick = e => { e.stopPropagation(); markDone(ev.session.id, ev.reviewIndex, dateStr, false); };
            item.appendChild(btn);
          } else if (ev.session.reviews[ev.reviewIndex].date > todayStr()) {
            const badge = document.createElement('span');
            badge.className = 'scheduled-badge';
            badge.textContent = 'Scheduled';
            item.appendChild(badge);
          } else {
            const reviewDeck = getDeckForSession(ev.session.id);
            if (reviewDeck) {
              const practiceBtn = document.createElement('button');
              practiceBtn.className = 'practice-btn';
              practiceBtn.textContent = 'Practice';
              practiceBtn.title = `Practice flashcards (${reviewDeck.cards.length} cards)`;
              practiceBtn.onclick = e => { e.stopPropagation(); openStudyModal(reviewDeck.id); };
              item.appendChild(practiceBtn);
            }
            const btn = document.createElement('button');
            btn.className = 'check-btn';
            btn.textContent = 'Mark done';
            btn.onclick = e => { e.stopPropagation(); openRatingModal(ev.session.id, ev.reviewIndex, dateStr); };
            item.appendChild(btn);
          }
        }

        if (ev.type === 'study') {
          // Links section — renders below info, before action buttons
          renderSessionLinks(info, ev.session.id);

          const sessionDeck = getDeckForSession(ev.session.id);
          const deckBtn = document.createElement('button');
          deckBtn.className = 'edit-btn';
          if (sessionDeck) {
            deckBtn.title = `Study flashcards (${sessionDeck.cards.length} cards)`;
            deckBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="9" height="7" rx="1"/><rect x="3" y="2" width="9" height="7" rx="1" fill="var(--surface)"/></svg>';
            deckBtn.onclick = e => { e.stopPropagation(); closeDayModal(); openStudyModal(sessionDeck.id); };
          } else {
            deckBtn.title = 'Add flashcards';
            deckBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1" y="4" width="9" height="7" rx="1"/><line x1="10" y1="0.5" x2="10" y2="6.5"/><line x1="7" y1="3.5" x2="13" y2="3.5"/></svg>';
            deckBtn.onclick = e => { e.stopPropagation(); closeDayModal(); openDeckEditorForSession(ev.session.id, ev.session.topic); };
          }
          item.appendChild(deckBtn);

          const curveBtn = document.createElement('button');
          curveBtn.className = 'edit-btn';
          curveBtn.title = 'View forgetting curve';
          curveBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,11 4,6 7,8 10,3 13,5"/></svg>';
          curveBtn.onclick = e => { e.stopPropagation(); openCurveModal(ev.session.id); };
          item.appendChild(curveBtn);

          const editBtn = document.createElement('button');
          editBtn.className = 'edit-btn';
          editBtn.title = 'Edit session';
          editBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 1.5l2 2-7 7H2.5v-2l7-7z"/></svg>';
          editBtn.onclick = e => { e.stopPropagation(); openEditModal(ev.session); };
          item.appendChild(editBtn);

          const del = document.createElement('button');
          del.className = 'delete-btn';
          del.title = 'Delete session';
          del.textContent = '×';
          del.onclick = e => { e.stopPropagation(); deleteSession(ev.session.id, dateStr); };
          item.appendChild(del);
        }

        wrap.appendChild(item);
      });
    }

    document.getElementById('dayModal').classList.add('active');
  }

  function closeDayModal() { document.getElementById('dayModal').classList.remove('active'); }

  async function markDone(sessionId, reviewIdx, dateStr, done = true, confidence = null, rescheduleFromToday = false) {
    const body = { done };
    if (confidence)          body.confidence          = confidence;
    if (rescheduleFromToday) body.rescheduleFromToday = true;

    const res  = await authFetch(`/api/sessions/${sessionId}/reviews/${reviewIdx}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });
    const data = await res.json();
    const s = sessions.find(x => x.id === sessionId);
    if (s && data.reviews) {
      s.reviews      = data.reviews;
      s.easeFactor   = data.easeFactor;
      s.reviewStreak = data.reviewStreak;
    } else if (s) {
      s.reviews[reviewIdx].done = done;
    }
    renderCalendar();
    if (dateStr) openDayModal(dateStr);
    showToast(done ? 'Review marked complete!' : 'Review marked incomplete.');
  }

  async function markAllDone(items) {
    await Promise.all(items.map(({ sessionId, reviewIdx }) =>
      authFetch(`/api/sessions/${sessionId}/reviews/${reviewIdx}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: true })
      }).then(() => {
        const s = sessions.find(x => x.id === sessionId);
        if (s) s.reviews[reviewIdx].done = true;
      })
    ));
    renderCalendar();
    showToast(`${items.length} reviews marked complete!`);
  }
