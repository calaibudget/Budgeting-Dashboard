console.log("App script loaded");

// Basic in-memory state
const state = {
  transactions: [],
  categories: [],
  dateFilter: {
    mode: "1m", // "1m", "3m", "6m", "ytd", "custom"
    from: null,
    to: null,
  },
};

// ----- Sample data for now -----
function loadSampleData() {
  console.log("Loading sample data...");
  state.categories = [
    { id: "Income", name: "Income", parentId: null, type: "Income" },
    { id: "Income > Base Salary", name: "Base Salary", parentId: "Income", type: "Income" },
    { id: "Income > Performance Bonus", name: "Performance Bonus", parentId: "Income", type: "Income" },

    { id: "Food & Drinks", name: "Food & Drinks", parentId: null, type: "Expense" },
    { id: "Food & Drinks > Restaurants", name: "Restaurants", parentId: "Food & Drinks", type: "Expense" },
    { id: "Food & Drinks > Food Delivery", name: "Food Delivery", parentId: "Food & Drinks", type: "Expense" },

    { id: "Life & Entertainment", name: "Life & Entertainment", parentId: null, type: "Expense" },
    { id: "Life & Entertainment > Gifts", name: "Gifts", parentId: "Life & Entertainment", type: "Expense" },
  ];

  state.transactions = [
    {
      id: 1,
      date: "2025-10-01",
      description: "September Salary",
      amount: 16000,
      categoryId: "Income > Base Salary",
    },
    {
      id: 2,
      date: "2025-10-03",
      description: "Dinner out",
      amount: -210,
      categoryId: "Food & Drinks > Restaurants",
    },
    {
      id: 3,
      date: "2025-10-04",
      description: "Food delivery",
      amount: -95,
      categoryId: "Food & Drinks > Food Delivery",
    },
    {
      id: 4,
      date: "2025-09-29",
      description: "Gift for friend",
      amount: -150,
      categoryId: "Life & Entertainment > Gifts",
    },
  ];
}

// ----- Init -----
function init() {
  console.log("Initialising app...");
  loadSampleData();
  setupPeriodFilter();
  setupTabsAndCategoryEditor();
  renderCategoryTree();
  renderTransactionsTable();
  renderIncomeStatement();
}

// ----- Tabs + categories editor -----
function setupTabsAndCategoryEditor() {
  const dashTab = document.getElementById("tab-dashboard");
  const catTab = document.getElementById("tab-categories");
  const btnDash = document.getElementById("tab-btn-dashboard");
  const btnCat = document.getElementById("tab-btn-categories");
  const editor = document.getElementById("categories-editor");
  const applyBtn = document.getElementById("apply-categories");

  if (!dashTab || !catTab || !btnDash || !btnCat) return;

  function setActiveTab(tab) {
    if (tab === "dashboard") {
      dashTab.classList.add("active");
      catTab.classList.remove("active");
      btnDash.classList.add("active");
      btnCat.classList.remove("active");
    } else {
      dashTab.classList.remove("active");
      catTab.classList.add("active");
      btnDash.classList.remove("active");
      btnCat.classList.add("active");
    }
  }

  btnDash.addEventListener("click", () => {
    setActiveTab("dashboard");
  });

  btnCat.addEventListener("click", () => {
    if (editor && editor.value.trim() === "") {
      editor.value = generateCategoriesTextFromState();
    }
    setActiveTab("categories");
  });

  if (applyBtn && editor) {
    applyBtn.addEventListener("click", () => {
      const text = editor.value || "";
      const categories = parseCategoriesText(text);
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

  setActiveTab("dashboard");
}

// Turn current categories into dash-based text
function generateCategoriesTextFromState() {
  if (!state.categories.length) return "";

  const childrenMap = {};
  state.categories.forEach((c) => {
    const parentKey = c.parentId || "root";
    if (!childrenMap[parentKey]) childrenMap[parentKey] = [];
    childrenMap[parentKey].push(c);
  });

  const roots = childrenMap["root"] || [];
  const lines = [];

  function dfs(cat, level) {
    const prefix = level > 0 ? "-".repeat(level) : "";
    lines.push(prefix + cat.name);
    const children = childrenMap[cat.id] || [];
    children.forEach((child) => dfs(child, level + 1));
  }

  roots.forEach((root) => dfs(root, 0));
  return lines.join("\n");
}

// Parse dash-based text into category objects
function parseCategoriesText(text) {
  const lines = text
    .split("\n")
    .map((l) => l.replace(/\r/g, "").trimEnd())
    .filter((l) => l.trim() !== "");

  const categoriesWithMeta = [];
  const lastByLevel = {};

  lines.forEach((line) => {
    const match = line.match(/^(-*)(.*)$/);
    if (!match) return;
    const dashes = match[1].length;
    const rawName = match[2].trim();
    if (!rawName) return;

    const level = dashes; // 0 = top level, 1 = sub1, etc.
    const parentMeta = level === 0 ? null : lastByLevel[level - 1] || null;
    const path = parentMeta ? parentMeta.path + " > " + rawName : rawName;
    const id = path;
    const parentId = parentMeta ? parentMeta.id : null;
    const type = inferCategoryType(rawName, parentMeta);

    const cat = { id, name: rawName, parentId, type, path, level };
    categoriesWithMeta.push(cat);
    lastByLevel[level] = cat;
  });

  return categoriesWithMeta.map(({ path, level, ...rest }) => rest);
}

// Simple heuristic for Income vs Expense
function inferCategoryType(name, parentMeta) {
  const text = ((parentMeta?.name || "") + " " + name).toLowerCase();
  if (
    text.includes("income") ||
    text.includes("salary") ||
    text.includes("bonus") ||
    text.includes("allowance") ||
    text.includes("per diem")
  ) {
    return "Income";
  }
  return "Expense";
}

// ----- Period filter -----
function setupPeriodFilter() {
  const select = document.getElementById("period-select");
  const customRange = document.getElementById("custom-range");
  const fromInput = document.getElementById("date-from");
  const toInput = document.getElementById("date-to");

  if (!select) return;

  select.addEventListener("change", () => {
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

  fromInput?.addEventListener("change", () => {
    state.dateFilter.from = fromInput.value || null;
    rerenderAll();
  });

  toInput?.addEventListener("change", () => {
    state.dateFilter.to = toInput.value || null;
    rerenderAll();
  });
}

// ----- Category tree rendering -----
function renderCategoryTree() {
  const container = document.getElementById("category-tree");
  if (!container) return;
  container.innerHTML = "";

  const byId = Object.fromEntries(state.categories.map((c) => [c.id, c]));
  const childrenMap = {};
  state.categories.forEach((c) => {
    const key = c.parentId || "root";
    if (!childrenMap[key]) childrenMap[key] = [];
    childrenMap[key].push(c);
  });

  const roots = childrenMap["root"] || [];
  roots.forEach((root) => {
    renderCategoryNode(container, root, byId, childrenMap, root.name);
  });
}

function renderCategoryNode(container, node, byId, childrenMap, path) {
  const children = childrenMap[node.id] || [];
  const hasChildren = children.length > 0;
  const isLeaf = !hasChildren;

  const div = document.createElement("div");
  div.className = "category-node" + (isLeaf ? " leaf" : "");
  div.dataset.categoryId = node.id;

  if (isLeaf) {
    div.addEventListener("dragover", handleCategoryDragOver);
    div.addEventListener("dragleave", handleCategoryDragLeave);
    div.addEventListener("drop", handleCategoryDrop);
  }

  const label = document.createElement("div");
  label.className = "category-node__label";
  label.textContent = node.name;

  const pathEl = document.createElement("div");
  pathEl.className = "category-node__path";
  pathEl.textContent = path;

  div.appendChild(label);
  if (path !== node.name) {
    div.appendChild(pathEl);
  }

  container.appendChild(div);

  children.forEach((child) => {
    renderCategoryNode(container, child, byId, childrenMap, `${path} › ${child.name}`);
  });
}

// ----- Transactions table -----
function renderTransactionsTable() {
  const tbody = document.getElementById("transactions-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  const filtered = getFilteredTransactions();

  filtered.forEach((tx) => {
    const tr = document.createElement("tr");
    tr.classList.add("draggable");
    tr.setAttribute("draggable", "true");
    tr.dataset.transactionId = tx.id.toString();

    tr.addEventListener("dragstart", handleTransactionDragStart);
    tr.addEventListener("dragend", handleTransactionDragEnd);

    const dateTd = document.createElement("td");
    dateTd.textContent = tx.date;

    const descTd = document.createElement("td");
    descTd.textContent = tx.description;

    const amountTd = document.createElement("td");
    amountTd.textContent = formatAmount(tx.amount);

    const catTd = document.createElement("td");
    catTd.textContent = getCategoryName(tx.categoryId);

    tr.appendChild(dateTd);
    tr.appendChild(descTd);
    tr.appendChild(amountTd);
    tr.appendChild(catTd);

    tbody.appendChild(tr);
  });
}

// ----- Income statement -----
function renderIncomeStatement() {
  const container = document.getElementById("income-statement");
  if (!container) return;
  container.innerHTML = "";

  const filtered = getFilteredTransactions();

  const groups = {
    Income: {},
    Expense: {},
  };

  filtered.forEach((tx) => {
    const cat = state.categories.find((c) => c.id === tx.categoryId);
    const type = cat?.type || (tx.amount >= 0 ? "Income" : "Expense");
    const group = type === "Income" ? groups.Income : groups.Expense;
    const key = getCategoryName(tx.categoryId);
    group[key] = (group[key] || 0) + tx.amount;
  });

  const incomeTotal = Object.values(groups.Income).reduce((a, b) => a + b, 0);
  const expenseTotal = Object.values(groups.Expense).reduce((a, b) => a + b, 0);
  const net = incomeTotal + expenseTotal;

  container.appendChild(buildIncomeGroup("Income", groups.Income, incomeTotal));
  container.appendChild(buildIncomeGroup("Expenses", groups.Expense, expenseTotal));

  const netDiv = document.createElement("div");
  netDiv.className = "income-group";
  const title = document.createElement("div");
  title.className = "income-group__title";
  title.textContent = "Net";
  const line = document.createElement("div");
  line.className = "income-line";
  const label = document.createElement("span");
  label.className = "income-line__label";
  label.textContent = "Net result";
  const value = document.createElement("span");
  value.className = "income-line__value";
  value.textContent = formatAmount(net);
  line.appendChild(label);
  line.appendChild(value);
  netDiv.appendChild(title);
  netDiv.appendChild(line);
  container.appendChild(netDiv);
}

function buildIncomeGroup(titleText, linesMap, total) {
  const group = document.createElement("div");
  group.className = "income-group";

  const title = document.createElement("div");
  title.className = "income-group__title";
  title.textContent = `${titleText} (${formatAmount(total)})`;
  group.appendChild(title);

  Object.entries(linesMap).forEach(([labelText, valueNum]) => {
    const line = document.createElement("div");
    line.className = "income-line";
    const label = document.createElement("span");
    label.className = "income-line__label";
    label.textContent = labelText;
    const value = document.createElement("span");
    value.className = "income-line__value";
    value.textContent = formatAmount(valueNum);
    line.appendChild(label);
    line.appendChild(value);
    group.appendChild(line);
  });

  return group;
}

// ----- Helpers -----
function getFilteredTransactions() {
  const { mode, from, to } = state.dateFilter;
  const today = new Date();

  let start = null;
  let end = null;

  if (mode === "custom" && from && to) {
    start = new Date(from);
    end = new Date(to);
  } else {
    end = today;
    const startDate = new Date(today);
    if (mode === "1m") startDate.setMonth(startDate.getMonth() - 1);
    else if (mode === "3m") startDate.setMonth(startDate.getMonth() - 3);
    else if (mode === "6m") startDate.setMonth(startDate.getMonth() - 6);
    else if (mode === "ytd") startDate.setMonth(0, 1);
    start = startDate;
  }

  return state.transactions.filter((tx) => {
    const d = new Date(tx.date);
    return d >= start && d <= end;
  });
}

function getCategoryName(categoryId) {
  const cat = state.categories.find((c) => c.id === categoryId);
  return cat ? cat.name : "Uncategorised";
}

function formatAmount(amount) {
  const sign = amount < 0 ? "-" : "";
  const value = Math.abs(amount).toFixed(2);
  return `${sign}${value}`;
}

// Drag & drop
let draggedTransactionId = null;

function handleTransactionDragStart(event) {
  const tr = event.currentTarget;
  tr.classList.add("dragging");
  draggedTransactionId = parseInt(tr.dataset.transactionId, 10);
  event.dataTransfer.effectAllowed = "move";
}

function handleTransactionDragEnd(event) {
  const tr = event.currentTarget;
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
  const categoryId = event.currentTarget.dataset.categoryId;
  event.currentTarget.classList.remove("drop-hover");

  if (draggedTransactionId == null) return;

  const tx = state.transactions.find((t) => t.id === draggedTransactionId);
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
