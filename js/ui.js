/* ============================================
   BUDŻETAPP — js/ui.js
   UI helpers: toast, formatting, categories
   ============================================ */

const UI = (() => {

  // --- Expense Categories ---
  const CATEGORIES = [
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

  // --- Income Categories ---
  const INCOME_CATEGORIES = [
    { id: "dominos",  label: "Domino's", icon: "🍕", color: "#E53935" },
    { id: "rodzice",  label: "Rodzice",  icon: "👨‍👩‍👦", color: "#42A5F5" },
    { id: "szycie",   label: "Szycie",   icon: "🧵", color: "#AB47BC" },
    { id: "inne_inc", label: "Inne",     icon: "💰", color: "#BDBDBD" },
  ];

  const MONTHS = ["Sty","Lut","Mar","Kwi","Maj","Cze","Lip","Sie","Wrz","Paź","Lis","Gru"];

  // ============================================================
  // Period logic: 10th of month → 9th of next month
  // ============================================================

  function getCurrentPeriodBase() {
    const now = new Date();
    const d = now.getDate();
    if (d >= 10) {
      return { year: now.getFullYear(), month: now.getMonth() };
    } else {
      let m = now.getMonth() - 1;
      let y = now.getFullYear();
      if (m < 0) { m = 11; y--; }
      return { year: y, month: m };
    }
  }

  function periodFromBase(base, offset) {
    let m = base.month + offset;
    let y = base.year;
    while (m < 0)  { m += 12; y--; }
    while (m > 11) { m -= 12; y++; }

    const startDate = `${y}-${String(m+1).padStart(2,"0")}-10`;

    let em = m + 1, ey = y;
    if (em > 11) { em = 0; ey++; }
    const endDate = `${ey}-${String(em+1).padStart(2,"0")}-09`;

    const startLabel = `10 ${MONTHS[m]}`;
    const endLabel   = `9 ${MONTHS[em]}${ey !== y ? " "+ey : ""}`;
    const label      = `${startLabel} – ${endLabel} ${y}`;
    const periodKey  = `p_${y}_${String(m+1).padStart(2,"0")}`;

    return { year: y, month: m, startDate, endDate, label, periodKey };
  }

  // ============================================================
  // Category helpers
  // ============================================================

  function getCategory(id) {
    return CATEGORIES.find(c => c.id === id)
        || INCOME_CATEGORIES.find(c => c.id === id)
        || CATEGORIES[CATEGORIES.length - 1];
  }

  // ============================================================
  // Formatting
  // ============================================================

  function formatPLN(n) {
    return (+n || 0).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  // ============================================================
  // Toast
  // ============================================================
  let toastTimer = null;
  function toast(msg, type = "success") {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.className = `show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = ""; }, 2500);
  }

  // ============================================================
  // DOM helpers
  // ============================================================
  function el(id) { return document.getElementById(id); }
  function show(id) { const e = el(id); if (e) e.classList.remove("hidden"); }
  function hide(id) { const e = el(id); if (e) e.classList.add("hidden"); }

  function buildCategoryOptions(selectEl, selectedId, cats) {
    cats = cats || CATEGORIES;
    selectEl.innerHTML = "";
    for (const cat of cats) {
      const opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = `${cat.icon} ${cat.label}`;
      if (cat.id === selectedId) opt.selected = true;
      selectEl.appendChild(opt);
    }
  }

  return {
    CATEGORIES, INCOME_CATEGORIES, MONTHS,
    getCurrentPeriodBase, periodFromBase,
    getCategory, formatPLN, todayISO,
    toast, el, show, hide, buildCategoryOptions,
  };
})();
