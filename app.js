// app.js
// ======================================================================
// Budget Dashboard – Dashboard (Income Statement + Date Range)
// + Transactions tab with filters, sorting, bulk actions & inline editing
// + Categories editor
// + Import from CSV (PocketSmith-style)
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

  // Categories tab UI
  catUI: {
    editingId: null,
  },

  // Import tab UI
  importUI: {
    parsedRows: [],
  },

  // For generating new category IDs
  nextCategoryId: 1,
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

  // Initialise nextCategoryId so we don't clash with existing ids
  state.nextCategoryId = 1;
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
    var name = getCategoryNameById(row.categoryId) || "(Uncategorised income)
var tr = document.createElement("tr");

pgsql
Copy code
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

pgsql
Copy code
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

pgsql
Copy code
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

pgsql
Copy code
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
parentId: node.parentId,
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
var prefix = c.depth > 0 ? Array(c.depth + 1).join(" ") + "- " : "";
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
var min =
f.amountMin != null && f.amountMin !== "" ? Number(f.amountMin) : null;
var max =
f.amountMax != null && f.amountMax !== "" ? Number(f.amountMax) : null;

kotlin
Copy code
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

php-template
Copy code
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
Object.keys(accSet)
.sort()
.forEach(function (acc) {
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
clearTxSelection();
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

javascript
Copy code
state.transactions = state.transactions.filter(function (tx) {
  return !isTxSelected(tx.id);
});
clearTxSelection();
renderTransactionsTableBody();
});

bulkApplyCatBtn.addEventListener("click", function () {
var catId = bulkCatSelect.value;
if (!catId || !state.txUI.selection.length) return;
state.transactions.forEach(function (tx) {
if (isTxSelected(tx.id)) {
tx.categoryId = catId;
}
});
renderTransactionsTableBody();
});

bulkApplyLabelsBtn.addEventListener("click", function () {
var raw = bulkLabelsInput.value || "";
var labels = raw
.split(",")
.map(function (s) {
return s.trim();
})
.filter(function (s) {
return s.length > 0;
});

matlab
Copy code
if (!labels.length || !state.txUI.selection.length) return;

state.transactions.forEach(function (tx) {
  if (isTxSelected(tx.id)) {
    tx.labels = labels.slice();
  }
});
renderTransactionsTableBody();
});

// Sort header listeners
var sortHeaders = card.querySelectorAll("th[data-sort-field]");
sortHeaders.forEach(function (th) {
th.addEventListener("click", function () {
var field = th.getAttribute("data-sort-field");
if (state.txUI.sortField === field) {
state.txUI.sortDir = state.txUI.sortDir === "asc" ? "desc" : "asc";
} else {
state.txUI.sortField = field;
state.txUI.sortDir = "asc";
}
renderTransactionsTableBody();
});
});

// Finally, render table body
renderTransactionsTableBody();
}

// ---- Render table body & row editing ----------------------------------
function renderTransactionsTableBody() {
var tbody = document.getElementById("tx-tbody");
if (!tbody) return;

var txs = getVisibleTransactions();
tbody.innerHTML = "";

// Bulk bar visibility
var bulkBar = document.getElementById("tx-bulk-bar");
var bulkCount = document.getElementById("tx-bulk-count");
if (bulkBar && bulkCount) {
if (state.txUI.selection.length) {
bulkBar.style.display = "flex";
bulkCount.textContent = state.txUI.selection.length + " selected";
} else {
bulkBar.style.display = "none";
}
}

// Select-all checkbox
var selectAll = document.getElementById("tx-select-all");
if (selectAll) {
selectAll.onchange = null;
selectAll.checked =
txs.length > 0 &&
txs.every(function (tx) {
return isTxSelected(tx.id);
});
selectAll.addEventListener("change", function () {
txs.forEach(function (tx) {
toggleTxSelection(tx.id, selectAll.checked);
});
renderTransactionsTableBody();
});
}

txs.forEach(function (tx) {
var tr = document.createElement("tr");
var editing = state.txUI.editingId === tx.id;

javascript
Copy code
// Selection cell
var tdSel = document.createElement("td");
var chk = document.createElement("input");
chk.type = "checkbox";
chk.checked = isTxSelected(tx.id);
chk.addEventListener("change", function () {
  toggleTxSelection(tx.id, chk.checked);
  renderTransactionsTableBody();
});
tdSel.appendChild(chk);
tr.appendChild(tdSel);

if (editing) {
  // --- Edit mode ---
  var dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = tx.date || "";
  var tdDate = document.createElement("td");
  tdDate.appendChild(dateInput);
  tr.appendChild(tdDate);

  var descInput = document.createElement("input");
  descInput.type = "text";
  descInput.value = tx.description || "";
  var tdDesc = document.createElement("td");
  tdDesc.appendChild(descInput);
  tr.appendChild(tdDesc);

  var amtInput = document.createElement("input");
  amtInput.type = "number";
  amtInput.step = "0.01";
  amtInput.value = tx.amount;
  var tdAmt = document.createElement("td");
  tdAmt.appendChild(amtInput);
  tr.appendChild(tdAmt);

  var catSelect = buildCategorySelectElement(tx.categoryId, true, "None");
  var tdCat = document.createElement("td");
  tdCat.appendChild(catSelect);
  tr.appendChild(tdCat);

  var labelsInput = document.createElement("input");
  labelsInput.type = "text";
  labelsInput.value = (tx.labels || []).join(", ");
  var tdLabels = document.createElement("td");
  tdLabels.appendChild(labelsInput);
  tr.appendChild(tdLabels);

  var accInput = document.createElement("input");
  accInput.type = "text";
  accInput.value = tx.account || "";
  var tdAcc = document.createElement("td");
  tdAcc.appendChild(accInput);
  tr.appendChild(tdAcc);

  var noteInput = document.createElement("input");
  noteInput.type = "text";
  noteInput.value = tx.note || "";
  var tdNote = document.createElement("td");
  tdNote.appendChild(noteInput);
  tr.appendChild(tdNote);

  var tdActions = document.createElement("td");
  var saveBtn = document.createElement("button");
  saveBtn.className = "btn btn--tiny";
  saveBtn.textContent = "Save";
  saveBtn.addEventListener("click", function () {
    tx.date = dateInput.value || tx.date;
    tx.description = descInput.value || "";
    tx.amount = Number(amtInput.value || 0);
    tx.categoryId = catSelect.value || null;
    tx.labels = (labelsInput.value || "")
      .split(",")
      .map(function (s) {
        return s.trim();
      })
      .filter(function (s) {
        return s.length > 0;
      });
    tx.account = accInput.value || "";
    tx.note = noteInput.value || "";
    state.txUI.editingId = null;
    renderTransactionsTableBody();
  });

  var cancelBtn = document.createElement("button");
  cancelBtn.className = "btn btn--tiny";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", function () {
    state.txUI.editingId = null;
    renderTransactionsTableBody();
  });

  tdActions.appendChild(saveBtn);
  tdActions.appendChild(cancelBtn);
  tr.appendChild(tdActions);
} else {
  // --- View mode ---
  tr.appendChild(makeCell(tx.date || ""));
  tr.appendChild(makeCell(tx.description || ""));
  var amtClass =
    "cell-amount " + (tx.amount < 0 ? "amount--negative" : "amount--positive");
  tr.appendChild(makeCell(formatAmount(tx.amount), amtClass));
  tr.appendChild(makeCell(getCategoryNameById(tx.categoryId) || ""));
  tr.appendChild(makeCell((tx.labels || []).join(", ")));
  tr.appendChild(makeCell(tx.account || ""));
  tr.appendChild(makeCell(tx.note || ""));

  var tdActionsV = document.createElement("td");
  var editBtn = document.createElement("button");
  editBtn.className = "btn btn--tiny";
  editBtn.textContent = "Edit";
  editBtn.addEventListener("click", function () {
    state.txUI.editingId = tx.id;
    renderTransactionsTableBody();
  });
  tdActionsV.appendChild(editBtn);
  tr.appendChild(tdActionsV);
}

tbody.appendChild(tr);
});
}

// ---- Add new transaction ----------------------------------------------
function addNewTransaction() {
var newId =
state.transactions.reduce(function (max, tx) {
return Math.max(max, tx.id);
}, 0) + 1;

var today = formatISODate(new Date());
var tx = {
id: newId,
date: today,
description: "",
amount: 0,
categoryId: "",
labels: [],
account: "",
note: "",
};
state.transactions.push(tx);
state.txUI.editingId = newId;
clearTxSelection();
renderTransactionsTableBody();
}

// ======================================================================
// CATEGORIES TAB
// ======================================================================

function ensureCatUIState() {
if (!state.catUI) {
state.catUI = { editingId: null };
}
}

function getNextCategoryId() {
if (state.nextCategoryId == null) {
state.nextCategoryId = 1;
}
var id;
var exists = true;
while (exists) {
id = "cat-" + state.nextCategoryId++;
exists = state.categories.some(function (c) {
return c.id === id;
});
}
return id;
}

function addCategory(type, parentId) {
ensureCatUIState();
var newId = getNextCategoryId();
var newCat = {
id: newId,
name: type === "income" ? "New income category" : "New expense category",
parentId: parentId || null,
type: type,
};
state.categories.push(newCat);
state.catUI.editingId = newId;
renderCategoriesTableBody();
}

function buildParentSelectForCategory(cat) {
var select = document.createElement("select");

var optNone = document.createElement("option");
optNone.value = "";
optNone.textContent = "(no parent)";
select.appendChild(optNone);

var flat = buildCategoryOptionsFlat();
flat.forEach(function (other) {
if (other.id === cat.id) return;
if (other.type !== cat.type) return;
var opt = document.createElement("option");
opt.value = other.id;
opt.textContent = other.name;
if (cat.parentId === other.id) opt.selected = true;
select.appendChild(opt);
});

select.value = cat.parentId || "";
return select;
}

function collectCategoryDescendants(id) {
var toVisit = [id];
var all = [];
for (var i = 0; i < toVisit.length; i++) {
var current = toVisit[i];
all.push(current);
state.categories.forEach(function (c) {
if (c.parentId === current && all.indexOf(c.id) === -1) {
toVisit.push(c.id);
}
});
}
return all;
}

function deleteCategoryAndChildren(id) {
var ids = collectCategoryDescendants(id);

// Remove categories
state.categories = state.categories.filter(function (c) {
return ids.indexOf(c.id) === -1;
});

// Clear category from any transactions that used them
state.transactions.forEach(function (tx) {
if (ids.indexOf(tx.categoryId) !== -1) {
tx.categoryId = "";
}
});

if (state.catUI && state.catUI.editingId === id) {
state.catUI.editingId = null;
}
}

function renderCategoriesTab() {
ensureCatUIState();

var section = document.querySelector(
'.tab-section[data-tab-section="categories"]'
);
if (!section) return;

section.innerHTML = "";
var card = document.createElement("section");
card.className = "card";
card.innerHTML = <div class="section-title-row"> <div class="section-title">Categories</div> <div class="section-actions"> <button class="btn btn--primary" id="cat-add-income">Add income category</button> <button class="btn" id="cat-add-expense">Add expense category</button> </div> </div> <div class="section-subtitle"> Manage your income and expense category hierarchy. Changes apply immediately and are used in the dashboard & transactions tab. </div> <table class="transactions-table categories-table"> <thead> <tr> <th>Name</th> <th>Type</th> <th>Parent</th> <th>Actions</th> </tr> </thead> <tbody id="cat-tbody"></tbody> </table> ;
section.appendChild(card);

var addIncomeBtn = document.getElementById("cat-add-income");
var addExpenseBtn = document.getElementById("cat-add-expense");
addIncomeBtn.addEventListener("click", function () {
addCategory("income", null);
});
addExpenseBtn.addEventListener("click", function () {
addCategory("expense", null);
});

renderCategoriesTableBody();
}

function renderCategoriesTableBody() {
var tbody = document.getElementById("cat-tbody");
if (!tbody) return;

tbody.innerHTML = "";
var flat = buildCategoryOptionsFlat();

flat.forEach(function (cat) {
var tr = document.createElement("tr");
var editing =
state.catUI && state.catUI.editingId && state.catUI.editingId === cat.id;

javascript
Copy code
if (editing) {
  // --- edit mode ---
  var nameTd = document.createElement("td");
  var nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = cat.name;
  nameInput.style.width = "100%";
  nameTd.appendChild(nameInput);
  tr.appendChild(nameTd);

  var typeTd = document.createElement("td");
  typeTd.textContent = cat.type === "income" ? "Income" : "Expense";
  tr.appendChild(typeTd);

  var parentTd = document.createElement("td");
  var parentSelect = buildParentSelectForCategory(cat);
  parentTd.appendChild(parentSelect);
  tr.appendChild(parentTd);

  var actionsTd = document.createElement("td");
  var saveBtn = document.createElement("button");
  saveBtn.className = "btn btn--tiny";
  saveBtn.textContent = "Save";
  saveBtn.addEventListener("click", function () {
    cat.name = nameInput.value || cat.name;
    cat.parentId = parentSelect.value || null;
    state.catUI.editingId = null;
    renderCategoriesTableBody();
  });

  var cancelBtn = document.createElement("button");
  cancelBtn.className = "btn btn--tiny";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", function () {
    state.catUI.editingId = null;
    renderCategoriesTableBody();
  });

  actionsTd.appendChild(saveBtn);
  actionsTd.appendChild(cancelBtn);
  tr.appendChild(actionsTd);
} else {
  // --- view mode ---
  var nameTdV = document.createElement("td");
  nameTdV.textContent = cat.name;
  nameTdV.style.paddingLeft = 8 + cat.depth * 18 + "px";
  tr.appendChild(nameTdV);

  var typeTdV = document.createElement("td");
  typeTdV.textContent = cat.type === "income" ? "Income" : "Expense";
  tr.appendChild(typeTdV);

  var parentTdV = document.createElement("td");
  var parent = getCategoryById(cat.parentId);
  parentTdV.textContent = parent ? parent.name : "";
  tr.appendChild(parentTdV);

  var actionsTdV = document.createElement("td");

  var editBtn = document.createElement("button");
  editBtn.className = "btn btn--tiny";
  editBtn.textContent = "Edit";
  editBtn.addEventListener("click", function () {
    state.catUI.editingId = cat.id;
    renderCategoriesTableBody();
  });
  actionsTdV.appendChild(editBtn);

  var addSubBtn = document.createElement("button");
  addSubBtn.className = "btn btn--tiny";
  addSubBtn.textContent = "Add sub";
  addSubBtn.style.marginLeft = "4px";
  addSubBtn.addEventListener("click", function () {
    addCategory(cat.type, cat.id);
  });
  actionsTdV.appendChild(addSubBtn);

  var delBtn = document.createElement("button");
  delBtn.className = "btn btn--tiny";
  delBtn.textContent = "Delete";
  delBtn.style.marginLeft = "4px";
  delBtn.addEventListener("click", function () {
    var ids = collectCategoryDescendants(cat.id);
    var txCount = state.transactions.filter(function (tx) {
      return ids.indexOf(tx.categoryId) !== -1;
    }).length;
    var msg =
      "Delete this category";
    if (ids.length > 1) {
      msg += " and its " + (ids.length - 1) + " subcategories";
    }
    if (txCount > 0) {
      msg +=
        "?\n\n" +
        txCount +
        " transaction(s) currently use these categories; their category will be cleared.";
    } else {
      msg += "?";
    }
    if (!confirm(msg)) return;
    deleteCategoryAndChildren(cat.id);
    renderCategoriesTableBody();
  });
  actionsTdV.appendChild(delBtn);

  tr.appendChild(actionsTdV);
}

tbody.appendChild(tr);
});
}

// ======================================================================
// IMPORT TAB
// ======================================================================

function ensureImportUIState() {
if (!state.importUI) {
state.importUI = { parsedRows: [] };
}
}

function parseCSV(text) {
text = (text || "").trim();
if (!text) return [];
var lines = text.split(/\r?\n/);
if (!lines.length) return [];
var headers = lines[0].split(",").map(function (h) {
return h.trim();
});
var rows = [];

for (var i = 1; i < lines.length; i++) {
var line = lines[i].trim();
if (!line) continue;
var cols = line.split(",");
var obj = {};
headers.forEach(function (h, idx) {
obj[h] = cols[idx] ? cols[idx].trim() : "";
});
rows.push(obj);
}
return rows;
}

function findHeaderKey(headers, candidates) {
var found = null;
headers.forEach(function (h) {
var lower = h.toLowerCase();
candidates.forEach(function (cand) {
if (!found && lower.indexOf(cand) !== -1) {
found = h;
}
});
});
return found;
}

function mapCSVRowsToTransactions(rows) {
if (!rows.length) return [];
var headers = Object.keys(rows[0]);

var dateKey = findHeaderKey(headers, ["date"]);
var descKey = findHeaderKey(headers, ["description", "details", "narration"]);
var amountKey = findHeaderKey(headers, ["amount", "value"]);
var categoryKey = findHeaderKey(headers, ["category"]);
var accountKey = findHeaderKey(headers, ["account"]);
var labelsKey = findHeaderKey(headers, ["label", "tag"]);
var noteKey = findHeaderKey(headers, ["note", "memo"]);

var out = [];

rows.forEach(function (row) {
var rawDate = dateKey ? (row[dateKey] || "") : "";
var parsedDate;
if (rawDate && rawDate.indexOf("-") >= 0) {
parsedDate = rawDate.slice(0, 10);
} else {
parsedDate = formatISODate(new Date());
}

javascript
Copy code
var rawAmt = amountKey ? (row[amountKey] || "") : "0";
rawAmt = rawAmt.replace(/,/g, "");
var parsedAmt = parseFloat(rawAmt);
if (isNaN(parsedAmt)) parsedAmt = 0;

var catId = "";
if (categoryKey) {
  var rawCat = (row[categoryKey] || "").trim();
  if (rawCat) {
    var last = rawCat.split(/[>:]/).pop().trim();
    var match = state.categories.find(function (c) {
      return c.name === last;
    });
    if (match) catId = match.id;
  }
}

var labelsArr = [];
if (labelsKey && row[labelsKey]) {
  labelsArr = row[labelsKey]
    .split(/[;,]/)
    .map(function (s) {
      return s.trim();
    })
    .filter(function (s) {
      return s.length > 0;
    });
}

var tx = {
  date: parsedDate,
  description: descKey ? row[descKey] || "" : "",
  amount: parsedAmt,
  categoryId: catId,
  labels: labelsArr,
  account: accountKey ? row[accountKey] || "" : "",
  note: noteKey ? row[noteKey] || "" : "",
};
out.push(tx);
});

return out;
}

function renderImportPreview() {
var tbody = document.getElementById("import-preview-tbody");
if (!tbody) return;

tbody.innerHTML = "";
var rows = (state.importUI && state.importUI.parsedRows) || [];

rows.forEach(function (tx) {
var tr = document.createElement("tr");
tr.appendChild(makeCell(tx.date || ""));
tr.appendChild(makeCell(tx.description || ""));
tr.appendChild(makeCell(formatAmount(tx.amount), "cell-amount"));
tr.appendChild(makeCell(getCategoryNameById(tx.categoryId) || ""));
tr.appendChild(makeCell(tx.account || ""));
tr.appendChild(makeCell((tx.labels || []).join(", ")));
tr.appendChild(makeCell(tx.note || ""));
tbody.appendChild(tr);
});
}

function renderImportTab() {
ensureImportUIState();

var section = document.querySelector(
'.tab-section[data-tab-section="import"]'
);
if (!section) return;

section.innerHTML = "";
var card = document.createElement("section");
card.className = "card";
card.innerHTML = `
<div class="section-title">Import</div>
<div class="section-subtitle">
Paste a CSV export (e.g. from PocketSmith) below. The first row should contain headers such as Date, Description, Amount, Category, Account, Labels, Note.
</div>

php-template
Copy code
<textarea id="import-text" class="import-textarea" rows="8" placeholder="Paste CSV here"></textarea>

<div class="import-controls">
  <button class="btn btn--primary" id="import-parse">Preview</button>
  <button class="btn btn--ghost" id="import-apply" disabled>Import into transactions</button>
</div>

<div id="import-status" class="import-status"></div>

<table class="transactions-table">
  <thead>
    <tr>
      <th>Date</th>
      <th>Description</th>
      <th>Amount</th>
      <th>Category (matched)</th>
      <th>Account</th>
      <th>Labels</th>
      <th>Note</th>
    </tr>
  </thead>
  <tbody id="import-preview-tbody"></tbody>
</table>
`;
section.appendChild(card);

var parseBtn = document.getElementById("import-parse");
var applyBtn = document.getElementById("import-apply");
var textarea = document.getElementById("import-text");
var statusEl = document.getElementById("import-status");

parseBtn.addEventListener("click", function () {
var text = textarea.value || "";
var rawRows = parseCSV(text);
if (!rawRows.length) {
statusEl.textContent = "No rows detected. Check your CSV.";
state.importUI.parsedRows = [];
applyBtn.disabled = true;
renderImportPreview();
return;
}
var txRows = mapCSVRowsToTransactions(rawRows);
state.importUI.parsedRows = txRows;
statusEl.textContent =
"Parsed " +
txRows.length +
" row(s). Review the preview, then click Import.";
applyBtn.disabled = txRows.length === 0;
renderImportPreview();
});

applyBtn.addEventListener("click", function () {
if (!state.importUI.parsedRows || !state.importUI.parsedRows.length) return;
var nextId =
state.transactions.reduce(function (max, tx) {
return Math.max(max, tx.id);
}, 0) + 1;

pgsql
Copy code
state.importUI.parsedRows.forEach(function (row) {
  row.id = nextId++;
  state.transactions.push(row);
});

statusEl.textContent =
  "Imported " + state.importUI.parsedRows.length + " transaction(s).";
state.importUI.parsedRows = [];
applyBtn.disabled = true;
renderImportPreview();
});

renderImportPreview();
}

// ======================================================================
// TABS + INIT
// ======================================================================
function setupTabs() {
var buttons = document.querySelectorAll(".tab-button");
var sections = document.querySelectorAll(".tab-section");

function showTab(name) {
sections.forEach(function (sec) {
var tab = sec.getAttribute("data-tab-section");
if (tab === name) {
sec.style.display = "block";
} else {
sec.style.display = "none";
}
});

pgsql
Copy code
buttons.forEach(function (btn) {
  var t = btn.getAttribute("data-tab");
  if (t === name) {
    btn.classList.add("tab-button--active");
  } else {
    btn.classList.remove("tab-button--active");
  }
});

if (name === "dashboard") {
  renderDashboard();
} else if (name === "transactions") {
  renderTransactionsTab();
} else if (name === "categories") {
  renderCategoriesTab();
} else if (name === "import") {
  renderImportTab();
}
}

buttons.forEach(function (btn) {
btn.addEventListener("click", function () {
var target = btn.getAttribute("data-tab");
showTab(target);
});
});

// Initial tab
showTab("dashboard");
}

function init() {
loadSampleData();
setupTabs();
}

document.addEventListener("DOMContentLoaded", init);
