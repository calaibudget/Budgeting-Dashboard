console.log("App script loaded");

// ================== STATE ==================
var state = {
  transactions: [],
  categories: [], // { id, name, parentId, type: "Income"|"Expense", fullPath }
  dateFilter: {
    mode: "6m",
    from: null,
    to: null
  }
};

// ================== SAMPLE DATA ==================
function loadSampleData() {
  console.log("loadSampleData");

  // Pre-defined categories (with explicit type + fullPath)
  state.categories = [
    // Income tree
    { id: "Income", name: "Income", parentId: null, type: "Income", fullPath: "Income" },
    { id: "Income > Base Salary", name: "Base Salary", parentId: "Income", type: "Income", fullPath: "Income > Base Salary" },
    { id: "Income > Performance Bonus", name: "Performance Bonus", parentId: "Income", type: "Income", fullPath: "Income > Performance Bonus" },
    { id: "Income > Cashback", name: "Cashback", parentId: "Income", type: "Income", fullPath: "Income > Cashback" },
    { id: "Income > Per Diem", name: "Per Diem", parentId: "Income", type: "Income", fullPath: "Income > Per Diem" },
    { id: "Income > Interest Income", name: "Interest Income", parentId: "Income", type: "Income", fullPath: "Income > Interest Income" },
    { id: "Income > Transportation Allowance", name: "Transportation Allowance", parentId: "Income", type: "Income", fullPath: "Income > Transportation Allowance" },
    { id: "Income > Housing Allowance", name: "Housing Allowance", parentId: "Income", type: "Income", fullPath: "Income > Housing Allowance" },

    // Expense tree (simple example)
    { id: "Food & Drinks", name: "Food & Drinks", parentId: null, type: "Expense", fullPath: "Food & Drinks" },
    { id: "Food & Drinks > Groceries", name: "Groceries", parentId: "Food & Drinks", type: "Expense", fullPath: "Food & Drinks > Groceries" },
    { id: "Food & Drinks > Restaurants", name: "Restaurants", parentId: "Food & Drinks", type: "Expense", fullPath: "Food & Drinks > Restaurants" },
    { id: "Food & Drinks > Food Delivery", name: "Food Delivery", parentId: "Food & Drinks", type: "Expense", fullPath: "Food & Drinks > Food Delivery" },

    { id: "Life & Entertainment", name: "Life & Entertainment", parentId: null, type: "Expense", fullPath: "Life & Entertainment" },
    { id: "Life & Entertainment > Gifts", name: "Gifts", parentId: "Life & Entertainment", type: "Expense", fullPath: "Life & Entertainment > Gifts" }
  ];

  // Sample transactions
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

// ================== INIT ==================
function init() {
  console.log("init() starting");

  loadSampleData();
  setupPeriodFilter();
  setupCategoryEditor();
  setupImport();

  renderCategoryTrees();
  renderTransactionsTable();
  renderIncomeStatement();

  console.log("init() finished");
}

// ================== PERIOD FILTER ==================
function setupPeriodFilter() {
  var select = document.getElementById("period-select");
  var customRange = document.getElementById("custom-range");
  var fromInput = document.getElementById("date-from");
  var toInput = document.getElementById("date-to");

  if (!select) {
    console.log("period-select not found");
    return;
  }

  select.addEventListener("change", function () {
    state.dateFilter.mode = select.value;

    if (select.value === "custom") {
      customRange.classList.remove("hidden");
    } else {
      customRange.classList.add("hidden");
      state.dateFilter.from = null;
      state.dateFilter.to = null;
      rerenderAll();
    }
  });

  if (fromInput) {
    fromInput.addEventListener("change", function () {
      state.dateFilter.from = fromInput.value || null;
      rerenderAll();
    });
  }

  if (toInput) {
    toInput.addEventListener("change", function () {
      state.dateFilter.to = toInput.value || null;
      rerenderAll();
    });
  }

  select.value = state.dateFilter.mode;
}

// ================== CATEGORY EDITOR ==================
// Two editors: Income + Expense. No drag & drop – purely visual tree.
function setupCategoryEditor() {
  console.log("setupCategoryEditor");

  var incomeEditor = document.getElementById("income-categories-editor");
  var expenseEditor = document.getElementById("expense-categories-editor");
  var applyBtn = document.getElementById("apply-categories");

  if (!incomeEditor || !expenseEditor || !applyBtn) {
    console.log("Category editor elements missing");
    return;
  }

  // Pre-fill from state
  incomeEditor.value = buildCategoriesTextFromState("Income");
  expenseEditor.value = buildCategoriesTextFromState("Expense");

  applyBtn.addEventListener("click", function () {
    console.log("apply-categories clicked");

    var incomeText = incomeEditor.value || "";
    var expenseText = expenseEditor.value || "";

    var incomeCats = parseCategoriesText(incomeText, "Income");
    var expenseCats = parseCategoriesText(expenseText, "Expense");

    state.categories = incomeCats.concat(expenseCats);

    renderCategoryTrees();
    rerenderAll();

    alert("Categories updated: " + state.categories.length);
  });
}

// Build dashed-text from state for a given type
function buildCategoriesTextFromState(type) {
  var cats = state.categories.filter(function (c) {
    return c.type === type;
  });
  if (!cats.length) return "";

  var childrenMap = {};
  cats.forEach(function (c) {
    var key = c.parentId || "root";
    if (!childrenMap[key]) childrenMap[key] = [];
    childrenMap[key].push(c);
  });

  var lines = [];
  var roots = childrenMap["root"] || [];

  function walk(node, level) {
    var prefix = level > 0 ? new Array(level + 1).join("-") : "";
    lines.push(prefix + node.name);
    var children = childrenMap[node.id] || [];
    children.forEach(function (child) {
      walk(child, level + 1);
    });
  }

  roots.forEach(function (root) {
    walk(root, 0);
  });

  return lines.join("\n");
}

// Parse dashed text -> category objects for a given type
function parseCategoriesText(text, forcedType) {
  if (!text || !text.trim()) return [];

  var rawLines = text.split("\n");
  var lines = [];
  rawLines.forEach(function (l) {
    var line = l.replace(/\r/g, "");
    if (line.trim() !== "") lines.push(line);
  });

  var categoriesWithMeta = [];
  var lastByLevel = {};

  lines.forEach(function (line) {
    var trimmedLine = line.replace(/^\s+/, "");
    var match = trimmedLine.match(/^(-*)(.*)$/);
    if (!match) return;

    var dashes = match[1].length;
    var rawName = match[2].trim();
    if (!rawName) return;

    var level = dashes;
    var parentMeta = level === 0 ? null : lastByLevel[level - 1] || null;
    var path = parentMeta ? parentMeta.path + " > " + rawName : rawName;
    var id = path;
    var parentId = parentMeta ? parentMeta.id : null;
    var type = forcedType || "Expense";

    var cat = {
      id: id,
      name: rawName,
      parentId: parentId,
      type: type,
      path: path,
      level: level
    };

    categoriesWithMeta.push(cat);
    lastByLevel[level] = cat;
  });

  var result = [];
  categoriesWithMeta.forEach(function (c) {
    result.push({
      id: c.id,
      name: c.name,
      parentId: c.parentId,
      type: c.type,
      fullPath: c.path
    });
  });

  return result;
}

// ================== CATEGORY TREES (visual only) ==================
function renderCategoryTrees() {
  renderCategoryTreeForType("Income", "income-category-tree");
  renderCategoryTreeForType("Expense", "expense-category-tree");
}

function renderCategoryTreeForType(type, containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  var cats = state.categories.filter(function (c) {
    return c.type === type;
  });

  if (!cats.length) {
    var empty = document.createElement("div");
    empty.className = "category-empty";
    empty.textContent = "No " + type.toLowerCase() + " categories defined.";
    container.appendChild(empty);
    return;
  }

  var childrenMap = {};
  cats.forEach(function (c) {
    var key = c.parentId || "root";
    if (!childrenMap[key]) childrenMap[key] = [];
    childrenMap[key].push(c);
  });

  var roots = childrenMap["root"] || [];
  roots.forEach(function (root) {
    renderCategoryTreeNode(container, root, childrenMap, 0);
  });
}

function renderCategoryTreeNode(container, node, childrenMap, level) {
  var row = document.createElement("div");
  row.className = "category-row";
  row.style.paddingLeft = (level * 18) + "px";

  var label = document.createElement("div");
  label.className = "category-row__label";
  label.textContent = node.name;

  var path = document.createElement("div");
  path.className = "category-row__path";
  path.textContent = node.fullPath || node.name;

  row.appendChild(label);
  if (node.fullPath && node.fullPath !== node.name) {
    row.appendChild(path);
  }

  container.appendChild(row);

  var children = childrenMap[node.id] || [];
  children.forEach(function (child) {
    renderCategoryTreeNode(container, child, childrenMap, level + 1);
  });
}

// ================== TRANSACTIONS TABLE ==================
function renderTransactionsTable() {
  var tbody = document.getElementById("transactions-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  var filtered = getFilteredTransactions();

  filtered.sort(function (a, b) {
    return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
  });

  filtered.forEach(function (tx) {
    var tr = document.createElement("tr");

    // checkbox
    var selectTd = document.createElement("td");
    selectTd.className = "tx-col-select";
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "tx-select";
    cb.setAttribute("data-transaction-id", String(tx.id));
    selectTd.appendChild(cb);

    var dateTd = document.createElement("td");
    dateTd.textContent = tx.date;

    var descTd = document.createElement("td");
    descTd.textContent = tx.description;

    var amountTd = document.createElement("td");
    amountTd.textContent = formatAmount(tx.amount);
    amountTd.className =
      tx.amount < 0 ? "amount-negative" : "amount-positive";

    var catTd = document.createElement("td");
    catTd.textContent = getCategoryName(tx.categoryId);

    tr.appendChild(selectTd);
    tr.appendChild(dateTd);
    tr.appendChild(descTd);
    tr.appendChild(amountTd);
    tr.appendChild(catTd);

    tbody.appendChild(tr);
  });
}

// ================== INCOME STATEMENT ==================
function renderIncomeStatement() {
  var container = document.getElementById("income-statement");
  if (!container) return;
  container.innerHTML = "";

  var filtered = getFilteredTransactions();

  // Map categories by id for quick lookup
  var catById = {};
  state.categories.forEach(function (c) {
    catById[c.id] = c;
  });

  // Total income / expenses at transaction level
  var totalIncome = 0;
  var totalExpenses = 0;

  filtered.forEach(function (tx) {
    var cat = catById[tx.categoryId];
    var type =
      cat && cat.type
        ? cat.type
        : tx.amount >= 0
        ? "Income"
        : "Expense";

    if (type === "Income") totalIncome += tx.amount;
    else totalExpenses += tx.amount;
  });

  // Summary line
  var summary = document.createElement("div");
  summary.className = "income-summary";
  summary.textContent =
    "Total income: " +
    formatAmount(totalIncome) +
    " | Total expenses: " +
    formatAmount(totalExpenses);
  container.appendChild(summary);

  // Totals rolled up by category tree
  var incomeTotals = buildCategoryTotals("Income", filtered, catById);
  var expenseTotals = buildCategoryTotals("Expense", filtered, catById);

  // Panels
  var incomePanel = buildStatementPanel(
    "Income",
    incomeTotals,
    totalIncome,
    totalExpenses,
    catById
  );
  var expensePanel = buildStatementPanel(
    "Expenses",
    expenseTotals,
    totalIncome,
    totalExpenses,
    catById
  );

  container.appendChild(incomePanel);
  container.appendChild(expensePanel);
}

function buildCategoryTotals(type, filteredTxs, catById) {
  var totals = {};

  state.categories.forEach(function (c) {
    if (c.type === type) {
      totals[c.id] = 0;
    }
  });

  filteredTxs.forEach(function (tx) {
    var cat = catById[tx.categoryId];
    if (!cat || cat.type !== type) return;

    var current = cat;
    while (current) {
      totals[current.id] += tx.amount;
      current = current.parentId ? catById[current.parentId] : null;
    }
  });

  return totals;
}

function buildStatementPanel(title, totals, totalIncome, totalExpenses, catById) {
  var type = title === "Income" ? "Income" : "Expense";

  var panel = document.createElement("div");
  panel.className = "statement-panel";

  var heading = document.createElement("h3");
  heading.textContent = title;
  panel.appendChild(heading);

  var table = document.createElement("table");
  table.className = "statement-table";

  var thead = document.createElement("thead");
  var headRow = document.createElement("tr");

  var thCat = document.createElement("th");
  thCat.textContent = "Category";
  headRow.appendChild(thCat);

  var thAmount = document.createElement("th");
  thAmount.textContent = "Amount";
  headRow.appendChild(thAmount);

  var thPctIncome = document.createElement("th");
  thPctIncome.textContent = "% of income";
  headRow.appendChild(thPctIncome);

  if (type === "Expense") {
    var thPctExp = document.createElement("th");
    thPctExp.textContent = "% of expenses";
    headRow.appendChild(thPctExp);
  }

  thead.appendChild(headRow);
  table.appendChild(thead);

  var tbody = document.createElement("tbody");

  var cats = state.categories.filter(function (c) {
    return c.type === type;
  });

  var childrenMap = {};
  cats.forEach(function (c) {
    var key = c.parentId || "root";
    if (!childrenMap[key]) childrenMap[key] = [];
    childrenMap[key].push(c);
  });

  var roots = childrenMap["root"] || [];

  function hasNonZeroDesc(node) {
    if ((totals[node.id] || 0) !== 0) return true;
    var children = childrenMap[node.id] || [];
    for (var i = 0; i < children.length; i++) {
      if (hasNonZeroDesc(children[i])) return true;
    }
    return false;
  }

  function addRows(node, level) {
    if (!hasNonZeroDesc(node)) return;

    var amount = totals[node.id] || 0;

    var row = document.createElement("tr");

    var tdCat = document.createElement("td");
    tdCat.className = "stmt-cat";
    tdCat.style.paddingLeft = level * 18 + "px";
    tdCat.textContent = node.name;
    row.appendChild(tdCat);

    var tdAmt = document.createElement("td");
    tdAmt.textContent = formatAmount(amount);
    tdAmt.className =
      amount < 0 ? "amount-negative" : "amount-positive";
    row.appendChild(tdAmt);

    var tdPctInc = document.createElement("td");
    if (totalIncome !== 0) {
      var pctInc = (amount / totalIncome) * 100;
      tdPctInc.textContent = formatPercent(pctInc);
      tdPctInc.className =
        pctInc < 0 ? "percent-negative" : "percent-positive";
    } else {
      tdPctInc.textContent = "–";
    }
    row.appendChild(tdPctInc);

    if (type === "Expense") {
      var tdPctExp = document.createElement("td");
      if (totalExpenses !== 0) {
        var pctExp = (amount / totalExpenses) * 100;
        tdPctExp.textContent = formatPercent(pctExp);
        tdPctExp.className =
          pctExp < 0 ? "percent-negative" : "percent-positive";
      } else {
        tdPctExp.textContent = "–";
      }
      row.appendChild(tdPctExp);
    }

    tbody.appendChild(row);

    var children = childrenMap[node.id] || [];
    children.forEach(function (child) {
      addRows(child, level + 1);
    });
  }

  roots.forEach(function (root) {
    addRows(root, 0);
  });

  table.appendChild(tbody);
  panel.appendChild(table);

  return panel;
}

// ================== IMPORT (PocketSmith-style CSV) ==================
function setupImport() {
  console.log("setupImport");
  var fileInput = document.getElementById("import-file");
  var clearCheckbox = document.getElementById("import-clear-existing");
  var button = document.getElementById("import-button");
  var statusEl = document.getElementById("import-status");

  if (!fileInput || !button || !statusEl) {
    console.log("Import elements missing");
    return;
  }

  button.addEventListener("click", function () {
    console.log("Import button clicked");
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

        renderCategoryTrees();
        rerenderAll();

        statusEl.textContent =
          "Imported " + imported.length + " transactions successfully.";
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
  var idxConvAmt = idx([
    "amount in base currency",
    "amount (account)",
    "amount"
  ]);
  var idxCategory = idx(["category"]);
  var idxAccount = idx(["account"]);

  if (idxDate === -1 || idxDesc === -1 || idxConvAmt === -1) {
    throw new Error(
      "CSV headers not recognised (need at least Date, Description, Amount)."
    );
  }

  var txs = [];

  for (var i = 1; i < lines.length; i++) {
    var row = splitCsvLine(lines[i]);
    if (
      !row.length ||
      row.every(function (c) {
        return !c.trim();
      })
    )
      continue;

    function cell(index) {
      return index >= 0 && index < row.length ? row[index].trim() : "";
    }

    var rawDate = cell(idxDate);
    var description = cell(idxDesc);
    var convAmtStr = cell(idxConvAmt);
    var categoryName = cell(idxCategory);
    var account = cell(idxAccount);

    var amount = parseNumber(convAmtStr);
    var isoDate = normaliseDate(rawDate);
    var categoryId = ensureCategoryFromCsv(categoryName, amount);

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

// Create category when CSV brings a new one.
// Type inferred from amount sign (>=0 income, <0 expense).
function ensureCategoryFromCsv(name, amount) {
  if (!name) return null;
  var trimmed = name.trim();
  if (!trimmed) return null;

  var existing = state.categories.find(function (c) {
    return c.name === trimmed;
  });
  if (existing) return existing.id;

  var type = amount >= 0 ? "Income" : "Expense";
  var id = trimmed;
  var fullPath = trimmed;
  var cat = { id: id, name: trimmed, parentId: null, type: type, fullPath: fullPath };
  state.categories.push(cat);
  return id;
}

// ================== SHARED HELPERS ==================
function getFilteredTransactions() {
  var mode = state.dateFilter.mode;
  var from = state.dateFilter.from;
  var to = state.dateFilter.to;
  var today = new Date();

  var start, end;

  if (mode === "custom" && from && to) {
    start = new Date(from);
    end = new Date(to);
  } else {
    end = today;
    var startDate = new Date(today);
    if (mode === "1m") startDate.setMonth(startDate.getMonth() - 1);
    else if (mode === "3m") startDate.setMonth(startDate.getMonth() - 3);
    else if (mode === "6m") startDate.setMonth(startDate.getMonth() - 6);
    else if (mode === "ytd") startDate.setMonth(0, 1);
    start = startDate;
  }

  return state.transactions.filter(function (tx) {
    var d = new Date(tx.date);
    return d >= start && d <= end;
  });
}

function getCategoryName(categoryId) {
  var cat = state.categories.find(function (c) {
    return c.id === categoryId;
  });
  return cat ? cat.name : "Uncategorised";
}

function formatAmount(amount) {
  return Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatPercent(value) {
  return Number(value || 0).toFixed(2) + "%";
}

function rerenderAll() {
  renderTransactionsTable();
  renderIncomeStatement();
}

// ================== BOOTSTRAP ==================
document.addEventListener("DOMContentLoaded", function () {
  console.log("DOMContentLoaded fired");
  init();
});
