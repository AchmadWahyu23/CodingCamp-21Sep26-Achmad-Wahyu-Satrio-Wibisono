/* =============================================
   BudgetTrack – expense.js
   Vanilla JS, no dependencies
   ============================================= */

'use strict';

/* ── 1. Constants & Palette ── */
const STORAGE_KEYS = {
  transactions: 'bt_transactions',
  categories:   'bt_categories',
  theme:        'bt_theme',
  limit:        'bt_limit',
};

const CHART_PALETTE = [
  '#1e40af','#3b82f6','#60a5fa','#93c5fd','#2563eb',
  '#1e3a8a','#1d4ed8','#3730a3','#4338ca','#6366f1',
  '#818cf8','#4f46e5','#6d28d9','#7c3aed','#a78bfa',
];

const DEFAULT_CATEGORIES = [
  { id: 'food',          label: '🍔 Food',          type: 'expense' },
  { id: 'transport',     label: '🚗 Transport',      type: 'expense' },
  { id: 'shopping',      label: '🛍️ Shopping',       type: 'expense' },
  { id: 'bills',         label: '💡 Bills',          type: 'expense' },
  { id: 'health',        label: '🏥 Health',         type: 'expense' },
  { id: 'entertainment', label: '🎬 Entertainment',  type: 'expense' },
  { id: 'education',     label: '📚 Education',      type: 'expense' },
  { id: 'salary',        label: '💼 Salary',         type: 'income'  },
  { id: 'freelance',     label: '💻 Freelance',      type: 'income'  },
  { id: 'gift',          label: '🎁 Gift',           type: 'both'    },
  { id: 'other',         label: '📦 Other',          type: 'both'    },
];

/* ── 2. State ── */
let transactions = [];
let categories   = [];
let spendingLimit = 0;
let pendingDeleteId = null;
let currentMonthOffset = 0; // 0 = this month, -1 = last month, etc.

/* ── 3. Persistence helpers ── */
const load = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
};
const save = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
};

/* ── 4. Bootstrap ── */
function init() {
  transactions  = load(STORAGE_KEYS.transactions, []);
  categories    = load(STORAGE_KEYS.categories,   DEFAULT_CATEGORIES);
  spendingLimit = load(STORAGE_KEYS.limit, 0);

  // Apply saved theme
  const savedTheme = load(STORAGE_KEYS.theme, 'light');
  setTheme(savedTheme, false);

  // Set today's date as default
  document.getElementById('txDate').valueAsDate = new Date();

  // Limit input
  if (spendingLimit > 0) {
    document.getElementById('limitInput').value = spendingLimit;
  }

  bindEvents();
  populateCategoryDropdowns();
  render();
}

/* ── 5. Theme ── */
function setTheme(theme, persist = true) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('themeIcon').textContent = theme === 'dark' ? '☀️' : '🌙';
  if (persist) save(STORAGE_KEYS.theme, theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
}

/* ── 6. Categories ── */
function populateCategoryDropdowns() {
  const txTypeSel  = document.getElementById('txType');
  const txCatSel   = document.getElementById('txCategory');
  const filterCat  = document.getElementById('filterCategory');
  const type       = txTypeSel.value;

  // Transaction form dropdown
  txCatSel.innerHTML = '';
  categories
    .filter(c => c.type === type || c.type === 'both')
    .forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.label;
      txCatSel.appendChild(opt);
    });

  // Filter dropdown (all categories)
  filterCat.innerHTML = '<option value="all">All categories</option>';
  categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.label;
    filterCat.appendChild(opt);
  });

  renderCategoryManager();
}

function getCategoryById(id) {
  return categories.find(c => c.id === id) || { label: id, id };
}

function getCategoryLabel(id) {
  const cat = getCategoryById(id);
  return cat ? cat.label : id;
}

function renderCategoryManager() {
  const list = document.getElementById('categoryList');
  list.innerHTML = '';
  categories.forEach(cat => {
    const li = document.createElement('li');
    li.className = 'category-item';
    li.innerHTML = `
      <span>${cat.label}</span>
      <button class="cat-delete" data-id="${cat.id}" title="Remove category" aria-label="Remove ${cat.label}">✕</button>
    `;
    list.appendChild(li);
  });
}

/* ── 7. Format helpers ── */
function formatRp(amount) {
  return 'Rp ' + Math.abs(amount).toLocaleString('id-ID');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ── 8. Add Transaction ── */
function addTransaction(e) {
  e.preventDefault();
  const errEl = document.getElementById('formError');
  errEl.classList.add('hidden');

  const desc   = document.getElementById('txDescription').value.trim();
  const amount = parseFloat(document.getElementById('txAmount').value);
  const type   = document.getElementById('txType').value;
  const cat    = document.getElementById('txCategory').value;
  const date   = document.getElementById('txDate').value;

  if (!desc)          return showFormError('Please enter a description.');
  if (!amount || amount <= 0) return showFormError('Please enter a valid amount.');
  if (!date)          return showFormError('Please select a date.');

  const tx = {
    id:       crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
    desc,
    amount,
    type,
    category: cat,
    date,
    createdAt: Date.now(),
  };

  transactions.unshift(tx);
  save(STORAGE_KEYS.transactions, transactions);

  // Reset form (keep date & type)
  document.getElementById('txDescription').value = '';
  document.getElementById('txAmount').value = '';
  document.getElementById('txDate').valueAsDate = new Date();

  render();
}

function showFormError(msg) {
  const el = document.getElementById('formError');
  el.textContent = msg;
  el.classList.remove('hidden');
}

/* ── 9. Delete Transaction ── */
function requestDelete(id) {
  pendingDeleteId = id;
  document.getElementById('deleteModal').classList.remove('hidden');
}

function confirmDelete() {
  if (!pendingDeleteId) return;
  transactions = transactions.filter(t => t.id !== pendingDeleteId);
  save(STORAGE_KEYS.transactions, transactions);
  pendingDeleteId = null;
  document.getElementById('deleteModal').classList.add('hidden');
  render();
}

function cancelDelete() {
  pendingDeleteId = null;
  document.getElementById('deleteModal').classList.add('hidden');
}

function clearAll() {
  if (!confirm('Delete ALL transactions? This cannot be undone.')) return;
  transactions = [];
  save(STORAGE_KEYS.transactions, transactions);
  render();
}

/* ── 10. Computed totals ── */
function computeTotals(txList) {
  let income = 0, expense = 0;
  txList.forEach(t => {
    if (t.type === 'income')  income  += t.amount;
    else                      expense += t.amount;
  });
  return { income, expense, balance: income - expense };
}

/* ── 11. Spending limit logic ── */
function checkLimit() {
  if (!spendingLimit || spendingLimit <= 0) {
    document.getElementById('limitWarning').classList.add('hidden');
    return;
  }

  // Check current month total expense
  const now    = new Date();
  const month  = now.getMonth();
  const year   = now.getFullYear();

  const monthExpense = transactions
    .filter(t => {
      const d = new Date(t.date + 'T00:00:00');
      return t.type === 'expense' && d.getMonth() === month && d.getFullYear() === year;
    })
    .reduce((sum, t) => sum + t.amount, 0);

  const warning = document.getElementById('limitWarning');
  const warnText = document.getElementById('limitWarningText');

  if (monthExpense >= spendingLimit) {
    const pct = Math.round((monthExpense / spendingLimit) * 100);
    warnText.textContent =
      `Monthly spending (${formatRp(monthExpense)}) has reached ${pct}% of your ${formatRp(spendingLimit)} limit!`;
    warning.classList.remove('hidden');
  } else if (monthExpense >= spendingLimit * 0.8) {
    const pct = Math.round((monthExpense / spendingLimit) * 100);
    warnText.textContent =
      `Heads up! You've used ${pct}% of your monthly limit (${formatRp(monthExpense)} / ${formatRp(spendingLimit)}).`;
    warning.classList.remove('hidden');
  } else {
    warning.classList.add('hidden');
  }
}

/* ── 12. Render transaction item ── */
function buildTxItem(tx, isOverLimit = false) {
  const cat   = getCategoryById(tx.category);
  const emoji = cat ? cat.label.split(' ')[0] : '📦';
  const li    = document.createElement('li');
  li.className = 'tx-item' + (isOverLimit ? ' over-limit' : '');
  li.innerHTML = `
    <div class="tx-icon ${tx.type}">
      <span>${emoji}</span>
    </div>
    <div class="tx-info">
      <p class="tx-desc" title="${escHtml(tx.desc)}">${escHtml(tx.desc)}</p>
      <p class="tx-meta">${getCategoryLabel(tx.category)} · ${formatDate(tx.date)}</p>
    </div>
    <span class="tx-amount ${tx.type}">
      ${tx.type === 'income' ? '+' : '-'}${formatRp(tx.amount)}
    </span>
    <button class="tx-delete" data-id="${tx.id}" title="Delete" aria-label="Delete transaction">🗑️</button>
  `;
  return li;
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── 13. Render: Overview ── */
function renderOverview() {
  const { income, expense, balance } = computeTotals(transactions);

  document.getElementById('totalBalance').textContent = formatRp(balance);
  document.getElementById('totalIncome').textContent  = formatRp(income);
  document.getElementById('totalExpense').textContent = formatRp(expense);

  // Color balance negative red
  const balEl = document.getElementById('totalBalance');
  balEl.style.color = balance < 0 ? '#fca5a5' : '#fff';

  // Recent list (last 5)
  const recentList = document.getElementById('recentList');
  recentList.innerHTML = '';
  const recent = transactions.slice(0, 5);
  if (recent.length === 0) {
    recentList.innerHTML = '<li class="empty-state">No transactions yet.</li>';
  } else {
    recent.forEach(tx => recentList.appendChild(buildTxItem(tx)));
  }

  renderDonutChart();
  checkLimit();
}

/* ── 14. Render: All Transactions ── */
function renderAllTransactions() {
  const sortVal   = document.getElementById('sortSelect').value;
  const typeVal   = document.getElementById('filterType').value;
  const catVal    = document.getElementById('filterCategory').value;

  let filtered = [...transactions];

  // Filter type
  if (typeVal !== 'all') filtered = filtered.filter(t => t.type === typeVal);

  // Filter category
  if (catVal !== 'all') filtered = filtered.filter(t => t.category === catVal);

  // Sort
  filtered.sort((a, b) => {
    switch (sortVal) {
      case 'date-asc':    return a.date.localeCompare(b.date);
      case 'date-desc':   return b.date.localeCompare(a.date);
      case 'amount-asc':  return a.amount - b.amount;
      case 'amount-desc': return b.amount - a.amount;
      case 'category-asc':return getCategoryLabel(a.category).localeCompare(getCategoryLabel(b.category));
      default:            return 0;
    }
  });

  const list = document.getElementById('allTransactionsList');
  list.innerHTML = '';

  if (filtered.length === 0) {
    list.innerHTML = '<li class="empty-state">No transactions match your filters.</li>';
    return;
  }

  // Determine over-limit transactions (flag the top ones if total expense exceeds limit)
  const now = new Date();
  filtered.forEach(tx => {
    const d = new Date(tx.date + 'T00:00:00');
    const isThisMonth = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    const isOverLimit = spendingLimit > 0 && tx.type === 'expense' && isThisMonth &&
      (computeTotals(transactions).expense >= spendingLimit * 0.8);
    list.appendChild(buildTxItem(tx, isOverLimit));
  });
}

/* ── 15. Render: Monthly Summary ── */
function renderMonthly() {
  const now = new Date();
  const d   = new Date(now.getFullYear(), now.getMonth() + currentMonthOffset, 1);
  const month = d.getMonth();
  const year  = d.getFullYear();

  document.getElementById('currentMonthLabel').textContent =
    d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  const monthTx = transactions.filter(t => {
    const td = new Date(t.date + 'T00:00:00');
    return td.getMonth() === month && td.getFullYear() === year;
  });

  const { income, expense, balance } = computeTotals(monthTx);
  document.getElementById('monthlyIncome').textContent  = formatRp(income);
  document.getElementById('monthlyExpense').textContent = formatRp(expense);
  const netEl = document.getElementById('monthlyNet');
  netEl.textContent  = formatRp(balance);
  netEl.style.color  = balance < 0 ? 'var(--expense-color)' : 'var(--income-color)';

  // Monthly list (sorted newest first)
  const list = document.getElementById('monthlyList');
  list.innerHTML = '';
  const sorted = [...monthTx].sort((a, b) => b.date.localeCompare(a.date));
  if (sorted.length === 0) {
    list.innerHTML = '<li class="empty-state">No transactions this month.</li>';
  } else {
    sorted.forEach(tx => list.appendChild(buildTxItem(tx)));
  }

  renderMonthlyBarChart(monthTx);
}

/* ── 16. Donut Chart (Category pie) ── */
function renderDonutChart() {
  const canvas = document.getElementById('categoryChart');
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const expenseTx = transactions.filter(t => t.type === 'expense');
  const legendEl  = document.getElementById('chartLegend');
  const emptyEl   = document.getElementById('chartEmpty');

  if (expenseTx.length === 0) {
    emptyEl.classList.remove('hidden');
    legendEl.innerHTML = '';
    return;
  }
  emptyEl.classList.add('hidden');

  // Aggregate by category
  const totals = {};
  expenseTx.forEach(t => {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  });

  const entries   = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const grandTotal = entries.reduce((s, [, v]) => s + v, 0);

  const cx = W / 2, cy = H / 2;
  const outerR = Math.min(W, H) / 2 - 10;
  const innerR = outerR * 0.55;

  let startAngle = -Math.PI / 2;

  entries.forEach(([catId, value], i) => {
    const slice = (value / grandTotal) * Math.PI * 2;
    const color = CHART_PALETTE[i % CHART_PALETTE.length];

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerR, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    startAngle += slice;
  });

  // Donut hole
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle = getComputedStyle(document.documentElement)
    .getPropertyValue('--surface').trim() || '#ffffff';
  ctx.fill();

  // Center text
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  ctx.fillStyle = isDark ? '#f1f5f9' : '#111827';
  ctx.font = `bold ${Math.round(outerR * 0.18)}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(formatRp(grandTotal), cx, cy - outerR * 0.08);
  ctx.font = `${Math.round(outerR * 0.13)}px -apple-system, sans-serif`;
  ctx.fillStyle = isDark ? '#94a3b8' : '#6b7280';
  ctx.fillText('Total Expenses', cx, cy + outerR * 0.13);

  // Legend
  legendEl.innerHTML = '';
  entries.forEach(([catId, value], i) => {
    const pct   = Math.round((value / grandTotal) * 100);
    const color = CHART_PALETTE[i % CHART_PALETTE.length];
    const label = getCategoryLabel(catId);
    const li    = document.createElement('li');
    li.className = 'legend-item';
    li.innerHTML = `
      <span class="legend-dot" style="background:${color}"></span>
      <span>${label} <strong>${pct}%</strong></span>
    `;
    legendEl.appendChild(li);
  });
}

/* ── 17. Monthly Bar Chart ── */
function renderMonthlyBarChart(monthTx) {
  const canvas = document.getElementById('monthlyChart');
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const expenseTx = monthTx.filter(t => t.type === 'expense');
  if (expenseTx.length === 0) return;

  // Aggregate by category
  const totals = {};
  expenseTx.forEach(t => {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  });

  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const maxVal  = Math.max(...entries.map(([, v]) => v));
  const isDark  = document.documentElement.getAttribute('data-theme') === 'dark';

  const PAD_L = 8, PAD_R = 8, PAD_T = 12, PAD_B = 36;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const barW   = Math.floor(chartW / entries.length) - 6;
  const gap    = Math.floor((chartW - barW * entries.length) / (entries.length + 1));

  entries.forEach(([catId, value], i) => {
    const barH  = Math.max(4, Math.round((value / maxVal) * chartH));
    const x     = PAD_L + gap + i * (barW + gap);
    const y     = PAD_T + chartH - barH;
    const color = CHART_PALETTE[i % CHART_PALETTE.length];

    // Bar
    ctx.fillStyle = color;
    roundRect(ctx, x, y, barW, barH, 4);
    ctx.fill();

    // Label (emoji only)
    const cat   = getCategoryById(catId);
    const emoji = cat ? cat.label.split(' ')[0] : '📦';
    ctx.font = `${Math.round(barW * 0.55)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(emoji, x + barW / 2, PAD_T + chartH + 4);
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* ── 18. Master render ── */
function render() {
  renderOverview();
  renderAllTransactions();
  renderMonthly();
}

/* ── 19. Tab switching ── */
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const isActive = btn.dataset.tab === tabId;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive);
  });
  document.querySelectorAll('.tab-content').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tabId}`);
  });
}

/* ── 20. Event binding ── */
function bindEvents() {
  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  // Transaction form
  document.getElementById('transactionForm').addEventListener('submit', addTransaction);

  // When type changes, repopulate category dropdown
  document.getElementById('txType').addEventListener('change', populateCategoryDropdowns);

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // "See all" link button
  document.querySelectorAll('[data-tab-link]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tabLink));
  });

  // Delete modal
  document.getElementById('confirmDelete').addEventListener('click', confirmDelete);
  document.getElementById('cancelDelete').addEventListener('click', cancelDelete);
  document.getElementById('deleteModal').addEventListener('click', e => {
    if (e.target === document.getElementById('deleteModal')) cancelDelete();
  });

  // Delete on transaction lists (delegated)
  ['recentList', 'allTransactionsList', 'monthlyList'].forEach(listId => {
    document.getElementById(listId).addEventListener('click', e => {
      const btn = e.target.closest('.tx-delete');
      if (btn) requestDelete(btn.dataset.id);
    });
  });

  // Clear all
  document.getElementById('clearAllBtn').addEventListener('click', clearAll);

  // Sort & filter
  ['sortSelect', 'filterType', 'filterCategory'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderAllTransactions);
  });

  // Monthly navigation
  document.getElementById('prevMonth').addEventListener('click', () => {
    currentMonthOffset--;
    renderMonthly();
  });
  document.getElementById('nextMonth').addEventListener('click', () => {
    currentMonthOffset++;
    renderMonthly();
  });

  // Spending limit save
  document.getElementById('saveLimitBtn').addEventListener('click', () => {
    const val = parseFloat(document.getElementById('limitInput').value);
    spendingLimit = isNaN(val) || val < 0 ? 0 : val;
    save(STORAGE_KEYS.limit, spendingLimit);
    const saved = document.getElementById('limitSaved');
    saved.classList.remove('hidden');
    setTimeout(() => saved.classList.add('hidden'), 2500);
    checkLimit();
  });

  // Add category
  document.getElementById('addCategoryBtn').addEventListener('click', () => {
    const input = document.getElementById('newCategoryInput');
    const errEl = document.getElementById('categoryError');
    const raw   = input.value.trim();
    errEl.classList.add('hidden');

    if (!raw) {
      errEl.textContent = 'Category name cannot be empty.';
      errEl.classList.remove('hidden');
      return;
    }

    // Check duplicate
    const normalized = raw.toLowerCase();
    if (categories.some(c => c.label.toLowerCase().includes(normalized) || c.id === normalized)) {
      errEl.textContent = 'A similar category already exists.';
      errEl.classList.remove('hidden');
      return;
    }

    const newCat = {
      id:    'custom_' + Date.now(),
      label: raw,
      type:  'both',
    };
    categories.push(newCat);
    save(STORAGE_KEYS.categories, categories);
    input.value = '';
    populateCategoryDropdowns();
  });

  // Delete category (delegated)
  document.getElementById('categoryList').addEventListener('click', e => {
    const btn = e.target.closest('.cat-delete');
    if (!btn) return;
    const id = btn.dataset.id;
    // Don't allow deleting if transactions use it
    const inUse = transactions.some(t => t.category === id);
    if (inUse) {
      alert('Cannot delete: this category is used by existing transactions.');
      return;
    }
    categories = categories.filter(c => c.id !== id);
    save(STORAGE_KEYS.categories, categories);
    populateCategoryDropdowns();
  });

  // Keyboard: close modal on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') cancelDelete();
  });

  // Redraw charts when theme changes (color update)
  const observer = new MutationObserver(() => {
    renderDonutChart();
    renderMonthly();
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

/* ── 21. Start ── */
document.addEventListener('DOMContentLoaded', init);
