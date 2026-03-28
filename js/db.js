// ============================================================
// BudżetApp — js/db.js
// Supabase REST API wrapper
// ============================================================

const DB = (() => {
  const BASE = CONFIG.SUPABASE_URL + "/rest/v1";
  const KEY  = CONFIG.SUPABASE_KEY;

  const headers = {
    "apikey":        KEY,
    "Authorization": "Bearer " + KEY,
    "Content-Type":  "application/json",
    "Prefer":        "return=representation",
  };

  async function req(method, table, body = null, query = "") {
    const url = `${BASE}/${table}${query}`;
    const opts = { method, headers: { ...headers } };
    if (body) opts.body = JSON.stringify(body);
    if (method === "GET") delete opts.headers["Prefer"];
    const r = await fetch(url, opts);
    if (!r.ok) {
      const err = await r.text();
      throw new Error(`DB ${method} ${table}: ${err}`);
    }
    const text = await r.text();
    return text ? JSON.parse(text) : null;
  }

  const get    = (table, query = "")     => req("GET",    table, null, query);
  const post   = (table, body)           => req("POST",   table, body);
  const patch  = (table, query, body)    => req("PATCH",  table, body, query);
  const del    = (table, query)          => req("DELETE", table, null, query);

  // ============================================================
  // PIN auth
  // ============================================================

  async function hashPin(pin) {
    const buf  = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin + "::bp_salt_v2"));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  async function checkPin(pin) {
    const hash = await hashPin(pin);
    const rows = await get("app_config", `?key=eq.pin_hash&select=value`);
    return rows?.[0]?.value === hash;
  }

  async function changePin(oldPin, newPin) {
    const ok = await checkPin(oldPin);
    if (!ok) return { ok: false, msg: "Stary PIN jest nieprawidłowy." };
    if (newPin.length < 4) return { ok: false, msg: "PIN musi mieć minimum 4 cyfry." };
    const hash = await hashPin(newPin);
    await patch("app_config", "?key=eq.pin_hash", { value: hash });
    return { ok: true };
  }

  function saveSession() {
    localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify({ ts: Date.now() }));
  }

  function clearSession() {
    localStorage.removeItem(CONFIG.SESSION_KEY);
  }

  function isLoggedIn() {
    try {
      const s = JSON.parse(localStorage.getItem(CONFIG.SESSION_KEY));
      return s && (Date.now() - s.ts < CONFIG.SESSION_TTL);
    } catch { return false; }
  }

  // ============================================================
  // Transactions (planned + actual)
  // ============================================================

  async function getTransactions(periodKey) {
    return get("transactions", `?period_key=eq.${periodKey}&order=created_at.desc`);
  }

  async function addTransaction(periodKey, subtype, category, description, amount) {
    return post("transactions", { period_key: periodKey, subtype, category, description, amount });
  }

  async function updateTransaction(id, fields) {
    return patch("transactions", `?id=eq.${id}`, fields);
  }

  async function deleteTransaction(id) {
    return del("transactions", `?id=eq.${id}`);
  }

  async function getAllTransactions() {
    return get("transactions", `?order=period_key.desc,created_at.desc`);
  }

  // ============================================================
  // Incomes
  // ============================================================

  async function getIncomes(periodKey) {
    return get("incomes", `?period_key=eq.${periodKey}&order=created_at.desc`);
  }

  async function addIncome(periodKey, source, amount) {
    return post("incomes", { period_key: periodKey, source, amount });
  }

  async function deleteIncome(id) {
    return del("incomes", `?id=eq.${id}`);
  }

  async function getAllIncomes() {
    return get("incomes", `?order=period_key.desc,created_at.desc`);
  }

  // ============================================================
  // Savings goals
  // ============================================================

  async function getSavingsGoals() {
    return get("savings_goals", `?order=created_at.asc`);
  }

  async function addSavingsGoal(name, target, icon, color) {
    return post("savings_goals", { name, target, icon, color });
  }

  async function deleteSavingsGoal(id) {
    return del("savings_goals", `?id=eq.${id}`);
  }

  async function getSavingsDeposits(goalId) {
    return get("savings_deposits", `?goal_id=eq.${goalId}&order=created_at.desc`);
  }

  async function getAllDeposits() {
    return get("savings_deposits", `?order=created_at.desc`);
  }

  async function addDeposit(goalId, amount, note) {
    return post("savings_deposits", { goal_id: goalId, amount, note });
  }

  async function deleteDeposit(id) {
    return del("savings_deposits", `?id=eq.${id}`);
  }

  // ============================================================
  // Longterm expenses
  // ============================================================

  async function getLongtermExpenses() {
    return get("longterm_expenses", `?order=created_at.asc`);
  }

  async function addLongtermExpense(name, totalBudget, icon, color) {
    return post("longterm_expenses", { name, total_budget: totalBudget, icon, color });
  }

  async function deleteLongtermExpense(id) {
    return del("longterm_expenses", `?id=eq.${id}`);
  }

  async function getLongtermPayments(expenseId) {
    return get("longterm_payments", `?expense_id=eq.${expenseId}&order=created_at.desc`);
  }

  async function getAllLongtermPayments() {
    return get("longterm_payments", `?order=created_at.desc`);
  }

  async function addLongtermPayment(expenseId, periodKey, amount, note) {
    return post("longterm_payments", { expense_id: expenseId, period_key: periodKey, amount, note });
  }

  async function deleteLongtermPayment(id) {
    return del("longterm_payments", `?id=eq.${id}`);
  }

  return {
    hashPin, checkPin, changePin, saveSession, clearSession, isLoggedIn,
    getTransactions, addTransaction, updateTransaction, deleteTransaction, getAllTransactions,
    getIncomes, addIncome, deleteIncome, getAllIncomes,
    getSavingsGoals, addSavingsGoal, deleteSavingsGoal,
    getSavingsDeposits, getAllDeposits, addDeposit, deleteDeposit,
    getLongtermExpenses, addLongtermExpense, deleteLongtermExpense,
    getLongtermPayments, getAllLongtermPayments, addLongtermPayment, deleteLongtermPayment,
  };
})();
