// ── Constants ────────────────────────────────────────────
  const MONTH_NAMES  = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];
  const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun',
                        'Jul','Aug','Sep','Oct','Nov','Dec'];
  const REVIEW_COLORS = ['#ef4444','#f97316','#14b8a6','#3b82f6','#8b5cf6'];
  const DEFAULT_INTERVALS = [1, 3, 7, 14, 30];

  const SUBJECT_PALETTE = [
    { bg: '#eef2ff', text: '#4338ca', border: '#6366f1' },
    { bg: '#fdf2f8', text: '#9d174d', border: '#ec4899' },
    { bg: '#f0fdfa', text: '#065f46', border: '#14b8a6' },
    { bg: '#fff7ed', text: '#9a3412', border: '#f97316' },
    { bg: '#fdf4ff', text: '#7e22ce', border: '#a855f7' },
    { bg: '#f0f9ff', text: '#075985', border: '#0ea5e9' },
    { bg: '#fefce8', text: '#854d0e', border: '#eab308' },
    { bg: '#f0fdf4', text: '#166534', border: '#22c55e' },
  ];

  let _subjectColors = null;
  function getCustomColors() {
    if (!_subjectColors)
      try { _subjectColors = JSON.parse(localStorage.getItem('recall_subject_colors') || '{}'); }
      catch { _subjectColors = {}; }
    return _subjectColors;
  }
  function invalidateSubjectColors() { _subjectColors = null; }

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1,3),16),
          g = parseInt(hex.slice(3,5),16),
          b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function getSubjectColor(subject) {
    if (!subject) return SUBJECT_PALETTE[0];
    const custom = getCustomColors();
    if (custom[subject]) {
      const hex = custom[subject];
      return { bg: hexToRgba(hex, 0.12), text: hex, border: hex };
    }
    let h = 0;
    for (const c of subject) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
    return SUBJECT_PALETTE[h % SUBJECT_PALETTE.length];
  }

  // ── State ────────────────────────────────────────────────
  let currentYear, currentMonth;
  let currentDayDate     = null;
  let addModalTargetDate    = null;
  let activeSubject         = null;
  let activeTagFilter       = null; // active tag filter string, or null
  let editTags              = [];   // tags being edited in the add/edit modal
  let searchQuery           = '';
  let editingSessionId      = null; // null = create, string = edit
  let sessions              = [];
  let decks                 = [];
  let links                 = [];   // all link objects for the user
  let deckEditorCards       = [];
  let deckEditorSession     = null;
  let editingDeckId         = null;
  let studyState            = null;
  let importedParsedCards   = [];
  let intervals             = [...DEFAULT_INTERVALS];
  let dragReview            = null; // { sessionId, reviewIndex, fromDate } while dragging
  let linkingSessionId      = null; // session being linked in the link modal
  let selectedLinkTargetId  = null; // target session selected in link modal
  let selectedLinkRelation  = 'related';

  // Graph state
  let graphNodes      = [];
  let graphEdges      = [];
  let graphAnimId     = null;
  let graphSubjFocus  = null;
  // 3D rotation
  let graphRotX       = 12, graphRotY      = 0;
  let graphTargetRotX = 12, graphTargetRotY = 0;
  let graphIsDragging = false;
  let graphLastMX     = 0,  graphLastMY    = 0;
  let graphAutoRotate = true;
  let graphAutoTimer  = null;
  // Hover
  let graphHoveredId  = null;
  // Pulse progress per edge index
  let graphPulseT     = {};
  // DOM maps
  let graphDomMap     = {};   // nodeId → { nw, nv, lbl }
  // Elements
  let graphPivotEl    = null; // the preserve-3d pivot div
  let graphConnCtx    = null; // canvas 2d ctx for connections
  let graphPartCtx    = null; // canvas 2d ctx for particles
  let graphLastTs     = 0;
  // Particle data
  let graphStars      = [];
  let graphMotes      = [];
  let _graphMoveFn    = null;
  let _graphUpFn      = null;
  let pendingRating      = null; // { sessionId, reviewIdx, dateStr }

  const RATINGS = [
    { score: 1, emoji: '😶', label: 'Blank',   color: '#ef4444', bg: '#fef2f2' },
    { score: 2, emoji: '😕', label: 'Hard',    color: '#f97316', bg: '#fff7ed' },
    { score: 3, emoji: '😐', label: 'Okay',    color: '#eab308', bg: '#fefce8' },
    { score: 4, emoji: '😊', label: 'Good',    color: '#22c55e', bg: '#f0fdf4' },
    { score: 5, emoji: '🎯', label: 'Perfect', color: '#6366f1', bg: '#eef2ff' },
  ];

  // ── Card score helpers ────────────────────────────────────
  function getCardAvg(card) {
    if (!card.scores || !card.scores.length) return null;
    return card.scores.reduce((a, b) => a + b, 0) / card.scores.length;
  }

  function cardDifficultyColor(avg) {
    if (avg === null) return 'var(--tx-3)';
    if (avg < 2)  return '#ef4444';
    if (avg < 3)  return '#f97316';
    if (avg < 4)  return '#eab308';
    return '#22c55e';
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function renderMarkdown(text) {
    return escHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')
      .replace(/\n/g, '<br>');
  }

  // ── Date helpers ─────────────────────────────────────────
  function todayStr() {
    const d = new Date();
    return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  function ymd(y, m, d) {
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }

  function addDays(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  function displayDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${SHORT_MONTHS[parseInt(m)-1]} ${parseInt(d)}, ${y}`;
  }

  function intervalLabel(days) {
    return days === 1 ? '+1 day' : `+${days} days`;
  }
