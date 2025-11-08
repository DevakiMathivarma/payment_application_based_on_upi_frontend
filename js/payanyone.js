// payanyone.js
document.addEventListener("DOMContentLoaded", () => {
  
  const searchInput = document.getElementById("search-input");
  const searchBtn = document.getElementById("search-btn");
  const results = document.getElementById("search-results");
  const savedList = document.getElementById("saved-payees");
  const templateModal = document.getElementById("message-template");
  const payMessage = document.getElementById("pay-message");
  const sendBtn = document.getElementById("send-btn");
  const cancelTemplate = document.getElementById("cancel-template");
  let selectedPayeeId = null;
  let selectedAccountNumber=null;
  let selectedBank=null;
  let userBalance = 0;
const API_BASE = "https://payment-application-based-on-upi-backend-12jg.onrender.com";
loadBanks();
  // fetch balance (demo: the template expects /api/profile maybe)
  fetch("/api/profile/")  // you can replace with your profile endpoint
    .then(r => r.ok ? r.json() : Promise.reject(r))
    .then(data => {
      userBalance = data.balance || 0;
      document.getElementById("balance-amt").textContent = Number(userBalance).toFixed(2);
    })
    .catch(() => { /* ignore */ });

  function renderPayee(p) {
    const el = document.createElement("div");
    el.className = "payee-card";
    el.innerHTML = `
      <div class="payee-meta">
        <div class="avatar">${(p.holder_name||"U").charAt(0).toUpperCase()}</div>
        <div class="payee-info">
          <div class="name">${p.holder_name}</div>
          <div class="muted">${p.upi_id || p.phone || p.email || ""}</div>
          <div class="muted">${ p.account_number || p.email || ""}</div>
          <div class="muted">${ p.bank_name || p.email || ""}</div>


        </div>
      </div>
      <div class="payee-actions">
        <button class="btn btn-outline view-btn">View</button>
      </div>
    `;
    // attach handlers
    // el.querySelector(".add-btn").addEventListener("click", () => addSavedPayee(p.id, el));
    el.querySelector(".view-btn").addEventListener("click", () => openTemplate(p.id, p));
    return el;
  }

  function renderSavedItem(item) {
    const p = item.payee;
    const el = document.createElement("div");
    el.className = "payee-card";
    el.innerHTML = `
      <div class="payee-meta">
        <div class="avatar">${(p.holder_name||"U").charAt(0).toUpperCase()}</div>
        <div class="payee-info">
          <div class="name">${p.holder_name}</div>
          <div class="muted">${p.upi_id || p.phone || p.email || ""}</div>
        </div>
      </div>
      <div class="payee-actions">
        <button class="btn btn-add pay-btn">Pay</button>
      </div>
    `;
    el.querySelector(".pay-btn").addEventListener("click", () => openTemplate(p.id, p));
    return el;
  }

  function openTemplate(payeeId, payee) {
    selectedPayeeId = payeeId;
    const bank_id = document.getElementById("bank-select");
    selectedAccountNumber=bank_id.value;
    selectedBank=payee.bank_name;
    console.log(bank_id)
    payMessage.value = `Paying ${payee.holder_name} (${payee.upi_id || payee.phone || ""})`;
    templateModal.classList.remove("hidden");
  }

  cancelTemplate.addEventListener("click", () => {
    templateModal.classList.add("hidden");
  });

  sendBtn.addEventListener("click", async () => {
    // ask for amount then PIN
    templateModal.classList.add("hidden");
    const amount = prompt("Enter amount (₹)");
    if (!amount) return alert("Cancelled");
    const pin = prompt("Enter transaction PIN");
    if (pin === null) return alert("Cancelled");

    // Make transaction request
     try {
      const token = localStorage.getItem('gapytoken');
      const payload = { payee_id: selectedPayeeId, amount: amount, pin: pin, reference: payMessage.value,bank_name:selectedBank,id:selectedAccountNumber };
      const res = await fetch(`${API_BASE}/api/transactions/make/`, {
        method: "POST",
        headers: { Authorization: `Token ${token}`,"Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
       
      const data = await res.json();
      if (!res.ok) {
        alert(data.detail || "Transaction failed");
        return;
      }
      // success message shown as a styled alert (you can replace with fancier UI)
      alert("Transaction successful!\nReference: " + (data.transaction && data.transaction.id));
      // update balance
      // if (data.transaction) {
      //   const newBalance = Number((document.getElementById("balance-amt").textContent || 0)) - Number(amount);
      //   document.getElementById("balance-amt").textContent = Number(newBalance).toFixed(2);
      // }
    } catch (err) {
      console.error(err);
      alert("Network error");
    }
  });

  async function addSavedPayee(payeeId, el) {
    try {
      const res = await fetch(`${API_BASE}/api/payees/add_saved/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payee_id: payeeId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.detail || "Could not save payee");
        return;
      }
      alert("Added to payee list");
      // optional: move card to saved list
      loadSavedPayees();
      // small heartbeat animation
      el.animate([{ transform: "scale(1)"},{ transform: "scale(.98)"},{ transform: "scale(1)"}], { duration: 260 });
    } catch (err) {
      console.error(err);
      alert("Network error");
    }
  }
async function loadBanks() {
  const sel = document.getElementById("bank-select");

  sel.innerHTML = `<option>Loading...</option>`;
const token = localStorage.getItem('gapytoken');
  try {
    const res = await fetch(`${API_BASE}/api/banks/`, {
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
  async function doSearch(q) {
    
    results.innerHTML = "<div style='opacity:.6'>Searching...</div>";
    try {
      const res = await fetch(`${API_BASE}/api/payees/search/?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      results.innerHTML = "";
      if (!Array.isArray(data) || data.length === 0) {
        results.innerHTML = "<div style='opacity:.6'>No results found.</div>";
        return;
      }
            

      data.forEach(p => results.appendChild(renderPayee(p)));
    } catch (err) {
      console.error(err);
      results.innerHTML = "<div style='opacity:.6'>Searc1h failed</div>";
    }
  }

  async function loadSavedPayees() {
    savedList.innerHTML = "<div style='opacity:.6'>Loading...</div>";
    try {
      const res = await fetch(`${API_BASE}/api/payees/list_saved/`);
      const data = await res.json();
      savedList.innerHTML = "";
      if (!Array.isArray(data) || data.length === 0) {
        savedList.innerHTML = "<div style='opacity:.6'>No saved payees yet.</div>";
        return;
      }
      data.forEach(item => savedList.appendChild(renderSavedItem(item)));
    } catch (err) {
      console.error(err);
      savedList.innerHTML = "<div style='opacity:.6'>Failed to load saved payees</div>";
    }
  }

  searchBtn.addEventListener("click", () => {
    const q = searchInput.value.trim();
    if (!q) return;
    doSearch(q);
  });

  // init
  loadSavedPayees();
});

const fPayTile = document.getElementById('f-pay');
if (fPayTile) {
  fPayTile.style.cursor = 'pointer';
  fPayTile.addEventListener('click', () => {
    window.location.href = 'payanyone.html';
  });
}
