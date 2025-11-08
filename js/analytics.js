/* -------------------------------------------------------
   Gapy — Analytics Dashboard JS (Complete)
------------------------------------------------------- */
const API_BASE = "https://payment-application-based-on-upi-backend-12jg.onrender.com/api";
const token = localStorage.getItem("gapytoken");
if (!token) location.href = "index.html";

/* ---------- Elements (match analytics.html) ---------- */
const summaryDebited   = document.getElementById("summaryDebited");
const summaryCredited  = document.getElementById("summaryCredited");
const summaryNet       = document.getElementById("summaryNet");

const chartPieCanvas      = document.getElementById("chartPie");
const chartMonthlyCanvas  = document.getElementById("chartMonthly");
const chartCategoryCanvas = document.getElementById("chartCategory");
const categoryLegend      = document.getElementById("categoryLegend");

const topPayeesTable = document.getElementById("topPayeesTable");

const largestDebitValue  = document.getElementById("largestDebitValue");
const largestDebitMeta   = document.getElementById("largestDebitMeta");
const largestCreditValue = document.getElementById("largestCreditValue");
const largestCreditMeta  = document.getElementById("largestCreditMeta");
const biggestDayValue    = document.getElementById("biggestDayValue");
const activeDaysValue    = document.getElementById("activeDaysValue");

const predictionValue = document.getElementById("predictionValue");
const predictionDelta = document.getElementById("predictionDelta");
// Optional small sparkline canvas (exists in your html):
const chartPredictionCanvas = document.getElementById("chartPrediction");

const insightsList = document.getElementById("insightsList");
const txnList      = document.getElementById("txnList");
const listCount    = document.getElementById("listCount");

/* Filters (already wired in HTML UI) */
const filterMonth = document.getElementById("filterMonth");
const filterYear  = document.getElementById("filterYear");
const btnApplyFilter = document.getElementById("btnApplyFilter");
const btnExportCSV  = document.getElementById("btnExportCSV");
const btnFilterAll      = document.getElementById("btnFilterAll");
const btnFilterDebited  = document.getElementById("btnFilterDebited");
const btnFilterCredited = document.getElementById("btnFilterCredited");

/* ---------- State ---------- */
let transactions = [];
let pieChart, monthlyChart, categoryChart, predictionChart;

/* ---------- Helpers ---------- */
const fmt = (n) => "₹ " + Number(n || 0).toFixed(2);
const dKey = (iso) => new Date(iso).toISOString().slice(0,10); // yyyy-mm-dd
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
const isSuccess = (t) => (t.status || "").toUpperCase() === "SUCCESS";
const isDebit  = (t) => t.sender_account !== null;
const isCredit = (t) => t.receiver_account !== null;

function payeeName(t){
  // Prefer receiver_name if present; else derive from receiver_account; fallback Unknown
  if (t.receiver_name) return t.receiver_name;
  const ra = t.receiver_account || {};
  return ra.holder_name || ra.upi_id || "Unknown";
}

function guessCategory(t){
  const ref = (t.reference || "").toLowerCase();
  if (ref.includes("recharge")) return "Recharge";
  if (ref.includes("bill"))      return "Bills";
  if (ref.includes("transfer"))  return "Bank Transfer";
  if (ref.includes("upi"))       return "UPI";
  if (ref.includes("shop") || ref.includes("store") || ref.includes("grocery")) return "Shopping";
  if (ref.includes("electric") || ref.includes("water") || ref.includes("gas")) return "Utilities";
  return "Other";
}

/* -------------------------------------------------------
   LOAD ANALYTICS (stats + transactions)
------------------------------------------------------- */
async function loadStats(){
  try{
    const res = await fetch(`${API_BASE}/transactions/stats/`,{
      headers:{ Authorization:`Token ${token}` }
    });
    const data = await res.json();
    renderSummary(data);
    renderPie(data.pie || {debited:0, credited:0});
    renderMonthlyTrend(data.monthly || []);
    renderInsights(data);
  }catch(e){
    console.error("Error loading stats", e);
  }
}

async function loadTransactions(){
  try{
    const res = await fetch(`${API_BASE}/transactions/`,{
      headers:{ Authorization:`Token ${token}` }
    });
    transactions = await res.json() || [];

    // Fill top payees + list
    renderTopPayees(transactions);
    renderTxnList(transactions);

    // Compute client-side categories + highlights + prediction
    renderCategoriesFromTxns(transactions);
    renderHighlightsFromTxns(transactions);
    renderPredictionFromTxns(transactions);
  }catch(e){
    console.error("Error loading transactions", e);
  }
}

/* -------------------------------------------------------
   SUMMARY
------------------------------------------------------- */
function renderSummary(d){
  summaryDebited.textContent  = fmt(parseFloat(d.total_debited || 0));
  summaryCredited.textContent = fmt(parseFloat(d.total_credited || 0));
  summaryNet.textContent      = fmt(parseFloat(d.net_change || 0));
}

/* -------------------------------------------------------
   PIE (Debit vs Credit)
------------------------------------------------------- */
function renderPie(pie){
  if (!chartPieCanvas) return;
  pieChart && pieChart.destroy();
  pieChart = new Chart(chartPieCanvas,{
    type:"pie",
    data:{
      labels:["Debited","Credited"],
      datasets:[{ data:[pie.debited||0, pie.credited||0] }]
    },
    options:{ responsive:true, animation:{duration:900} }
  });
}

/* -------------------------------------------------------
   MONTHLY TREND (Bar)
------------------------------------------------------- */
function renderMonthlyTrend(arr){
  if (!chartMonthlyCanvas) return;
  monthlyChart && monthlyChart.destroy();
  monthlyChart = new Chart(chartMonthlyCanvas,{
    type:"bar",
    data:{
      labels: arr.map(x=>x.label),
      datasets:[
        { label:"Debited",  data: arr.map(x=>Number(x.debited||0)),  backgroundColor:"#ff7b00" },
        { label:"Credited", data: arr.map(x=>Number(x.credited||0)), backgroundColor:"#4bb543" },
      ]
    },
    options:{ responsive:true, scales:{ y:{beginAtZero:true} }, animation:{duration:900} }
  });
}

/* -------------------------------------------------------
   INSIGHTS (simple)
------------------------------------------------------- */
function renderInsights(d){
  insightsList.innerHTML = "";
  const deb = Number(d.total_debited||0);
  const cre = Number(d.total_credited||0);
  const net = Number(d.net_change||0);
  const items = [
    `You spent ${fmt(deb)} and received ${fmt(cre)}.`,
    net >= 0 ? `Net savings this period: ${fmt(net)}.` : `Net loss this period: ${fmt(net)}.`
  ];
  items.forEach(txt=>{
    const li=document.createElement("li");
    li.textContent=txt;
    insightsList.appendChild(li);
  });
}

/* -------------------------------------------------------
   TOP 5 PAYEES (by spend)
------------------------------------------------------- */
function renderTopPayees(txns){
  topPayeesTable.innerHTML = "";
  const map = {};
  txns.forEach(t=>{
    if (isSuccess(t) && isDebit(t)){
      const key = payeeName(t);
      map[key] = (map[key]||0) + Number(t.amount||0);
    }
  });
  const sorted = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5);
  if (!sorted.length){
    topPayeesTable.innerHTML = `<tr><td class="text-muted" colspan="3">No data</td></tr>`;
    return;
  }
  const topVal = sorted[0][1] || 1;
  sorted.forEach(([name, amt])=>{
    topPayeesTable.insertAdjacentHTML("beforeend",
      `<tr>
        <td>${name}</td>
        <td class="text-end">${fmt(amt)}</td>
        <td class="text-end">${((amt/topVal)*100).toFixed(1)}%</td>
      </tr>`
    );
  });
}

/* -------------------------------------------------------
   CATEGORY BREAKDOWN (client-side)
------------------------------------------------------- */
function renderCategoriesFromTxns(txns){
  if (!chartCategoryCanvas) return;

  const catMap = {};
  txns.forEach(t=>{
    if (!isSuccess(t)) return;
    const cat = guessCategory(t);
    const amt = Number(t.amount||0);
    if (isDebit(t)) catMap[cat] = (catMap[cat]||0) + amt;
  });

  const labels = Object.keys(catMap);
  if (!labels.length){
    categoryLegend.innerHTML = `<span class="text-muted small">No category data</span>`;
    categoryChart && categoryChart.destroy();
    // Draw an empty lightweight chart to keep layout consistent
    categoryChart = new Chart(chartCategoryCanvas, {
      type:"doughnut",
      data:{ labels:["—"], datasets:[{ data:[1], backgroundColor:["#eee"] }]},
      options:{ responsive:true, plugins:{legend:{display:false}}, animation:false }
    });
    return;
  }

  const totals = labels.map(k=>catMap[k]);
  const palette = ["#ff9d76","#ff6b6b","#4bb543","#3d8bfd","#ffc107","#845ef7","#20c997"];

  categoryChart && categoryChart.destroy();
  categoryChart = new Chart(chartCategoryCanvas,{
    type:"doughnut",
    data:{
      labels,
      datasets:[{
        data: totals,
        backgroundColor: labels.map((_,i)=>palette[i%palette.length])
      }]
    },
    options:{ responsive:true, cutout:"62%", animation:{duration:900} }
  });

  categoryLegend.innerHTML = labels
    .map((lbl,i)=>`${lbl}: ${fmt(totals[i])}`)
    .join("<br>");
}

/* -------------------------------------------------------
   HIGHLIGHTS (largest debit/credit, biggest spend day)
------------------------------------------------------- */
function renderHighlightsFromTxns(txns){
  const succ = txns.filter(isSuccess);

  // Largest debit
  const debits = succ.filter(isDebit);
  if (debits.length){
    const ld = debits.reduce((a,b)=> Number(a.amount||0) >= Number(b.amount||0) ? a : b);
    largestDebitValue.textContent = fmt(ld.amount);
    largestDebitMeta.textContent  = (ld.reference || payeeName(ld)) + " • " + new Date(ld.timestamp).toLocaleString();
  }else{
    largestDebitValue.textContent = fmt(0);
    largestDebitMeta.textContent  = "—";
  }

  // Largest credit
  const credits = succ.filter(isCredit);
  if (credits.length){
    const lc = credits.reduce((a,b)=> Number(a.amount||0) >= Number(b.amount||0) ? a : b);
    largestCreditValue.textContent = fmt(lc.amount);
    largestCreditMeta.textContent  = (lc.reference || payeeName(lc)) + " • " + new Date(lc.timestamp).toLocaleString();
  }else{
    largestCreditValue.textContent = fmt(0);
    largestCreditMeta.textContent  = "—";
  }

  // Biggest spend day + active days
  const byDay = {};
  succ.forEach(t=>{
    const k = dKey(t.timestamp);
    byDay[k] = byDay[k] || {deb:0, any:false};
    byDay[k].any = true;
    if (isDebit(t)) byDay[k].deb += Number(t.amount||0);
  });
  const days = Object.entries(byDay);
  if (days.length){
    const maxDay = days.reduce((a,b)=> a[1].deb >= b[1].deb ? a : b);
    biggestDayValue.textContent = `${maxDay[0]} — ${fmt(maxDay[1].deb)}`;
    const active = days.filter(([_,v])=>v.any).length;
    activeDaysValue.textContent = `Active days: ${active}`;
  }else{
    biggestDayValue.textContent = "—";
    activeDaysValue.textContent = "Active days: —";
  }
}

/* -------------------------------------------------------
   PREDICTION (simple linear trend on last 6 months debits)
------------------------------------------------------- */
function renderPredictionFromTxns(txns){
  const succDebits = txns.filter(t=>isSuccess(t) && isDebit(t));
  if (!succDebits.length){
    predictionValue.textContent = fmt(0);
    predictionDelta.textContent = "—";
    if (chartPredictionCanvas){
      predictionChart && predictionChart.destroy();
      predictionChart = new Chart(chartPredictionCanvas,{
        type:"line",
        data:{ labels:[""], datasets:[{ data:[0] }]},
        options:{ responsive:true, plugins:{legend:{display:false}}, animation:false, scales:{x:{display:false},y:{display:false}} }
      });
    }
    return;
  }

  // Aggregate by month for the last 6 months
  const now = new Date();
  const months = [];
  let y = now.getFullYear(), m = now.getMonth()+1;
  for (let i=0;i<6;i++){
    months.unshift(`${y}-${String(m).padStart(2,"0")}`);
    m--; if (m===0){ m=12; y--; }
  }
  const byMonth = Object.fromEntries(months.map(k=>[k,0]));
  succDebits.forEach(t=>{
    const d = new Date(t.timestamp);
    const k = monthKey(d);
    if (k in byMonth) byMonth[k] += Number(t.amount||0);
  });

  const xs = months.map((_,i)=>i+1);                 // 1..6
  const ys = months.map(k => byMonth[k]);            // amounts
  // Linear regression y = a + b x
  const n = xs.length;
  const sumX = xs.reduce((a,b)=>a+b,0);
  const sumY = ys.reduce((a,b)=>a+b,0);
  const sumXY = xs.reduce((a,x,i)=>a + x*ys[i],0);
  const sumXX = xs.reduce((a,x)=>a + x*x,0);
  const b = (n*sumXY - sumX*sumY) / (n*sumXX - sumX*sumX || 1);
  const a = (sumY - b*sumX) / n;
  const nextX = n+1;
  let pred = a + b*nextX;
  if (!isFinite(pred)) pred = 0;

  const last = ys[n-1] || 0;
  const delta = pred - last;

  predictionValue.textContent = fmt(pred);
  predictionDelta.textContent = `${delta>=0? "▲":"▼"} ${fmt(Math.abs(delta))} vs last month`;

  if (chartPredictionCanvas){
    predictionChart && predictionChart.destroy();
    predictionChart = new Chart(chartPredictionCanvas,{
      type:"line",
      data:{
        labels:[...months,"Next"],
        datasets:[{
          data:[...ys,pred],
          tension:0.35,
          pointRadius:0,
        }]
      },
      options:{
        responsive:true,
        plugins:{ legend:{display:false} },
        scales:{ x:{display:false}, y:{display:false} },
        animation:{ duration:600 }
      }
    });
  }
}

/* -------------------------------------------------------
   TRANSACTION LIST + CSV
------------------------------------------------------- */
function renderTxnList(txns){
  txnList.innerHTML = "";
  listCount.textContent = `${txns.length} items`;
  txns.slice(0,8).forEach(t=>{
    const debit = isDebit(t);
    txnList.insertAdjacentHTML("beforeend",
      `<div class="txn-card p-2 d-flex justify-content-between">
        <div>
          <div class="fw-bold">${t.reference || payeeName(t)}</div>
          <div class="text-muted small">${new Date(t.timestamp).toLocaleString()}</div>
        </div>
        <div class="${debit ? "text-danger":"text-success"} fw-bold">
          ${debit? "-":"+"} ${fmt(t.amount)}
        </div>
      </div>`
    );
  });
}

btnExportCSV.addEventListener("click", ()=>{
  const rows = [
    ["Date","Reference/Payee","Type","Amount"],
    ...transactions.map(t=>[
      new Date(t.timestamp).toLocaleString(),
      t.reference || payeeName(t),
      isDebit(t) ? "Debited" : "Credited",
      t.amount
    ])
  ];
  const csv = rows.map(r=>r.join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "transactions.csv";
  a.click();
});

/* -------------------------------------------------------
   Init
------------------------------------------------------- */
window.addEventListener("DOMContentLoaded", ()=>{
  loadStats();
  loadTransactions();
});
