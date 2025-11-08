document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://payment-application-based-on-upi-backend-12jg.onrender.com/api"; // adjust if your API prefix differs
  const token = () => localStorage.getItem("gapytoken");
loadBanks();
  const form = document.getElementById("bank-search-form");
  const acctInput = document.getElementById("acct-number");
  const ifscInput = document.getElementById("ifsc");
  const feedback = document.getElementById("search-feedback");
  const resultsBox = document.getElementById("search-results");

  const recvModal = document.getElementById("receiver-modal");
  const recvName = document.getElementById("recv-name");
  const recvBank = document.getElementById("recv-bank");
  const recvAcc = document.getElementById("recv-acc");
  const recvUpi = document.getElementById("recv-upi");
  const recvAvatar = document.getElementById("recv-avatar");
  const closeRecv = document.getElementById("close-receiver");
  const addPayeeBtn = document.getElementById("add-payee");
  const payNowBtn = document.getElementById("pay-now");
  const viewDetailsBtn = document.getElementById("view-details");

  const payModal = document.getElementById("payment-modal");
  const closePay = document.getElementById("close-payment");
  const amtInput = document.getElementById("pay-amount");
  const pinInput = document.getElementById("pay-pin");
  const refInput = document.getElementById("pay-reference");
  const cancelPay = document.getElementById("cancel-pay");
  const confirmPay = document.getElementById("confirm-pay");
  const paymentMsg = document.getElementById("payment-msg");

  let currentReceiver = null;

  // helper: show feedback
  function setFeedback(msg, isError = false) {
    feedback.textContent = msg || "";
    feedback.style.color = isError ? "var(--danger)" : "var(--muted)";
  }

  // submit search
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const account_number = acctInput.value.trim();
    const ifsc = ifscInput.value.trim();

    // Validate inputs
    if (!account_number || !ifsc) {
      setFeedback("Please enter account number and IFSC", true);
      console.log("Form Validation Failed: Missing account number or IFSC");
      return;
    }

    setFeedback("Searching…");
    resultsBox.innerHTML = "";

    // Debug the data being sent
    console.log("Searching with account number:", account_number, "IFSC:", ifsc);

    try {
      const res = await fetch(`${API_BASE}/bank/search/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token() ? { Authorization: `Token ${token()}` } : {}),
        },
        body: JSON.stringify({ account_number, ifsc }),
      });

      console.log("DEBUG response status:", res.status); // Log response status
      console.log("DEBUG response headers:", res.headers); // Log headers
      console.log("DEBUG response body:", res.body); // Log response body for debugging

      // Check if the response is OK
      if (!res.ok) {
        const data = await res.json();
        setFeedback(data.detail || "Search failed", true);
        console.log("Error response:", data); // Log the error response from the backend
        return;
      }

      // Parse JSON response
      const data = await res.json();
      console.log("DEBUG data:", data); // Log the response data to see the structure

      if (!Array.isArray(data) || data.length === 0) {
        setFeedback("No matching bank account found", true);
        console.log("No matching accounts found");
        return;
      }

      // Show results if found
      setFeedback("");
      resultsBox.innerHTML = "";
      data.forEach(renderResultCard);
    } catch (err) {
      console.error("Error during fetch:", err);
      setFeedback("Network error", true);
    }
  });

  function renderResultCard(b) {
    const el = document.createElement("div");
    el.className = "result-card";
    el.innerHTML = `
      <div class="recv-meta">
        <div class="avatar">${(b.holder_name || "R").charAt(0).toUpperCase()}</div>
        <div class="recv-info">
          <div class="name">${escapeHtml(b.holder_name)}</div>
          <div class="meta">${escapeHtml(b.bank_name || "")} • ${escapeHtml(b.branch || "")}</div>
          <div class="meta">Acc: ${escapeHtml(b.account_number)} • IFSC: ${escapeHtml(b.ifsc)}</div>
          <div class="meta">${escapeHtml(b.upi_id || b.email || b.mobile || "")}</div>
        </div>
      </div>
      <div class="recv-actions">

        <button class="btn btn-primary pay">Pay</button>
      </div>
    `;

    // actions
    // el.querySelector(".view").addEventListener("click", () => openReceiverModal(b));
    // el.querySelector(".add").addEventListener("click", () => addBankAsPayee(b.id));
    el.querySelector(".pay").addEventListener("click", () => { openReceiverModal(b); openPaymentModal(); });
    resultsBox.appendChild(el);
  }
async function loadBanks() {
  const sel = document.getElementById("bank-select");

  sel.innerHTML = `<option>Loading...</option>`;
const token = localStorage.getItem('gapytoken');
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
  // open receiver modal and populate
  function openReceiverModal(b) {
    currentReceiver = b;
    recvName.textContent = b.holder_name;
    recvBank.textContent = `${b.bank_name || ""} • ${b.branch || ""}`;
    recvAcc.textContent = `Acc: ${b.account_number}  •  IFSC: ${b.ifsc}`;
    recvUpi.textContent = b.upi_id || b.email || b.mobile || "";
    recvAvatar.textContent = (b.holder_name || "R").charAt(0).toUpperCase();
    recvModal.classList.remove("hidden");
  }

  // open payment modal and populate
  function openPaymentModal() {
    amtInput.value = "";
    pinInput.value = "";
    refInput.value = `Payment to ${currentReceiver ? currentReceiver.holder_name : ""}`;
    paymentMsg.textContent = "";
    payModal.classList.remove("hidden");
  }

  closeRecv.addEventListener("click", () => { recvModal.classList.add("hidden"); });
  closePay.addEventListener("click", () => payModal.classList.add("hidden"));
  cancelPay.addEventListener("click", () => payModal.classList.add("hidden"));

  // confirm payment
  confirmPay.addEventListener("click", async () => {
    paymentMsg.textContent = "";
    const amount = amtInput.value.trim();
    const pin = pinInput.value.trim();
    const reference = refInput.value.trim();
    if (!amount || Number(amount) <= 0) { paymentMsg.textContent = "Enter a valid amount"; return; }
    if (!pin || pin.length < 4) { paymentMsg.textContent = "Enter your 4-digit PIN"; return; }
    if (!currentReceiver) { paymentMsg.textContent = "Receiver not selected"; return; }
    const bank_id = document.getElementById("bank-select");
    selectedAccountNumber=bank_id.value;
    confirmPay.disabled = true;
    confirmPay.textContent = "Processing…";
    try {
      const payload = { payee_id: currentReceiver.id, amount: amount, pin: pin, reference: reference,id:selectedAccountNumber };
      const res = await fetch(`${API_BASE}/transactions/make/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token() ? { "Authorization": `Token ${token()}` } : {}) },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        paymentMsg.textContent = data.detail || "Transaction failed";
        confirmPay.disabled = false;
        confirmPay.textContent = "Confirm & Send";
        return;
      }
      // success
      paymentMsg.textContent = "Transaction successful";
      // update balance display (optimistic)
      const balElem = document.getElementById("balance-amt");
      if (balElem) {
        const cur = Number(balElem.textContent || 0);
        balElem.textContent = (cur - Number(amount)).toFixed(2);
      }
      // small success animation & close after short delay
      confirmPay.textContent = "Success!";
      setTimeout(() => { payModal.classList.add("hidden"); confirmPay.disabled = false; confirmPay.textContent = "Confirm & Send"; }, 900);
    } catch (err) {
      console.error(err);
      paymentMsg.textContent = "Network error";
      confirmPay.disabled = false;
      confirmPay.textContent = "Confirm & Send";
    }
  });

  // Esc closes modals
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { recvModal.classList.add("hidden"); payModal.classList.add("hidden"); }
  });

  // simple html-escape helper to avoid injection
  function escapeHtml(s) {
    if (!s && s !== 0) return "";
    return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }
});


//   // add bank as payee (POST -> /api/bank/add_saved/)
//   async function addBankAsPayee(bankId) {
//     try {
//       console.log("Adding bank as payee with ID:", bankId);
//       const res = await fetch(`${API_BASE}/bank/add_saved/`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", ...(token() ? { "Authorization": `Token ${token()}` } : {}) },
//         body: JSON.stringify({ bank_account_id: bankId }),
//       });
//       const data = await res.json();
//       if (!res.ok) {
//         alert(data.detail || "Could not add to saved payees");
//         return;
//       }
//       alert("Added to saved payees");
//     } catch (err) {
//       console.error("Error during adding payee:", err);
//       alert("Network error");
//     }
//   }


