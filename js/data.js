/* ============================================
   BUDŻETAPP — js/data.js
   Data layer: transactions, budgets, income
   Period: 10th → 9th of next month
   Types: "planned" (zaplanowane) | "actual" (rzeczywiste) | "income"
   ============================================ */

const Data = (() => {

  const KEYS = {
    transactions: "bp_transactions",
    budgets:      "bp_budgets",
    income:       "bp_income_v2",  // keyed by periodKey, array of {source,amount}
  };

  function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }
  function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

  // ============================================================
  // Transactions
  // Each transaction has:
  //   id, desc, amount, category, subtype ("planned"|"actual"|"income"),
  //   incomeSource (if income), date, periodKey
  // ============================================================

  function getTransactions() { return load(KEYS.transactions, []); }

  function addTransaction({ desc, amount, category, subtype, incomeSource, date, periodKey }) {
    const txs = getTransactions();
    const t = {
      id: Date.now(),
      desc: desc.trim(),
      amount: Math.abs(parseFloat(amount)),
      category,
      subtype,           // "planned" | "actual" | "income"
      incomeSource: incomeSource || null,
      date,
      periodKey,
    };
    txs.unshift(t);
    save(KEYS.transactions, txs);
    return t;
  }

  function deleteTransaction(id) {
    save(KEYS.transactions, getTransactions().filter(t => t.id !== id));
  }

  function getPeriodTransactions(periodKey) {
    return getTransactions().filter(t => t.periodKey === periodKey);
  }

  // ============================================================
  // Budgets (planned limits per category per period)
  // ============================================================

  function getBudgets() { return load(KEYS.budgets, {}); }

  function setBudget(periodKey, catId, amount) {
    const b = getBudgets();
    b[`${periodKey}_${catId}`] = parseFloat(amount);
    save(KEYS.budgets, b);
  }

  function getBudget(periodKey, catId) {
    return getBudgets()[`${periodKey}_${catId}`] || 0;
  }

  // ============================================================
  // Income (list of {id, source, amount} per period)
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
  // Summary
  // ============================================================

  function getPeriodSummary(periodKey) {
    const txs      = getPeriodTransactions(periodKey);
    const planned  = txs.filter(t => t.subtype === "planned").reduce((s,t)=>s+t.amount, 0);
    const actual   = txs.filter(t => t.subtype === "actual").reduce((s,t)=>s+t.amount, 0);
    const income   = getTotalIncome(periodKey);
    return { txs, planned, actual, income, balance: income - actual };
  }

  return {
    getTransactions,
    addTransaction,
    deleteTransaction,
    getPeriodTransactions,
    getBudget, setBudget,
    getIncomeEntries, addIncomeEntry, deleteIncomeEntry, getTotalIncome,
    getPeriodSummary,
  };
})();
