// ============================================================
// BudżetApp — js/db.js  (Supabase REST wrapper)
// ============================================================

const DB = (() => {
  const BASE = CONFIG.SUPABASE_URL + "/rest/v1";
  const KEY  = CONFIG.SUPABASE_KEY;

  const H = {
    "apikey":        KEY,
    "Authorization": "Bearer " + KEY,
    "Content-Type":  "application/json",
    "Prefer":        "return=representation",
  };

  async function req(method, table, body, query = "") {
    const url  = `${BASE}/${table}${query}`;
    const opts = { method, headers: { ...H } };
    if (body)            opts.body = JSON.stringify(body);
    if (method === "GET") delete opts.headers["Prefer"];
    const r = await fetch(url, opts);
    if (!r.ok) throw new Error(`${method} ${table}: ${await r.text()}`);
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  }

  const get  = (t, q="")   => req("GET",    t, null, q);
  const post = (t, b)       => req("POST",   t, b);
  const patch= (t, q, b)    => req("PATCH",  t, b, q);
  const del  = (t, q)       => req("DELETE", t, null, q);

  // ── PIN auth ───────────────────────────────────────────────
  // IMPORTANT: hash must match SQL insert in schema:
  // SHA-256("1234::bp_salt_v2") = 31866173...
  async function hashPin(pin) {
    const data = new TextEncoder().encode(pin + "::bp_salt_v2");
    const buf  = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
  }

  async function checkPin(pin) {
    const hash = await hashPin(pin);
    const rows = await get("app_config", "?key=eq.pin_hash&select=value");
    return rows?.[0]?.value === hash;
  }

  async function changePin(oldPin, newPin) {
    const ok = await checkPin(oldPin);
    if (!ok) return { ok: false, msg: "Current PIN is incorrect." };
    if (String(newPin).length < 4) return { ok: false, msg: "New PIN must be at least 4 digits." };
    const hash = await hashPin(String(newPin));
    await patch("app_config", "?key=eq.pin_hash", { value: hash });
    return { ok: true };
  }

  function saveSession()  { localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify({ ts: Date.now() })); }
  function clearSession() { localStorage.removeItem(CONFIG.SESSION_KEY); }
  function isLoggedIn()   {
    try {
      const s = JSON.parse(localStorage.getItem(CONFIG.SESSION_KEY));
      return s && (Date.now() - s.ts < CONFIG.SESSION_TTL);
    } catch { return false; }
  }

  // ── Transactions ───────────────────────────────────────────
  const getTransactions  = (pk)  => get("transactions", `?period_key=eq.${pk}&order=created_at.desc`);
  const addTransaction   = (pk, subtype, category, description, amount) =>
    post("transactions", { period_key: pk, subtype, category, description, amount });
  const updateTransaction = (id, fields) => patch("transactions", `?id=eq.${id}`, fields);
  const deleteTransaction = (id)  => del("transactions", `?id=eq.${id}`);
  const getAllTransactions = ()   => get("transactions", "?order=period_key.desc,created_at.desc");

  // ── Incomes ────────────────────────────────────────────────
  const getIncomes    = (pk)            => get("incomes", `?period_key=eq.${pk}&order=created_at.desc`);
  const addIncome     = (pk, src, amt)  => post("incomes", { period_key: pk, source: src, amount: amt });
  const deleteIncome  = (id)            => del("incomes", `?id=eq.${id}`);
  const getAllIncomes  = ()              => get("incomes", "?order=period_key.desc,created_at.desc");

  // ── Savings goals ──────────────────────────────────────────
  const getSavingsGoals  = ()                        => get("savings_goals", "?order=created_at.asc");
  const addSavingsGoal   = (name, target, icon, color) => post("savings_goals", { name, target, icon, color });
  const deleteSavingsGoal= (id)                      => del("savings_goals", `?id=eq.${id}`);
  const getAllDeposits    = ()                        => get("savings_deposits", "?order=created_at.desc");
  const addDeposit       = (goalId, amount, note)    => post("savings_deposits", { goal_id: goalId, amount, note });
  const deleteDeposit    = (id)                      => del("savings_deposits", `?id=eq.${id}`);

  // ── Longterm expenses ──────────────────────────────────────
  const getLongtermExpenses  = ()                          => get("longterm_expenses", "?order=created_at.asc");
  const addLongtermExpense   = (name, totalBudget, icon, color) =>
    post("longterm_expenses", { name, total_budget: totalBudget, icon, color });
  const deleteLongtermExpense= (id)                        => del("longterm_expenses", `?id=eq.${id}`);
  const getAllLongtermPayments= ()                          => get("longterm_payments", "?order=created_at.desc");
  const addLongtermPayment   = (expId, pk, amount, note)   =>
    post("longterm_payments", { expense_id: expId, period_key: pk, amount, note });
  const deleteLongtermPayment= (id)                        => del("longterm_payments", `?id=eq.${id}`);

  return {
    hashPin, checkPin, changePin, saveSession, clearSession, isLoggedIn,
    getTransactions, addTransaction, updateTransaction, deleteTransaction, getAllTransactions,
    getIncomes, addIncome, deleteIncome, getAllIncomes,
    getSavingsGoals, addSavingsGoal, deleteSavingsGoal, getAllDeposits, addDeposit, deleteDeposit,
    getLongtermExpenses, addLongtermExpense, deleteLongtermExpense,
    getAllLongtermPayments, addLongtermPayment, deleteLongtermPayment,
  };
})();
