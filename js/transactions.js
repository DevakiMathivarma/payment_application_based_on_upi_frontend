// transactions.js (updated — preserves your list logic, appends stats & charts)
// Replace your existing js/transactions.js with this file.

document.addEventListener("DOMContentLoaded", () => {
  const list = document.getElementById("txn-list");
  const month = document.getElementById("month-filter");
  const year = document.getElementById("year-filter");
  const apply = document.getElementById("apply-filter");

  // New UI elements (may be absent if you didn't update HTML)
  const elTotalDebited = document.getElementById("total-debited");
  const elTotalCredited = document.getElementById("total-credited");
  const elNetChange = document.getElementById("net-change");
  const tabAll = document.getElementById("tab-all");
  const tabDebit = document.getElementById("tab-debit");
  const tabCredit = document.getElementById("tab-credit");

  const API_BASE = "https://payment-application-based-on-upi-backend-12jg.onrender.com/api";
  const token = localStorage.getItem("gapytoken") || localStorage.getItem("gapytoken"); // keep compatibility

  // helper to build headers (same as before)
  function buildHeaders(isJson = true) {
    const headers = {};
    if (isJson) headers["Content-Type"] = "application/json";
    if (token) headers["Authorization"] = `Token ${token}`;
    return headers;
  }

  // friendly date/time (same as before)
  function fmtDate(ts) {
    try {
      const d = new Date(ts);
      return d.toLocaleString(); // relies on user's locale
    } catch (e) {
      return ts;
    }
  }

  // show a small inline message (same as before)
  function setListHtml(html) {
    list.innerHTML = html;
  }

  // fetch current profile (same as before)
  async function fetchProfile() {
    try {
      const res = await fetch(`${API_BASE}/profile/`, { headers: buildHeaders(false) });
      if (!res.ok) return null;
      const data = await res.json();
      // prefer id if present, else username
      return {
        id: data.id ?? data.user_id ?? null,
        username: data.username ?? data.user ?? null
      };
    } catch (e) {
      return null;
    }
  }

  // escape helper (same as before)
  function escapeHtml(str) {
    if (!str && str !== 0) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ---------- Original loadTxns logic preserved (only lightly refactored for reuse) ----------
  // This function returns the raw array of transactions (so we can reuse for charts/tabs)
  async function fetchTxnsRaw(m, y) {
    // build url
    let url = `${API_BASE}/transactions/list/?`;
    if (m) url += `month=${encodeURIComponent(m)}&`;
    if (y) url += `year=${encodeURIComponent(y)}&`;

    // fetch profile & txns in parallel
    const [profile, txRes] = await Promise.allSettled([
      fetchProfile(),
      fetch(url, { headers: buildHeaders(false) })
    ]);

    let currentUser = null;
    if (profile.status === "fulfilled") currentUser = profile.value;

    // handle tx response
    try {
      if (txRes.status !== "fulfilled") throw new Error("Network error");
      if (!txRes.value.ok) {
        const errBody = await txRes.value.json().catch(() => ({}));
        throw new Error(errBody.detail || `Failed to fetch (${txRes.value.status})`);
      }
      const data = await txRes.value.json();
      // return both data and profile for further inference if needed
      return { data: data, profile: currentUser };
    } catch (err) {
      console.error("Transactions load error:", err);
      throw err;
    }
  }

  // The original renderer behaviour is preserved: build DOM nodes exactly as before
  function renderTxnsList(data, profile) {
    if (!Array.isArray(data) || data.length === 0) {
      setListHtml("<div style='opacity:.6;padding:12px;text-align:center'>No transactions</div>");
      return;
    }

    list.innerHTML = "";
    data.forEach(tx => {
      // Determine whether this transaction is debit/credit relative to current user
      let senderId = null;
      let senderUsername = null;
      if (tx.sender && typeof tx.sender === "object") {
        senderId = tx.sender.id ?? null;
        senderUsername = tx.sender.username ?? tx.sender.name ?? null;
      } else {
        senderId = tx.sender ?? null;
      }

      // Preserve previous commented logic: prefer tx.type if provided
      let type = tx.type || "Debited";

      // badge color same as before
      const badgeColor = type === "Debited" ? "#ff9a9a" : "#89f5c4";

      // payee display (safe guards)
      const payeeName = tx.payee && (tx.payee.name || tx.payee.upi_id || tx.payee.phone) ? (tx.payee.name || tx.payee.upi_id || tx.payee.phone) : "—";

      const el = document.createElement("div");
      el.className = "payee-card";
      el.style.display = "flex";
      el.style.justifyContent = "space-between";
      el.style.alignItems = "center";
      el.style.padding = "12px";
      el.style.borderRadius = "10px";
      el.style.marginBottom = "10px";
      el.innerHTML = `
        <div style="display:flex;gap:12px;align-items:center;min-width:0;">
          <div style="width:46px;height:46px;border-radius:8px;background:#fff7ed;display:flex;align-items:center;justify-content:center;color:#ff8a00;font-weight:700">
            ${(payeeName || "U").charAt(0).toUpperCase()}
          </div>
          <div style="display:flex;flex-direction:column;min-width:0;">
            <div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:360px;">
              ${escapeHtml(payeeName)}
            </div>
            <div style="color:var(--muted);font-size:13px">${fmtDate(tx.timestamp)}</div>
            <div style="color:var(--muted);font-size:13px">Ref: ${escapeHtml(tx.reference || "-")}</div>
          </div>
        </div>
        <div style="text-align:right;min-width:140px;">
          <div style="font-weight:800">₹ ${Number(tx.amount).toFixed(2)}</div>
          <div style="font-size:12px;margin-top:6px;color:${badgeColor};font-weight:600">${type} • ${tx.status}</div>
        </div>
      `;
      list.appendChild(el);
    });
  }

  // ---------- New features (appended) ----------
  // Local state for transactions (so tabs / client-side filtering use same data)
  let latestTxns = [];   // full array as returned by server
  let latestProfile = null;
  let activeTab = "all"; // "all" | "debit" | "credit"

  // Chart instances
  let pieChart = null;
  let trendChart = null;

  // Fetch stats for charts & summary (calls appended endpoint; does not modify list logic)
  async function fetchStats(months = 6) {
    try {
      const url = `${API_BASE}/transactions/stats/?months=${months}`;
      const res = await fetch(url, { headers: buildHeaders(false) });
      if (!res.ok) {
        // silently fail to avoid breaking list functionality
        console.warn("transactions/stats not available:", res.status);
        return null;
      }
      const data = await res.json();
      return data;
    } catch (e) {
      console.warn("fetchStats failed:", e);
      return null;
    }
  }

  // Update summary cards safely (no-op if elements missing)
  function updateSummary(stats) {
    if (!stats) return;
    if (elTotalDebited) elTotalDebited.textContent = `₹ ${Number(stats.total_debited || 0).toFixed(2)}`;
    if (elTotalCredited) elTotalCredited.textContent = `₹ ${Number(stats.total_credited || 0).toFixed(2)}`;
    if (elNetChange) {
      const net = Number(stats.net_change || 0);
      elNetChange.textContent = (net >= 0 ? "₹ " : "₹ -") + Math.abs(net).toFixed(2);
      elNetChange.style.color = net >= 0 ? "#10b981" : "#ef4444";
    }
  }

  // Chart drawing helpers (lazy load Chart.js)
  function loadChartJs() {
    if (window.Chart) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js";
      s.onload = () => resolve();
      s.onerror = (e) => reject(e);
      document.head.appendChild(s);
    });
  }

  async function drawPie(stats) {
    if (!stats || !document.getElementById("pie-chart")) return;
    const ctx = document.getElementById("pie-chart").getContext("2d");
    const deb = Number(stats.pie?.debited || 0);
    const cred = Number(stats.pie?.credited || 0);

    if (pieChart) {
      pieChart.data.datasets[0].data = [deb, cred];
      pieChart.update();
      return;
    }

    try {
      await loadChartJs();
      pieChart = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: ["Debited", "Credited"],
          datasets: [{
            data: [deb, cred],
            backgroundColor: ["#ff9a9a", "#89f5c4"],
            borderWidth: 0
          }]
        },
        options: {
          plugins: { legend: { position: "bottom" } },
          maintainAspectRatio: false
        }
      });
    } catch (e) {
      console.warn("Chart.js load failed", e);
    }
  }

  async function drawTrend(stats) {
    if (!stats || !document.getElementById("trend-chart")) return;
    const ctx = document.getElementById("trend-chart").getContext("2d");
    const labels = (stats.monthly || []).map(m => m.label);
    const deb = (stats.monthly || []).map(m => Number(m.debited || 0));
    const cred = (stats.monthly || []).map(m => Number(m.credited || 0));

    if (trendChart) {
      trendChart.data.labels = labels;
      trendChart.data.datasets[0].data = deb;
      trendChart.data.datasets[1].data = cred;
      trendChart.update();
      return;
    }

    try {
      await loadChartJs();
      trendChart = new Chart(ctx, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            { label: "Debited", data: deb, stack: "stack1", backgroundColor: "#ffb4a7" },
            { label: "Credited", data: cred, stack: "stack1", backgroundColor: "#c8f7e5" }
          ]
        },
        options: {
          plugins: { legend: { position: "bottom" } },
          responsive: true,
          scales: {
            x: { stacked: true },
            y: { stacked: true }
          }
        }
      });
    } catch (e) {
      console.warn("Chart.js load failed", e);
    }
  }

  // Tab UI helpers (non-invasive)
  function setActiveTabUI(t) {
    activeTab = t;
    if (!tabAll || !tabDebit || !tabCredit) return;
    tabAll.classList.remove("active");
    tabDebit.classList.remove("active");
    tabCredit.classList.remove("active");
    if (t === "all") tabAll.classList.add("active");
    if (t === "debit") tabDebit.classList.add("active");
    if (t === "credit") tabCredit.classList.add("active");
  }

  // Filter transactions client-side according to activeTab
  function filterByTab(arr) {
    if (!Array.isArray(arr)) return arr || [];
    if (activeTab === "all") return arr;
    if (activeTab === "debit") {
      return arr.filter(t => {
        if (t.type) return String(t.type).toLowerCase() === "debited";
        // fallback: if sender_account present -> debit
        return Boolean(t.sender_account);
      });
    }
    if (activeTab === "credit") {
      return arr.filter(t => {
        if (t.type) return String(t.type).toLowerCase() === "credited";
        // fallback: if receiver_account present -> credit
        return Boolean(t.receiver_account);
      });
    }
    return arr;
  }

  // Main loader (preserves old behaviour but now also updates stats & charts)
  async function loadTxns(m, y) {
    setListHtml("<div style='opacity:.6;padding:12px;text-align:center'>Loading transactions…</div>");

    let raw;
    try {
      raw = await fetchTxnsRaw(m, y);
    } catch (e) {
      setListHtml("<div style='opacity:.6;padding:12px;text-align:center'>Failed to load transactions</div>");
      return;
    }

    const data = raw.data;
    const profile = raw.profile;

    if (!Array.isArray(data) || data.length === 0) {
      setListHtml("<div style='opacity:.6;padding:12px;text-align:center'>No transactions</div>");
      // still attempt to fetch stats to show zeros/empty charts
      const stats = await fetchStats(6).catch(() => null);
      updateSummary(stats);
      await drawPie(stats);
      await drawTrend(stats);
      latestTxns = [];
      latestProfile = profile;
      return;
    }

    // Keep local copy for tabs/filtering
    latestTxns = data;
    latestProfile = profile;

    // Render list using the same DOM layout as before
    // (We keep the same rendering logic to avoid changing behaviour)
    renderTxnsList(filterByTab(data), profile);

    // Fetch stats independently (doesn't change server logic for list)
    const stats = await fetchStats(6).catch(() => null);
    updateSummary(stats);
    await drawPie(stats);
    await drawTrend(stats);
  }

  // Bind apply button (preserve original behaviour)
  apply.addEventListener("click", () => {
    loadTxns(month.value, year.value);
  });

  // Bind tabs if present (non-invasive)
  if (tabAll && tabDebit && tabCredit) {
    tabAll.addEventListener("click", () => {
      setActiveTabUI("all");
      // client-side filter without refetching server
      renderTxnsList(filterByTab(latestTxns), latestProfile);
    });
    tabDebit.addEventListener("click", () => {
      setActiveTabUI("debit");
      renderTxnsList(filterByTab(latestTxns), latestProfile);
    });
    tabCredit.addEventListener("click", () => {
      setActiveTabUI("credit");
      renderTxnsList(filterByTab(latestTxns), latestProfile);
    });
    // initial active tab styling
    setActiveTabUI("all");
  }

  // initial load (exact same call signature)
  loadTxns(); // no filters
});
