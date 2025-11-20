// app.js
console.log("App script loaded");

// ========== GLOBAL STATE ==========
var state = {
  transactions: [],
  categories: [], // each: { id, name, parentId, type: "Income" | "Expense" }
  dateFilter: {
    // modes we support:
    // "this-week", "last-week", "rolling-week",
    // "this-month", "last-month", "rolling-month",
    // "this-quarter", "last-quarter", "rolling-quarter",
    // "this-year", "last-year", "rolling-year",
    // "custom",
    // plus legacy aliases like "6m", "3m", "1m", "ytd"
    mode: "this-month",
    from: null,
    to: null
  }
};

// ========== SAMPLE DATA (until CSV import kicks in) ==========
function loadSampleData() {
  console.log("loadSampleData()");

  // Simple category tree with types
  state.categories = [
    // Income
    { id: "Income > Base Salary", name: "Base Salary", parentId: null, type: "Income" },
    { id: "Income > Cashback", name: "Cashback", parentId: null, type: "Income" },
    { id: "Income > Per Diem", name: "Per Diem", parentId: null, type: "Income" },
    { id: "Income > Interest Income", name: "Interest Income", parentId: null, type: "Income" },
    {
      id: "Income > Transportation Allowance",
      name: "Transportation Allowance",
      parentId: null,
      type: "Income"
    },
    {
      id: "Income > Housing Allowance",
      name: "Housing Allowance",
      parentId: null,
      type: "Income"
    },

    // Expenses
    { id: "Food & Drinks", name: "Food & Drinks", parentId: null, type: "Expense" },
    {
      id: "Food & Drinks > Groceries",
      name: "Groceries",
      parentId: "Food & Drinks",
      type: "Expense"
    },
    {
      id: "Food & Drinks > Restaurants",
      name: "Restaurants",
      parentId: "Food & Drinks",
      type: "Expense"
    },
    {
      id: "Food & Drinks > Food Delivery",
      name: "Food Delivery",
      parentId: "Food & Drinks",
      type: "Expense"
    },

    {
      id: "Life & Entertainment",
      name: "Life & Entertainment",
      parentId: null,
      type: "Expense"
    },
    {
      id: "Life & Entertainment > Gifts",
      name: "Gifts",
      parentId: "Life & Entertainment",
      type: "Expense"
    }
  ];

  // Basic sample transactions – you’ll overwrite these via CSV
  state.transactions = [
    {
      id: 1,
      date: "2025-10-01",
      description: "September Salary",
      amount: 16000,
      categoryId: "Income > Base Salary",
      account: "Salary Account",
      labels: ["Work"]
    },
    {
      id: 2,
      date: "2025-10-03",
      description: "Dinner out",
      amount: -210,
      categoryId: "Food & Drinks > Restaurants",
      account: "Current Account",
      labels: ["Food"]
    },
    {
      id: 3,
      date: "2025-10-04",
      description: "Food delivery",
      amount: -95,
      categoryId: "Food & Drinks > Food Delivery",
      account: "Current Account",
      labels: ["Food", "Delivery"]
    },
    {
      id: 4,
      date: "2025-09-29",
      description: "Gift for friend",
      amount: -150,
      categoryId: "Life & Entertainment > Gifts",
      account: "Current Account",
      labels: ["Gift"]
    }
  ];
}

// ========== DATE RANGE ENGINE ==========

// Helper: zero out time
function startOfDay(d) {
  var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return x;
}

// Helper: end of day
function endOfDay(d) {
  var x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return x;
}

// Start of ISO week (Monday)
function startOfWeek(date) {
  var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  var day = d.getDay(); // 0 Sun - 6 Sat
  var diff = (day === 0 ? -6 : 1) - day; // make Monday the first day
  d.setDate(d.getDate() + diff);
  return startOfDay(d);
}

// End of week (Sunday)
function endOfWeek(date) {
  var start = startOfWeek(date);
  var end = new Date(start);
  end.setDate(end.getDate() + 6);
  return endOfDay(end);
}

function startOfMonth(date) {
  return startOfDay(new Date(date.getFullYear(), date.getMonth(), 1));
}

function endOfMonth(date) {
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function startOfQuarter(date) {
  var q = Math.floor(date.getMonth() / 3); // 0,1,2,3
  return startOfDay(new Date(date.getFullYear(), q * 3, 1));
}

function endOfQuarter(date) {
  var q = Math.floor(date.getMonth() / 3);
  var lastMonth = q * 3 + 2;
  return endOfDay(new Date(date.getFullYear(), lastMonth + 1, 0));
}

function startOfYear(date) {
  return startOfDay(new Date(date.getFullYear(), 0, 1));
}

function endOfYear(date) {
  return endOfDay(new Date(date.getFullYear(), 11, 31));
}

// Inclusive days between two dates (start / end are already normalized)
function daysBetweenInclusive(start, end) {
  var ms = end.getTime() - start.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}

// For averages we’ll approximate month & year lengths
function buildDateRangeFromMode() {
  var today = new Date();
  var mode = state.dateFilter.mode;
  var customFrom = state.dateFilter.from;
  var customTo = state.dateFilter.to;

  var start, end;

  switch (mode) {
    // NOW
    case "this-week":
      start = startOfWeek(today);
      end = endOfWeek(today);
      break;
    case "this-month":
      start = startOfMonth(today);
      end = endOfMonth(today);
      break;
    case "this-quarter":
      start = startOfQuarter(today);
      end = endOfQuarter(today);
      break;
    case "this-year":
      start = startOfYear(today);
      end = endOfYear(today);
      break;

    // PAST
    case "last-week": {
      var lastWeekEnd = startOfWeek(today);
      lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
      end = endOfDay(lastWeekEnd);
      start = startOfWeek(lastWeekEnd);
      break;
    }
    case "last-month": {
      var prevMonthRef = new Date(today.getFullYear(), today.getMonth() - 1, 15);
      start = startOfMonth(prevMonthRef);
      end = endOfMonth(prevMonthRef);
      break;
    }
    case "last-quarter": {
      var q = Math.floor(today.getMonth() / 3);
      var prevQuarterMonth = (q - 1) * 3 + 1; // middle month of previous q
      var prevQuarterRef = new Date(today.getFullYear(), prevQuarterMonth, 15);
      start = startOfQuarter(prevQuarterRef);
      end = endOfQuarter(prevQuarterRef);
      break;
    }
    case "last-year": {
      var prevYearRef = new Date(today.getFullYear() - 1, 6, 1);
      start = startOfYear(prevYearRef);
      end = endOfYear(prevYearRef);
      break;
    }

    // ROLLING
    case "rolling-week":
      end = endOfDay(today);
      start = startOfDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6));
      break;
    case "rolling-month":
      end = endOfDay(today);
      start = startOfDay(new Date(today.getFullYear(), today.getMonth() - 1, today.getDate() + 1));
      break;
    case "rolling-quarter":
      end = endOfDay(today);
      start = startOfDay(new Date(today.getFullYear(), today.getMonth() - 3, today.getDate() + 1));
      break;
    case "rolling-year":
      end = endOfDay(today);
      start = startOfDay(new Date(today.getFullYear() - 1, today.getMonth(), today.getDate() + 1));
      break;

    // CUSTOM
    case "custom":
      if (customFrom && customTo) {
        start = startOfDay(new Date(customFrom));
        end = endOfDay(new Date(customTo));
      } else {
        // fallback – last 3 months
        end = endOfDay(today);
        start = startOfDay(new Date(today.getFullYear(), today.getMonth() - 3, today.getDate() + 1));
      }
      break;

    // LEGACY ALIASES (for existing select values)
    case "1m":
      end = endOfDay(today);
      start = startOfDay(new Date(today.getFullYear(), today.getMonth() - 1, today.getDate() + 1));
      break;
    case "3m":
      end = endOfDay(today);
      start = startOfDay(new Date(today.getFullYear(), today.getMonth() - 3, today.getDate() + 1));
      break;
    case "6m":
    default:
      // default: last 6 months rolling
      end = endOfDay(today);
      start = startOfDay(new Date(today.getFullYear(), today.getMonth() - 6, today.getDate() + 1));
      break;
  }

  var days = daysBetweenInclusive(start, end);
  var monthsApprox = days / 30.4375;
  var quartersApprox = days / (30.4375 * 3.0);
  var yearsApprox = days / 365.0;

  return {
    start: start,
    end: end,
    days: days,
    monthsApprox: monthsApprox,
    quartersApprox: quartersApprox,
    yearsApprox: yearsApprox
  };
}

// ========== FILTERED TRANSACTIONS ==========
function getFilteredTransactions() {
  var range = buildDateRangeFromMode();
  var start = range.start;
  var end = range.end;

  return state.transactions.filter(function (tx) {
    var d = new Date(tx.date);
    return d >= start && d <= end;
  });
}

// ========== NUMBER / FORMAT HELPERS ==========
function formatAmount(num) {
  return Number(num || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatPercent(ratio) {
  if (ratio === null || ratio === undefined || !isFinite(ratio)) return "";
  return (ratio * 100).toFixed(2) + "%";
}

// ========== INCOME STATEMENT RENDERING ==========
function renderIncomeStatement() {
  var container = document.getElementById("income-statement");
  if (!container) {
    console.warn("Income statement container #income-statement not found");
    return;
  }

  var filtered = getFilteredTransactions();
  var catMap = {};
  state.categories.forEach(function (c) {
    catMap[c.id] = {
      id: c.id,
      name: c.name,
      parentId: c.parentId,
      type: c.type,
      ownAmount: 0,
      totalAmount: 0,
      children: [],
      depth: 0
    };
  });

  // Build tree links
  Object.keys(catMap).forEach(function (id) {
    var node = catMap[id];
    if (node.parentId && catMap[node.parentId]) {
      var parent = catMap[node.parentId];
      parent.children.push(node);
    }
  });

  // Sum into ownAmount
  filtered.forEach(function (tx) {
    var cat = catMap[tx.categoryId];
    if (!cat) return;

    cat.ownAmount += tx.amount;
  });

  // Accumulate totals (Option B – parent includes children)
  function accumulate(node, depth) {
    node.depth = depth || 0;
    var total = node.ownAmount;
    node.children.forEach(function (child) {
      total += accumulate(child, (depth || 0) + 1);
    });
    node.totalAmount = total;
    return total;
  }

  // Roots = those without parent
  var roots = [];
  Object.keys(catMap).forEach(function (id) {
    var node = catMap[id];
    if (!node.parentId || !catMap[node.parentId]) {
      roots.push(node);
    }
  });

  roots.forEach(function (root) {
    accumulate(root, 0);
  });

  // Totals from transactions (no double counting)
  var totalIncome = 0;
  var totalExpenses = 0; // expected to be <= 0

  filtered.forEach(function (tx) {
    var cat = catMap[tx.categoryId];
    if (!cat) return;
    if (cat.type === "Income") {
      totalIncome += tx.amount;
    } else if (cat.type === "Expense") {
      totalExpenses += tx.amount;
    }
  });

  var net = totalIncome + totalExpenses;
  var savingRate = totalIncome === 0 ? 0 : net / totalIncome;

  var range = buildDateRangeFromMode();
  var days = Math.max(range.days, 1);
  var monthsApprox = Math.max(range.monthsApprox, 0.0001);
  var quartersApprox = Math.max(range.quartersApprox, 0.0001);
  var yearsApprox = Math.max(range.yearsApprox, 0.0001);

  // Averages
  var avgDailyIncome = totalIncome / days;
  var avgDailyExpenses = totalExpenses / days;
  var avgDailyNet = net / days;

  var avgMonthlyIncome = totalIncome / monthsApprox;
  var avgMonthlyExpenses = totalExpenses / monthsApprox;
  var avgMonthlyNet = net / monthsApprox;

  var avgQuarterlyIncome = totalIncome / quartersApprox;
  var avgQuarterlyExpenses = totalExpenses / quartersApprox;
  var avgQuarterlyNet = net / quartersApprox;

  var avgYearlyIncome = totalIncome / yearsApprox;
  var avgYearlyExpenses = totalExpenses / yearsApprox;
  var avgYearlyNet = net / yearsApprox;

  // Flatten tree into ordered arrays for income + expenses
  var incomeRows = [];
  var expenseRows = [];

  function pushRows(node) {
    if (node.type === "Income" && node.totalAmount !== 0) {
      incomeRows.push(node);
    } else if (node.type === "Expense" && node.totalAmount !== 0) {
      expenseRows.push(node);
    }
    node.children.forEach(pushRows);
  }

  roots.forEach(pushRows);

  // Build HTML
  container.innerHTML = "";

  // Summary line
  var summary = document.createElement("div");
  summary.className = "income-summary-line";
  summary.textContent =
    "Total income: " +
    formatAmount(totalIncome) +
    " | Total expenses: " +
    formatAmount(totalExpenses) +
    " | Net: " +
    formatAmount(net) +
    " | Saving rate: " +
    formatPercent(savingRate);
  container.appendChild(summary);

  // ===== Income section =====
  var incomeSection = document.createElement("div");
  incomeSection.className = "income-section";

  var incomeTitle = document.createElement("h3");
  incomeTitle.textContent = "Income";
  incomeSection.appendChild(incomeTitle);

  var incomeTable = document.createElement("table");
  incomeTable.className = "statement-table";
  var incomeThead = document.createElement("thead");
  var incomeHeadRow = document.createElement("tr");

  ["Category", "Amount", "% of income"].forEach(function (h) {
    var th = document.createElement("th");
    th.textContent = h;
    incomeHeadRow.appendChild(th);
  });
  incomeThead.appendChild(incomeHeadRow);
  incomeTable.appendChild(incomeThead);

  var incomeTbody = document.createElement("tbody");

  // Top summary row: "Income 100% / total"
  if (totalIncome !== 0) {
    var topRow = document.createElement("tr");
    var tdName = document.createElement("td");
    tdName.textContent = "Income (total)";
    var tdAmount = document.createElement("td");
    tdAmount.textContent = formatAmount(totalIncome);
    tdAmount.className = "amount-cell amount-positive";
    var tdPct = document.createElement("td");
    tdPct.textContent = formatPercent(1);
    topRow.appendChild(tdName);
    topRow.appendChild(tdAmount);
    topRow.appendChild(tdPct);
    incomeTbody.appendChild(topRow);
  }

  incomeRows.forEach(function (row) {
    var tr = document.createElement("tr");

    var tdCat = document.createElement("td");
    tdCat.textContent = row.name;
    tdCat.style.paddingLeft = (row.depth * 20 + 4) + "px";

    var tdAmount = document.createElement("td");
    tdAmount.textContent = formatAmount(row.totalAmount);
    tdAmount.className = "amount-cell " + (row.totalAmount >= 0 ? "amount-positive" : "amount-negative");

    var tdPctIncome = document.createElement("td");
    var pctIncome =
      totalIncome === 0 ? null : row.totalAmount / totalIncome;
    tdPctIncome.textContent = formatPercent(pctIncome);

    tr.appendChild(tdCat);
    tr.appendChild(tdAmount);
    tr.appendChild(tdPctIncome);

    incomeTbody.appendChild(tr);
  });

  incomeTable.appendChild(incomeTbody);
  incomeSection.appendChild(incomeTable);
  container.appendChild(incomeSection);

  // ===== Expense section =====
  var expenseSection = document.createElement("div");
  expenseSection.className = "expense-section";

  var expenseTitle = document.createElement("h3");
  expenseTitle.textContent = "Expenses";
  expenseSection.appendChild(expenseTitle);

  var expenseTable = document.createElement("table");
  expenseTable.className = "statement-table";
  var expenseThead = document.createElement("thead");
  var expenseHeadRow = document.createElement("tr");
  ["Category", "Amount", "% of income", "% of expenses"].forEach(function (h) {
    var th = document.createElement("th");
    th.textContent = h;
    expenseHeadRow.appendChild(th);
  });
  expenseThead.appendChild(expenseHeadRow);
  expenseTable.appendChild(expenseThead);

  var expenseTbody = document.createElement("tbody");

  // Top summary row: "Expenses 100% / total"
  if (totalExpenses !== 0) {
    var topERow = document.createElement("tr");
    var eName = document.createElement("td");
    eName.textContent = "Expenses (total)";
    var eAmount = document.createElement("td");
    eAmount.textContent = formatAmount(totalExpenses);
    eAmount.className = "amount-cell " + (totalExpenses >= 0 ? "amount-positive" : "amount-negative");
    var ePctIncome = document.createElement("td");
    var ePctExpenses = document.createElement("td");
    ePctIncome.textContent =
      totalIncome === 0 ? "" : formatPercent(totalExpenses / totalIncome);
    ePctExpenses.textContent = formatPercent(1);
    topERow.appendChild(eName);
    topERow.appendChild(eAmount);
    topERow.appendChild(ePctIncome);
    topERow.appendChild(ePctExpenses);
    expenseTbody.appendChild(topERow);
  }

  expenseRows.forEach(function (row) {
    var tr = document.createElement("tr");

    var tdCat = document.createElement("td");
    tdCat.textContent = row.name;
    tdCat.style.paddingLeft = (row.depth * 20 + 4) + "px";

    var tdAmount = document.createElement("td");
    tdAmount.textContent = formatAmount(row.totalAmount);
    tdAmount.className = "amount-cell " + (row.totalAmount >= 0 ? "amount-positive" : "amount-negative");

    var tdPctIncome = document.createElement("td");
    var pctIncome =
      totalIncome === 0 ? null : row.totalAmount / totalIncome;
    tdPctIncome.textContent = formatPercent(pctIncome);

    var tdPctExpenses = document.createElement("td");
    var pctExpenses =
      totalExpenses === 0 ? null : row.totalAmount / totalExpenses; // denom negative → refunds → negative %
    tdPctExpenses.textContent = formatPercent(pctExpenses);

    tr.appendChild(tdCat);
    tr.appendChild(tdAmount);
    tr.appendChild(tdPctIncome);
    tr.appendChild(tdPctExpenses);

    expenseTbody.appendChild(tr);
  });

  expenseTable.appendChild(expenseTbody);
  expenseSection.appendChild(expenseTable);
  container.appendChild(expenseSection);

  // ===== Averages block =====
  var avgBlock = document.createElement("div");
  avgBlock.className = "averages-block";
  avgBlock.innerHTML =
    "<h4>Averages for selected period</h4>" +
    "<p><strong>Daily</strong> – Income: " +
    formatAmount(avgDailyIncome) +
    ", Expenses: " +
    formatAmount(avgDailyExpenses) +
    ", Net: " +
    formatAmount(avgDailyNet) +
    "</p>" +
    "<p><strong>Monthly (approx.)</strong> – Income: " +
    formatAmount(avgMonthlyIncome) +
    ", Expenses: " +
    formatAmount(avgMonthlyExpenses) +
    ", Net: " +
    formatAmount(avgMonthlyNet) +
    "</p>" +
    "<p><strong>Quarterly (approx.)</strong> – Income: " +
    formatAmount(avgQuarterlyIncome) +
    ", Expenses: " +
    formatAmount(avgQuarterlyExpenses) +
    ", Net: " +
    formatAmount(avgQuarterlyNet) +
    "</p>" +
    "<p><strong>Yearly (approx.)</strong> – Income: " +
    formatAmount(avgYearlyIncome) +
    ", Expenses: " +
    formatAmount(avgYearlyExpenses) +
    ", Net: " +
    formatAmount(avgYearlyNet) +
    "</p>";
  container.appendChild(avgBlock);
}

// ========== SIMPLE TRANSACTIONS TABLE (unchanged for now) ==========
function renderTransactionsTable() {
  var tbody = document.getElementById("transactions-body");
  if (!tbody) {
    console.warn("#transactions-body not found (transactions tab)");
    return;
  }
  tbody.innerHTML = "";

  // For now we ignore filters on this tab in Step 2
  var txs = state.transactions.slice().sort(function (a, b) {
    return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
  });

  var catMap = {};
  state.categories.forEach(function (c) {
    catMap[c.id] = c;
  });

  txs.forEach(function (tx) {
    var tr = document.createElement("tr");

    var tdDate = document.createElement("td");
    tdDate.textContent = tx.date;

    var tdDesc = document.createElement("td");
    tdDesc.textContent = tx.description;

    var tdAmount = document.createElement("td");
    tdAmount.textContent = formatAmount(tx.amount);
    tdAmount.className = "amount-cell " + (tx.amount >= 0 ? "amount-positive" : "amount-negative");

    var tdCategory = document.createElement("td");
    tdCategory.textContent = catMap[tx.categoryId] ? catMap[tx.categoryId].name : "";

    var tdLabels = document.createElement("td");
    tdLabels.textContent = (tx.labels || []).join(", ");

    tr.appendChild(tdDate);
    tr.appendChild(tdDesc);
    tr.appendChild(tdAmount);
    tr.appendChild(tdCategory);
    tr.appendChild(tdLabels);

    tbody.appendChild(tr);
  });
}

// ========== PERIOD FILTER WIRING (basic) ==========
function setupPeriodFilter() {
  var select = document.getElementById("period-select");
  if (!select) {
    console.log("No #period-select found; you can wire your own time-range UI later.");
    return;
  }

  select.value = state.dateFilter.mode;

  select.addEventListener("change", function () {
    state.dateFilter.mode = select.value;
    renderIncomeStatement();
  });

  // Optional custom range inputs if you have them
  var fromInput = document.getElementById("period-from");
  var toInput = document.getElementById("period-to");

  if (fromInput && toInput) {
    fromInput.addEventListener("change", function () {
      state.dateFilter.from = fromInput.value || null;
      if (state.dateFilter.mode === "custom") renderIncomeStatement();
    });
    toInput.addEventListener("change", function () {
      state.dateFilter.to = toInput.value || null;
      if (state.dateFilter.mode === "custom") renderIncomeStatement();
    });
  }
}

// ========== IMPORT (kept minimal – same behaviour as before) ==========
function setupImport() {
  var fileInput = document.getElementById("import-file");
  var clearCheckbox = document.getElementById("import-clear-existing");
  var button = document.getElementById("import-button");
  var statusEl = document.getElementById("import-status");

  if (!fileInput || !button || !statusEl) {
    console.log("Import controls not found – skipping import setup.");
    return;
  }

  button.addEventListener("click", function () {
    var file = fileInput.files[0];
    if (!file) {
      alert("Please choose a CSV file first.");
      return;
    }

    statusEl.textContent = "Reading file…";

    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var csvText = e.target.result;
        var imported = parsePocketSmithCsv(csvText);

        if (!imported.length) {
          statusEl.textContent = "No transactions found in CSV.";
          return;
        }

        var maxId = 0;
        state.transactions.forEach(function (t) {
          if (typeof t.id === "number" && t.id > maxId) maxId = t.id;
        });
        imported.forEach(function (tx, idx) {
          tx.id = maxId + idx + 1;
        });

        if (clearCheckbox && clearCheckbox.checked) {
          state.transactions = imported;
        } else {
          state.transactions = state.transactions.concat(imported);
        }

        statusEl.textContent =
          "Imported " + imported.length + " transactions successfully.";

        renderIncomeStatement();
        renderTransactionsTable();
      } catch (err) {
        console.error("Import error:", err);
        statusEl.textContent = "Import failed: " + (err.message || err);
      }
    };

    reader.onerror = function () {
      statusEl.textContent = "Could not read file.";
    };

    reader.readAsText(file);
  });
}

// Very small CSV parser for PocketSmith-style exports
function parsePocketSmithCsv(csvText) {
  if (!csvText || !csvText.trim()) return [];

  var lines = csvText.split(/\r?\n/).filter(function (l) {
    return l.trim() !== "";
  });
  if (!lines.length) return [];

  var headers = splitCsvLine(lines[0]).map(function (h) {
    return h.trim().toLowerCase();
  });

  function idx(names) {
    for (var i = 0; i < headers.length; i++) {
      for (var j = 0; j < names.length; j++) {
        if (headers[i] === names[j]) return i;
      }
    }
    return -1;
  }

  var idxDate = idx(["date"]);
  var idxDesc = idx(["description", "merchant", "memo"]);
  var idxAmount = idx(["amount in base currency", "amount (account)", "amount"]);
  var idxCategory = idx(["category"]);
  var idxAccount = idx(["account"]);

  if (idxDate === -1 || idxDesc === -1 || idxAmount === -1) {
    throw new Error("CSV headers not recognised (need at least Date, Description, Amount).");
  }

  var txs = [];
  for (var i = 1; i < lines.length; i++) {
    var row = splitCsvLine(lines[i]);
    if (!row.length || row.every(function (c) { return !c.trim(); })) continue;

    function cell(k) {
      return k >= 0 && k < row.length ? row[k].trim() : "";
    }

    var rawDate = cell(idxDate);
    var description = cell(idxDesc);
    var amtStr = cell(idxAmount);
    var categoryName = cell(idxCategory);
    var account = cell(idxAccount);

    var amount = parseNumber(amtStr);
    var isoDate = normaliseDate(rawDate);

    var categoryId = ensureCategoryForImport(categoryName, amount);

    txs.push({
      id: null,
      date: isoDate,
      description: description,
      amount: amount,
      categoryId: categoryId,
      account: account,
      labels: []
    });
  }

  return txs;
}

function splitCsvLine(line) {
  var result = [];
  var current = "";
  var inQuotes = false;

  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseNumber(str) {
  if (!str) return 0;
  return parseFloat(String(str).replace(/,/g, ""));
}

function normaliseDate(s) {
  if (!s) return "";
  s = s.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  var m = s.match(/^(\d{2})-(\d{2})-(\d{2})$/);
  if (m) {
    var d = m[1];
    var mo = m[2];
    var yy = parseInt(m[3], 10);
    var year = yy >= 70 ? 1900 + yy : 2000 + yy;
    return year + "-" + mo + "-" + d;
  }

  var dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    var month = String(dt.getMonth() + 1).padStart(2, "0");
    var day = String(dt.getDate()).padStart(2, "0");
    return dt.getFullYear() + "-" + month + "-" + day;
  }

  return s;
}

// When importing we still need to decide Income vs Expense
function ensureCategoryForImport(name, amount) {
  var trimmed = (name || "").trim();
  if (!trimmed) trimmed = "Uncategorised";

  var existing = state.categories.find(function (c) {
    return c.name === trimmed;
  });
  if (existing) return existing.id;

  var type = amount >= 0 ? "Income" : "Expense";
  var id = trimmed;
  var cat = { id: id, name: trimmed, parentId: null, type: type };
  state.categories.push(cat);
  return id;
}

// ========== INIT ==========
function init() {
  console.log("DOMContentLoaded fired");
  loadSampleData();
  setupPeriodFilter();
  setupImport();

  renderIncomeStatement();
  renderTransactionsTable();
}

document.addEventListener("DOMContentLoaded", init);
