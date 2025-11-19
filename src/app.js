console.log("App script loaded");

var state = {
  transactions: [],
  categories: [],
  dateFilter: {
    mode: "6m",
    from: null,
    to: null
  }
};

// which parents are collapsed in the tree
var collapsedCategoryIds = new Set();

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
  setupCategoryEditorModal();
  setupTabHeaderVisibility();
  renderTransactionsTable();
  renderIncomeStatement();
  renderAllCategoryTrees();
}

// ===== PERIOD SELECTOR =====
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

// hide period selector on Categories tab
function setupTabHeaderVisibility() {
  var dashRadio = document.getElementById("tab-radio-dashboard");
  var catRadio = document.getElementById("tab-radio-categories");
  var filters = document.querySelector(".top-bar__filters");

  if (!dashRadio || !catRadio || !filters) {
    console.log("Tab header visibility: elements not found");
    return;
  }

  function updateFiltersVisibility() {
    if (catRadio.checked) {
      filters.style.display = "none";
    } else {
      filters.style.display = "flex";
    }
  }

  dashRadio.addEventListener("change", updateFiltersVisibility);
  catRadio.addEventListener("change", updateFiltersVisibility);
  updateFiltersVisibility();
}

// ===== CATEGORY EDITOR MODAL =====
function setupCategoryEditorModal() {
  var openBtn = document.getElementById("open-category-editor");
  var modal = document.getElementById("category-editor-modal");
  var textarea = document.getElementById("categories-editor-modal");
  var cancelBtn = document.getElementById("cancel-categories");
  var applyBtn = document.getElementById("apply-categories");
  var backdrop = modal ? modal.querySelector(".modal-backdrop") : null;

  if (!openBtn || !modal || !textarea || !cancelBtn || !applyBtn) {
    console.log("Category editor modal elements not found");
    return;
  }

  function openModal() {
    textarea.value = generateCategoriesTextFromState();
    modal.classList.remove("hidden");
  }

  function closeModal() {
    modal.classList.add("hidden");
  }

  openBtn.addEventListener("click", openModal);
  cancelBtn.addEventListener("click", closeModal);
  if (backdrop) {
    backdrop.addEventListener("click", closeModal);
  }

  applyBtn.addEventListener("click", function () {
    var text = textarea.value || "";
    console.log("Apply categories clicked. Raw text:", text);

    var categories = parseCategoriesText(text);
    console.log("Parsed categories:", categories);

    if (!categories.length) {
      alert("No valid categories found. Please check your list.");
      return;
    }

    state.categories = categories;
    collapsedCategoryIds.clear();
    renderAllCategoryTrees();
    rerenderAll();

    alert(
      "Categories updated: " +
        categories.length +
        ". Check the tree on the Categories tab and the summary on the Dashboard."
    );
    closeModal();
  });
}

// current categories -> dashed text (ordered, with dashes)
function generateCategoriesTextFromState() {
  if (!state.categories.length) return "";

  var childrenMap = {};
  state.categories.forEach(function (c) {
    var key = c.parentId || "root";
    if (!childrenMap[key]) childrenMap[key] = [];
    childrenMap[key].push(c);
  });

  var lines = [];
  function dfs(cat, level) {
    var prefix = level > 0 ? Array(level + 1).join("-") : "";
    lines.push(prefix + cat.name);
    var children = childrenMap[cat.id] || [];
    children.forEach(function (child) {
      dfs(child, level + 1);
    });
  }

  var roots = childrenMap["root"] || [];
  roots.forEach(function (root) {
    dfs(root, 0);
  });

  return lines.join("\n");
}

// dashed text -> categories array, keeping order & parent relationships
function parseCategoriesText(text) {
  if (!text || !text.trim()) {
    console.log("parseCategoriesText: empty text");
    return [];
  }

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
      level: level
    };

    categoriesWithMeta.push(cat);
    lastByLevel[level] = cat;
  });

  console.log("parseCategoriesText: built", categoriesWithMeta.length, "nodes");

  // we keep level so we can use it if needed
  var result = [];
  categoriesWithMeta.forEach(function (c) {
    result.push({
      id: c.id,
      name: c.name,
      parentId: c.parentId,
      type: c.type,
      level: c.level
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
    text.indexOf("per diem") >= 0
  ) {
    return "Income";
  }
  return "Expense";
}

// ===== CATEGORY TREE RENDERING (Categories tab only) =====
function renderAllCategoryTrees() {
  renderCategoryTreeInto("category-tree-tab");
}

function renderCategoryTreeInto(containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  if (!state.categories.length) {
    container.textContent = "No categories defined yet.";
    return;
  }

  var childrenMap = {};
  state.categories.forEach(function (c) {
    var key = c.parentId || "root";
    if (!childrenMap[key]) childrenMap[key] = [];
    childrenMap[key].push(c);
  });

  var roots = childrenMap["root"] || [];

  function renderNode(cat, depth) {
    var children = childrenMap[cat.id] || [];
    var hasChildren = children.length > 0;
    var isCollapsed = collapsedCategoryIds.has(cat.id);

    var row = document.createElement("div");
    row.className = "category-row level-" + depth;
    row.style.marginLeft = depth > 0 ? depth * 18 + "px" : "0px";

    var toggle = document.createElement("span");
    toggle.className = "category-row__toggle";
    if (hasChildren) {
      toggle.textContent = isCollapsed ? "▸" : "▾";
      toggle.addEventListener("click", function (e) {
        e.stopPropagation();
        if (isCollapsed) {
          collapsedCategoryIds.delete(cat.id);
        } else {
          collapsedCategoryIds.add(cat.id);
        }
        renderAllCategoryTrees();
      });
    } else {
      toggle.textContent = "";
      toggle.classList.add("empty");
    }

    var label = document.createElement("span");
    label.className = "category-row__label";
    label.textContent = cat.name;

    var path = document.createElement("span");
    path.className = "category-row__path";
    if (depth === 0) {
      path.textContent = cat.type || "";
    } else {
      // nothing or could show full path
      path.textContent = "";
    }

    row.appendChild(toggle);
    row.appendChild(label);
    row.appendChild(path);

    container.appendChild(row);

    if (!isCollapsed) {
      children.forEach(function (child) {
        renderNode(child, depth + 1);
      });
    }
  }

  roots.forEach(function (root) {
    renderNode(root, 0);
  });
}

// ===== TRANSACTIONS / INCOME STATEMENT =====
function renderTransactionsTable() {
  var tbody = document.getElementById("transactions-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  var filtered = getFilteredTransactions();

  filtered.forEach(function (tx) {
    var tr = document.createElement("tr");

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

function renderIncomeStatement() {
  var container = document.getElementById("income-statement");
  if (!container) return;
  container.innerHTML = "";

  var filtered = getFilteredTransactions();
  var groups = { Income: {}, Expense: {} };

  filtered.forEach(function (tx) {
    var cat = state.categories.find(function (c) {
      return c.id === tx.categoryId;
    });
    var type =
      cat && cat.type ? cat.type : tx.amount >= 0 ? "Income" : "Expense";
    var group = type === "Income" ? groups.Income : groups.Expense;
    var key = getCategoryName(tx.categoryId);
    if (!group[key]) group[key] = 0;
    group[key] += tx.amount;
  });

  var incomeTotal = sumValues(groups.Income);
  var expenseTotal = sumValues(groups.Expense);
  var net = incomeTotal + expenseTotal;

  container.appendChild(buildIncomeGroup("Income", groups.Income, incomeTotal));
  container.appendChild(
    buildIncomeGroup("Expenses", groups.Expense, expenseTotal)
  );

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
  var cat = state.categories.find(function (c) {
    return c.id === categoryId;
  });
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

function rerenderAll() {
  renderTransactionsTable();
  renderIncomeStatement();
}

document.addEventListener("DOMContentLoaded", init);
