// scanqr.js (jsQR replacement - simple library change)
document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://payment-application-based-on-upi-backend-12jg.onrender.com/api";
  const token = () => localStorage.getItem("gapytoken");

  const resultBox = document.getElementById("scan-result");
  const recentInfo = document.getElementById("recent-info");

  // modal elements
  const payModal = document.getElementById("pay-modal");
  const closePay = document.getElementById("close-pay");
  const payAmount = document.getElementById("pay-amount");
  const payPin = document.getElementById("pay-pin");
  const payRef = document.getElementById("pay-ref");
  const payConfirm = document.getElementById("pay-confirm");
  const payCancel = document.getElementById("pay-cancel");
  const payMsg = document.getElementById("pay-msg");
  const pmTitle = document.getElementById("pm-title");
  const pmTarget = document.getElementById("pm-target");

  let currentReceiver = null;

  // helpers
  function show(el) { if(el) el.classList.remove("hidden"); }
  function hide(el) { if(el) el.classList.add("hidden"); }
  function setFeedback(msg) { if (resultBox) { resultBox.textContent = msg; show(resultBox); } }

  hide(payModal);

  // ---- jsQR loader ----
  async function ensureJsQR() {
    if (window.jsQR) return window.jsQR;
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
      s.onload = () => window.jsQR ? resolve(window.jsQR) : reject(new Error("jsQR failed to load"));
      s.onerror = () => reject(new Error("Failed to load jsQR"));
      document.head.appendChild(s);
    });
  }

  // ---- video + canvas setup ----
  const readerContainer = document.getElementById("reader");
  const video = document.createElement("video");
  video.setAttribute("playsinline", "true");
  video.id = "qr-video";
  video.style.width = "100%";
  if (readerContainer) readerContainer.appendChild(video);
  else document.body.appendChild(video);

  const canvas = document.createElement("canvas");
  canvas.id = "qr-canvas";
  canvas.style.display = "none";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  let mediaStream = null;
  let scanning = false;
  let rafId = null;
  let lastTime = 0;
  const SCAN_INTERVAL = 150; // ms

  // ---- camera control ----
  async function startCameraScanner() {
    try {
      await ensureJsQR();
    } catch (err) {
      console.error("jsQR load failed:", err);
      setFeedback("Failed to load QR library");
      return;
    }
    if (scanning) return;
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      video.srcObject = mediaStream;
      await video.play();
      scanning = true;
      lastTime = performance.now();
      rafId = requestAnimationFrame(tick);
    } catch (err) {
      console.error("Camera start failed:", err);
      setFeedback("Cannot access camera — allow permissions or use upload.");
    }
  }

  async function stopCameraScanner() {
    scanning = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    try { video.pause(); } catch(_) {}
    try { video.srcObject = null; } catch(_) {}
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      mediaStream = null;
    }
  }

  // ---- frame processing loop ----
  async function tick(now) {
    if (!scanning) return;
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafId = requestAnimationFrame(tick);
      return;
    }

    if (now - lastTime >= SCAN_INTERVAL) {
      lastTime = now;

      // set canvas to video size
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = window.jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          await stopCameraScanner();
          await handleDecoded(code.data);
          return;
        }
      } catch (err) {
        // sometimes getImageData can throw in odd browser cases; log and continue
        console.warn("Frame decode error:", err);
      }
    }

    rafId = requestAnimationFrame(tick);
  }

  // ---- common decoded handler (uses your original logic) ----
  async function handleDecoded(decodedText) {
    setFeedback("Scanned: " + decodedText);

    let bankId = null;
    try {
      if (typeof decodedText === "string" && decodedText.startsWith("gapy://")) {
        const temp = decodedText.replace("gapy://", "https://dummy/");
        const u = new URL(temp);
        bankId = u.searchParams.get("bank_id");
      } else {
        const j = JSON.parse(decodedText);
        bankId = j.bank_id || j.id || null;
      }
    } catch (err) {
      console.warn("QR parse failed", err);
    }

    if (!bankId) {
      setFeedback("Scanned data does not contain bank info");
      try { await startCameraScanner(); } catch(_) {}
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/bank/${bankId}/`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token() ? { "Authorization": `Token ${token()}` } : {}),
        },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ detail: "error" }));
        setFeedback("Receiver not found: " + (d.detail || res.status));
        try { await startCameraScanner(); } catch(_) {}
        return;
      }
      const bank = await res.json();
      currentReceiver = bank;
      recentInfo.innerHTML = `
        <strong>${bank.holder_name}</strong>
        <div class="muted">${bank.bank_name} • ${bank.branch || ""}</div>
        <div class="muted">Acc: ${bank.account_number} • IFSC: ${bank.ifsc}</div>
      `;
      await loadBanks();
      openPaymentModal(bank);
    } catch (err) {
      console.error(err);
      setFeedback("Network error while fetching receiver");
      try { await startCameraScanner(); } catch(_) {}
    }
  }

  // ---- remote decoder fallback helper ----
  async function decodeWithRemote(file) {
    const fd = new FormData();
    fd.append("file", file);
    const url = "https://api.qrserver.com/v1/read-qr-code/";
    const res = await fetch(url, { method: "POST", body: fd });
    if (!res.ok) throw new Error("Remote decode failed: " + res.status);
    const json = await res.json();
    for (const item of json) {
      if (item && item.symbol) {
        for (const sym of item.symbol) {
          if (sym && sym.data) return sym.data;
        }
      }
    }
    return null;
  }

  // ---- replace previous camera init with jsQR-based scanner start ----
  // start scanning automatically
  startCameraScanner();

  // ---- PAYMENT MODAL (kept from your original) ----
  function openPaymentModal(bank) {
    pmTitle.textContent = `Pay ${bank.holder_name}`;
    pmTarget.textContent = `${bank.bank_name} • Acc: ${bank.account_number.slice(-6)} • IFSC: ${bank.ifsc}`;
    payAmount.value = "";
    payPin.value = "";
    payRef.value = `Payment to ${bank.holder_name}`;
    payMsg.textContent = "";
    show(payModal);
  }

  closePay.addEventListener("click", async () => {
    hide(payModal);
    try { await startCameraScanner(); } catch(_) {}
  });

  payCancel.addEventListener("click", async () => {
    hide(payModal);
    try { await startCameraScanner(); } catch(_) {}
  });

  payConfirm.addEventListener("click", async () => {
    payMsg.textContent = "";
    const amount = payAmount.value.trim();
    const bank_id_el = document.getElementById("bank-select");
    const bank_id = bank_id_el ? bank_id_el.value : null;
    const pin = payPin.value.trim();
    const reference = payRef.value.trim();

    if (!amount || Number(amount) <= 0) { payMsg.textContent = "Enter valid amount"; return; }
    if (!pin || pin.length < 4) { payMsg.textContent = "Enter 4-digit PIN"; return; }
    if (!currentReceiver) { payMsg.textContent = "Receiver not selected"; return; }

    payConfirm.disabled = true;
    payConfirm.textContent = "Processing…";

    try {
      const payload = { payee_id: currentReceiver.id, amount, pin, reference, id: bank_id };
      const res = await fetch(`${API_BASE}/transactions/make/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token() ? { "Authorization": `Token ${token()}` } : {}) },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Transaction failed");

      payMsg.style.color = "#3ce49e";
      payMsg.textContent = "Transaction successful ✓";
      setTimeout(async () => {
        hide(payModal);
        payConfirm.disabled = false;
        payConfirm.textContent = "Confirm & Send";
        try { await startCameraScanner(); } catch(_) {}
      }, 900);
    } catch (err) {
      console.error(err);
      payMsg.style.color = "red";
      payMsg.textContent = err.message || "Network error";
      payConfirm.disabled = false;
      payConfirm.textContent = "Confirm & Send";
    }
  });

  // ---- LOAD BANKS (unchanged) ----
  async function loadBanks() {
    const sel = document.getElementById("bank-select");
    if (!sel) return;
    sel.innerHTML = `<option>Loading...</option>`;
    try {
      const res = await fetch(`${API_BASE}/banks/`, {
        headers: { Authorization: `Token ${token()}` },
      });
      const data = await res.json();
      sel.innerHTML = "";
      data.forEach((bank) => {
        const opt = document.createElement("option");
        opt.value = bank.id;
        opt.textContent = `${bank.bank_name} - ${bank.account_number}`;
        sel.appendChild(opt);
      });
    } catch (err) {
      console.error("loadBanks error", err);
      sel.innerHTML = `<option>Error loading banks</option>`;
    }
  }

  // ---- QR UPLOAD (jsQR local then remote fallback) ----
  const uploadBtn = document.getElementById("upload-btn");
  const qrUpload = document.getElementById("qr-upload");

  if (uploadBtn && qrUpload) {
    uploadBtn.addEventListener("click", () => qrUpload.click());

    qrUpload.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setFeedback("Please upload a valid image.");
        qrUpload.value = "";
        return;
      }

      // stop camera while decoding
      try { await stopCameraScanner(); } catch(_) {}

      let decodedText = null;

      // try local decode using jsQR
      try {
        await ensureJsQR();
        const dataUrl = await new Promise((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result);
          fr.onerror = rej;
          fr.readAsDataURL(file);
        });
        const img = new Image();
        img.src = dataUrl;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        // limit large images
        const MAX = 1600;
        let w = img.width, h = img.height;
        if (Math.max(w, h) > MAX) {
          const ratio = MAX / Math.max(w, h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const code = window.jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          decodedText = code.data;
          console.log("Local decode succeeded:", decodedText);
        } else {
          console.warn("Local decode returned no result");
        }
      } catch (localErr) {
        console.warn("Local file decode error:", localErr);
      }

      // remote fallback
      if (!decodedText) {
        try {
          decodedText = await decodeWithRemote(file);
          console.log("Remote decode result:", decodedText);
        } catch (remoteErr) {
          console.warn("Remote decode failed:", remoteErr);
          setFeedback("Could not decode QR locally or remotely (remote may be blocked by CORS).");
        }
      }

      if (decodedText) {
        await handleDecoded(decodedText);
      } else {
        setFeedback("No QR detected in image");
        try { await startCameraScanner(); } catch(_) {}
      }

      qrUpload.value = "";
    });
  }

  // expose minimal debug API
  window._qrScanner = {
    start: startCameraScanner,
    stop: stopCameraScanner,
  };
});
