/* ============================================
   BUDŻETAPP — js/app.js
   ============================================ */

const App = (() => {

  const base = UI.getCurrentPeriodBase();
  let state = {
    offset: 0,
    view: "dashboard",
    txTab: "actual",
    deleteConfirm: null,
    deleteIncomeConfirm: null,
    editingPlanned: null,   // catId being edited in planned view
  };

  function period() { return UI.periodFromBase(base, state.offset); }
  function pk()     { return period().periodKey; }

  // ============================================================
  // Navigation
  // ============================================================

  function setView(v) {
    state.view = v;
    state.deleteConfirm = null;
    state.editingPlanned = null;
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === v));
    renderMain();
  }

  function prevPeriod() { state.offset--; renderMain(); }
  function nextPeriod() { state.offset++; renderMain(); }

  // ============================================================
  // Period bar
  // ============================================================

  function renderPeriodBar() {
    const p = period();
    const isNow = state.offset === 0;
    const { actual, income } = Data.getPeriodSummary(pk());
    UI.el("period-label").innerHTML =
      p.label + (isNow ? `<span class="month-now-dot">• teraz</span>` : "");
    UI.el("period-count").textContent = `${actual.length} wydatków`;
  }

  // ============================================================
  // Summary cards
  // ============================================================

  function renderSummaryCards() {
    const { plannedTotal, actualTotal, income, balance } = Data.getPeriodSummary(pk());
    const balPos = balance >= 0;
    const diff = plannedTotal - actualTotal;

    UI.el("sum-income-val").textContent  = UI.formatPLN(income);
    UI.el("sum-planned-val").textContent = UI.formatPLN(plannedTotal);
    UI.el("sum-actual-val").textContent  = UI.formatPLN(actualTotal);
    UI.el("sum-balance-val").textContent = UI.formatPLN(Math.abs(balance));
    UI.el("sum-balance-val").className   = `summary-value ${balPos?"green":"red"} mono`;
    UI.el("sum-balance-card").className  = `summary-card ${balPos?"green-card":"red-card"}`;
  }

  // ============================================================
  // Dashboard view
  // ============================================================

  function renderDashboard() {
    renderSummaryCards();
    const { actual, planned } = Data.getPeriodSummary(pk());
    const catGrid = UI.el("cat-grid");
    catGrid.innerHTML = "";

    const activeCategories = UI.CATEGORIES.filter(cat => {
      const p = planned[cat.id] || 0;
      const a = actual.filter(t => t.category === cat.id).reduce((s, t) => s + t.amount, 0);
      return p > 0 || a > 0;
    });

    if (activeCategories.length === 0) {
      catGrid.innerHTML = `<div class="cat-empty">Brak wpisów w tym okresie.<br>Dodaj wydatki lub ustaw plan poniżej!</div>`;
      return;
    }

    for (const cat of activeCategories) {
      const plannedAmt = planned[cat.id] || 0;
      const actualAmt  = actual.filter(t => t.category === cat.id).reduce((s, t) => s + t.amount, 0);
      const pct  = plannedAmt > 0 ? Math.min((actualAmt / plannedAmt) * 100, 100) : 0;
      const over = plannedAmt > 0 && actualAmt > plannedAmt;

      catGrid.insertAdjacentHTML("beforeend", `
        <div class="cat-item">
          <div class="cat-hdr">
            <div class="cat-name"><span class="cat-icon">${cat.icon}</span><span>${cat.label}</span></div>
            ${over ? `<span class="badge badge-r">przekroczono</span>` : ""}
          </div>
          <div class="cat-amounts">
            <div>
              ${plannedAmt > 0 ? `<div class="cat-plan-row">plan: <span class="mono">${UI.formatPLN(plannedAmt)}</span></div>` : ""}
              <div class="cat-spent mono" style="color:${cat.color}">wydano: ${UI.formatPLN(actualAmt)}</div>
            </div>
            ${plannedAmt > 0 ? `<span class="cat-lim">${Math.round(pct)}%</span>` : ""}
          </div>
          ${plannedAmt > 0 ? `<div class="track"><div class="fill" style="width:${pct}%;background:${over?"var(--red)":cat.color}"></div></div>` : ""}
        </div>`);
    }
  }

  // ============================================================
  // Transactions view
  // ============================================================

  function setTxTab(tab) {
    state.txTab = tab;
    state.deleteConfirm = null;
    state.deleteIncomeConfirm = null;
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    UI.el("tx-expense-section").classList.toggle("hidden", tab === "income" || tab === "planned");
    UI.el("tx-income-section").classList.toggle("hidden", tab !== "income");
    UI.el("tx-planned-section").classList.toggle("hidden", tab !== "planned");
    const filterRow = UI.el("tx-filter-row");
    if (filterRow) filterRow.style.display = tab === "actual" ? "" : "none";

    if (tab === "income")  renderIncomeList();
    if (tab === "actual")  renderActualList(UI.el("tx-filter")?.value || "all");
    if (tab === "planned") renderPlannedList();
  }

  function renderActualList(filterCat = "all") {
    const { actual } = Data.getPeriodSummary(pk());
    let list = filterCat === "all" ? actual : actual.filter(t => t.category === filterCat);
    list = [...list].sort((a, b) => b.date.localeCompare(a.date));

    const el = UI.el("tx-list");
    el.innerHTML = "";

    if (list.length === 0) {
      el.innerHTML = `<div class="tx-empty">Brak wydatków${filterCat !== "all" ? " w tej kategorii" : ""}.</div>`;
      return;
    }

    for (const t of list) {
      const cat = UI.getCategory(t.category);
      const isConfirm = state.deleteConfirm === t.id;
      const row = document.createElement("div");
      row.className = "tx-row";
      row.innerHTML = `
        <div class="tx-icon" style="background:${cat.color}22">${cat.icon}</div>
        <div class="tx-info">
          <div class="tx-desc truncate">${t.desc}</div>
          <div class="tx-meta">${cat.label} · ${t.date}</div>
        </div>
        <div class="tx-amt red">−${UI.formatPLN(t.amount)}</div>
        <div class="tx-del-area" id="da-${t.id}"></div>`;

      const da = row.querySelector(`#da-${t.id}`);
      if (isConfirm) {
        da.innerHTML = `<button class="btn-danger" id="cd-${t.id}">Usuń</button><button class="btn-g" id="ca-${t.id}" style="padding:5px 10px;font-size:12px">Anuluj</button>`;
        setTimeout(() => {
          const cd = document.getElementById(`cd-${t.id}`);
          const ca = document.getElementById(`ca-${t.id}`);
          if (cd) cd.onclick = () => { Data.deleteActual(t.id); state.deleteConfirm = null; renderMain(); UI.toast("Usunięto", "err"); };
          if (ca) ca.onclick = () => { state.deleteConfirm = null; renderActualList(UI.el("tx-filter")?.value||"all"); };
        }, 0);
      } else {
        const btn = document.createElement("button");
        btn.className = "btn-del"; btn.textContent = "✕";
        btn.onclick = () => { state.deleteConfirm = t.id; renderActualList(UI.el("tx-filter")?.value||"all"); };
        da.appendChild(btn);
      }
      el.appendChild(row);
    }
  }

  // ============================================================
  // Planned list — shows per-category budgets, editable
  // ============================================================

  function renderPlannedList() {
    const planned = Data.getPlanned(pk());
    const { actual } = Data.getPeriodSummary(pk());
    const el = UI.el("planned-list");
    el.innerHTML = "";

    for (const cat of UI.CATEGORIES) {
      const plannedAmt = planned[cat.id] || 0;
      const actualAmt  = actual.filter(t => t.category === cat.id).reduce((s, t) => s + t.amount, 0);
      const pct  = plannedAmt > 0 ? Math.min((actualAmt / plannedAmt) * 100, 100) : 0;
      const over = plannedAmt > 0 && actualAmt > plannedAmt;
      const isEdit = state.editingPlanned === cat.id;

      const card = document.createElement("div");
      card.className = "cat-item";
      card.style.cssText = "margin-bottom:8px;" + (over ? "border-color:rgba(255,94,94,.4)" : "");

      card.innerHTML = `
        <div class="cat-hdr">
          <div class="cat-name"><span class="cat-icon">${cat.icon}</span><span>${cat.label}</span></div>
          <div style="display:flex;align-items:center;gap:8px">
            ${over ? `<span class="badge badge-r">przekroczono!</span>` : ""}
            ${plannedAmt > 0 && !isEdit ? `<span class="mono" style="font-size:12px;color:var(--dim)">${Math.round(pct)}%</span>` : ""}
          </div>
        </div>
        ${isEdit ? `
          <div style="display:flex;gap:8px;margin-top:10px">
            <input type="number" min="0" step="1" id="pi-${cat.id}" placeholder="Kwota planu (zł)" value="${plannedAmt || ""}" style="font-size:14px" />
            <button class="btn-p" id="ps-${cat.id}" style="padding:8px 16px;font-size:13px;white-space:nowrap">Zapisz</button>
            <button class="btn-g" id="pc-${cat.id}" style="padding:8px 10px">✕</button>
          </div>` : `
          <div class="cat-amounts" style="margin-top:6px">
            <div>
              <div style="font-size:13px;color:var(--dim)">plan: <span class="mono" style="color:${cat.color}">${plannedAmt > 0 ? UI.formatPLN(plannedAmt) : "—"}</span></div>
              <div style="font-size:13px;margin-top:2px">wydano: <span class="mono red">${UI.formatPLN(actualAmt)}</span></div>
            </div>
            <button class="btn-g" id="pe-${cat.id}" style="font-size:12px;white-space:nowrap">${plannedAmt > 0 ? "zmień" : "+ plan"}</button>
          </div>
          ${plannedAmt > 0 ? `<div class="track"><div class="fill" style="width:${pct}%;background:${over?"var(--red)":cat.color}"></div></div>` : ""}`}
      `;
      el.appendChild(card);

      setTimeout(() => {
        const pe = document.getElementById(`pe-${cat.id}`);
        if (pe) pe.onclick = () => { state.editingPlanned = cat.id; renderPlannedList(); setTimeout(() => document.getElementById(`pi-${cat.id}`)?.focus(), 30); };

        const ps = document.getElementById(`ps-${cat.id}`);
        const pc = document.getElementById(`pc-${cat.id}`);
        const pi = document.getElementById(`pi-${cat.id}`);

        if (ps) ps.onclick = () => {
          const val = parseFloat(document.getElementById(`pi-${cat.id}`)?.value || "0");
          Data.setPlanned(pk(), cat.id, isNaN(val) ? 0 : val);
          state.editingPlanned = null;
          renderPlannedList();
          renderSummaryCards();
          UI.toast("Plan zapisany ✓");
        };
        if (pc) pc.onclick = () => { state.editingPlanned = null; renderPlannedList(); };
        if (pi) pi.onkeydown = e => { if (e.key === "Enter") ps?.click(); if (e.key === "Escape") pc?.click(); };
      }, 0);
    }
  }

  // ============================================================
  // Income list
  // ============================================================

  function renderIncomeList() {
    const entries = Data.getIncomeEntries(pk());
    const list = UI.el("income-list");
    list.innerHTML = "";

    if (entries.length === 0) {
      list.innerHTML = `<div class="tx-empty">Brak przychodów w tym okresie.</div>`;
      return;
    }

    for (const e of [...entries].reverse()) {
      const cat = UI.INCOME_CATEGORIES.find(c => c.id === e.source) || UI.INCOME_CATEGORIES[UI.INCOME_CATEGORIES.length - 1];
      const isConfirm = state.deleteIncomeConfirm === e.id;
      const dateStr = e.id ? new Date(e.id).toISOString().slice(0, 10) : "";
      const row = document.createElement("div");
      row.className = "tx-row";
      row.innerHTML = `
        <div class="tx-icon" style="background:${cat.color}22">${cat.icon}</div>
        <div class="tx-info">
          <div class="tx-desc">${cat.label}</div>
          <div class="tx-meta">Przychód${dateStr ? " · " + dateStr : ""}</div>
        </div>
        <div class="tx-amt green">+${UI.formatPLN(e.amount)}</div>
        <div class="tx-del-area" id="di-${e.id}"></div>`;

      const da = row.querySelector(`#di-${e.id}`);
      if (isConfirm) {
        da.innerHTML = `<button class="btn-danger" id="ci-${e.id}">Usuń</button><button class="btn-g" id="cai-${e.id}" style="padding:5px 10px;font-size:12px">Anuluj</button>`;
        setTimeout(() => {
          const ci  = document.getElementById(`ci-${e.id}`);
          const cai = document.getElementById(`cai-${e.id}`);
          if (ci)  ci.onclick  = () => { Data.deleteIncomeEntry(pk(), e.id); state.deleteIncomeConfirm = null; renderIncomeList(); renderSummaryCards(); UI.toast("Usunięto", "err"); };
          if (cai) cai.onclick = () => { state.deleteIncomeConfirm = null; renderIncomeList(); };
        }, 0);
      } else {
        const btn = document.createElement("button");
        btn.className = "btn-del"; btn.textContent = "✕";
        btn.onclick = () => { state.deleteIncomeConfirm = e.id; renderIncomeList(); };
        da.appendChild(btn);
      }
      list.appendChild(row);
    }
  }

  // ============================================================
  // Add form — actual expense or income only
  // Planned is now managed in the "Zaplanowane" tab
  // ============================================================

  function initAddForm() {
    // Type toggle: actual | income
    document.querySelectorAll(".type-btn").forEach(btn => {
      btn.onclick = () => {
        const t = btn.dataset.subtype;
        document.querySelectorAll(".type-btn").forEach(b => {
          b.classList.remove("a-plan", "a-real", "a-inc");
        });
        btn.classList.add(t === "income" ? "a-inc" : "a-real");

        UI.el("income-source-row").classList.toggle("hidden", t !== "income");
        UI.el("category-row").classList.toggle("hidden", t === "income");
        UI.el("desc-row").classList.toggle("hidden", t === "income");
      };
    });

    // Build selects
    UI.buildCategoryOptions(UI.el("form-category"), "paliwo", UI.CATEGORIES);
    UI.buildCategoryOptions(UI.el("form-income-source"), "dominos", UI.INCOME_CATEGORIES);

    // Set date constraints to current period
    updateFormDate();

    UI.el("add-btn").onclick = submitForm;
    UI.el("form-amount").onkeydown = e => { if (e.key === "Enter") submitForm(); };
    UI.el("form-desc").onkeydown   = e => { if (e.key === "Enter") submitForm(); };
  }

  function updateFormDate() {
    const p = period();
    const today = UI.todayISO();
    const dateInput = UI.el("form-date");
    dateInput.min = p.startDate;
    dateInput.max = p.endDate;
    // Set to today if within period, otherwise period start
    if (today >= p.startDate && today <= p.endDate) {
      dateInput.value = today;
    } else {
      dateInput.value = p.startDate;
    }
  }

  function getActiveSubtype() {
    const btn = document.querySelector(".type-btn.a-real, .type-btn.a-inc");
    return btn ? btn.dataset.subtype : "actual";
  }

  function submitForm() {
    const subtype = getActiveSubtype();
    const amount  = UI.el("form-amount").value;

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      UI.toast("Podaj prawidłową kwotę!", "err");
      return;
    }

    if (subtype === "income") {
      const source = UI.el("form-income-source").value;
      Data.addIncomeEntry(pk(), source, amount);
      UI.el("form-amount").value = "";
      UI.toast("Dodano przychód ✓");
      renderMain();
      return;
    }

    // actual expense
    const desc = UI.el("form-desc").value.trim();
    const cat  = UI.el("form-category").value;
    const date = UI.el("form-date").value;
    if (!desc) { UI.toast("Wpisz opis!", "err"); return; }

    Data.addActual({ desc, amount, category: cat, date, periodKey: pk() });
    UI.el("form-desc").value   = "";
    UI.el("form-amount").value = "";
    UI.toast("Dodano wydatek ✓");
    renderMain();
  }

  // ============================================================
  // Render dispatcher
  // ============================================================

  function renderMain() {
    renderPeriodBar();
    renderSummaryCards();
    // Update date constraints when period changes
    updateFormDate();

    ["view-dashboard", "view-transactions"].forEach(id => UI.el(id)?.classList.add("hidden"));
    UI.el(`view-${state.view}`)?.classList.remove("hidden");

    if (state.view === "dashboard")    renderDashboard();
    if (state.view === "transactions") setTxTab(state.txTab);
  }

  // ============================================================
  // Change password modal
  // ============================================================

  function showChangePw() {
    UI.el("change-pw-modal").classList.remove("hidden");
    ["cpw-old", "cpw-new", "cpw-new2"].forEach(id => { UI.el(id).value = ""; });
    UI.el("cpw-error").textContent = "";
    setTimeout(() => UI.el("cpw-old").focus(), 50);
  }

  function initChangePwModal() {
    UI.el("cpw-cancel").onclick = () => UI.el("change-pw-modal").classList.add("hidden");
    UI.el("cpw-submit").onclick = async () => {
      const oldPw  = UI.el("cpw-old").value;
      const newPw  = UI.el("cpw-new").value;
      const newPw2 = UI.el("cpw-new2").value;
      const errEl  = UI.el("cpw-error");
      if (newPw !== newPw2) { errEl.textContent = "Nowe hasła nie są zgodne."; return; }
      const result = await Auth.changePassword(oldPw, newPw);
      if (!result.ok) { errEl.textContent = result.msg; return; }
      UI.el("change-pw-modal").classList.add("hidden");
      UI.toast("Hasło zostało zmienione ✓");
    };
  }

  // ============================================================
  // Init
  // ============================================================

  function init() {
    document.querySelectorAll(".nav-btn").forEach(btn =>
      btn.addEventListener("click", () => setView(btn.dataset.view))
    );
    UI.el("prev-period").onclick    = prevPeriod;
    UI.el("next-period").onclick    = nextPeriod;
    UI.el("logout-btn").onclick     = () => { Auth.logout(); location.reload(); };
    UI.el("change-pw-btn").onclick  = showChangePw;

    // Filter for actual transactions
    UI.buildCategoryOptions(UI.el("tx-filter"), "__none__", UI.CATEGORIES);
    const allOpt = document.createElement("option");
    allOpt.value = "all"; allOpt.textContent = "Wszystkie kategorie";
    UI.el("tx-filter").insertBefore(allOpt, UI.el("tx-filter").firstChild);
    UI.el("tx-filter").value = "all";
    UI.el("tx-filter").onchange = e => renderActualList(e.target.value);

    // Tab buttons
    document.querySelectorAll(".tab-btn").forEach(btn =>
      btn.addEventListener("click", () => setTxTab(btn.dataset.tab))
    );

    initAddForm();
    renderMain();
  }

  return { init, initChangePwModal };
})();
