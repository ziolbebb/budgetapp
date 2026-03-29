// ============================================================
// BudżetApp — js/app.js
// ============================================================

const App = (() => {

  const base = UI.getCurrentPeriodBase();
  let state = { offset: 0, view: "dashboard", txTab: "actual", cache: {} };

  const period  = () => UI.periodFromBase(base, state.offset);
  const pk      = () => period().periodKey;
  const bust    = () => { state.cache = {}; };

  async function cached(key, fn) {
    if (state.cache[key] !== undefined) return state.cache[key];
    return (state.cache[key] = await fn());
  }

  // ── Navigation ─────────────────────────────────────────────

  function setView(v) {
    state.view = v; bust();

    // Sync desktop nav
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === v));
    // Sync bottom nav
    document.querySelectorAll(".bnav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === v));

    // Show/hide period bar and summary cards only on dashboard + transactions
    const showPeriod = v === "dashboard" || v === "transactions";
    UI.el("period-bar-wrap")?.classList.toggle("hidden", !showPeriod);
    UI.el("sum-grid-wrap")?.classList.toggle("hidden",   !showPeriod);
    UI.el("global-balance-bar")?.classList.toggle("hidden", !showPeriod);

    renderMain();
  }

  function prevPeriod() { state.offset--; bust(); renderMain(); }
  function nextPeriod() { state.offset++; bust(); renderMain(); }

  // ── Period bar ─────────────────────────────────────────────

  function renderPeriodBar(count = 0) {
    const p = period();
    UI.el("period-label").innerHTML =
      p.label + (state.offset === 0 ? `<span class="now-dot">• current</span>` : "");
    UI.el("period-count").textContent = `${count} expenses`;
  }

  // ── Summary cards ──────────────────────────────────────────

  function renderSummaryCards({ plannedTotal, actualTotal, income, balance }) {
    UI.el("sum-income-val").textContent  = UI.formatPLN(income);
    UI.el("sum-planned-val").textContent = UI.formatPLN(plannedTotal);
    UI.el("sum-actual-val").textContent  = UI.formatPLN(actualTotal);
    UI.el("sum-balance-val").textContent = UI.formatPLN(Math.abs(balance));
    const pos = balance >= 0;
    UI.el("sum-balance-val").className   = `sum-val mono ${pos ? "green" : "red"}`;
    UI.el("sum-balance-card").className  = `sum-card ${pos ? "gc" : "rc"}`;
  }

  // ── Build summary ──────────────────────────────────────────

  async function buildSummary(periodKey) {
    return cached("sum_" + periodKey, async () => {
      const [txs, incomes] = await Promise.all([DB.getTransactions(periodKey), DB.getIncomes(periodKey)]);
      const planned      = txs.filter(t => t.subtype === "planned");
      const actual       = txs.filter(t => t.subtype === "actual");
      const plannedTotal = planned.reduce((s,t) => s + +t.amount, 0);
      const actualTotal  = actual.reduce((s,t)  => s + +t.amount, 0);
      const income       = incomes.reduce((s,i)  => s + +i.amount, 0);
      return { txs, planned, actual, incomes, plannedTotal, actualTotal, income, balance: income - actualTotal };
    });
  }

  // ── Global balance ─────────────────────────────────────────

  async function renderGlobalBalance() {
    const [allTxs, allInc] = await Promise.all([DB.getAllTransactions(), DB.getAllIncomes()]);
    const totalIncome  = allInc.reduce((s,i) => s + +i.amount, 0);
    const totalActual  = allTxs.filter(t => t.subtype === "actual").reduce((s,t) => s + +t.amount, 0);
    const globalBal    = totalIncome - totalActual;
    const el = UI.el("global-balance-val");
    if (el) {
      el.textContent = UI.formatPLN(globalBal);
      el.className   = `sum-val mono ${globalBal >= 0 ? "green" : "red"}`;
    }
  }

  // ── Dashboard ──────────────────────────────────────────────

  async function renderDashboard() {
    UI.loading(true);
    try {
      const data = await buildSummary(pk());
      renderPeriodBar(data.actual.length);
      renderSummaryCards(data);
      renderGlobalBalance();

      const grid = UI.el("cat-grid");
      grid.innerHTML = "";

      const active = UI.CATEGORIES.filter(cat => {
        const p = data.planned.filter(t => t.category === cat.id).reduce((s,t)=>s+ +t.amount,0);
        const a = data.actual.filter(t  => t.category === cat.id).reduce((s,t)=>s+ +t.amount,0);
        return p > 0 || a > 0;
      });

      if (!active.length) {
        grid.innerHTML = `<div class="cat-empty">No entries this period.<br>Add expenses or plan below!</div>`;
        return;
      }

      for (const cat of active) {
        const p   = data.planned.filter(t => t.category === cat.id).reduce((s,t)=>s+ +t.amount,0);
        const a   = data.actual.filter(t  => t.category === cat.id).reduce((s,t)=>s+ +t.amount,0);
        const pct = p > 0 ? Math.min((a/p)*100,100) : 0;
        const over= p > 0 && a > p;
        grid.insertAdjacentHTML("beforeend", `
          <div class="cat-item">
            <div class="cat-hdr">
              <div class="cat-name"><span>${cat.icon}</span><span>${cat.label}</span></div>
              ${over ? `<span class="badge br">over budget</span>` : ""}
            </div>
            ${p > 0 ? `<div class="cat-plan-row">planned: <span class="mono">${UI.formatPLN(p)}</span></div>` : ""}
            <div class="cat-spent mono" style="color:${cat.color}">spent: ${UI.formatPLN(a)}</div>
            ${p > 0 ? `<div class="track"><div class="fill" style="width:${pct}%;background:${over?"var(--red)":cat.color}"></div></div>` : ""}
          </div>`);
      }
    } finally { UI.loading(false); }
  }

  // ── Transactions view ──────────────────────────────────────

  function setTxTab(tab) {
    state.txTab = tab;
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    ["tx-actual-sec","tx-planned-sec","tx-income-sec"].forEach(id => UI.el(id)?.classList.add("hidden"));
    UI.el(`tx-${tab}-sec`)?.classList.remove("hidden");
    const fr = UI.el("tx-filter-row");
    if (fr) fr.style.display = tab === "actual" ? "" : "none";
    if (tab === "actual")  renderActualList();
    if (tab === "planned") renderPlannedList();
    if (tab === "income")  renderIncomeList();
  }

  async function renderActualList(filterCat = "all") {
    UI.loading(true);
    try {
      const data = await buildSummary(pk());
      renderPeriodBar(data.actual.length);
      let list = filterCat === "all" ? data.actual : data.actual.filter(t => t.category === filterCat);
      const el = UI.el("tx-actual-list");
      el.innerHTML = "";
      if (!list.length) { el.innerHTML = `<div class="tx-empty">No actual expenses${filterCat!=="all"?" in this category":""}.</div>`; return; }
      list.forEach(t => {
        const cat = UI.getCategory(t.category);
        el.appendChild(makeTxRow(t, cat, "var(--red)", "−",
          () => { bust(); renderActualList(UI.el("tx-filter")?.value||"all"); }, true));
      });
    } finally { UI.loading(false); }
  }

  async function renderPlannedList() {
    UI.loading(true);
    try {
      const data = await buildSummary(pk());
      const el = UI.el("tx-planned-list");
      el.innerHTML = "";
      if (!data.planned.length) { el.innerHTML = `<div class="tx-empty">No planned expenses this period.</div>`; return; }
      data.planned.forEach(t => {
        const cat = UI.getCategory(t.category);
        el.appendChild(makeTxRow(t, cat, "var(--accent2)", "−",
          () => { bust(); renderPlannedList(); }, true, true));
      });
    } finally { UI.loading(false); }
  }

  async function renderIncomeList() {
    UI.loading(true);
    try {
      const data = await buildSummary(pk());
      const el = UI.el("tx-income-list");
      el.innerHTML = "";
      if (!data.incomes.length) { el.innerHTML = `<div class="tx-empty">No income entries this period.</div>`; return; }
      data.incomes.forEach(e => {
        const cat = UI.INCOME_CATEGORIES.find(c => c.id === e.source) || UI.INCOME_CATEGORIES[3];
        const row = document.createElement("div");
        row.className = "tx-row";
        row.innerHTML = `
          <div class="tx-icon" style="background:${cat.color}22">${cat.icon}</div>
          <div class="tx-info">
            <div class="tx-desc">${cat.label}</div>
            <div class="tx-meta">Income · ${e.created_at?.slice(0,10)||""}</div>
          </div>
          <div class="tx-amt green mono">+${UI.formatPLN(e.amount)}</div>
          <button class="btn-del">✕</button>`;
        row.querySelector(".btn-del").onclick = async () => {
          if (!confirm("Delete this income entry?")) return;
          UI.loading(true);
          await DB.deleteIncome(e.id);
          bust(); renderIncomeList(); renderSummaryCards(await buildSummary(pk()));
          UI.loading(false); UI.toast("Deleted", "err");
        };
        el.appendChild(row);
      });
    } finally { UI.loading(false); }
  }

  function makeTxRow(t, cat, amtColor, sign, onDelete, canEdit=false, isPlanned=false) {
    const row = document.createElement("div");
    row.className = "tx-row";
    row.innerHTML = `
      <div class="tx-icon" style="background:${cat.color}22">${cat.icon}</div>
      <div class="tx-info">
        <div class="tx-desc truncate">${t.description}</div>
        <div class="tx-meta">${cat.label}${isPlanned?` · <span class="badge bp">plan</span>`:""}</div>
      </div>
      <div class="tx-amt mono" style="color:${amtColor}">${sign}${UI.formatPLN(t.amount)}</div>
      <div style="display:flex;gap:4px;align-items:center">
        ${canEdit ? `<button class="btn-edit" title="Edit">✏️</button>` : ""}
        <button class="btn-del">✕</button>
      </div>`;

    row.querySelector(".btn-del").onclick = async () => {
      if (!confirm("Delete this entry?")) return;
      UI.loading(true);
      await DB.deleteTransaction(t.id);
      UI.loading(false); bust(); onDelete(); UI.toast("Deleted", "err");
    };
    if (canEdit) {
      row.querySelector(".btn-edit").onclick = () => openEditModal(t, onDelete);
    }
    return row;
  }

  function openEditModal(t, onSave) {
    const modal = UI.el("edit-modal");
    UI.el("edit-desc").value   = t.description;
    UI.el("edit-amount").value = t.amount;
    const sel = UI.el("edit-category");
    sel.innerHTML = "";
    UI.CATEGORIES.forEach(c => {
      const o = document.createElement("option");
      o.value = c.id; o.textContent = `${c.icon} ${c.label}`;
      if (c.id === t.category) o.selected = true;
      sel.appendChild(o);
    });
    modal.classList.remove("hidden");
    UI.el("edit-cancel").onclick = () => modal.classList.add("hidden");
    UI.el("edit-save").onclick = async () => {
      const desc   = UI.el("edit-desc").value.trim();
      const amount = parseFloat(UI.el("edit-amount").value);
      const catId  = UI.el("edit-category").value;
      if (!desc || isNaN(amount) || amount <= 0) { UI.toast("Fill in all fields correctly!", "err"); return; }
      UI.loading(true);
      await DB.updateTransaction(t.id, { description: desc, amount, category: catId });
      modal.classList.add("hidden"); bust(); onSave();
      UI.loading(false); UI.toast("Saved ✓");
    };
  }

  // ── Add form ───────────────────────────────────────────────

  function buildCategoryGrid(gridId, cats, hiddenId) {
    const grid = UI.el(gridId);
    if (!grid) return;
    grid.innerHTML = "";
    cats.forEach((cat, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cat-pick-btn" + (i === 0 ? " selected" : "");
      btn.dataset.id = cat.id;
      btn.innerHTML  = `<span class="cat-pick-icon">${cat.icon}</span><span class="cat-pick-label">${cat.label}</span>`;
      btn.style.setProperty("--cat-color", cat.color);
      btn.onclick = () => {
        grid.querySelectorAll(".cat-pick-btn").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        const inp = UI.el(hiddenId);
        if (inp) inp.value = cat.id;
      };
      grid.appendChild(btn);
    });
    const inp = UI.el(hiddenId);
    if (inp) inp.value = cats[0].id;
  }

  function initAddForm() {
    buildCategoryGrid("cat-grid-form",     UI.CATEGORIES,        "form-selected-cat");
    buildCategoryGrid("inc-cat-grid-form", UI.INCOME_CATEGORIES, "form-selected-inc-cat");

    document.querySelectorAll(".type-btn").forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll(".type-btn").forEach(b => b.classList.remove("a-plan","a-real","a-inc"));
        const t = btn.dataset.subtype;
        btn.classList.add(t === "planned" ? "a-plan" : t === "income" ? "a-inc" : "a-real");
        UI.el("form-expense-rows").classList.toggle("hidden", t === "income");
        UI.el("form-income-rows").classList.toggle("hidden",  t !== "income");
      };
    });

    UI.el("add-btn").onclick              = submitForm;
    UI.el("form-amount").onkeydown        = e => { if (e.key === "Enter") submitForm(); };
    UI.el("form-desc")?.addEventListener("keydown", e => { if (e.key === "Enter") submitForm(); });
  }

  function getActiveSubtype() {
    const b = document.querySelector(".type-btn.a-plan,.type-btn.a-real,.type-btn.a-inc");
    return b ? b.dataset.subtype : "actual";
  }

  async function submitForm() {
    const subtype = getActiveSubtype();
    const amount  = parseFloat(UI.el("form-amount").value);
    if (isNaN(amount) || amount <= 0) { UI.toast("Enter a valid amount!", "err"); return; }
    UI.loading(true);
    try {
      if (subtype === "income") {
        const source = UI.el("form-selected-inc-cat").value;
        await DB.addIncome(pk(), source, amount);
        UI.toast("Income added ✓");
      } else {
        const desc = UI.el("form-desc").value.trim();
        const cat  = UI.el("form-selected-cat").value;
        if (!desc) { UI.toast("Enter a description!", "err"); return; }
        await DB.addTransaction(pk(), subtype, cat, desc, amount);
        UI.toast(subtype === "planned" ? "Added to plan ✓" : "Expense added ✓");
      }
      UI.el("form-amount").value = "";
      if (UI.el("form-desc")) UI.el("form-desc").value = "";
      bust(); renderMain();
    } finally { UI.loading(false); }
  }

  // ── Savings ────────────────────────────────────────────────

  async function renderSavings() {
    UI.loading(true);
    try {
      const [goals, deposits] = await Promise.all([DB.getSavingsGoals(), DB.getAllDeposits()]);
      const c = UI.el("savings-list");
      c.innerHTML = "";
      if (!goals.length) { c.innerHTML = `<div class="tx-empty">No savings goals yet. Add one above!</div>`; return; }

      for (const g of goals) {
        const gDeps = deposits.filter(d => d.goal_id === g.id);
        const saved = gDeps.reduce((s,d) => s + +d.amount, 0);
        const pct   = Math.min((saved / g.target) * 100, 100);
        const done  = saved >= g.target;

        const card = document.createElement("div");
        card.className = "saving-card card";
        card.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="font-size:28px">${g.icon}</div>
              <div>
                <div style="font-weight:700;font-size:15px">${g.name}</div>
                <div class="dim" style="font-size:12px">Goal: ${UI.formatPLN(g.target)}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              ${done ? `<span class="badge bg">✓ Reached!</span>` : ""}
              <button class="btn-del goal-del">✕</button>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span class="mono green" style="font-size:18px;font-weight:600">${UI.formatPLN(saved)}</span>
            <span class="dim" style="font-size:13px">${Math.round(pct)}% of ${UI.formatPLN(g.target)}</span>
          </div>
          <div class="track"><div class="fill" style="width:${pct}%;background:${g.color||"#6C63FF"}"></div></div>
          <div class="inline-form">
            <input type="number" min="0" step="0.01" placeholder="Deposit amount (PLN)" id="dep-${g.id}" inputmode="decimal"/>
            <input type="text" placeholder="Note (optional)" id="dep-note-${g.id}"/>
            <button class="btn-p dep-btn">+ Deposit</button>
          </div>
          ${gDeps.length ? `
          <div style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px">
            <div class="dim" style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Deposit history</div>
            ${gDeps.map(d=>`
              <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
                <div>
                  <span class="mono green">+${UI.formatPLN(d.amount)}</span>
                  ${d.note?`<span class="dim" style="font-size:12px;margin-left:8px">${d.note}</span>`:""}
                </div>
                <div style="display:flex;align-items:center;gap:8px">
                  <span class="muted" style="font-size:11px">${d.created_at?.slice(0,10)||""}</span>
                  <button class="btn-del dep-del" data-id="${d.id}">✕</button>
                </div>
              </div>`).join("")}
          </div>` : ""}`;

        card.querySelector(".goal-del").onclick = async () => {
          if (!confirm(`Delete goal "${g.name}" and all deposits?`)) return;
          UI.loading(true); await DB.deleteSavingsGoal(g.id); UI.loading(false);
          renderSavings(); UI.toast("Goal deleted", "err");
        };
        card.querySelector(".dep-btn").onclick = async () => {
          const amt  = parseFloat(document.getElementById(`dep-${g.id}`)?.value);
          const note = document.getElementById(`dep-note-${g.id}`)?.value || "";
          if (isNaN(amt)||amt<=0) { UI.toast("Enter a valid amount!", "err"); return; }
          UI.loading(true); await DB.addDeposit(g.id, amt, note); UI.loading(false);
          renderSavings(); UI.toast("Deposit added ✓");
        };
        card.querySelectorAll(".dep-del").forEach(btn => {
          btn.onclick = async () => {
            if (!confirm("Delete this deposit?")) return;
            UI.loading(true); await DB.deleteDeposit(btn.dataset.id); UI.loading(false);
            renderSavings(); UI.toast("Deleted","err");
          };
        });
        c.appendChild(card);
      }
    } finally { UI.loading(false); }
  }

  function initSavings() {
    UI.el("add-goal-btn").onclick = async () => {
      const name   = UI.el("goal-name").value.trim();
      const target = parseFloat(UI.el("goal-target").value);
      const icon   = UI.el("goal-icon").value.trim() || "🎯";
      const color  = UI.el("goal-color").value || "#6C63FF";
      if (!name || isNaN(target) || target <= 0) { UI.toast("Enter name and target amount!", "err"); return; }
      UI.loading(true); await DB.addSavingsGoal(name, target, icon, color); UI.loading(false);
      UI.el("goal-name").value = ""; UI.el("goal-target").value = ""; UI.el("goal-icon").value = "";
      renderSavings(); UI.toast("Goal added ✓");
    };
  }

  // ── Longterm expenses ──────────────────────────────────────

  async function renderLongterm() {
    UI.loading(true);
    try {
      const [expenses, payments] = await Promise.all([DB.getLongtermExpenses(), DB.getAllLongtermPayments()]);
      const c = UI.el("longterm-list");
      c.innerHTML = "";
      if (!expenses.length) { c.innerHTML = `<div class="tx-empty">No long-term expenses yet. Add one above!</div>`; return; }

      for (const exp of expenses) {
        const exPays = payments.filter(p => p.expense_id === exp.id);
        const paid   = exPays.reduce((s,p) => s + +p.amount, 0);
        const rem    = Math.max(0, exp.total_budget - paid);
        const pct    = Math.min((paid / exp.total_budget) * 100, 100);
        const done   = paid >= exp.total_budget;

        const card = document.createElement("div");
        card.className = "saving-card card";
        card.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="font-size:28px">${exp.icon}</div>
              <div>
                <div style="font-weight:700;font-size:15px">${exp.name}</div>
                <div class="dim" style="font-size:12px">Total budget: ${UI.formatPLN(exp.total_budget)}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              ${done ? `<span class="badge bg">✓ Complete!</span>` : `<span class="dim" style="font-size:12px">remaining: <span class="mono red">${UI.formatPLN(rem)}</span></span>`}
              <button class="btn-del lt-del">✕</button>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span class="mono" style="color:${exp.color||"#F5C542"};font-size:18px;font-weight:600">${UI.formatPLN(paid)}</span>
            <span class="dim" style="font-size:13px">${Math.round(pct)}% of ${UI.formatPLN(exp.total_budget)}</span>
          </div>
          <div class="track"><div class="fill" style="width:${pct}%;background:${exp.color||"#F5C542"}"></div></div>
          <div class="inline-form">
            <input type="number" min="0" step="0.01" placeholder="Amount spent (PLN)" id="pay-${exp.id}" inputmode="decimal"/>
            <input type="text" placeholder="Note" id="pay-note-${exp.id}"/>
            <button class="btn-p pay-btn">+ Add</button>
          </div>
          ${exPays.length ? `
          <div style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px">
            <div class="dim" style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Payment history</div>
            ${exPays.map(p=>`
              <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
                <div>
                  <span class="mono red">−${UI.formatPLN(p.amount)}</span>
                  ${p.note?`<span class="dim" style="font-size:12px;margin-left:8px">${p.note}</span>`:""}
                  <span class="muted" style="font-size:11px;margin-left:6px">(${p.period_key.replace("p_","").replace("_",".")})</span>
                </div>
                <button class="btn-del pay-del" data-id="${p.id}">✕</button>
              </div>`).join("")}
          </div>` : ""}`;

        card.querySelector(".lt-del").onclick = async () => {
          if (!confirm(`Delete "${exp.name}"?`)) return;
          UI.loading(true); await DB.deleteLongtermExpense(exp.id); UI.loading(false);
          renderLongterm(); UI.toast("Deleted","err");
        };
        card.querySelector(".pay-btn").onclick = async () => {
          const amt  = parseFloat(document.getElementById(`pay-${exp.id}`)?.value);
          const note = document.getElementById(`pay-note-${exp.id}`)?.value || "";
          if (isNaN(amt)||amt<=0) { UI.toast("Enter a valid amount!", "err"); return; }
          UI.loading(true); await DB.addLongtermPayment(exp.id, pk(), amt, note); UI.loading(false);
          renderLongterm(); UI.toast("Payment added ✓");
        };
        card.querySelectorAll(".pay-del").forEach(btn => {
          btn.onclick = async () => {
            if (!confirm("Delete this payment?")) return;
            UI.loading(true); await DB.deleteLongtermPayment(btn.dataset.id); UI.loading(false);
            renderLongterm(); UI.toast("Deleted","err");
          };
        });
        c.appendChild(card);
      }
    } finally { UI.loading(false); }
  }

  function initLongterm() {
    UI.el("add-longterm-btn").onclick = async () => {
      const name   = UI.el("lt-name").value.trim();
      const budget = parseFloat(UI.el("lt-budget").value);
      const icon   = UI.el("lt-icon").value.trim() || "📦";
      const color  = UI.el("lt-color").value || "#F5C542";
      if (!name || isNaN(budget) || budget <= 0) { UI.toast("Enter name and budget!", "err"); return; }
      UI.loading(true); await DB.addLongtermExpense(name, budget, icon, color); UI.loading(false);
      UI.el("lt-name").value = ""; UI.el("lt-budget").value = ""; UI.el("lt-icon").value = "";
      renderLongterm(); UI.toast("Added ✓");
    };
  }

  // ── History ────────────────────────────────────────────────

  async function renderHistory() {
    UI.loading(true);
    try {
      const [allTxs, allInc] = await Promise.all([DB.getAllTransactions(), DB.getAllIncomes()]);
      const keys = [...new Set([...allTxs.map(t=>t.period_key),...allInc.map(i=>i.period_key)])].sort((a,b)=>b.localeCompare(a));
      const c = UI.el("history-list");
      c.innerHTML = "";

      if (!keys.length) { c.innerHTML = `<div class="tx-empty">No historical data yet.</div>`; return; }

      let totalIncome = allInc.reduce((s,i)=>s+ +i.amount,0);
      let totalActual = allTxs.filter(t=>t.subtype==="actual").reduce((s,t)=>s+ +t.amount,0);
      const glob = totalIncome - totalActual;
      const ge = UI.el("global-balance-val");
      if (ge) { ge.textContent = UI.formatPLN(glob); ge.className = `sum-val mono ${glob>=0?"green":"red"}`; }

      for (const key of keys) {
        const txs     = allTxs.filter(t=>t.period_key===key);
        const incs    = allInc.filter(i=>i.period_key===key);
        const planned = txs.filter(t=>t.subtype==="planned").reduce((s,t)=>s+ +t.amount,0);
        const actual  = txs.filter(t=>t.subtype==="actual").reduce((s,t)=>s+ +t.amount,0);
        const income  = incs.reduce((s,i)=>s+ +i.amount,0);
        const saved   = income - actual;
        const pos     = saved >= 0;
        const [y,m]   = key.replace("p_","").split("_");
        const mIdx    = parseInt(m)-1;
        const label   = `10 ${UI.MONTHS[mIdx]} – 9 ${UI.MONTHS[(mIdx+1)%12]} ${y}`;
        const diff    = planned - actual;

        c.insertAdjacentHTML("beforeend",`
          <div class="card p-20" style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
              <div style="font-family:var(--display);font-weight:700;font-size:15px">${label}</div>
              <span class="badge ${pos?"bg":"br"}">${pos?"✓ positive":"✗ negative"}</span>
            </div>
            <div class="hist-grid">
              <div><div class="muted" style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Income</div><div class="mono green" style="font-size:14px;font-weight:600">${UI.formatPLN(income)}</div></div>
              <div><div class="muted" style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Planned</div><div class="mono" style="font-size:14px;font-weight:600;color:#a89ef8">${UI.formatPLN(planned)}</div></div>
              <div><div class="muted" style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Spent</div><div class="mono red" style="font-size:14px;font-weight:600">${UI.formatPLN(actual)}</div></div>
              <div><div class="muted" style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Savings</div><div class="mono ${pos?"green":"red"}" style="font-size:14px;font-weight:600">${UI.formatPLN(saved)}</div></div>
            </div>
            ${planned>0?`<div style="margin-top:10px">
              <div class="dim" style="font-size:11px;margin-bottom:4px">Plan vs actual: <span class="mono ${diff>=0?"green":"red"}">${diff>=0?"saved":"over"} ${UI.formatPLN(Math.abs(diff))}</span></div>
              <div class="track"><div class="fill" style="width:${Math.min((actual/planned)*100,100)}%;background:${actual>planned?"var(--red)":"var(--accent)"}"></div></div>
            </div>`:""}
          </div>`);
      }
    } finally { UI.loading(false); }
  }

  // ── PIN modal ──────────────────────────────────────────────

  function initChangePinModal() {
    UI.el("cpw-cancel").onclick = () => UI.el("change-pw-modal").classList.add("hidden");
    UI.el("cpw-submit").onclick = async () => {
      const oldPin = UI.el("cpw-old").value;
      const newPin = UI.el("cpw-new").value;
      const newPin2= UI.el("cpw-new2").value;
      const errEl  = UI.el("cpw-error");
      errEl.textContent = "";
      if (newPin !== newPin2) { errEl.textContent = "New PINs do not match."; errEl.classList.remove("hidden"); return; }
      UI.loading(true);
      const result = await DB.changePin(oldPin, newPin);
      UI.loading(false);
      if (!result.ok) { errEl.textContent = result.msg; errEl.classList.remove("hidden"); return; }
      UI.el("change-pw-modal").classList.add("hidden");
      UI.toast("PIN changed ✓");
    };
  }

  // ── Main render ────────────────────────────────────────────

  async function renderMain() {
    ["view-dashboard","view-transactions","view-savings","view-longterm","view-history"]
      .forEach(id => UI.el(id)?.classList.add("hidden"));
    UI.el(`view-${state.view}`)?.classList.remove("hidden");

    if (state.view === "dashboard")    await renderDashboard();
    if (state.view === "transactions") { renderPeriodBar(); setTxTab(state.txTab); }
    if (state.view === "savings")      await renderSavings();
    if (state.view === "longterm")     await renderLongterm();
    if (state.view === "history")      await renderHistory();
  }

  // ── Init ───────────────────────────────────────────────────

  function openChangePw() {
    ["cpw-old","cpw-new","cpw-new2"].forEach(id => { UI.el(id).value = ""; });
    UI.el("cpw-error").textContent = "";
    UI.el("cpw-error").classList.add("hidden");
    UI.el("change-pw-modal").classList.remove("hidden");
  }

  function init() {
    // Desktop nav
    document.querySelectorAll(".nav-btn").forEach(btn =>
      btn.addEventListener("click", () => setView(btn.dataset.view)));

    // Bottom nav (mobile)
    document.querySelectorAll(".bnav-btn").forEach(btn =>
      btn.addEventListener("click", () => setView(btn.dataset.view)));

    UI.el("prev-period").onclick = prevPeriod;
    UI.el("next-period").onclick = nextPeriod;

    // Logout — both desktop and mobile buttons
    const doLogout = () => { DB.clearSession(); location.reload(); };
    UI.el("logout-btn").onclick        = doLogout;
    UI.el("logout-btn-mobile").onclick = doLogout;

    // PIN change — both
    UI.el("change-pw-btn").onclick        = openChangePw;
    UI.el("change-pw-btn-mobile").onclick = openChangePw;

    // Tx filter
    const f = UI.el("tx-filter");
    if (f) {
      f.innerHTML = `<option value="all">All categories</option>`;
      UI.CATEGORIES.forEach(c => {
        const o = document.createElement("option");
        o.value = c.id; o.textContent = `${c.icon} ${c.label}`;
        f.appendChild(o);
      });
      f.onchange = e => renderActualList(e.target.value);
    }

    document.querySelectorAll(".tab-btn").forEach(btn =>
      btn.addEventListener("click", () => setTxTab(btn.dataset.tab)));

    initAddForm();
    initChangePinModal();
    initSavings();
    initLongterm();
    setView("dashboard");
  }

  return { init };
})();
