// =============================
// Gapy Dashboard JS (Updated)
// =============================
const API_BASE = "https://payment-application-based-on-upi-backend-12jg.onrender.com/api";
const addBankModal = new bootstrap.Modal(document.getElementById('addBankModal'));
const popup = document.getElementById("popup");
const score = document.getElementById("score");

// ----------- UI ELEMENTS -----------
const welcomeText = document.getElementById('welcome-text');
const welcomeSub = document.getElementById('welcome-sub');
const ownerName = document.getElementById('owner-name');
 
const topProfileName = document.getElementById('top-profile-name');
const sideProfileName = document.getElementById('side-profile-name');

const openAddBtn = document.getElementById('open-add-bank');
const addBankForm = document.getElementById('add-bank-form');
const bankMsg = document.getElementById('bank-msg');
const linkedBanksDiv = document.getElementById('linked-banks');

const transientBanner = document.getElementById('transientBanner');
function showTransient(msg, timeout = 4000) {
  if (!transientBanner) return;
  transientBanner.textContent = msg;
  transientBanner.style.display = 'block';
  setTimeout(() => (transientBanner.style.display = 'none'), timeout);
}

// --- Balance elements ---
const userBalanceEl = document.getElementById('user-balance');
const addMoneyBtn = document.getElementById('add-money-btn');

// =============================
// BANK HANDLING
// =============================
openAddBtn.addEventListener('click', () => {
  bankMsg.textContent = '';
  addBankForm.reset();
  addBankModal.show();
});

function setBankMsg(txt, bad = false) {
  bankMsg.textContent = txt;
  bankMsg.style.color = bad ? '#d9534f' : '#28a745';
  setTimeout(() => (bankMsg.textContent = ''), 5000);
}

async function getProfile() {
  const token = localStorage.getItem('gapytoken');
  if (!token) {
    window.location.href = 'index.html';
    return null;
  }

  const res = await fetch(`${API_BASE}/account/`, {
    headers: { Authorization: `Token ${token}` },
  });

  if (!res.ok) {
    localStorage.removeItem('gapytoken');
    window.location.href = 'index.html';
    return null;
  }

  return await res.json();
}

// ============ LOAD LINKED BANKS ============
async function loadBanks() {
  

  const token = localStorage.getItem('gapytoken');
  const res = await fetch(`${API_BASE}/banks/`, {
    headers: { Authorization: `Token ${token}` },
  });

  if (!res.ok) {
    linkedBanksDiv.innerHTML = '<p class="text-muted small">No linked banks.</p>';
    return;
  }

  const data = await res.json();

  if (Array.isArray(data) && !data.length) {
    linkedBanksDiv.innerHTML =
      '<p class="text-muted small">No linked banks yet.</p>';
    return;
  }

  // Handle both: existing bank list OR single { message, bank } response
  const banks = Array.isArray(data) ? data : data.bank ? [data.bank] : [];

  linkedBanksDiv.innerHTML = '';
  banks.forEach((b) => {
    const el = document.createElement('div');
    el.className = 'bank-card';
    el.innerHTML = `
      <div class="bank-left">
        <div><i class="fa fa-university fa-lg text-muted"></i></div>
        <div>
          <div><strong>${b.bank_name}</strong> • ${b.branch || ''}</div>
          <div class="small text-muted">${b.holder_name} • ****${b.account_number.slice(
      -4
    )}</div>
        </div>
      </div>
      <div class="text-end">
        <div class="upi-badge">${b.upi_id}</div>
        <div class="small text-muted">${new Date(
          b.created_at
        ).toLocaleString()}</div>
      </div>
    `;
    linkedBanksDiv.appendChild(el);
  });
}

// ============ ADD NEW BANK ============
addBankForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const holder = document.getElementById('bank-holder').value.trim();
  const bank = document.getElementById('bank-name').value.trim();
  const branch = document.getElementById('bank-branch').value.trim();
  const acc = document.getElementById('bank-account').value.trim();
  const accc = document.getElementById('bank-account-confirm').value.trim();
  const ifsc = document.getElementById('bank-ifsc').value.trim();
  const mobile = document.getElementById('bank-mobile').value.trim();
    const initialpin = document.getElementById("initial-pin").value.trim();
    const pin = document.getElementById("confirm-pin").value.trim();
  if (!holder || !bank || !acc || !accc || !ifsc || !initialpin || !pin) {
    setBankMsg('Please fill required fields', true);
    return;
  }
  if (acc !== accc) {
    setBankMsg('Account numbers do not match', true);
    return;
  }
    if (pin !== initialpin) {
      bankMsg.textContent = "PIN numbers do not match";
      return;
    }
  const payload = {
    holder_name: holder,
    bank_name: bank,
    branch,
    account_number: acc,
    ifsc,
    mobile,
    pin
  };

  const token = localStorage.getItem('gapytoken');
  try {
    const res = await fetch(`${API_BASE}/banks/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log(data)
    if (res.status === 200 && data.bank) {
      
      setBankMsg('Account already linked. Showing existing details.');
      addBankModal.hide();
      loadBanks();
    } else if (res.status === 201) {
      setBankMsg('Bank added successfully');
      addBankModal.hide();
      loadBanks();
    } else {
      setBankMsg(data.error || JSON.stringify(data), true);
    }
     const modalEl = document.getElementById('addBankModal');
    const bs = bootstrap.Modal.getInstance(modalEl);
    if (bs) bs.hide();
    // small delay so modal animate out nicely
    setTimeout(()=> {
      // Optionally set a flag (useful for other tabs)
      localStorage.setItem('gapy_bank_added', '1');
      // reload the page so window.load handler picks up new banks
      window.location.reload();
    }, 300);

  } catch (err) {
    setBankMsg('Network error', true);
  }
});


// =============================
// BALANCE (DUMMY WALLET SYSTEM)
// =============================
async function fetchBalance() {
  const token = localStorage.getItem('gapytoken');
  try {
    const res = await fetch(`${API_BASE}/balance/`, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    if (userBalanceEl) {
      userBalanceEl.textContent = parseFloat(data.balance).toFixed(2);
    }
  } catch (err) {
    console.error('Failed to load balance', err);
  }
}

async function addDummyMoney(amount = 1000) {
  const token = localStorage.getItem('gapytoken');
  try {
    const res = await fetch(`${API_BASE}/add-balance/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${token}`,
      },
      body: JSON.stringify({ amount }),
    });
    const data = await res.json();
    if (res.ok) {
      alert(data.message);
      fetchBalance();
    } else {
      alert(data.error || 'Failed to add money');
    }
  } catch (err) {
    alert('Network error');
  }
}

if (addMoneyBtn) {
  addMoneyBtn.addEventListener('click', () => {
    addDummyMoney(1000); // adds ₹1000 dummy amount
  });
}
// quick add buttons (optional)
const quickAdd100 = document.getElementById('quick-add-100');
const quickAdd500 = document.getElementById('quick-add-500');

if (quickAdd100) quickAdd100.addEventListener('click', () => addDummyMoney(100));
if (quickAdd500) quickAdd500.addEventListener('click', () => addDummyMoney(500));


// =============================
// VALIDATION — PREVENT PAY WITHOUT BANK
// =============================
async function checkBankLinked() {
  const token = localStorage.getItem('gapytoken');
  const res = await fetch(`${API_BASE}/banks/`, {
    headers: { Authorization: `Token ${token}` },
  });
  if (!res.ok) return false;
  const data = await res.json();
  return Array.isArray(data) && data.length > 0;
}

// Example function (used later for payment actions)
async function proceedToPay() {
  const hasBank = await checkBankLinked();
  if (!hasBank) {
    alert('⚠️ Please add a bank account before proceeding with payments.');
    openAddBtn.click(); // open add bank modal automatically
    return;
  }
  alert('✅ Proceed to payment screen (coming soon)');
}

// =============================
// PAGE LOAD
// =============================
window.addEventListener('load', async () => {
  const profile = await getProfile();
  if (!profile) return;

  welcomeText.textContent = `Welcome, ${profile.username}`;
  ownerName.textContent = profile.username;
  // document.getElementById("avatarCircle").textContent = profile.username;
  welcomeSub.textContent = new Date().toLocaleDateString();
  topProfileName.textContent = profile.username;
  sideProfileName.textContent = profile.username;

  await fetchBalance();
  await loadBanks();
});
// const fPayTile = document.getElementById('f-pay');
// if (fPayTile) {
//   fPayTile.style.cursor = 'pointer';
//   fPayTile.addEventListener('click', () => {
//     window.location.href = '/payanyone.html';
//   });
// }
// const fPaytiles = document.getElementById('f-bank');
// if (fPaytiles) {
//   fPaytiles.style.cursor = 'pointer';
//   fPaytiles.addEventListener('click', () => {
//     window.location.href = '/banktransfer.html';
//   });
// }

document.addEventListener('DOMContentLoaded', () => {
  const fPayTile = document.getElementById('f-pay');
  if (fPayTile) {
    fPayTile.style.cursor = 'pointer';
    fPayTile.addEventListener('click', () => {
      window.location.href = '/payanyone.html';
    });
  }

  const fBankTile = document.getElementById('f-bank');
  if (fBankTile) {
    fBankTile.style.cursor = 'pointer';
    fBankTile.addEventListener('click', () => {
      window.location.href = '/banktransfer.html';
    });
  }

  const fScan = document.getElementById('f-scan');
if (fScan) { fScan.addEventListener('click', () => window.location.href = '/scanqr.html'); }

const fmobile = document.getElementById('f-mobile');
if(fmobile){
    fmobile.addEventListener('click',()=>{
        window.location.href = '/recharge.html'
    })
}
const fbill = document.getElementById('f-bill');
if(fbill){
    fbill.addEventListener('click',()=>{
        window.location.href = '/billpayments.html'
    })
}

});

// const profilechange = document.getElementById('profile-change');
// if(profilechange){
//   profilechange.addEventListener("click",()=>{
//     window.location.href = '/profile.html'
//   })
// }


document.addEventListener("DOMContentLoaded", () => {
  const profilechange = document.getElementById('profile-change');
  if (profilechange) {
    profilechange.addEventListener("click", () => {
      window.location.href = 'profile.html';
    });
  }
});