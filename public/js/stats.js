// ── Stats Modal ──────────────────────────────────────────
  function openStats() {
    // stat cards
    const totalTopics      = sessions.length;
    const totalReviews     = sessions.reduce((n, s) => n + s.reviews.length, 0);
    const completedReviews = sessions.reduce((n, s) => n + s.reviews.filter(r => r.done).length, 0);
    const completionPct    = totalReviews ? Math.round((completedReviews / totalReviews) * 100) : 0;

    const today   = new Date(todayStr() + 'T00:00:00');
    const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);
    let dueThisWeek = 0;
    sessions.forEach(s => s.reviews.forEach(r => {
      const d = new Date(r.date + 'T00:00:00');
      if (!r.done && d >= today && d < weekEnd) dueThisWeek++;
    }));

    document.getElementById('statCards').innerHTML =
      statCard(totalTopics, 'Topics studied') +
      statCard(completedReviews + ' / ' + totalReviews, 'Reviews complete') +
      statCard(completionPct + '%', 'Completion rate') +
      statCard(dueThisWeek, 'Due this week');

    // heatmap
    buildHeatmap();

    // subject breakdown
    buildSubjectBreakdown();

    // retention scores
    buildRetentionList();

    document.getElementById('statsModal').classList.add('active');
  }

  function statCard(value, label) {
    return `<div class="stat-card"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
  }

  function buildHeatmap() {
    const activityMap = {};
    sessions.forEach(s => {
      activityMap[s.studiedDate] = (activityMap[s.studiedDate] || 0) + 2;
      s.reviews.forEach(r => {
        if (r.done) activityMap[r.date] = (activityMap[r.date] || 0) + 1;
      });
    });

    const grid = document.getElementById('heatmapGrid');
    grid.innerHTML = '';

    const today = todayStr();

    // anchor start to the Sunday of the week 12 weeks before the current week
    // so today always lands in the final column
    const startOfCurrentWeek = new Date(today + 'T00:00:00');
    startOfCurrentWeek.setDate(startOfCurrentWeek.getDate() - startOfCurrentWeek.getDay());
    const cursor = new Date(startOfCurrentWeek);
    cursor.setDate(cursor.getDate() - 12 * 7);

    for (let i = 0; i < 91; i++) {
      const ds       = ymd(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate());
      const future   = ds > today;
      const activity = future ? 0 : (activityMap[ds] || 0);
      const cell     = document.createElement('div');
      cell.className = 'heatmap-cell';
      cell.style.background = future ? '#f8fafc' : heatColor(activity);
      cell.style.opacity = future ? '0.3' : '1';
      if (!future) cell.title = `${displayDate(ds)}: ${activity ? activity + ' points' : 'no activity'}`;
      grid.appendChild(cell);
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  function heatColor(a) {
    if (a === 0) return '#f1f5f9';
    if (a <= 1)  return '#c7d2fe';
    if (a <= 3)  return '#818cf8';
    return '#4f46e5';
  }

  function buildSubjectBreakdown() {
    const wrap  = document.getElementById('subjectBreakdown');
    const today = todayStr();

    // Aggregate per-subject stats
    const data = {};
    sessions.forEach(s => {
      const k = s.subject || '(No subject)';
      if (!data[k]) data[k] = { topics: 0, totalRev: 0, doneRev: 0, overdue: 0, sessions: [] };
      const d = data[k];
      d.topics++;
      d.sessions.push(s);
      s.reviews.forEach(r => {
        d.totalRev++;
        if (r.done) d.doneRev++;
        else if (r.date < today) d.overdue++;
      });
    });

    const entries = Object.entries(data).sort((a, b) => b[1].doneRev - a[1].doneRev);
    if (!entries.length) { wrap.innerHTML = ''; return; }

    const maxRev = Math.max(1, ...entries.map(([, d]) => d.totalRev));
    wrap.innerHTML = `<div class="stats-section-title" style="margin-top:8px">By subject</div>`;

    entries.forEach(([subj, d]) => {
      const col        = getSubjectColor(subj === '(No subject)' ? '' : subj);
      const barPct     = Math.round((d.totalRev / maxRev) * 100);
      const compPct    = d.totalRev ? Math.round((d.doneRev / d.totalRev) * 100) : 0;
      const avgRet     = d.sessions.length
        ? Math.round(d.sessions.reduce((s, x) => s + calcRetention(x), 0) / d.sessions.length)
        : 0;
      const retCol     = retentionColor(avgRet);

      const row = document.createElement('div');
      row.className = 'subject-row';
      row.innerHTML =
        `<div class="subject-name" title="${subj}">${subj}</div>
         <div class="subject-bar-wrap">
           <div class="subject-bar" style="width:${barPct}%;background:${col.border}"></div>
         </div>
         <div class="subject-stats">
           <span>${d.topics} topic${d.topics !== 1 ? 's' : ''}</span>
           <span>${d.doneRev}/${d.totalRev}</span>
           <span class="s-ret" style="color:${retCol}">${avgRet}%</span>
           ${d.overdue > 0 ? `<span class="s-overdue">${d.overdue} overdue</span>` : ''}
         </div>`;
      wrap.appendChild(row);
    });

    // Activity grid — only show when there are multiple subjects
    if (entries.length > 1) buildSubjectHeatmap(wrap, entries);
  }

  function buildSubjectHeatmap(container, entries) {
    const WEEKS = 8;
    const today = todayStr();

    // Compute week start dates (Sunday-anchored, ending this week)
    const anchor = new Date(today + 'T00:00:00');
    anchor.setDate(anchor.getDate() - anchor.getDay());
    const weeks = [];
    for (let w = WEEKS - 1; w >= 0; w--) {
      const ws = new Date(anchor);
      ws.setDate(anchor.getDate() - w * 7);
      const we = new Date(ws);
      we.setDate(ws.getDate() + 6);
      weeks.push({
        start: ws.toISOString().slice(0, 10),
        end:   we.toISOString().slice(0, 10),
        label: SHORT_MONTHS[ws.getMonth()] + ' ' + ws.getDate()
      });
    }

    // Count completed reviews per subject per week
    const act = {};
    entries.forEach(([k]) => { act[k] = new Array(WEEKS).fill(0); });
    sessions.forEach(s => {
      const k = s.subject || '(No subject)';
      if (!act[k]) return;
      s.reviews.forEach(r => {
        if (!r.done) return;
        for (let w = 0; w < WEEKS; w++) {
          if (r.date >= weeks[w].start && r.date <= weeks[w].end) { act[k][w]++; break; }
        }
      });
    });

    const maxAct = Math.max(1, ...Object.values(act).flat());

    const wrap = document.createElement('div');
    wrap.className = 'subject-heatmap';

    // Week-label header row
    const header = document.createElement('div');
    header.className = 'sh-header';
    header.innerHTML = `<div class="sh-subject-label"></div>` +
      weeks.map(w => `<div class="sh-week-label">${w.label}</div>`).join('');
    wrap.appendChild(header);

    // Subject rows
    entries.forEach(([subj]) => {
      const col = getSubjectColor(subj === '(No subject)' ? '' : subj);
      const row = document.createElement('div');
      row.className = 'sh-row';
      row.innerHTML = `<div class="sh-subject-label" title="${subj}">${subj}</div>`;
      act[subj].forEach((count, wi) => {
        const cell = document.createElement('div');
        cell.className = 'sh-cell';
        if (count > 0) {
          cell.style.background = col.border;
          cell.style.opacity    = (0.2 + (count / maxAct) * 0.8).toFixed(2);
        }
        cell.title = `${subj} · ${weeks[wi].label}: ${count} review${count !== 1 ? 's' : ''}`;
        row.appendChild(cell);
      });
      wrap.appendChild(row);
    });

    container.appendChild(wrap);
  }

  // ── Retention score ──────────────────────────────────────
  // Uses Ebbinghaus decay: R = e^(-t/S)
  // S (stability) = interval of last completed event × ease factor
  function calcRetention(session) {
    const todayMs  = new Date(todayStr() + 'T00:00:00').getTime();
    let lastDate   = session.studiedDate;
    let lastRevIdx = -1;

    for (let i = 0; i < session.reviews.length; i++) {
      if (session.reviews[i].done) { lastDate = session.reviews[i].date; lastRevIdx = i; }
    }

    const daysSince    = Math.max(0, Math.round((todayMs - new Date(lastDate + 'T00:00:00').getTime()) / 86400000));
    const ef           = session.easeFactor || 2.5;
    const baseInterval = lastRevIdx === -1
      ? (intervals[0] || 1)
      : (intervals[lastRevIdx] || intervals[intervals.length - 1]);
    const stability    = baseInterval * ef;

    return Math.max(0, Math.min(100, Math.round(Math.exp(-daysSince / stability) * 100)));
  }

  function retentionColor(pct) {
    if (pct >= 80) return '#10b981';
    if (pct >= 60) return '#14b8a6';
    if (pct >= 40) return '#f59e0b';
    if (pct >= 20) return '#f97316';
    return '#ef4444';
  }

  function buildRetentionList() {
    const el = document.getElementById('retentionList');
    if (!sessions.length) { el.innerHTML = ''; return; }

    const scored = sessions
      .map(s => ({ s, pct: calcRetention(s) }))
      .sort((a, b) => b.pct - a.pct);

    el.innerHTML = `<div class="stats-section-title" style="margin-top:8px">Retention by topic</div>`;
    scored.forEach(({ s, pct }) => {
      const col = retentionColor(pct);
      const row = document.createElement('div');
      row.className = 'retention-row';
      row.innerHTML =
        `<div class="retention-topic" title="${s.topic}">${s.topic}</div>
         <div class="retention-bar-wrap">
           <div class="retention-bar" style="width:0%;background:${col}" data-target="${pct}"></div>
         </div>
         <div class="retention-pct" style="color:${col}">${pct}%</div>`;
      el.appendChild(row);
    });

    // Animate bars in on next frame
    requestAnimationFrame(() => {
      el.querySelectorAll('.retention-bar').forEach(bar => {
        bar.style.width = bar.dataset.target + '%';
      });
    });
  }

  function exportCSV() {
    const esc = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Topic','Subject','Studied Date','Notes','Review #','Due Date','Done','Confidence (1-5)','Ease Factor','Review Streak']
    ];
    sessions.forEach(s => {
      s.reviews.forEach((r, i) => {
        rows.push([
          esc(s.topic),
          esc(s.subject),
          s.studiedDate,
          esc(s.notes),
          i + 1,
          r.date,
          r.done ? 'true' : 'false',
          r.confidence ?? '',
          (s.easeFactor ?? 2.5).toFixed(2),
          s.reviewStreak ?? 0
        ]);
      });
    });
    const csv  = rows.map(r => r.join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `recall-export-${todayStr()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('CSV exported!');
  }

  function closeStats() { document.getElementById('statsModal').classList.remove('active'); }

  // ── Forgetting Curve Modal ────────────────────────────────
  function openCurveModal(sessionId) {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    closeDayModal();
    document.getElementById('curveTitle').textContent    = session.topic;
    document.getElementById('curveSubtitle').textContent =
      `Studied ${displayDate(session.studiedDate)}` +
      (session.subject ? ` · ${session.subject}` : '') +
      (session.recurrenceRule ? ` · 🔁 ${recurRuleLabel(session.recurrenceRule)}` : '');
    document.getElementById('curveChart').innerHTML  = buildCurveSVG(session);
    document.getElementById('curveLegend').innerHTML = buildCurveLegend(session);
    buildCurveHistory(session);
    document.getElementById('curveModal').classList.add('active');
  }

  function closeCurveModal() { document.getElementById('curveModal').classList.remove('active'); }

  function buildCurveSVG(session) {
    const today    = todayStr();
    const studyMs  = new Date(session.studiedDate + 'T00:00:00').getTime();
    const toDays   = d => (new Date(d + 'T00:00:00').getTime() - studyMs) / 86400000;
    const todayDay = toDays(today);

    const lastRevDay = Math.max(0, ...session.reviews.map(r => toDays(r.date)));
    const maxDay     = Math.max(lastRevDay + 4, todayDay + 2, 33);

    // SVG viewport
    const W = 500, H = 190;
    const ML = 44, MR = 14, MT = 18, MB = 28;
    const PW = W - ML - MR, PH = H - MT - MB;

    const toX = d   => ML + (d / maxDay) * PW;
    const toY = pct => MT + (1 - Math.min(1, Math.max(0, pct / 100))) * PH;

    // Build curve phases: each phase starts after a completed review
    // stability = gap-to-next-review × ease factor (grows with each pass)
    const ef = session.easeFactor || 2.5;
    const phases = [];
    let curEF = 2.5; // replay EF forward from initial 2.5

    phases.push({ startDay: 0, stability: (intervals[0] || 1) * curEF });

    session.reviews.forEach((r, i) => {
      if (!r.done) return;
      const day = toDays(r.date);
      if (r.confidence) {
        // simplified SM-2 replay
        const q     = r.confidence;
        const newEF = Math.max(1.3, curEF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
        curEF = q < 3 ? Math.max(1.3, curEF - 0.2) : newEF;
      }
      const nextGap = i + 1 < intervals.length
        ? (intervals[i + 1] - intervals[i])
        : (intervals[intervals.length - 1]);
      phases.push({ startDay: day, stability: Math.max(1, nextGap) * curEF });
    });

    // ── Draw grid ──────────────────────────────────────────
    let grid = '', xLabels = '';
    [0, 25, 50, 75, 100].forEach(pct => {
      const y = toY(pct).toFixed(1);
      grid += `<line class="curve-grid-line" x1="${ML}" y1="${y}" x2="${ML + PW}" y2="${y}"/>`;
      grid += `<text class="curve-label" x="${ML - 5}" y="${(+y + 3.5).toFixed(1)}" text-anchor="end">${pct}%</text>`;
    });
    [0, 7, 14, 21, 30].filter(d => d <= maxDay + 1).forEach(d => {
      const x = toX(d).toFixed(1);
      xLabels += `<text class="curve-label" x="${x}" y="${H - 6}" text-anchor="middle">+${d}d</text>`;
    });

    // ── Draw curve segments + area fills ──────────────────
    let paths = '', areas = '';
    phases.forEach((phase, pi) => {
      const endDay = pi < phases.length - 1 ? phases[pi + 1].startDay : maxDay;
      const pts = [], areaPts = [];
      for (let d = phase.startDay; d <= endDay + 0.1; d += 0.25) {
        const t   = d - phase.startDay;
        const ret = 100 * Math.exp(-t / phase.stability);
        const x   = toX(d).toFixed(2);
        const y   = toY(ret).toFixed(2);
        pts.push(`${x},${y}`);
        areaPts.push(`${x},${y}`);
      }
      if (pts.length < 2) return;
      paths += `<polyline class="curve-path" points="${pts.join(' ')}"/>`;
      const x0 = toX(phase.startDay).toFixed(2);
      const x1 = toX(Math.min(endDay, maxDay)).toFixed(2);
      const yBase = (MT + PH).toFixed(2);
      areas += `<polygon class="curve-area" points="${x0},${yBase} ${areaPts.join(' ')} ${x1},${yBase}"/>`;
    });

    // ── Today line ─────────────────────────────────────────
    let todayLine = '';
    if (todayDay > 0.5 && todayDay <= maxDay) {
      const tx = toX(todayDay).toFixed(1);
      todayLine = `<line class="curve-today" x1="${tx}" y1="${MT}" x2="${tx}" y2="${MT + PH}"/>
                   <text class="curve-today-lbl" x="${tx}" y="${MT - 4}" text-anchor="middle">today</text>`;
    }

    // ── Review dots ────────────────────────────────────────
    const confFill = ['#ef4444','#f97316','#eab308','#22c55e','#6366f1'];
    let dots = '', resets = '';

    // Study dot at day 0
    dots += `<circle cx="${toX(0).toFixed(1)}" cy="${toY(100).toFixed(1)}" r="5" fill="#6366f1" stroke="white" stroke-width="1.5"/>`;

    session.reviews.forEach((r, i) => {
      const day = toDays(r.date);
      // Find phase active at this day
      let phase = phases[0];
      for (const p of phases) { if (p.startDay <= day) phase = p; }

      const t   = day - phase.startDay;
      const ret = Math.min(100, Math.max(0, 100 * Math.exp(-t / phase.stability)));
      const cx  = toX(day).toFixed(1);
      const cy  = toY(ret).toFixed(1);

      if (r.done) {
        const col = r.confidence ? confFill[r.confidence - 1] : '#6366f1';
        // vertical reset line
        resets += `<line x1="${cx}" y1="${cy}" x2="${cx}" y2="${toY(100).toFixed(1)}" stroke="${col}" stroke-width="1" stroke-dasharray="3 2" opacity="0.45"/>`;
        dots   += `<circle cx="${cx}" cy="${cy}" r="5" fill="${col}" stroke="white" stroke-width="1.5"/>`;
      } else {
        const overdue = r.date < today;
        const col = overdue ? '#ef4444' : '#94a3b8';
        dots += `<circle cx="${cx}" cy="${cy}" r="5" fill="white" stroke="${col}" stroke-width="2"/>`;
      }
    });

    // ── Axes ───────────────────────────────────────────────
    const axes = `<line class="curve-axis" x1="${ML}" y1="${MT}" x2="${ML}" y2="${MT + PH}"/>
                  <line class="curve-axis" x1="${ML}" y1="${MT + PH}" x2="${ML + PW}" y2="${MT + PH}"/>`;

    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      ${grid}${xLabels}${axes}${todayLine}${areas}${paths}${resets}${dots}
    </svg>`;
  }

  function buildCurveLegend(session) {
    const confEmoji = ['😶','😕','😐','😊','🎯'];
    const confColor = ['#ef4444','#f97316','#eab308','#22c55e','#6366f1'];
    const confLabel = ['Blank','Hard','Okay','Good','Perfect'];

    // Collect which confidence scores were actually used
    const used = new Set(session.reviews.filter(r => r.done && r.confidence).map(r => r.confidence));

    let html = `<div class="curve-legend-item"><div class="curve-legend-dot" style="background:#6366f1"></div>Study / reviewed</div>`;

    used.forEach(c => {
      html += `<div class="curve-legend-item">
        <div class="curve-legend-dot" style="background:${confColor[c-1]}"></div>
        ${confEmoji[c-1]} ${confLabel[c-1]}
      </div>`;
    });

    const hasPending = session.reviews.some(r => !r.done);
    if (hasPending) {
      const hasOverdue = session.reviews.some(r => !r.done && r.date < todayStr());
      html += `<div class="curve-legend-item"><div class="curve-legend-ring" style="border-color:${hasOverdue ? '#ef4444' : '#94a3b8'}"></div>
        ${hasOverdue ? 'Overdue' : 'Upcoming'} review</div>`;
    }

    return html;
  }

  function buildCurveHistory(session) {
    const el = document.getElementById('curveHistory');
    if (!session.reviews || !session.reviews.length) { el.innerHTML = ''; return; }
    const today = todayStr();
    const confEmoji = ['😶','😕','😐','😊','🎯'];
    const confLabel = ['Blank','Hard','Okay','Good','Perfect'];
    const rows = session.reviews.map((r, i) => {
      let status, cls;
      if (r.done) {
        if (r.confidence) {
          const c = r.confidence - 1;
          status = `${confEmoji[c]} ${confLabel[c]}`;
        } else {
          status = '✓ Done';
        }
        cls = 'hist-done';
      } else if (r.date > today) {
        status = '· Upcoming'; cls = 'hist-upcoming';
      } else {
        status = '⚠ Overdue'; cls = 'hist-overdue';
      }
      return `<tr><td>Review ${i + 1}</td><td>${displayDate(r.date)}</td><td class="${cls}">${status}</td></tr>`;
    }).join('');
    el.innerHTML = `<table class="curve-history-table">
      <thead><tr><th>Review</th><th>Date</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  // ── Settings Modal ───────────────────────────────────────
  function setSubjectColor(subject, hex) {
    const colors = getCustomColors();
    colors[subject] = hex;
    localStorage.setItem('recall_subject_colors', JSON.stringify(colors));
    invalidateSubjectColors();
    buildSubjectColorsList();
    renderCalendar();
  }

  function resetSubjectColor(subject) {
    const colors = getCustomColors();
    delete colors[subject];
    localStorage.setItem('recall_subject_colors', JSON.stringify(colors));
    invalidateSubjectColors();
    buildSubjectColorsList();
    renderCalendar();
  }

  function buildSubjectColorsList() {
    const el = document.getElementById('subjectColorsList');
    if (!el) return;
    const subjects = [...new Set(sessions.map(s => s.subject).filter(Boolean))].sort();
    if (!subjects.length) {
      el.innerHTML = '<p style="font-size:13px;color:var(--tx-3);margin:8px 0">No subjects yet — log a session with a subject first.</p>';
      return;
    }
    const custom = getCustomColors();
    el.innerHTML = '';
    subjects.forEach(subj => {
      const row = document.createElement('div');
      row.className = 'subject-color-row';

      const name = document.createElement('span');
      name.className = 'subject-color-name';
      name.textContent = subj;

      const currentHex = custom[subj] || getSubjectColor(subj).border;

      const swatch = document.createElement('label');
      swatch.className = 'subject-color-swatch';
      swatch.title = 'Pick color';
      swatch.style.background = currentHex;

      const picker = document.createElement('input');
      picker.type = 'color';
      picker.value = currentHex;
      picker.style.display = 'none';
      picker.oninput = e => { swatch.style.background = e.target.value; };
      picker.onchange = e => { setSubjectColor(subj, e.target.value); };
      swatch.appendChild(picker);

      row.append(name, swatch);

      if (custom[subj]) {
        const reset = document.createElement('button');
        reset.className = 'subject-color-reset';
        reset.textContent = 'Reset';
        reset.onclick = () => resetSubjectColor(subj);
        row.appendChild(reset);
      }

      el.appendChild(row);
    });
  }

  function openSettings() {
    renderThemeGrid();
    renderIntervalsList(intervals);
    buildSubjectColorsList();
    document.getElementById('settingsModal').classList.add('active');
  }

  function renderIntervalsList(ivs) {
    const list = document.getElementById('intervalsList');
    list.innerHTML = '';
    ivs.forEach((days, i) => {
      const row = document.createElement('div');
      row.className = 'interval-row';
      const col = REVIEW_COLORS[Math.min(i, REVIEW_COLORS.length - 1)];
      row.innerHTML =
        `<span class="interval-label" style="color:${col}">Review ${i + 1}</span>
         <input class="interval-input" type="number" min="1" max="365" value="${days}" data-index="${i}" />
         <span class="interval-unit">days after</span>
         <span class="interval-date" id="idate-${i}">${displayDate(addDays(todayStr(), days))}</span>`;
      list.appendChild(row);

      row.querySelector('.interval-input').addEventListener('input', e => {
        const val = parseInt(e.target.value);
        if (val > 0) document.getElementById(`idate-${i}`).textContent = displayDate(addDays(todayStr(), val));
      });
    });
  }

  function resetIntervals() {
    renderIntervalsList([...DEFAULT_INTERVALS]);
  }

  async function saveSettings() {
    const inputs = document.querySelectorAll('#intervalsList .interval-input');
    const newIntervals = [...inputs].map(inp => parseInt(inp.value)).filter(n => n > 0);
    if (!newIntervals.length) return;

    await authFetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intervals: newIntervals })
    });
    intervals = newIntervals;
    closeSettings();
    renderLegend();
    showToast('Intervals saved — applies to new sessions');
  }

  function closeSettings() { document.getElementById('settingsModal').classList.remove('active'); }
