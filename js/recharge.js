// recharge.js
document.addEventListener("DOMContentLoaded", () => {
  // --- config / mock data endpoints ---
  // set API_BASE to your Django server root (use https://payment-application-based-on-upi-backend-12jg.onrender.com/ if running locally)
  const API_BASE = "https://payment-application-based-on-upi-backend-12jg.onrender.com/api";
  const operatorsEl = document.getElementById("operators");
  const plansContainer = document.getElementById("plans-container");
  const planTabs = document.getElementById("plan-tabs");
  const mobileInput = document.getElementById("mobile-number");
  const circleSelect = document.getElementById("circle-select");
  const typeSelect = document.getElementById("recharge-type");
  const selectedSummary = document.getElementById("selected-summary");
  const proceedBtn = document.getElementById("proceed-btn");
  const modal = document.getElementById("pay-modal");
  const closeModal = document.getElementById("close-modal");
  const modalInfo = document.getElementById("modal-info");
  const txnPin = document.getElementById("txn-pin");
  const payNow = document.getElementById("pay-now");
  const payCancel = document.getElementById("pay-cancel");
  const toast = document.getElementById("toast");
  const plansTitle = document.getElementById("plans-title");

  let operators = [];       // fetched operator list
  let plans = {};           // plans grouped by category for current operator
  let selectedOp = null;
  let selectedPlan = null;
  let selectedTab = "data";

  // small ui helpers
  function showToast(msg, ms = 2500) {
    toast.textContent = msg;
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), ms);
  }
  function enableBtn(el, enable = true) {
    el.disabled = !enable;
    if (enable) el.classList.add("primary"); else el.classList.remove("primary");
  }

  // fetch operators from API (or use static fallback)
  async function loadOperators() {
    // Call when modal opens or on page load

    try {
      const resp = await fetch(`${API_BASE}/operators/`);
      if (!resp.ok) throw new Error("failed");
      operators = await resp.json();
    } catch (err) {
      // fallback static list if backend not running
      operators = [
        { code: "airtel", name: "Airtel", logo: "assets/images/airtel.PNG" },
        { code: "jio", name: "Jio", logo: "" },
        { code: "vi", name: "Vi", logo: "" },
        { code: "bsnl", name: "BSNL", logo: "" }
      ];
    }
    renderOperators();
    loadBanks();
  }

  
  function renderOperators() {
    operatorsEl.innerHTML = "";
    operators.forEach(op => {
      const b = document.createElement("button");
      b.className = "operator-btn";
      b.innerHTML = `
    

        <strong>${op.name}</strong>
      `;
      b.addEventListener("click", () => selectOperator(op, b));
      operatorsEl.appendChild(b);
    });
  }

  async function selectOperator(op, btnEl) {
    // mark active
    document.querySelectorAll(".operator-btn").forEach(x => x.classList.remove("active"));
    btnEl.classList.add("active");
    selectedOp = op;
    plansTitle.textContent = `${op.name} Plans`;
    // fetch plans for operator + circle
    await loadPlansFor(op.code, circleSelect.value, typeSelect.value);
  }

  async function loadPlansFor(operatorCode, circle, rechType) {
    plansContainer.innerHTML = `<div class="muted">Loading plans…</div>`;
    try {
      const resp = await fetch(`${API_BASE}/plans/?operator=${operatorCode}&circle=${circle}&type=${rechType}`);
      if (!resp.ok) throw new Error("no-plans");
      const j = await resp.json();
      plans = j.plans || {};
    } catch (err) {
      // mock plans fallback
      plans = {
        data: [
          { id: `d1-${operatorCode}`, amount: 149, title: "1.5GB/day", validity: "28 days", desc: "Best for streaming" },
          { id: `d2-${operatorCode}`, amount: 98, title: "1GB/day", validity: "14 days", desc: "Popular" }
        ],
        "5g": [
          { id: `5g1-${operatorCode}`, amount: 249, title: "5G Pack", validity: "28 days", desc: "Faster speed" }
        ],
        topup: [
          { id: `t1-${operatorCode}`, amount: 10, title: "₹10 Topup", desc: "Talktime" }
        ],
        unlimited: [
          { id: `u1-${operatorCode}`, amount: 399, title: "Unlimited", validity: "56 days", desc: "Unlimited calls & data" }
        ]
      };
    }
    renderPlansForTab(selectedTab);
  }

  function renderPlansForTab(tabKey) {
    selectedTab = tabKey;
    // highlight
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tabKey));
    const list = plans[tabKey] || [];
    plansContainer.innerHTML = "";
    if (!list.length) {
      plansContainer.innerHTML = `<div class="muted">No plans found for this category</div>`;
      return;
    }
    list.forEach(p => {
      const el = document.createElement("div");
      el.className = "plan";
      el.innerHTML = `
        <div class="price">₹${p.amount}</div>
        <div class="meta">${p.title || p.desc || ""} ${p.validity ? ' • ' + p.validity : ''}</div>
        <div class="meta small">${p.desc ? p.desc : ''}</div>
        <div class="select">Select</div>
      `;
      el.addEventListener("click", () => choosePlan(p, el));
      plansContainer.appendChild(el);
      // small stagger animation
      el.style.transform = "translateY(18px) scale(.99)";
      el.style.opacity = "0";
      setTimeout(() => { el.style.transition = "all .42s cubic-bezier(.2,.9,.3,1)"; el.style.transform = ""; el.style.opacity = "1"; }, 50);
    });
  }

  function choosePlan(plan, el) {
    selectedPlan = plan;
    document.querySelectorAll(".plan").forEach(x => x.classList.remove("chosen"));
    el.classList.add("chosen");
    // update summary
    selectedSummary.innerHTML = `
      <div style="text-align:left">
        <div style="font-weight:700">₹${plan.amount} • ${plan.title || plan.desc}</div>
        <div class="muted small">${plan.validity ? plan.validity + ' • ' : ''}${plan.desc || ''}</div>
        <div style="margin-top:8px" class="muted small">Operator: ${selectedOp ? selectedOp.name : '—'} • Circle: ${circleSelect.value}</div>
      </div>
    `;
    enableBtn(proceedBtn, true);
  }

  // tabs click
  planTabs.addEventListener("click", (ev) => {
    const t = ev.target.closest(".tab");
    if (!t) return;
    renderPlansForTab(t.dataset.tab);
  });

  // circle or type change reload if operator selected
  circleSelect.addEventListener("change", () => { if (selectedOp) loadPlansFor(selectedOp.code, circleSelect.value, typeSelect.value); });
  typeSelect.addEventListener("change", () => { if (selectedOp) loadPlansFor(selectedOp.code, circleSelect.value, typeSelect.value); });

  // proceed to payment
  proceedBtn.addEventListener("click", () => {
    if (!selectedPlan) return;
    const number = mobileInput.value.trim();
    if (!/^\d{10}$/.test(number)) { showToast("Enter a valid 10-digit mobile number"); return; }
    // show modal
    modalInfo.innerHTML = `
      <div>Number: <strong>${number}</strong></div>
      <div>Operator: <strong>${selectedOp ? selectedOp.name : ''}</strong></div>
      <div>Plan: <strong>₹${selectedPlan.amount} • ${selectedPlan.title || selectedPlan.desc}</strong></div>
    `;
    txnPin.value = "";
    document.body.style.overflow = "hidden";
    modal.classList.remove("hidden");
  });

  // close modal
  function closePayModal() {
    modal.classList.add("hidden");
    document.body.style.overflow = "";
  }
  closeModal.addEventListener("click", closePayModal);
  payCancel.addEventListener("click", closePayModal);

  // confirm payment -> call backend
  payNow.addEventListener("click", async () => {
    const pin = txnPin.value.trim();
    if (!pin || pin.length < 4) { showToast("Enter your PIN"); return; }
    // show processing
    const bank_id = document.getElementById("bank-select");
    selectedbankId=bank_id.value;
    payNow.disabled = true;
    payNow.textContent = "Processing…";
    try {
      const payload = {
        mobile: mobileInput.value.trim(),
        operator: selectedOp ? selectedOp.code : null,
        circle: circleSelect.value,
        plan_id: selectedPlan.id,
        amount: selectedPlan.amount,
        pin: pin,
        type: typeSelect.value,
        bank_id:selectedbankId
      };
      const token = localStorage.getItem('gapytoken');
      // mock call to API (POST /api/recharge/)
      const resp = await fetch(`${API_BASE}/recharge/`, {
        method: "POST",
        headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${token}`,
      },
        body: JSON.stringify(payload)
      });
      const data = await resp.json().catch(()=>({status:"ERROR", message:"Invalid response"}));
      if (!resp.ok) {
        showToast(data.message || "Recharge failed");
        closePayModal();
        return;
      }
      // show success/failure based on response
      if (data.status === "SUCCESS") {
        closePayModal();
        showToast("Recharge successful ✓");
        // add to transaction history UI or update page
      } else {
        closePayModal();
        showToast("Recharge failed: " + (data.message || "try again"));
      }
    } catch (err) {
      console.error(err);
      showToast("Network error");
    } finally {
      payNow.disabled = false;
      payNow.textContent = "Pay Now";
    }
  });

  // initial load
  loadOperators().then(()=> {
    // auto-select first operator
    const firstBtn = document.querySelector(".operator-btn");
    if (firstBtn) firstBtn.click();
  });

  // keyboard enter to proceed
  mobileInput.addEventListener("keydown", (e) => { if (e.key === "Enter") proceedBtn.click(); });


  
const token = localStorage.getItem("gapytoken");

// SIMPLE: load banks for user
async function loadBanks() {
  const sel = document.getElementById("bank-select");

  sel.innerHTML = `<option>Loading...</option>`;

  try {
    const res = await fetch(`${API_BASE}/banks/`, {
      headers: { Authorization: `Token ${token}` }
    });

    const data = await res.json();

    sel.innerHTML = ""; // clear old items

  data.forEach(bank => {
    const opt = document.createElement("option");
    opt.value = bank.id;
    opt.textContent = `${bank.bank_name} - ${bank.account_number}`;
    sel.appendChild(opt);   // ✅ works always
  });

  } catch (err) {
    sel.innerHTML = `<option>Error loading banks</option>`;
  }
}




});
