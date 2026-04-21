// ============================================================
// BudżetApp — js/ui.js
// ============================================================

const UI = (() => {

  const DEFAULT_CATEGORIES = [
    { id: "paliwo",       label: "Paliwo",       icon: "⛽", color: "#FF8C42" },
    { id: "zabka",        label: "Żabka",         icon: "🐸", color: "#4CAF50" },
    { id: "wakacje",      label: "Wakacje",       icon: "✈️",  color: "#29B6F6" },
    { id: "ciuchy",       label: "Ciuchy",        icon: "👗", color: "#EC407A" },
    { id: "auto",         label: "Auto",          icon: "🚗", color: "#78909C" },
    { id: "jedzenie",     label: "Jedzenie",      icon: "🍽️", color: "#FF7043" },
    { id: "moto",         label: "Moto",          icon: "🏍️", color: "#5C6BC0" },
    { id: "szycie",       label: "Szycie",        icon: "🧵", color: "#AB47BC" },
    { id: "przyjemnosci", label: "Przyjemności",  icon: "🎉", color: "#FFCA28" },
    { id: "codziennosc",  label: "Codzienność",   icon: "🛒", color: "#26C6DA" },
    { id: "inne",         label: "Inne",          icon: "💡", color: "#BDBDBD" },
  ];

  const DEFAULT_INCOME_CATEGORIES = [
    { id: "dominos",  label: "Domino's", icon: "🍕", color: "#E53935" },
    { id: "rodzice",  label: "Rodzice",  icon: "👨‍👩‍👦", color: "#42A5F5" },
    { id: "szycie",   label: "Szycie",   icon: "🧵", color: "#AB47BC" },
    { id: "inne_inc", label: "Inne",     icon: "💰", color: "#BDBDBD" },
  ];

  // Live arrays — merged with custom ones from DB
  let CATEGORIES        = [...DEFAULT_CATEGORIES];
  let INCOME_CATEGORIES = [...DEFAULT_INCOME_CATEGORIES];

  // Merge custom DB categories into live arrays
  function applyCustomCategories(customRows) {
    const customExp = customRows.filter(c => c.type === "expense");
    const customInc = customRows.filter(c => c.type === "income");
    CATEGORIES        = [...DEFAULT_CATEGORIES,        ...customExp.map(c => ({ id: c.id, label: c.label, icon: c.icon, color: c.color, custom: true }))];
    INCOME_CATEGORIES = [...DEFAULT_INCOME_CATEGORIES, ...customInc.map(c => ({ id: c.id, label: c.label, icon: c.icon, color: c.color, custom: true }))];
  }

  const MONTHS = ["Sty","Lut","Mar","Kwi","Maj","Cze","Lip","Sie","Wrz","Paź","Lis","Gru"];

  // ── Period logic (10th → 9th) ──────────────────────────────

  function getCurrentPeriodBase() {
    const now = new Date();
    const d   = now.getDate();
    if (d >= 10) return { year: now.getFullYear(), month: now.getMonth() };
    let m = now.getMonth() - 1, y = now.getFullYear();
    if (m < 0) { m = 11; y--; }
    return { year: y, month: m };
  }

  function periodFromBase(base, offset) {
    let m = base.month + offset, y = base.year;
    while (m < 0)  { m += 12; y--; }
    while (m > 11) { m -= 12; y++; }
    const startDate = `${y}-${String(m+1).padStart(2,"0")}-10`;
    let em = m + 1, ey = y;
    if (em > 11) { em = 0; ey++; }
    const endDate   = `${ey}-${String(em+1).padStart(2,"0")}-09`;
    const label     = `10 ${MONTHS[m]} – 9 ${MONTHS[em]}${ey !== y ? " "+ey : ""} ${y}`;
    const periodKey = `p_${y}_${String(m+1).padStart(2,"0")}`;
    return { year: y, month: m, startDate, endDate, label, periodKey };
  }

  function getCategory(id) {
    return CATEGORIES.find(c => c.id === id)
        || INCOME_CATEGORIES.find(c => c.id === id)
        || { id, label: id, icon: "💡", color: "#BDBDBD" };
  }

  function formatPLN(n) {
    return (+n || 0).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";
  }

  function todayISO() { return new Date().toISOString().slice(0, 10); }

  // ── Toast ──────────────────────────────────────────────────

  let toastTimer = null;
  function toast(msg, type = "ok") {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.className = `show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = ""; }, 2800);
  }

  // ── DOM ───────────────────────────────────────────────────

  function el(id) { return document.getElementById(id); }
  function show(id) { el(id)?.classList.remove("hidden"); }
  function hide(id) { el(id)?.classList.add("hidden"); }
  function showEl(e) { e?.classList.remove("hidden"); }
  function hideEl(e) { e?.classList.add("hidden"); }

  // ── Spinner ───────────────────────────────────────────────

  function loading(on) {
    const s = el("spinner");
    if (s) s.classList.toggle("hidden", !on);
  }

  return {
    get CATEGORIES()        { return CATEGORIES; },
    get INCOME_CATEGORIES() { return INCOME_CATEGORIES; },
    DEFAULT_CATEGORIES, DEFAULT_INCOME_CATEGORIES,
    applyCustomCategories, MONTHS,
    getCurrentPeriodBase, periodFromBase,
    getCategory, formatPLN, todayISO,
    toast, el, show, hide, showEl, hideEl, loading,
  };
})();
