/* ============================================
   BUDŻETAPP — js/app.js
   Main application logic
   ============================================ */

const App = (() => {

  const base = UI.getCurrentPeriodBase();
  let state = {
    offset: 0,          // 0 = current period, -1 = prev, +1 = next
    view: "dashboard",
    txTab: "actual",    // "planned" | "actual" | "income"
    deleteConfirm: null,
    editingBudget: null,
    deleteIncomeConfirm: null,
  };

  function period() { return UI.periodFromBase(base, state.offset); }
  function pk()     { return period().periodKey; }

  // ============================================================
  // Navigation
  // ============================================================

  function setView(v) {
    state.view = v;
    state.deleteConfirm = null;
    state.editingBudget = null;
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
    const { txs, planned, actual, income } = Data.getPeriodSummary(pk());
    const isNow = state.offset === 0;

    UI.el("period-label").innerHTML =
      p.label + (isNow ? `<span class="month-now-dot">• teraz</span>` : "");
    UI.el("period-count").textContent = `${txs.length} wpisów`;
  }

  // ============================================================
  // Summary cards
  // ============================================================

  function renderSummaryCards() {
    const { planned, actual, income, balance } = Data.getPeriodSummary(pk());
    const balPos = balance >= 0;

    UI.el("sum-income-val").textContent   = UI.formatPLN(income);
    UI.el("sum-planned-val").textContent  = UI.formatPLN(planned);
    UI.el("sum-actual-val").textContent   = UI.formatPLN(actual);
    UI.el("sum-balance-val").textContent  = UI.formatPLN(Math.abs(balance));
    UI.el("sum-balance-val").className    = `summary-value ${balPos?"green":"red"} mono`;
    UI.el("sum-balance-card").className   = `summary-card ${balPos?"green-card":"red-card"}`;

    const diff = planned - actual;
    const diffEl = UI.el("sum-diff-val");
    if (diffEl) {
      diffEl.textContent = (diff >= 0 ? "−" : "+") + UI.formatPLN(Math.abs(diff));
      diffEl.className = `summary-value ${diff >= 0 ? "green" : "red"} mono`;
      diffEl.title = diff >= 0 ? "Zmieściłeś się w planie" : "Przekroczyłeś plan";
    }
  }

  // ============================================================
  // Dashboard view
  // ============================================================

  function renderDashboard() {
    renderSummaryCards();

    const { txs } = Data.getPeriodSummary(pk());
    const catGrid = UI.el("cat-grid");
    catGrid.innerHTML = "";

    const active = UI.CATEGORIES.filter(cat => {
      const plannedAmt = txs.filter(t => t.subtype==="planned" && t.category===cat.id).reduce((s,t)=>s+t.amount,0);
      const actualAmt  = txs.filter(t => t.subtype==="actual"  && t.category===cat.id).reduce((s,t)=>s+t.amount,0);
      const budget     = Data.getBudget(pk(), cat.id);
      return plannedAmt > 0 || actualAmt > 0 || budget > 0;
    });

    if (active.length === 0) {
      catGrid.innerHTML = `<div class="cat-empty">Brak wpisów w tym okresie.<br>Zacznij od dodania transakcji!</div>`;
    } else {
      for (const cat of active) {
        const plannedAmt = txs.filter(t => t.subtype==="planned" && t.category===cat.id).reduce((s,t)=>s+t.amount,0);
        const actualAmt  = txs.filter(t => t.subtype==="actual"  && t.category===cat.id).reduce((s,t)=>s+t.amount,0);
        const budget     = Data.getBudget(pk(), cat.id);
        const compareBase = budget > 0 ? budget : plannedAmt;
        const pct  = compareBase > 0 ? Math.min((actualAmt / compareBase)*100, 100) : 0;
        const over = compareBase > 0 && actualAmt > compareBase;

        catGrid.insertAdjacentHTML("beforeend", `
          <div class="cat-item">
            <div class="cat-item-header">
              <div class="cat-item-name">
                <span class="cat-icon">${cat.icon}</span>
                <span>${cat.label}</span>
              </div>
              ${over ? `<span class="badge badge-red">przekroczono</span>` : ""}
            </div>
            <div class="cat-amounts">
              <div>
                ${plannedAmt > 0 ? `<div class="cat-planned">plan: <span class="mono">${UI.formatPLN(plannedAmt)}</span></div>` : ""}
                <div class="cat-spent mono" style="color:${cat.color}">real: ${UI.formatPLN(actualAmt)}</div>
              </div>
              ${compareBase > 0 ? `<span class="cat-limit">/ ${UI.formatPLN(compareBase)}</span>` : ""}
            </div>
            ${compareBase > 0 ? `
              <div class="progress-track">
                <div class="progress-fill" style="width:${pct}%;background:${over?"var(--red)":cat.color}"></div>
              </div>` : ""}
          </div>`);
      }
    }
  }

  // ============================================================
  // Transactions view — tabs: zaplanowane / rzeczywiste / przychody
  // ============================================================

  function setTxTab(tab) {
    state.txTab = tab;
    state.deleteConfirm = null;
    state.deleteIncomeConfirm = null;
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));

    UI.el("tx-expense-section").classList.toggle("hidden", tab === "income");
    UI.el("tx-income-section").classList.toggle("hidden", tab !== "income");

    const filterRow = UI.el("tx-filter-row");
    if (filterRow) filterRow.style.display = tab === "income" ? "none" : "";

    if (tab === "income") renderIncomeList();
    else renderTransactions(tab, UI.el("tx-filter")?.value || "all");
  }

  function renderTransactions(subtype, filterCat = "all") {
    const { txs } = Data.getPeriodSummary(pk());
    let filtered = txs.filter(t => t.subtype === subtype);
    if (filterCat !== "all") filtered = filtered.filter(t => t.category === filterCat);
    const sorted = [...filtered].sort((a,b) => b.date.localeCompare(a.date));

    const list = UI.el("tx-list");
    list.innerHTML = "";

    if (sorted.length === 0) {
      list.innerHTML = `<div class="tx-empty">Brak ${subtype==="planned"?"zaplanowanych":"rzeczywistych"} wydatków${filterCat!=="all"?" w tej kategorii":""}.</div>`;
      return;
    }

    for (const t of sorted) {
      const cat = UI.getCategory(t.category);
      const isConfirm = state.deleteConfirm === t.id;
      const row = document.createElement("div");
      row.className = "tx-row";
      row.innerHTML = `
        <div class="tx-icon" style="background:${cat.color}22">${cat.icon}</div>
        <div class="tx-info">
          <div class="tx-desc truncate">${t.desc}</div>
          <div class="tx-meta">${cat.label} · ${t.date}
            ${subtype==="planned" ? `<span class="badge-mini plan">plan</span>` : `<span class="badge-mini actual">real</span>`}
          </div>
        </div>
        <div class="tx-amount red">−${UI.formatPLN(t.amount)}</div>
        <div class="tx-delete-area" id="del-area-${t.id}"></div>
      `;
      const delArea = row.querySelector(`#del-area-${t.id}`);
      if (isConfirm) {
        delArea.innerHTML = `
          <button class="btn-danger" id="cd-${t.id}">Usuń</button>
          <button class="btn-ghost" id="ca-${t.id}" style="padding:5px 10px;font-size:12px">Anuluj</button>`;
        setTimeout(() => {
          const cd = document.getElementById(`cd-${t.id}`);
          const ca = document.getElementById(`ca-${t.id}`);
          if (cd) cd.onclick = () => { Data.deleteTransaction(t.id); state.deleteConfirm = null; renderMain(); UI.toast("Usunięto","error"); };
          if (ca) ca.onclick = () => { state.deleteConfirm = null; renderTransactions(subtype, UI.el("tx-filter")?.value||"all"); };
        }, 0);
      } else {
        const btn = document.createElement("button");
        btn.className = "btn-tx-delete"; btn.textContent = "✕";
        btn.onclick = () => { state.deleteConfirm = t.id; renderTransactions(subtype, UI.el("tx-filter")?.value||"all"); };
        delArea.appendChild(btn);
      }
      list.appendChild(row);
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
      const cat = UI.INCOME_CATEGORIES.find(c => c.id === e.source) || UI.INCOME_CATEGORIES[UI.INCOME_CATEGORIES.length-1];
      const isConfirm = state.deleteIncomeConfirm === e.id;
      const row = document.createElement("div");
      row.className = "tx-row";
      row.innerHTML = `
        <div class="tx-icon" style="background:${cat.color}22">${cat.icon}</div>
        <div class="tx-info">
          <div class="tx-desc">${cat.label}</div>
          <div class="tx-meta">Przychód · ${e.id ? new Date(e.id).toISOString().slice(0,10) : ""}</div>
        </div>
        <div class="tx-amount green">+${UI.formatPLN(e.amount)}</div>
        <div class="tx-delete-area" id="del-inc-${e.id}"></div>
      `;
      const da = row.querySelector(`#del-inc-${e.id}`);
      if (isConfirm) {
        da.innerHTML = `
          <button class="btn-danger" id="ci-${e.id}">Usuń</button>
          <button class="btn-ghost" id="cai-${e.id}" style="padding:5px 10px;font-size:12px">Anuluj</button>`;
        setTimeout(() => {
          const ci  = document.getElementById(`ci-${e.id}`);
          const cai = document.getElementById(`cai-${e.id}`);
          if (ci)  ci.onclick  = () => { Data.deleteIncomeEntry(pk(), e.id); state.deleteIncomeConfirm = null; renderIncomeList(); renderSummaryCards(); UI.toast("Usunięto","error"); };
          if (cai) cai.onclick = () => { state.deleteIncomeConfirm = null; renderIncomeList(); };
        }, 0);
      } else {
        const btn = document.createElement("button");
        btn.className = "btn-tx-delete"; btn.textContent = "✕";
        btn.onclick = () => { state.deleteIncomeConfirm = e.id; renderIncomeList(); };
        da.appendChild(btn);
      }
      list.appendChild(row);
    }
  }

  // ============================================================
  // Budgets view
  // ============================================================

  function renderBudgets() {
    const { txs } = Data.getPeriodSummary(pk());
    const list = UI.el("budget-list");
    list.innerHTML = "";

    for (const cat of UI.CATEGORIES) {
      const plannedAmt = txs.filter(t => t.subtype==="planned" && t.category===cat.id).reduce((s,t)=>s+t.amount,0);
      const actualAmt  = txs.filter(t => t.subtype==="actual"  && t.category===cat.id).reduce((s,t)=>s+t.amount,0);
      const budget     = Data.getBudget(pk(), cat.id);
      const compareBase = budget > 0 ? budget : plannedAmt;
      const pct  = compareBase > 0 ? Math.min((actualAmt/compareBase)*100, 100) : 0;
      const over = compareBase > 0 && actualAmt > compareBase;
      const isEdit = state.editingBudget === cat.id;

      const card = document.createElement("div");
      card.className = `budget-card${over?" over":""}`;
      card.innerHTML = `
        <div class="budget-card-main">
          <div class="budget-icon" style="background:${cat.color}22">${cat.icon}</div>
          <div class="budget-info">
            <div class="budget-name-row">
              <span class="budget-name">${cat.label}</span>
              <div style="display:flex;align-items:center;gap:8px">
                ${over?`<span class="badge badge-red">przekroczono!</span>`:""}
                ${compareBase>0?`<span class="budget-pct mono">${Math.round(pct)}%</span>`:""}
              </div>
            </div>
            ${isEdit ? `
              <div class="budget-edit-form" id="edit-form-${cat.id}">
                <input type="number" min="0" step="1" id="edit-input-${cat.id}" placeholder="Limit w zł" value="${budget||""}" />
                <button class="btn-primary" id="save-budget-${cat.id}">Zapisz</button>
                <button class="btn-ghost" id="cancel-budget-${cat.id}">✕</button>
              </div>` : `
              <div class="budget-amounts">
                <div>
                  ${plannedAmt>0?`<div style="font-size:12px;color:var(--text-dim)">plan: <span class="mono">${UI.formatPLN(plannedAmt)}</span></div>`:""}
                  <span class="budget-spent" style="color:${cat.color}">real: ${UI.formatPLN(actualAmt)}</span>
                </div>
                <span class="budget-limit-text">${budget>0?"limit: "+UI.formatPLN(budget):plannedAmt>0?"plan: "+UI.formatPLN(plannedAmt):"brak limitu"}</span>
              </div>
              ${compareBase>0?`<div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:${over?"var(--red)":cat.color}"></div></div>`:""}`}
          </div>
          ${!isEdit?`<button class="btn-ghost" id="edit-budget-btn-${cat.id}" style="margin-left:8px;white-space:nowrap;font-size:12px">${budget>0?"zmień":"+ limit"}</button>`:""}
        </div>`;
      list.appendChild(card);

      setTimeout(() => {
        const eb = document.getElementById(`edit-budget-btn-${cat.id}`);
        if (eb) eb.onclick = () => { state.editingBudget = cat.id; renderBudgets(); setTimeout(()=>{ document.getElementById(`edit-input-${cat.id}`)?.focus(); },50); };
        const sb = document.getElementById(`save-budget-${cat.id}`);
        if (sb) sb.onclick = () => {
          const val = parseFloat(document.getElementById(`edit-input-${cat.id}`)?.value);
          if (!isNaN(val) && val>=0) { Data.setBudget(pk(), cat.id, val); UI.toast("Limit zapisany ✓"); }
          state.editingBudget = null; renderBudgets();
        };
        const cb = document.getElementById(`cancel-budget-${cat.id}`);
        if (cb) cb.onclick = () => { state.editingBudget = null; renderBudgets(); };
        const inp = document.getElementById(`edit-input-${cat.id}`);
        if (inp) inp.onkeydown = e => { if(e.key==="Enter") sb?.click(); if(e.key==="Escape") cb?.click(); };
      }, 0);
    }
  }

  // ============================================================
  // Add form
  // ============================================================

  function initAddForm() {
    const p = period();

    // Expense type toggle
    document.querySelectorAll(".type-btn").forEach(btn => {
      btn.onclick = () => {
        const t = btn.dataset.subtype;
        document.querySelectorAll(".type-btn").forEach(b => b.className = "type-btn");
        btn.classList.add(t==="income" ? "active-income" : t==="planned" ? "active-planned" : "active-expense");

        // Show/hide income source row
        const incRow = UI.el("income-source-row");
        const catRow = UI.el("category-row");
        if (t === "income") {
          incRow.classList.remove("hidden");
          catRow.classList.add("hidden");
        } else {
          incRow.classList.add("hidden");
          catRow.classList.remove("hidden");
        }
      };
    });

    // Build selects
    UI.buildCategoryOptions(UI.el("form-category"), "paliwo", UI.CATEGORIES);
    UI.buildCategoryOptions(UI.el("form-income-source"), "dominos", UI.INCOME_CATEGORIES);

    // Default date to period start or today (whichever is later)
    const today = UI.todayISO();
    UI.el("form-date").value = today >= p.startDate ? today : p.startDate;
    UI.el("form-date").min = p.startDate;
    UI.el("form-date").max = p.endDate;

    UI.el("add-btn").onclick = submitForm;
    UI.el("form-amount").onkeydown = e => { if(e.key==="Enter") submitForm(); };
    UI.el("form-desc").onkeydown   = e => { if(e.key==="Enter") submitForm(); };
  }

  function getActiveSubtype() {
    const btn = document.querySelector(".type-btn.active-expense, .type-btn.active-planned, .type-btn.active-income");
    return btn ? btn.dataset.subtype : "actual";
  }

  function submitForm() {
    const subtype = getActiveSubtype();
    const amount  = UI.el("form-amount").value;
    const date    = UI.el("form-date").value;

    if (!amount || isNaN(parseFloat(amount))) { UI.toast("Podaj kwotę!", "error"); return; }

    if (subtype === "income") {
      const source = UI.el("form-income-source").value;
      Data.addIncomeEntry(pk(), source, amount);
      UI.el("form-amount").value = "";
      UI.toast("Dodano przychód ✓");
      renderMain();
      return;
    }

    const desc = UI.el("form-desc").value.trim();
    const cat  = UI.el("form-category").value;
    if (!desc) { UI.toast("Wpisz opis!", "error"); return; }

    Data.addTransaction({ desc, amount, category: cat, subtype, date, periodKey: pk() });
    UI.el("form-desc").value   = "";
    UI.el("form-amount").value = "";
    UI.toast(subtype==="planned" ? "Dodano do planu ✓" : "Dodano wydatek ✓");
    renderMain();
  }

  // ============================================================
  // Render dispatcher
  // ============================================================

  function renderMain() {
    renderPeriodBar();
    renderSummaryCards();

    ["view-dashboard","view-transactions","view-budgets"].forEach(id => UI.el(id)?.classList.add("hidden"));
    UI.el(`view-${state.view}`)?.classList.remove("hidden");

    if (state.view === "dashboard")    renderDashboard();
    if (state.view === "transactions") setTxTab(state.txTab);
    if (state.view === "budgets")      renderBudgets();
  }

  // ============================================================
  // Change password modal
  // ============================================================

  function showChangePw() {
    UI.el("change-pw-modal").classList.remove("hidden");
    ["cpw-old","cpw-new","cpw-new2"].forEach(id => { UI.el(id).value = ""; });
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
    document.querySelectorAll(".nav-btn").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.view)));
    UI.el("prev-period").onclick = prevPeriod;
    UI.el("next-period").onclick = nextPeriod;
    UI.el("logout-btn").onclick  = () => { Auth.logout(); location.reload(); };
    UI.el("change-pw-btn").onclick = showChangePw;

    // Tx filter
    UI.buildCategoryOptions(UI.el("tx-filter"), "all", UI.CATEGORIES);
    const allOpt = document.createElement("option");
    allOpt.value = "all"; allOpt.textContent = "Wszystkie kategorie";
    UI.el("tx-filter").insertBefore(allOpt, UI.el("tx-filter").firstChild);
    UI.el("tx-filter").value = "all";
    UI.el("tx-filter").onchange = e => renderTransactions(state.txTab === "income" ? "actual" : state.txTab, e.target.value);

    // Tab buttons
    document.querySelectorAll(".tab-btn").forEach(btn => btn.addEventListener("click", () => setTxTab(btn.dataset.tab)));

    initAddForm();
    renderMain();
  }

  return { init, initChangePwModal };
})();
