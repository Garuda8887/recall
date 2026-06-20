// ── Themes ───────────────────────────────────────────────
  const THEMES = [
    {
      id: 'default',
      name: 'Professional',
      desc: 'Warm minimal',
      swatches: ['#edeae4','#6366f1','#f59e0b','#1a1917'],
    },
    {
      id: 'pixel',
      name: 'Pixel Game',
      desc: '8-bit arcade',
      swatches: ['#4A90D9','#FEFCE8','#E8220A','#FFD700'],
    },
    {
      id: 'wabi',
      name: 'Wabi-Sabi',
      desc: 'Earthy & quiet',
      swatches: ['#EDE8DF','#7C6347','#C4955A','#2A2118'],
    },
    {
      id: 'brutalist',
      name: 'Brutalist',
      desc: 'Raw & unapologetic',
      swatches: ['#C8C4BC','#000000','#E8000A','#FFFF00'],
    },
    {
      id: 'synthwave',
      name: 'Synthwave',
      desc: 'Neon & midnight',
      swatches: ['#0B0821','#FF0090','#00FFFF','#9B00FF'],
    },
    {
      id: 'terminal',
      name: 'Terminal',
      desc: 'Hacker green',
      swatches: ['#0A0E0A','#00FF41','#FFFF00','#0D120D'],
    },
    {
      id: 'y2k',
      name: 'Y2K',
      desc: 'Chrome & gloss',
      swatches: ['#DDE8F8','#0055FF','#FF6600','#F0F6FF'],
    },
    {
      id: 'sakura',
      name: 'Sakura',
      desc: 'Cherry blossom',
      swatches: ['#FFF5F8','#D4607A','#F0C8D8','#1C0F14'],
    },
    {
      id: 'wisteria',
      name: 'Wisteria',
      desc: 'Cascading blooms',
      swatches: ['#F8F5FF','#8B5CF6','#D8CCF0','#1A1228'],
    },
    {
      id: 'peach',
      name: 'Peach Blossom',
      desc: 'Sun-warmed petals',
      swatches: ['#FFF8F3','#E8704A','#F0CFBA','#1F120A'],
    },
    {
      id: 'moonlit',
      name: 'Moonlit Sakura',
      desc: 'Night-blooming',
      swatches: ['#130A0E','#F472B6','#3D1E30','#FFE8F0'],
    },
    {
      id: 'aurora',
      name: 'Aurora',
      desc: 'Northern lights',
      swatches: ['#050D1A','#00E5A0','#7B5FFF','#0B1928'],
    },
    if (id !== 'default') document.body.setAttribute('data-theme', id);
    localStorage.setItem('recall_theme', id);
    renderThemeGrid();
    if (window._setThemeParticles) window._setThemeParticles(id);
  }

  function renderThemeGrid() {
    const grid = document.getElementById('themeGrid');
    if (!grid) return;
    const current = localStorage.getItem('recall_theme') || 'default';
    grid.innerHTML = '';
    THEMES.forEach(t => {
      const card = document.createElement('div');
      card.className = 'theme-card' + (current === t.id ? ' active' : '');
      card.innerHTML =
        `<div class="theme-swatches">${t.swatches.map(c =>
          `<div class="theme-swatch" style="background:${c}"></div>`).join('')}</div>` +
        `<div class="theme-card-name">${t.name}</div>` +
        `<div class="theme-card-desc">${t.desc}</div>`;
      card.onclick = () => applyTheme(t.id);
      grid.appendChild(card);
    });
  }

  // init theme on load
  (function initTheme() {
    const saved = localStorage.getItem('recall_theme') || 'default';
    if (saved !== 'default') document.body.setAttribute('data-theme', saved);
  })();
