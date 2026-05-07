// ============================================================
// BudżetApp — js/app.js  (complete redesign)
// ============================================================

const App = (() => {

  const base = UI.getCurrentPeriodBase();
  let state = {
    offset:   0,
    view:     "dashboard",
    txTab:    "actual",
    txCat:    "all",       // selected category filter in transactions
    finPeriod: null,       // selected period key in finance view
    cache:    {},
  };

  const period = () => UI.periodFromBase(base, state.offset);
  const pk     = () => period().periodKey;
  const bust   = () => { state.cache = {}; };

  async function cached(key, fn) {
    if (state.cache[key] !== undefined) return state.cache[key];
    return (state.cache[key] = await fn());
  }

  // ── Navigation ──────────────────────────────────────────────

  function setView(v) {
    state.view = v; bust();
    document.querySelectorAll(".nav-btn, .bnav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === v));
    const showPeriod = v === "dashboard" || v === "transactions";
    UI.el("period-bar-wrap")?.classList.toggle("hidden", !showPeriod);
    ["view-dashboard","view-transactions","view-savings","view-finance","view-settings","view-categories"]
      .forEach(id => UI.el(id)?.classList.add("hidden"));
    UI.el(`view-${v}`)?.classList.remove("hidden");
    renderView(v);
  }

  function prevPeriod() { state.offset--; bust(); renderView(state.view); }
  function nextPeriod() { state.offset++; bust(); renderView(state.view); }

  async function renderView(v) {
    if (v === "dashboard")    return renderDashboard();
    if (v === "transactions") return renderTransactions();
    if (v === "savings")      return renderSavings();
    if (v === "finance")      return renderFinance();
    if (v === "settings")     return renderSettings();
    if (v === "categories")   return renderCategories();
  }

  // ── Period bar ──────────────────────────────────────────────

  function renderPeriodBar(count) {
    const p = period();
    UI.el("period-label").innerHTML =
      p.label + (state.offset === 0 ? `<span class="now-dot">● now</span>` : "");
    if (UI.el("period-count")) UI.el("period-count").textContent = count !== undefined ? `${count} entries` : "";
  }

  // ── Build summary for a period ──────────────────────────────

  async function buildSummary(periodKey) {
    return cached("sum_" + periodKey, async () => {
      const [txs, incs] = await Promise.all([DB.getTransactions(periodKey), DB.getIncomes(periodKey)]);
      const planned     = txs.filter(t => t.subtype === "planned");
      const actual      = txs.filter(t => t.subtype === "actual");
      const plannedTotal = planned.reduce((s,t) => s + +t.amount, 0);
      const actualTotal  = actual.reduce((s,t)  => s + +t.amount, 0);
      const income       = incs.reduce((s,i)    => s + +i.amount, 0);
      return { txs, planned, actual, incs, plannedTotal, actualTotal, income, balance: income - actualTotal };
    });
  }

  async function getGlobalBalance() {
    return cached("global_bal", async () => {
      const [allTx, allInc] = await Promise.all([DB.getAllTransactions(), DB.getAllIncomes()]);
      const totalInc = allInc.reduce((s,i) => s + +i.amount, 0);
      const totalAct = allTx.filter(t => t.subtype === "actual").reduce((s,t) => s + +t.amount, 0);
      return totalInc - totalAct;
    });
  }

  // ══════════════════════════════════════════════════════════
  // DASHBOARD
  // ══════════════════════════════════════════════════════════

  async function renderDashboard() {
    UI.loading(true);
    try {
      const [data, globalBal] = await Promise.all([buildSummary(pk()), getGlobalBalance()]);
      renderPeriodBar(data.actual.length);

      // Total balance card
      const pos = globalBal >= 0;
      UI.el("total-bal-val").textContent = UI.formatPLN(Math.abs(globalBal));
      UI.el("total-bal-val").className   = `total-balance-val ${pos ? "green" : "red"}`;
      UI.el("total-bal-sign").textContent= pos ? "" : "−";

      // Summary cards
      UI.el("sum-income-val").textContent  = UI.formatPLN(data.income);
      UI.el("sum-planned-val").textContent = UI.formatPLN(data.plannedTotal);
      UI.el("sum-actual-val").textContent  = UI.formatPLN(data.actualTotal);
      UI.el("sum-balance-val").textContent = UI.formatPLN(Math.abs(data.balance));
      UI.el("sum-balance-val").className   = `sum-val mono ${data.balance >= 0 ? "green" : "red"}`;
      UI.el("sum-balance-card").className  = `sum-card ${data.balance >= 0 ? "gc" : "rc"}`;

      // Category breakdown
      const grid = UI.el("cat-grid");
      grid.innerHTML = "";
      const active = UI.CATEGORIES.filter(cat => {
        const p = data.planned.filter(t => t.category === cat.id).reduce((s,t)=>s+ +t.amount,0);
        const a = data.actual.filter(t  => t.category === cat.id).reduce((s,t)=>s+ +t.amount,0);
        return p > 0 || a > 0;
      });
      if (!active.length) {
        grid.innerHTML = `<div class="cat-empty">No entries this period.<br>Add expenses below!</div>`;
      } else {
        for (const cat of active) {
          const p   = data.planned.filter(t => t.category === cat.id).reduce((s,t)=>s+ +t.amount,0);
          const a   = data.actual.filter(t  => t.category === cat.id).reduce((s,t)=>s+ +t.amount,0);
          const pct = p > 0 ? Math.min((a/p)*100,100) : 0;
          const over= p > 0 && a > p;
          grid.insertAdjacentHTML("beforeend", `
            <div class="cat-item">
              <div class="cat-hdr">
                <div class="cat-name"><span>${cat.icon}</span><span>${cat.label}</span></div>
                ${over ? `<span class="badge br" style="font-size:9px">over</span>` : ""}
              </div>
              ${p > 0 ? `<div class="cat-plan-row">plan: <span class="mono">${UI.formatPLN(p)}</span></div>` : ""}
              <div class="cat-spent mono" style="color:${cat.color}">spent: ${UI.formatPLN(a)}</div>
              ${p > 0 ? `<div class="track"><div class="fill" style="width:${pct}%;background:${over?"var(--red)":cat.color}"></div></div>` : ""}
            </div>`);
        }
      }
    } finally { UI.loading(false); }
  }

  // ══════════════════════════════════════════════════════════
  // TRANSACTIONS
  // ══════════════════════════════════════════════════════════

  function renderTransactions() {
    renderPeriodBar();
    // Render summary cards too
    buildSummary(pk()).then(data => {
      UI.el("sum-income-val").textContent  = UI.formatPLN(data.income);
      UI.el("sum-planned-val").textContent = UI.formatPLN(data.plannedTotal);
      UI.el("sum-actual-val").textContent  = UI.formatPLN(data.actualTotal);
      UI.el("sum-balance-val").textContent = UI.formatPLN(Math.abs(data.balance));
      UI.el("sum-balance-val").className   = `sum-val mono ${data.balance >= 0 ? "green" : "red"}`;
      UI.el("sum-balance-card").className  = `sum-card ${data.balance >= 0 ? "gc" : "rc"}`;
    });
    setTxTab(state.txTab);
  }

  function setTxTab(tab) {
    state.txTab = tab;
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    UI.el("tx-add-section")?.classList.toggle("hidden",    tab === "income");
    UI.el("tx-income-add-section")?.classList.toggle("hidden", tab !== "income");
    loadTxList(tab, state.txCat);
  }

  async function loadTxList(tab, filterCat) {
    state.txTab = tab; state.txCat = filterCat;
    const listEl = UI.el("tx-list");
    listEl.innerHTML = `<div class="tx-empty">Loading…</div>`;

    const data = await buildSummary(pk());
    listEl.innerHTML = "";

    if (tab === "income") {
      if (!data.incs.length) { listEl.innerHTML = `<div class="tx-empty">No income entries this period.</div>`; return; }
      data.incs.forEach(e => {
        const cat = UI.INCOME_CATEGORIES.find(c => c.id === e.source) || UI.INCOME_CATEGORIES[UI.INCOME_CATEGORIES.length-1];
        const row = makeTxRowEl(cat, cat.label, `+${UI.formatPLN(e.amount)}`, "var(--green)", null, async () => {
          if (!confirm("Delete this income entry?")) return;
          UI.loading(true); await DB.deleteIncome(e.id); bust(); loadTxList(tab, filterCat); UI.loading(false); UI.toast("Deleted", "err");
        });
        listEl.appendChild(row);
      });
      return;
    }

    let list = tab === "planned" ? data.planned : data.actual;
    if (filterCat !== "all") list = list.filter(t => t.category === filterCat);
    list = [...list].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

    if (!list.length) { listEl.innerHTML = `<div class="tx-empty">No ${tab} expenses${filterCat !== "all" ? " in this category" : ""}.</div>`; return; }

    list.forEach(t => {
      const cat = UI.getCategory(t.category);
      const color = tab === "planned" ? "var(--accent2)" : "var(--red)";
      const row = makeTxRowEl(cat, t.description, `−${UI.formatPLN(t.amount)}`, color,
        () => openEditModal(t, () => { bust(); loadTxList(tab, filterCat); }),
        async () => {
          if (!confirm("Delete?")) return;
          UI.loading(true); await DB.deleteTransaction(t.id); bust(); loadTxList(tab, filterCat); UI.loading(false); UI.toast("Deleted","err");
        });
      listEl.appendChild(row);
    });
  }

  function makeTxRowEl(cat, desc, amtStr, amtColor, onEdit, onDelete) {
    const row = document.createElement("div");
    row.className = "tx-row";
    const safeColor = cat.color || "#6C63FF";
    row.innerHTML = `
      <div class="tx-icon" style="background:${safeColor}22">${cat.icon || "🏷️"}</div>
      <div class="tx-info">
        <div class="tx-desc truncate">${desc}</div>
        <div class="tx-meta">${cat.label}</div>
      </div>
      <div class="tx-amt" style="color:${amtColor}">${amtStr}</div>
      <div class="tx-actions">
        ${onEdit ? `<button class="btn-edit">✏️</button>` : ""}
        <button class="btn-del">✕</button>
      </div>`;
    if (onEdit) row.querySelector(".btn-edit").onclick = onEdit;
    row.querySelector(".btn-del").onclick = onDelete;
    return row;
  }

  // Tx category filter grid
  function buildTxCatFilter() {
    const grid = UI.el("tx-cat-filter");
    if (!grid) return;
    grid.innerHTML = "";
    // "All" chip
    const allChip = document.createElement("button");
    allChip.className = "period-chip" + (state.txCat === "all" ? " active" : "");
    allChip.textContent = "All";
    allChip.onclick = () => { state.txCat = "all"; buildTxCatFilter(); loadTxList(state.txTab, "all"); };
    grid.appendChild(allChip);

    UI.CATEGORIES.forEach(cat => {
      const chip = document.createElement("button");
      chip.className = "period-chip" + (state.txCat === cat.id ? " active" : "");
      chip.textContent = `${cat.icon} ${cat.label}`;
      chip.onclick = () => { state.txCat = cat.id; buildTxCatFilter(); loadTxList(state.txTab, cat.id); };
      grid.appendChild(chip);
    });
  }

  // ══════════════════════════════════════════════════════════
  // ADD FORM (shared, inside transactions view)
  // ══════════════════════════════════════════════════════════

  function buildCategoryGrid(gridId, cats, hiddenId) {
    const grid = UI.el(gridId);
    if (!grid) return;
    grid.innerHTML = "";
    cats.forEach((cat, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cat-pick-btn" + (i === 0 ? " selected" : "");
      btn.dataset.id = cat.id;
      const safeColor = cat.color || "#6C63FF";
      btn.innerHTML  = `<span class="cat-pick-icon">${cat.icon || "🏷️"}</span><span class="cat-pick-label">${cat.label}</span>`;
      btn.style.setProperty("--cat-color", safeColor);
      btn.onclick = () => {
        grid.querySelectorAll(".cat-pick-btn").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        const inp = UI.el(hiddenId);
        if (inp) inp.value = cat.id;
      };
      grid.appendChild(btn);
    });
    const inp = UI.el(hiddenId);
    if (inp) inp.value = cats[0]?.id || "";
  }

  function initAddForm() {
    buildCategoryGrid("cat-grid-form",     UI.CATEGORIES,        "form-selected-cat");
    buildCategoryGrid("inc-cat-grid-form", UI.INCOME_CATEGORIES, "form-selected-inc-cat");

    document.querySelectorAll(".type-btn").forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll(".type-btn").forEach(b => b.classList.remove("a-plan","a-real","a-inc"));
        const t = btn.dataset.subtype;
        btn.classList.add(t === "planned" ? "a-plan" : t === "income" ? "a-inc" : "a-real");
        // Switch to income tab if income selected
        if (t === "income") { setTxTab("income"); return; }
        if (t === "planned") setTxTab("planned");
        else setTxTab("actual");
      };
    });

    UI.el("add-btn").onclick = submitForm;
    ["form-amount","form-desc"].forEach(id => {
      UI.el(id)?.addEventListener("keydown", e => { if (e.key === "Enter") submitForm(); });
    });
    UI.el("add-income-btn").onclick = submitIncomeForm;
    UI.el("inc-amount")?.addEventListener("keydown", e => { if (e.key === "Enter") submitIncomeForm(); });
  }

  function getAmt(id) { return parseFloat((UI.el(id)?.value || "").replace(",",".")); }

  async function submitForm() {
    const subtype = state.txTab === "planned" ? "planned" : "actual";
    const amount  = getAmt("form-amount");
    const desc    = UI.el("form-desc").value.trim();
    const cat     = UI.el("form-selected-cat").value;
    if (!desc) { UI.toast("Enter a description!", "err"); return; }
    if (isNaN(amount) || amount <= 0) { UI.toast("Enter a valid amount!", "err"); return; }
    UI.loading(true);
    await DB.addTransaction(pk(), subtype, cat, desc, amount);
    UI.el("form-desc").value = ""; UI.el("form-amount").value = "";
    bust(); loadTxList(state.txTab, state.txCat);
    UI.loading(false);
    UI.toast(subtype === "planned" ? "Added to plan ✓" : "Expense added ✓");
  }

  async function submitIncomeForm() {
    const amount = getAmt("inc-amount");
    const source = UI.el("form-selected-inc-cat").value;
    if (isNaN(amount) || amount <= 0) { UI.toast("Enter a valid amount!", "err"); return; }
    UI.loading(true);
    await DB.addIncome(pk(), source, amount);
    UI.el("inc-amount").value = "";
    bust(); loadTxList("income", "all");
    UI.loading(false);
    UI.toast("Income added ✓");
  }

  // ══════════════════════════════════════════════════════════
  // SAVINGS
  // ══════════════════════════════════════════════════════════

  async function renderSavings() {
    UI.loading(true);
    try {
      const [goals, deposits] = await Promise.all([DB.getSavingsGoals(), DB.getAllDeposits()]);
      const container = UI.el("savings-list");
      container.innerHTML = "";

      if (!goals.length) {
        container.innerHTML = `<div class="tx-empty">No savings goals yet. Add one above!</div>`;
        return;
      }

      goals.forEach(g => {
        const gDeps  = deposits.filter(d => d.goal_id === g.id);
        const saved  = gDeps.reduce((s,d) => s + +d.amount, 0);
        const pct    = g.target > 0 ? Math.min(Math.round((saved/g.target)*100), 100) : 0;
        const done   = saved >= g.target;
        const r      = 28; // circle radius
        const circ   = 2 * Math.PI * r;
        const dash   = circ - (pct/100) * circ;
        const color  = g.color || "#6C63FF";

        const tile = document.createElement("div");
        tile.innerHTML = `
          <div class="saving-tile">
            <div class="saving-tile-left">
              <div class="saving-tile-name">${g.icon || "🎯"} ${g.name}</div>
              ${g.note ? `<div class="saving-tile-note">${g.note}</div>` : ""}
              <div class="saving-tile-amounts">
                <span class="saving-tile-saved">${UI.formatPLN(saved)}</span>
                <span class="saving-tile-target">/ ${UI.formatPLN(g.target)}</span>
              </div>
              <div class="track" style="margin-top:10px">
                <div class="fill" style="width:${pct}%;background:${color}"></div>
              </div>
            </div>
            <div class="saving-tile-right">
              <div class="circle-progress">
                <svg viewBox="0 0 64 64" width="64" height="64">
                  <circle class="circle-bg" cx="32" cy="32" r="${r}"/>
                  <circle class="circle-fill" cx="32" cy="32" r="${r}"
                    stroke="${done ? "var(--green)" : color}"
                    stroke-dasharray="${circ}"
                    stroke-dashoffset="${dash}"/>
                </svg>
                <div class="circle-text" style="color:${done?"var(--green)":color}">${pct}%</div>
              </div>
              ${done ? `<span class="badge bg" style="font-size:10px">Done!</span>` : ""}
            </div>
          </div>
          <div class="saving-tile-detail" id="detail-${g.id}">
            <div class="deposit-form">
              <input type="text" inputmode="decimal" placeholder="Amount (PLN)" id="dep-amt-${g.id}" class="amount-input" style="font-size:16px"/>
              <input type="text" placeholder="Note (optional)" id="dep-note-${g.id}" style="font-size:16px"/>
              <button class="btn-p dep-btn" style="font-size:14px;padding:12px 16px">+ Deposit</button>
            </div>
            <div class="deposit-history" id="dep-hist-${g.id}">
              ${gDeps.length ? gDeps.map(d=>`
                <div class="deposit-row">
                  <div>
                    <span class="mono green">+${UI.formatPLN(d.amount)}</span>
                    ${d.note ? `<span class="dim" style="font-size:12px;margin-left:8px">${d.note}</span>` : ""}
                  </div>
                  <div style="display:flex;align-items:center;gap:8px">
                    <span class="muted" style="font-size:11px">${d.created_at?.slice(0,10)||""}</span>
                    <button class="btn-del dep-del" data-id="${d.id}" style="min-width:28px;min-height:28px;font-size:13px">✕</button>
                  </div>
                </div>`).join("") : `<div class="tx-empty" style="padding:12px 0">No deposits yet.</div>`}
            </div>
          </div>`;

        // Toggle detail on tile click
        const tileEl   = tile.querySelector(".saving-tile");
        const detailEl = tile.querySelector(`#detail-${g.id}`);
        let open = false;
        tileEl.style.cursor = "pointer";
        tileEl.onclick = () => { open = !open; detailEl.classList.toggle("open", open); };

        // Deposit
        tile.querySelector(".dep-btn").onclick = async (e) => {
          e.stopPropagation();
          const amt  = parseFloat((document.getElementById(`dep-amt-${g.id}`)?.value||"").replace(",","."));
          const note = document.getElementById(`dep-note-${g.id}`)?.value || "";
          if (isNaN(amt)||amt<=0) { UI.toast("Enter a valid amount!","err"); return; }
          UI.loading(true); await DB.addDeposit(g.id, amt, note); UI.loading(false);
          renderSavings(); UI.toast("Deposit added ✓");
        };

        // Deposit delete
        tile.querySelectorAll(".dep-del").forEach(btn => {
          btn.onclick = async (e) => {
            e.stopPropagation();
            if (!confirm("Delete this deposit?")) return;
            UI.loading(true); await DB.deleteDeposit(btn.dataset.id); UI.loading(false);
            renderSavings(); UI.toast("Deleted","err");
          };
        });

        // Delete goal (long-press simulation via button in detail)
        const delBtn = document.createElement("button");
        delBtn.className = "btn-del"; delBtn.style.cssText = "width:100%;margin-top:12px;border-radius:10px;padding:10px;justify-content:center;";
        delBtn.textContent = "🗑️ Delete this goal";
        delBtn.onclick = async (e) => {
          e.stopPropagation();
          if (!confirm(`Delete goal "${g.name}"?`)) return;
          UI.loading(true); await DB.deleteSavingsGoal(g.id); UI.loading(false);
          renderSavings(); UI.toast("Goal deleted","err");
        };
        tile.querySelector(`#detail-${g.id}`).appendChild(delBtn);

        container.appendChild(tile);
      });
    } finally { UI.loading(false); }
  }

  function initSavings() {
    UI.el("add-goal-btn").onclick = async () => {
      const name   = UI.el("goal-name").value.trim();
      const target = parseFloat((UI.el("goal-target").value||"").replace(",","."));
      const note   = UI.el("goal-note").value.trim();
      const icon   = UI.el("goal-icon").value.trim() || "🎯";
      const color  = UI.el("goal-color").value || "#6C63FF";
      if (!name || isNaN(target)||target<=0) { UI.toast("Enter name and target!","err"); return; }
      UI.loading(true);
      // Store note in icon field as workaround (or use name field with note appended)
      // We'll pass note as description by using a custom field
      await DB.addSavingsGoal(name, target, icon, color);
      // Update note: patch the just-created goal
      const goals = await DB.getSavingsGoals();
      const last = goals[goals.length-1];
      if (last && note) {
        const BASE = CONFIG.SUPABASE_URL + "/rest/v1";
        const KEY  = CONFIG.SUPABASE_KEY;
        await fetch(`${BASE}/savings_goals?id=eq.${last.id}`, {
          method: "PATCH",
          headers: { "apikey": KEY, "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ note })
        });
      }
      UI.loading(false);
      UI.el("goal-name").value = ""; UI.el("goal-target").value = "";
      UI.el("goal-note").value = ""; UI.el("goal-icon").value = "";
      renderSavings(); UI.toast("Goal added ✓");
    };
  }

  // ══════════════════════════════════════════════════════════
  // FINANCE (charts + period summaries)
  // ══════════════════════════════════════════════════════════

  async function renderFinance() {
    UI.loading(true);
    try {
      const [allTx, allInc] = await Promise.all([DB.getAllTransactions(), DB.getAllIncomes()]);

      // Collect unique periods sorted asc
      const keys = [...new Set([...allTx.map(t=>t.period_key),...allInc.map(i=>i.period_key)])]
        .sort((a,b) => a.localeCompare(b));

      if (!keys.length) {
        UI.el("finance-content").innerHTML = `<div class="tx-empty">No data yet. Start adding transactions!</div>`;
        return;
      }

      // Build per-period data
      const periods = keys.map(key => {
        const txs    = allTx.filter(t=>t.period_key===key);
        const incs   = allInc.filter(i=>i.period_key===key);
        const income = incs.reduce((s,i)=>s+ +i.amount,0);
        const spent  = txs.filter(t=>t.subtype==="actual").reduce((s,t)=>s+ +t.amount,0);
        const planned= txs.filter(t=>t.subtype==="planned").reduce((s,t)=>s+ +t.amount,0);
        const save   = income - spent;
        const [y,m]  = key.replace("p_","").split("_");
        const mIdx   = parseInt(m)-1;
        const label  = `${UI.MONTHS[mIdx]} ${y}`;
        return { key, income, spent, planned, save, label };
      });

      // Default selected = latest period or state.finPeriod
      if (!state.finPeriod || !periods.find(p=>p.key===state.finPeriod)) {
        state.finPeriod = periods[periods.length-1].key;
      }
      const sel = periods.find(p => p.key === state.finPeriod) || periods[periods.length-1];

      const maxVal = Math.max(...periods.flatMap(p=>[p.income, p.spent, p.save > 0 ? p.save : 0]), 1);

      const content = UI.el("finance-content");
      content.innerHTML = "";

      // Period selector chips
      const selectorDiv = document.createElement("div");
      selectorDiv.className = "period-selector";
      periods.slice().reverse().forEach(p => {
        const chip = document.createElement("button");
        chip.className = "period-chip" + (p.key === state.finPeriod ? " active" : "");
        chip.textContent = p.label;
        chip.onclick = () => { state.finPeriod = p.key; renderFinance(); };
        selectorDiv.appendChild(chip);
      });
      content.appendChild(selectorDiv);

      // Bar chart — all periods
      const chartCard = document.createElement("div");
      chartCard.className = "chart-card";
      chartCard.innerHTML = `<div class="chart-title">📊 All periods — Income, Spent, Saved</div><div class="bar-chart" id="bar-chart"></div>`;
      content.appendChild(chartCard);

      const barChart = chartCard.querySelector("#bar-chart");
      periods.forEach(p => {
        const incH  = Math.max((p.income/maxVal)*100, p.income>0?3:0);
        const sptH  = Math.max((p.spent /maxVal)*100, p.spent>0?3:0);
        const savH  = p.save > 0 ? Math.max((p.save/maxVal)*100, 3) : 0;
        const group = document.createElement("div");
        group.className = "bar-group";
        group.innerHTML = `
          <div class="bar-wrap">
            <div class="bar" style="height:${incH}%;background:var(--green);opacity:${p.key===state.finPeriod?1:.5}" title="Income: ${UI.formatPLN(p.income)}"></div>
            <div class="bar" style="height:${sptH}%;background:var(--red);opacity:${p.key===state.finPeriod?1:.5}" title="Spent: ${UI.formatPLN(p.spent)}"></div>
            ${savH > 0 ? `<div class="bar" style="height:${savH}%;background:var(--accent);opacity:${p.key===state.finPeriod?1:.5}" title="Saved: ${UI.formatPLN(p.save)}"></div>` : ""}
          </div>
          <div class="bar-label">${p.label.split(" ")[0]}</div>`;
        group.querySelector(".bar-wrap").onclick = () => { state.finPeriod = p.key; renderFinance(); };
        barChart.appendChild(group);
      });

      // Legend
      chartCard.insertAdjacentHTML("beforeend", `
        <div style="display:flex;gap:14px;margin-top:10px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:5px;font-size:12px"><div style="width:10px;height:10px;border-radius:2px;background:var(--green)"></div>Income</div>
          <div style="display:flex;align-items:center;gap:5px;font-size:12px"><div style="width:10px;height:10px;border-radius:2px;background:var(--red)"></div>Spent</div>
          <div style="display:flex;align-items:center;gap:5px;font-size:12px"><div style="width:10px;height:10px;border-radius:2px;background:var(--accent)"></div>Saved</div>
        </div>`);

      // Selected period detail
      const detail = document.createElement("div");
      const balPos = sel.save >= 0;
      detail.className = "card p20";
      detail.innerHTML = `
        <h2 class="sec">📅 ${sel.label}</h2>
        <div class="g2" style="margin-bottom:10px">
          <div class="sum-card gc">
            <div class="sum-lbl">Income</div>
            <div class="sum-val green mono">${UI.formatPLN(sel.income)}</div>
          </div>
          <div class="sum-card rc">
            <div class="sum-lbl">Spent</div>
            <div class="sum-val red mono">${UI.formatPLN(sel.spent)}</div>
          </div>
          <div class="sum-card pc">
            <div class="sum-lbl">Planned</div>
            <div class="sum-val mono" style="color:#a89ef8">${UI.formatPLN(sel.planned)}</div>
          </div>
          <div class="sum-card ${balPos?"gc":"rc"}">
            <div class="sum-lbl">Saved</div>
            <div class="sum-val mono ${balPos?"green":"red"}">${balPos?"":"-"}${UI.formatPLN(Math.abs(sel.save))}</div>
          </div>
        </div>
        ${sel.planned > 0 ? `
          <div style="font-size:12px;color:var(--dim);margin-bottom:5px">
            Plan vs actual: <span class="mono ${sel.spent<=sel.planned?"green":"red"}">${sel.spent<=sel.planned?"saved":"over"} ${UI.formatPLN(Math.abs(sel.planned-sel.spent))}</span>
          </div>
          <div class="track" style="margin-top:0">
            <div class="fill" style="width:${Math.min((sel.spent/sel.planned)*100,100)}%;background:${sel.spent>sel.planned?"var(--red)":"var(--accent)"}"></div>
          </div>` : ""}`;
      content.appendChild(detail);

    } finally { UI.loading(false); }
  }

  // ══════════════════════════════════════════════════════════
  // SETTINGS
  // ══════════════════════════════════════════════════════════

  function renderSettings() {
    // Nothing dynamic to load, HTML is static
  }

  function initSettings() {
    // Change PIN row
    UI.el("settings-pin-row").onclick = () => {
      UI.el("change-pw-modal").classList.remove("hidden");
      ["cpw-old","cpw-new","cpw-new2"].forEach(id => { UI.el(id).value=""; });
      UI.el("cpw-error").textContent = "";
      UI.el("cpw-error").classList.add("hidden");
    };

    // Billing period row toggle
    UI.el("settings-period-row").onclick = () => {
      const form = UI.el("period-settings-form");
      form.classList.toggle("open");
    };

    // Categories row
    UI.el("settings-cats-row").onclick = () => setView("categories");

    // Logout
    UI.el("settings-logout-row").onclick = () => {
      if (confirm("Sign out?")) { DB.clearSession(); location.reload(); }
    };

    // Period settings: start day
    const savedDay = parseInt(localStorage.getItem("bp_period_start_day") || "10");
    UI.el("period-start-day").value = savedDay;
    UI.el("save-period-settings").onclick = () => {
      const day = parseInt(UI.el("period-start-day").value);
      if (isNaN(day) || day < 1 || day > 28) { UI.toast("Day must be between 1 and 28", "err"); return; }
      localStorage.setItem("bp_period_start_day", day);
      UI.toast("Period settings saved ✓");
      UI.el("period-settings-form").classList.remove("open");
    };
  }

  function initChangePinModal() {
    UI.el("cpw-cancel").onclick = () => UI.el("change-pw-modal").classList.add("hidden");
    UI.el("cpw-submit").onclick = async () => {
      const op = UI.el("cpw-old").value, np = UI.el("cpw-new").value, np2 = UI.el("cpw-new2").value;
      const err = UI.el("cpw-error");
      err.textContent = ""; err.classList.add("hidden");
      if (np !== np2) { err.textContent = "New PINs don't match."; err.classList.remove("hidden"); return; }
      UI.loading(true);
      const res = await DB.changePin(op, np);
      UI.loading(false);
      if (!res.ok) { err.textContent = res.msg; err.classList.remove("hidden"); return; }
      UI.el("change-pw-modal").classList.add("hidden");
      UI.toast("PIN changed ✓");
    };
  }

  // ══════════════════════════════════════════════════════════
  // CATEGORIES
  // ══════════════════════════════════════════════════════════

  async function refreshCategories() {
    const rows = await DB.getCustomCategories();
    UI.applyCustomCategories(rows);
    buildCategoryGrid("cat-grid-form",     UI.CATEGORIES,        "form-selected-cat");
    buildCategoryGrid("inc-cat-grid-form", UI.INCOME_CATEGORIES, "form-selected-inc-cat");
    buildTxCatFilter();
    return rows;
  }

  async function renderCategories() {
    UI.loading(true);
    try {
      const rows = await refreshCategories();
      const expList = UI.el("custom-exp-list");
      const incList = UI.el("custom-inc-list");
      expList.innerHTML = ""; incList.innerHTML = "";

      const render = (cat, container) => {
        const safeColor = cat.color || "#6C63FF";
        const row = document.createElement("div");
        row.className = "cat-manage-row";
        row.innerHTML = `
          <div class="cat-manage-info">
            <div class="cat-manage-icon" style="background:${safeColor}33;border:1.5px solid ${safeColor}44">${cat.icon||"🏷️"}</div>
            <div>
              <div class="cat-manage-label">${cat.label}</div>
              <div style="font-size:11px;color:var(--muted)">${cat.type==="income"?"💵 Income":"💸 Expense"}</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="btn-edit">✏️</button>
            <button class="btn-del">✕</button>
          </div>`;
        row.querySelector(".btn-edit").onclick = () => openCatEditModal(cat, () => renderCategories());
        row.querySelector(".btn-del").onclick  = async () => {
          if (!confirm(`Delete "${cat.label}"?`)) return;
          UI.loading(true); await DB.deleteCustomCategory(cat.id); UI.loading(false);
          renderCategories(); UI.toast("Deleted","err");
        };
        container.appendChild(row);
      };

      const expRows = rows.filter(c=>c.type==="expense");
      const incRows = rows.filter(c=>c.type==="income");
      if (!expRows.length) expList.innerHTML = `<div class="tx-empty" style="padding:16px 0">No expense categories.</div>`;
      else expRows.forEach(c=>render(c,expList));
      if (!incRows.length) incList.innerHTML = `<div class="tx-empty" style="padding:16px 0">No income categories.</div>`;
      else incRows.forEach(c=>render(c,incList));
    } finally { UI.loading(false); }
  }

  function openCatEditModal(cat, onSave) {
    const modal = UI.el("cat-edit-modal");
    UI.el("cat-edit-label").value = cat.label;
    UI.el("cat-edit-icon").value  = cat.icon;
    UI.el("cat-edit-color").value = cat.color || "#6C63FF";
    modal.classList.remove("hidden");
    setTimeout(() => UI.el("cat-edit-label").focus(), 50);
    UI.el("cat-edit-cancel").onclick = () => modal.classList.add("hidden");
    UI.el("cat-edit-save").onclick = async () => {
      const label = UI.el("cat-edit-label").value.trim();
      const icon  = UI.el("cat-edit-icon").value.trim() || "🏷️";
      const color = UI.el("cat-edit-color").value || "#6C63FF";
      if (!label) { UI.toast("Name cannot be empty!","err"); return; }
      UI.loading(true);
      await DB.updateCustomCategory(cat.id, {label,icon,color});
      UI.loading(false); modal.classList.add("hidden");
      onSave(); UI.toast("Saved ✓");
    };
    ["cat-edit-label","cat-edit-icon"].forEach(id => {
      UI.el(id).onkeydown = e => { if(e.key==="Enter") UI.el("cat-edit-save").click(); };
    });
  }

  function initAddCategory() {
    const btnExp = UI.el("cat-type-expense");
    const btnInc = UI.el("cat-type-income");
    const typeInp= UI.el("new-cat-type");
    if (btnExp) btnExp.onclick = () => { btnExp.classList.add("a-real"); btnInc.className="type-btn"; typeInp.value="expense"; };
    if (btnInc) btnInc.onclick = () => { btnInc.classList.add("a-inc"); btnExp.className="type-btn"; typeInp.value="income"; };
    UI.el("add-cat-btn").onclick = async () => {
      const type  = UI.el("new-cat-type").value;
      const label = UI.el("new-cat-label").value.trim();
      const icon  = UI.el("new-cat-icon").value.trim() || "🏷️";
      const color = UI.el("new-cat-color").value || "#6C63FF";
      if (!label) { UI.toast("Enter a name!","err"); return; }
      UI.loading(true);
      await DB.addCustomCategory(type,label,icon,color);
      const rows = await DB.getCustomCategories();
      UI.applyCustomCategories(rows);
      UI.loading(false);
      UI.el("new-cat-label").value=""; UI.el("new-cat-icon").value="";
      buildCategoryGrid("cat-grid-form",UI.CATEGORIES,"form-selected-cat");
      buildCategoryGrid("inc-cat-grid-form",UI.INCOME_CATEGORIES,"form-selected-inc-cat");
      buildTxCatFilter();
      renderCategories(); UI.toast("Category added ✓");
    };
  }

  // ══════════════════════════════════════════════════════════
  // EDIT TRANSACTION MODAL
  // ══════════════════════════════════════════════════════════

  function openEditModal(t, onSave) {
    const modal = UI.el("edit-modal");
    UI.el("edit-desc").value   = t.description;
    UI.el("edit-amount").value = t.amount;
    const sel = UI.el("edit-category");
    sel.innerHTML = "";
    UI.CATEGORIES.forEach(c => {
      const o = document.createElement("option");
      o.value=c.id; o.textContent=`${c.icon} ${c.label}`;
      if(c.id===t.category) o.selected=true;
      sel.appendChild(o);
    });
    modal.classList.remove("hidden");
    UI.el("edit-cancel").onclick = () => modal.classList.add("hidden");
    UI.el("edit-save").onclick = async () => {
      const desc   = UI.el("edit-desc").value.trim();
      const amount = parseFloat((UI.el("edit-amount").value||"").replace(",","."));
      const catId  = UI.el("edit-category").value;
      if (!desc||isNaN(amount)||amount<=0) { UI.toast("Fill in all fields!","err"); return; }
      UI.loading(true);
      await DB.updateTransaction(t.id,{description:desc,amount,category:catId});
      modal.classList.add("hidden"); bust(); onSave();
      UI.loading(false); UI.toast("Saved ✓");
    };
  }

  // ══════════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════════

  async function init() {
    // Seed + load categories
    try {
      await DB.seedDefaultCategories(UI.DEFAULT_CATEGORIES, UI.DEFAULT_INCOME_CATEGORIES);
      const rows = await DB.getCustomCategories();
      UI.applyCustomCategories(rows);
    } catch(e) { console.warn("Categories error", e); }

    // Nav
    document.querySelectorAll(".nav-btn,.bnav-btn").forEach(btn =>
      btn.addEventListener("click", () => setView(btn.dataset.view)));

    // Period nav
    UI.el("prev-period").onclick = prevPeriod;
    UI.el("next-period").onclick = nextPeriod;

    // Logout
    const logout = () => { DB.clearSession(); location.reload(); };
    UI.el("logout-btn").onclick        = logout;
    UI.el("logout-btn-mobile").onclick = logout;

    // PIN buttons
    const openPin = () => {
      ["cpw-old","cpw-new","cpw-new2"].forEach(id=>{UI.el(id).value="";});
      UI.el("cpw-error").textContent=""; UI.el("cpw-error").classList.add("hidden");
      UI.el("change-pw-modal").classList.remove("hidden");
    };
    UI.el("change-pw-btn").onclick        = openPin;
    UI.el("change-pw-btn-mobile").onclick = openPin;

    // Tabs
    document.querySelectorAll(".tab-btn").forEach(btn =>
      btn.addEventListener("click", () => setTxTab(btn.dataset.tab)));

    initAddForm();
    initSavings();
    initSettings();
    initChangePinModal();
    initAddCategory();
    buildTxCatFilter();

    setView("dashboard");
  }

  return { init };
})();
