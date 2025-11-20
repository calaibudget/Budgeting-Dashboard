console.log("App script loaded");

// ========== STATE ==========
var state = {
  transactions: [],
  categories: [],
  dateFilter: {
    mode: "6m", // default
    from: null,
    to: null
  }
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
      type: "Income"
    },
    {
      id: "Income > Performance Bonus",
      name: "Performance Bonus",
      parentId: "Income",
      type: "Income"
    },

    {
      id: "Food & Drinks",
      name: "Food & Drinks",
      parentId: null,
      type: "Expense"
    },
    {
      id: "Food & Drinks > Groceries",
      name: "Groceries",
      parentId: "Food & Drinks",
      type: "Expense"
    },
    {
      id: "Food & Drinks > Restaurants",
      name: "Restaurants",
      parentId: "Food & Drinks",
      type: "Expense"
    },
    {
      id: "Food & Drinks > Food Delivery",
      name: "Food Delivery",
      parentId: "Food & Drinks",
      type: "Expense"
    },

    {
      id: "Life & Entertainment",
      name: "Life & Entertainment",
      parentId: null,
      type: "Expense"
    },
    {
      id: "Life & Entertainment > Gifts",
      name: "Gifts",
      parentId: "Life & Entertainment",
      type: "Expense"
    }
  ];

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

// ========== PERIOD FILTER (dashboard only) ==========
function setupPeriodFilter() {
  console.log("setupPeriodFilter");
  var select = document.getElementById("period-select");
  var customRange = document.getElementById("custom-range");
  var fromInput = document.getElementById("date-from");
  var toInput = document.getElementById("date-to");

  if (!select) {
    console.log("period-select not found (ok if you removed it)");
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

  // prefill editor from current state
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

// build dashed text from state.categories
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

// parse dashed text -> category objects
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

// ========== CATEGORY TREE RENDERING ==========
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

  // newest first
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

// ========== INCOME STATEMENT (TREE VIEW) ==========
function renderIncomeStatement() {
  var container = document.getElementById("income-statement");
  if (!container) return;
  container.innerHTML = "";

  var filtered = getFilteredTransactions();
  if (!filtered.length) {
    container.textContent = "No transactions in the selected period.";
    return;
  }

  // Map categoryId -> category object
  var catMap = {};
  state.categories.forEach(function (c) {
    catMap[c.id] = c;
  });

  // Aggregate along the category chain:
  // every transaction amount is added to its category AND all parents.
  var amountByCategory = {};
  filtered.forEach(function (tx) {
    var current = catMap[tx.categoryId] || null;
    while (current) {
      if (!amountByCategory[current.id]) amountByCategory[current.id] = 0;
      amountByCategory[current.id] += tx.amount;
      current = current.parentId ? catMap[current.parentId] : null;
    }
  });

  // Build children map (full tree)
  var childrenMap = {};
  state.categories.forEach(function (c) {
    var key = c.parentId || "root";
    if (!childrenMap[key]) childrenMap[key] = [];
    childrenMap[key].push(c);
  });

  // Totals
  var totalIncome = 0;
  var totalExpenses = 0;

  state.categories.forEach(function (c) {
    var amt = amountByCategory[c.id] || 0;
    if (c.type === "Income") {
      totalIncome += amt; // expected positive
    } else if (c.type === "Expense") {
      // store as positive total for percentages
      totalExpenses += Math.max(-amt, 0);
    }
  });

  // INCOME SECTION
  var incomeSection = buildStatementSection({
    sectionType: "Income",
    title: "INCOME",
    amountByCategory: amountByCategory,
    childrenMap: childrenMap,
    totalIncome: totalIncome,
    totalExpenses: totalExpenses
  });
  container.appendChild(incomeSection);

  // EXPENSE SECTION
  var expenseSection = buildStatementSection({
    sectionType: "Expense",
    title: "EXPENSE",
    amountByCategory: amountByCategory,
    childrenMap: childrenMap,
    totalIncome: totalIncome,
    totalExpenses: totalExpenses
  });
  container.appendChild(expenseSection);

  // Totals + Net
  var totals = document.createElement("div");
  totals.className = "statement-summary-row";

  var totalIncomeSpan = document.createElement("div");
  totalIncomeSpan.textContent = "Total income: " + formatAmount(totalIncome);

  var totalExpenseSpan = document.createElement("div");
  totalExpenseSpan.textContent =
    "Total expenses: " + formatAmount(totalExpenses);

  var netSpan = document.createElement("div");
  netSpan.textContent =
    "Net: " + formatAmount(totalIncome - totalExpenses);

  totals.appendChild(totalIncomeSpan);
  totals.appendChild(totalExpenseSpan);
  totals.appendChild(netSpan);

  container.appendChild(totals);
}

/**
 * Build a whole section (Income or Expense) with header + tree.
 * sectionType: "Income" | "Expense"
 */
function buildStatementSection(opts) {
  var sectionType = opts.sectionType;
  var title = opts.title;
  var amountByCategory = opts.amountByCategory;
  var childrenMap = opts.childrenMap;
  var totalIncome = opts.totalIncome;
  var totalExpenses = opts.totalExpenses;

  var section = document.createElement("div");
  section.className = "statement-section";

  // Title
  var header = document.createElement("div");
  header.className = "statement-section__title";
  header.textContent =
    title + (totalIncome ? " (base: " + formatAmount(totalIncome) + ")" : "");
  section.appendChild(header);

  // Column headers
  var headerRow = document.createElement("div");
  headerRow.className = "statement-row statement-row--header";

  var hLabel = document.createElement("span");
  hLabel.className = "statement-cell label";
  hLabel.textContent = "Category";

  var hAmount = document.createElement("span");
  hAmount.className = "statement-cell amount";
  hAmount.textContent = "Amount";

  var hPctIncome = document.createElement("span");
  hPctIncome.className = "statement-cell pct";
  hPctIncome.textContent = "% of income";

  var hPctSection = document.createElement("span");
  hPctSection.className = "statement-cell pct-section";
  hPctSection.textContent =
    sectionType === "Income" ? "" : "% of expenses";

  headerRow.appendChild(hLabel);
  headerRow.appendChild(hAmount);
  headerRow.appendChild(hPctIncome);
  headerRow.appendChild(hPctSection);
  section.appendChild(headerRow);

  // Roots for this section (top-level categories of the correct type)
  var roots = (childrenMap["root"] || []).filter(function (c) {
    return c.type === sectionType;
  });

  roots.forEach(function (root) {
    var nodeEl = buildStatementTreeNode({
      node: root,
      level: 0,
      sectionType: sectionType,
      amountByCategory: amountByCategory,
      childrenMap: childrenMap,
      totalIncome: totalIncome,
      totalExpenses: totalExpenses
    });
    section.appendChild(nodeEl);
  });

  return section;
}

/**
 * Recursive builder: one <details> per category node.
 */
function buildStatementTreeNode(opts) {
  var node = opts.node;
  var level = opts.level;
  var sectionType = opts.sectionType;
  var amountByCategory = opts.amountByCategory;
  var childrenMap = opts.childrenMap;
  var totalIncome = opts.totalIncome;
  var totalExpenses = opts.totalExpenses;

  var children = (childrenMap[node.id] || []).filter(function (c) {
    return c.type === sectionType;
  });
  var hasChildren = children.length > 0;

  var rawAmt = amountByCategory[node.id] || 0;
  var displayAmount =
    node.type === "Expense" ? Math.max(-rawAmt, 0) : rawAmt;

  var pctOfIncome =
    totalIncome ? (displayAmount / totalIncome) * 100 : 0;

  var sectionTotal =
    sectionType === "Income" ? totalIncome : totalExpenses;

  var pctOfSection =
    sectionTotal ? (displayAmount / sectionTotal) * 100 : 0;

  // Wrap everything in <details> so you can collapse/expand
  var details = document.createElement("details");
  details.open = true;
  details.className = "statement-node level-" + level;
  if (!hasChildren) {
    details.classList.add("leaf");
  }

  var summary = document.createElement("summary");
  summary.className = "statement-row";

  // Label cell (with indentation + chevron)
  var labelCell = document.createElement("span");
  labelCell.className = "statement-cell label";
  labelCell.style.paddingLeft = 12 + level * 20 + "px";

  if (hasChildren) {
    var chevron = document.createElement("span");
    chevron.className = "statement-chevron";
    chevron.textContent = "▾";
    labelCell.appendChild(chevron);
  } else {
    var spacer = document.createElement("span");
    spacer.className = "statement-chevron statement-chevron--empty";
    spacer.textContent = "•";
    labelCell.appendChild(spacer);
  }

  var nameSpan = document.createElement("span");
  nameSpan.textContent = node.name;
  labelCell.appendChild(nameSpan);

  // Amount
  var amountCell = document.createElement("span");
  amountCell.className = "statement-cell amount";
  amountCell.textContent = formatAmount(displayAmount);

  // % of income
  var pctIncomeCell = document.createElement("span");
  pctIncomeCell.className = "statement-cell pct";
  pctIncomeCell.textContent = totalIncome
    ? pctOfIncome.toFixed(2) + "%"
    : "-";

  // % of expenses / section
  var pctSectionCell = document.createElement("span");
  pctSectionCell.className = "statement-cell pct-section";
  if (sectionType === "Expense" && totalExpenses) {
    pctSectionCell.textContent = pctOfSection.toFixed(2) + "%";
  } else {
    pctSectionCell.textContent = "";
  }

  summary.appendChild(labelCell);
  summary.appendChild(amountCell);
  summary.appendChild(pctIncomeCell);
  summary.appendChild(pctSectionCell);

  details.appendChild(summary);

  // Children
  children.forEach(function (child) {
    var childEl = buildStatementTreeNode({
      node: child,
      level: level + 1,
      sectionType: sectionType,
      amountByCategory: amountByCategory,
      childrenMap: childrenMap,
      totalIncome: totalIncome,
      totalExpenses: totalExpenses
    });
    details.appendChild(childEl);
  });

  return details;
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
  var idxConvAmt = idx(["amount in base currency", "amount (account)", "amount"]);
  var idxCategory = idx(["category"]);
  var idxAccount = idx(["account"]);

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
    maximumFractionDigits: 2
  });
}

function sumValues(obj) {
  var sum = 0;
  for (var k in obj) {
    if (obj.hasOwnProperty(k)) sum += obj[k];
  }
  return sum;
}

// drag & drop
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

  var tx = state.transactions.find(function (t) {
    return t.id === draggedTransactionId;
  });
  if (!tx) return;

  tx.categoryId = categoryId;
  rerenderAll();
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
