// ── Themes ───────────────────────────────────────────────
  const THEMES = [
    {
      id: 'default',
      name: 'Professional',
      desc: 'Warm minimal',
      swatches: ['#edeae4','#6366f1','#f59e0b','#1a1917'],
    },
    {
      id: 'sakura',
      name: 'Sakura',
      desc: 'Cherry blossom',
      swatches: ['#FFF5F8','#D4607A','#F0C8D8','#1C0F14'],
    },
    {
      id: 'peach',
      name: 'Peach Blossom',
      desc: 'Sun-warmed petals',
      swatches: ['#FFF8F3','#E8704A','#F0CFBA','#1F120A'],
    },
    {
      id: 'candy',
      name: 'Candy',
      desc: 'Bubbly & sweet',
      swatches: ['#F0E8FF','#FF4DA6','#9B5FFF','#3BEBA0'],
    },
  ];

  function applyTheme(id) {
    const el = document.documentElement;
    document.body.removeAttribute('data-theme');
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
