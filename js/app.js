// ============================================================
// BudżetApp — js/app.js
// ============================================================

const App = (() => {

  const base = UI.getCurrentPeriodBase();
  let state = {
    offset: 0,
    view:   "dashboard",
    txTab:  "actual",
    // cache
    cache:  {},
  };

  function period()  { return UI.periodFromBase(base, state.offset); }
  function pk()      { return period().periodKey; }

  // ── cache ──────────────────────────────────────────────────

  function invalidate() { state.cache = {}; }

  async function cachedGet(key, fn) {
    if (state.cache[key] !== undefined) return state.cache[key];
    const val = await fn();
    state.cache[key] = val;
    return val;
  }

  // ── Navigation ─────────────────────────────────────────────

  function setView(v) {
    state.view = v;
    invalidate();
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === v));
    renderMain();
  }

  function prevPeriod() { state.offset--; invalidate(); renderMain(); }
  function nextPeriod() { state.offset++; invalidate(); renderMain(); }

  // ── Period bar ─────────────────────────────────────────────

  function renderPeriodBar(txCount = 0) {
    const p     = period();
    const isNow = state.offset === 0;
    UI.el("period-label").innerHTML = p.label + (isNow ? `<span class="now-dot">• teraz</span>` : "");
    UI.el("period-count").textContent = `${txCount} wydatków`;
  }

  // ── Summary cards ──────────────────────────────────────────

  function renderSummaryCards(data) {
    const { plannedTotal, actualTotal, income, balance } = data;
    const pos = balance >= 0;
    UI.el("sum-income-val").textContent  = UI.formatPLN(income);
    UI.el("sum-planned-val").textContent = UI.formatPLN(plannedTotal);
    UI.el("sum-actual-val").textContent  = UI.formatPLN(actualTotal);
    UI.el("sum-balance-val").textContent = UI.formatPLN(Math.abs(balance));
    UI.el("sum-balance-val").className   = `sum-val mono ${pos ? "green" : "red"}`;
    UI.el("sum-balance-card").className  = `sum-card ${pos ? "gc" : "rc"}`;
  }

  // ── Shared summary builder ─────────────────────────────────

  async function buildSummary(periodKey) {
    const key = "summary_" + periodKey;
    return cachedGet(key, async () => {
      const [txs, incomes] = await Promise.all([
        DB.getTransactions(periodKey),
        DB.getIncomes(periodKey),
      ]);
      const planned     = txs.filter(t => t.subtype === "planned");
      const actual      = txs.filter(t => t.subtype === "actual");
      const plannedTotal= planned.reduce((s, t) => s + +t.amount, 0);
      const actualTotal = actual.reduce((s, t) => s + +t.amount, 0);
      const income      = incomes.reduce((s, i) => s + +i.amount, 0);
      return { txs, planned, actual, incomes, plannedTotal, actualTotal, income, balance: income - actualTotal };
    });
  }

  // ── Dashboard ──────────────────────────────────────────────

  async function renderDashboard() {
    UI.loading(true);
    try {
      const data = await buildSummary(pk());
      renderPeriodBar(data.actual.length);
      renderSummaryCards(data);

      const catGrid = UI.el("cat-grid");
      catGrid.innerHTML = "";

      const active = UI.CATEGORIES.filter(cat => {
        const p = data.planned.filter(t => t.category === cat.id).reduce((s,t)=>s+ +t.amount,0);
        const a = data.actual.filter(t => t.category === cat.id).reduce((s,t)=>s+ +t.amount,0);
        return p > 0 || a > 0;
      });

      if (active.length === 0) {
        catGrid.innerHTML = `<div class="cat-empty">Brak wpisów w tym okresie.<br>Dodaj wydatki lub zaplanuj poniżej!</div>`;
        return;
      }

      for (const cat of active) {
        const p   = data.planned.filter(t => t.category === cat.id).reduce((s,t)=>s+ +t.amount,0);
        const a   = data.actual.filter(t => t.category === cat.id).reduce((s,t)=>s+ +t.amount,0);
        const pct = p > 0 ? Math.min((a/p)*100, 100) : 0;
        const over= p > 0 && a > p;
        catGrid.insertAdjacentHTML("beforeend", `
          <div class="cat-item">
            <div class="cat-hdr">
              <div class="cat-name"><span>${cat.icon}</span><span>${cat.label}</span></div>
              ${over ? `<span class="badge br">przekroczono</span>` : ""}
            </div>
            ${p > 0 ? `<div class="cat-plan-row">plan: <span class="mono">${UI.formatPLN(p)}</span></div>` : ""}
            <div class="cat-spent mono" style="color:${cat.color}">wydano: ${UI.formatPLN(a)}</div>
            ${p > 0 ? `<div class="track"><div class="fill" style="width:${pct}%;background:${over?"var(--red)":cat.color}"></div></div>` : ""}
          </div>`);
      }
    } finally { UI.loading(false); }
  }

  // ── Transactions ───────────────────────────────────────────

  function setTxTab(tab) {
    state.txTab = tab;
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    ["tx-actual-sec","tx-planned-sec","tx-income-sec"].forEach(id => UI.hide(id));
    UI.show(`tx-${tab}-sec`);
    const frow = UI.el("tx-filter-row");
    if (frow) frow.style.display = tab === "actual" ? "" : "none";
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
      if (list.length === 0) { el.innerHTML = `<div class="tx-empty">Brak rzeczywistych wydatków${filterCat !== "all" ? " w tej kategorii" : ""}.</div>`; return; }
      for (const t of list) {
        const cat = UI.getCategory(t.category);
        el.appendChild(makeTxRow(t, cat, "red", "−", () => { invalidate(); renderActualList(UI.el("tx-filter")?.value||"all"); }, true));
      }
    } finally { UI.loading(false); }
  }

  async function renderPlannedList() {
    UI.loading(true);
    try {
      const data = await buildSummary(pk());
      const el = UI.el("tx-planned-list");
      el.innerHTML = "";
      if (data.planned.length === 0) { el.innerHTML = `<div class="tx-empty">Brak zaplanowanych wydatków w tym okresie.</div>`; return; }
      for (const t of data.planned) {
        const cat = UI.getCategory(t.category);
        el.appendChild(makeTxRow(t, cat, "#a89ef8", "−", () => { invalidate(); renderPlannedList(); }, true, true));
      }
    } finally { UI.loading(false); }
  }

  async function renderIncomeList() {
    UI.loading(true);
    try {
      const data = await buildSummary(pk());
      const el = UI.el("tx-income-list");
      el.innerHTML = "";
      if (data.incomes.length === 0) { el.innerHTML = `<div class="tx-empty">Brak przychodów w tym okresie.</div>`; return; }
      for (const e of data.incomes) {
        const cat = UI.INCOME_CATEGORIES.find(c => c.id === e.source) || UI.INCOME_CATEGORIES[3];
        const row = document.createElement("div");
        row.className = "tx-row";
        row.innerHTML = `
          <div class="tx-icon" style="background:${cat.color}22">${cat.icon}</div>
          <div class="tx-info">
            <div class="tx-desc">${cat.label}</div>
            <div class="tx-meta">Przychód · ${e.created_at?.slice(0,10)||""}</div>
          </div>
          <div class="tx-amt green">+${UI.formatPLN(e.amount)}</div>
          <button class="btn-del" data-id="${e.id}">✕</button>`;
        row.querySelector(".btn-del").onclick = async () => {
          if (!confirm("Usunąć ten przychód?")) return;
          UI.loading(true);
          await DB.deleteIncome(e.id);
          UI.loading(false);
          invalidate();
          renderIncomeList();
          UI.toast("Usunięto", "err");
        };
        UI.el("tx-income-list").appendChild(row);
      }
    } finally { UI.loading(false); }
  }

  function makeTxRow(t, cat, amtColor, sign, onDelete, canEdit = false, isPlanned = false) {
    const row = document.createElement("div");
    row.className = "tx-row";
    row.innerHTML = `
      <div class="tx-icon" style="background:${cat.color}22">${cat.icon}</div>
      <div class="tx-info">
        <div class="tx-desc" id="desc-${t.id}">${t.description}</div>
        <div class="tx-meta">${cat.label}${isPlanned ? ` · <span class="badge bp">plan</span>` : ""}</div>
      </div>
      <div class="tx-amt mono" style="color:${amtColor}">${sign}${UI.formatPLN(t.amount)}</div>
      <div class="tx-actions" style="display:flex;gap:4px;align-items:center">
        ${canEdit ? `<button class="btn-edit" data-id="${t.id}" title="Edytuj">✏️</button>` : ""}
        <button class="btn-del" data-id="${t.id}">✕</button>
      </div>`;

    row.querySelector(".btn-del").onclick = async () => {
      if (!confirm("Usunąć?")) return;
      UI.loading(true);
      await DB.deleteTransaction(t.id);
      UI.loading(false);
      invalidate();
      onDelete();
      UI.toast("Usunięto", "err");
    };

    if (canEdit) {
      row.querySelector(".btn-edit").onclick = () => openEditModal(t, onDelete);
    }

    return row;
  }

  function openEditModal(t, onSave) {
    const modal = UI.el("edit-modal");
    const cat   = UI.getCategory(t.category);

    UI.el("edit-desc").value   = t.description;
    UI.el("edit-amount").value = t.amount;

    // Build category select
    const sel = UI.el("edit-category");
    sel.innerHTML = "";
    UI.CATEGORIES.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id; opt.textContent = `${c.icon} ${c.label}`;
      if (c.id === t.category) opt.selected = true;
      sel.appendChild(opt);
    });

    modal.classList.remove("hidden");

    UI.el("edit-cancel").onclick = () => modal.classList.add("hidden");
    UI.el("edit-save").onclick = async () => {
      const desc   = UI.el("edit-desc").value.trim();
      const amount = parseFloat(UI.el("edit-amount").value);
      const catId  = UI.el("edit-category").value;
      if (!desc || isNaN(amount) || amount <= 0) { UI.toast("Wypełnij poprawnie!", "err"); return; }
      UI.loading(true);
      await DB.updateTransaction(t.id, { description: desc, amount, category: catId });
      UI.loading(false);
      modal.classList.add("hidden");
      invalidate();
      onSave();
      UI.toast("Zapisano ✓");
    };
  }

  // ── Add form ───────────────────────────────────────────────

  function initAddForm() {
    // Category grid for expenses
    buildCategoryGrid("cat-grid-form", UI.CATEGORIES, "form-selected-cat");
    buildCategoryGrid("inc-cat-grid-form", UI.INCOME_CATEGORIES, "form-selected-inc-cat");

    // Type toggle
    document.querySelectorAll(".type-btn").forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll(".type-btn").forEach(b => b.classList.remove("a-plan","a-real","a-inc"));
        const t = btn.dataset.subtype;
        btn.classList.add(t === "planned" ? "a-plan" : t === "income" ? "a-inc" : "a-real");
        UI.el("form-expense-rows").classList.toggle("hidden", t === "income");
        UI.el("form-income-rows").classList.toggle("hidden",   t !== "income");
      };
    });

    UI.el("add-btn").onclick = submitForm;
    UI.el("form-amount").onkeydown = e => { if (e.key === "Enter") submitForm(); };
    UI.el("form-desc").onkeydown   = e => { if (e.key === "Enter") submitForm(); };
  }

  function buildCategoryGrid(gridId, cats, hiddenInputId) {
    const grid = UI.el(gridId);
    if (!grid) return;
    grid.innerHTML = "";
    cats.forEach((cat, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cat-pick-btn" + (i === 0 ? " selected" : "");
      btn.dataset.id = cat.id;
      btn.innerHTML = `<span class="cat-pick-icon">${cat.icon}</span><span class="cat-pick-label">${cat.label}</span>`;
      btn.style.setProperty("--cat-color", cat.color);
      btn.onclick = () => {
        grid.querySelectorAll(".cat-pick-btn").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        const inp = UI.el(hiddenInputId);
        if (inp) inp.value = cat.id;
      };
      grid.appendChild(btn);
    });
    // set initial hidden value
    const inp = UI.el(hiddenInputId);
    if (inp) inp.value = cats[0].id;
  }

  function getActiveSubtype() {
    const btn = document.querySelector(".type-btn.a-plan,.type-btn.a-real,.type-btn.a-inc");
    return btn ? btn.dataset.subtype : "actual";
  }

  async function submitForm() {
    const subtype = getActiveSubtype();
    const amount  = parseFloat(UI.el("form-amount").value);
    if (isNaN(amount) || amount <= 0) { UI.toast("Podaj prawidłową kwotę!", "err"); return; }

    UI.loading(true);
    try {
      if (subtype === "income") {
        const source = UI.el("form-selected-inc-cat").value;
        await DB.addIncome(pk(), source, amount);
        UI.toast("Dodano przychód ✓");
      } else {
        const desc = UI.el("form-desc").value.trim();
        const cat  = UI.el("form-selected-cat").value;
        if (!desc) { UI.toast("Wpisz opis!", "err"); return; }
        await DB.addTransaction(pk(), subtype, cat, desc, amount);
        UI.toast(subtype === "planned" ? "Dodano do planu ✓" : "Dodano wydatek ✓");
      }
      UI.el("form-amount").value = "";
      UI.el("form-desc").value   = "";
      invalidate();
      renderMain();
    } finally { UI.loading(false); }
  }

  // ── Savings ────────────────────────────────────────────────

  async function renderSavings() {
    UI.loading(true);
    try {
      const [goals, deposits] = await Promise.all([DB.getSavingsGoals(), DB.getAllDeposits()]);
      const container = UI.el("savings-list");
      container.innerHTML = "";

      if (goals.length === 0) {
        container.innerHTML = `<div class="tx-empty">Brak celów oszczędnościowych. Dodaj pierwszy!</div>`;
        return;
      }

      for (const g of goals) {
        const gDeposits = deposits.filter(d => d.goal_id === g.id);
        const saved     = gDeposits.reduce((s, d) => s + +d.amount, 0);
        const pct       = Math.min((saved / g.target) * 100, 100);
        const done      = saved >= g.target;

        const card = document.createElement("div");
        card.className = "saving-card card";
        card.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="font-size:28px">${g.icon}</div>
              <div>
                <div style="font-weight:700;font-size:15px">${g.name}</div>
                <div class="dim" style="font-size:12px">Cel: ${UI.formatPLN(g.target)}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              ${done ? `<span class="badge bg">✓ Osiągnięto!</span>` : ""}
              <button class="btn-del" data-id="${g.id}">✕</button>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span class="mono green" style="font-size:18px;font-weight:600">${UI.formatPLN(saved)}</span>
            <span class="dim" style="font-size:13px">${Math.round(pct)}% z ${UI.formatPLN(g.target)}</span>
          </div>
          <div class="track"><div class="fill" style="width:${pct}%;background:${g.color || "#6C63FF"}"></div></div>
          <div class="saving-deposit-form" style="margin-top:14px;display:flex;gap:8px">
            <input type="number" min="0" step="0.01" placeholder="Wpłać (zł)" id="dep-${g.id}" style="font-size:14px" />
            <input type="text" placeholder="Notatka (opcja)" id="dep-note-${g.id}" style="font-size:14px" />
            <button class="btn-p dep-btn" data-id="${g.id}" style="padding:8px 16px;font-size:13px;white-space:nowrap">+ Wpłać</button>
          </div>
          ${gDeposits.length > 0 ? `
          <div style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px">
            <div class="dim" style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Historia wpłat</div>
            <div id="dep-history-${g.id}">
              ${gDeposits.map(d => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
                  <div>
                    <span class="mono green">+${UI.formatPLN(d.amount)}</span>
                    ${d.note ? `<span class="dim" style="font-size:12px;margin-left:8px">${d.note}</span>` : ""}
                  </div>
                  <div style="display:flex;align-items:center;gap:8px">
                    <span class="muted" style="font-size:11px">${d.created_at?.slice(0,10)||""}</span>
                    <button class="btn-del dep-del" data-id="${d.id}" style="font-size:13px">✕</button>
                  </div>
                </div>`).join("")}
            </div>
          </div>` : ""}`;

        card.querySelector(".btn-del[data-id='"+g.id+"']").onclick = async () => {
          if (!confirm(`Usunąć cel "${g.name}" wraz z wszystkimi wpłatami?`)) return;
          UI.loading(true);
          await DB.deleteSavingsGoal(g.id);
          UI.loading(false);
          renderSavings();
          UI.toast("Usunięto cel", "err");
        };

        card.querySelector(".dep-btn").onclick = async () => {
          const amt  = parseFloat(document.getElementById(`dep-${g.id}`)?.value);
          const note = document.getElementById(`dep-note-${g.id}`)?.value || "";
          if (isNaN(amt) || amt <= 0) { UI.toast("Podaj kwotę!", "err"); return; }
          UI.loading(true);
          await DB.addDeposit(g.id, amt, note);
          UI.loading(false);
          renderSavings();
          UI.toast("Wpłacono ✓");
        };

        card.querySelectorAll(".dep-del").forEach(btn => {
          btn.onclick = async () => {
            if (!confirm("Usunąć wpłatę?")) return;
            UI.loading(true);
            await DB.deleteDeposit(btn.dataset.id);
            UI.loading(false);
            renderSavings();
            UI.toast("Usunięto", "err");
          };
        });

        container.appendChild(card);
      }
    } finally { UI.loading(false); }
  }

  function initAddSavingsGoal() {
    UI.el("add-goal-btn").onclick = async () => {
      const name   = UI.el("goal-name").value.trim();
      const target = parseFloat(UI.el("goal-target").value);
      const icon   = UI.el("goal-icon").value.trim() || "🎯";
      const color  = UI.el("goal-color").value || "#6C63FF";
      if (!name || isNaN(target) || target <= 0) { UI.toast("Wypełnij nazwę i cel!", "err"); return; }
      UI.loading(true);
      await DB.addSavingsGoal(name, target, icon, color);
      UI.loading(false);
      UI.el("goal-name").value   = "";
      UI.el("goal-target").value = "";
      UI.el("goal-icon").value   = "";
      renderSavings();
      UI.toast("Dodano cel ✓");
    };
  }

  // ── Longterm expenses ──────────────────────────────────────

  async function renderLongterm() {
    UI.loading(true);
    try {
      const [expenses, payments] = await Promise.all([DB.getLongtermExpenses(), DB.getAllLongtermPayments()]);
      const container = UI.el("longterm-list");
      container.innerHTML = "";

      if (expenses.length === 0) {
        container.innerHTML = `<div class="tx-empty">Brak długoterminowych wydatków. Dodaj pierwszy!</div>`;
        return;
      }

      for (const exp of expenses) {
        const exPays = payments.filter(p => p.expense_id === exp.id);
        const paid   = exPays.reduce((s, p) => s + +p.amount, 0);
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
                <div class="dim" style="font-size:12px">Budżet: ${UI.formatPLN(exp.total_budget)}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              ${done ? `<span class="badge bg">✓ Ukończono!</span>` : `<span class="dim" style="font-size:12px">pozostało: <span class="mono red">${UI.formatPLN(rem)}</span></span>`}
              <button class="btn-del" data-id="${exp.id}">✕</button>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span class="mono" style="color:${exp.color||"#F5C542"};font-size:18px;font-weight:600">${UI.formatPLN(paid)}</span>
            <span class="dim" style="font-size:13px">${Math.round(pct)}% z ${UI.formatPLN(exp.total_budget)}</span>
          </div>
          <div class="track"><div class="fill" style="width:${pct}%;background:${exp.color||"#F5C542"}"></div></div>
          <div style="margin-top:14px;display:flex;gap:8px">
            <input type="number" min="0" step="0.01" placeholder="Ile wydałeś (zł)" id="pay-${exp.id}" style="font-size:14px"/>
            <input type="text" placeholder="Notatka" id="pay-note-${exp.id}" style="font-size:14px"/>
            <button class="btn-p pay-btn" data-id="${exp.id}" style="padding:8px 16px;font-size:13px;white-space:nowrap">+ Dodaj</button>
          </div>
          ${exPays.length > 0 ? `
          <div style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px">
            <div class="dim" style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Historia płatności</div>
            ${exPays.map(p => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
                <div>
                  <span class="mono red">−${UI.formatPLN(p.amount)}</span>
                  ${p.note ? `<span class="dim" style="font-size:12px;margin-left:8px">${p.note}</span>` : ""}
                  <span class="dim" style="font-size:11px;margin-left:6px">(${p.period_key.replace("p_","").replace("_",".")})</span>
                </div>
                <button class="btn-del pay-del" data-id="${p.id}" style="font-size:13px">✕</button>
              </div>`).join("")}
          </div>` : ""}`;

        card.querySelector(".btn-del[data-id='"+exp.id+"']").onclick = async () => {
          if (!confirm(`Usunąć "${exp.name}"?`)) return;
          UI.loading(true);
          await DB.deleteLongtermExpense(exp.id);
          UI.loading(false);
          renderLongterm();
          UI.toast("Usunięto", "err");
        };

        card.querySelector(".pay-btn").onclick = async () => {
          const amt  = parseFloat(document.getElementById(`pay-${exp.id}`)?.value);
          const note = document.getElementById(`pay-note-${exp.id}`)?.value || "";
          if (isNaN(amt) || amt <= 0) { UI.toast("Podaj kwotę!", "err"); return; }
          UI.loading(true);
          await DB.addLongtermPayment(exp.id, pk(), amt, note);
          UI.loading(false);
          renderLongterm();
          UI.toast("Dodano płatność ✓");
        };

        card.querySelectorAll(".pay-del").forEach(btn => {
          btn.onclick = async () => {
            if (!confirm("Usunąć płatność?")) return;
            UI.loading(true);
            await DB.deleteLongtermPayment(btn.dataset.id);
            UI.loading(false);
            renderLongterm();
            UI.toast("Usunięto", "err");
          };
        });

        container.appendChild(card);
      }
    } finally { UI.loading(false); }
  }

  function initAddLongterm() {
    UI.el("add-longterm-btn").onclick = async () => {
      const name   = UI.el("lt-name").value.trim();
      const budget = parseFloat(UI.el("lt-budget").value);
      const icon   = UI.el("lt-icon").value.trim() || "📦";
      const color  = UI.el("lt-color").value || "#F5C542";
      if (!name || isNaN(budget) || budget <= 0) { UI.toast("Wypełnij nazwę i budżet!", "err"); return; }
      UI.loading(true);
      await DB.addLongtermExpense(name, budget, icon, color);
      UI.loading(false);
      UI.el("lt-name").value   = "";
      UI.el("lt-budget").value = "";
      UI.el("lt-icon").value   = "";
      renderLongterm();
      UI.toast("Dodano ✓");
    };
  }

  // ── History / Summary ──────────────────────────────────────

  async function renderHistory() {
    UI.loading(true);
    try {
      const [allTxs, allInc] = await Promise.all([DB.getAllTransactions(), DB.getAllIncomes()]);

      // Collect unique period keys, sorted descending
      const keys = [...new Set([
        ...allTxs.map(t => t.period_key),
        ...allInc.map(i => i.period_key),
      ])].sort((a, b) => b.localeCompare(a));

      const container = UI.el("history-list");
      container.innerHTML = "";

      if (keys.length === 0) {
        container.innerHTML = `<div class="tx-empty">Brak danych historycznych.</div>`;
        return;
      }

      // Running balance across periods (newest first → we'll reverse for calc)
      let runningBalance = 0;
      const periodData = keys.map(key => {
        const txs     = allTxs.filter(t => t.period_key === key);
        const incs    = allInc.filter(i => i.period_key === key);
        const planned = txs.filter(t => t.subtype === "planned").reduce((s,t)=>s+ +t.amount,0);
        const actual  = txs.filter(t => t.subtype === "actual").reduce((s,t)=>s+ +t.amount,0);
        const income  = incs.reduce((s,i)=>s+ +i.amount,0);
        const saved   = income - actual;
        return { key, planned, actual, income, saved };
      });

      // Global balance = sum of all (income - actual)
      const globalBalance = periodData.reduce((s,p) => s + p.saved, 0);
      const glEl = UI.el("global-balance-val");
      if (glEl) {
        glEl.textContent = UI.formatPLN(globalBalance);
        glEl.className   = `sum-val mono ${globalBalance >= 0 ? "green" : "red"}`;
      }

      for (const p of periodData) {
        const keyLabel = p.key.replace("p_","").replace("_",".");
        const [y, m]   = p.key.replace("p_","").split("_");
        const mIdx     = parseInt(m) - 1;
        const mName    = UI.MONTHS[mIdx] || m;
        const label    = `10 ${mName} – 9 ${UI.MONTHS[(mIdx+1)%12]} ${y}`;
        const pos      = p.saved >= 0;
        const diffPos  = p.planned - p.actual;

        container.insertAdjacentHTML("beforeend", `
          <div class="card p-20" style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
              <div style="font-family:var(--font-display);font-weight:700;font-size:15px">${label}</div>
              <span class="badge ${pos?"bg":"br"}">${pos?"✓ na plusie":"✗ na minusie"}</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
              <div>
                <div class="muted" style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Przychód</div>
                <div class="mono green" style="font-size:14px;font-weight:600">${UI.formatPLN(p.income)}</div>
              </div>
              <div>
                <div class="muted" style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Plan</div>
                <div class="mono" style="font-size:14px;font-weight:600;color:#a89ef8">${UI.formatPLN(p.planned)}</div>
              </div>
              <div>
                <div class="muted" style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Wydano</div>
                <div class="mono red" style="font-size:14px;font-weight:600">${UI.formatPLN(p.actual)}</div>
              </div>
              <div>
                <div class="muted" style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Oszczędności</div>
                <div class="mono ${pos?"green":"red"}" style="font-size:14px;font-weight:600">${UI.formatPLN(p.saved)}</div>
              </div>
            </div>
            ${p.planned > 0 ? `
            <div style="margin-top:10px">
              <div class="dim" style="font-size:11px;margin-bottom:4px">Plan vs rzeczywistość: <span class="mono ${diffPos>=0?"green":"red"}">${diffPos>=0?"−":"+"} ${UI.formatPLN(Math.abs(diffPos))}</span></div>
              <div class="track"><div class="fill" style="width:${Math.min((p.actual/p.planned)*100,100)}%;background:${p.actual>p.planned?"var(--red)":"var(--accent)"}"></div></div>
            </div>` : ""}
          </div>`);
      }
    } finally { UI.loading(false); }
  }

  // ── Render dispatcher ──────────────────────────────────────

  async function renderMain() {
    const views = ["view-dashboard","view-transactions","view-savings","view-longterm","view-history"];
    views.forEach(id => UI.el(id)?.classList.add("hidden"));
    UI.el(`view-${state.view}`)?.classList.remove("hidden");

    if (state.view === "dashboard")    await renderDashboard();
    if (state.view === "transactions") { renderPeriodBar(); setTxTab(state.txTab); }
    if (state.view === "savings")      await renderSavings();
    if (state.view === "longterm")     await renderLongterm();
    if (state.view === "history")      await renderHistory();
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
      if (newPin !== newPin2) { errEl.textContent = "Nowe PINy nie są zgodne."; return; }
      UI.loading(true);
      const result = await DB.changePin(oldPin, newPin);
      UI.loading(false);
      if (!result.ok) { errEl.textContent = result.msg; return; }
      UI.el("change-pw-modal").classList.add("hidden");
      UI.toast("PIN zmieniony ✓");
    };
  }

  // ── Init ───────────────────────────────────────────────────

  function init() {
    document.querySelectorAll(".nav-btn").forEach(btn =>
      btn.addEventListener("click", () => setView(btn.dataset.view))
    );
    UI.el("prev-period").onclick   = prevPeriod;
    UI.el("next-period").onclick   = nextPeriod;
    UI.el("logout-btn").onclick    = () => { DB.clearSession(); location.reload(); };
    UI.el("change-pw-btn").onclick = () => {
      UI.el("change-pw-modal").classList.remove("hidden");
      ["cpw-old","cpw-new","cpw-new2"].forEach(id => { UI.el(id).value=""; });
      UI.el("cpw-error").textContent="";
    };

    // tx filter
    const txFilter = UI.el("tx-filter");
    if (txFilter) {
      txFilter.innerHTML = `<option value="all">Wszystkie kategorie</option>`;
      UI.CATEGORIES.forEach(c => {
        const o = document.createElement("option");
        o.value = c.id; o.textContent = `${c.icon} ${c.label}`;
        txFilter.appendChild(o);
      });
      txFilter.onchange = e => renderActualList(e.target.value);
    }

    document.querySelectorAll(".tab-btn").forEach(btn =>
      btn.addEventListener("click", () => setTxTab(btn.dataset.tab))
    );

    initAddForm();
    initChangePinModal();
    initAddSavingsGoal();
    initAddLongterm();
    renderMain();
  }

  return { init };
})();
