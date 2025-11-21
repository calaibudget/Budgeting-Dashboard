console.log("App script loaded (v2)");

// ================= STATE =================
const state = {
  activeTab: "dashboard",
  // date filter (we'll add the full picker later)
  dateFilter: {
    mode: "thisYear",
    from: null,
    to: null,
  },
  categories: [],
  transactions: [],
};

// ================= SAMPLE DATA =================
function loadSampleData() {
  // Categories with explicit type
  state.categories = [
    // Income tree
    { id: "income-root", name: "Income", parentId: null, type: "income" },
    { id: "base-salary", name: "Base Salary", parentId: "income-root", type: "income" },
    { id: "cashback", name: "Cashback", parentId: "income-root", type: "income" },
    { id: "per-diem", name: "Per Diem", parentId: "income-root", type: "income" },
    { id: "interest-income", name: "Interest Income", parentId: "income-root", type: "income" },
    { id: "transport-allowance", name: "Transportation Allowance", parentId: "income-root", type: "income" },
    { id: "housing-allowance", name: "Housing Allowance", parentId: "income-root", type: "income" },

    // Expense tree
    { id: "food-root", name: "Food & Drinks", parentId: null, type: "expense" },
    { id: "groceries", name: "Groceries", parentId: "food-root", type: "expense" },
    { id: "restaurants", name: "Restaurants", parentId: "food-root", type: "expense" },
    { id: "food-delivery", name: "Food Delivery", parentId: "food-root", type: "expense" },

    { id: "life-root", name: "Life & Entertainment", parentId: null, type: "expense" },
    { id: "gifts", name: "Gifts", parentId: "life-root", type: "expense" },
  ];

  // Transactions: + = income, - = expense
  state.transactions = [
    {
      id: 1,
      date: "2025-10-01",
      description: "September Salary",
      amount: 16000,
      categoryId: "base-salary",
      labels: ["Work"],
      account: "Salary Account",
    },
    {
      id: 2,
      date: "2025-10-03",
      description: "Dinner out",
      amount: -210,
      categoryId: "restaurants",
      labels: ["Food"],
      account: "Current Account",
    },
    {
      id: 3,
      date: "2025-10-04",
      description: "Food delivery",
      amount: -95,
      categoryId: "food-delivery",
      labels: ["Food", "Delivery"],
      account: "Current Account",
    },
    {
      id: 4,
      date: "2025-09-29",
      description: "Gift for friend",
      amount: -150,
      categoryId: "gifts",
      labels: ["Gift"],
      account: "Current Account",
    },
  ];
}

// ================= DATE HELPERS =================
function parseISO(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function startOfYear(d) {
  return new Date(d.getFullYear(), 0, 1);
}
function endOfYear(d) {
  return new Date(d.getFullYear(), 11, 31);
}
function addMonths(d, delta) {
  return new Date(d.getFullYear(), d.getMonth() + delta, d.getDate());
}

// returns {from, to} Date objects inclusive
function resolveDateRange(filter) {
  const today = new Date();
  let from, to;

  switch (filter.mode) {
    case "thisMonth":
      from = startOfMonth(today);
      to = endOfMonth(today);
      break;

    case "lastMonth": {
      const lm = addMonths(startOfMonth(today), -1);
      from = startOfMonth(lm);
      to = endOfMonth(lm);
      break;
    }

    case "thisYear":
      from = startOfYear(today);
      to = endOfYear(today);
      break;

    case "lastYear": {
      const ly = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      from = startOfYear(ly);
      to = endOfYear(ly);
      break;
    }

    case "custom":
      if (filter.from && filter.to) {
        from = parseISO(filter.from);
        to = parseISO(filter.to);
      } else {
        from = startOfYear(today);
        to = endOfYear(today);
      }
      break;

    default:
      from = startOfYear(today);
      to = endOfYear(today);
  }

  return { from, to };
}

function getFilteredTransactions() {
  const { from, to } = resolveDateRange(state.dateFilter);
  return state.transactions.filter((tx) => {
    const d = parseISO(tx.date);
    return d >= from && d <= to;
  });
}

// ================= DASHBOARD MATH =================
function computeDashboardStats() {
  const txs = getFilteredTransactions();
  let totalIncome = 0;
  let totalExpenses = 0; // negative numbers (spend)

  const perCategory = {};
  const catById = {};
  state.categories.forEach((c) => (catById[c.id] = c));

  txs.forEach((tx) => {
    const cat = catById[tx.categoryId];
    const type = cat ? cat.type : tx.amount >= 0 ? "income" : "expense";

    if (type === "income") {
      totalIncome += tx.amount;
    } else {
      totalExpenses += tx.amount; // will usually be negative
    }

    const key = tx.categoryId;
    if (!perCategory[key]) {
      perCategory[key] = {
        amount: 0,
        type,
        category: cat || { name: "Uncategorised", parentId: null },
      };
    }
    perCategory[key].amount += tx.amount;
  });

  const net = totalIncome + totalExpenses;
  const savingRate = totalIncome > 0 ? net / totalIncome : 0;

  return { totalIncome, totalExpenses, net, savingRate, perCategory };
}

// ================= RENDER HELPERS =================
function formatAmount(num) {
  return Number(num || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(num) {
  return (num * 100).toFixed(2) + "%";
}

// ================= RENDER: DASHBOARD =================
function renderDashboard() {
  const summaryEl = document.getElementById("summary-line");
  const incomeBody = document.getElementById("income-tbody");
  const expenseBody = document.getElementById("expense-tbody");
  const footerEl = document.getElementById("statement-footer");

  if (!summaryEl || !incomeBody || !expenseBody || !footerEl) {
    console.warn("Dashboard containers not found");
    return;
  }

  const { totalIncome, totalExpenses, net, savingRate, perCategory } =
    computeDashboardStats();

  summaryEl.textContent =
    "Total income: " +
    formatAmount(totalIncome) +
    " | Total expenses: " +
    formatAmount(totalExpenses) +
    " | Net: " +
    formatAmount(net) +
    " | Saving rate: " +
    formatPercent(savingRate);

  incomeBody.innerHTML = "";
  expenseBody.innerHTML = "";

  // --- Income total row ---
  const incomeTotalRow = document.createElement("tr");
  incomeTotalRow.className = "totals-row";
  incomeTotalRow.innerHTML =
    '<td class="cell-label">Income</td>' +
    '<td class="cell-amount positive">' +
    formatAmount(totalIncome) +
    "</td>" +
    '<td class="cell-percent">' +
    (totalIncome !== 0 ? "100.00%" : "") +
    "</td>";
  incomeBody.appendChild(incomeTotalRow);

  // --- Expense total row ---
  const expenseTotalRow = document.createElement("tr");
  expenseTotalRow.className = "totals-row";
  const totalExpensesAbs = Math.abs(totalExpenses);
  expenseTotalRow.innerHTML =
    '<td class="cell-label">Expenses</td>' +
    '<td class="cell-amount negative">' +
    formatAmount(totalExpenses) +
    "</td>" +
    '<td class="cell-percent">' +
    (totalExpensesAbs !== 0 ? "100.00%" : "") +
    "</td>";
  expenseBody.appendChild(expenseTotalRow);

  // --- Per-category rows (only non-zero) ---
  Object.keys(perCategory).forEach((id) => {
    const entry = perCategory[id];
    const { amount, type, category } = entry;
    if (!amount) return;

    if (type === "income") {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td class="cell-label">' +
        category.name +
        "</td>" +
        '<td class="cell-amount ' +
        (amount >= 0 ? "positive" : "negative") +
        '">' +
        formatAmount(amount) +
        "</td>" +
        '<td class="cell-percent">' +
        (totalIncome !== 0 ? formatPercent(amount / totalIncome) : "") +
        "</td>";
      incomeBody.appendChild(tr);
    } else {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td class="cell-label">' +
        category.name +
        "</td>" +
        '<td class="cell-amount ' +
        (amount >= 0 ? "positive" : "negative") +
        '">' +
        formatAmount(amount) +
        "</td>" +
        '<td class="cell-percent">' +
        (totalExpensesAbs !== 0
          ? formatPercent(Math.abs(amount) / totalExpensesAbs)
          : "") +
        "</td>";
      expenseBody.appendChild(tr);
    }
  });

  // --- Footer summary ---
  footerEl.innerHTML =
    "<strong>Total income:</strong> " +
    formatAmount(totalIncome) +
    " &nbsp; | &nbsp; <strong>Total expenses:</strong> " +
    formatAmount(totalExpenses) +
    " &nbsp; | &nbsp; <strong>Net:</strong> " +
    formatAmount(net) +
    " &nbsp; | &nbsp; <strong>Saving rate:</strong> " +
    formatPercent(savingRate);
}

// ================= RENDER: TRANSACTIONS (simple version) =================
function renderTransactions() {
  const tbody = document.getElementById("tx-tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const txs = getFilteredTransactions();
  const catById = {};
  state.categories.forEach((c) => (catById[c.id] = c));

  txs
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .forEach((tx) => {
      const tr = document.createElement("tr");
      const cat = catById[tx.categoryId];

      tr.innerHTML =
        "<td>" +
        tx.date +
        "</td>" +
        "<td>" +
        tx.description +
        "</td>" +
        '<td class="' +
        (tx.amount >= 0 ? "positive" : "negative") +
        '">' +
        formatAmount(tx.amount) +
        "</td>" +
        "<td>" +
        (cat ? cat.name : "") +
        "</td>" +
        "<td>" +
        (tx.labels || []).join(", ") +
        "</td>";
      tbody.appendChild(tr);
    });
}

// ================= TABS =================
function setActiveTab(tabName) {
  state.activeTab = tabName;

  const tabs = document.querySelectorAll("[data-tab]");
  tabs.forEach((btn) => {
    const name = btn.getAttribute("data-tab");
    if (name === tabName) {
      btn.classList.add("tab-active");
    } else {
      btn.classList.remove("tab-active");
    }
  });

  const sections = document.querySelectorAll(".tab-section");
  sections.forEach((sec) => {
    const name = sec.getAttribute("data-tab-section");
    if (name === tabName) {
      sec.classList.remove("hidden");
    } else {
      sec.classList.add("hidden");
    }
  });

  if (tabName === "dashboard") {
    renderDashboard();
  } else if (tabName === "transactions") {
    renderTransactions();
  }
}

// ================= INIT =================
function init() {
  console.log("init()");

  loadSampleData();

  // Tab click handlers
  const tabButtons = document.querySelectorAll("[data-tab]");
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-tab");
      setActiveTab(name);
    });
  });

  // Initial tab
  setActiveTab("dashboard");
}

document.addEventListener("DOMContentLoaded", init);
