// app.js
console.log("App script loaded");

// ========================= STATE =========================

var state = {
  transactions: [],
  categories: [],
  nextTxId: 1,
  dateFilter: {
    mode: "6m", // 1m, 3m, 6m, ytd, custom
    from: null,
    to: null,
  },
};

// ========================= SAMPLE DATA =========================

function loadSampleData() {
  console.log("loadSampleData");

  // Category model:
  // id: string, name: string, parentId: string|null, type: "Income"|"Expense"
  state.categories = [
    // ---- Income ----
    { id: "Base Salary", name: "Base Salary", parentId: null, type: "Income" },
    {
      id: "Cashback",
      name: "Cashback",
      parentId: null,
      type: "Income",
    },
    {
      id: "Per Diem",
      name: "Per Diem",
      parentId: null,
      type: "Income",
    },
    {
      id: "Interest Income",
      name: "Interest Income",
      parentId: null,
      type: "Income",
    },
    {
      id: "Transportation Allowance",
      name: "Transportation Allowance",
      parentId: null,
      type: "Income",
    },
    {
      id: "Housing Allowance",
      name: "Housing Allowance",
      parentId: null,
      type: "Income",
    },

    // ---- Expenses ----
    { id: "Food & Drinks", name: "Food & Drinks", parentId: null, type: "Expense" },
    {
      id: "Food & Drinks > Groceries",
      name: "Groceries",
      parentId: "Food & Drinks",
      type: "Expense",
    },
    {
      id: "Food & Drinks > Restaurants",
      name: "Restaurants",
      parentId: "Food & Drinks",
      type: "Expense",
    },
    {
      id: "Food & Drinks > Food Delivery",
      name: "Food Delivery",
      parentId: "Food & Drinks",
      type: "Expense",
    },

    {
      id: "Life & Entertainment",
      name: "Life & Entertainment",
      parentId: null,
      type: "Expense",
    },
    {
      id: "Life & Entertainment > Gifts",
      name: "Gifts",
      parentId: "Life & Entertainment",
      type: "Expense",
    },
  ];

  // Transactions
  state.transactions = [
    {
      id: 1,
      date: "2025-10-01",
      description: "September Salary",
      amount: 16000,
      categoryId: "Base Salary",
      labels: ["Work"],
    },
    {
      id: 2,
      date: "2025-10-03",
      description: "Dinner out",
      amount: -210,
      categoryId: "Food & Drinks > Restaurants",
      labels: ["Food"],
    },
    {
      id: 3,
      date: "2025-10-04",
      description: "Food delivery",
      amount: -95,
      categoryId: "Food & Drinks > Food Delivery",
      labels: ["Food", "Delivery"],
    },
    {
      id: 4,
      date: "2025-09-29",
      description: "Gift for friend",
      amount: -150,
      categoryId: "Life & Entertainment > Gifts",
      labels: ["Gift"],
    },
  ];

  state.nextTxId = 5;
}

// ========================= INIT =========================

function init() {
  console.log("init() starting");

  loadSampleData();
  setupTabs();
  setupPeriodFilter();
  setupCategoryEditor();
  setupImport();

  renderAll();

  console.log("init() finished");
}

function renderAll() {
  renderIncomeStatement();
  renderTransactionsTable();
  renderCategoryTree();
}

// ========================= TAB HANDLING =========================

function setupTabs() {
  var tabButtons = document.querySelectorAll("[data-tab-target]");
  var tabPanels = document.querySelectorAll(".tab-panel");

  if (!tabButtons.length || !tabPanels.length) return;

  tabButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var target = btn.getAttribute("data-tab-target");
      tabButtons.forEach(function (b) {
        b.classList.toggle("tab-button--active", b === btn);
      });
      tabPanels.forEach(function (panel) {
        panel.classList.toggle(
          "tab-panel--active",
          panel.getAttribute("data-tab") === target
        );
      });
    });
  });
}

// ========================= PERIOD FILTER =========================

function setupPeriodFilter() {
  var select = document.getElementById("period-select");
  var customRange = document.getElementById("custom-range");
  var fromInput = document.getElementById("date-from");
  var toInput = document.getElementById("date-to");

  if (!select) return;

  select.addEventListener("change", function () {
    state.dateFilter.mode = select.value;
    if (select.value === "custom") {
      customRange.classList.remove("hidden");
    } else {
      customRange.classList.add("hidden");
      state.dateFilter.from = null;
      state.dateFilter.to = null;
      renderAll();
    }
  });

  if (fromInput) {
    fromInput.addEventListener("change", function () {
      state.dateFilter.from = fromInput.value || null;
      renderAll();
    });
  }

  if (toInput) {
    toInput.addEventListener("change", function () {
      state.dateFilter.to = toInput.value || null;
      renderAll();
    });
  }

  select.value = state.dateFilter.mode;
}

// ========================= CATEGORY EDITOR =========================

function setupCategoryEditor() {
  var editor = document.getElementById("categories-editor");
  var applyBtn = document.getElementById("apply-categories");

  if (!editor || !applyBtn) return;

  editor.value = buildCategoriesTextFromState();

  applyBtn.addEventListener("click", function () {
    var text = editor.value || "";
    var cats = parseCategoriesText(text);
    if (!cats.length) {
      alert("No valid categories found. Please check your list.");
      return;
    }
    state.categories = cats;
    renderAll();
    alert("Categories updated: " + cats.length);
  });
}

// dashed text -> state.categories
function parseCategoriesText(text) {
  if (!text || !text.trim()) return [];

  var rawLines = text.split("\n");
  var lines = [];
  rawLines.forEach(function (l) {
    var line = l.replace(/\r/g, "");
    if (line.trim() !== "") lines.push(line);
  });

  var resultsWithMeta = [];
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
    var parentId = parentMeta ? parentMeta.id : null;
    var fullId = parentMeta ? parentMeta.id + " > " + rawName : rawName;
    var type = inferCategoryType(rawName, parentMeta);

    var node = {
      id: fullId,
      name: rawName,
      parentId: parentId,
      type: type,
      level: level,
    };

    resultsWithMeta.push(node);
    lastByLevel[level] = node;
  });

  var finalCats = resultsWithMeta.map(function (n) {
    return {
      id: n.id,
      name: n.name,
      parentId: n.parentId,
      type: n.type,
    };
  });

  return finalCats;
}

// state.categories -> dashed text
function buildCategoriesTextFromState() {
  if (!state.categories.length) return "";

  var childrenMap = {};
  state.categories.forEach(function (c) {
    var key = c.parentId || "root";
    if (!childrenMap[key]) childrenMap[key] = [];
    childrenMap[key].push(c);
  });

  function walk(node, level, lines) {
    var prefix = level > 0 ? Array(level + 1).join("-") : "";
    lines.push(prefix + node.name);
    var children = childrenMap[node.id] || [];
    children.forEach(function (child) {
      walk(child, level + 1, lines);
    });
  }

  var lines = [];
  var roots = childrenMap["root"] || [];
  roots.forEach(function (root) {
    walk(root, 0, lines);
  });

  return lines.join("\n");
}

// Simple heuristic: detect Income vs Expense
function inferCategoryType(name, parentMeta) {
  var parentName = parentMeta ? parentMeta.name : "";
  var text = (parentName + " " + name).toLowerCase();
  if (
    text.indexOf("income") >= 0 ||
    text.indexOf("salary") >= 0 ||
    text.indexOf("bonus") >= 0 ||
    text.indexOf("allowance") >= 0 ||
    text.indexOf("cashback") >= 0 ||
    text.indexOf("per diem") >= 0 ||
    text.indexOf("interest") >= 0
  ) {
    return "Income";
  }
  return "Expense";
}

// ========================= CATEGORY TREE (visual only) =========================

function renderCategoryTree() {
  var incomeContainer = document.getElementById("income-category-tree");
  var expenseContainer = document.getElementById("expense-category-tree");
  if (!incomeContainer || !expenseContainer) return;

  incomeContainer.innerHTML = "";
  expenseContainer.innerHTML = "";

  var incomeCats = state.categories.filter(function (c) {
    return c.type === "Income";
  });
  var expenseCats = state.categories.filter(function (c) {
    return c.type === "Expense";
  });

  renderCategoryTreeForType(incomeContainer, incomeCats);
  renderCategoryTreeForType(expenseContainer, expenseCats);
}

function renderCategoryTreeForType(container, cats) {
  var childrenMap = {};
  cats.forEach(function (c) {
    var key = c.parentId || "root";
    if (!childrenMap[key]) childrenMap[key] = [];
    childrenMap[key].push(c);
  });

  var roots = childrenMap["root"] || [];

  function renderNode(node, level) {
    var row = document.createElement("div");
    row.className = "category-tree__row";
    row.style.paddingLeft = 16 * level + "px";
    row.textContent = node.name;
    container.appendChild(row);

    var children = childrenMap[node.id] || [];
    children.forEach(function (child) {
      renderNode(child, level + 1);
    });
  }

  roots.forEach(function (root) {
    renderNode(root, 0);
  });
}

// ========================= INCOME STATEMENT =========================

function renderIncomeStatement() {
  var container = document.getElementById("income-statement");
  if (!container) return;
  container.innerHTML = "";

  var filtered = getFilteredTransactions();

  var totals = computeIncomeExpenseTotals(filtered);
  var incomeTotal = totals.income; // >=0
  var expenseTotal = totals.expense; // <=0
  var expenseAbs = Math.abs(expenseTotal);
  var net = incomeTotal + expenseTotal;
  var savingRate =
    incomeTotal > 0 ? (net / incomeTotal) * 100 : null;

  // Summary line (income, expenses, net, saving rate)
  var summary = document.createElement("div");
  summary.className = "income-summary";
  summary.innerHTML =
    '<span>Total income: <strong>' +
    formatAmount(incomeTotal) +
    "</strong></span>" +
    '<span>Total expenses: <strong>' +
    formatAmount(expenseAbs) +
    "</strong></span>" +
    '<span>Net: <strong class="' +
    (net >= 0 ? "value-positive" : "value-negative") +
    '">' +
    formatAmount(net) +
    "</strong></span>" +
    '<span>Saving rate: <strong>' +
    (savingRate === null ? "—" : formatPercent(savingRate)) +
    "</strong></span>";
  container.appendChild(summary);

  // Build hierarchical aggregates for income & expenses
  var incomeAgg = aggregateByCategoryType(filtered, "Income");
  var expenseAgg = aggregateByCategoryType(filtered, "Expense");

  // ----- Income table -----
  var incomeSection = document.createElement("div");
  incomeSection.className = "income-section";

  var incomeTitle = document.createElement("h3");
  incomeTitle.textContent = "Income";
  incomeSection.appendChild(incomeTitle);

  var incomeTable = document.createElement("table");
  incomeTable.className = "statement-table";

  var thead = document.createElement("thead");
  thead.innerHTML =
    "<tr>" +
    "<th class='col-category'>Category</th>" +
    "<th class='col-amount'>Amount</th>" +
    "<th class='col-percent'>% of income</th>" +
    "</tr>";
  incomeTable.appendChild(thead);

  var tbody = document.createElement("tbody");
  incomeAgg.rows.forEach(function (row) {
    if (Math.abs(row.amount) < 0.005) return; // skip zeros
    var tr = document.createElement("tr");

    var catTd = document.createElement("td");
    catTd.className = "col-category";
    catTd.style.paddingLeft = 16 * row.level + "px";
    catTd.textContent = row.name;

    var amtTd = document.createElement("td");
    amtTd.className =
      "col-amount " + (row.amount >= 0 ? "value-positive" : "value-negative");
    amtTd.textContent = formatAmount(row.amount);

    var pctIncome =
      incomeTotal > 0 ? (row.amount / incomeTotal) * 100 : 0;
    var pctIncomeTd = document.createElement("td");
    pctIncomeTd.className = "col-percent";
    pctIncomeTd.textContent = formatPercent(pctIncome);

    tr.appendChild(catTd);
    tr.appendChild(amtTd);
    tr.appendChild(pctIncomeTd);
    tbody.appendChild(tr);
  });
  incomeTable.appendChild(tbody);
  incomeSection.appendChild(incomeTable);

  // ----- Expenses table -----
  var expenseSection = document.createElement("div");
  expenseSection.className = "expense-section";

  var expenseTitle = document.createElement("h3");
  expenseTitle.textContent = "Expenses";
  expenseSection.appendChild(expenseTitle);

  var expTable = document.createElement("table");
  expTable.className = "statement-table";

  var expHead = document.createElement("thead");
  expHead.innerHTML =
    "<tr>" +
    "<th class='col-category'>Category</th>" +
    "<th class='col-amount'>Amount</th>" +
    "<th class='col-percent'>% of income</th>" +
    "<th class='col-percent'>% of expenses</th>" +
    "</tr>";
  expTable.appendChild(expHead);

  var expBody = document.createElement("tbody");
  expenseAgg.rows.forEach(function (row) {
    if (Math.abs(row.amount) < 0.005) return;
    var tr = document.createElement("tr");

    var catTd = document.createElement("td");
    catTd.className = "col-category";
    catTd.style.paddingLeft = 16 * row.level + "px";
    catTd.textContent = row.name;

    var amtTd = document.createElement("td");
    amtTd.className =
      "col-amount " + (row.amount >= 0 ? "value-positive" : "value-negative");
    amtTd.textContent = formatAmount(row.amount);

    // For % of income, use absolute expenses vs income (positive)
    var pctIncome =
      incomeTotal > 0 ? (Math.abs(row.amount) / incomeTotal) * 100 : 0;
    var pctIncomeTd = document.createElement("td");
    pctIncomeTd.className =
      "col-percent " + (row.amount >= 0 ? "value-positive" : "value-negative");
    pctIncomeTd.textContent = formatPercent(pctIncome);

    // For % of expenses, sign shows inflow vs outflow
    var pctExp = expenseAbs > 0 ? (row.amount / expenseTotal) * 100 : 0; // expenseTotal is negative
    var pctExpTd = document.createElement("td");
    pctExpTd.className =
      "col-percent " + (pctExp >= 0 ? "value-positive" : "value-negative");
    pctExpTd.textContent = formatPercent(pctExp);

    tr.appendChild(catTd);
    tr.appendChild(amtTd);
    tr.appendChild(pctIncomeTd);
    tr.appendChild(pctExpTd);
    expBody.appendChild(tr);
  });
  expTable.appendChild(expBody);
  expenseSection.appendChild(expTable);

  // Append both sections
  container.appendChild(incomeSection);
  container.appendChild(expenseSection);
}

// Compute total income / total expenses for a set of transactions
function computeIncomeExpenseTotals(transactions) {
  var income = 0;
  var expense = 0;

  transactions.forEach(function (tx) {
    var cat = getCategory(tx.categoryId);
    var type = cat ? cat.type : tx.amount >= 0 ? "Income" : "Expense";
    if (type === "Income") {
      income += tx.amount;
    } else {
      expense += tx.amount;
    }
  });

  return { income: income, expense: expense };
}

// Build hierarchical aggregates for a specific type
function aggregateByCategoryType(transactions, type) {
  var sums = {}; // categoryId -> amount

  // Parent lookup
  var catsOfType = state.categories.filter(function (c) {
    return c.type === type;
  });
  var catMap = {};
  catsOfType.forEach(function (c) {
    catMap[c.id] = c;
  });

  function addToCategoryAndAncestors(cat, amount) {
    var current = cat;
    while (current && current.type === type) {
      sums[current.id] = (sums[current.id] || 0) + amount;
      current = current.parentId ? catMap[current.parentId] : null;
    }
  }

  transactions.forEach(function (tx) {
    var cat = getCategory(tx.categoryId);
    var txType = cat ? cat.type : tx.amount >= 0 ? "Income" : "Expense";
    if (!cat || txType !== type) return;
    addToCategoryAndAncestors(cat, tx.amount);
  });

  // Build tree, determine levels
  var childrenMap = {};
  catsOfType.forEach(function (c) {
    var key = c.parentId || "root";
    if (!childrenMap[key]) childrenMap[key] = [];
    childrenMap[key].push(c);
  });

  var rows = [];
  function visit(node, level) {
    var amount = sums[node.id] || 0;
    if (Math.abs(amount) >= 0.005) {
      rows.push({
        id: node.id,
        name: node.name,
        level: level,
        amount: amount,
      });
    }
    var children = childrenMap[node.id] || [];
    children.forEach(function (child) {
      visit(child, level + 1);
    });
  }

  var roots = childrenMap["root"] || [];
  roots.forEach(function (root) {
    visit(root, 0);
  });

  return { rows: rows };
}

// ========================= TRANSACTIONS TABLE =========================

function renderTransactionsTable() {
  var tbody = document.getElementById("transactions-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  var filtered = getFilteredTransactions();

  // newest first
  filtered.sort(function (a, b) {
    return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
  });

  filtered.forEach(function (tx) {
    var tr = document.createElement("tr");

    var selectTd = document.createElement("td");
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
    amountTd.className =
      tx.amount >= 0 ? "value-positive" : "value-negative";
    amountTd.textContent = formatAmount(tx.amount);

    var catTd = document.createElement("td");
    catTd.textContent = getCategoryName(tx.categoryId);

    var labelsTd = document.createElement("td");
    labelsTd.textContent = (tx.labels || []).join(", ");

    tr.appendChild(selectTd);
    tr.appendChild(dateTd);
    tr.appendChild(descTd);
    tr.appendChild(amountTd);
    tr.appendChild(catTd);
    tr.appendChild(labelsTd);

    tbody.appendChild(tr);
  });
}

// ========================= IMPORT (CSV) =========================

function setupImport() {
  var fileInput = document.getElementById("import-file");
  var clearCheckbox = document.getElementById("import-clear-existing");
  var button = document.getElementById("import-button");
  var statusEl = document.getElementById("import-status");

  if (!fileInput || !button || !statusEl) return;

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

        var maxId = state.nextTxId || 1;
        imported.forEach(function (tx, idx) {
          tx.id = maxId + idx;
        });
        state.nextTxId = maxId + imported.length;

        if (clearCheckbox && clearCheckbox.checked) {
          state.transactions = imported;
        } else {
          state.transactions = state.transactions.concat(imported);
        }

        renderAll();
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

// Very lightweight CSV parser for PocketSmith-like exports
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
  var idxConvAmt = idx(["amount in base currency", "amount (account)", "amount"]);
  var idxCategory = idx(["category"]);
  var idxLabels = idx(["labels", "tags"]);

  if (idxDate === -1 || idxDesc === -1 || idxConvAmt === -1) {
    throw new Error("CSV headers not recognised (need at least Date, Description, Amount).");
  }

  var txs = [];

  for (var i = 1; i < lines.length; i++) {
    var row = splitCsvLine(lines[i]);
    if (!row.length || row.every(function (c) { return !c.trim(); })) continue;

    function cell(index) {
      return index >= 0 && index < row.length ? row[index].trim() : "";
    }

    var rawDate = cell(idxDate);
    var description = cell(idxDesc);
    var convAmtStr = cell(idxConvAmt);
    var categoryName = cell(idxCategory);
    var labelsStr = cell(idxLabels);

    var amount = parseNumber(convAmtStr);
    var isoDate = normaliseDate(rawDate);
    var categoryId = ensureCategoryFromCsv(categoryName, amount);
    var labels = labelsStr
      ? labelsStr.split(/[;,]/).map(function (s) { return s.trim(); }).filter(Boolean)
      : [];

    txs.push({
      id: null,
      date: isoDate,
      description: description,
      amount: amount,
      categoryId: categoryId,
      labels: labels,
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

function ensureCategoryFromCsv(name, amount) {
  var trimmed = (name || "").trim();
  if (!trimmed) {
    // fallback category by sign
    trimmed = amount >= 0 ? "Uncategorised Income" : "Uncategorised Expense";
  }

  var existing = state.categories.find(function (c) {
    return c.name === trimmed;
  });
  if (existing) return existing.id;

  var type = inferCategoryType(trimmed, null);
  var cat = {
    id: trimmed,
    name: trimmed,
    parentId: null,
    type: type,
  };
  state.categories.push(cat);
  return cat.id;
}

// ========================= SHARED HELPERS =========================

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

function getCategory(id) {
  if (!id) return null;
  return state.categories.find(function (c) {
    return c.id === id;
  }) || null;
}

function getCategoryName(categoryId) {
  var cat = getCategory(categoryId);
  return cat ? cat.name : "Uncategorised";
}

function formatAmount(amount) {
  return Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value) {
  return Number(value || 0).toFixed(2) + "%";
}

// ========================= BOOTSTRAP =========================

document.addEventListener("DOMContentLoaded", function () {
  console.log("DOMContentLoaded fired");
  init();
});
