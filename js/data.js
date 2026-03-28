/* ============================================
   BUDŻETAPP — js/data.js
   Data layer
   - "planned" = budget per category (no date, just amount per period)
   - "actual"  = real expense with date
   - income    = list of {source, amount} per period
   ============================================ */

const Data = (() => {

  const KEYS = {
    planned:      "bp_planned_v2",   // { periodKey: { catId: amount } }
    actual:       "bp_actual_v2",    // [ {id, desc, amount, category, date, periodKey} ]
    income:       "bp_income_v2",    // { periodKey: [ {id, source, amount} ] }
  };

  function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }
  function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

  // ============================================================
  // PLANNED — per category budget (like a limit you set for the period)
  // ============================================================

  function getPlanned(periodKey) {
    const all = load(KEYS.planned, {});
    return all[periodKey] || {};
  }

  function setPlanned(periodKey, catId, amount) {
    const all = load(KEYS.planned, {});
    if (!all[periodKey]) all[periodKey] = {};
    const val = parseFloat(amount);
    if (val > 0) all[periodKey][catId] = val;
    else delete all[periodKey][catId];
    save(KEYS.planned, all);
  }

  function getPlannedAmount(periodKey, catId) {
    return getPlanned(periodKey)[catId] || 0;
  }

  function getPlannedTotal(periodKey) {
    return Object.values(getPlanned(periodKey)).reduce((s, v) => s + v, 0);
  }

  // ============================================================
  // ACTUAL — real expenses with date
  // ============================================================

  function getActual() { return load(KEYS.actual, []); }

  function addActual({ desc, amount, category, subtype, date, periodKey }) {
    const list = getActual();
    const t = {
      id: Date.now(),
      desc: desc.trim(),
      amount: Math.abs(parseFloat(amount)),
      category,
      subtype: subtype || "actual",   // "planned" | "actual"
      date: date || null,
      periodKey,
    };
    list.unshift(t);
    save(KEYS.actual, list);
    return t;
  }

  function deleteActual(id) {
    save(KEYS.actual, getActual().filter(t => t.id !== id));
  }

  function getPeriodActual(periodKey) {
    return getActual().filter(t => t.periodKey === periodKey);
  }

  // ============================================================
  // INCOME
  // ============================================================

  function getIncomeEntries(periodKey) {
    const all = load(KEYS.income, {});
    return all[periodKey] || [];
  }

  function addIncomeEntry(periodKey, source, amount) {
    const all = load(KEYS.income, {});
    if (!all[periodKey]) all[periodKey] = [];
    all[periodKey].push({ id: Date.now(), source, amount: parseFloat(amount) });
    save(KEYS.income, all);
  }

  function deleteIncomeEntry(periodKey, id) {
    const all = load(KEYS.income, {});
    if (!all[periodKey]) return;
    all[periodKey] = all[periodKey].filter(e => e.id !== id);
    save(KEYS.income, all);
  }

  function getTotalIncome(periodKey) {
    return getIncomeEntries(periodKey).reduce((s, e) => s + e.amount, 0);
  }

  // ============================================================
  // SUMMARY
  // ============================================================

  function getPeriodSummary(periodKey) {
    const all         = getPeriodActual(periodKey);
    const planned     = getPlanned(periodKey);
    const plannedTxs  = all.filter(t => t.subtype === "planned");
    const actualTxs   = all.filter(t => t.subtype !== "planned");
    const plannedFromTx = plannedTxs.reduce((s, t) => s + t.amount, 0);
    const plannedTotal  = Object.values(planned).reduce((s, v) => s + v, 0) + plannedFromTx;
    const actualTotal   = actualTxs.reduce((s, t) => s + t.amount, 0);
    const income        = getTotalIncome(periodKey);
    return {
      actual: actualTxs,
      planned,
      plannedTxs,
      plannedTotal,
      actualTotal,
      income,
      balance: income - actualTotal,
    };
  }

  return {
    getPlanned, setPlanned, getPlannedAmount, getPlannedTotal,
    getActual, addActual, deleteActual, getPeriodActual,
    getIncomeEntries, addIncomeEntry, deleteIncomeEntry, getTotalIncome,
    getPeriodSummary,
  };
})();
