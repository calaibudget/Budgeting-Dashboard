console.log("App script loaded");

// ========== STATE ==========
var state = {
  transactions: [],
  categories: [],
  dateFilter: {
    mode: "6m", // default
    from: null,
    to: null,
  },
};

// ========== SAMPLE DATA ==========
function loadSampleData() {
  console.log("loadSampleData");

  state.categories = [
    { id: "Income", name: "Income", parentId: null, type: "Income" },
    {
      id: "Income > Base Salary",
      name: "Base Salary",
      parentId: "Income",
      type: "Income",
    },
    {
      id: "Income > Performance Bonus",
      name: "Performance Bonus",
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

  state.transactions = [
    {
      id: 1,
      date: "2025-10-01",
      description: "September Salary",
      amount: 16000,
      categoryId: "Income > Base Salary",
      account: "Salary Account",
      labels: ["Work"],
    },
    {
      id: 2,
      date: "2025-10-03",
      description: "Dinner out",
      amount: -210,
      categoryId: "Food & Drinks > Restaurants",
      account: "Current Account",
      labels: ["Food"],
    },
    {
      id: 3,
      date: "2025-10-04",
      description: "Food delivery",
      amount: -95,
      categoryId: "Food & Drinks > Food Delivery",
      account: "Current Account",
      labels: ["Food", "Delivery"],
    },
    {
      id: 4,
      date: "2025-09-29",
      description: "Gift for friend",
      amount: -150,
      categoryId: "Life & Entertainment > Gifts",
      account: "Current Account",
      labels: ["Gift"],
    },
  ];
}

// ========== INIT ==========
function init() {
  console.log("init() starting");

  loadSampleData();
  setupPeriodFilter();
  setupCategoryEditor();
  setupImport();

  renderCategoryTree();
  renderTransactionsTable();
  renderIncomeStatement();

  console.log("init() finished");
}

// ========== PERIOD FILTER ==========
function setupPeriodFilter() {
  console.log("setupPeriodFilter");
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

// ========== CATEGORY EDITOR ==========
function setupCategoryEditor() {
  console.log("setupCategoryEditor");
  var editor = document.getElementById("categories-editor");
  var applyBtn = document.getElementById("apply-categories");

  if (!editor || !applyBtn) {
    console.log("Category editor elements missing");
    return;
  }

  editor.value = buildCategoriesTextFromState();

  applyBtn.addEventListener("click", function () {
    console.log("apply-categories clicked");
    var text = editor.value || "";
    var categories = parseCategoriesText(text);

    if (!categories.length) {
      alert("No valid categories found. Please check your list.");
      return;
    }

    state.categories = categories;
    renderCategoryTree();
    rerenderAll();
    alert("Categories updated: " + categories.length);
  });
}

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

  var roots = childrenMap["root"] || [];
  var lines = [];
  roots.forEach(function (root) {
    walk(root, 0, lines);
  });

  return lines.join("\n");
}

function parseCategoriesText(text) {
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
    var type = inferCategoryType(rawName, parentMeta);

    var cat = {
      id: id,
      name: rawName,
      parentId: parentId,
      type: type,
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

function inferCategoryType(name, parentMeta) {
  var parentName = parentMeta ? parentMeta.name : "";
  var text = (parentName + " " + name).toLowerCase();
  if (
    text.indexOf("income") >= 0 ||
    text.indexOf("salary") >= 0 ||
    text.indexOf("bonus") >= 0 ||
    text.indexOf("allowance") >= 0 ||
    text.indexOf("per diem") >= 0 ||
    text.indexOf("cashback") >= 0 ||
    text.indexOf("interest") >= 0
  ) {
    return "Income";
  }
  return "Expense";
}

// ========== CATEGORY TREE (visual only) ==========
function renderCategoryTree() {
  var container = document.getElementById("category-tree");
  if (!container) return;
  container.innerHTML = "";

  var childrenMap = {};
  state.categories.forEach(function (c) {
    var key = c.parentId || "root";
    if (!childrenMap[key]) childrenMap[key] = [];
    childrenMap[key].push(c);
  });

  var roots = childrenMap["root"] || [];
  roots.forEach(function (root) {
    renderCategoryNode(container, root, childrenMap, root.name);
  });
}

function renderCategoryNode(container, node, childrenMap, path) {
  var children = childrenMap[node.id] || [];
  var hasChildren = children.length > 0;

  var div = document.createElement("div");
  div.className =
    "category-node" +
    (node.type === "Income" ? " category-node--income" : " category-node--expense") +
    (hasChildren ? "" : " leaf");

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

  children.forEach(function (child) {
    renderCategoryNode(
      container,
      child,
      childrenMap,
      path + " › " + child.name
    );
  });
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
    tr.classList.add("draggable");
    tr.setAttribute("draggable", "true");
    tr.setAttribute("data-transaction-id", String(tx.id));

    tr.addEventListener("dragstart", handleTransactionDragStart);
    tr.addEventListener("dragend", handleTransactionDragEnd);

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
    if (tx.amount < 0) {
      amountTd.classList.add("amount-negative");
    } else if (tx.amount > 0) {
      amountTd.classList.add("amount-positive");
    }

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
  var summaryEl = document.getElementById("income-summary");
  if (!container) return;

  container.innerHTML = "";

  var filtered = getFilteredTransactions();

  var incomeByCat = {};
  var expenseByCat = {};

  filtered.forEach(function (tx) {
    var type = getCategoryType(tx.categoryId);
    if (!type) type = tx.amount >= 0 ? "Income" : "Expense";

    if (type === "Income") {
      if (!incomeByCat[tx.categoryId]) incomeByCat[tx.categoryId] = 0;
      incomeByCat[tx.categoryId] += tx.amount;
    } else {
      if (!expenseByCat[tx.categoryId]) expenseByCat[tx.categoryId] = 0;
      expenseByCat[tx.categoryId] += tx.amount;
    }
  });

  var totalIncome = 0;
  Object.keys(incomeByCat).forEach(function (id) {
    totalIncome += incomeByCat[id];
  });

  var totalExpenses = 0;
  Object.keys(expenseByCat).forEach(function (id) {
    totalExpenses += expenseByCat[id];
  });

  var net = totalIncome + totalExpenses;
  var savingRate = totalIncome ? (net / totalIncome) * 100 : 0;

  if (summaryEl) {
    summaryEl.textContent =
      "Total income: " +
      formatAmount(totalIncome) +
      " | Total expenses: " +
      formatAmount(totalExpenses) +
      " | Net: " +
      formatAmount(net) +
      " | Saving rate: " +
      savingRate.toFixed(1) +
      "%";
  }

  // ---- Income section ----
  var incomeCard = document.createElement("div");
  incomeCard.className = "income-group";

  var incomeTitle = document.createElement("div");
  incomeTitle.className = "income-group__title";
  incomeTitle.textContent = "Income";
  incomeCard.appendChild(incomeTitle);

  Object.keys(incomeByCat).forEach(function (id) {
    var amount = incomeByCat[id];
    if (amount === 0) return;

    var pctOfIncome =
      totalIncome ? (amount / totalIncome) * 100 : 0;

    var line = document.createElement("div");
    line.className = "income-line";

    var labelSpan = document.createElement("span");
    labelSpan.className = "income-line__label";
    labelSpan.textContent = getCategoryName(id);

    var amountSpan = document.createElement("span");
    amountSpan.className = "income-line__value";
    amountSpan.textContent = formatAmount(amount);
    if (amount > 0) amountSpan.classList.add("amount-positive");
    if (amount < 0) amountSpan.classList.add("amount-negative");

    var pctSpan = document.createElement("span");
    pctSpan.className = "income-line__pct";
    pctSpan.textContent = pctOfIncome.toFixed(2) + "%";

    line.appendChild(labelSpan);
    line.appendChild(amountSpan);
    line.appendChild(pctSpan);

    incomeCard.appendChild(line);
  });

  container.appendChild(incomeCard);

  // ---- Expenses section ----
  var expensesCard = document.createElement("div");
  expensesCard.className = "income-group";

  var expTitle = document.createElement("div");
  expTitle.className = "income-group__title";
  expTitle.textContent = "Expenses";
  expensesCard.appendChild(expTitle);

  var totalExpensesAbs = Math.abs(totalExpenses);

  Object.keys(expenseByCat).forEach(function (id) {
    var amount = expenseByCat[id];
    if (amount === 0) return;

    var pctOfIncome =
      totalIncome ? (amount / totalIncome) * 100 : 0;
    var pctOfExpenses =
      totalExpensesAbs ? (amount / totalExpensesAbs) * 100 : 0;

    var line = document.createElement("div");
    line.className = "income-line";

    var labelSpan = document.createElement("span");
    labelSpan.className = "income-line__label";
    labelSpan.textContent = getCategoryName(id);

    var amountSpan = document.createElement("span");
    amountSpan.className = "income-line__value";
    amountSpan.textContent = formatAmount(amount);
    if (amount < 0) amountSpan.classList.add("amount-negative");
    if (amount > 0) amountSpan.classList.add("amount-positive");

    var pctIncomeSpan = document.createElement("span");
    pctIncomeSpan.className = "income-line__pct";
    pctIncomeSpan.textContent = pctOfIncome.toFixed(2) + "%";

    var pctExpSpan = document.createElement("span");
    pctExpSpan.className = "income-line__pct";
    var pctDisplay = pctOfExpenses.toFixed(2);
    pctExpSpan.textContent = pctDisplay + "%";
    if (amount < 0) pctExpSpan.classList.add("amount-negative");
    if (amount > 0) pctExpSpan.classList.add("amount-positive");

    line.appendChild(labelSpan);
    line.appendChild(amountSpan);
    line.appendChild(pctIncomeSpan);
    line.appendChild(pctExpSpan);

    expensesCard.appendChild(line);
  });

  container.appendChild(expensesCard);
}

function getCategoryType(categoryId) {
  var cat = state.categories.find(function (c) {
    return c.id === categoryId;
  });
  return cat ? cat.type : null;
}

// ========== IMPORT (PocketSmith-style CSV) ==========
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

        renderCategoryTree();
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
    var categoryId = ensureCategoryFromCsv(categoryName);

    txs.push({
      id: null,
      date: isoDate,
      description: description,
      amount: amount,
      categoryId: categoryId,
      account: account,
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

  var type = inferCategoryType(trimmed, null);
  var id = trimmed;
  var cat = { id: id, name: trimmed, parentId: null, type: type };
  state.categories.push(cat);
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
  var cat = state.categories.find(function (c) {
    return c.id === categoryId;
  });
  return cat ? cat.name : "Uncategorised";
}

function formatAmount(amount) {
  return Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

var draggedTransactionId = null;

function handleTransactionDragStart(event) {
  var tr = event.currentTarget;
  tr.classList.add("dragging");
  draggedTransactionId = parseInt(tr.getAttribute("data-transaction-id"), 10);
  event.dataTransfer.effectAllowed = "move";
}

function handleTransactionDragEnd(event) {
  var tr = event.currentTarget;
  tr.classList.remove("dragging");
  draggedTransactionId = null;
}

function rerenderAll() {
  renderTransactionsTable();
  renderIncomeStatement();
}

// ========== BOOTSTRAP ==========
document.addEventListener("DOMContentLoaded", function () {
  console.log("DOMContentLoaded fired");
  init();
});
