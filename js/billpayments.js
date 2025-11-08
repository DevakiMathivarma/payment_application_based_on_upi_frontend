// billpayments.js
document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://payment-application-based-on-upi-backend-12jg.onrender.com/api";
  const token = () => localStorage.getItem("gapytoken");
  const categoriesEl = document.getElementById("categories");
  const billersModal = document.getElementById("modal-billers");
  const billersGrid = document.getElementById("billers-grid");
  const closeBillers = document.getElementById("close-billers");
  const modalFetch = document.getElementById("modal-fetch");
  const consumerInput = document.getElementById("consumer-input");
  const btnFetch = document.getElementById("btn-fetch");
  const fetchMsg = document.getElementById("fetch-msg");
  const modalPay = document.getElementById("modal-pay");
  const billPreview = document.getElementById("bill-preview");
  const reminderInput = document.getElementById("reminder-input");
  const btnPay = document.getElementById("btn-pay");
  const payMsg = document.getElementById("pay-msg");
  const modalPin = document.getElementById("modal-pin");
  const pinInput = document.getElementById("pin-input");
  const btnConfirmPay = document.getElementById("btn-confirm-pay");
  const modalReceipt = document.getElementById("modal-receipt");
  const receiptContent = document.getElementById("receipt-content");
  const btnPrint = document.getElementById("print-receipt");
  const btnDownload = document.getElementById("download-receipt");
  const historyList = document.getElementById("history-list");

  // categories static list (for UI)
  const CATEGORIES = [
    { id:"electricity", title:"Electricity", icon:"⚡" },
    { id:"water", title:"Water", icon:"💧" },
    { id:"postpaid", title:"Postpaid Mobile", icon:"📱" },
    { id:"dth", title:"DTH / Cable", icon:"📺" },
    { id:"broadband", title:"Broadband / Landline", icon:"🌐" },
    { id:"gas", title:"Gas", icon:"🧾" }
  ];

  // state
  let selectedCategory = null;
  let selectedBiller = null;
  let fetchedBill = null;
  let latestPayment = null;

  // build category UI
  function renderCategories(){
    categoriesEl.innerHTML = "";
    CATEGORIES.forEach(c => {
      const card = document.createElement("div");
      card.className = "cat-card";
      card.innerHTML = `<div class="icon">${c.icon}</div><h4>${c.title}</h4>`;
      card.addEventListener("click", () => openBillers(c.id, c.title));
      categoriesEl.appendChild(card);
    });
  }

  // open billers modal for category
  async function openBillers(category, title){
    selectedCategory = category;
    billersGrid.innerHTML = `<div class="muted">Loading billers…</div>`;
    showModal(billersModal);
    document.getElementById("modal-billers-title").textContent = `Choose ${title} Provider`;
    try {
      const resp = await fetch(`${API_BASE}/bill/billers/?category=${encodeURIComponent(category)}`, {
        headers: { "Content-Type":"application/json", ...(token()?{ "Authorization": `Token ${token()}` }:{}) }
      });
      const billers = await resp.json();
      renderBillersGrid(billers);
    } catch (err) {
      billersGrid.innerHTML = `<div class="muted">Could not load billers</div>`;
    }
  }

  function renderBillersGrid(billers){
    if (!Array.isArray(billers) || billers.length===0) {
      billersGrid.innerHTML = `<div class="muted">No billers found</div>`;
      return;
    }
    billersGrid.innerHTML = "";
    billers.forEach(b => {
      const node = document.createElement("div");
      node.className = "biller";
      node.innerHTML = `<div class="bicon">${b.logo? `<img src="${b.logo}" style="width:48px;height:48px;border-radius:8px">` : '<div style="font-size:22px;">🏷️</div>'}</div><div class="bname">${b.name}</div>`;
      node.addEventListener("click", () => {
        selectedBiller = b;
        hideModal(billersModal);
        openFetchModal();
      });
      billersGrid.appendChild(node);
    });
  }

  // fetch consumer input modal
  function openFetchModal(){
    consumerInput.value = "";
    fetchMsg.textContent = "";
    showModal(modalFetch);
    document.getElementById("modal-fetch-title").textContent = `Pay ${selectedBiller.name}`;
    loadBanks();
  }

  btnFetch.addEventListener("click", async () => {
    const consumer = consumerInput.value.trim();
    fetchMsg.textContent = "";
    if (!consumer) { fetchMsg.textContent = "Enter consumer number"; return; }
    // call fetch API
    try {
      btnFetch.disabled = true; btnFetch.textContent = "Fetching…";
      const resp = await fetch(`${API_BASE}/bill/fetch/`, {
        method:"POST",
        headers:{"Content-Type":"application/json", ...(token()?{ "Authorization": `Token ${token()}` }:{})},
        body: JSON.stringify({biller_code: selectedBiller.code, consumer_number: consumer})
      });
      const data = await resp.json();
      if (!resp.ok) {
        fetchMsg.textContent = data.detail || "Fetch failed";
        btnFetch.disabled = false; btnFetch.textContent = "Fetch Bill";
        return;
      }
      fetchedBill = data.bill;
      renderBillPreview();
      hideModal(modalFetch);
      showModal(modalPay);
    } catch (err) {
      fetchMsg.textContent = "Network error";
    } finally { btnFetch.disabled = false; btnFetch.textContent = "Fetch Bill"; }
  });

  function renderBillPreview(){
    if (!fetchedBill) return;
    billPreview.innerHTML = "";
    const rows = [
      ["Biller", selectedBiller.name],
      ["Consumer", fetchedBill.consumer_number],
      ["Name", fetchedBill.name_on_bill],
      ["Period", fetchedBill.period],
      ["Amount (₹)", fetchedBill.amount],
      ["Due date", fetchedBill.due_date]
    ];
    rows.forEach(r => {
      const div = document.createElement("div");
      div.className = "bill-row";
      div.innerHTML = `<div>${r[0]}</div><div style="font-weight:600">${r[1]}</div>`;
      billPreview.appendChild(div);
    });
  }

  btnPay.addEventListener("click", () => {
    payMsg.textContent = "";
    // open pin modal
    pinInput.value = "";
    showModal(modalPin);
  });

  btnConfirmPay.addEventListener("click", async () => {
    const pin = pinInput.value.trim();
    if (!pin || pin.length<4) { document.getElementById("pin-msg").textContent="Enter 4-digit PIN"; return; }
    document.getElementById("pin-msg").textContent = "";
    btnConfirmPay.disabled = true; btnConfirmPay.textContent = "Processing…";
        const bank_id = document.getElementById("bank-select");
    selectedbankId=bank_id.value;
    try {
      const reminder = reminderInput.value || null;
      const resp = await fetch(`${API_BASE}/bill/pay/`, {
        method:"POST",
        headers:{"Content-Type":"application/json", ...(token()?{ "Authorization": `Token ${token()}` }:{})},
        body: JSON.stringify({
          biller_code: selectedBiller.code,
          consumer_number: fetchedBill.consumer_number,
          amount: fetchedBill.amount,
          pin: pin,
          reminder_date: reminder,
          bank_id:selectedbankId
        })
      });
      const data = await resp.json();
      if (!resp.ok) {
        document.getElementById("pin-msg").textContent = data.message || "Payment failed";
        btnConfirmPay.disabled = false; btnConfirmPay.textContent = "Confirm & Pay";
        return;
      }
      latestPayment = data.billpayment;
      // show receipt
      populateReceipt(data);
      hideModal(modalPin);
      hideModal(modalPay);
      showModal(modalReceipt);
      loadHistory(); // refresh history
    } catch (err) {
      document.getElementById("pin-msg").textContent = "Network error";
    } finally {
      btnConfirmPay.disabled = false; btnConfirmPay.textContent = "Confirm & Pay";
    }
  });

  function populateReceipt(data){
    const bp = data.billpayment;
    const rc = document.createElement("div");
    rc.innerHTML = `
      <div style="font-weight:700;margin-bottom:8px">${bp.biller.name} - Bill Receipt</div>
      <div>Consumer: ${bp.consumer_number}</div>
      <div>Name: ${bp.name_on_bill || '-'}</div>
      <div>Period: ${bp.period || '-'}</div>
      <div>Amount: ₹${bp.amount}</div>
      <div>Paid on: ${bp.paid_on || new Date().toISOString()}</div>
      <div>Provider Txn: ${bp.provider_txn || data.provider_txn}</div>
      <div style="margin-top:8px;color:#666">Remaining balance: ₹${data.remaining_balance}</div>
    `;
    receiptContent.innerHTML = "";
    receiptContent.appendChild(rc);
  }

  btnPrint.addEventListener("click", () => {
    const html = receiptContent.innerHTML;
    const w = window.open("", "_blank");
    w.document.write(`<html><head><title>Receipt</title></head><body>${html}<script>window.print()</script></body></html>`);
    w.document.close();
  });

  btnDownload.addEventListener("click", () => {
    const text = receiptContent.innerText || receiptContent.textContent;
    const blob = new Blob([text], {type:"text/plain"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `receipt-${Date.now()}.txt`;
    document.body.appendChild(a); a.click(); a.remove();
  });

  // load recent history
  async function loadHistory(){
    historyList.innerHTML = "Loading…";
    try {
      const resp = await fetch(`${API_BASE}/bill/history/`, {
        headers:{"Content-Type":"application/json", ...(token()?{ "Authorization": `Token ${token()}` }:{})}
      });
      const data = await resp.json();
      renderHistory(data);
    } catch (err) {
      historyList.innerHTML = "<div class='muted'>Could not load history</div>";
    }
  }

  function renderHistory(items){
    if (!Array.isArray(items) || items.length===0) {
      historyList.innerHTML = "<div class='muted'>No recent bill payments</div>";
      return;
    }
    historyList.innerHTML = "";
    items.forEach(it => {
      const item = document.createElement("div");
      item.className = "history-item";
      item.innerHTML = `<div>
          <div style="font-weight:600">${it.biller.name} • ₹${it.amount}</div>
          <div class="meta">Consumer: ${it.consumer_number} • ${it.type} • Due: ${it.due_date||'-'}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:600">${it.status}</div>
          <div style="margin-top:8px">${it.reminder_date?`Reminder: ${it.reminder_date}`:''}</div>
        </div>`;
      item.addEventListener("click", () => {
        // open receipt quick view
        selectedBiller = it.biller;
        fetchedBill = it;
        populateReceipt({billpayment: it, provider_txn: it.provider_txn});
        showModal(modalReceipt);
      });
      historyList.appendChild(item);
    });
  }

  // utils: modals
  function showModal(el){ el.classList.remove("hidden"); }
  function hideModal(el){ el.classList.add("hidden"); }
  closeBillers.addEventListener("click", ()=> hideModal(billersModal));
  document.getElementById("close-fetch").addEventListener("click", ()=> hideModal(modalFetch));
  document.getElementById("close-pay").addEventListener("click", ()=> hideModal(modalPay));
  document.getElementById("close-pin").addEventListener("click", ()=> hideModal(modalPin));
  document.getElementById("close-receipt").addEventListener("click", ()=> hideModal(modalReceipt));

  // init UI
  renderCategories();
  loadHistory();

  async function loadBanks() {
    console.log('varen')
  const sel = document.getElementById("bank-select");

  sel.innerHTML = `<option>Loading...</option>`;

  try {
    const token = localStorage.getItem("gapytoken");
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
