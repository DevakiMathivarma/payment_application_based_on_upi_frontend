// =============================
// Gapy Frontend JS (Updated — redirect to dashboard)
// =============================

const API_BASE = "https://payment-application-based-on-upi-backend-12jg.onrender.com/api"; // Backend API URL

// ----------- UI Elements ------------
const tabSignIn = document.getElementById('tab-signin');
const tabRegister = document.getElementById('tab-register');
const containerSignin = document.getElementById('container-signin');
const containerRegister = document.getElementById('container-register');
const message = document.getElementById('message');

// ========== Smooth Form Switch ==========
function switchToSignIn() {
  tabSignIn.classList.add('active');
  tabRegister.classList.remove('active');

  containerRegister.classList.add('hidden');
  containerRegister.classList.remove('show');

  setTimeout(() => {
    containerSignin.classList.remove('hidden');
    containerSignin.classList.add('show');
  }, 200);
}

function switchToRegister() {
  tabRegister.classList.add('active');
  tabSignIn.classList.remove('active');

  containerSignin.classList.add('hidden');
  containerSignin.classList.remove('show');

  setTimeout(() => {
    containerRegister.classList.remove('hidden');
    containerRegister.classList.add('show');
  }, 200);
}

tabSignIn.addEventListener('click', switchToSignIn);
tabRegister.addEventListener('click', switchToRegister);

// ----------- Helper: Show Message -----------
function setMessage(text, ok = true) {
  if (!message) return;
  message.textContent = text;
  message.style.color = ok ? '#333' : '#d9534f';
  message.style.opacity = 1;
  setTimeout(() => {
    if (message) message.style.opacity = 0;
  }, 6000);
}

/* =====================================
   REGISTER USER
===================================== */
const regForm = document.getElementById('register-form');
if (regForm) {
  regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      username: document.getElementById('reg-username').value.trim(),
      email: document.getElementById('reg-email').value.trim(),
      password: document.getElementById('reg-password').value,
      confirm_password: document.getElementById('reg-confirm-password').value,
      pin: document.getElementById('reg-pin').value,
      confirm_pin: document.getElementById('reg-confirm-pin').value,
    };

    try {
      const res = await fetch(`${API_BASE}/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || JSON.stringify(data), false);
      } else {
        setMessage(data.message || 'Registered successfully! Please login to continue.');
        // Smoothly switch back to login form
        switchToSignIn();
      }
    } catch (err) {
      setMessage('Network error. Please try again.', false);
    }
  });
}

/* =====================================
   LOGIN (USERNAME + PASSWORD)
   -> on success: store token & redirect to dashboard.html
===================================== */
const signinForm = document.getElementById('signin-form');
if (signinForm) {
  signinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      username: document.getElementById('signin-username').value.trim(),
      password: document.getElementById('signin-password').value,
    };

    try {
      const res = await fetch(`${API_BASE}/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || JSON.stringify(data), false);
      } else {
        localStorage.setItem('gapytoken', data.token);
        setMessage('Login successful. Redirecting to dashboard...');
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 600);
      }
    } catch (err) {
      setMessage('Network error. Please try again.', false);
    }
  });
}

/* =====================================
   PIN LOGIN (Optional)
   -> on success: store token & redirect to dashboard.html
===================================== */
const pinForm = document.getElementById('pin-login-form');
if (pinForm) {
  pinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      username: document.getElementById('pin-username').value.trim(),
      pin: document.getElementById('pin-input').value,
    };

    try {
      const res = await fetch(`${API_BASE}/pin-login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || JSON.stringify(data), false);
      } else {
        localStorage.setItem('gapytoken', data.token);
        setMessage('PIN login successful. Redirecting to dashboard...');
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 600);
      }
    } catch (err) {
      setMessage('Network error. Please try again.', false);
    }
  });
}

/* =====================================
   Helper: fetch account/profile with token
===================================== */
async function fetchAccount() {
  const token = localStorage.getItem('gapytoken');
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/account/`, {
      headers: { 'Authorization': `Token ${token}` }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

/* =====================================
   AUTO LOGIN CHECK (on index page)
   -> if token is valid, go to dashboard.html directly
===================================== */
window.addEventListener('load', async () => {
  // only run auto-redirect on the index/login page
  // (if you're already on dashboard.html, this file should not be loaded)
  const token = localStorage.getItem('gapytoken');
  if (token) {
    const profile = await fetchAccount();
    if (profile) {
      // valid token: redirect to dashboard
      window.location.href = 'dashboard.html';
    } else {
      // invalid token: remove it
      localStorage.removeItem('gapytoken');
    }
  }
});
