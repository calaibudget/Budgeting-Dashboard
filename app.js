// app.js
// ======================================================================
// Budget Dashboard – core state + Dashboard (Income Statement + Date Range)
// Tabs "Transactions", "Categories", "Import"
// ======================================================================

console.log("App script loaded");

// ----------------------------------------------------------------------
// GLOBAL STATE
// ----------------------------------------------------------------------
var state = {
  transactions: [],
  categories: [],
  dateFilter: {
    mode: "thisMonth", // default date range
    from: null,
    to: null,
  },
  // How to display amounts in the tables
  // "total" | "perDay" | "perMonth" | "perYear"
  averageMode: "total",
};

// ----------------------------------------------------------------------
// SAMPLE DATA
// ----------------------------------------------------------------------
function loadSampleData() {
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

    // Expenses
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
    var yDiff = to.getFullYear() - from.getFullYear();
    var mDiff = to.getMonth() - from.getMonth();
    var months = yDiff * 12 + mDiff + 1;
    return months > 0 ? months : 1;
  }
  if (mode === "thisWeek" || mode === "lastWeek" || mode === "rollingWeek") {
    return daysBetweenInclusive(from, to) / 30.4375;
  }
  return null;
}

// ----------------------------------------------------------------------
// DATE RANGE RESOLUTION
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
        label = "Custom range";
      }
      break;

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
  return tx.amount >= 0 ? "income" : "expense";
}

function aggregateByCategory(txs) {
  var map = {}; // categoryId -> { categoryId, type, amount }

  txs.forEach(function (tx) {
    var type = getCategoryTypeForTx(tx);
    var id =
      tx.categoryId || (type === "income" ? "unmapped-income" : "unmapped-expense");
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
  return (
    v.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + "%"
  );
}

function makeCell(text, className) {
  var td = document.createElement("td");
  if (className) td.className = className;
  if (text !== null && text !== undefined) td.textContent = text;
  return td;
}

// ----------------------------------------------------------------------
// DASHBOARD RENDERING
// ----------------------------------------------------------------------
function renderDashboard() {
  var summaryLineEl = document.getElementById("summary-line");
  var incomeTbody = document.getElementById("income-tbody");
  var expenseTbody = document.getElementById("expense-tbody");
  var footerEl = document.getElementById("statement-footer");
  var txTbody = document.getElementById("tx-tbody");

  if (!summaryLineEl || !incomeTbody || !expenseTbody) {
    console.warn("Dashboard elements not found");
    return;
  }

  incomeTbody.innerHTML = "";
  expenseTbody.innerHTML = "";
  if (footerEl) footerEl.innerHTML = "";
  if (txTbody) txTbody.innerHTML = "";

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

  // ---------- scaling factor for average view ----------
  var factor = 1;
  if (state.averageMode === "perDay") {
    factor = days > 0 ? 1 / days : 1;
  } else if (state.averageMode === "perMonth") {
    factor = months && months > 0 ? 1 / months : 1;
  } else if (state.averageMode === "perYear") {
    factor = months && months > 0 ? 12 / months : 1;
  } else {
    factor = 1; // "total"
  }
  function scaled(amount) {
    return amount * factor;
  }

  // ---------- summary line (always totals for the period) ----------
  summaryLineEl.innerHTML =
    "Total income: <strong>" +
    formatAmount(totalIncome) +
    "</strong> | Total expenses: <strong>" +
    formatAmount(totalExpenses) +
    "</strong> | Net: <strong>" +
    formatAmount(net) +
    "</strong> | Saving rate: <strong>" +
    formatPercent(savingRate) +
    "</strong>";

  // ------------------------------------------------------------------
  // Income table (4 columns, last column empty)
  // ------------------------------------------------------------------
  var trTotInc = document.createElement("tr");
  trTotInc.className = "row-total";
  trTotInc.appendChild(makeCell("Income"));
  trTotInc.appendChild(
    makeCell(formatAmount(scaled(totalIncome)), "cell-amount amount--positive")
  );
  trTotInc.appendChild(
    makeCell(totalIncome !== 0 ? "100.00%" : "", "cell-percent")
  );
  trTotInc.appendChild(makeCell("", "cell-percent")); // empty % of expenses
  incomeTbody.appendChild(trTotInc);

  incomeRows.forEach(function (row) {
    var cat = getCategoryById(row.categoryId);
    var name = cat ? cat.name : "(Uncategorised income)";

    var tr = document.createElement("tr");
    tr.appendChild(makeCell(name));

    var amtClass =
      "cell-amount " +
      (row.amount < 0 ? "amount--negative" : "amount--positive");
    tr.appendChild(makeCell(formatAmount(scaled(row.amount)), amtClass));

    var pctIncome =
      totalIncome !== 0 ? formatPercent(row.amount / totalIncome) : "";
    tr.appendChild(makeCell(pctIncome, "cell-percent"));

    tr.appendChild(makeCell("", "cell-percent")); // empty col to align
    incomeTbody.appendChild(tr);
  });

  // ------------------------------------------------------------------
  // Expenses table (Category / Amount / % of income / % of expenses)
  // ------------------------------------------------------------------
  var trTotExp = document.createElement("tr");
  trTotExp.className = "row-total";
  trTotExp.appendChild(makeCell("Expenses"));

  var totExpClass =
    "cell-amount " +
    (totalExpenses < 0 ? "amount--negative" : "amount--positive");
  trTotExp.appendChild(makeCell(formatAmount(scaled(totalExpenses)), totExpClass));

  var totPctIncome =
    totalIncome !== 0 ? formatPercent(totalExpenses / totalIncome) : "";
  trTotExp.appendChild(makeCell(totPctIncome, "cell-percent"));

  var totPctExpenses = totalAbsExpenses > 0 ? "100.00%" : "";
  trTotExp.appendChild(makeCell(totPctExpenses, "cell-percent"));

  expenseTbody.appendChild(trTotExp);

  expenseRows.forEach(function (row) {
    var cat = getCategoryById(row.categoryId);
    var name = cat ? cat.name : "(Uncategorised expense)";

    var tr = document.createElement("tr");
    tr.appendChild(makeCell(name));

    var amtClassRow =
      "cell-amount " +
      (row.amount < 0 ? "amount--negative" : "amount--positive");
    tr.appendChild(makeCell(formatAmount(scaled(row.amount)), amtClassRow));

    var pctInc =
      totalIncome !== 0 ? formatPercent(row.amount / totalIncome) : "";
    tr.appendChild(makeCell(pctInc, "cell-percent"));

    var pctExp =
      totalAbsExpenses > 0
        ? formatPercent(Math.abs(row.amount) / totalAbsExpenses)
        : "";
    tr.appendChild(makeCell(pctExp, "cell-percent"));

    expenseTbody.appendChild(tr);
  });

  // ------------------------------------------------------------------
  // Footer – average selector
  // ------------------------------------------------------------------
  if (footerEl) {
    footerEl.innerHTML = "";

    var label = document.createElement("span");
    label.textContent = "Show amounts as: ";

    var select = document.createElement("select");
    select.id = "avg-mode-select";

    var options = [
      { value: "total", text: "Total for period" },
      { value: "perDay", text: "Per day" },
      { value: "perMonth", text: "Per month" },
      { value: "perYear", text: "Per year" },
    ];
    options.forEach(function (opt) {
      var o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.text;
      select.appendChild(o);
    });
    select.value = state.averageMode;

    select.addEventListener("change", function () {
      state.averageMode = this.value;
      renderDashboard();
    });

    label.appendChild(select);
    footerEl.appendChild(label);
  }

  // ------------------------------------------------------------------
  // Transactions preview – fills first tx-tbody (dashboard)
  // ------------------------------------------------------------------
  if (txTbody) {
    txs.forEach(function (tx) {
      var tr = document.createElement("tr");
      tr.appendChild(makeCell(tx.date));
      tr.appendChild(makeCell(tx.description));

      var amtClass =
        tx.amount < 0 ? "amount--negative cell-amount" : "amount--positive cell-amount";
      tr.appendChild(makeCell(formatAmount(tx.amount), amtClass));

      var cat = getCategoryById(tx.categoryId);
      tr.appendChild(makeCell(cat ? cat.name : ""));
      tr.appendChild(makeCell((tx.labels || []).join(", ")));

      txTbody.appendChild(tr);
    });
  }

  // --- Date-range controls as DROPDOWN inside the card ---
  setupDateRangeDropdown(range);
}

// ----------------------------------------------------------------------
// DATE RANGE DROPDOWN (replaces popup panel)
// ----------------------------------------------------------------------
function setupDateRangeDropdown(currentRange) {
  var summaryLineEl = document.getElementById("summary-line");
  if (!summaryLineEl) return;

  var card = summaryLineEl.closest(".card") || document.body;

  // Wrapper above the summary line
  var wrapper = document.getElementById("date-range-wrapper");
  if (!wrapper) {
    wrapper = document.createElement("div");
    wrapper.id = "date-range-wrapper";
    wrapper.className = "date-range-wrapper";

    // Place wrapper just before the summary line
    card.insertBefore(wrapper, summaryLineEl);
  }

  wrapper.innerHTML = ""; // clear to avoid duplications

  // Left: label
  var label = document.createElement("span");
  label.textContent = "Period: ";
  wrapper.appendChild(label);

  // Select for date modes
  var select = document.createElement("select");
  select.id = "date-range-select";

  var options = [
    { value: "thisWeek", text: "This week" },
    { value: "thisMonth", text: "This month" },
    { value: "thisQuarter", text: "This quarter" },
    { value: "thisYear", text: "This year" },
    { value: "lastWeek", text: "Last week" },
    { value: "lastMonth", text: "Last month" },
    { value: "lastQuarter", text: "Last quarter" },
    { value: "lastYear", text: "Last year" },
    { value: "rollingWeek", text: "Rolling week" },
    { value: "rollingMonth", text: "Rolling month" },
    { value: "rollingQuarter", text: "Rolling quarter" },
    { value: "rollingYear", text: "Rolling year" },
    { value: "custom", text: "Custom range" },
  ];

  options.forEach(function (opt) {
    var o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.text;
    select.appendChild(o);
  });
  select.value = state.dateFilter.mode;
  wrapper.appendChild(select);

  // Custom range controls (appear only when mode = custom)
  var customBox = document.createElement("span");
  customBox.id = "custom-range-controls";
  customBox.style.marginLeft = "12px";
  wrapper.appendChild(customBox);

  if (state.dateFilter.mode === "custom") {
    buildCustomRangeControls(customBox, currentRange);
  }

  select.addEventListener("change", function () {
    var mode = this.value;
    state.dateFilter.mode = mode;

    if (mode === "custom") {
      // For custom, initialize with current resolved range if empty
      if (!state.dateFilter.from || !state.dateFilter.to) {
        state.dateFilter.from = formatISODate(currentRange.from);
        state.dateFilter.to = formatISODate(currentRange.to);
      }
      // Rebuild wrapper so custom controls appear
      renderDashboard();
    } else {
      state.dateFilter.from = null;
      state.dateFilter.to = null;
      renderDashboard();
    }
  });
}

function buildCustomRangeControls(container, currentRange) {
  container.innerHTML = "";

  var fromLabel = document.createElement("label");
  fromLabel.textContent = "From: ";
  var fromInput = document.createElement("input");
  fromInput.type = "date";
  fromInput.value =
    state.dateFilter.from || formatISODate(currentRange.from);
  fromLabel.appendChild(fromInput);
  container.appendChild(fromLabel);

  var toLabel = document.createElement("label");
  toLabel.style.marginLeft = "8px";
  toLabel.textContent = "To: ";
  var toInput = document.createElement("input");
  toInput.type = "date";
  toInput.value = state.dateFilter.to || formatISODate(currentRange.to);
  toLabel.appendChild(toInput);
  container.appendChild(toLabel);

  var errorSpan = document.createElement("span");
  errorSpan.style.color = "red";
  errorSpan.style.marginLeft = "8px";
  container.appendChild(errorSpan);

  function validateAndApply() {
    var f = fromInput.value;
    var t = toInput.value;
    if (!f || !t) {
      errorSpan.textContent = "";
      return;
    }
    if (f > t) {
      errorSpan.textContent = "From must be ≤ To";
      return;
    }
    errorSpan.textContent = "";
    state.dateFilter.from = f;
    state.dateFilter.to = t;
    renderDashboard();
  }

  fromInput.addEventListener("change", validateAndApply);
  toInput.addEventListener("change", validateAndApply);
}

// ----------------------------------------------------------------------
// TABS – uses data-tab / data-tab-section from your HTML
// ----------------------------------------------------------------------
function setupTabs() {
  var buttons = document.querySelectorAll(".tab-button[data-tab]");
  var sections = document.querySelectorAll(".tab-section[data-tab-section]");

  if (!buttons.length || !sections.length) return;

  function activateTab(name) {
    sections.forEach(function (sec) {
      if (sec.getAttribute("data-tab-section") === name) {
        sec.style.display = "block";
      } else {
        sec.style.display = "none";
      }
    });

    buttons.forEach(function (btn) {
      if (btn.getAttribute("data-tab") === name) {
        btn.classList.add("tab-button--active");
      } else {
        btn.classList.remove("tab-button--active");
      }
    });

    if (name === "dashboard") {
      renderDashboard();
    }
  }

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var target = btn.getAttribute("data-tab");
      activateTab(target);
    });
  });

  activateTab("dashboard");
}

// ----------------------------------------------------------------------
// INIT
// ----------------------------------------------------------------------
function init() {
  console.log("DOMContentLoaded fired");
  loadSampleData();
  setupTabs();
}

document.addEventListener("DOMContentLoaded", init);
