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
    { id: "income", name: "Income", parentId: null, type: "Income" },
    { id: "salary", name: "Base Salary", parentId: "income", type: "Income" },
    { id: "bonus", name: "Performance Bonus", parentId: "income", type: "Income" },

    { id: "food", name: "Food & Drinks", parentId: null, type: "Expense" },
    { id: "restaurants", name: "Restaurants", parentId: "food", type: "Expense" },
    { id: "delivery", name: "Food Delivery", parentId: "food", type: "Expense" },

    { id: "life", name: "Life & Entertainment", parentId: null, type: "Expense" },
    { id: "gifts", name: "Gifts", parentId: "life", type: "Expense" },
  ];

  state.transactions = [
    {
      id: 1,
      date: "2025-10-01",
      description: "September Salary",
      amount: 16000,
      categoryId: "salary",
    },
    {
      id: 2,
      date: "2025-10-03",
      description: "Dinner out",
      amount: -210,
      categoryId: "restaurants",
    },
    {
      id: 3,
      date: "2025-10-04",
      description: "Food delivery",
      amount: -95,
      categoryId: "delivery",
    },
    {
      id: 4,
      date: "2025-09-29",
      description: "Gift for friend",
      amount: -150,
      categoryId: "gifts",
    },
  ];
}

// ----- Rendering -----
function init() {
  console.log("Initialising app...");
  loadSampleData();
  setupPeriodFilter();
  renderCategoryTree();
  renderTransactionsTable();
  renderIncomeStatement();
}

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

function renderCategoryTree() {
  const container = document.getElementById("category-tree");
  if (!container) return;
  container.innerHTML = "";

  const byId = Object.fromEntries(state.categories.map((c) => [c.id, c]));
  const childrenMap = {};
  state.categories.forEach((c) => {
    if (!childrenMap[c.parentId || "root"]) {
      childrenMap[c.parentId || "root"] = [];
    }
    childrenMap[c.parentId || "root"].push(c);
  });

  const roots = childrenMap["root"] || [];
  roots.forEach((root) => {
    renderCategoryNode(container, root, byId, childrenMap, root.name);
  });
}

function renderCategoryNode(container, node, byId, childrenMap, path) {
  const hasChildren = (childrenMap[node.id] || []).length > 0;
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

  const children = childrenMap[node.id] || [];
  children.forEach((child) => {
    renderCategoryNode(container, child, byId, childrenMap, `${path} › ${child.name}`);
  });
}

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
