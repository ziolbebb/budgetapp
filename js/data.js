/* ============================================
   BUDŻETAPP — js/data.js
   Data layer: transactions, budgets, income
   ============================================ */

const Data = (() => {

  const KEYS = {
    transactions: "bp_transactions",
    budgets:      "bp_budgets",
    income:       "bp_income",
  };

  function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }

  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  // --- Transactions ---

  function getTransactions() {
    return load(KEYS.transactions, []);
  }

  function addTransaction({ desc, amount, category, type, date }) {
    const txs = getTransactions();
    const t = {
      id: Date.now(),
      desc: desc.trim(),
      amount: Math.abs(parseFloat(amount)),
      category,
      type,
      date,
      monthKey: date.slice(0, 7),
    };
    txs.unshift(t);
    save(KEYS.transactions, txs);
    return t;
  }

  function deleteTransaction(id) {
    const txs = getTransactions().filter(t => t.id !== id);
    save(KEYS.transactions, txs);
  }

  function getMonthTransactions(monthKey) {
    return getTransactions().filter(t => t.monthKey === monthKey);
  }

  // --- Budgets (category limits) ---

  function getBudgets() {
    return load(KEYS.budgets, {});
  }

  function setBudget(monthKey, catId, amount) {
    const b = getBudgets();
    b[`${monthKey}_${catId}`] = parseFloat(amount);
    save(KEYS.budgets, b);
  }

  function getBudget(monthKey, catId) {
    return getBudgets()[`${monthKey}_${catId}`] || 0;
  }

  // --- Income ---

  function getIncomes() {
    return load(KEYS.income, {});
  }

  function setIncome(monthKey, amount) {
    const inc = getIncomes();
    inc[monthKey] = parseFloat(amount);
    save(KEYS.income, inc);
  }

  function getIncome(monthKey) {
    return getIncomes()[monthKey] || 0;
  }

  // --- Summaries ---

  function getMonthlySummary(monthKey) {
    const txs = getMonthTransactions(monthKey);
    const expenses = txs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const income   = getIncome(monthKey);
    return { expenses, income, balance: income - expenses, txs };
  }

  return {
    getTransactions,
    addTransaction,
    deleteTransaction,
    getMonthTransactions,
    getBudget,
    setBudget,
    getIncome,
    setIncome,
    getMonthlySummary,
  };
})();
