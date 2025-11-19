console.log("App script loaded");

var state = {
  transactions: [],
  categories: [],
  dateFilter: {
    mode: "6m",
    from: null,
    to: null
  },
  txFilter: {
    text: "",
    account: "all",
    categoryId: "all",
    labelText: "",
    dateMode: "any",
    from: null,
    to: null,
    sortByDate: "desc"
  }
};

// which parents are collapsed in the tree
var collapsedCategoryIds = new Set();
var selectedTransactionIds = new Set();

// for transaction modal
var txModalMode = "add"; // "add" | "duplicate"
var txModalSourceTx = null;

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

  // transactions with original + converted amounts, account, labels
  state.transactions = [
    {
      id: 1,
      date: "2025-10-01",
      description: "September Salary",
      originalAmount: 16000,
      originalCurrency: "AED",
      convertedAmount: 16000,
      convertedCurrency: "AED",
      categoryId: "Income > Base Salary",
      account: "Salary Account",
      labels: ["Work"]
    },
    {
      id: 2,
      date: "2025-10-03",
      description: "Dinner out",
      originalAmount: -210,
      originalCurrency: "AED",
      convertedAmount: -210,
      convertedCurrency: "AED",
      categoryId: "Food & Drinks > Restaurants",
      account: "Current Account",
      labels: ["Food"]
    },
    {
      id: 3,
      date: "2025-10-04",
      description: "Food delivery",
      originalAmount: -95,
      originalCurrency: "AED",
      convertedAmount: -95,
      convertedCurrency: "AED",
      categoryId: "Food & Drinks > Food Delivery",
      account: "Current Account",
      labels: ["Food", "Delivery"]
    },
    {
      id: 4,
      date: "2025-09-29",
      description: "Gift for friend",
      originalAmount: -150,
      originalCurrency: "AED",
      convertedAmount: -150,
      convertedCurrency: "AED",
      categoryId: "Life & Entertainment > Gifts",
      account: "Current Account",
      labels: ["Gift"]
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
  setupTransactionsUI();
  setupTransactionModal();
  renderTransactionsTable();
  renderIncomeStatement();
  renderAllCategoryTrees();
  refreshTransactionsFilterOptions();
}

// ===== PERIOD SELECTOR (Dashboard only) =====
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
      renderIncomeStatement();
    }
  });

  if (fromInput) {
    fromInput.addEventListener("change", function () {
      state.dateFilter.from = fromInput.value || null;
      renderIncomeStatement();
    });
  }

  if (toInput) {
    toInput.addEventListener("change", function () {
      state.dateFilter.to = toInput.value || null;
      renderIncomeStatement();
    });
  }

  select.value = state.dateFilter.mode;
}

// hide period selector on Categories tab, show on others
function setupTabHeaderVisibility() {
  var dashRadio = document.getElementById("tab-radio-dashboard");
  var txRadio = document.getElementById("tab-radio-transactions");
  var catRadio = document.getElementById("tab-radio-categories");
  var filters = document.querySelector(".top-bar__filters");

  if (!dashRadio || !txRadio || !catRadio || !filters) {
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
  txRadio.addEventListener("change", updateFiltersVisibility);
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
    refreshTransactionsFilterOptions();
    renderIncomeStatement();

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

// ===== TRANSACTIONS TAB UI =====
function setupTransactionsUI() {
  var searchInput = document.getElementById("tx-search");
  var accountSelect = document.getElementById("tx-filter-account");
  var categorySelect = document.getElementById("tx-filter-category");
  var labelInput = document.getElementById("tx-filter-label");
  var dateModeSelect = document.getElementById("tx-filter-date-mode");
  var fromInput = document.getElementById("tx-date-from");
  var toInput = document.getElementById("tx-date-to");
  var dateHeader = document.getElementById("tx-header-date");

  var addBtn = document.getElementById("add-transaction");
  var deleteBtn = document.getElementById("delete-selected");
  var bulkCatSelect = document.getElementById("bulk-category-select");
  var bulkCatBtn = document.getElementById("apply-bulk-category");
  var bulkLabelInput = document.getElementById("bulk-label-input");
  var bulkLabelBtn = document.getElementById("apply-bulk-label");

  if (!searchInput) return;

  searchInput.addEventListener("input", function () {
    state.txFilter.text = (searchInput.value || "").toLowerCase();
    renderTransactionsTable();
  });

  if (accountSelect) {
    accountSelect.addEventListener("change", function () {
      state.txFilter.account = accountSelect.value;
      renderTransactionsTable();
    });
  }

  if (categorySelect) {
    categorySelect.addEventListener("change", function () {
      state.txFilter.categoryId = categorySelect.value;
      renderTransactionsTable();
    });
  }

  if (labelInput) {
    labelInput.addEventListener("input", function () {
      state.txFilter.labelText = (labelInput.value || "").toLowerCase();
      renderTransactionsTable();
    });
  }

  if (dateModeSelect) {
    dateModeSelect.addEventListener("change", function () {
      state.txFilter.dateMode = dateModeSelect.value;
      renderTransactionsTable();
    });
  }

  if (fromInput) {
    fromInput.addEventListener("change", function () {
      state.txFilter.from = fromInput.value || null;
      renderTransactionsTable();
    });
  }

  if (toInput) {
    toInput.addEventListener("change", function () {
      state.txFilter.to = toInput.value || null;
      renderTransactionsTable();
    });
  }

  if (dateHeader) {
    dateHeader.addEventListener("click", function () {
      var f = state.txFilter;
      f.sortByDate = f.sortByDate === "asc" ? "desc" : "asc";
      renderTransactionsTable();
    });
  }

  if (addBtn) {
    addBtn.addEventListener("click", function () {
      openTransactionModal("add", null);
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener("click", function () {
      if (!selectedTransactionIds.size) return;
      if (!confirm("Delete selected transactions?")) return;
      state.transactions = state.transactions.filter(function (tx) {
        return !selectedTransactionIds.has(tx.id);
      });
      selectedTransactionIds.clear();
      refreshTransactionsFilterOptions();
      renderTransactionsTable();
      renderIncomeStatement();
    });
  }

  if (bulkCatBtn && bulkCatSelect) {
    bulkCatBtn.addEventListener("click", function () {
      var catId = bulkCatSelect.value;
      if (!catId || catId === "none" || !selectedTransactionIds.size) return;
      state.transactions.forEach(function (tx) {
        if (selectedTransactionIds.has(tx.id)) {
          tx.categoryId = catId;
        }
      });
      renderTransactionsTable();
      renderIncomeStatement();
    });
  }

  if (bulkLabelBtn && bulkLabelInput) {
    bulkLabelBtn.addEventListener("click", function () {
      var label = (bulkLabelInput.value || "").trim();
      if (!label || !selectedTransactionIds.size) return;
      var lower = label.toLowerCase();
      state.transactions.forEach(function (tx) {
        if (!selectedTransactionIds.has(tx.id)) return;
        if (!tx.labels) tx.labels = [];
        var exists = tx.labels.some(function (l) {
          return l.toLowerCase() === lower;
        });
        if (!exists) tx.labels.push(label);
      });
      bulkLabelInput.value = "";
      renderTransactionsTable();
      refreshTransactionsFilterOptions();
    });
  }
}

// build flat category list in tree-order for dropdowns
function getCategoryOptionsFlat() {
  var result = [];
  if (!state.categories.length) return result;

  var childrenMap = {};
  state.categories.forEach(function (c) {
    var key = c.parentId || "root";
    if (!childrenMap[key]) childrenMap[key] = [];
    childrenMap[key].push(c);
  });

  function dfs(cat, depth, pathLabel) {
    var label =
      (depth > 0 ? Array(depth + 1).join("  ") : "") + cat.name;
    result.push({ id: cat.id, label: label, fullPath: pathLabel });
    var children = childrenMap[cat.id] || [];
    children.forEach(function (child) {
      dfs(child, depth + 1, pathLabel + " › " + child.name);
    });
  }

  var roots = childrenMap["root"] || [];
  roots.forEach(function (root) {
    dfs(root, 0, root.name);
  });

  return result;
}

// refresh account + category filter options & bulk category select
function refreshTransactionsFilterOptions() {
  var accountSelect = document.getElementById("tx-filter-account");
  var categorySelect = document.getElementById("tx-filter-category");
  var bulkCatSelect = document.getElementById("bulk-category-select");

  var accounts = new Set();
  state.transactions.forEach(function (tx) {
    if (tx.account) accounts.add(tx.account);
  });

  if (accountSelect) {
    var current = accountSelect.value;
    accountSelect.innerHTML = '<option value="all">All accounts</option>';
    accounts.forEach(function (acc) {
      var opt = document.createElement("option");
      opt.value = acc;
      opt.textContent = acc;
      accountSelect.appendChild(opt);
    });
    if (current && current !== "all") accountSelect.value = current;
  }

  var catOptions = getCategoryOptionsFlat();

  function fillCategorySelect(select, includeAll) {
    if (!select) return;
    var cur = select.value;
    select.innerHTML = "";
    if (includeAll) {
      var optAll = document.createElement("option");
      optAll.value = "all";
      optAll.textContent = "All categories";
      select.appendChild(optAll);
    } else {
      var optNone = document.createElement("option");
      optNone.value = "none";
      optNone.textContent = "Select category";
      select.appendChild(optNone);
    }
    catOptions.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.label;
      select.appendChild(opt);
    });
    if (cur) select.value = cur;
  }

  fillCategorySelect(categorySelect, true);
  fillCategorySelect(bulkCatSelect, false);
}

// ===== TRANSACTION MODAL (add / duplicate) =====
function setupTransactionModal() {
  var modal = document.getElementById("transaction-editor-modal");
  if (!modal) return;

  var backdrop = modal.querySelector(".modal-backdrop");
  var cancelBtn = document.getElementById("tx-modal-cancel");
  var saveBtn = document.getElementById("tx-modal-save");

  function closeModal() {
    modal.classList.add("hidden");
  }

  if (backdrop) backdrop.addEventListener("click", closeModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

  if (saveBtn) {
    saveBtn.addEventListener("click", function () {
      var date = document.getElementById("tx-modal-date").value;
      var desc = document.getElementById("tx-modal-description").value;
      var oAmt = parseFloat(
        document.getElementById("tx-modal-original-amount").value || "0"
      );
      var oCur = document.getElementById("tx-modal-original-currency").value || "AED";
      var cAmt = parseFloat(
        document.getElementById("tx-modal-converted-amount").value || "0"
      );
      var cCur = document.getElementById("tx-modal-converted-currency").value || "AED";
      var account = document.getElementById("tx-modal-account").value;
      var labelsText = document
        .getElementById("tx-modal-labels")
        .value.trim();
      var catSelect = document.getElementById("tx-modal-category");
      var categoryId = catSelect ? catSelect.value || null : null;

      var labels = [];
      if (labelsText) {
        labels = labelsText
          .split(",")
          .map(function (t) {
            return t.trim();
          })
          .filter(Boolean);
      }

      var newId =
        state.transactions.reduce(function (max, tx) {
          return Math.max(max, tx.id);
        }, 0) + 1;

      var tx = {
        id: newId,
        date: date || new Date().toISOString().slice(0, 10),
        description: desc || "",
        originalAmount: isNaN(oAmt) ? 0 : oAmt,
        originalCurrency: oCur,
        convertedAmount: isNaN(cAmt) ? 0 : cAmt,
        convertedCurrency: cCur,
        categoryId: categoryId,
        account: account || "",
        labels: labels
      };

      state.transactions.push(tx);
      refreshTransactionsFilterOptions();
      renderTransactionsTable();
      renderIncomeStatement();
      closeModal();
    });
  }
}

function openTransactionModal(mode, sourceTx) {
  var modal = document.getElementById("transaction-editor-modal");
  if (!modal) return;

  txModalMode = mode;
  txModalSourceTx = sourceTx || null;

  var titleEl = document.getElementById("tx-modal-title");
  if (titleEl) {
    titleEl.textContent =
      mode === "duplicate" ? "Duplicate transaction" : "Add transaction";
  }

  var dateInput = document.getElementById("tx-modal-date");
  var descInput = document.getElementById("tx-modal-description");
  var oAmtInput = document.getElementById("tx-modal-original-amount");
  var oCurInput = document.getElementById("tx-modal-original-currency");
  var cAmtInput = document.getElementById("tx-modal-converted-amount");
  var cCurInput = document.getElementById("tx-modal-converted-currency");
  var accInput = document.getElementById("tx-modal-account");
  var labelsInput = document.getElementById("tx-modal-labels");
  var catSelect = document.getElementById("tx-modal-category");

  // fill category options
  if (catSelect) {
    var opts = getCategoryOptionsFlat();
    catSelect.innerHTML = "";
    var optNone = document.createElement("option");
    optNone.value = "";
    optNone.textContent = "Uncategorised";
    catSelect.appendChild(optNone);
    opts.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.label;
      catSelect.appendChild(opt);
    });
  }

  var today = new Date().toISOString().slice(0, 10);

  if (mode === "duplicate" && sourceTx) {
    dateInput.value = sourceTx.date || today;
    descInput.value = sourceTx.description || "";
    oAmtInput.value = sourceTx.originalAmount;
    oCurInput.value = sourceTx.originalCurrency || "AED";
    cAmtInput.value = sourceTx.convertedAmount;
    cCurInput.value = sourceTx.convertedCurrency || "AED";
    accInput.value = sourceTx.account || "";
    labelsInput.value = (sourceTx.labels || []).join(", ");
    if (catSelect && sourceTx.categoryId) {
      catSelect.value = sourceTx.categoryId;
    }
  } else {
    dateInput.value = today;
    descInput.value = "";
    oAmtInput.value = "";
    oCurInput.value = "AED";
    cAmtInput.value = "";
    cCurInput.value = "AED";
    accInput.value = "";
    labelsInput.value = "";
    if (catSelect) catSelect.value = "";
  }

  modal.classList.remove("hidden");
}

// ===== TRANSACTIONS TABLE RENDERING =====
function renderTransactionsTable() {
  var tbody = document.getElementById("transactions-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  var txs = getTransactionsForTable();
  var dateHeader = document.getElementById("tx-header-date");

  if (dateHeader) {
    var base = "Date";
    var dir = state.txFilter.sortByDate;
    if (dir === "asc") dateHeader.textContent = base + " ▲";
    else if (dir === "desc") dateHeader.textContent = base + " ▼";
    else dateHeader.textContent = base;
  }

  txs.forEach(function (tx) {
    var tr = document.createElement("tr");

    // checkbox
    var selectTd = document.createElement("td");
    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedTransactionIds.has(tx.id);
    checkbox.addEventListener("change", function () {
      if (checkbox.checked) selectedTransactionIds.add(tx.id);
      else selectedTransactionIds.delete(tx.id);
    });
    selectTd.appendChild(checkbox);

    var dateTd = document.createElement("td");
    dateTd.textContent = tx.date;

    var descTd = document.createElement("td");
    descTd.textContent = tx.description;

    var origTd = document.createElement("td");
    origTd.textContent = formatAmountCurrency(
      tx.originalAmount,
      tx.originalCurrency
    );

    var convTd = document.createElement("td");
    convTd.textContent = formatAmountCurrency(
      tx.convertedAmount,
      tx.convertedCurrency
    );

    var catTd = document.createElement("td");
    var catSelect = document.createElement("select");
    catSelect.className = "filter-select";
    var opts = getCategoryOptionsFlat();
    var optNone = document.createElement("option");
    optNone.value = "";
    optNone.textContent = "Uncategorised";
    catSelect.appendChild(optNone);
    opts.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.label;
      catSelect.appendChild(opt);
    });
    if (tx.categoryId) catSelect.value = tx.categoryId;
    catSelect.addEventListener("change", function () {
      tx.categoryId = catSelect.value || null;
      renderIncomeStatement();
    });
    catTd.appendChild(catSelect);

    var accTd = document.createElement("td");
    accTd.textContent = tx.account || "";

    var labelsTd = document.createElement("td");
    labelsTd.textContent = (tx.labels || []).join(", ");

    var actionsTd = document.createElement("td");
    var dupBtn = document.createElement("button");
    dupBtn.textContent = "Duplicate";
    dupBtn.className = "table-link-button";
    dupBtn.addEventListener("click", function () {
      openTransactionModal("duplicate", tx);
    });
    actionsTd.appendChild(dupBtn);

    tr.appendChild(selectTd);
    tr.appendChild(dateTd);
    tr.appendChild(descTd);
    tr.appendChild(origTd);
    tr.appendChild(convTd);
    tr.appendChild(catTd);
    tr.appendChild(accTd);
    tr.appendChild(labelsTd);
    tr.appendChild(actionsTd);

    tbody.appendChild(tr);
  });
}

function getTransactionsForTable() {
  var f = state.txFilter;
  var list = state.transactions.slice();

  // text search: description, account, category name
  if (f.text) {
    list = list.filter(function (tx) {
      var catName = getCategoryName(tx.categoryId);
      var hay =
        (tx.description || "") +
        " " +
        (tx.account || "") +
        " " +
        (catName || "");
      return hay.toLowerCase().indexOf(f.text) >= 0;
    });
  }

  // account filter
  if (f.account && f.account !== "all") {
    list = list.filter(function (tx) {
      return tx.account === f.account;
    });
  }

  // category filter
  if (f.categoryId && f.categoryId !== "all") {
    list = list.filter(function (tx) {
      return tx.categoryId === f.categoryId;
    });
  }

  // label filter (contains text)
  if (f.labelText) {
    list = list.filter(function (tx) {
      var labels = tx.labels || [];
      var combined = labels.join(" ").toLowerCase();
      return combined.indexOf(f.labelText) >= 0;
    });
  }

  // date filters
  if (f.dateMode !== "any") {
    list = list.filter(function (tx) {
      var d = tx.date;
      if (!d) return false;
      if (f.dateMode === "on" && f.from) return d === f.from;
      if (f.dateMode === "before" && f.from) return d < f.from;
      if (f.dateMode === "after" && f.from) return d > f.from;
      if (f.dateMode === "between" && f.from && f.to)
        return d >= f.from && d <= f.to;
      return true;
    });
  }

  // sort by date
  if (f.sortByDate === "asc" || f.sortByDate === "desc") {
    list.sort(function (a, b) {
      if (a.date === b.date) return a.id - b.id;
      if (a.date < b.date) return f.sortByDate === "asc" ? -1 : 1;
      return f.sortByDate === "asc" ? 1 : -1;
    });
  }

  return list;
}

// ===== INCOME STATEMENT (Dashboard) =====
function renderIncomeStatement() {
  var container = document.getElementById("income-statement");
  if (!container) return;
  container.innerHTML = "";

  var filtered = getFilteredTransactionsDashboard();
  var groups = { Income: {}, Expense: {} };

  filtered.forEach(function (tx) {
    var cat = state.categories.find(function (c) {
      return c.id === tx.categoryId;
    });
    var type =
      cat && cat.type ? cat.type : tx.convertedAmount >= 0 ? "Income" : "Expense";
    var group = type === "Income" ? groups.Income : groups.Expense;
    var key = getCategoryName(tx.categoryId);
    if (!group[key]) group[key] = 0;
    group[key] += tx.convertedAmount;
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

// transactions filtered by dashboard period selector
function getFilteredTransactionsDashboard() {
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

// ===== HELPERS =====
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

function formatAmountCurrency(amount, currency) {
  return formatAmount(amount) + " " + (currency || "");
}

function sumValues(obj) {
  var sum = 0;
  for (var k in obj) {
    if (obj.hasOwnProperty(k)) sum += obj[k];
  }
  return sum;
}

document.addEventListener("DOMContentLoaded", init);
