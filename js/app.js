/* ============================================
   BUDŻETAPP — js/app.js
   Main application: views & interactions
   ============================================ */

const App = (() => {

  // --- State ---
  const now = new Date();
  let state = {
    year:  now.getFullYear(),
    month: now.getMonth(),
    view:  "dashboard",
    deleteConfirm: null,
    editingBudget: null,
  };

  function mk() { return UI.monthKey(state.year, state.month); }

  // ============================================================
  // Navigation
  // ============================================================

  function setView(v) {
    state.view = v;
    state.deleteConfirm = null;
    state.editingBudget = null;
    document.querySelectorAll(".nav-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.view === v);
    });
    renderMain();
  }

  function prevMonth() {
    if (state.month === 0) { state.year--; state.month = 11; }
    else state.month--;
    renderMain();
  }

  function nextMonth() {
    if (state.month === 11) { state.year++; state.month = 0; }
    else state.month++;
    renderMain();
  }

  // ============================================================
  // Month bar
  // ============================================================

  function renderMonthBar() {
    const isNow = state.year === now.getFullYear() && state.month === now.getMonth();
    const { txs } = Data.getMonthlySummary(mk());

    UI.el("month-label").innerHTML =
      UI.formatMonthLabel(state.year, state.month) +
      (isNow ? `<span class="month-now-dot">• teraz</span>` : "");
    UI.el("month-count").textContent = `${txs.length} transakcji`;
  }

  // ============================================================
  // Dashboard view
  // ============================================================

  function renderDashboard() {
    const { expenses, income, balance, txs } = Data.getMonthlySummary(mk());

    // Summary cards
    renderSummaryCards(income, expenses, balance);

    // Category breakdown
    const catGrid = UI.el("cat-grid");
    catGrid.innerHTML = "";
    const active = UI.CATEGORIES.filter(cat => {
      const spent = txs.filter(t => t.type === "expense" && t.category === cat.id).reduce((s,t)=>s+t.amount,0);
      const budget = Data.getBudget(mk(), cat.id);
      return spent > 0 || budget > 0;
    });

    if (active.length === 0) {
      catGrid.innerHTML = `<div class="cat-empty">Brak transakcji w tym miesiącu.<br>Dodaj pierwszą poniżej!</div>`;
    } else {
      for (const cat of active) {
        const spent  = txs.filter(t => t.type === "expense" && t.category === cat.id).reduce((s,t)=>s+t.amount,0);
        const budget = Data.getBudget(mk(), cat.id);
        const pct    = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
        const over   = budget > 0 && spent > budget;

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
              <span class="cat-spent mono" style="color:${cat.color}">${UI.formatPLN(spent)}</span>
              ${budget > 0 ? `<span class="cat-limit">/ ${UI.formatPLN(budget)}</span>` : ""}
            </div>
            ${budget > 0 ? `
              <div class="progress-track">
                <div class="progress-fill" style="width:${pct}%;background:${over?"var(--red)":cat.color}"></div>
              </div>` : ""}
          </div>`);
      }
    }
  }

  // ============================================================
  // Summary cards (shared by dashboard)
  // ============================================================

  function renderSummaryCards(income, expenses, balance) {
    const balPos = balance >= 0;

    UI.el("sum-income-val").textContent = UI.formatPLN(income);
    UI.el("sum-income-val").className = "summary-value green mono";

    UI.el("sum-expenses-val").textContent = UI.formatPLN(expenses);
    UI.el("sum-expenses-val").className = "summary-value red mono";

    UI.el("sum-balance-val").textContent = UI.formatPLN(Math.abs(balance));
    UI.el("sum-balance-val").className = `summary-value ${balPos ? "green" : "red"} mono`;

    const balCard = UI.el("sum-balance-card");
    balCard.className = `summary-card ${balPos ? "green-card" : "red-card"}`;
  }

  // ============================================================
  // Transactions view
  // ============================================================

  function renderTransactions(filterCat = "all") {
    const { txs } = Data.getMonthlySummary(mk());
    const filtered = filterCat === "all" ? txs : txs.filter(t => t.category === filterCat);
    const sorted   = [...filtered].sort((a,b) => b.date.localeCompare(a.date));

    const list = UI.el("tx-list");
    list.innerHTML = "";

    if (sorted.length === 0) {
      list.innerHTML = `<div class="tx-empty">Brak transakcji${filterCat !== "all" ? " w tej kategorii" : ""}.</div>`;
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
          <div class="tx-meta">${cat.label} · ${t.date}</div>
        </div>
        <div class="tx-amount ${t.type === "income" ? "green" : "red"}">
          ${t.type === "income" ? "+" : "−"}${UI.formatPLN(t.amount)}
        </div>
        <div class="tx-delete-area" id="del-area-${t.id}"></div>
      `;

      const delArea = row.querySelector(`#del-area-${t.id}`);
      if (isConfirm) {
        delArea.innerHTML = `
          <button class="btn-danger" id="confirm-del-${t.id}">Usuń</button>
          <button class="btn-ghost" id="cancel-del-${t.id}" style="padding:5px 10px;font-size:12px">Anuluj</button>
        `;
        // bind after insert
        setTimeout(() => {
          const cd = document.getElementById(`confirm-del-${t.id}`);
          const ca = document.getElementById(`cancel-del-${t.id}`);
          if (cd) cd.onclick = () => { Data.deleteTransaction(t.id); state.deleteConfirm = null; renderMain(); UI.toast("Usunięto transakcję", "error"); };
          if (ca) ca.onclick = () => { state.deleteConfirm = null; renderTransactions(filterCat); };
        }, 0);
      } else {
        const btn = document.createElement("button");
        btn.className = "btn-tx-delete";
        btn.textContent = "✕";
        btn.onclick = () => { state.deleteConfirm = t.id; renderTransactions(filterCat); };
        delArea.appendChild(btn);
      }

      list.appendChild(row);
    }
  }

  // ============================================================
  // Budgets view
  // ============================================================

  function renderBudgets() {
    const { txs } = Data.getMonthlySummary(mk());
    const list = UI.el("budget-list");
    list.innerHTML = "";

    for (const cat of UI.CATEGORIES) {
      const spent  = txs.filter(t => t.type === "expense" && t.category === cat.id).reduce((s,t)=>s+t.amount,0);
      const budget = Data.getBudget(mk(), cat.id);
      const pct    = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
      const over   = budget > 0 && spent > budget;
      const isEdit = state.editingBudget === cat.id;

      const card = document.createElement("div");
      card.className = `budget-card${over ? " over" : ""}`;

      card.innerHTML = `
        <div class="budget-card-main">
          <div class="budget-icon" style="background:${cat.color}22">${cat.icon}</div>
          <div class="budget-info">
            <div class="budget-name-row">
              <span class="budget-name">${cat.label}</span>
              <div style="display:flex;align-items:center;gap:8px">
                ${over ? `<span class="badge badge-red">przekroczono!</span>` : ""}
                ${budget > 0 ? `<span class="budget-pct">${Math.round(pct)}%</span>` : ""}
              </div>
            </div>
            ${isEdit ? `
              <div class="budget-edit-form" id="edit-form-${cat.id}">
                <input type="number" min="0" step="1" id="edit-input-${cat.id}" placeholder="Limit w zł" value="${budget || ""}" />
                <button class="btn-primary" id="save-budget-${cat.id}">Zapisz</button>
                <button class="btn-ghost" id="cancel-budget-${cat.id}">✕</button>
              </div>
            ` : `
              <div class="budget-amounts">
                <span class="budget-spent" style="color:${cat.color}">${UI.formatPLN(spent)}</span>
                <span class="budget-limit-text">${budget > 0 ? "limit: " + UI.formatPLN(budget) : "brak limitu"}</span>
              </div>
              ${budget > 0 ? `
                <div class="progress-track">
                  <div class="progress-fill" style="width:${pct}%;background:${over?"var(--red)":cat.color}"></div>
                </div>` : ""}
            `}
          </div>
          ${!isEdit ? `<button class="btn-ghost" id="edit-budget-btn-${cat.id}" style="margin-left:8px;white-space:nowrap;font-size:12px">${budget > 0 ? "zmień" : "+ ustaw"}</button>` : ""}
        </div>
      `;

      list.appendChild(card);

      // Bind buttons after DOM insert
      setTimeout(() => {
        const editBtn = document.getElementById(`edit-budget-btn-${cat.id}`);
        if (editBtn) editBtn.onclick = () => { state.editingBudget = cat.id; renderBudgets(); setTimeout(() => { const inp = document.getElementById(`edit-input-${cat.id}`); if(inp) inp.focus(); }, 50); };

        const saveBtn = document.getElementById(`save-budget-${cat.id}`);
        if (saveBtn) saveBtn.onclick = () => {
          const val = parseFloat(document.getElementById(`edit-input-${cat.id}`)?.value);
          if (!isNaN(val) && val >= 0) { Data.setBudget(mk(), cat.id, val); UI.toast("Limit zapisany ✓"); }
          state.editingBudget = null; renderBudgets();
        };

        const cancelBtn = document.getElementById(`cancel-budget-${cat.id}`);
        if (cancelBtn) cancelBtn.onclick = () => { state.editingBudget = null; renderBudgets(); };

        const inp = document.getElementById(`edit-input-${cat.id}`);
        if (inp) inp.onkeydown = (e) => {
          if (e.key === "Enter") saveBtn?.click();
          if (e.key === "Escape") cancelBtn?.click();
        };
      }, 0);
    }
  }

  // ============================================================
  // Add transaction form
  // ============================================================

  function initAddForm() {
    const typeExpense = UI.el("type-expense");
    const typeIncome  = UI.el("type-income");
    const catSelect   = UI.el("form-category");
    const dateInput   = UI.el("form-date");
    const addBtn      = UI.el("add-btn");

    UI.buildCategoryOptions(catSelect);
    dateInput.value = UI.todayISO();

    typeExpense.onclick = () => { typeExpense.classList.add("active-expense");   typeIncome.classList.remove("active-income"); };
    typeIncome.onclick  = () => { typeIncome.classList.add("active-income");     typeExpense.classList.remove("active-expense"); };

    addBtn.onclick = submitForm;
    UI.el("form-amount").onkeydown = e => { if (e.key === "Enter") submitForm(); };
    UI.el("form-desc").onkeydown   = e => { if (e.key === "Enter") submitForm(); };
  }

  function submitForm() {
    const desc    = UI.el("form-desc").value.trim();
    const amount  = UI.el("form-amount").value;
    const cat     = UI.el("form-category").value;
    const date    = UI.el("form-date").value;
    const typeExp = UI.el("type-expense").classList.contains("active-expense");
    const type    = typeExp ? "expense" : "income";

    if (!desc || !amount || isNaN(parseFloat(amount))) {
      UI.toast("Wypełnij opis i kwotę!", "error");
      return;
    }

    Data.addTransaction({ desc, amount, category: cat, type, date });
    UI.el("form-desc").value   = "";
    UI.el("form-amount").value = "";
    UI.toast("Dodano transakcję ✓");
    renderMain();
  }

  // ============================================================
  // Income editing (dashboard)
  // ============================================================

  function initIncomeEdit() {
    UI.el("income-edit-btn").onclick = () => {
      const cur = Data.getIncome(mk());
      UI.el("income-edit-input").value = cur || "";
      UI.hide("income-display");
      UI.show("income-edit-form");
      setTimeout(() => UI.el("income-edit-input").focus(), 50);
    };
    UI.el("income-save-btn").onclick = saveIncome;
    UI.el("income-cancel-btn").onclick = () => { UI.hide("income-edit-form"); UI.show("income-display"); };
    UI.el("income-edit-input").onkeydown = e => { if (e.key === "Enter") saveIncome(); if (e.key === "Escape") UI.el("income-cancel-btn").click(); };
  }

  function saveIncome() {
    const val = parseFloat(UI.el("income-edit-input").value);
    if (!isNaN(val) && val >= 0) {
      Data.setIncome(mk(), val);
      UI.hide("income-edit-form");
      UI.show("income-display");
      renderMain();
      UI.toast("Przychód zapisany ✓");
    } else {
      UI.toast("Podaj prawidłową kwotę", "error");
    }
  }

  // ============================================================
  // Main render dispatcher
  // ============================================================

  function renderMain() {
    renderMonthBar();

    // Hide all views
    ["view-dashboard", "view-transactions", "view-budgets"].forEach(id => UI.el(id)?.classList.add("hidden"));

    // Show active view
    const viewEl = UI.el(`view-${state.view}`);
    if (viewEl) viewEl.classList.remove("hidden");

    if (state.view === "dashboard") {
      renderDashboard();
      // Reset income edit UI
      UI.show("income-display");
      UI.hide("income-edit-form");
    }
    if (state.view === "transactions") {
      const filter = UI.el("tx-filter")?.value || "all";
      renderTransactions(filter);
    }
    if (state.view === "budgets") {
      renderBudgets();
    }
  }

  // ============================================================
  // Boot
  // ============================================================

  function init() {
    // Nav buttons
    document.querySelectorAll(".nav-btn").forEach(btn => {
      btn.addEventListener("click", () => setView(btn.dataset.view));
    });

    // Month nav
    UI.el("prev-month").onclick = prevMonth;
    UI.el("next-month").onclick = nextMonth;

    // Tx filter
    UI.el("tx-filter").onchange = e => renderTransactions(e.target.value);
    UI.buildCategoryOptions(UI.el("tx-filter"), "__none__");
    const allOpt = document.createElement("option");
    allOpt.value = "all"; allOpt.textContent = "Wszystkie kategorie";
    UI.el("tx-filter").insertBefore(allOpt, UI.el("tx-filter").firstChild);
    UI.el("tx-filter").value = "all";

    // Logout
    UI.el("logout-btn").onclick = () => {
      Auth.logout();
      location.reload();
    };

    // Change password
    UI.el("change-pw-btn").onclick = showChangePw;

    initAddForm();
    initIncomeEdit();
    renderMain();
  }

  // ============================================================
  // Change password modal (inline in settings row)
  // ============================================================

  function showChangePw() {
    const modal = UI.el("change-pw-modal");
    modal.classList.remove("hidden");
    UI.el("cpw-old").value = "";
    UI.el("cpw-new").value = "";
    UI.el("cpw-new2").value = "";
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

  return { init, initChangePwModal };
})();
