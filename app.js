// app.js
// ======================================================================
// Budget Dashboard – core state + Dashboard (Income Statement + Date Range)
// Tabs "Transactions", "Categories", "Import" are wired but mostly empty
// ======================================================================

console.log("App script loaded");

// ----------------------------------------------------------------------
// GLOBAL STATE
// ----------------------------------------------------------------------
var state = {
  transactions: [],
  categories: [],
  dateFilter: {
    // default range – you can change this to "thisYear" etc.
    mode: "thisMonth",
    from: null,
    to: null,
  },
};

// ----------------------------------------------------------------------
// SAMPLE DATA (just so the dashboard shows something)
// ----------------------------------------------------------------------
function loadSampleData() {
  // Categories
  state.categories = [
    // Income
    { id: "income-root", name: "Income", parentId: null, type: "income" },
    {
      id: "income-base-salary",
      name: "Base Salary",
      parentId: "income-root",
      type: "income",
    },
    {
      id: "income-cashback",
      name: "Cashback",
      parentId: "income-root",
      type: "income",
    },
    {
      id: "income-per-diem",
      name: "Per Diem",
      parentId: "income-root",
      type: "income",
    },
    {
      id: "income-interest",
      name: "Interest Income",
      parentId: "income-root",
      type: "income",
    },

    // Expenses – a few top level + leaves
    {
      id: "exp-food",
      name: "Food & Drinks",
      parentId: null,
      type: "expense",
    },
    {
      id: "exp-restaurants",
      name: "Restaurants",
      parentId: "exp-food",
      type: "expense",
    },
    {
      id: "exp-food-delivery",
      name: "Food Delivery",
      parentId: "exp-food",
      type: "expense",
    },
    {
      id: "exp-life",
      name: "Life & Entertainment",
      parentId: null,
      type: "expense",
    },
    {
      id: "exp-gifts",
      name: "Gifts",
      parentId: "exp-life",
      type: "expense",
    },
  ];

  // Transactions (simple examples – Oct 2025)
  state.transactions = [
    {
      id: 1,
      date: "2025-10-01",
      description: "September Salary",
      amount: 16000,
      categoryId: "income-base-salary",
      labels: ["Work"],
      account: "Salary Account",
      note: "",
    },
    {
      id: 2,
      date: "2025-10-03",
      description: "Dinner out",
      amount: -210,
      categoryId: "exp-restaurants",
      labels: ["Food"],
      account: "Card",
      note: "",
    },
    {
      id: 3,
      date: "2025-10-04",
      description: "Food delivery",
      amount: -95,
      categoryId: "exp-food-delivery",
      labels: ["Food", "Delivery"],
      account: "Card",
      note: "",
    },
    {
      id: 4,
      date: "2025-09-29",
      description: "Gift for friend",
      amount: -150,
      categoryId: "exp-gifts",
      labels: ["Gift"],
      account: "Card",
      note: "",
    },
  ];
}

// ----------------------------------------------------------------------
// DATE HELPERS
// ----------------------------------------------------------------------
function parseISODate(str) {
  var parts = str.split("-");
  return new Date(
    parseInt(parts[0], 10),
    parseInt(parts[1], 10) - 1,
    parseInt(parts[2], 10)
  );
}

function formatISODate(d) {
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(date, days) {
  var d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date, months) {
  var d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

function startOfWeekMonday(date) {
  var d = startOfDay(date);
  var day = d.getDay(); // 0=Sun,...6=Sat
  var diff = (day === 0 ? -6 : 1) - day; // Monday as first day
  return addDays(d, diff);
}

function endOfWeekSunday(date) {
  var start = startOfWeekMonday(date);
  return addDays(start, 6);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getQuarter(date) {
  return Math.floor(date.getMonth() / 3); // 0,1,2,3
}

function startOfQuarter(date) {
  var q = getQuarter(date);
  var firstMonth = q * 3;
  return new Date(date.getFullYear(), firstMonth, 1);
}

function endOfQuarter(date) {
  var q = getQuarter(date);
  var lastMonth = q * 3 + 2;
  return new Date(date.getFullYear(), lastMonth + 1, 0);
}

function startOfYear(date) {
  return new Date(date.getFullYear(), 0, 1);
}

function endOfYear(date) {
  return new Date(date.getFullYear(), 11, 31);
}

function daysBetweenInclusive(from, to) {
  var ms = startOfDay(to) - startOfDay(from);
  return Math.floor(ms / 86400000) + 1;
}

// For simple averages; for most presets we just hardcode
function monthsInRangeForMode(mode, from, to) {
  if (
    mode === "thisMonth" ||
    mode === "lastMonth" ||
    mode === "rollingMonth"
  ) {
    return 1;
  }
  if (
    mode === "thisQuarter" ||
    mode === "lastQuarter" ||
    mode === "rollingQuarter"
  ) {
    return 3;
  }
  if (mode === "thisYear" || mode === "lastYear" || mode === "rollingYear") {
    return 12;
  }
  if (mode === "custom") {
    // Approx: month diff
    var yDiff = to.getFullYear() - from.getFullYear();
    var mDiff = to.getMonth() - from.getMonth();
    var months = yDiff * 12 + mDiff + 1;
    return months > 0 ? months : 1;
  }
  if (mode === "thisWeek" || mode === "lastWeek" || mode === "rollingWeek") {
    return daysBetweenInclusive(from, to) / 30.4375; // approx, used only if needed
  }
  return null;
}

// ----------------------------------------------------------------------
// DATE RANGE RESOLUTION (state.dateFilter -> {from,to,label,monthsInRange})
// ----------------------------------------------------------------------
function resolveDateRange() {
  var mode = state.dateFilter.mode;
  var today = startOfDay(new Date());
  var from, to, label, months;

  switch (mode) {
    // NOW
    case "thisWeek":
      from = startOfWeekMonday(today);
      to = endOfWeekSunday(today);
      label = "This week";
      break;
    case "thisMonth":
      from = startOfMonth(today);
      to = endOfMonth(today);
      label = "This month";
      break;
    case "thisQuarter":
      from = startOfQuarter(today);
      to = endOfQuarter(today);
      label = "This quarter";
      break;
    case "thisYear":
      from = startOfYear(today);
      to = endOfYear(today);
      label = "This year";
      break;

    // PAST
    case "lastWeek": {
      var startOfThisWeek = startOfWeekMonday(today);
      to = addDays(startOfThisWeek, -1);
      from = addDays(to, -6);
      label = "Last week";
      break;
    }
    case "lastMonth": {
      var firstOfThisMonth = startOfMonth(today);
      to = addDays(firstOfThisMonth, -1);
      from = new Date(to.getFullYear(), to.getMonth(), 1);
      label = "Last month";
      break;
    }
    case "lastQuarter": {
      var startQ = startOfQuarter(today);
      to = addDays(startQ, -1);
      from = startOfQuarter(to);
      label = "Last quarter";
      break;
    }
    case "lastYear": {
      var startThisYear = startOfYear(today);
      to = addDays(startThisYear, -1);
      from = startOfYear(to);
      label = "Last year";
      break;
    }

    // ROLLING
    case "rollingWeek":
      to = today;
      from = addDays(today, -6);
      label = "Rolling week";
      break;
    case "rollingMonth":
      to = today;
      from = addDays(addMonths(today, -1), 1);
      label = "Rolling month";
      break;
    case "rollingQuarter":
      to = today;
      from = addDays(addMonths(today, -3), 1);
      label = "Rolling quarter";
      break;
    case "rollingYear":
      to = today;
      from = addDays(addMonths(today, -12), 1);
      label = "Rolling year";
      break;

    // CUSTOM
    case "custom":
      if (state.dateFilter.from && state.dateFilter.to) {
        from = parseISODate(state.dateFilter.from);
        to = parseISODate(state.dateFilter.to);
        label = formatISODate(from) + " → " + formatISODate(to);
      } else {
        from = startOfMonth(today);
        to = endOfMonth(today);
        label = "Custom range (invalid, fallback to this month)";
      }
      break;

    // DEFAULT / CLEAR
    default:
      from = startOfMonth(today);
      to = endOfMonth(today);
      label = "This month";
      state.dateFilter.mode = "thisMonth";
      break;
  }

  months = monthsInRangeForMode(state.dateFilter.mode, from, to);
  return {
    from: from,
    to: to,
    label: label,
    monthsInRange: months,
  };
}

// ----------------------------------------------------------------------
// TRANSACTION FILTERING & AGGREGATION
// ----------------------------------------------------------------------
function getFilteredTransactions() {
  var range = resolveDateRange();
  var from = startOfDay(range.from);
  var to = startOfDay(range.to);

  return state.transactions.filter(function (tx) {
    var d = parseISODate(tx.date);
    var d0 = startOfDay(d);
    return d0 >= from && d0 <= to;
  });
}

function getCategoryById(id) {
  if (!id) return null;
  return state.categories.find(function (c) {
    return c.id === id;
  });
}

function getCategoryTypeForTx(tx) {
  var cat = getCategoryById(tx.categoryId);
  if (cat && (cat.type === "income" || cat.type === "expense")) {
    return cat.type;
  }
  // Fallback: positive = income, negative = expense
  return tx.amount >= 0 ? "income" : "expense";
}

function aggregateByCategory(txs) {
  var map = {}; // categoryId -> { categoryId, type, amount }

  txs.forEach(function (tx) {
    var type = getCategoryTypeForTx(tx);
    var id = tx.categoryId || (type === "income" ? "unmapped-income" : "unmapped-expense");
    if (!map[id]) {
      map[id] = {
        categoryId: id,
        type: type,
        amount: 0,
      };
    }
    map[id].amount += tx.amount;
  });

  return Object.keys(map).map(function (id) {
    return map[id];
  });
}

// ----------------------------------------------------------------------
// FORMATTING HELPERS
// ----------------------------------------------------------------------
function formatAmount(num) {
  var n = Number(num || 0);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value) {
  var v = Number(value || 0) * 100;
  return v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + "%";
}

// ----------------------------------------------------------------------
// DASHBOARD RENDERING
// ----------------------------------------------------------------------
function renderDashboard() {
  var container = document.getElementById("tab-dashboard");
  if (!container) {
    console.warn("#tab-dashboard not found");
    return;
  }
  container.innerHTML = "";

  var range = resolveDateRange();
  var txs = getFilteredTransactions();
  var aggregates = aggregateByCategory(txs);

  var incomeRows = aggregates.filter(function (r) {
    return r.type === "income" && r.amount !== 0;
  });
  var expenseRows = aggregates.filter(function (r) {
    return r.type === "expense" && r.amount !== 0;
  });

  var totalIncome = incomeRows.reduce(function (sum, r) {
    return sum + r.amount;
  }, 0);
  var totalExpenses = expenseRows.reduce(function (sum, r) {
    return sum + r.amount;
  }, 0);
  var net = totalIncome + totalExpenses;

  var savingRate = totalIncome === 0 ? 0 : net / totalIncome;

  var totalAbsExpenses = expenseRows.reduce(function (sum, r) {
    return sum + Math.abs(r.amount);
  }, 0);

  var days = daysBetweenInclusive(range.from, range.to);
  var months = range.monthsInRange || null;

  // ---------- Card wrapper ----------
  var card = document.createElement("div");
  card.className = "card card--dashboard";
  container.appendChild(card);

  // Header row (title + date range button)
  var headerRow = document.createElement("div");
  headerRow.className = "dash-header-row";
  card.appendChild(headerRow);

  var title = document.createElement("h2");
  title.className = "card__title";
  title.textContent = "Income statement";
  headerRow.appendChild(title);

  var rangeButton = document.createElement("button");
  rangeButton.className = "btn btn--ghost";
  rangeButton.id = "date-range-button";
  rangeButton.textContent = range.label;
  headerRow.appendChild(rangeButton);

  // Subtitle with totals and saving rate
  var subtitle = document.createElement("div");
  subtitle.className = "card__subtitle";
  subtitle.innerHTML =
    "Summary of income and expenses for the selected period. " +
    " From <strong>" +
    formatISODate(range.from) +
    "</strong> to <strong>" +
    formatISODate(range.to) +
    "</strong>.";
  card.appendChild(subtitle);

  var totalsLine = document.createElement("div");
  totalsLine.className = "dash-totals-line";
  totalsLine.innerHTML =
    '<span>Total income: <strong class="amount amount--positive">' +
    formatAmount(totalIncome) +
    "</strong></span>" +
    '<span>Total expenses: <strong class="' +
    (totalExpenses < 0 ? "amount amount--negative" : "amount amount--positive") +
    '">' +
    formatAmount(totalExpenses) +
    "</strong></span>" +
    '<span>Net: <strong class="' +
    (net < 0 ? "amount amount--negative" : "amount amount--positive") +
    '">' +
    formatAmount(net) +
    "</strong></span>" +
    '<span>Saving rate: <strong>' +
    formatPercent(savingRate) +
    "</strong></span>";
  card.appendChild(totalsLine);

  // ---------- Income section ----------
  var incomeSection = document.createElement("div");
  incomeSection.className = "section section--income";
  card.appendChild(incomeSection);

  var incomeTitle = document.createElement("h3");
  incomeTitle.className = "section__title";
  incomeTitle.textContent = "Income";
  incomeSection.appendChild(incomeTitle);

  var incomeTable = document.createElement("table");
  incomeTable.className = "is-table";
  incomeSection.appendChild(incomeTable);

  var incomeThead = document.createElement("thead");
  incomeTable.appendChild(incomeThead);

  var trHeadInc = document.createElement("tr");
  var thCatInc = document.createElement("th");
  thCatInc.textContent = "Category";
  var thAmtInc = document.createElement("th");
  thAmtInc.textContent = "Amount";
  thAmtInc.className = "col-num";
  var thPctInc = document.createElement("th");
  thPctInc.textContent = "% of income";
  thPctInc.className = "col-num";

  trHeadInc.appendChild(thCatInc);
  trHeadInc.appendChild(thAmtInc);
  trHeadInc.appendChild(thPctInc);
  incomeThead.appendChild(trHeadInc);

  var incomeTbody = document.createElement("tbody");
  incomeTable.appendChild(incomeTbody);

  // Total income row
  var trTotalInc = document.createElement("tr");
  trTotalInc.className = "row-total";
  var tdTotalCat = document.createElement("td");
  tdTotalCat.textContent = "Income";
  var tdTotalAmt = document.createElement("td");
  tdTotalAmt.className =
    "col-num " + (totalIncome < 0 ? "amount amount--negative" : "amount amount--positive");
  tdTotalAmt.textContent = formatAmount(totalIncome);
  var tdTotalPct = document.createElement("td");
  tdTotalPct.className = "col-num";
  tdTotalPct.textContent = totalIncome !== 0 ? "100.00%" : "";
  trTotalInc.appendChild(tdTotalCat);
  trTotalInc.appendChild(tdTotalAmt);
  trTotalInc.appendChild(tdTotalPct);
  incomeTbody.appendChild(trTotalInc);

  // Category rows
  incomeRows.forEach(function (row) {
    var cat = getCategoryById(row.categoryId);
    var name = cat ? cat.name : "(Uncategorised income)";
    var tr = document.createElement("tr");

    var tdName = document.createElement("td");
    tdName.textContent = name;

    var tdAmt = document.createElement("td");
    tdAmt.className =
      "col-num " + (row.amount < 0 ? "amount amount--negative" : "amount amount--positive");
    tdAmt.textContent = formatAmount(row.amount);

    var tdPct = document.createElement("td");
    tdPct.className = "col-num";
    tdPct.textContent =
      totalIncome !== 0 ? formatPercent(row.amount / totalIncome) : "";

    tr.appendChild(tdName);
    tr.appendChild(tdAmt);
    tr.appendChild(tdPct);
    incomeTbody.appendChild(tr);
  });

  // ---------- Expenses section ----------
  var expSection = document.createElement("div");
  expSection.className = "section section--expenses";
  card.appendChild(expSection);

  var expTitle = document.createElement("h3");
  expTitle.className = "section__title";
  expTitle.textContent = "Expenses";
  expSection.appendChild(expTitle);

  var expTable = document.createElement("table");
  expTable.className = "is-table";
  expSection.appendChild(expTable);

  var expThead = document.createElement("thead");
  expTable.appendChild(expThead);

  var trHeadExp = document.createElement("tr");
  var thCatExp = document.createElement("th");
  thCatExp.textContent = "Category";
  var thAmtExp = document.createElement("th");
  thAmtExp.textContent = "Amount";
  thAmtExp.className = "col-num";
  var thPctExp = document.createElement("th");
  thPctExp.textContent = "% of expenses";
  thPctExp.className = "col-num";

  trHeadExp.appendChild(thCatExp);
  trHeadExp.appendChild(thAmtExp);
  trHeadExp.appendChild(thPctExp);
  expThead.appendChild(trHeadExp);

  var expTbody = document.createElement("tbody");
  expTable.appendChild(expTbody);

  // Total expenses row
  var trTotalExp = document.createElement("tr");
  trTotalExp.className = "row-total";
  var tdExpCat = document.createElement("td");
  tdExpCat.textContent = "Expenses";
  var tdExpAmt = document.createElement("td");
  tdExpAmt.className =
    "col-num " + (totalExpenses < 0 ? "amount amount--negative" : "amount amount--positive");
  tdExpAmt.textContent = formatAmount(totalExpenses);
  var tdExpPct = document.createElement("td");
  tdExpPct.className = "col-num";
  tdExpPct.textContent = totalAbsExpenses > 0 ? "100.00%" : "";
  trTotalExp.appendChild(tdExpCat);
  trTotalExp.appendChild(tdExpAmt);
  trTotalExp.appendChild(tdExpPct);
  expTbody.appendChild(trTotalExp);

  // Expense category rows
  expenseRows.forEach(function (row) {
    var cat = getCategoryById(row.categoryId);
    var name = cat ? cat.name : "(Uncategorised expense)";
    var tr = document.createElement("tr");

    var tdName = document.createElement("td");
    tdName.textContent = name;

    var tdAmt = document.createElement("td");
    tdAmt.className =
      "col-num " + (row.amount < 0 ? "amount amount--negative" : "amount amount--positive");
    tdAmt.textContent = formatAmount(row.amount);

    var tdPct = document.createElement("td");
    tdPct.className = "col-num";
    var pct =
      totalAbsExpenses > 0
        ? Math.abs(row.amount) / totalAbsExpenses
        : 0;
    tdPct.textContent = totalAbsExpenses > 0 ? formatPercent(pct) : "";

    tr.appendChild(tdName);
    tr.appendChild(tdAmt);
    tr.appendChild(tdPct);
    expTbody.appendChild(tr);
  });

  // ---------- Averages ----------
  var averages = document.createElement("div");
  averages.className = "dash-averages";
  var dailyIncome = days > 0 ? totalIncome / days : 0;
  var dailyExpenses = days > 0 ? totalExpenses / days : 0;
  var dailyNet = days > 0 ? net / days : 0;

  var text =
    "Average per day – Income: " +
    formatAmount(dailyIncome) +
    ", Expenses: " +
    formatAmount(dailyExpenses) +
    ", Net: " +
    formatAmount(dailyNet);

  if (months && months > 0) {
    var monthlyIncome = totalIncome / months;
    var monthlyExpenses = totalExpenses / months;
    var monthlyNet = net / months;
    text +=
      " | Average per month – Income: " +
      formatAmount(monthlyIncome) +
      ", Expenses: " +
      formatAmount(monthlyExpenses) +
      ", Net: " +
      formatAmount(monthlyNet);
  }

  averages.textContent = text;
  card.appendChild(averages);

  // ---------- Attach time picker behaviour ----------
  setupDateRangePicker(range);
}

// ----------------------------------------------------------------------
// DATE RANGE PICKER UI
// ----------------------------------------------------------------------
function setupDateRangePicker(currentRange) {
  var btn = document.getElementById("date-range-button");
  if (!btn) return;

  // If a panel already exists, remove it – we'll recreate fresh
  var existing = document.getElementById("date-range-panel");
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }

  var panel = document.createElement("div");
  panel.id = "date-range-panel";
  panel.className = "date-panel date-panel--hidden";

  // Simple layout: 3 columns + custom + footer
  panel.innerHTML = `
    <div class="date-panel__cols">
      <div class="date-panel__col">
        <div class="date-panel__col-title">NOW</div>
        <button data-range="thisWeek">This Week</button>
        <button data-range="thisMonth">This Month</button>
        <button data-range="thisQuarter">This Quarter</button>
        <button data-range="thisYear">This Year</button>
      </div>
      <div class="date-panel__col">
        <div class="date-panel__col-title">PAST</div>
        <button data-range="lastWeek">Last Week</button>
        <button data-range="lastMonth">Last Month</button>
        <button data-range="lastQuarter">Last Quarter</button>
        <button data-range="lastYear">Last Year</button>
        <button data-range="custom">Custom Range</button>
      </div>
      <div class="date-panel__col">
        <div class="date-panel__col-title">ROLL BACK</div>
        <button data-range="rollingWeek">Rolling Week</button>
        <button data-range="rollingMonth">Rolling Month</button>
        <button data-range="rollingQuarter">Rolling Quarter</button>
        <button data-range="rollingYear">Rolling Year</button>
      </div>
    </div>
    <div class="date-panel__custom" id="date-panel-custom" style="display:none;">
      <label>From: <input type="date" id="date-panel-from"></label>
      <label>To: <input type="date" id="date-panel-to"></label>
      <div class="date-panel__error" id="date-panel-error"></div>
    </div>
    <div class="date-panel__footer">
      <button class="btn btn--ghost" id="date-panel-clear">Clear</button>
      <div class="date-panel__spacer"></div>
      <button class="btn btn--ghost" id="date-panel-cancel">Cancel</button>
      <button class="btn btn--primary" id="date-panel-apply">Apply</button>
    </div>
  `;

  // Attach panel next to button (inside dashboard card)
  var parentCard = btn.closest(".card");
  if (!parentCard) parentCard = document.body;
  parentCard.appendChild(panel);

  var pending = {
    mode: state.dateFilter.mode,
    from: state.dateFilter.from,
    to: state.dateFilter.to,
  };

  function openPanel() {
    panel.classList.remove("date-panel--hidden");
  }

  function closePanel() {
    panel.classList.add("date-panel--hidden");
  }

  btn.addEventListener("click", function () {
    if (panel.classList.contains("date-panel--hidden")) {
      openPanel();
    } else {
      closePanel();
    }
  });

  // Clicking a preset
  panel.querySelectorAll("button[data-range]").forEach(function (b) {
    b.addEventListener("click", function () {
      var mode = b.getAttribute("data-range");
      pending.mode = mode;

      var customBox = document.getElementById("date-panel-custom");
      if (mode === "custom") {
        customBox.style.display = "block";
        // Pre-fill custom fields with current state's custom or current range
        var fromInput = document.getElementById("date-panel-from");
        var toInput = document.getElementById("date-panel-to");
        if (state.dateFilter.mode === "custom" && state.dateFilter.from) {
          fromInput.value = state.dateFilter.from;
          toInput.value = state.dateFilter.to;
        } else {
          fromInput.value = formatISODate(currentRange.from);
          toInput.value = formatISODate(currentRange.to);
        }
      } else {
        customBox.style.display = "none";
      }
    });
  });

  // Custom range input change
  var fromInput = document.getElementById("date-panel-from");
  var toInput = document.getElementById("date-panel-to");
  var errorEl = document.getElementById("date-panel-error");

  function validateCustom() {
    if (!fromInput || !toInput || pending.mode !== "custom") return true;
    var f = fromInput.value;
    var t = toInput.value;
    if (!f || !t) {
      errorEl.textContent = "";
      return false;
    }
    if (f > t) {
      errorEl.textContent = "From date must be before or equal to To date.";
      return false;
    }
    errorEl.textContent = "";
    pending.from = f;
    pending.to = t;
    return true;
  }

  if (fromInput && toInput) {
    fromInput.addEventListener("change", validateCustom);
    toInput.addEventListener("change", validateCustom);
  }

  // Clear
  var clearBtn = document.getElementById("date-panel-clear");
  clearBtn.addEventListener("click", function () {
    // Reset to default you prefer – here: thisYear
    pending.mode = "thisYear";
    pending.from = null;
    pending.to = null;
    state.dateFilter = {
      mode: pending.mode,
      from: null,
      to: null,
    };
    closePanel();
    renderDashboard();
  });

  // Cancel
  var cancelBtn = document.getElementById("date-panel-cancel");
  cancelBtn.addEventListener("click", function () {
    closePanel();
  });

  // Apply
  var applyBtn = document.getElementById("date-panel-apply");
  applyBtn.addEventListener("click", function () {
    if (pending.mode === "custom") {
      if (!validateCustom()) return;
    } else {
      pending.from = null;
      pending.to = null;
    }
    state.dateFilter.mode = pending.mode;
    state.dateFilter.from = pending.from;
    state.dateFilter.to = pending.to;
    closePanel();
    renderDashboard();
  });

  // Close when clicking outside
  document.addEventListener("click", function (evt) {
    if (
      !panel.classList.contains("date-panel--hidden") &&
      !panel.contains(evt.target) &&
      evt.target !== btn
    ) {
      closePanel();
    }
  });
}

// ----------------------------------------------------------------------
// TABS WIRES (simple; only Dashboard is fully implemented for now)
// ----------------------------------------------------------------------
function setupTabs() {
  var buttons = document.querySelectorAll("[data-tab-target]");
  var panes = document.querySelectorAll("[data-tab-pane]");

  if (!buttons.length || !panes.length) {
    // If HTML doesn't use this structure, skip
    return;
  }

  function activateTab(name) {
    panes.forEach(function (p) {
      if (p.getAttribute("data-tab-pane") === name) {
        p.classList.add("tab-pane--active");
      } else {
        p.classList.remove("tab-pane--active");
      }
    });
    buttons.forEach(function (b) {
      if (b.getAttribute("data-tab-target") === name) {
        b.classList.add("top-nav__tab--active");
      } else {
        b.classList.remove("top-nav__tab--active");
      }
    });
  }

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var target = btn.getAttribute("data-tab-target");
      activateTab(target);
      if (target === "dashboard") {
        renderDashboard();
      }
    });
  });

  // Default tab
  activateTab("dashboard");
}

// ----------------------------------------------------------------------
// INIT
// ----------------------------------------------------------------------
function init() {
  console.log("DOMContentLoaded fired");
  loadSampleData();
  setupTabs();
  renderDashboard();
}

document.addEventListener("DOMContentLoaded", init);
