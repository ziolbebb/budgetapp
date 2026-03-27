/* ============================================
   BUDŻETAPP — js/ui.js
   UI helpers: toast, formatting, categories
   ============================================ */

const UI = (() => {

  // --- Categories ---
  const CATEGORIES = [
    { id: "food",          label: "Jedzenie",   icon: "🍕", color: "#FF6B6B" },
    { id: "transport",     label: "Transport",  icon: "🚗", color: "#4ECDC4" },
    { id: "housing",       label: "Mieszkanie", icon: "🏠", color: "#45B7D1" },
    { id: "health",        label: "Zdrowie",    icon: "💊", color: "#96CEB4" },
    { id: "entertainment", label: "Rozrywka",   icon: "🎬", color: "#FFEAA7" },
    { id: "shopping",      label: "Zakupy",     icon: "🛍️", color: "#DDA0DD" },
    { id: "education",     label: "Edukacja",   icon: "📚", color: "#98D8C8" },
    { id: "other",         label: "Inne",       icon: "💡", color: "#F7DC6F" },
  ];

  const MONTHS = ["Sty","Lut","Mar","Kwi","Maj","Cze","Lip","Sie","Wrz","Paź","Lis","Gru"];

  function getCategory(id) {
    return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
  }

  // --- Formatting ---
  function formatPLN(n) {
    return n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";
  }

  function formatMonthLabel(year, month) {
    return `${MONTHS[month]} ${year}`;
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function monthKey(year, month) {
    return `${year}-${String(month + 1).padStart(2, "0")}`;
  }

  // --- Toast ---
  let toastTimer = null;
  function toast(msg, type = "success") {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.className = `show ${type}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = ""; }, 2500);
  }

  // --- DOM helpers ---
  function el(id) { return document.getElementById(id); }

  function html(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") e.className = v;
      else if (k === "style") e.style.cssText = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const child of children) {
      if (typeof child === "string") e.insertAdjacentHTML("beforeend", child);
      else if (child instanceof Node) e.appendChild(child);
    }
    return e;
  }

  function show(id) { const e = el(id); if (e) e.classList.remove("hidden"); }
  function hide(id) { const e = el(id); if (e) e.classList.add("hidden"); }

  // --- Category options for select ---
  function buildCategoryOptions(selectEl, selectedId = "food") {
    selectEl.innerHTML = "";
    for (const cat of CATEGORIES) {
      const opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = `${cat.icon} ${cat.label}`;
      if (cat.id === selectedId) opt.selected = true;
      selectEl.appendChild(opt);
    }
  }

  return { CATEGORIES, MONTHS, getCategory, formatPLN, formatMonthLabel, todayISO, monthKey, toast, el, html, show, hide, buildCategoryOptions };
})();
