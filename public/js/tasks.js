// ── Tasks ────────────────────────────────────────────────

  const TASK_TOD_ORDER  = ['morning', 'afternoon', 'evening', ''];
  const TASK_TOD_LABELS = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', '': 'Anytime' };
  const TASK_PRIO_COLOR = { none: 'var(--tx-3)', low: '#22c55e', medium: '#eab308', high: '#ef4444' };

  function openTasks() {
    populateTaskSessionPicker();
    populateTaskCategoryDatalist();
    resetTaskForm();
    renderTasks();
    document.getElementById('tasksModal').classList.add('active');
  }

  function closeTasks() {
    document.getElementById('tasksModal').classList.remove('active');
  }

  function populateTaskSessionPicker() {
    const sel = document.getElementById('taskSessionInput');
    sel.innerHTML = '<option value="">None</option>' +
      sessions.map(s => `<option value="${s.id}">${escHtml(s.topic)}</option>`).join('');
  }

  function populateTaskCategoryDatalist() {
    const dl = document.getElementById('taskCategoryList');
    const cats = [...new Set(tasks.map(t => t.category).filter(Boolean))].sort();
    dl.innerHTML = cats.map(c => `<option value="${escHtml(c)}">`).join('');
  }

  function resetTaskForm() {
    document.getElementById('taskTitleInput').value    = '';
    document.getElementById('taskCategoryInput').value = '';
    document.getElementById('taskTimeInput').value     = '';
    document.getElementById('taskDueInput').value       = '';
    document.getElementById('taskPriorityInput').value = 'none';
    document.getElementById('taskNotesInput').value    = '';
    document.getElementById('taskSessionInput').value  = '';
    editingTaskId = null;
    document.getElementById('taskSaveBtn').textContent = 'Add task';
    document.getElementById('taskEditCancelLink').style.display = 'none';
  }

  function editTask(id) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    editingTaskId = id;
    document.getElementById('taskTitleInput').value    = t.title;
    document.getElementById('taskCategoryInput').value = t.category || '';
    document.getElementById('taskTimeInput').value     = t.time_of_day || '';
    document.getElementById('taskDueInput').value       = t.due_date || '';
    document.getElementById('taskPriorityInput').value = t.priority || 'none';
    document.getElementById('taskNotesInput').value    = t.notes || '';
    document.getElementById('taskSessionInput').value  = t.session_id || '';
    document.getElementById('taskSaveBtn').textContent = 'Save changes';
    document.getElementById('taskEditCancelLink').style.display = '';
    document.getElementById('taskTitleInput').focus();
  }

  async function saveTask() {
    const title = document.getElementById('taskTitleInput').value.trim();
    if (!title) { showToast('Title required'); return; }
    const payload = {
      title,
      category:  document.getElementById('taskCategoryInput').value.trim(),
      timeOfDay: document.getElementById('taskTimeInput').value,
      dueDate:   document.getElementById('taskDueInput').value || null,
      priority:  document.getElementById('taskPriorityInput').value,
      notes:     document.getElementById('taskNotesInput').value.trim(),
      sessionId: document.getElementById('taskSessionInput').value || null,
    };
    const btn = document.getElementById('taskSaveBtn');
    btn.disabled = true;
    try {
      if (editingTaskId) {
        await authFetch(`/api/tasks/${editingTaskId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const t = tasks.find(x => x.id === editingTaskId);
        Object.assign(t, {
          title: payload.title, category: payload.category, time_of_day: payload.timeOfDay,
          due_date: payload.dueDate, priority: payload.priority, notes: payload.notes,
          session_id: payload.sessionId,
        });
        showToast('Task updated');
      } else {
        const res  = await authFetch('/api/tasks', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        const data = await res.json();
        tasks.unshift({
          id: data.id, title: payload.title, category: payload.category,
          time_of_day: payload.timeOfDay, due_date: payload.dueDate, priority: payload.priority,
          notes: payload.notes, session_id: payload.sessionId, done: false,
          created_at: new Date().toISOString(),
        });
        showToast('Task added');
      }
      resetTaskForm();
      populateTaskCategoryDatalist();
      renderTasks();
    } catch {
      showToast('Error saving task — is the server running?');
    } finally {
      btn.disabled = false;
    }
  }

  async function toggleTaskDone(id, done) {
    const t = tasks.find(x => x.id === id);
    if (!t) return;
    t.done = done;
    renderTasks();
    try {
      await authFetch(`/api/tasks/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ done })
      });
    } catch { showToast('Error saving — is the server running?'); }
  }

  async function deleteTask(id) {
    if (!confirm('Delete this task?')) return;
    tasks = tasks.filter(t => t.id !== id);
    renderTasks();
    try {
      await authFetch(`/api/tasks/${id}`, { method: 'DELETE' });
    } catch { showToast('Error deleting — is the server running?'); }
  }

  function setTaskGroupBy(mode) {
    taskGroupBy = mode;
    document.getElementById('groupByTimeBtn').classList.toggle('active', mode === 'time');
    document.getElementById('groupByCategoryBtn').classList.toggle('active', mode === 'category');
    renderTasks();
  }

  function filterTaskCategory(cat) {
    activeTaskCategory = activeTaskCategory === cat ? null : cat;
    renderTasks();
  }

  function renderTaskCategoryFilterBar() {
    const bar  = document.getElementById('taskCategoryFilterBar');
    const cats = [...new Set(tasks.map(t => t.category || 'Uncategorized'))].sort();
    bar.innerHTML = cats.length <= 1 ? '' : cats.map(c =>
      `<button class="tag-pill${activeTaskCategory === c ? ' active' : ''}" onclick="filterTaskCategory('${escHtml(c)}')">${escHtml(c)}</button>`
    ).join('');
  }

  function taskGroupKey(t)   { return taskGroupBy === 'category' ? (t.category || 'Uncategorized') : (t.time_of_day || ''); }
  function taskGroupLabel(k) { return taskGroupBy === 'category' ? k : TASK_TOD_LABELS[k]; }

  function renderTaskRow(t) {
    const due  = t.due_date ? `<span class="scheduled-badge">Due ${displayDate(t.due_date)}</span>` : '';
    const cc   = t.category ? getSubjectColor(t.category) : null;
    const cat  = t.category
      ? `<span class="session-tag" style="background:${cc.bg};color:${cc.text};border-color:${cc.border}">${escHtml(t.category)}</span>`
      : '';
    const sess = t.session_id ? sessions.find(s => s.id === t.session_id) : null;
    const link = sess
      ? `<span class="session-tag" onclick="closeTasks();openEditModal(sessions.find(s=>s.id==='${t.session_id}'))">&#128279; ${escHtml(sess.topic)}</span>`
      : '';
    return `
      <div class="event-item${t.done ? ' task-done' : ''}">
        <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleTaskDone('${t.id}', this.checked)">
        <div class="event-dot" style="background:${TASK_PRIO_COLOR[t.priority] || TASK_PRIO_COLOR.none}"></div>
        <div class="event-info">
          <div class="event-title">${escHtml(t.title)}</div>
          <div class="event-meta">${cat}${due}${link}</div>
        </div>
        <button class="edit-btn" title="Edit" onclick="editTask('${t.id}')">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 1.5l2 2-7 7H2.5v-2l7-7z"/></svg>
        </button>
        <button class="delete-btn" title="Delete" onclick="deleteTask('${t.id}')">×</button>
      </div>`;
  }

  function visibleTasks() {
    return activeTaskCategory === null ? tasks : tasks.filter(t => (t.category || 'Uncategorized') === activeTaskCategory);
  }

  function renderTasks() {
    renderTaskCategoryFilterBar();
    const wrap = document.getElementById('taskGroups');
    const list = visibleTasks();
    if (!list.length) { wrap.innerHTML = '<div class="empty-day">No tasks yet — add one above.</div>'; return; }

    const groups = {};
    list.forEach(t => { const k = taskGroupKey(t); (groups[k] = groups[k] || []).push(t); });

    const keys = taskGroupBy === 'category'
      ? Object.keys(groups).sort()
      : TASK_TOD_ORDER.filter(k => groups[k]);

    wrap.innerHTML = keys.map(key => {
      const items  = groups[key];
      const active = items.filter(t => !t.done);
      const done   = items.filter(t => t.done);
      return `
        <div class="stats-section-title">${escHtml(taskGroupLabel(key))}</div>
        ${active.length ? active.map(renderTaskRow).join('') : '<div class="empty-day">All done here 🎉</div>'}
        ${done.length ? `<details><summary>Completed (${done.length})</summary>${done.map(renderTaskRow).join('')}</details>` : ''}
      `;
    }).join('');
  }
