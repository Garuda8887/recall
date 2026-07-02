// ── Overlay click-outside ────────────────────────────────
  function handleOverlayClick(e, id) {
    if (e.target === document.getElementById(id)) {
      ({ addModal: closeAddModal, dayModal: closeDayModal,
         statsModal: closeStats, settingsModal: closeSettings,
         cardSearchModal: closeCardSearch,
         attachViewerModal: closeAttachViewer })[id]?.();
    }
  }

  // ── Keyboard ─────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      clearSearch(); closeAddModal(); closeDayModal(); closeStats(); closeSettings();
      closeCurveModal(); closeLinkModal(); closeGraphModal();
      closeDeckPrompt(); closeDeckModal(); closeStudyModal(); closeCardSearch();
      closeSidebar(); closeAttachViewer();
    }
    // Study modal keyboard navigation
    if (studyState) {
      // 1-5 to rate current card when flipped
      if (studyState.flipped && !e.metaKey && !e.ctrlKey) {
        const n = parseInt(e.key);
        if (n >= 1 && n <= 5) { e.preventDefault(); rateCard(n); return; }
      }
      if (e.key === ' ' || (e.key === 'Enter' && document.activeElement.tagName !== 'BUTTON')) {
        e.preventDefault();
        if (!studyState.flipped) flipCard();
        return;
      }
      if (e.key === 'ArrowRight') { e.preventDefault(); if (!studyState.flipped) flipCard(); else nextCard(); return; }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); prevCard(); return; }
    }
    if (e.key === 'Enter' && document.getElementById('addModal').classList.contains('active'))
      if (document.activeElement.tagName !== 'TEXTAREA') saveStudySession();
    if (!document.querySelector('.modal-overlay.active')) {
      if (e.key === 'ArrowLeft')  prevMonth();
      if (e.key === 'ArrowRight') nextMonth();
      const activeTag = document.activeElement.tagName;
      if ((e.key === 'n' || e.key === 'N') && !['INPUT','TEXTAREA'].includes(activeTag))
        openAddModal();
      if ((e.key === 'f' || e.key === 'F') && !['INPUT','TEXTAREA'].includes(activeTag)) {
        e.preventDefault(); openCardSearch(); return;
      }
      // / or Cmd+K → focus search
      if (e.key === '/' && !['INPUT','TEXTAREA'].includes(activeTag)) {
        e.preventDefault();
        focusSearch();
      }
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        focusSearch();
      }
    }
    // Card search input live search
    if (document.getElementById('cardSearchModal').classList.contains('active') &&
        document.activeElement === document.getElementById('cardSearchInput')) {
      requestAnimationFrame(searchCards);
    }
  });

  // ── Swipe gestures (month navigation) ────────────────────
  (() => {
    let startX = null, startY = null;
    const cal  = document.querySelector('.calendar-container');

    cal.addEventListener('touchstart', e => {
      startX = e.changedTouches[0].clientX;
      startY = e.changedTouches[0].clientY;
    }, { passive: true });

    cal.addEventListener('touchend', e => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      // Only register horizontal swipes wider than 50px that are more horizontal than vertical
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (document.querySelector('.modal-overlay.active')) return; // ignore while modal open
        dx < 0 ? nextMonth() : prevMonth();
      }
      startX = null;
    }, { passive: true });
  })();

  // ── Nav ──────────────────────────────────────────────────
  function prevMonth() {
    if (currentMonth === 0) { currentMonth = 11; currentYear--; } else currentMonth--;
    renderCalendar();
  }

  function nextMonth() {
    if (currentMonth === 11) { currentMonth = 0; currentYear++; } else currentMonth++;
    renderCalendar();
  }

  function goToToday() {
    const d = new Date();
    currentYear = d.getFullYear();
    currentMonth = d.getMonth();
    renderCalendar();
  }

  // ── Toast ─────────────────────────────────────────────────
  let toastTimer;
  function showToast(msg) {
    clearTimeout(toastTimer);
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
  }

  // ── Sidebar ──────────────────────────────────────────────
  function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('open');
    // Populate subject dropdown from live sessions
    const sel = document.getElementById('examSubjectSelect');
    const prev = sel.value;
    sel.innerHTML = '<option value="">No subject</option>';
    [...new Set(sessions.map(s => s.subject).filter(Boolean))].sort().forEach(subj => {
      const opt = document.createElement('option');
      opt.value = subj; opt.textContent = subj;
      if (subj === prev) opt.selected = true;
      sel.appendChild(opt);
    });
    renderExams();
  }

  function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('open');
    // Reset form state
    document.getElementById('examForm').style.display = 'none';
    document.getElementById('examAddBtn').textContent = '+ Add';
  }

  // ── Exams ────────────────────────────────────────────────
  let exams = [];

  function loadExams() {
    try { exams = JSON.parse(localStorage.getItem('recall_exams') || '[]'); }
    catch { exams = []; }
  }

  function persistExams() {
    localStorage.setItem('recall_exams', JSON.stringify(exams));
  }

  function toggleExamForm() {
    const form   = document.getElementById('examForm');
    const addBtn = document.getElementById('examAddBtn');
    const isOpen = form.style.display !== 'none';
    form.style.display = isOpen ? 'none' : '';
    addBtn.textContent  = isOpen ? '+ Add' : 'Cancel';
    if (!isOpen) {
      document.getElementById('examNameInput').value = '';
      document.getElementById('examDateInput').value = '';
      document.getElementById('examSubjectSelect').value = '';
      document.getElementById('examSaveBtn').disabled = true;
      setTimeout(() => document.getElementById('examNameInput').focus(), 50);
    }
  }

  function validateExamForm() {
    const name = document.getElementById('examNameInput').value.trim();
    const date = document.getElementById('examDateInput').value;
    document.getElementById('examSaveBtn').disabled = !(name && date);
  }

  function saveExam() {
    const name    = document.getElementById('examNameInput').value.trim();
    const date    = document.getElementById('examDateInput').value;
    const subject = document.getElementById('examSubjectSelect').value || null;
    if (!name || !date) return;
    exams.push({ id: crypto.randomUUID(), name, date, subject });
    exams.sort((a, b) => a.date.localeCompare(b.date));
    persistExams();
    toggleExamForm();
    renderExams();
  }

  function deleteExam(id) {
    exams = exams.filter(e => e.id !== id);
    persistExams();
    renderExams();
  }

  function examCountdown(dateStr) {
    const today = todayStr();
    const diff  = Math.round((new Date(dateStr + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
    if (diff === 0) return { label: 'Today!',    cls: 'exam-today' };
    if (diff === 1) return { label: 'Tomorrow',  cls: 'exam-soon'  };
    if (diff  >  1) return { label: `${diff} days`, cls: diff <= 7 ? 'exam-soon' : '' };
    return { label: `${Math.abs(diff)}d ago`, cls: 'exam-past' };
  }

  function makeExamCard(exam) {
    const { label, cls } = examCountdown(exam.date);
    const col = exam.subject ? getSubjectColor(exam.subject) : null;
    const card = document.createElement('div');
    card.className = 'exam-card';
    const subjHtml = col
      ? `<span class="exam-subject-badge" style="background:${col.bg};color:${col.text};border-color:${col.border}">${exam.subject}</span>`
      : '';
    card.innerHTML =
      `<div class="exam-card-top">
         <span class="exam-card-name">${escHtml(exam.name)}</span>
         <button class="exam-del-btn" title="Delete" onclick="deleteExam('${exam.id}')">×</button>
       </div>
       <div class="exam-card-bottom">
         ${subjHtml}
         <span class="exam-countdown ${cls}">${label}</span>
       </div>`;
    return card;
  }

  function renderExams() {
    const list = document.getElementById('examList');
    if (!list) return;
    const today    = todayStr();
    const upcoming = exams.filter(e => e.date >= today);
    const past     = exams.filter(e => e.date <  today);

    list.innerHTML = '';

    if (!upcoming.length && !past.length) {
      list.innerHTML = '<div class="exam-empty">No exams added yet</div>';
      return;
    }

    upcoming.forEach(e => list.appendChild(makeExamCard(e)));

    if (past.length) {
      const toggle = document.createElement('div');
      toggle.className = 'exam-past-toggle';
      toggle.innerHTML = `Past (${past.length}) ▼`;
      list.appendChild(toggle);
      const pastWrap = document.createElement('div');
      pastWrap.style.display = 'none';
      past.slice().reverse().forEach(e => {
        const c = makeExamCard(e);
        c.classList.add('exam-card-past');
        pastWrap.appendChild(c);
      });
      list.appendChild(pastWrap);
      toggle.onclick = () => {
        const open = pastWrap.style.display !== 'none';
        pastWrap.style.display = open ? 'none' : '';
        toggle.innerHTML = `Past (${past.length}) ${open ? '▼' : '▲'}`;
      };
    }
  }

  // ── Text-to-speech ───────────────────────────────────────
  function speakText(text) {
    if (!window.speechSynthesis) return;
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }

  // ── Init ──────────────────────────────────────────────────
  initDark();

  const now = new Date();
  currentYear  = now.getFullYear();
  currentMonth = now.getMonth();

  loadExams();
  Promise.all([loadSessions(), loadSettings(), loadDecks()]).then(() => renderCalendar());

  // ── Service Worker — unregister all to prevent stale cache ──
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.unregister());
    });
  }

  // ── Sakura Particle Engine ────────────────────────────────
  (function() {
    const cnv = document.createElement('canvas');
    Object.assign(cnv.style, {
      position:'fixed', top:'0', left:'0', width:'100%', height:'100%',
      pointerEvents:'none', zIndex:'1'
    });
    document.body.appendChild(cnv);
    const cx = cnv.getContext('2d');

    let W, H;
    const resize = () => { W = cnv.width = innerWidth; H = cnv.height = innerHeight; };
    window.addEventListener('resize', resize);
    resize();

    const R  = (a,b) => a + Math.random()*(b-a);
    const Ri = (a,b) => Math.floor(R(a,b));
    let raf = null, pts = [], activeCfg = null, activeCfgId = null;

    const SAKURA = {
      count:28,
      spawn:()=>({x:R(0,W),y:R(-H,-10),vx:R(0.25,0.85),vy:R(0.7,1.7),
        sz:R(5,12),rot:R(0,Math.PI*2),rotV:R(-0.055,0.055),
        sw:R(0,Math.PI*2),swV:R(0.016,0.038),
        a:R(0.4,0.85),h:R(336,356),s:R(55,75),l:R(72,89)}),
      update(p){p.sw+=p.swV;p.x+=p.vx+Math.sin(p.sw)*.7;p.y+=p.vy;p.rot+=p.rotV;if(p.y>H+20){p.y=R(-100,-10);p.x=R(0,W);}},
      draw(p){
        cx.save();cx.translate(p.x,p.y);cx.rotate(p.rot);cx.globalAlpha=p.a;
        cx.fillStyle=`hsl(${p.h},${p.s}%,${p.l}%)`;
        cx.beginPath();
        cx.moveTo(0,-p.sz);
        cx.bezierCurveTo( p.sz*.9,-p.sz*.4, p.sz*.9, p.sz*.4,0, p.sz);
        cx.bezierCurveTo(-p.sz*.9, p.sz*.4,-p.sz*.9,-p.sz*.4,0,-p.sz);
        cx.fill();cx.restore();
      }
    };

    const WISTERIA = {
      count:30,
      spawn:()=>({x:R(0,W),y:R(-H,-10),vx:R(-0.2,0.6),vy:R(0.5,1.3),
        sz:R(4,9),rot:R(0,Math.PI*2),rotV:R(-0.035,0.035),
        sw:R(0,Math.PI*2),swV:R(0.012,0.028),
        a:R(0.3,0.70),h:R(262,286),s:R(62,80),l:R(78,92)}),
      update(p){p.sw+=p.swV;p.x+=p.vx+Math.sin(p.sw)*.5;p.y+=p.vy;p.rot+=p.rotV;if(p.y>H+20){p.y=R(-100,-10);p.x=R(0,W);}},
      draw(p){
        cx.save();cx.translate(p.x,p.y);cx.rotate(p.rot);cx.globalAlpha=p.a;
        cx.fillStyle=`hsl(${p.h},${p.s}%,${p.l}%)`;
        cx.beginPath();
        cx.moveTo(0,-p.sz*1.1);
        cx.bezierCurveTo(p.sz*.7,-p.sz*.4, p.sz*.7,p.sz*.7, 0,p.sz*1.1);
        cx.bezierCurveTo(-p.sz*.7,p.sz*.7,-p.sz*.7,-p.sz*.4, 0,-p.sz*1.1);
        cx.fill();cx.restore();
      }
    };

    const PEACH = {
      count:26,
      spawn:()=>({x:R(0,W),y:R(-H,-10),vx:R(0.15,0.80),vy:R(0.6,1.5),
        sz:R(5,11),rot:R(0,Math.PI*2),rotV:R(-0.045,0.045),
        sw:R(0,Math.PI*2),swV:R(0.018,0.034),
        a:R(0.35,0.80),h:R(16,36),s:R(70,88),l:R(78,92)}),
      update(p){p.sw+=p.swV;p.x+=p.vx+Math.sin(p.sw)*.65;p.y+=p.vy;p.rot+=p.rotV;if(p.y>H+20){p.y=R(-100,-10);p.x=R(0,W);}},
      draw(p){
        cx.save();cx.translate(p.x,p.y);cx.rotate(p.rot);cx.globalAlpha=p.a;
        cx.fillStyle=`hsl(${p.h},${p.s}%,${p.l}%)`;
        cx.beginPath();
        cx.moveTo(0,-p.sz);
        cx.bezierCurveTo(p.sz*1.0,-p.sz*.3, p.sz*1.0,p.sz*.3, 0,p.sz);
        cx.bezierCurveTo(-p.sz*1.0,p.sz*.3,-p.sz*1.0,-p.sz*.3, 0,-p.sz);
        cx.fill();cx.restore();
      }
    };

    const MOONLIT = {
      count:24,
      spawn:()=>({x:R(0,W),y:R(-H,-10),vx:R(0.15,0.65),vy:R(0.55,1.4),
        sz:R(5,11),rot:R(0,Math.PI*2),rotV:R(-0.040,0.040),
        sw:R(0,Math.PI*2),swV:R(0.014,0.032),
        a:R(0.35,0.80),h:R(316,346),s:R(72,92),l:R(62,80)}),
      update(p){p.sw+=p.swV;p.x+=p.vx+Math.sin(p.sw)*.7;p.y+=p.vy;p.rot+=p.rotV;if(p.y>H+20){p.y=R(-100,-10);p.x=R(0,W);}},
      draw(p){
        cx.save();cx.translate(p.x,p.y);cx.rotate(p.rot);cx.globalAlpha=p.a;
        cx.shadowBlur=8;cx.shadowColor=`hsl(${p.h},${p.s}%,${p.l}%)`;
        cx.fillStyle=`hsl(${p.h},${p.s}%,${p.l}%)`;
        cx.beginPath();
        cx.moveTo(0,-p.sz);
        cx.bezierCurveTo(p.sz*.9,-p.sz*.4, p.sz*.9,p.sz*.4, 0,p.sz);
        cx.bezierCurveTo(-p.sz*.9,p.sz*.4,-p.sz*.9,-p.sz*.4, 0,-p.sz);
        cx.fill();cx.restore();
      }
    };

    const ATLAS = {
      count:90,
      spawn:()=>({x:R(0,W),y:R(0,H),sz:R(0.4,1.6),
        tw:R(0,Math.PI*2),twV:R(0.01,0.045),
        a:R(0.25,0.9),h:R(38,52),s:R(30,70),l:R(75,95),
        shoot:0,vx:0,vy:0,life:0}),
      update(p){
        if (p.shoot) {
          p.x+=p.vx;p.y+=p.vy;p.life--;
          if (p.life<=0||p.x>W+40||p.y>H+40) {
            p.shoot=0;p.x=R(0,W);p.y=R(0,H);
          }
        } else {
          p.tw+=p.twV;
          if (Math.random()<0.00035) { // become a shooting star
            p.shoot=1;p.vx=R(6,11);p.vy=R(2.5,5);p.life=Ri(22,40);
          }
        }
      },
      draw(p){
        cx.save();
        if (p.shoot) {
          const g=cx.createLinearGradient(p.x,p.y,p.x-p.vx*6,p.y-p.vy*6);
          g.addColorStop(0,'rgba(237,228,207,0.9)');
          g.addColorStop(1,'rgba(237,228,207,0)');
          cx.strokeStyle=g;cx.lineWidth=1.4;
          cx.beginPath();cx.moveTo(p.x,p.y);cx.lineTo(p.x-p.vx*6,p.y-p.vy*6);cx.stroke();
        } else {
          cx.globalAlpha=p.a*(0.45+0.55*Math.abs(Math.sin(p.tw)));
          cx.fillStyle=`hsl(${p.h},${p.s}%,${p.l}%)`;
          cx.shadowBlur=p.sz>1.2?4:0;cx.shadowColor='rgba(212,175,106,0.8)';
          cx.beginPath();cx.arc(p.x,p.y,p.sz,0,Math.PI*2);cx.fill();
        }
        cx.restore();
      }
    };

    const ABYSS = {
      count:34,
      spawn:()=>({x:R(0,W),y:R(H,H*2),vy:R(0.12,0.5),
        sz:R(1,3.2),sw:R(0,Math.PI*2),swV:R(0.006,0.02),
        pu:R(0,Math.PI*2),puV:R(0.015,0.05),
        a:R(0.25,0.75),h:Math.random()<0.78?R(162,178):R(258,270),
        s:R(75,95),l:R(60,78)}),
      update(p){
        p.sw+=p.swV;p.pu+=p.puV;
        p.x+=Math.sin(p.sw)*0.4;p.y-=p.vy;
        if (p.y<-20){p.y=H+R(10,120);p.x=R(0,W);}
      },
      draw(p){
        cx.save();
        cx.globalAlpha=p.a*(0.35+0.65*Math.abs(Math.sin(p.pu)));
        const c=`hsl(${p.h},${p.s}%,${p.l}%)`;
        cx.shadowBlur=10;cx.shadowColor=c;cx.fillStyle=c;
        cx.beginPath();cx.arc(p.x,p.y,p.sz,0,Math.PI*2);cx.fill();
        cx.restore();
      }
    };

    function spawnAll() {
      pts = [];
      for (let i=0; i<activeCfg.count; i++) {
        const p = activeCfg.spawn();
        p.y = R(-20, H);
        pts.push(p);
      }
    }

    function loop() {
      cx.clearRect(0,0,W,H);
      if (activeCfg) pts.forEach(p => { activeCfg.update(p); activeCfg.draw(p); });
      raf = requestAnimationFrame(loop);
    }

    window._setThemeParticles = function(id) {
      const CONFIGS = {sakura:SAKURA, wisteria:WISTERIA, peach:PEACH, moonlit:MOONLIT, atlas:ATLAS, abyss:ABYSS};
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      activeCfg = reduced ? null : (CONFIGS[id] || null);
      cx.clearRect(0,0,W,H);
      pts = [];
      if (activeCfg) spawnAll();
    };

    // Boot with saved theme
    window._setThemeParticles(localStorage.getItem('recall_theme') || 'default');
    loop();
  })();
