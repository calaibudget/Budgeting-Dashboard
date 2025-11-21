// app.js
// ======================================================================
// Budget Dashboard – Dashboard (Income Statement + Date Range)
// + Transactions tab with filters, sorting, bulk actions & inline editing
// ======================================================================

console.log("App script loaded");

// ----------------------------------------------------------------------
// GLOBAL STATE
// ----------------------------------------------------------------------
var state = {
  transactions: [],
  categories: [],
  dateFilter: {
    mode: "thisMonth", // Dashboard income-statement range
    from: null,
    to: null,
  },
  // Dashboard: how to display amounts
  // "total" | "perDay" | "perMonth" | "perYear"
  averageMode: "total",

  // Transactions tab UI state
  txUI: {
    filters: {
      search: "",
      dateMode: "any", // any | on | before | after | between
      dateFrom: null,
      dateTo: null,
      categoryId: "",
      label: "",
      account: "",
      amountMode: "any", // any | gt | lt | eq | between
      amountMin: null,
      amountMax: null,
    },
    sortField: "date", // date | description | amount | category | account
    sortDir: "desc", // asc | desc
    selection: [], // array of transaction ids
    editingId: null, // id of tx currently being edited
  },
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
// DASHBOARD DATE RANGE RESOLUTION
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
// DASHBOARD TRANSACTION FILTERING & AGGREGATION
// ----------------------------------------------------------------------
function getFilteredTransactionsForDashboard() {
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

function getCategoryNameById(id) {
  var cat = getCategoryById(id);
  return cat ? cat.name : "";
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

  if (!summaryLineEl || !incomeTbody || !expenseTbody) {
    console.warn("Dashboard elements not found");
    return;
  }

  incomeTbody.innerHTML = "";
  expenseTbody.innerHTML = "";
  if (footerEl) footerEl.innerHTML = "";

  var range = resolveDateRange();
  var txs = getFilteredTransactionsForDashboard();
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

  var factor = 1;
  if (state.averageMode === "perDay") {
    factor = days > 0 ? 1 / days : 1;
  } else if (state.averageMode === "perMonth") {
    factor = months && months > 0 ? 1 / months : 1;
  } else if (state.averageMode === "perYear") {
    factor = months && months > 0 ? 12 / months : 1;
  }

  function scaled(amount) {
    return amount * factor;
  }

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

  // ---------- Income table ----------
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
    var name = getCategoryNameById(row.categoryId) || "(Uncategorised income)";
    var tr = document.createElement("tr");

    tr.appendChild(makeCell(name));

    var amtClass =
      "cell-amount " +
      (row.amount < 0 ? "amount--negative" : "amount--positive");
    tr.appendChild(makeCell(formatAmount(scaled(row.amount)), amtClass));

    var pctIncome =
      totalIncome !== 0 ? formatPercent(row.amount / totalIncome) : "";
    tr.appendChild(makeCell(pctIncome, "cell-percent"));

    tr.appendChild(makeCell("", "cell-percent"));
    incomeTbody.appendChild(tr);
  });

  // ---------- Expenses table ----------
  var trTotExp = document.createElement("tr");
  trTotExp.className = "row-total";
  trTotExp.appendChild(makeCell("Expenses"));

  var totExpClass =
    "cell-amount " +
    (totalExpenses < 0 ? "amount--negative" : "amount--positive");
  trTotExp.appendChild(
    makeCell(formatAmount(scaled(totalExpenses)), totExpClass)
  );

  var totPctIncome =
    totalIncome !== 0 ? formatPercent(totalExpenses / totalIncome) : "";
  trTotExp.appendChild(makeCell(totPctIncome, "cell-percent"));

  var totPctExpenses = totalAbsExpenses > 0 ? "100.00%" : "";
  trTotExp.appendChild(makeCell(totPctExpenses, "cell-percent"));

  expenseTbody.appendChild(trTotExp);

  expenseRows.forEach(function (row) {
    var name = getCategoryNameById(row.categoryId) || "(Uncategorised expense)";
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

  // ---------- Footer – average selector ----------
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

  // ---------- Date-range dropdown only on dashboard ----------
  setupDateRangeDropdown(range);
}

// ----------------------------------------------------------------------
// DASHBOARD DATE RANGE DROPDOWN
// ----------------------------------------------------------------------
function setupDateRangeDropdown(currentRange) {
  var summaryLineEl = document.getElementById("summary-line");
  if (!summaryLineEl) return;

  var card = summaryLineEl.closest(".card") || document.body;

  var wrapper = document.getElementById("date-range-wrapper");
  if (!wrapper) {
    wrapper = document.createElement("div");
    wrapper.id = "date-range-wrapper";
    wrapper.className = "date-range-wrapper";
    card.insertBefore(wrapper, summaryLineEl);
  }

  wrapper.innerHTML = "";

  var label = document.createElement("span");
  label.textContent = "Period: ";
  wrapper.appendChild(label);

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
      if (!state.dateFilter.from || !state.dateFilter.to) {
        state.dateFilter.from = formatISODate(currentRange.from);
        state.dateFilter.to = formatISODate(currentRange.to);
      }
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

// ======================================================================
// TRANSACTIONS TAB
// ======================================================================

// ---- Category helpers for dropdowns -----------------------------------
function buildCategoryOptionsFlat() {
  var childrenMap = {};
  state.categories.forEach(function (c) {
    var key = c.parentId || "root";
    if (!childrenMap[key]) childrenMap[key] = [];
    childrenMap[key].push(c);
  });

  Object.keys(childrenMap).forEach(function (k) {
    childrenMap[k].sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
  });

  var result = [];

  function walk(node, depth) {
    result.push({
      id: node.id,
      name: node.name,
      depth: depth,
      type: node.type,
    });
    var kids = childrenMap[node.id] || [];
    kids.forEach(function (child) {
      walk(child, depth + 1);
    });
  }

  var roots = childrenMap["root"] || [];
  roots.forEach(function (root) {
    walk(root, 0);
  });

  return result;
}

function buildCategorySelectElement(selectedId, includeAny, anyLabel) {
  var select = document.createElement("select");

  if (includeAny) {
    var optAny = document.createElement("option");
    optAny.value = "";
    optAny.textContent = anyLabel || "All categories";
    select.appendChild(optAny);
  }

  var flat = buildCategoryOptionsFlat();
  flat.forEach(function (c) {
    var opt = document.createElement("option");
    opt.value = c.id;
    var prefix = c.depth > 0 ? Array(c.depth + 1).join("  ") + "- " : "";
    opt.textContent = prefix + c.name;
    if (selectedId && selectedId === c.id) opt.selected = true;
    select.appendChild(opt);
  });

  return select;
}

// ---- Transactions filtering & sorting --------------------------------
function ensureTxUIState() {
  if (!state.txUI) {
    state.txUI = {
      filters: {
        search: "",
        dateMode: "any",
        dateFrom: null,
        dateTo: null,
        categoryId: "",
        label: "",
        account: "",
        amountMode: "any",
        amountMin: null,
        amountMax: null,
      },
      sortField: "date",
      sortDir: "desc",
      selection: [],
      editingId: null,
    };
  }
}

function getVisibleTransactions() {
  ensureTxUIState();
  var f = state.txUI.filters;
  var txs = state.transactions.slice();

  // 1) Global text search
  if (f.search && f.search.trim() !== "") {
    var term = f.search.trim().toLowerCase();
    txs = txs.filter(function (tx) {
      var catName = getCategoryNameById(tx.categoryId) || "";
      var labelsStr = (tx.labels || []).join(", ");
      var haystack =
        (tx.description || "") +
        " " +
        (tx.note || "") +
        " " +
        catName +
        " " +
        (tx.account || "") +
        " " +
        labelsStr;
      return haystack.toLowerCase().indexOf(term) >= 0;
    });
  }

  // 2) Date filter
  if (f.dateMode !== "any") {
    txs = txs.filter(function (tx) {
      var d = parseISODate(tx.date);
      var dIso = formatISODate(d);
      var from = f.dateFrom;
      var to = f.dateTo;
      if (f.dateMode === "on") {
        if (!from) return true;
        return dIso === from;
      }
      if (f.dateMode === "before") {
        if (!from) return true;
        return dIso <= from;
      }
      if (f.dateMode === "after") {
        if (!from) return true;
        return dIso >= from;
      }
      if (f.dateMode === "between") {
        if (!from || !to) return true;
        return dIso >= from && dIso <= to;
      }
      return true;
    });
  }

  // 3) Category filter (exact match)
  if (f.categoryId) {
    txs = txs.filter(function (tx) {
      return tx.categoryId === f.categoryId;
    });
  }

  // 4) Label filter (simple contains in labels array)
  if (f.label && f.label.trim() !== "") {
    var labelTerm = f.label.trim().toLowerCase();
    txs = txs.filter(function (tx) {
      return (tx.labels || []).some(function (lb) {
        return lb.toLowerCase().indexOf(labelTerm) >= 0;
      });
    });
  }

  // 5) Account filter
  if (f.account && f.account !== "") {
    txs = txs.filter(function (tx) {
      return (tx.account || "") === f.account;
    });
  }

  // 6) Amount filter
  if (f.amountMode !== "any") {
    var min = f.amountMin != null && f.amountMin !== "" ? Number(f.amountMin) : null;
    var max = f.amountMax != null && f.amountMax !== "" ? Number(f.amountMax) : null;

    txs = txs.filter(function (tx) {
      var a = Number(tx.amount || 0);
      if (f.amountMode === "gt") {
        if (min == null) return true;
        return a > min;
      }
      if (f.amountMode === "lt") {
        if (max == null) return true;
        return a < max;
      }
      if (f.amountMode === "eq") {
        if (min == null) return true;
        return a === min;
      }
      if (f.amountMode === "between") {
        if (min == null || max == null) return true;
        return a >= min && a <= max;
      }
      return true;
    });
  }

  // Sorting
  var field = state.txUI.sortField;
  var dir = state.txUI.sortDir === "asc" ? 1 : -1;

  txs.sort(function (a, b) {
    var av, bv;
    if (field === "date") {
      av = a.date;
      bv = b.date;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    }
    if (field === "description") {
      av = (a.description || "").toLowerCase();
      bv = (b.description || "").toLowerCase();
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    }
    if (field === "amount") {
      av = Number(a.amount || 0);
      bv = Number(b.amount || 0);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    }
    if (field === "category") {
      av = getCategoryNameById(a.categoryId).toLowerCase();
      bv = getCategoryNameById(b.categoryId).toLowerCase();
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    }
    if (field === "account") {
      av = (a.account || "").toLowerCase();
      bv = (b.account || "").toLowerCase();
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    }
    return 0;
  });

  return txs;
}

// ---- Selection helpers ------------------------------------------------
function isTxSelected(id) {
  return state.txUI.selection.indexOf(id) >= 0;
}

function toggleTxSelection(id, isSelected) {
  var idx = state.txUI.selection.indexOf(id);
  if (isSelected) {
    if (idx === -1) state.txUI.selection.push(id);
  } else {
    if (idx >= 0) state.txUI.selection.splice(idx, 1);
  }
}

function clearTxSelection() {
  state.txUI.selection = [];
}

// ---- Transactions tab rendering --------------------------------------
function renderTransactionsTab() {
  ensureTxUIState();

  var section = document.querySelector(
    '.tab-section[data-tab-section="transactions"]'
  );
  if (!section) return;

  // Build card structure
  section.innerHTML = "";
  var card = document.createElement("section");
  card.className = "card";
  card.innerHTML = `
    <div class="section-title-row">
      <div class="section-title">Transactions</div>
      <button class="btn btn--primary" id="tx-add-button">Add transaction</button>
    </div>
    <div class="section-subtitle">
      Search, filter, edit and bulk-update your transactions.
    </div>

    <div class="tx-filters" id="tx-filters">
      <input type="text" id="tx-filter-search" placeholder="Search description, note, category, labels, account" />

      <select id="tx-filter-date-mode">
        <option value="any">Date: any</option>
        <option value="on">On</option>
        <option value="before">Before</option>
        <option value="after">After</option>
        <option value="between">Between</option>
      </select>
      <input type="date" id="tx-filter-date-from" />
      <input type="date" id="tx-filter-date-to" />

      <select id="tx-filter-category"></select>

      <input type="text" id="tx-filter-label" placeholder="Label" />

      <select id="tx-filter-account">
        <option value="">All accounts</option>
      </select>

      <select id="tx-filter-amount-mode">
        <option value="any">Amount: any</option>
        <option value="gt">&gt;</option>
        <option value="lt">&lt;</option>
        <option value="eq">=</option>
        <option value="between">Between</option>
      </select>
      <input type="number" id="tx-filter-amount-min" placeholder="Min" />
      <input type="number" id="tx-filter-amount-max" placeholder="Max" />

      <button class="btn btn--ghost" id="tx-filter-clear">Clear filters</button>
    </div>

    <div class="tx-bulk-bar" id="tx-bulk-bar" style="display:none;">
      <span id="tx-bulk-count">0 selected</span>
      <button class="btn btn--ghost" id="tx-bulk-delete">Delete</button>

      <span class="tx-bulk-group">
        <span>Set category:</span>
        <select id="tx-bulk-category"></select>
        <button class="btn btn--ghost" id="tx-bulk-apply-category">Apply</button>
      </span>

      <span class="tx-bulk-group">
        <span>Set labels:</span>
        <input type="text" id="tx-bulk-labels" placeholder="label1, label2" />
        <button class="btn btn--ghost" id="tx-bulk-apply-labels">Apply</button>
      </span>
    </div>

    <table class="transactions-table">
      <thead>
        <tr>
          <th><input type="checkbox" id="tx-select-all" /></th>
          <th data-sort-field="date">Date</th>
          <th data-sort-field="description">Description</th>
          <th data-sort-field="amount">Amount</th>
          <th data-sort-field="category">Category</th>
          <th>Labels</th>
          <th data-sort-field="account">Account</th>
          <th>Note</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody id="tx-tbody"></tbody>
    </table>
  `;
  section.appendChild(card);

  // --- Populate filters with state values ---
  var f = state.txUI.filters;

  var searchInput = document.getElementById("tx-filter-search");
  var dateModeSel = document.getElementById("tx-filter-date-mode");
  var dateFromInput = document.getElementById("tx-filter-date-from");
  var dateToInput = document.getElementById("tx-filter-date-to");
  var catFilterSelect = document.getElementById("tx-filter-category");
  var labelFilterInput = document.getElementById("tx-filter-label");
  var accountFilterSelect = document.getElementById("tx-filter-account");
  var amountModeSel = document.getElementById("tx-filter-amount-mode");
  var amountMinInput = document.getElementById("tx-filter-amount-min");
  var amountMaxInput = document.getElementById("tx-filter-amount-max");
  var clearBtn = document.getElementById("tx-filter-clear");

  // Category filter dropdown
  var catFilterSelectEl = buildCategorySelectElement(
    f.categoryId,
    true,
    "All categories"
  );
  catFilterSelect.parentNode.replaceChild(catFilterSelectEl, catFilterSelect);
  catFilterSelect = catFilterSelectEl;
  catFilterSelect.id = "tx-filter-category";

  // Account filter options from state.transactions
  var accSet = {};
  state.transactions.forEach(function (tx) {
    if (tx.account) accSet[tx.account] = true;
  });
  Object.keys(accSet).sort().forEach(function (acc) {
    var opt = document.createElement("option");
    opt.value = acc;
    opt.textContent = acc;
    if (f.account === acc) opt.selected = true;
    accountFilterSelect.appendChild(opt);
  });

  // Values
  searchInput.value = f.search || "";
  dateModeSel.value = f.dateMode || "any";
  if (f.dateFrom) dateFromInput.value = f.dateFrom;
  if (f.dateTo) dateToInput.value = f.dateTo;
  labelFilterInput.value = f.label || "";
  amountModeSel.value = f.amountMode || "any";
  if (f.amountMin != null) amountMinInput.value = f.amountMin;
  if (f.amountMax != null) amountMaxInput.value = f.amountMax;

  // Filter listeners
  searchInput.addEventListener("input", function () {
    state.txUI.filters.search = this.value;
    renderTransactionsTableBody();
  });
  dateModeSel.addEventListener("change", function () {
    state.txUI.filters.dateMode = this.value;
    renderTransactionsTableBody();
  });
  dateFromInput.addEventListener("change", function () {
    state.txUI.filters.dateFrom = this.value || null;
    renderTransactionsTableBody();
  });
  dateToInput.addEventListener("change", function () {
    state.txUI.filters.dateTo = this.value || null;
    renderTransactionsTableBody();
  });
  catFilterSelect.addEventListener("change", function () {
    state.txUI.filters.categoryId = this.value || "";
    renderTransactionsTableBody();
  });
  labelFilterInput.addEventListener("input", function () {
    state.txUI.filters.label = this.value;
    renderTransactionsTableBody();
  });
  accountFilterSelect.addEventListener("change", function () {
    state.txUI.filters.account = this.value || "";
    renderTransactionsTableBody();
  });
  amountModeSel.addEventListener("change", function () {
    state.txUI.filters.amountMode = this.value;
    renderTransactionsTableBody();
  });
  amountMinInput.addEventListener("change", function () {
    state.txUI.filters.amountMin = this.value;
    renderTransactionsTableBody();
  });
  amountMaxInput.addEventListener("change", function () {
    state.txUI.filters.amountMax = this.value;
    renderTransactionsTableBody();
  });

  clearBtn.addEventListener("click", function () {
    state.txUI.filters = {
      search: "",
      dateMode: "any",
      dateFrom: null,
      dateTo: null,
      categoryId: "",
      label: "",
      account: "",
      amountMode: "any",
      amountMin: null,
      amountMax: null,
    };
    renderTransactionsTab(); // rebuild to reset UI
  });

  // Add transaction button
  var addBtn = document.getElementById("tx-add-button");
  addBtn.addEventListener("click", function () {
    addNewTransaction();
  });

  // Bulk bar category select
  var bulkCatSelect = document.getElementById("tx-bulk-category");
  var bulkCatSelectEl = buildCategorySelectElement(null, true, "Choose category");
  bulkCatSelect.parentNode.replaceChild(bulkCatSelectEl, bulkCatSelect);
  bulkCatSelect = bulkCatSelectEl;
  bulkCatSelect.id = "tx-bulk-category";

  // Bulk buttons
  var bulkDeleteBtn = document.getElementById("tx-bulk-delete");
  var bulkApplyCatBtn = document.getElementById("tx-bulk-apply-category");
  var bulkLabelsInput = document.getElementById("tx-bulk-labels");
  var bulkApplyLabelsBtn = document.getElementById("tx-bulk-apply-labels");

  bulkDeleteBtn.addEventListener("click", function () {
    if (!state.txUI.selection.length) return;
    if (!confirm("Delete selected transactions?")) return;

    state.transactions = state.transactions.filter(function (tx) {
      return !isTxSelected(tx.id);
    });
    clearTxSelection();
    renderTransactionsTableBody();
  });

  bulkApplyCatBtn.addEventListener("click", function () {
    var catId = bulkCatSelect.value;
    if (!catId || !state.txUI.selection.length) return;
    state.transactions.forEach(function
