// ponytail: shared between server.js (require) and local-api.js (browser global)
const SharedUtils = (() => {
  function addDays(dateStr, days) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
  }

  function todayUTC() {
    return new Date().toISOString().slice(0, 10);
  }

  function computeSM2(quality, easeFactor, intervalDays) {
    if (quality < 3) {
      return { nextInterval: 1, easeFactor: Math.max(1.3, easeFactor - 0.2), pass: false };
    }
    const newEF = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    return { nextInterval: Math.max(1, Math.round(intervalDays * newEF)), easeFactor: newEF, pass: true };
  }

  function nextRecurDate(lastDateStr, rule) {
    if (typeof rule === 'string') rule = JSON.parse(rule);
    if (!rule) return null;
    if (rule.type === 'interval') return addDays(lastDateStr, rule.days);
    if (rule.type === 'weekly') {
      const [y, m, d] = lastDateStr.split('-').map(Number);
      const cur = new Date(Date.UTC(y, m - 1, d + 1));
      while (cur.getUTCDay() !== rule.weekday) cur.setUTCDate(cur.getUTCDate() + 1);
      return cur.toISOString().slice(0, 10);
    }
    return null;
  }

  return { addDays, todayUTC, computeSM2, nextRecurDate };
})();

if (typeof module !== 'undefined') module.exports = SharedUtils;
