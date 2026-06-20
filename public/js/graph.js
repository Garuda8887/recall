// ── Knowledge Graph ──────────────────────────────────────

  const GRAPH_EDGE_COLORS = {
    'related':     '#94a3b8',
    'builds-on':   '#818cf8',
    'prerequisite':'#fb923c',
    'see-also':    '#2dd4bf',
  };
  const GRAPH = { repel:5500, spring:0.05, springLen:170, gravity:0.018, damping:0.78 };

  function openGraphModal() {
    document.getElementById('graphModal').classList.add('active');
    _graphMoveFn = e => {
      if (!graphIsDragging) return;
      const dx = e.clientX - graphLastMX;
      const dy = e.clientY - graphLastMY;
      graphTargetRotY += dx * 0.35;
      graphTargetRotX -= dy * 0.25;
      graphTargetRotX  = Math.max(-40, Math.min(40, graphTargetRotX));
      graphLastMX = e.clientX;
      graphLastMY = e.clientY;
    };
    _graphUpFn = () => {
      if (!graphIsDragging) return;
      graphIsDragging = false;
      const container = document.getElementById('graphContainer');
      if (container) {
        const scene = container.querySelector('div');
        if (scene) scene.style.cursor = 'grab';
      }
      clearTimeout(graphAutoTimer);
      graphAutoTimer = setTimeout(() => { graphAutoRotate = true; }, 2200);
    };
    window.addEventListener('mousemove', _graphMoveFn);
    window.addEventListener('mouseup',   _graphUpFn);
    setTimeout(() => initGraph(null), 60);
  }

  function closeGraphModal() {
    document.getElementById('graphModal').classList.remove('active');
    if (graphAnimId) { cancelAnimationFrame(graphAnimId); graphAnimId = null; }
    if (_graphMoveFn) { window.removeEventListener('mousemove', _graphMoveFn); _graphMoveFn = null; }
    if (_graphUpFn)   { window.removeEventListener('mouseup',   _graphUpFn);   _graphUpFn   = null; }
    graphHoveredId  = null;
    graphIsDragging = false;
    graphAutoRotate = true;
    clearTimeout(graphAutoTimer);
  }

  function handleGraphOverlayClick(e) {
    if (e.target === document.getElementById('graphModal')) closeGraphModal();
  }

  function initGraph(subjFocus) {
    if (graphAnimId) { cancelAnimationFrame(graphAnimId); graphAnimId = null; }
    graphSubjFocus  = subjFocus || null;
    graphRotX       = 12; graphRotY       = 0;
    graphTargetRotX = 12; graphTargetRotY = 0;
    graphAutoRotate = true;
    graphHoveredId  = null;
    graphIsDragging = false;
    graphPulseT     = {};

    const container = document.getElementById('graphContainer');
    const W = container.clientWidth  || 900;
    const H = container.clientHeight || 600;

    graphNodes = sessions.map((s, i) => {
      const angle = (i / sessions.length) * Math.PI * 2 - Math.PI / 2;
      const r     = Math.min(W, H) * 0.27 + (Math.random() - 0.5) * 50;
      return {
        id: s.id, session: s,
        x: W/2 + r * Math.cos(angle),
        y: H/2 + r * Math.sin(angle),
        vx: 0, vy: 0, fx: 0, fy: 0,
        degree: 0, r: 14, z: 0,
      };
    });

    const nodeMap2 = new Map(graphNodes.map(n => [n.id, n]));
    graphEdges = links
      .filter(l => nodeMap2.has(l.from_id) && nodeMap2.has(l.to_id))
      .map(l => ({
        source:   nodeMap2.get(l.from_id),
        target:   nodeMap2.get(l.to_id),
        relation: l.relation,
        id:       l.id,
      }));
    graphEdges.forEach(e => { e.source.degree++; e.target.degree++; });

    graphNodes.forEach(n => {
      n.r = Math.min(32, Math.max(12, 14 + n.degree * 3));
      const jitter = (Math.random() - 0.5) * 60;
      n.z = Math.min(120, Math.max(-150, 80 - n.degree * 25 + jitter));
    });

    graphEdges.forEach((_, i) => { graphPulseT[i] = Math.random(); });

    buildGraph3D(container);
    initGraphParticles(W, H);
    renderGraphSubjBar();
    if (subjFocus) applySubjFocus(subjFocus);
    startGraphLoop();
  }

  function buildGraph3D(container) {
    container.innerHTML = '';
    const W = container.clientWidth  || 900;
    const H = container.clientHeight || 600;

    // Particle canvas (z-index 1, below scene)
    const partCanvas = document.createElement('canvas');
    partCanvas.width = W; partCanvas.height = H;
    partCanvas.style.cssText = 'position:absolute;inset:0;z-index:1;pointer-events:none';
    container.appendChild(partCanvas);
    graphPartCtx = partCanvas.getContext('2d');

    // 3D scene (perspective container, z-index 2)
    const scene = document.createElement('div');
    scene.style.cssText = 'position:absolute;inset:0;z-index:2;perspective:1000px;perspective-origin:50% 48%;overflow:hidden;cursor:grab';
    container.appendChild(scene);

    // Graph pivot (preserve-3d, rotated by JS each frame)
    const pivot = document.createElement('div');
    pivot.style.cssText = 'position:absolute;left:50%;top:50%;transform-style:preserve-3d';
    scene.appendChild(pivot);
    graphPivotEl = pivot;

    // Build node wrappers + visuals
    graphDomMap = {};
    graphNodes.forEach(n => {
      const size   = n.r * 2;
      const period = (3.8 + Math.random() * 2.4).toFixed(2) + 's';
      const delay  = (-Math.random() * 5).toFixed(2) + 's';
      const col    = getSubjectColor(n.session.subject);
      const c      = col.border;

      const nw = document.createElement('div');
      nw.className = 'graph-nw';
      nw.style.transform = `translate3d(${n.x}px,${n.y}px,${n.z}px)`;
      pivot.appendChild(nw);
      graphDomMap[n.id] = { nw };

      const nv = document.createElement('div');
      nv.className = 'graph-nv';
      nv.style.cssText = [
        `width:${size}px`,
        `height:${size}px`,
        `background:radial-gradient(circle at 38% 32%,rgba(255,255,255,0.42) 0%,${c} 35%,rgba(0,0,0,0.5) 100%)`,
        `box-shadow:0 0 ${n.r}px ${Math.round(n.r*0.6)}px ${c}80,0 0 ${n.r*2.5}px ${n.r}px ${c}38,0 0 ${n.r*5}px ${n.r*2}px ${c}16`,
        `--glow:${c}`,
        `--period:${period}`,
        `--delay:${delay}`,
        `animation:graph-breathe ${period} ease-in-out ${delay} infinite`,
      ].join(';');
      nw.appendChild(nv);
      graphDomMap[n.id].nv = nv;

      nv.addEventListener('mouseenter', () => onGraphNodeHover(n.id));
      nv.addEventListener('mouseleave', () => onGraphNodeUnhover());
      nv.addEventListener('click', () => {
        closeGraphModal();
        setTimeout(() => openDayModal(n.session.studiedDate), 50);
      });
    });

    // Connection canvas (z-index 3, above scene)
    const connCanvas = document.createElement('canvas');
    connCanvas.width = W; connCanvas.height = H;
    connCanvas.style.cssText = 'position:absolute;inset:0;z-index:3;pointer-events:none';
    container.appendChild(connCanvas);
    graphConnCtx = connCanvas.getContext('2d');

    // Label layer (z-index 4)
    const labelLayer = document.createElement('div');
    labelLayer.style.cssText = 'position:absolute;inset:0;z-index:4;pointer-events:none';
    container.appendChild(labelLayer);
    graphNodes.forEach(n => {
      const lbl   = document.createElement('div');
      lbl.className = 'graph-label';
      const topic = n.session.topic.length > 22 ? n.session.topic.slice(0,20)+'…' : n.session.topic;
      const col   = getSubjectColor(n.session.subject);
      lbl.innerHTML =
        `<div class="graph-label-name">${topic}</div>` +
        `<div class="graph-label-sub">${n.session.subject || ''}</div>` +
        `<div class="graph-label-links" style="color:${col.border}88">${n.degree} link${n.degree!==1?'s':''}</div>`;
      labelLayer.appendChild(lbl);
      graphDomMap[n.id].lbl = lbl;
    });

    // Info panel (z-index 5)
    const panel = document.createElement('div');
    panel.id = 'graphPanel';
    container.appendChild(panel);

    // Drag on the scene div
    scene.addEventListener('mousedown', e => {
      if (e.target.classList.contains('graph-nv')) return;
      graphIsDragging = true;
      graphLastMX = e.clientX;
      graphLastMY = e.clientY;
      graphAutoRotate = false;
      clearTimeout(graphAutoTimer);
      scene.style.cursor = 'grabbing';
    });
  }

  function initGraphParticles(W, H) {
    graphStars = Array.from({length: 200}, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.1,
      a: 0.1 + Math.random() * 0.5,
      tw:  Math.random() * Math.PI * 2,
      tws: 0.005 + Math.random() * 0.02,
    }));
    const MOTE_COLS = ['#818cf8','#34d399','#fb923c','#f472b6','#2dd4bf'];
    graphMotes = Array.from({length: 35}, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 0.8 + Math.random() * 2,
      vx: (Math.random()-0.5) * 0.22,
      vy: (Math.random()-0.5) * 0.16,
      a:  0.04 + Math.random() * 0.12,
      c:  MOTE_COLS[Math.floor(Math.random()*5)],
    }));
  }

  function drawGraphParticles() {
    if (!graphPartCtx) return;
    const ctx = graphPartCtx;
    const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.clearRect(0, 0, W, H);
    graphStars.forEach(s => {
      s.tw += s.tws;
      const a = s.a * (0.6 + 0.4 * Math.sin(s.tw));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
      ctx.fill();
    });
    graphMotes.forEach(m => {
      m.x = ((m.x + m.vx) + W) % W;
      m.y = ((m.y + m.vy) + H) % H;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI*2);
      ctx.fillStyle = m.c + Math.round(m.a*255).toString(16).padStart(2,'0');
      ctx.fill();
    });
  }

  function drawGraphConnections(dt) {
    if (!graphConnCtx) return;
    const ctx  = graphConnCtx;
    const W    = ctx.canvas.width, H = ctx.canvas.height;
    const cRef = ctx.canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';

    graphEdges.forEach((e, i) => {
      const avEl = graphDomMap[e.source.id]?.nv;
      const bvEl = graphDomMap[e.target.id]?.nv;
      if (!avEl || !bvEl) return;

      const ar = avEl.getBoundingClientRect();
      const br = bvEl.getBoundingClientRect();
      const ax = ar.left + ar.width/2  - cRef.left;
      const ay = ar.top  + ar.height/2 - cRef.top;
      const bx = br.left + br.width/2  - cRef.left;
      const by = br.top  + br.height/2 - cRef.top;

      let op = graphHoveredId
        ? (graphHoveredId === e.source.id || graphHoveredId === e.target.id ? 1.0 : 0.06)
        : 0.55;

      if (graphSubjFocus) {
        const inFocus = e.source.session.subject === graphSubjFocus ||
                        e.target.session.subject === graphSubjFocus;
        if (!inFocus) op = Math.min(op, 0.06);
      }

      const col  = GRAPH_EDGE_COLORS[e.relation] || '#818cf8';
      const hex2 = v => Math.round(v*255).toString(16).padStart(2,'0');

      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by);
      ctx.strokeStyle = col + hex2(op*0.18); ctx.lineWidth = 7; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by);
      ctx.strokeStyle = col + hex2(op*0.35); ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by);
      ctx.strokeStyle = col + hex2(op*0.70); ctx.lineWidth = 1; ctx.stroke();

      if (op > 0.1) {
        const isActive = graphHoveredId === e.source.id || graphHoveredId === e.target.id;
        graphPulseT[i] = ((graphPulseT[i] || Math.random()) + dt * (isActive ? 0.9 : 0.35)) % 1;
        const t  = graphPulseT[i];
        const px = ax + (bx-ax)*t, py = ay + (by-ay)*t;
        const grad = ctx.createRadialGradient(px, py, 0, px, py, 9);
        grad.addColorStop(0,   col+'ff');
        grad.addColorStop(0.4, col+'aa');
        grad.addColorStop(1,   col+'00');
        ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI*2);
        ctx.fillStyle = grad; ctx.fill();
        ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI*2);
        ctx.fillStyle = '#fff'; ctx.fill();
      }
    });
  }

  function updateGraphLabels() {
    if (!graphConnCtx) return;
    const cRef = graphConnCtx.canvas.getBoundingClientRect();
    graphNodes.forEach(n => {
      const { lbl, nv: nvEl } = graphDomMap[n.id] || {};
      if (!lbl || !nvEl) return;
      const r  = nvEl.getBoundingClientRect();
      const cx = r.left + r.width/2  - cRef.left;
      const cy = r.top  + r.height/2 - cRef.top;
      const apparentR = r.width / 2;
      const scale = Math.max(0.55, Math.min(1, apparentR / n.r));
      lbl.style.left      = cx + 'px';
      lbl.style.top       = (cy + apparentR + 10) + 'px';
      lbl.style.transform = `translate(-50%,0) scale(${scale.toFixed(3)})`;
    });
  }

  function startGraphLoop() {
    graphLastTs = 0;
    const container = document.getElementById('graphContainer');
    const W = graphConnCtx ? graphConnCtx.canvas.width  : 900;
    const H = graphConnCtx ? graphConnCtx.canvas.height : 600;
    const cx0 = W / 2, cy0 = H / 2;

    function step(ts) {
      if (!document.getElementById('graphModal').classList.contains('active')) {
        graphAnimId = null; return;
      }
      const dt = Math.min((ts - (graphLastTs || ts)) / 1000, 0.05);
      graphLastTs = ts;

      if (graphAutoRotate) graphTargetRotY += 6 * dt;
      graphRotX += (graphTargetRotX - graphRotX) * 0.08;
      graphRotY += (graphTargetRotY - graphRotY) * 0.08;
      if (graphPivotEl) {
        graphPivotEl.style.transform =
          `rotateX(${graphRotX.toFixed(3)}deg) rotateY(${graphRotY.toFixed(3)}deg)`;
      }

      graphNodes.forEach(n => { n.fx = 0; n.fy = 0; });

      for (let i = 0; i < graphNodes.length; i++) {
        for (let j = i+1; j < graphNodes.length; j++) {
          const a = graphNodes[i], b = graphNodes[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d2 = Math.max(64, dx*dx + dy*dy);
          const d  = Math.sqrt(d2);
          const f  = GRAPH.repel / d2;
          const fx = f*dx/d, fy = f*dy/d;
          a.fx -= fx; a.fy -= fy;
          b.fx += fx; b.fy += fy;
        }
      }

      graphEdges.forEach(e => {
        const dx = e.target.x - e.source.x, dy = e.target.y - e.source.y;
        const d  = Math.max(1, Math.sqrt(dx*dx + dy*dy));
        const f  = GRAPH.spring * (d - GRAPH.springLen);
        const fx = f*dx/d, fy = f*dy/d;
        e.source.fx += fx; e.source.fy += fy;
        e.target.fx -= fx; e.target.fy -= fy;
      });

      graphNodes.forEach(n => {
        n.fx += GRAPH.gravity * (cx0 - n.x);
        n.fy += GRAPH.gravity * (cy0 - n.y);
      });

      graphNodes.forEach(n => {
        n.vx = (n.vx + n.fx) * GRAPH.damping;
        n.vy = (n.vy + n.fy) * GRAPH.damping;
        n.x += n.vx; n.y += n.vy;
        graphDomMap[n.id].nw.style.transform =
          `translate3d(${n.x.toFixed(1)}px,${n.y.toFixed(1)}px,${n.z}px)`;
      });

      drawGraphParticles();
      drawGraphConnections(dt);
      updateGraphLabels();

      graphAnimId = requestAnimationFrame(step);
    }

    graphAnimId = requestAnimationFrame(step);
  }

  function onGraphNodeHover(id) {
    graphHoveredId = id;
    graphAutoRotate = false;
    clearTimeout(graphAutoTimer);

    const vis = graphDomMap[id]?.nv;
    if (vis) {
      vis.classList.remove('graph-nv-excited');
      void vis.offsetWidth;
      vis.classList.add('graph-nv-excited');
    }

    const connectedIds = new Set();
    graphEdges.forEach(e => {
      if (e.source.id === id) connectedIds.add(e.target.id);
      if (e.target.id === id) connectedIds.add(e.source.id);
    });

    let i = 0;
    connectedIds.forEach(lid => {
      setTimeout(() => {
        const lv = graphDomMap[lid]?.nv;
        if (!lv) return;
        lv.classList.remove('graph-nv-excited');
        void lv.offsetWidth;
        lv.classList.add('graph-nv-excited');
      }, 200 + (i++) * 120);
    });

    const visibleIds = new Set([id, ...connectedIds]);
    graphNodes.forEach(n => {
      const { nv, lbl } = graphDomMap[n.id] || {};
      const dim = !visibleIds.has(n.id);
      if (nv)  nv.style.filter   = dim ? 'brightness(0.15) saturate(0.3)' : '';
      if (lbl) lbl.style.opacity  = dim ? '0.08' : '1';
    });

    openGraphPanel(id);
  }

  function onGraphNodeUnhover() {
    graphHoveredId = null;
    graphNodes.forEach(n => {
      const { nv, lbl } = graphDomMap[n.id] || {};
      if (nv)  nv.style.filter  = '';
      if (lbl) lbl.style.opacity = '';
    });
    const panel = document.getElementById('graphPanel');
    if (panel) panel.className = '';
    clearTimeout(graphAutoTimer);
    graphAutoTimer = setTimeout(() => { graphAutoRotate = true; }, 1200);
  }

  function openGraphPanel(id) {
    const node  = graphNodes.find(n => n.id === id);
    const panel = document.getElementById('graphPanel');
    if (!panel || !node) return;
    const col   = getSubjectColor(node.session.subject);
    const conns = graphEdges
      .filter(e => e.source.id === id || e.target.id === id)
      .map(e => {
        const otherId = e.source.id === id ? e.target.id : e.source.id;
        return graphNodes.find(n => n.id === otherId);
      })
      .filter(Boolean);
    panel.innerHTML =
      `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">` +
        `<span style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:${col.border};box-shadow:0 0 6px ${col.border}"></span>` +
        `<span style="font-size:13px;font-weight:600;color:#f0f0ff;letter-spacing:0.5px">${node.session.topic}</span>` +
      `</div>` +
      `<div style="font-size:10px;color:rgba(255,255,255,0.36);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px">${node.session.subject || 'Untagged'}</div>` +
      `<div style="height:1px;background:rgba(255,255,255,0.06);margin-bottom:10px"></div>` +
      `<div style="font-size:10px;color:rgba(255,255,255,0.44);margin-bottom:6px">Connections: <span style="color:rgba(255,255,255,0.82)">${node.degree}</span></div>` +
      conns.map(cn =>
        `<div style="font-size:9px;color:rgba(255,255,255,0.28);padding:2px 0;letter-spacing:0.5px">→ ${cn.session.topic}</div>`
      ).join('');
    panel.className = 'graph-panel-visible';
  }

  function applySubjFocus(subj) {
    graphSubjFocus = subj || null;
    graphNodes.forEach(n => {
      const { nv, lbl } = graphDomMap[n.id] || {};
      const dim = subj && n.session.subject !== subj;
      if (nv)  nv.style.filter   = dim ? 'brightness(0.12) saturate(0.2)' : '';
      if (lbl) lbl.style.opacity  = dim ? '0.06' : '';
    });
  }

  function renderGraphSubjBar() {
    const bar = document.getElementById('graphSubjBar');
    if (!bar) return;
    bar.innerHTML = '';
    const subjects = [...new Set(sessions.map(s => s.subject).filter(Boolean))].sort();
    if (!subjects.length) return;

    const allBtn = document.createElement('button');
    allBtn.className = 'graph-pill' + (graphSubjFocus === null ? ' active' : '');
    allBtn.textContent = 'All';
    allBtn.onclick = () => { graphSubjFocus = null; applySubjFocus(null); renderGraphSubjBar(); };
    bar.appendChild(allBtn);

    subjects.forEach(subj => {
      const col = getSubjectColor(subj);
      const btn = document.createElement('button');
      btn.className = 'graph-pill' + (graphSubjFocus === subj ? ' active' : '');
      btn.textContent = subj;
      if (graphSubjFocus === subj) {
        btn.style.background  = col.bg;
        btn.style.color       = col.text;
        btn.style.borderColor = col.border;
      }
      btn.onclick = () => {
        graphSubjFocus = graphSubjFocus === subj ? null : subj;
        applySubjFocus(graphSubjFocus);
        renderGraphSubjBar();
      };
      bar.appendChild(btn);
    });
  }

  // ── Second brain links ───────────────────────────────────

  const LINK_RELATIONS = {
    'related':     { label: 'Related to',      inverse: 'Related to' },
    'builds-on':   { label: 'Builds on',        inverse: 'Built on by' },
    'prerequisite':{ label: 'Prerequisite of',  inverse: 'Required by' },
    'see-also':    { label: 'See also',         inverse: 'See also' },
  };

  function getLinksForSession(sessionId) {
    return links
      .filter(l => l.from_id === sessionId || l.to_id === sessionId)
      .map(l => {
        const isFrom   = l.from_id === sessionId;
        const otherId  = isFrom ? l.to_id : l.from_id;
        const relDef   = LINK_RELATIONS[l.relation] || LINK_RELATIONS['related'];
        const relLabel = isFrom ? relDef.label : relDef.inverse;
        const other    = sessions.find(s => s.id === otherId);
        return { linkId: l.id, relLabel, other };
      })
      .filter(x => x.other); // discard orphans (deleted sessions)
  }

  function renderSessionLinks(container, sessionId) {
    const sessionLinks = getLinksForSession(sessionId);
    const wrap = document.createElement('div');
    wrap.className = 'session-links';

    sessionLinks.forEach(({ linkId, relLabel, other }) => {
      const item = document.createElement('div');
      item.className = 'link-item';
      item.innerHTML =
        `<span class="link-rel-badge">${relLabel}</span>` +
        `<span class="link-target-topic" title="${other.topic}${other.subject ? ' · ' + other.subject : ''}"
               onclick="closeDayModal();openDayModal('${other.studiedDate}')">${other.topic}</span>` +
        (other.subject ? `<span class="link-target-subject">${other.subject}</span>` : '') +
        `<button class="link-remove-btn" title="Remove link" onclick="deleteLink('${linkId}','${sessionId}')">×</button>`;
      wrap.appendChild(item);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'add-link-btn';
    addBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 5.5h3M5.5 4v3"/><path d="M7.5 3.5l1.5-1.5a1.414 1.414 0 012 2L9.5 5.5"/><path d="M3.5 7.5L2 9a1.414 1.414 0 01-2-2L1.5 5.5"/></svg> Link topic';
    addBtn.onclick = () => openLinkModal(sessionId);
    wrap.appendChild(addBtn);

    container.appendChild(wrap);
  }

  function openLinkModal(sessionId) {
    linkingSessionId     = sessionId;
    selectedLinkTargetId = null;
    selectedLinkRelation = 'related';

    // Build relation picker
    const picker = document.getElementById('linkRelationPicker');
    picker.innerHTML = '';
    Object.entries(LINK_RELATIONS).forEach(([key, def]) => {
      const btn = document.createElement('button');
      btn.className = 'link-rel-option' + (key === 'related' ? ' selected' : '');
      btn.textContent = def.label;
      btn.dataset.rel = key;
      btn.onclick = () => {
        selectedLinkRelation = key;
        picker.querySelectorAll('.link-rel-option').forEach(b => b.classList.toggle('selected', b.dataset.rel === key));
      };
      picker.appendChild(btn);
    });

    document.getElementById('linkSearchInput').value = '';
    renderLinkSearch('');
    document.getElementById('linkModal').classList.add('active');
    setTimeout(() => document.getElementById('linkSearchInput').focus(), 220);
  }

  function closeLinkModal() {
    document.getElementById('linkModal').classList.remove('active');
    linkingSessionId = selectedLinkTargetId = null;
  }

  function renderLinkSearch(query) {
    const q    = query.trim().toLowerCase();
    const list = document.getElementById('linkSessionList');
    list.innerHTML = '';

    // Already-linked session IDs (exclude from picker)
    const alreadyLinked = new Set(
      links.filter(l => l.from_id === linkingSessionId || l.to_id === linkingSessionId)
           .map(l => l.from_id === linkingSessionId ? l.to_id : l.from_id)
    );

    const candidates = sessions.filter(s =>
      s.id !== linkingSessionId &&
      !alreadyLinked.has(s.id) &&
      (!q || s.topic.toLowerCase().includes(q) || (s.subject || '').toLowerCase().includes(q))
    );

    if (!candidates.length) {
      list.innerHTML = `<div class="link-empty">${q ? 'No matches' : 'No other sessions to link'}</div>`;
      return;
    }

    candidates.slice(0, 30).forEach(s => {
      const opt = document.createElement('div');
      opt.className = 'link-session-option' + (s.id === selectedLinkTargetId ? ' selected' : '');
      opt.innerHTML =
        `<div class="link-session-option-topic">${s.topic}</div>` +
        `<div class="link-session-option-sub">${[s.subject, s.studiedDate].filter(Boolean).join(' · ')}</div>`;
      opt.onclick = () => {
        selectedLinkTargetId = s.id;
        list.querySelectorAll('.link-session-option').forEach(o => o.classList.toggle('selected', o === opt));
        document.getElementById('linkSaveBtn').disabled = false;
      };
      list.appendChild(opt);
    });
  }

  async function saveLink() {
    if (!linkingSessionId || !selectedLinkTargetId) return;
    const btn = document.getElementById('linkSaveBtn');
    btn.disabled = true;
    const res = await authFetch('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromId: linkingSessionId, toId: selectedLinkTargetId, relation: selectedLinkRelation })
    });
    if (res.ok) {
      const data = await res.json();
      links.push({ id: data.id, user_id: '', from_id: linkingSessionId, to_id: selectedLinkTargetId, relation: selectedLinkRelation });
      closeLinkModal();
      // Refresh the day modal to show the new link
      if (currentDayDate) openDayModal(currentDayDate);
      showToast('Link saved');
    } else {
      const err = await res.json();
      showToast(err.error || 'Could not save link');
      btn.disabled = false;
    }
  }

  async function deleteLink(linkId, sessionId) {
    await authFetch(`/api/links/${linkId}`, { method: 'DELETE' });
    links = links.filter(l => l.id !== linkId);
    if (currentDayDate) openDayModal(currentDayDate);
    showToast('Link removed');
  }
