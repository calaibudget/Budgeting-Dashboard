console.log("App script loaded");

// ========== GLOBAL STATE ==========
var state = {
  transactions: [],
  categories: [],
  dateFilter: {
    mode: "6m",
    from: null,
    to: null,
  },
};

// Helper lookup maps (rebuilt whenever categories change)
var categoryById = {};
var ancestorsCache = {};

// ========== SAMPLE DATA ==========
function loadSampleData() {
  // Categories
  state.categories = [
    // INCOME
    { id: "Income", name: "Income", parentId: null, type: "Income" },
    {
      id: "Income > Base Salary",
      name: "Base Salary",
      parentId: "Income",
      type: "Income",
    },
    {
      id: "Income > Cashback",
      name: "Cashback",
      parentId: "Income",
      type: "Income",
    },
    {
      id: "Income > Per Diem",
      name: "Per Diem",
      parentId: "Income",
      type: "Income",
    },
    {
      id: "Income > Interest Income",
      name: "Interest Income",
      parentId: "Income",
      type: "Income",
    },
    {
      id: "Income > Transportation Allowance",
      name: "Transportation Allowance",
      parentId: "Income",
      type: "Income",
    },
    {
      id: "Income > Housing Allowance",
      name: "Housing Allowance",
      parentId: "Income",
      type: "Income",
    },

    // EXPENSES
    {
      id: "Food & Drinks",
      name: "Food & Drinks",
      parentId: null,
      type: "Expense",
    },
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

  // Transactions (one month’s toy data)
  state.transactions = [
    {
      id: 1,
      date: "2025-10-01",
      description: "September Salary",
      amount: 16000,
      categoryId: "Income > Base Salary",
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

  rebuildCategoryLookups();
}

// ========== LOOKUP HELPERS ==========
function rebuildCategoryLookups() {
  categoryById = {};
  ancestorsCache = {};
  state.categories.forEach(function (c) {
    categoryById[c.id] = c;
  });
}

function getCategoryById(id) {
  return categoryById[id] || null;
}

function getAncestorsIncludingSelf(catId) {
  if (!catId) return [];
  if (ancestorsCache[catId]) return ancestorsCache[catId].slice();

  var result = [];
  var current = categoryById[catId];
  while (current) {
    result.push(current.id);
    current = current.parentId ? categoryById[current.parentId] : null;
  }
  ancestorsCache[catId] = result.slice();
  return result;
}

// ========== INIT ==========
function init() {
  console.log("DOMContentLoaded fired");
  loadSampleData();
  setupTabs();
  setupPeriodFilter();
  setupCategoryEditors();
  setupImport();

  renderCategoryTrees();
  renderTransactionsTable();
  renderIncomeStatement();
  console.log("init() finished");
}

// ========== TABS ==========
function setupTabs() {
  var buttons = document.querySelectorAll(".tab-button");
  var panels = document.querySelectorAll(".tab-content");

  function activateTab(id) {
    panels.forEach(function (p) {
      p.classList.toggle("tab-content--active", p.id === id);
    });
    buttons.forEach(function (b) {
      b.classList.toggle(
        "tab-button--active",
        b.getAttribute("data-tab-target") === id
      );
    });
  }

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var target = btn.getAttribute("data-tab-target");
      activateTab(target);
    });
  });

  // Default: dashboard
  activateTab("tab-dashboard");
}

// ========== PERIOD FILTER (DASHBOARD) ==========
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

// ========== CATEGORY EDITORS ==========
function setupCategoryEditors() {
  console.log("setupCategoryEditors");
  var incomeEditor = document.getElementById("income-editor");
  var expenseEditor = document.getElementById("expense-editor");
  var btn = document.getElementById("update-categories");

  if (!incomeEditor || !expenseEditor || !btn) {
    console.log("Category editor elements missing");
    return;
  }

  // Prefill editors
  incomeEditor.value = buildCategoriesTextForType("Income");
  expenseEditor.value = buildCategoriesTextForType("Expense");

  btn.addEventListener("click", function () {
    console.log("Update categories clicked");

    var incomeText = incomeEditor.value || "";
    var expenseText = expenseEditor.value || "";

    var incomeCats = parseCategoriesText(incomeText, "Income");
    var expenseCats = parseCategoriesText(expenseText, "Expense");

    var all = incomeCats.concat(expenseCats);
    if (!all.length) {
      alert("No valid categories found. Please check your lists.");
      return;
    }

    state.categories = all;
    rebuildCategoryLookups();
    renderCategoryTrees();
    rerenderAll();
    alert("Categories updated: " + all.length);
  });
}

function buildCategoriesTextForType(type) {
  var filtered = state.categories.filter(function (c) {
    return c.type === type;
  });
  if (!filtered.length) return "";

  var childrenMap = {};
  filtered.forEach(function (c) {
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

  var roots = childrenMap["root"] || [];
  var lines = [];
  roots.forEach(function (root) {
    walk(root, 0, lines);
  });

  return lines.join("\n");
}

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

    var cat = {
      id: id,
      name: rawName,
      parentId: parentId,
      type: forcedType,
      path: path,
      level: level,
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
    });
  });

  return result;
}

// ========== CATEGORY TREES (VISUAL) ==========
function renderCategoryTrees() {
  var incomeContainer = document.getElementById("income-tree");
  var expenseContainer = document.getElementById("expense-tree");
  if (!incomeContainer || !expenseContainer) return;

  incomeContainer.innerHTML = "";
  expenseContainer.innerHTML = "";

  ["Income", "Expense"].forEach(function (type) {
    var container = type === "Income" ? incomeContainer : expenseContainer;
    var filtered = state.categories.filter(function (c) {
      return c.type === type;
    });

    var childrenMap = {};
    filtered.forEach(function (c) {
      var key = c.parentId || "root";
      if (!childrenMap[key]) childrenMap[key] = [];
      childrenMap[key].push(c);
    });

    var roots = childrenMap["root"] || [];
    roots.forEach(function (root) {
      renderCategoryNode(container, root, childrenMap, root.name, 0);
    });
  });
}

function renderCategoryNode(container, node, childrenMap, path, level) {
  var children = childrenMap[node.id] || [];
  var hasChildren = children.length > 0;

  var div = document.createElement("div");
  div.className = "category-node";
  div.style.paddingLeft = 12 + level * 16 + "px";

  var label = document.createElement("div");
  label.className = "category-node__label";
  label.textContent = node.name;

  var pathEl = document.createElement("div");
  pathEl.className = "category-node__path";
  pathEl.textContent = path;

  div.appendChild(label);
  if (path !== node.name) {
    div.appendChild(pathEl);
  }

  container.appendChild(div);

  if (hasChildren) {
    children.forEach(function (child) {
      renderCategoryNode(
        container,
        child,
        childrenMap,
        path + " › " + child.name,
        level + 1
      );
    });
  }
}

// ========== TRANSACTIONS TABLE ==========
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
      "tx-amount " + (tx.amount < 0 ? "amount-negative" : "amount-positive");

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

// ========== INCOME STATEMENT ==========
function renderIncomeStatement() {
  var container = document.getElementById("income-statement");
  if (!container) return;
  container.innerHTML = "";

  var filtered = getFilteredTransactions();

  if (!filtered.length) {
    container.textContent = "No transactions in the selected period.";
    return;
  }

  // Aggregate amounts per category (including ancestors)
  var incomeAgg = {};
  var expenseAgg = {};

  filtered.forEach(function (tx) {
    var cat = getCategoryById(tx.categoryId);
    var type =
      cat && cat.type
        ? cat.type
        : tx.amount >= 0
        ? "Income"
        : "Expense";

    var agg = type === "Income" ? incomeAgg : expenseAgg;

    if (cat) {
      var ids = getAncestorsIncludingSelf(cat.id);
      ids.forEach(function (id) {
        agg[id] = (agg[id] || 0) + tx.amount;
      });
    } else {
      var key = type === "Income" ? "__unassigned_income" : "__unassigned_expense";
      agg[key] = (agg[key] || 0) + tx.amount;
    }
  });

  // Create pseudo categories for unassigned if needed
  if (incomeAgg["__unassigned_income"]) {
    state.categories.push({
      id: "__unassigned_income",
      name: "Uncategorised income",
      parentId: null,
      type: "Income",
    });
    rebuildCategoryLookups();
  }
  if (expenseAgg["__unassigned_expense"]) {
    state.categories.push({
      id: "__unassigned_expense",
      name: "Uncategorised expenses",
      parentId: null,
      type: "Expense",
    });
    rebuildCategoryLookups();
  }

  // Totals
  var totalIncome = 0;
  var totalExpenses = 0;

  Object.keys(incomeAgg).forEach(function (id) {
    var cat = getCategoryById(id);
    if (cat && cat.parentId === null && cat.type === "Income") {
      totalIncome += incomeAgg[id];
    }
  });
  Object.keys(expenseAgg).forEach(function (id) {
    var cat = getCategoryById(id);
    if (cat && cat.parentId === null && cat.type === "Expense") {
      totalExpenses += expenseAgg[id];
    }
  });

  var net = totalIncome + totalExpenses;
  var savingRate = totalIncome ? (net / totalIncome) * 100 : null;

  // Summary line
  var summary = document.createElement("div");
  summary.className = "summary-line";
  summary.innerHTML =
    "Total income: <span class='amount-positive'>" +
    formatAmount(totalIncome) +
    "</span> | Total expenses: <span class='" +
    (totalExpenses < 0 ? "amount-negative" : "amount-positive") +
    "'>" +
    formatAmount(totalExpenses) +
    "</span> | Net: <span class='" +
    (net < 0 ? "amount-negative" : "amount-positive") +
    "'>" +
    formatAmount(net) +
    "</span>" +
    (savingRate !== null
      ? " | Saving rate: <span>" + savingRate.toFixed(2) + "%</span>"
      : "");
  container.appendChild(summary);

  // Income section
  var incomeSection = document.createElement("div");
  incomeSection.className = "panel-section";

  var inTitle = document.createElement("h3");
  inTitle.textContent = "Income";
  incomeSection.appendChild(inTitle);

  var incomeTable = document.createElement("table");
  incomeTable.className = "statement-table";
  var inHead = document.createElement("thead");
  inHead.innerHTML =
    "<tr><th>Category</th><th class='col-amount'>Amount</th><th class='col-percent'>% of income</th></tr>";
  incomeTable.appendChild(inHead);
  var inBody = document.createElement("tbody");
  incomeTable.appendChild(inBody);
  incomeSection.appendChild(incomeTable);
  container.appendChild(incomeSection);

  // Expense section
  var expenseSection = document.createElement("div");
  expenseSection.className = "panel-section panel-section--spaced";

  var exTitle = document.createElement("h3");
  exTitle.textContent = "Expenses";
  expenseSection.appendChild(exTitle);

  var expenseTable = document.createElement("table");
  expenseTable.className = "statement-table";
  var exHead = document.createElement("thead");
  exHead.innerHTML =
    "<tr><th>Category</th><th class='col-amount'>Amount</th><th class='col-percent'>% of income</th><th class='col-percent'>% of expenses</th></tr>";
  expenseTable.appendChild(exHead);
  var exBody = document.createElement("tbody");
  expenseTable.appendChild(exBody);
  expenseSection.appendChild(expenseTable);
  container.appendChild(expenseSection);

  // Render trees
  renderStatementGroup("Income", incomeAgg, totalIncome, inBody);
  renderStatementGroup("Expense", expenseAgg, totalExpenses, exBody, totalIncome);
}

function renderStatementGroup(
  type,
  agg,
  totalForType,
  tbody,
  totalIncomeForExpenses
) {
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

  roots.forEach(function (root) {
    renderStatementNode(
      root,
      0,
      agg,
      totalForType,
      totalIncomeForExpenses,
      tbody,
      childrenMap,
      type
    );
  });
}

function renderStatementNode(
  cat,
  level,
  agg,
  totalForType,
  totalIncomeForExpenses,
  tbody,
  childrenMap,
  type
) {
  var amount = agg[cat.id] || 0;
  if (amount === 0) {
    // skip categories with no activity
    var children = childrenMap[cat.id] || [];
    children.forEach(function (child) {
      renderStatementNode(
        child,
        level + 1,
        agg,
        totalForType,
        totalIncomeForExpenses,
        tbody,
        childrenMap,
        type
      );
    });
    return;
  }

  var tr = document.createElement("tr");

  var nameTd = document.createElement("td");
  nameTd.textContent = cat.name;
  nameTd.style.paddingLeft = 12 + level * 16 + "px";
  tr.appendChild(nameTd);

  var amountTd = document.createElement("td");
  amountTd.className =
    "col-amount " +
    (amount < 0 ? "amount-negative" : "amount-positive");
  amountTd.textContent = formatAmount(amount);
  tr.appendChild(amountTd);

  var percentOfIncomeTd = document.createElement("td");
  percentOfIncomeTd.className = "col-percent";
  var divBase =
    type === "Income" ? totalForType : totalIncomeForExpenses || 0;
  var pctIncome =
    divBase ? ((amount / divBase) * 100).toFixed(2) + "%" : "-";
  percentOfIncomeTd.textContent = pctIncome;
  tr.appendChild(percentOfIncomeTd);

  if (type === "Expense") {
    var percentOfExpensesTd = document.createElement("td");
    percentOfExpensesTd.className = "col-percent";
    var pctExp =
      totalForType ? ((amount / totalForType) * 100).toFixed(2) + "%" : "-";
    percentOfExpensesTd.textContent = pctExp;
    tr.appendChild(percentOfExpensesTd);
  }

  tbody.appendChild(tr);

  var children = childrenMap[cat.id] || [];
  children.forEach(function (child) {
    renderStatementNode(
      child,
      level + 1,
      agg,
      totalForType,
      totalIncomeForExpenses,
      tbody,
      childrenMap,
      type
    );
  });
}

// ========== IMPORT (CSV) ==========
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
    "amount",
  ]);
  var idxCategory = idx(["category"]);

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

    var amount = parseNumber(convAmtStr);
    var isoDate = normaliseDate(rawDate);
    var categoryId = ensureCategoryFromCsv(categoryName);

    txs.push({
      id: null,
      date: isoDate,
      description: description,
      amount: amount,
      categoryId: categoryId,
      labels: [],
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

function ensureCategoryFromCsv(name) {
  if (!name) return null;
  var trimmed = name.trim();
  if (!trimmed) return null;

  var existing = state.categories.find(function (c) {
    return c.name === trimmed;
  });
  if (existing) return existing.id;

  // Default: treat as Expense if amount is negative later, but we don't know here.
  var id = trimmed;
  var cat = { id: id, name: trimmed, parentId: null, type: "Expense" };
  state.categories.push(cat);
  rebuildCategoryLookups();
  return id;
}

// ========== SHARED HELPERS ==========
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
  var cat = getCategoryById(categoryId);
  return cat ? cat.name : "Uncategorised";
}

function formatAmount(amount) {
  return Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function rerenderAll() {
  renderIncomeStatement();
  renderTransactionsTable();
}

// ========== BOOTSTRAP ==========
document.addEventListener("DOMContentLoaded", init);
