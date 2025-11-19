console.log("App script loaded");

// ===== STATE =====
var state = {
  transactions: [],
  categories: [],
  dateFilter: {
    mode: "6m", // default so sample data shows
    from: null,
    to: null
  }
};

// ===== SAMPLE DATA =====
function loadSampleData() {
  console.log("Loading sample data...");

  state.categories = [
    { id: "Income", name: "Income", parentId: null, type: "Income" },
    { id: "Income > Base Salary", name: "Base Salary", parentId: "Income", type: "Income" },
    { id: "Income > Performance Bonus", name: "Performance Bonus", parentId: "Income", type: "Income" },

    { id: "Food & Drinks", name: "Food & Drinks", parentId: null, type: "Expense" },
    { id: "Food & Drinks > Groceries", name: "Groceries", parentId: "Food & Drinks", type: "Expense" },
    { id: "Food & Drinks > Restaurants", name: "Restaurants", parentId: "Food & Drinks", type: "Expense" },
    { id: "Food & Drinks > Food Delivery", name: "Food Delivery", parentId: "Food & Drinks", type: "Expense" },

    { id: "Life & Entertainment", name: "Life & Entertainment", parentId: null, type: "Expense" },
    { id: "Life & Entertainment > Gifts", name: "Gifts", parentId: "Life & Entertainment", type: "Expense" }
  ];

  state.transactions = [
    {
      id: 1,
      date: "2025-10-01",
      description: "September Salary",
      amount: 16000,
      categoryId: "Income > Base Salary"
    },
    {
      id: 2,
      date: "2025-10-03",
      description: "Dinner out",
      amount: -210,
      categoryId: "Food & Drinks > Restaurants"
    },
    {
      id: 3,
      date: "2025-10-04",
      description: "Food delivery",
      amount: -95,
      categoryId: "Food & Drinks > Food Delivery"
    },
    {
      id: 4,
      date: "2025-09-29",
      description: "Gift for friend",
      amount: -150,
      categoryId: "Life & Entertainment > Gifts"
    }
  ];
}

// ===== INIT =====
function init() {
  console.log("Initialising app...");
  loadSampleData();
  setupPeriodFilter();
  setupTabsAndCategoryEditor();
  renderCategoryTree();
  renderTransactionsTable();
  renderIncomeStatement();
}

// ===== TABS & CATEGORY EDITOR =====
function setupTabsAndCategoryEditor() {
  var dashTab = document.getElementById("tab-dashboard");
  var catTab = document.getElementById("tab-categories");
  var btnDash = document.getElementById("tab-btn-dashboard");
  var btnCat = document.getElementById("tab-btn-categories");
  var editor = document.getElementById("categories-editor");
  var applyBtn = document.getElementById("apply-categories");

  if (!dashTab || !catTab || !btnDash || !btnCat) {
    console.log("Tabs elements not found");
    return;
  }

  function setActiveTab(tab) {
    if (tab === "dashboard") {
      dashTab.style.display = "block";
      catTab.style.display = "none";
      btnDash.classList.add("active");
      btnCat.classList.remove("active");
    } else {
      dashTab.style.display = "none";
      catTab.style.display = "block";
      btnDash.classList.remove("active");
      btnCat.classList.add("active");
    }
  }

  btnDash.addEventListener("click", function () {
    console.log("Dashboard tab clicked");
    setActiveTab("dashboard");
  });

  btnCat.addEventListener("click", function () {
    console.log("Categories tab clicked");
    if (editor && editor.value.replace(/\s/g, "") === "") {
      editor.value = generateCategoriesTextFromState();
    }
    setActiveTab("categories");
  });

  if (applyBtn && editor) {
    applyBtn.addEventListener("click", function () {
      var text = editor.value || "";
      var categories = parseCategoriesText(text);
      if (!categories.length) {
        alert("No valid categories found. Please check your list.");
        return;
      }
      state.categories = categories;
      renderCategoryTree();
      rerenderAll();
      alert("Categories updated. Go back to Dashboard to see the tree.");
    });
  }

  // start with dashboard visible
  setActiveTab("dashboard");
}

// turn current categories into dash-based text
function generateCategoriesTextFromState() {
  if (!state.categories.length) return "";

  var childrenMap = {};
  state.categories.forEach(function (c) {
    var key = c.parentId || "root";
    if (!childrenMap[key]) childrenMap[key] = [];
    childrenMap[key].push(c);
  });

  var roots = childrenMap["root"] || [];
  var lines = [];

  function dfs(cat, level) {
    var prefix = level > 0 ? Array(level + 1).join("-") : "";
    lines.push(prefix + cat.name);
    var children = childrenMap[cat.id] || [];
    children.forEach(function (child) {
      dfs(child, level + 1);
    });
  }

  roots.forEach(function (root) {
    dfs(root, 0);
  });

  return lines.join("\n");
}

// parse dash-based text into category objects
function parseCategoriesText(text) {
  var rawLines = text.split("\n");
  var lines = [];
  rawLines.forEach(function (l) {
    var line = l.replace(/\r/g, "");
    if (line.trim() !== "") lines.push(line);
  });

  var categoriesWithMeta = [];
  var lastByLevel = {};

  lines.forEach(function (line) {
    var match = line.match(/^(-*)(.*)$/);
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
      type: c.type
    });
  });

  return result;
}

// simple heuristic for Income vs Expense
function inferCategoryType(name, parentMeta) {
  var parentName = parentMeta ? parentMeta.name : "";
  var text = (parentName + " " + name).toLowerCase();
  if (
    text.indexOf("income") >= 0 ||
    text.indexOf("salary") >= 0 ||
    text.indexOf("bonus") >= 0 ||
    text.indexOf("allowance") >= 0 ||
    text.indexOf("per diem") >= 0
  ) {
    return "Income";
  }
  return "Expense";
}

// ===== PERIOD FILTER =====
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

// ===== CATEGORY TREE RENDERING =====
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
  var isLeaf = !hasChildren;

  var div = document.createElement("div");
  div.className = "category-node" + (isLeaf ? " leaf" : "");
  div.setAttribute("data-category-id", node.id);

  if (isLeaf) {
    div.addEventListener("dragover", handleCategoryDragOver);
    div.addEventListener("dragleave", handleCategoryDragLeave);
    div.addEventListener("drop", handleCategoryDrop);
  }

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
    renderCategoryNode(container, child, childrenMap, path + " › " + child.name);
  });
}

// ===== TRANSACTIONS TABLE =====
function renderTransactionsTable() {
  var tbody = document.getElementById("transactions-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  var filtered = getFilteredTransactions();

  filtered.forEach(function (tx) {
    var tr = document.createElement("tr");
    tr.classList.add("draggable");
    tr.setAttribute("draggable", "true");
    tr.setAttribute("data-transaction-id", String(tx.id));

    tr.addEventListener("dragstart", handleTransactionDragStart);
    tr.addEventListener("dragend", handleTransactionDragEnd);

    var dateTd = document.createElement("td");
    dateTd.textContent = tx.date;

    var descTd = document.createElement("td");
    descTd.textContent = tx.description;

    var amountTd = document.createElement("td");
    amountTd.textContent = formatAmount(tx.amount);

    var catTd = document.createElement("td");
    catTd.textContent = getCategoryName(tx.categoryId);

    tr.appendChild(dateTd);
    tr.appendChild(descTd);
    tr.appendChild(amountTd);
    tr.appendChild(catTd);

    tbody.appendChild(tr);
  });
}

// ===== INCOME STATEMENT =====
function renderIncomeStatement() {
  var container = document.getElementById("income-statement");
  if (!container) return;
  container.innerHTML = "";

  var filtered = getFilteredTransactions();

  var groups = { Income: {}, Expense: {} };

  filtered.forEach(function (tx) {
    var cat = state.categories.find(function (c) { return c.id === tx.categoryId; });
    var type = cat && cat.type ? cat.type : (tx.amount >= 0 ? "Income" : "Expense");
    var group = type === "Income" ? groups.Income : groups.Expense;
    var key = getCategoryName(tx.categoryId);
    if (!group[key]) group[key] = 0;
    group[key] += tx.amount;
  });

  var incomeTotal = sumValues(groups.Income);
  var expenseTotal = sumValues(groups.Expense);
  var net = incomeTotal + expenseTotal;

  container.appendChild(buildIncomeGroup("Income", groups.Income, incomeTotal));
  container.appendChild(buildIncomeGroup("Expenses", groups.Expense, expenseTotal));

  var netDiv = document.createElement("div");
  netDiv.className = "income-group";
  var title = document.createElement("div");
  title.className = "income-group__title";
  title.textContent = "Net";
  var line = document.createElement("div");
  line.className = "income-line";
  var label = document.createElement("span");
  label.className = "income-line__label";
  label.textContent = "Net result";
  var value = document.createElement("span");
  value.className = "income-line__value";
  value.textContent = formatAmount(net);
  line.appendChild(label);
  line.appendChild(value);
  netDiv.appendChild(title);
  netDiv.appendChild(line);
  container.appendChild(netDiv);
}

function buildIncomeGroup(titleText, linesMap, total) {
  var group = document.createElement("div");
  group.className = "income-group";

  var title = document.createElement("div");
  title.className = "income-group__title";
  title.textContent = titleText + " (" + formatAmount(total) + ")";
  group.appendChild(title);

  for (var labelText in linesMap) {
    if (!linesMap.hasOwnProperty(labelText)) continue;
    var valueNum = linesMap[labelText];

    var line = document.createElement("div");
    line.className = "income-line";
    var label = document.createElement("span");
    label.className = "income-line__label";
    label.textContent = labelText;
    var value = document.createElement("span");
    value.className = "income-line__value";
    value.textContent = formatAmount(valueNum);
    line.appendChild(label);
    line.appendChild(value);
    group.appendChild(line);
  }

  return group;
}

// ===== HELPERS =====
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
  var cat = state.categories.find(function (c) { return c.id === categoryId; });
  return cat ? cat.name : "Uncategorised";
}

function formatAmount(amount) {
  var sign = amount < 0 ? "-" : "";
  var value = Math.abs(amount).toFixed(2);
  return sign + value;
}

function sumValues(obj) {
  var sum = 0;
  for (var k in obj) {
    if (obj.hasOwnProperty(k)) sum += obj[k];
  }
  return sum;
}

// Drag & drop
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

function handleCategoryDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  event.currentTarget.classList.add("drop-hover");
}

function handleCategoryDragLeave(event) {
  event.currentTarget.classList.remove("drop-hover");
}

function handleCategoryDrop(event) {
  event.preventDefault();
  var div = event.currentTarget;
  var categoryId = div.getAttribute("data-category-id");
  div.classList.remove("drop-hover");

  if (draggedTransactionId == null) return;

  var tx = state.transactions.find(function (t) { return t.id === draggedTransactionId; });
  if (!tx) return;

  tx.categoryId = categoryId;
  rerenderAll();
}

function rerenderAll() {
  renderTransactionsTable();
  renderIncomeStatement();
  // later: rerender Sankey here
}

document.addEventListener("DOMContentLoaded", init);
