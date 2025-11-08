// ==========================================
// Gapy — Profile Page JS (updated)
// ==========================================
const API_BASE = "https://payment-application-based-on-upi-backend-12jg.onrender.com/api";
const token = localStorage.getItem("gapytoken");

// -----------------------------
// Element references
// -----------------------------
const tabs = document.querySelectorAll(".nav-link");
const panes = document.querySelectorAll(".tab-pane");

const infoName = document.getElementById("info-name");
const infoEmail = document.getElementById("info-email");
const infoJoined = document.getElementById("info-joined");
const infoBanks = document.getElementById("info-banks");
const bankList = document.getElementById("bankList");

const editBtn = document.getElementById("editProfileBtn");
const saveBtn = document.getElementById("saveProfileBtn");
const cancelBtn = document.getElementById("cancelEditBtn");

const myBanksAddBtn = document.getElementById("myBanksAddBtn");
const addBankModalEl = document.getElementById("addBankModal");
const addBankForm = document.getElementById("add-bank-form");
const bankMsg = document.getElementById("bank-msg");

const logoutBtn = document.getElementById("logoutBtn");

const oldPass = document.getElementById("oldPass");
const newPass = document.getElementById("newPass");
const confirmPass = document.getElementById("confirmPass");
const changePassBtn = document.getElementById("changePassBtn");
const passMsg = document.getElementById("passMsg");

const oldPin = document.getElementById("oldPin");
const newPin = document.getElementById("newPin");
const confirmPin = document.getElementById("confirmPin");
const changePinBtn = document.getElementById("changePinBtn");
const pinMsg = document.getElementById("pinMsg");

// safe guards
if (!token) {
  // not logged in
  // optionally redirect
  // window.location.href = "index.html";
  console.warn("No gapytoken found in localStorage");
}

// -----------------------------
// Tabs
// -----------------------------
tabs.forEach(tab => {
  tab.addEventListener("click", e => {
    tabs.forEach(t => t.classList.remove("active"));
    e.target.classList.add("active");
    const target = e.target.getAttribute("data-target");
    panes.forEach(p => p.classList.remove("show", "active"));
    document.querySelector(target).classList.add("show", "active");
  });
});

// -----------------------------
// Helpers
// -----------------------------
function headersJson() {
  return {
    "Content-Type": "application/json",
    "Authorization": `Token ${token}`
  };
}
function showAlert(msg) { alert(msg); }
function setElemEditable(editable) {
  if (editable) {
    infoName.disabled = false;
    infoName.classList.add("editable");
    editBtn.style.display = "none";
    saveBtn.style.display = "";
    cancelBtn.style.display = "";
    infoName.focus();
  } else {
    infoName.disabled = true;
    infoName.classList.remove("editable");
    editBtn.style.display = "";
    saveBtn.style.display = "none";
    cancelBtn.style.display = "none";
  }
}

// -----------------------------
// Load Profile Info (GET /api/profile/info/)
// -----------------------------
async function loadProfileInfo() {
  try {
    const res = await fetch(`${API_BASE}/profile/info/`, { headers: { Authorization: `Token ${token}` }});
    if (!res.ok) throw new Error("Failed to load profile");
    const data = await res.json();
    // UI fields
    // Use username as full name fallback; if you want to split to first/last, backend should provide them
    infoName.value = data.username || "";
    infoEmail.value = data.email || "";
    infoJoined.value = data.joined || "";
    infoBanks.value = data.banks_count ?? 0;
  } catch (err) {
    console.error("Error loading profile:", err);
  }
}

// -----------------------------
// Profile update (PATCH /api/profile/)
// -----------------------------
async function saveProfile() {
  // we send partial update (PATCH)
  const full = infoName.value.trim();
  let first_name = full, last_name = "";
  if (full.includes(" ")) {
    const parts = full.split(" ");
    first_name = parts.shift();
    last_name = parts.join(" ");
  }
  const payload = { first_name, last_name };

  try {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
    const res = await fetch(`${API_BASE}/profile/`, {
      method: "PATCH",
      headers: headersJson(),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(()=>({}));
    if (!res.ok) {
      showAlert("Failed to save profile: " + (data.error || JSON.stringify(data)));
      saveBtn.disabled = false;
      saveBtn.textContent = "Save";
      return;
    }
    // success - reload and turn off edit
    await loadProfileInfo();
    setElemEditable(false);
    saveBtn.disabled = false;
    saveBtn.textContent = "Save";
    showAlert("Profile updated");
  } catch (err) {
    console.error("Save profile error", err);
    showAlert("Network error while saving");
    saveBtn.disabled = false;
    saveBtn.textContent = "Save";
  }
}

// -----------------------------
// Banks: load (GET), add (POST), delete (DELETE)
// -----------------------------
async function loadBanks() {
  try {
    const res = await fetch(`${API_BASE}/banks/`, { headers: { Authorization: `Token ${token}` }});
    if (!res.ok) {
      bankList.innerHTML = `<div class="text-muted small text-center">No banks linked yet.</div>`;
      return;
    }
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) {
      bankList.innerHTML = `<div class="text-muted small text-center">No banks linked yet.</div>`;
      return;
    }
    bankList.innerHTML = "";
    data.forEach(bank => {
      const card = document.createElement("div");
      card.className = "bank-card";
      // safeties for missing fields
      const accNumber = bank.account_number || "";
      const upi = bank.upi_id || "";
      const created = bank.created_at ? new Date(bank.created_at).toLocaleDateString() : "";
      card.innerHTML = `
        <div>
          <div class="bank-name">${escapeHtml(bank.bank_name)}</div>
          <div class="bank-meta">${escapeHtml(bank.holder_name)} • ****${accNumber.slice(-4)}</div>
        </div>
        <div class="text-end">
          <div class="upi-badge">${escapeHtml(upi)}</div>
          <div class="mt-2">
            <button class="btn btn-sm btn-outline-primary me-2 check-balance" data-id="${bank.id}">Check Balance</button>
            <button class="btn btn-sm btn-outline-danger delete-bank" data-id="${bank.id}">Delete</button>
          </div>
        </div>
      `;
      bankList.appendChild(card);
    });

    // Attach handlers after DOM built
    bankList.querySelectorAll(".delete-bank").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = btn.dataset.id;
        if (!confirm("Delete this linked bank?")) return;
        try {
          const resp = await fetch(`${API_BASE}/banks/${id}/`, {
            method: "DELETE",
            headers: { Authorization: `Token ${token}` }
          });
          if (resp.ok) {
            showAlert("Bank removed");
            await loadBanks();
            await loadProfileInfo();
          } else {
            const d = await resp.json().catch(()=>({}));
            showAlert("Failed to delete: " + (d.detail || JSON.stringify(d)));
          }
        } catch (err) {
          console.error("Delete bank error", err);
          showAlert("Network error");
        }
      });
    });

    // bankList.querySelectorAll(".check-balance").forEach(btn => {
    //   btn.addEventListener("click", async (e) => {
    //     const id = btn.dataset.id;
    //     // call bank detail endpoint if exists
    //     try {
    //       const r = await fetch(`${API_BASE}/banks/?account_number=&bank_name=&id=${id}`, { headers: { Authorization: `Token ${token}` }});
    //       // simpler: call bank detail endpoint (we will supply /api/banks/<id>/ in backend changes)
    //       const rr = await fetch(`${API_BASE}/banks/${id}/`, { headers: { Authorization: `Token ${token}` }});
    //       if (rr.ok) {
    //         const det = await rr.json();
    //         alert(`Balance for ${det.bank_name}: ₹${Number(det.amount || 0).toFixed(2)}`);
    //       } else {
    //         showAlert("Unable to fetch balance for this account");
    //       }
    //     } catch (err) {
    //       console.error(err);
    //       showAlert("Network error");
    //     }
    //   });
    // });
    bankList.querySelectorAll(".check-balance").forEach(btn => {
  btn.addEventListener("click", async () => {
    const id = btn.dataset.id;
    
    // 1) Ask PIN (simple prompt as you requested)
    const pin = (prompt("Enter your 4-digit transaction PIN") || "").trim();
    if (!/^\d{4}$/.test(pin)) {
      showAlert("Please enter a valid 4-digit PIN.");
      return;
    }

    // 2) Verify PIN with server
    try {
        console.log(id)
      const payload = { id,pin };
      const verifyRes = await fetch(`${API_BASE}/bank/verify-pin/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Token ${token}`
        },
        body: JSON.stringify({ payload })
      });

      if (!verifyRes.ok) {
        // optional: read server message
        let msg = "PIN verification failed.";
        try {
          const j = await verifyRes.json();
          if (j && (j.detail || j.message)) msg = j.detail || j.message;
        } catch (_) {}
        showAlert(msg);
        return;
      }
    } catch (err) {
      console.error(err);
      showAlert("Network error while verifying PIN.");
      return;
    }

    // 3) PIN verified → fetch balance
    try {
      // prefer detail endpoint
      const rr = await fetch(`${API_BASE}/banks/${id}/`, {
        headers: { Authorization: `Token ${token}` }
      });

      if (rr.ok) {
        const det = await rr.json();
        alert(`Balance for ${det.bank_name}: ₹${Number(det.amount || 0).toFixed(2)}`);
      } else {
        showAlert("Unable to fetch balance for this account.");
      }
    } catch (err) {
      console.error(err);
      showAlert("Network error while fetching balance.");
    }
  });
});


  } catch (err) {
    console.error("Error loading banks:", err);
    bankList.innerHTML = `<div class="text-danger small text-center">Error loading banks.</div>`;
  }
}

// -----------------------------
// Add bank (POST /api/banks/)
// -----------------------------
myBanksAddBtn && myBanksAddBtn.addEventListener("click", () => {
  const modal = new bootstrap.Modal(addBankModalEl);
  bankMsg.textContent = "";
  addBankForm.reset();
  modal.show();
});

if (addBankForm) {
  addBankForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    bankMsg.textContent = "";
    const holder = document.getElementById("bank-holder").value.trim();
    const bank = document.getElementById("bank-name").value.trim();
    const branch = document.getElementById("bank-branch").value.trim();
    const acc = document.getElementById("bank-account").value.trim();
    const accc = document.getElementById("bank-account-confirm").value.trim();
    const ifsc = document.getElementById("bank-ifsc").value.trim();
    const mobile = document.getElementById("bank-mobile").value.trim();
    const initialpin = document.getElementById("initial-pin").value.trim();
    const pin = document.getElementById("confirm-pin").value.trim();
    if (!holder || !bank || !acc || !accc || !ifsc || !initialpin || !pin) {
      bankMsg.textContent = "Please fill required fields";
      return;
    }
    if (acc !== accc) {
      bankMsg.textContent = "Account numbers do not match";
      return;
    }
    if (pin !== initialpin) {
      bankMsg.textContent = "PIN numbers do not match";
      return;
    }
    const payload = { holder_name: holder, bank_name: bank, branch, account_number: acc, ifsc, mobile,pin };

    try {
      const res = await fetch(`${API_BASE}/banks/`, {
        method: "POST",
        headers: headersJson(),
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(()=>({}));
      if (res.status === 201) {
        // close modal and refresh
        bootstrap.Modal.getInstance(addBankModalEl).hide();
        await loadBanks();
        await loadProfileInfo();
        showAlert("Bank added successfully");
      } else if (res.status === 200 && data.bank) {
        bootstrap.Modal.getInstance(addBankModalEl).hide();
        await loadBanks();
        await loadProfileInfo();
        showAlert("This account is already linked to your profile.");
      } else {
        bankMsg.textContent = data.detail || data.error || JSON.stringify(data);
      }
    } catch (err) {
      console.error("Add bank error", err);
      bankMsg.textContent = "Network error";
    }
  });
}

// -----------------------------
// Change password
// -----------------------------
changePassBtn && changePassBtn.addEventListener("click", async () => {
  passMsg.textContent = "";
  const oldP = oldPass.value.trim();
  const newP = newPass.value.trim();
  const confP = confirmPass.value.trim();
  if (!oldP || !newP || !confP) { passMsg.textContent = "Please fill all fields"; passMsg.style.color = "red"; return; }
  if (newP !== confP) { passMsg.textContent = "Passwords do not match"; passMsg.style.color = "red"; return; }
  try {
    const res = await fetch(`${API_BASE}/profile/change-password/`, {
      method: "POST",
      headers: headersJson(),
      body: JSON.stringify({ old_password: oldP, new_password: newP })
    });
    const d = await res.json().catch(()=>({}));
    if (res.ok) {
      passMsg.textContent = d.message || "Password updated";
      passMsg.style.color = "green";
      oldPass.value = newPass.value = confirmPass.value = "";
    } else {
      passMsg.textContent = d.error || JSON.stringify(d);
      passMsg.style.color = "red";
    }
  } catch (err) {
    passMsg.textContent = "Network error";
    passMsg.style.color = "red";
  }
});

// -----------------------------
// Change login PIN (server-side pin_hash for login)
// -----------------------------
changePinBtn && changePinBtn.addEventListener("click", async () => {
  pinMsg.textContent = "";
  const oldP = oldPin.value.trim();
  const newP = newPin.value.trim();
  const confP = confirmPin.value.trim();
  if (!oldP || !newP || !confP) { pinMsg.textContent = "Please fill all fields"; pinMsg.style.color = "red"; return; }
  if (newP.length !== 4) { pinMsg.textContent = "PIN must be 4 digits"; pinMsg.style.color = "red"; return; }
  if (newP !== confP) { pinMsg.textContent = "PINs do not match"; pinMsg.style.color = "red"; return; }
  try {
    const res = await fetch(`${API_BASE}/profile/change-pin/`, {
      method: "POST",
      headers: headersJson(),
      body: JSON.stringify({ old_pin: oldP, new_pin: newP })
    });
    const d = await res.json().catch(()=>({}));
    if (res.ok) {
      pinMsg.textContent = d.message || "PIN updated";
      pinMsg.style.color = "green";
      oldPin.value = newPin.value = confirmPin.value = "";
    } else {
      pinMsg.textContent = d.error || JSON.stringify(d);
      pinMsg.style.color = "red";
    }
  } catch (err) {
    pinMsg.textContent = "Network error";
    pinMsg.style.color = "red";
  }
});

// -----------------------------
// Logout
// -----------------------------
logoutBtn && logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("gapytoken");
  localStorage.removeItem("gapy_txpin"); // clear demo tx pin if stored
  window.location.href = "index.html";
});

// -----------------------------
// Edit / Save / Cancel handlers
// -----------------------------
if (editBtn) {
  editBtn.addEventListener("click", () => setElemEditable(true));
}
if (cancelBtn) {
  cancelBtn.addEventListener("click", async () => {
    setElemEditable(false);
    await loadProfileInfo();
  });
}
if (saveBtn) {
  saveBtn.addEventListener("click", saveProfile);
}

// -----------------------------
// Utility escape
// -----------------------------
function escapeHtml(s) {
  if (s === undefined || s === null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// -----------------------------
// On load
// -----------------------------
window.addEventListener("DOMContentLoaded", async () => {
  if (!token) { window.location.href = "index.html"; return; }
  await loadProfileInfo();
  await loadBanks();
  // Setup profile sidebar click (if present)
  const profilechange = document.getElementById('profile-change');
  if (profilechange) { profilechange.style.cursor = 'pointer'; profilechange.addEventListener('click', ()=> window.location.href = 'profile.html'); }
});

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");

  if (tab === "banks") {
    // example: open banks tab
    document.getElementById("banks-tab").classList.add("active");
    document.getElementById("banks-section").style.display = "block";
  }
});
