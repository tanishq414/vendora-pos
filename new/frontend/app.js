// Application auth helpers
window.mainApi = window.mainApi || {};
const API_BASE = 'http://localhost:3000';
const AUTH_TOKEN_KEY = 'vendora_auth_token';
const AUTH_USER_KEY = 'vendora_auth_user';
let authMode = 'login';

function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function setAuthToken(token) {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

function saveAuthUser(user) {
  if (user) {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(AUTH_USER_KEY);
  }
}

function getAuthUser() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_USER_KEY));
  } catch (e) {
    return null;
  }
}

function clearAuthState() {
  setAuthToken(null);
  saveAuthUser(null);
}

function normalizeHeaders(headers) {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const normalized = {};
    for (const [key, value] of headers.entries()) {
      normalized[key] = value;
    }
    return normalized;
  }
  return { ...headers };
}

const originalFetch = window.fetch.bind(window);
window.fetch = async (resource, init = {}) => {
    const url = typeof resource === 'string' ? resource : resource.url;
  const path = url.startsWith('http') ? new URL(url).pathname : url;
  const authTarget = url.startsWith(API_BASE) || path.startsWith('/auth') || path.startsWith('/items') || path.startsWith('/reports') || path.startsWith('/sale') || path.startsWith('/purchase') || path.startsWith('/profile') || path.startsWith('/stores') || path.startsWith('/subscription') || path.startsWith('/customer') || path.startsWith('/bill') || path.startsWith('/expenses') || path.startsWith('/returns') || path.startsWith('/pending-dues') || path.startsWith('/ai');
  if (authTarget) {
    init = init || {};
    init.headers = normalizeHeaders(init.headers);
    const token = getAuthToken();
    if (token && !init.headers.Authorization && !init.headers.authorization) {
      init.headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await originalFetch(resource, init);
  if (response.status === 401) {
    clearAuthState();
    showLoginModal();
  }
  return response;
};

async function validateToken() {
  const token = getAuthToken();
  if (!token) return false;
  try {
    const response = await originalFetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    return response.ok;
  } catch (err) {
    return false;
  }
}

function showLoginError(message) {
  const errorNode = document.getElementById('loginError');
  if (errorNode) {
    errorNode.textContent = message;
    errorNode.style.display = 'block';
  }
}

function clearLoginError() {
  const errorNode = document.getElementById('loginError');
  if (errorNode) {
    errorNode.textContent = '';
    errorNode.style.display = 'none';
  }
}

function setAuthMode(mode) {
  authMode = mode;
  const title = document.getElementById('loginModalTitle');
  const submitBtn = document.getElementById('loginSubmitBtn');
  const switchLink = document.getElementById('authToggleLink');
  const modeNote = document.getElementById('authModeNote');

  if (title) title.textContent = mode === 'register' ? 'Register New User' : 'Vendora Login';
  if (submitBtn) submitBtn.textContent = mode === 'register' ? 'Register' : 'Sign In';
  if (switchLink) switchLink.textContent = mode === 'register' ? 'Already have an account? Login' : 'Need to create an account? Register';
  if (modeNote) modeNote.textContent = mode === 'register' ? 'Only the first user can register without admin privileges.' : 'Enter your username and password to sign in.';
}

function showLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function hideLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

async function performAuthAction() {
  clearLoginError();
  const usernameEl = document.getElementById('loginUsername');
  const passwordEl = document.getElementById('loginPassword');
  const username = usernameEl ? usernameEl.value.trim().toLowerCase() : '';
  const password = passwordEl ? passwordEl.value : '';

  if (!username || !password) {
    return showLoginError('Please enter username and password.');
  }

  const url = authMode === 'register' ? `${API_BASE}/auth/register` : `${API_BASE}/auth/login`;
  const method = 'POST';

  try {
    const response = await originalFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json();
    if (!response.ok) {
      if (authMode === 'register' && response.status === 403) {
        setAuthMode('login');
      }
      return showLoginError(data.error || 'Authentication failed');
    }

    if (authMode === 'register') {
      setAuthMode('login');
      showLoginError('Registration successful. Please sign in.');
      return;
    }

    setAuthToken(data.token);
    saveAuthUser(data.user);
    hideLoginModal();
    initializeApp();
  } catch (err) {
    showLoginError(err.message || 'Authentication failed');
  }
}

function setupLoginForm() {
  const loginBtn = document.getElementById('loginSubmitBtn');
  const toggleLink = document.getElementById('authToggleLink');
  const loginPassword = document.getElementById('loginPassword');
  const loginUsername = document.getElementById('loginUsername');
  if (loginBtn) loginBtn.addEventListener('click', performAuthAction);
  if (toggleLink) toggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    setAuthMode(authMode === 'login' ? 'register' : 'login');
  });
  if (loginUsername) loginUsername.addEventListener('keydown', (e) => { if (e.key === 'Enter') performAuthAction(); });
  if (loginPassword) loginPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') performAuthAction(); });
}

function initializeApp() {
  if (document.querySelector('.page.active')?.id === 'dashboard') {
    loadDashboard();
  }
}

// Prevent app close during active billing (cart not empty)
window.addEventListener('beforeunload', function (e) {
  if (Array.isArray(cart) && cart.length > 0) {
    e.preventDefault();
    e.returnValue = 'A bill is in progress. Please complete or clear the cart before closing.';
    return 'A bill is in progress. Please complete or clear the cart before closing.';
  }
});

// Fetch helper for purchases
async function getPurchases(itemId) {
  let url = `${API_BASE}/purchases`;
  if (itemId) url += `?itemId=${encodeURIComponent(itemId)}`;
  return fetch(url).then(r => r.json());
}

// All business operations now use window.api (window.pos) IPC methods. Remove all HTTP/fetch code.
// Example usage:
// window.api.createBill(billData), window.api.getNextInvoice(), window.api.updateStock(itemId, quantity)

// Reports API
mainApi.reports = {
  salesTrend: () => fetch(`${API_BASE}/reports/sales-trend`).then(r => r.json()),
  topProducts: (limit=10, days=30) => fetch(`${API_BASE}/reports/top-products?limit=${limit}&days=${days}`).then(r => r.json()),
  peakHours: (days=7) => fetch(`${API_BASE}/reports/peak-hours?days=${days}`).then(r => r.json()),
  recentBills: (limit=20) => fetch(`${API_BASE}/reports/recent-bills?limit=${limit}`).then(r => r.json()),
  salesHeatmap: (start, end) => {
    const qs = [];
    if (start) qs.push('start=' + encodeURIComponent(start));
    if (end) qs.push('end=' + encodeURIComponent(end));
    const q = qs.length ? ('?' + qs.join('&')) : '';
    return fetch(`${API_BASE}/reports/sales-heatmap` + q).then(r => r.json());
  },
  profitMargins: () => fetch(`${API_BASE}/reports/profit-margins`).then(r => r.json()),
  pendingDues: () => fetch(`${API_BASE}/pending-dues`).then(r => r.json())
};

// Customer Credit API
mainApi.customer = {
  getCredits: (customerId) => fetch(`${API_BASE}/customer/${customerId}/credits`).then(r => r.json()),
  getBalance: (customerId) => fetch(`${API_BASE}/customer/${customerId}/balance`).then(r => r.json()),
  adjustBalance: (customerId, payload) => fetch(`${API_BASE}/customer/${customerId}/balance/adjust`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(r => r.json())
};

// AI Support API
mainApi.ai = {
  query: (q) => fetch(`${API_BASE}/ai/query`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ question: q }) }).then(r => r.json())
};

// Settings API
mainApi.settings = {
  getProfile: () => fetch(`${API_BASE}/profile`).then(r => r.json()),
  saveProfile: (payload) => fetch(`${API_BASE}/profile`, {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
  }).then(r => r.json()),
  stores: () => fetch(`${API_BASE}/stores`).then(r => r.json()),
  addStore: (p) => fetch(`${API_BASE}/store`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(p) }).then(r=>r.json()),
  updateStore: (id,p) => fetch(`${API_BASE}/store/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(p) }).then(r=>r.json()),
  deleteStore: (id) => fetch(`${API_BASE}/store/${id}`, { method: 'DELETE' }).then(r=>r.json()),
  getSubscription: () => fetch(`${API_BASE}/subscription`).then(r => r.json()),
  setSubscription: (plan) => fetch(`${API_BASE}/subscribe`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ plan }) }).then(r=>r.json())
};

// Purchases & Suppliers API (was missing - caused crashes on Record Purchase / Add-Edit-Delete Supplier)
mainApi.purchase = (payload) => fetch(`${API_BASE}/purchase`, {
  method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
}).then(r => r.json());
mainApi.addSupplier = (payload) => fetch(`${API_BASE}/supplier`, {
  method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
}).then(r => r.json());
mainApi.updateSupplier = (id, payload) => fetch(`${API_BASE}/supplier/${id}`, {
  method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)
}).then(r => r.json());
mainApi.deleteSupplier = (id) => fetch(`${API_BASE}/supplier/${id}`, {
  method: 'DELETE'
}).then(r => r.json());
mainApi.suppliers = () => fetch(`${API_BASE}/suppliers`).then(r => r.json());

// Direct fetch functions for core data
async function getItems() { return fetch(`${API_BASE}/items`).then(r => r.json()); }
async function getSuppliers() { return fetch(`${API_BASE}/suppliers`).then(r => r.json()); }
async function getCategories() { return fetch(`${API_BASE}/categories`).then(r => r.json()); }
async function getStaff() { return fetch(`${API_BASE}/staff`).then(r => r.json()); }
async function getExpenses() { return fetch(`${API_BASE}/expenses`).then(r => r.json()); }
async function getDashboard(filters = {}) {
  const params = new URLSearchParams(filters).toString();
  return fetch(`${API_BASE}/dashboard${params ? '?' + params : ''}`).then(r => r.json());
}

// Global state
let currentEditItemId = null;
let currentSearchTerm = '';

// ===== CACHE FOR PERFORMANCE =====
let cachedItems = []; // All items in memory
let skuIndex = {}; // Fast lookup: SKU -> Item

// Build fast lookup indices
function buildItemIndices() {
  skuIndex = {};
  cachedItems.forEach(item => {
    if (item.sku) {
      skuIndex[String(item.sku).trim().toLowerCase()] = item;
    }
  });
}

// Update cache and build indices
async function updateItemCache() {
  try {
    cachedItems = await getItems();
    buildItemIndices();
    return true;
  } catch (e) {
    console.error('Failed to update item cache', e);
    return false;
  }
}

// Get item by SKU instantly (O(1) lookup)
function getItemBySku(barcode) {
  const key = String(barcode).trim().toLowerCase();
  return skuIndex[key] || null;
}

// ===== PAGE NAVIGATION =====
function setupNavigation() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const pageId = e.target.dataset.page;
      showPage(pageId);
    });
  });
}

function showPage(pageId) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  // Show selected page
  document.getElementById(pageId).classList.add('active');
  
  // Update nav tabs
  document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelector(`[data-page="${pageId}"]`).classList.add('active');
  
  // Load data for the page
  if (pageId === 'inventory') {
    loadInventory();
  } else if (pageId === 'predictions') {
    loadPredictions();
  } else if (pageId === 'dashboard') {
    loadDashboard();
  } else if (pageId === 'billing') {
    loadBillingItems();
  } else if (pageId === 'purchases') {
    loadPurchases();
  } else if (pageId === 'expenses') {
    loadExpenses();
  } else if (pageId === 'reports') {
    loadReports();
    loadReturns();
  } else if (pageId === 'returns') {
    loadReturnsPage();
  } else if (pageId === 'settings') {
    loadSettings();
  }
}

// ===== EXPENSES =====
async function loadExpenses() {
  try {
    const expenses = await getExpenses();
    renderExpensesTable(expenses);
    // Set today's date as default
    document.getElementById('expenseDate').valueAsDate = new Date();
  } catch (e) {
    console.error('Error loading expenses', e);
    showToast('Failed to load expenses', 'error');
  }
}

function renderExpensesTable(expenses) {
  const tbody = document.getElementById('expensesBody');
  
  if (!expenses || expenses.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">No expenses found. Click \'Add Expense\' to get started.</td></tr>';
    return;
  }
  
  tbody.innerHTML = expenses.map(e => `
    <tr>
      <td>${e.expenseDate || new Date(e.created_at).toLocaleDateString()}</td>
      <td><strong>${e.description}</strong></td>
      <td>${getCategoryLabel(e.category)}</td>
      <td>₹${Number(e.amount || 0).toFixed(2)}</td>
      <td>
        <button class="btn-sm" onclick="editExpense(${e.id})">Edit</button>
        <button class="btn-sm btn-danger" onclick="deleteExpense(${e.id})">Delete</button>
      </td>
    </tr>
  `).join('');
}

function getCategoryLabel(cat) {
  const labels = {
    'rent': 'Rent',
    'utilities': 'Utilities',
    'salary': 'Salary & Wages',
    'equipment': 'Equipment & Supplies',
    'maintenance': 'Maintenance & Repairs',
    'transportation': 'Transportation',
    'advertising': 'Advertising & Marketing',
    'insurance': 'Insurance',
    'miscellaneous': 'Miscellaneous'
  };
  return labels[cat] || cat;
}

async function saveExpense() {
  const description = (document.getElementById('expenseDescription').value || '').trim();
  const category = (document.getElementById('expenseCategory').value || '').trim();
  const amount = Number(document.getElementById('expenseAmount').value) || 0;
  const expenseDate = (document.getElementById('expenseDate').value || '').trim();
  const notes = (document.getElementById('expenseNotes').value || '').trim();
  
  if (!description || !category || amount <= 0 || !expenseDate) {
    return showToast('Please fill all required fields', 'warn');
  }
  
  try {
    const payload = { description, category, amount, expenseDate, notes };
    
    // Check if in edit mode
    if (window.currentEditExpenseId) {
      // Update existing expense
      const res = await fetch(`${API_BASE}/expense/${window.currentEditExpenseId}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
      }).then(r => r.json());
      
      if (res.success) {
        showToast('Expense updated successfully', 'success');
        window.currentEditExpenseId = null;
      } else {
        showToast('Error: ' + (res.error || 'Failed to update'), 'error');
        return;
      }
    } else {
      // Add new expense
      await fetch(`${API_BASE}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showToast('Expense added successfully', 'success');
    }
    
    document.getElementById('expenseForm').reset();
    document.getElementById('expenseForm').style.borderLeft = 'none';
    document.getElementById('expenseDate').valueAsDate = new Date();
    const submitBtn = document.querySelector('#expenseForm button[type="submit"]');
    if (submitBtn) {
      submitBtn.innerText = 'Add Expense';
    }
    loadExpenses();
  } catch (e) {
    console.error('Error saving expense', e);
    showToast('Error: ' + (e.message || 'Failed to save expense'), 'error');
  }
}

async function editExpense(id) {
  try {
    // Fetch the expense details
    const expenses = await getExpenses();
    const expense = expenses.find(e => e.id === id);
    if (!expense) {
      showToast('Expense not found', 'error');
      return;
    }
    
    // Populate the form with current values
    document.getElementById('expenseDescription').value = expense.description || '';
    document.getElementById('expenseCategory').value = expense.category || '';
    document.getElementById('expenseAmount').value = Number(expense.amount || 0);
    document.getElementById('expenseDate').value = expense.expenseDate || new Date().toISOString().split('T')[0];
    document.getElementById('expenseNotes').value = expense.notes || '';
    
    // Scroll to form and highlight it
    document.getElementById('expenseForm').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('expenseForm').style.borderLeft = '4px solid #9d5dff';
    
    // Store the expense id for update
    window.currentEditExpenseId = id;
    
    // Change button text to indicate edit mode
    const submitBtn = document.querySelector('#expenseForm button[type="submit"]');
    if (submitBtn) {
      submitBtn.innerText = 'Update Expense';
    }
    
    showToast('Edit expense and click Update', 'info');
  } catch (e) {
    console.error('Error loading expense for edit', e);
    showToast('Error loading expense: ' + e.message, 'error');
  }
}

async function deleteExpense(id) {
  if (!confirm('Delete this expense?')) return;
  
  try {
    await fetch(`${API_BASE}/expenses/${id}`, { method: 'DELETE' });
    showToast('Expense deleted', 'success');
    loadExpenses();
  } catch (e) {
    console.error('Error deleting expense', e);
    showToast('Error: ' + (e.message || 'Failed to delete'), 'error');
  }
}

function filterExpenses() {
  const category = document.getElementById('expenseCategoryFilter').value;
  const search = document.getElementById('expenseSearch').value;
  (async () => {
    const expenses = await getExpenses(); // Add filter logic if backend supports
    renderExpensesTable(expenses);
  })();
}

// ===== REPORTS =====
async function loadReports() {
  try {
    const [trend, top, peak, bills, heatmap, margins, fastMoving, slowMoving, reorderAlerts, deadStock, supplierPurchases, expiryAlerts, abcAnalysis] = await Promise.all([
      fetch(`${API_BASE}/reports/sales-trend`).then(r => r.json()),
      fetch(`${API_BASE}/reports/top-products?limit=8&days=30`).then(r => r.json()),
      fetch(`${API_BASE}/reports/peak-hours?days=7`).then(r => r.json()),
      fetch(`${API_BASE}/reports/recent-bills?limit=20`).then(r => r.json()),
      fetch(`${API_BASE}/reports/sales-heatmap`).then(r => r.json()),
      fetch(`${API_BASE}/reports/profit-margins`).then(r => r.json()),
      fetch(`${API_BASE}/reports/fast-moving-products?limit=8&days=30`).then(r => r.json()),
      fetch(`${API_BASE}/reports/slow-moving-products?limit=8&days=30`).then(r => r.json()),
      fetch(`${API_BASE}/reports/reorder-alerts`).then(r => r.json()),
      fetch(`${API_BASE}/reports/dead-stock?days=90`).then(r => r.json()),
      fetch(`${API_BASE}/reports/supplier-purchases`).then(r => r.json()),
      fetch(`${API_BASE}/reports/expiry-alerts?days=30`).then(r => r.json()),
      fetch(`${API_BASE}/reports/abc-analysis?days=90`).then(r => r.json())
    ]);

    renderSalesTrend(trend);
    renderTopProducts(top);
    renderPeakHours(peak);
    renderRecentBills(bills);
    renderSalesHeatmap(heatmap);
    renderProfitMargins(margins);
    renderFastMoving(fastMoving);
    renderSlowMoving(slowMoving);
    renderReorderAlerts(reorderAlerts);
    renderDeadStock(deadStock);
    renderSupplierPurchases(supplierPurchases);
    renderExpiryAlerts(expiryAlerts);
    renderAbcAnalysis(abcAnalysis);
    
    // Load pending dues separately with error handling
    try {
      const dues = await fetch(`${API_BASE}/pending-dues`).then(r => r.json());
      renderPendingDues(dues);
    } catch (e) {
      console.warn('Failed to load pending dues', e);
      // Show empty state in pending dues section
      const tbody = document.getElementById('pendingDuesBody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#999">Unable to load pending dues</td></tr>';
    }
    
    // Load debits list into the Reports page
    try {
      await loadDebits();
    } catch (e) {
      console.warn('Failed to load debits', e);
    }
  } catch (e) {
    console.error('Error loading reports', e);
  }
}

// ===== DEBITS (Reports) =====
async function loadDebits(limit = 200) {
  const tbody = document.getElementById('debitsBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999">Loading...</td></tr>';

  try {
    const q = `?limit=${encodeURIComponent(limit)}`;
    const resp = await fetch(`${API_BASE}/debits` + q);
    const ct = (resp.headers.get('content-type') || '').toLowerCase();
    if (!resp.ok) {
      const txt = await resp.text();
      console.warn('Failed to fetch /debits:', resp.status, txt.slice(0,200));
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999">No debits found.</td></tr>';
      return;
    }
    if (!ct.includes('application/json')) {
      const txt = await resp.text();
      console.warn('Expected JSON from /debits but got:', txt.slice(0,200));
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999">No debits found.</td></tr>';
      return;
    }
    const res = await resp.json();
    if (!res || !res.success) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999">No debits found.</td></tr>';
      return;
    }
    renderDebits(res.debits || []);
  } catch (e) {
    console.error('Error fetching debits', e);
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#f88">Failed to load debits</td></tr>';
  }
}

function renderDebits(rows) {
  const tbody = document.getElementById('debitsBody');
  if (!tbody) return;
  if (!rows || rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999">No debits recorded.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(d => `
    <tr>
      <td>${d.date || (d.created_at ? new Date(d.created_at).toLocaleString() : '')}</td>
      <td>${escapeHtml(d.name || '')}</td>
      <td>${escapeHtml(d.phone || '')}</td>
      <td>₹${Number(d.amount||0).toFixed(2)}</td>
      <td>₹${Number(d.total||0).toFixed(2)}</td>
      <td>${d.billId || ''}</td>
      <td>${escapeHtml(d.notes || '')}</td>
    </tr>
  `).join('');
}

// Small helper to avoid injecting raw HTML into the table
function escapeHtml(s) {
  if (!s && s !== 0) return '';
  return String(s).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[c]; });
}

// Wire up refresh/filter handlers for debits when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const refreshBtn = document.getElementById('refreshDebitsBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', () => loadDebits(200));

  const filterPhone = document.getElementById('debitsFilterPhone');
  if (filterPhone) {
    filterPhone.addEventListener('input', (e) => {
      const val = (e.target.value || '').trim();
      if (!val) {
        loadDebits(200);
        return;
      }
      // Simple client-side filter: fetch full list and filter by phone
      (async () => {
        try {
          const resp = await fetch(`${API_BASE}/debits?limit=500`);
          const ct = (resp.headers.get('content-type') || '').toLowerCase();
          let res = null;
          if (resp.ok && ct.includes('application/json')) {
            res = await resp.json();
          } else {
            const txt = await resp.text();
            console.warn('Unexpected /debits response while filtering:', txt.slice(0,200));
          }
          const rows = (res && res.debits) ? res.debits.filter(r => (r.phone||'').includes(val)) : [];
          renderDebits(rows);
        } catch (e) {
          console.warn('Failed to filter debits', e);
        }
      })();
    });
  }
});

function renderSalesHeatmap(payload) {
  const container = document.getElementById('salesHeatmap');
  if (!container) return;
  if (!payload || !payload.matrix) {
    container.innerHTML = '<div style="color:#999;padding:20px">No heatmap data available.</div>';
    return;
  }

  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const matrix = payload.matrix;
  const max = payload.max || 1;

  // build table
  let html = '<div style="overflow:auto;"><table class="heatmap-table"><thead><tr><th></th>';
  for (let h = 0; h < 24; h++) html += `<th>${h}</th>`;
  html += '</tr></thead><tbody>';

  for (let d = 0; d <= 6; d++) {
    html += `<tr><th>${days[d]}</th>`;
    for (let h = 0; h < 24; h++) {
      const v = matrix[d] && matrix[d][h] ? Number(matrix[d][h]) : 0;
      const intensity = Math.min(1, v / (max || 1));
      const bg = `rgba(157,93,255,${0.12 + intensity * 0.7})`;
      const title = `Sales: ₹${v.toFixed(2)}`;
      html += `<td title="${title}" style="background:${bg};text-align:center;font-size:11px;padding:6px;">${v>0?Math.round(v):''}</td>`;
    }
    html += '</tr>';
  }

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

function renderProfitMargins(data) {
  const container = document.getElementById('profitMargins');
  if (!container) return;
  if (!data) return container.innerHTML = '<div style="color:#999;padding:12px">No data</div>';

  const prods = data.products || [];
  const cats = data.categories || [];

  let html = '<div style="padding:6px;">';
  html += '<table class="items-table" style="width:100%;font-size:13px;"><thead><tr><th>Product</th><th>Revenue</th><th>Cost</th><th>Profit</th><th>Margin</th></tr></thead><tbody>';
  prods.slice(0,10).forEach(p => {
    html += `<tr><td>${p.itemName || 'Unknown'}</td><td>₹${Number(p.revenue||0).toFixed(2)}</td><td>₹${Number(p.cost||0).toFixed(2)}</td><td>₹${Number(p.profit||0).toFixed(2)}</td><td>${Number(p.margin||0).toFixed(1)}%</td></tr>`;
  });
  html += '</tbody></table>';

  html += '<h4 style="margin-top:12px;margin-bottom:6px;">By Category</h4>';
  html += '<table class="items-table" style="width:100%;font-size:13px;"><thead><tr><th>Category</th><th>Revenue</th><th>Cost</th><th>Profit</th><th>Margin</th></tr></thead><tbody>';
  cats.forEach(c => {
    html += `<tr><td>${c.category}</td><td>₹${Number(c.revenue||0).toFixed(2)}</td><td>₹${Number(c.cost||0).toFixed(2)}</td><td>₹${Number(c.profit||0).toFixed(2)}</td><td>${Number(c.margin||0).toFixed(1)}%</td></tr>`;
  });
  html += '</tbody></table>';

  html += '</div>';
  container.innerHTML = html;
}

function renderFastMoving(rows) {
  const container = document.getElementById('fastMovingProducts');
  if (!container) return;
  if (!rows || rows.length === 0) {
    container.innerHTML = '<div style="color:#999;padding:20px;text-align:center;">No fast-moving products found.</div>';
    return;
  }

  const html = ['<table class="items-table" style="width:100%;font-size:13px;"><thead><tr><th>Product</th><th>Qty Sold</th><th>Revenue</th></tr></thead><tbody>'];
  rows.slice(0,8).forEach(r => {
    html.push(`<tr><td>${r.itemName || 'Unknown'}</td><td>${Number(r.qtySold||0).toFixed(2)}</td><td>₹${Number(r.revenue||0).toFixed(2)}</td></tr>`);
  });
  html.push('</tbody></table>');
  container.innerHTML = html.join('');
}

function renderSlowMoving(rows) {
  const container = document.getElementById('slowMovingProducts');
  if (!container) return;
  if (!rows || rows.length === 0) {
    container.innerHTML = '<div style="color:#999;padding:20px;text-align:center;">No slow-moving products found.</div>';
    return;
  }

  const html = ['<table class="items-table" style="width:100%;font-size:13px;"><thead><tr><th>Product</th><th>Qty Sold</th><th>Revenue</th><th>Stock</th><th>Last Sale</th></tr></thead><tbody>'];
  rows.slice(0,8).forEach(r => {
    html.push(`<tr><td>${r.itemName || 'Unknown'}</td><td>${Number(r.qtySold||0).toFixed(2)}</td><td>₹${Number(r.revenue||0).toFixed(2)}</td><td>${Number(r.quantity||0).toFixed(2)}</td><td>${r.lastSale ? new Date(r.lastSale).toLocaleDateString() : 'Never'}</td></tr>`);
  });
  html.push('</tbody></table>');
  container.innerHTML = html.join('');
}

function renderReorderAlerts(rows) {
  const container = document.getElementById('reorderAlerts');
  if (!container) return;
  if (!rows || rows.length === 0) {
    container.innerHTML = '<div style="color:#999;padding:20px;text-align:center;">No products currently need reorder.</div>';
    return;
  }

  const html = ['<table class="items-table" style="width:100%;font-size:13px;"><thead><tr><th>Product</th><th>Qty</th><th>Threshold</th><th>Suggested Reorder</th><th>Shortage</th></tr></thead><tbody>'];
  rows.forEach(r => {
    html.push(`<tr><td>${r.name || 'Unknown'}</td><td>${Number(r.quantity||0).toFixed(2)}</td><td>${Number(r.reorderThreshold||0).toFixed(2)}</td><td>${Number(r.suggestedReorder||0).toFixed(2)}</td><td>${Number(r.shortage||0).toFixed(2)}</td></tr>`);
  });
  html.push('</tbody></table>');
  container.innerHTML = html.join('');
}

function renderDeadStock(rows) {
  const container = document.getElementById('deadStock');
  if (!container) return;
  if (!rows || rows.length === 0) {
    container.innerHTML = '<div style="color:#999;padding:20px;text-align:center;">No dead stock detected.</div>';
    return;
  }

  const html = ['<table class="items-table" style="width:100%;font-size:13px;"><thead><tr><th>Product</th><th>Qty</th><th>Last Sale</th><th>Qty Sold</th></tr></thead><tbody>'];
  rows.slice(0,10).forEach(r => {
    html.push(`<tr><td>${r.name || 'Unknown'}</td><td>${Number(r.quantity||0).toFixed(2)}</td><td>${r.lastSale ? new Date(r.lastSale).toLocaleDateString() : 'Never'}</td><td>${Number(r.qtySold||0).toFixed(2)}</td></tr>`);
  });
  html.push('</tbody></table>');
  container.innerHTML = html.join('');
}

function renderSupplierPurchases(rows) {
  const container = document.getElementById('supplierPurchases');
  if (!container) return;
  if (!rows || rows.length === 0) {
    container.innerHTML = '<div style="color:#999;padding:20px;text-align:center;">No supplier purchase data available.</div>';
    return;
  }

  const html = ['<table class="items-table" style="width:100%;font-size:13px;"><thead><tr><th>Supplier</th><th>Purchases</th><th>Total Qty</th><th>Total Spend</th><th>Avg Cost</th></tr></thead><tbody>'];
  rows.forEach(r => {
    html.push(`<tr><td>${r.supplierName || 'Unknown'}</td><td>${Number(r.purchaseCount||0)}</td><td>${Number(r.totalQty||0).toFixed(2)}</td><td>₹${Number(r.totalSpend||0).toFixed(2)}</td><td>₹${Number(r.avgCostPerUnit||0).toFixed(2)}</td></tr>`);
  });
  html.push('</tbody></table>');
  container.innerHTML = html.join('');
}

function renderExpiryAlerts(rows) {
  const container = document.getElementById('expiryAlerts');
  if (!container) return;
  if (!rows || rows.length === 0) {
    container.innerHTML = '<div style="color:#999;padding:20px;text-align:center;">No products expiring soon.</div>';
    return;
  }

  const html = ['<table class="items-table" style="width:100%;font-size:13px;"><thead><tr><th>Product</th><th>Qty</th><th>Expiry</th><th>Days Left</th><th>Status</th></tr></thead><tbody>'];
  rows.slice(0,10).forEach(r => {
    html.push(`<tr><td>${r.name || 'Unknown'}</td><td>${Number(r.quantity||0).toFixed(2)}</td><td>${new Date(r.expiryDate).toLocaleDateString()}</td><td>${Number(r.daysUntilExpiry||0)}</td><td>${r.expired ? 'Expired' : 'Expiring'}</td></tr>`);
  });
  html.push('</tbody></table>');
  container.innerHTML = html.join('');
}

function renderAbcAnalysis(data) {
  const container = document.getElementById('abcAnalysis');
  if (!container) return;
  if (!data || !data.results || data.results.length === 0) {
    container.innerHTML = '<div style="color:#999;padding:20px;text-align:center;">No ABC analysis data available.</div>';
    return;
  }

  const categories = { A: [], B: [], C: [] };
  data.results.forEach(item => {
    categories[item.category || 'C'].push(item);
  });

  let html = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">';
  ['A','B','C'].forEach(cat => {
    html += `<div style="background:rgba(157,93,255,0.05);padding:10px;border-radius:10px;"><strong>Category ${cat}</strong><br><small>${categories[cat].length} products</small><ul style="margin:8px 0 0 0;padding-left:18px;">`;
    categories[cat].slice(0,5).forEach(item => {
      html += `<li>${item.itemName || 'Unknown'} – ₹${Number(item.revenue||0).toFixed(2)}</li>`;
    });
    html += '</ul></div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

function renderSalesTrend(data) {
  const container = document.getElementById('salesTrendChart');
  if (!container) return;
  const w = Math.max(200, container.clientWidth - 24);
  const h = Math.max(120, container.clientHeight - 24);
  const max = Math.max(...data.map(d => d.total), 1);
  const svg = [`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">`];
  const barW = w / data.length;
  data.forEach((d, i) => {
    const bw = Math.max(4, barW * 0.6);
    const x = i * barW + (barW - bw)/2;
    const bh = (d.total / max) * (h - 20);
    const y = h - bh;
    svg.push(`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="#2563eb" rx="3"></rect>`);
    svg.push(`<text x="${x + bw/2}" y="${h - 2}" font-size="10" text-anchor="middle" fill="#333">${d.date.slice(5)}</text>`);
  });
  svg.push('</svg>');
  container.innerHTML = svg.join('');
}

function renderTopProducts(rows) {
  const container = document.getElementById('topProductsChart');
  if (!container) return;
  const w = Math.max(200, container.clientWidth - 24);
  const h = Math.max(120, container.clientHeight - 24);
  const max = Math.max(...rows.map(r => r.qtySold || 0), 1);
  const svg = [`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">`];
  const rowH = h / Math.max(1, rows.length);
  rows.forEach((r, i) => {
    const barW = (r.qtySold / max) * (w * 0.8);
    const y = i * rowH + 6;
    svg.push(`<rect x="0" y="${y}" width="${barW}" height="${rowH-10}" fill="#10b981" rx="4"></rect>`);
    svg.push(`<text x="${barW + 6}" y="${y + (rowH-10)/2 + 4}" font-size="12" fill="#222">${r.itemName || 'Unknown'} (${Number(r.qtySold||0).toFixed(2)})</text>`);
  });
  svg.push('</svg>');
  container.innerHTML = svg.join('');
}

function renderPeakHours(rows) {
  const container = document.getElementById('peakHoursChart');
  if (!container) return;
  const w = Math.max(200, container.clientWidth - 24);
  const h = Math.max(120, container.clientHeight - 24);
  const max = Math.max(...rows.map(r => r.total || 0), 1);
  const svg = [`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">`];
  const barW = w / 24;
  rows.forEach((r,i) => {
    const bw = Math.max(2, barW * 0.7);
    const x = i * barW + (barW - bw)/2;
    const bh = (r.total / max) * (h - 20);
    const y = h - bh;
    svg.push(`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="#f97316" rx="2"></rect>`);
    svg.push(`<text x="${x + bw/2}" y="${h - 2}" font-size="9" text-anchor="middle" fill="#333">${i}</text>`);
  });
  svg.push('</svg>');
  container.innerHTML = svg.join('');
}

function renderRecentBills(rows) {
  const tbody = document.getElementById('recentBillsBody');
  if (!tbody) return;
  if (!rows || rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999">No recent bills</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(b => `
    <tr>
      <td>${new Date(b.created_at).toLocaleString()}</td>
      <td>#${b.id}</td>
      <td>${b.customerName || b.customerPhone || 'Walk-in'}</td>
      <td>₹${Number(b.total||0).toFixed(2)}</td>
      <td>${b.payment_method || '—'}</td>
      <td>${(JSON.parse(b.items_json||'[]').map(i=>i.name+' x'+i.quantity).slice(0,3).join(', '))}</td>
    </tr>
  `).join('');
}

function renderPendingDues(dues) {
  const tbody = document.getElementById('pendingDuesBody');
  if (!tbody) return;
  if (!dues || dues.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#0f0;padding:12px;">✓ No pending dues — all customers settled</td></tr>';
    return;
  }
  
  const totalDue = dues.reduce((s, d) => s + Number(d.dueAmount), 0);
  
  tbody.innerHTML = dues.map(d => {
    // Prefer the bill date/time when available, otherwise use the record timestamp
    const dt = d.billDate || d.recordedDate;
    const displayDate = dt ? new Date(dt).toLocaleString() : '—';
    const customerName = d.customerName || 'Walk-in';
    return `
    <tr>
      <td title="Recorded: ${d.recordedDate || ''}">${displayDate}</td>
      <td>${customerName}</td>
      <td>${d.customerPhone || '—'}</td>
      <td>#${d.billId || '?'}</td>
      <td>₹${Number(d.billTotal||0).toFixed(2)}</td>
      <td style="color:#f88;font-weight:bold;">₹${Number(d.dueAmount||0).toFixed(2)}</td>
      <td>₹${Number(d.paidAmount||0).toFixed(2)}</td>
      <td><span style="background:#ff9800;color:white;padding:2px 6px;border-radius:3px;font-size:11px;">PENDING</span></td>
    </tr>
  `
  }).join('');
  
  // Add summary row
  tbody.innerHTML += `<tr style="background:rgba(255,152,0,.08);font-weight:bold;border-top:2px solid #ff9800;">
    <td colspan="5" style="text-align:right;">TOTAL PENDING:</td>
    <td style="color:#f88;">₹${Number(totalDue).toFixed(2)}</td>
    <td colspan="2"></td>
  </tr>`;
}

async function populateStaffFilter() {
    try {
        const staff = await getStaff();
        const select = document.getElementById('staffNameFilter');
        if (!select) return;
        select.innerHTML = '<option value="">All Staff</option>';
        staff.forEach(s => {
            const option = document.createElement('option');
            option.value = s.name; // Assuming staff name is the value
            option.textContent = s.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load staff for filter', error);
    }
}

async function populateCategoryFilter() {
    try {
        const categories = await getCategories();
        const select = document.getElementById('categoryFilter');
        if (!select) return;
        select.innerHTML = '<option value="">All Categories</option>';
        categories.forEach(c => {
            const option = document.createElement('option');
            option.value = c.category;
            option.textContent = c.category;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load categories for filter', error);
    }
}

function getDashboardFilters() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const paymentMethod = document.getElementById('paymentMethodFilter').value;
    const category = document.getElementById('categoryFilter').value;
    const staffName = document.getElementById('staffNameFilter').value;

    const filters = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (paymentMethod) filters.paymentMethod = paymentMethod;
    if (category) filters.category = category;
    if (staffName) filters.staffName = staffName;

    return filters;
}

// ===== DASHBOARD =====
async function loadDashboard(filters = {}) {
  try {
    const d = await getDashboard(filters);
    const items = await getItems();
    
    // Update metrics
    document.getElementById('revenueAmount').innerText = Number(d.revenue || 0).toFixed(2);
    document.getElementById('profitAmount').innerText = Number(d.profit || 0).toFixed(2);
    document.getElementById('customerCount').innerText = Number(d.customerCount || 0).toFixed(0);
    document.getElementById('transactionCount').innerText = Number(d.transactionCount || 0).toFixed(0);
    document.getElementById('avgTicketAmount').innerText = Number(d.avgTicket || 0).toFixed(2);
    document.getElementById('productsInStock').innerText = (items || []).length;
    const lowStockItems = (d.stockLow || []).length;
    document.getElementById('lowStockCount').innerText = lowStockItems;
    document.getElementById('expiryAlertsCount').innerText = Number(d.expiryAlertsCount || 0).toFixed(0);
    
    // Update daily total sales
    const dailySalesEl = document.getElementById('dailySalesAmount');
    const dailySalesDateEl = document.getElementById('dailySalesDate');
    if (dailySalesEl) {
      // If no filters (default = today), show daily sales; otherwise show for the period
      const dailyTotal = d.dailySales !== undefined ? d.dailySales : d.revenue;
      dailySalesEl.innerText = Number(dailyTotal || 0).toFixed(2);
      if (filters.startDate || filters.endDate) {
        dailySalesDateEl.innerText = filters.startDate ? `From ${filters.startDate}` : 'Period sales';
      } else {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        dailySalesDateEl.innerText = today;
      }
    }
    
    // Update date range display
    let dateRangeText = 'Showing data for all time';
    if (filters.startDate && filters.endDate) {
        dateRangeText = `Showing data from ${filters.startDate} to ${filters.endDate}`;
    } else if (filters.startDate) {
        dateRangeText = `Showing data from ${filters.startDate}`;
    } else if (filters.endDate) {
        dateRangeText = `Showing data until ${filters.endDate}`;
    } else if (Object.keys(filters).length === 0) {
        dateRangeText = `Showing data for today`;
    }
    document.getElementById('dashboardDateRange').innerText = dateRangeText;
    
    // Update insights
    const insightsList = document.getElementById('autoInsights');
    const insights = [];
    if (d.revenue > 0) insights.push(`📊 You made ₹${Number(d.revenue).toFixed(2)} in this period`);
    if (d.insight) insights.push(`💡 ${d.insight}`);
    if (insights.length === 0) insights.push('📊 No sales insights available for this period.');
    insightsList.innerHTML = insights.map(i => `<div class="insight-item">${i}</div>`).join('');
    
    // Update stock alerts
    const alertsList = document.getElementById('stockAlertsList');
    if (d.stockLow && d.stockLow.length) {
      alertsList.innerHTML = d.stockLow.slice(0, 5).map(it => 
        `<div class="alert-item">#${it.id} ${it.name} — ${Number(it.quantity).toFixed(2)} left <button class="btn-sm" onclick="shareStockAlert(${it.id})">Share</button></div>`
      ).join('');
    } else {
      alertsList.innerHTML = '<div class="alert-item">No items currently low on stock.</div>';
    }
    
    // Load and render sales trend chart
    try {
      const trend = await fetch(`${API_BASE}/reports/sales-trend`).then(r => r.json());
      renderSalesTrendDashboard(trend);
    } catch (e) {
      console.warn('Could not load trend data', e);
    }
  } catch (e) {
    console.error('Dashboard load failed', e);
    showToast('Failed to load dashboard data', 'error');
  }
}

function renderSalesTrendDashboard(data) {
  const container = document.getElementById('salesTrendChart');
  if (!container) return;
  
  if (!data || data.length === 0) {
    container.innerHTML = '<div style="color:#a0a0a0;text-align:center;padding:60px 20px;">No sales data available for this period</div>';
    return;
  }
  
  const w = Math.max(300, container.clientWidth - 32);
  const h = Math.max(200, container.clientHeight - 32);
  const max = Math.max(...data.map(d => d.total), 1);
  const svg = [`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.2))">`];
  const barW = w / Math.max(data.length, 1);
  
  data.forEach((d, i) => {
    const bw = Math.max(8, barW * 0.6);
    const x = i * barW + (barW - bw) / 2;
    const bh = Math.max(5, (d.total / max) * (h - 40));
    const y = h - bh - 20;
    svg.push(`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="#9d5dff" rx="4" opacity="0.8"></rect>`);
    svg.push(`<text x="${x + bw/2}" y="${h - 5}" font-size="11" text-anchor="middle" fill="#a0a0a0">${d.date.slice(5)}</text>`);
  });
  
  svg.push('</svg>');
  container.innerHTML = svg.join('');
}


// ===== INVENTORY =====
async function loadInventory() {
  if (currentSearchTerm) {
    const items = await fetch(`${API_BASE}/items?search=${encodeURIComponent(currentSearchTerm)}`).then(r => r.json());
    renderInventoryTable(items);
  } else {
    const items = await getItems();
    // Update cache whenever inventory loads
    cachedItems = items;
    buildItemIndices();
    renderInventoryTable(items);
  }
}








// ---- Quantity modal helpers ----
let currentItemForQty = null;
let currentItemType = 'loose'; // Track if packet or loose

/**
 * Open modal for selecting quantity.
 * itemId: numeric id of item
 * pricePerKg: numeric price per kg (optional)
 * itemType: 'packet' or 'loose' (default: 'loose')
 */
function openQuantityModal(itemId, pricePerKg = 0, itemType = 'loose') {
  currentItemForQty = Number(itemId);
  currentItemType = itemType || 'loose';
  
  const qPrice = document.getElementById('qPrice');
  const qQty = document.getElementById('qQty');
  const qAmount = document.getElementById('qAmount');
  const qUnit = document.getElementById('qUnit');
  
  if (qPrice) qPrice.value = Number(pricePerKg || 0).toFixed(2);
  if (qQty) qQty.value = '';
  if (qAmount) qAmount.value = '';
  
  // Set unit options based on item type
  if (qUnit) {
    if (itemType === 'packet') {
      // Packet items: show packets/units
      qUnit.innerHTML = `
        <option value="packet">Packets</option>
        <option value="units">Units</option>
      `;
      qUnit.value = 'packet';
    } else {
      // Loose items: show kg/grams
      qUnit.innerHTML = `
        <option value="kg">Kilograms</option>
        <option value="g">Grams</option>
      `;
      qUnit.value = 'kg';
    }
  }
  
  updateUnitLabel();
  
  const modal = document.getElementById('quantityModal');
  if (modal) modal.classList.add('show');
}

function closeQuantityModal() {
  const modal = document.getElementById('quantityModal');
  if (modal) modal.classList.remove('show');
  currentItemForQty = null;
  currentItemType = 'loose';
}

/**
 * Update hint text based on selected unit
 */
function updateUnitLabel() {
  const qUnit = document.getElementById('qUnit');
  const unitHint = document.getElementById('unitHint');
  if (!unitHint) return;
  
  const unit = qUnit?.value || 'kg';
  const hints = {
    'kg': '1 kg = 1000 grams',
    'g': '1000 g = 1 kilogram',
    'packet': 'Individual packets',
    'units': 'Individual units'
  };
  unitHint.textContent = hints[unit] || '';
}

/**
 * Calculate quantity from entered amount
 */
function calculateQtyFromAmount() {
  const qAmount = document.getElementById('qAmount');
  const qPrice = document.getElementById('qPrice');
  const qQty = document.getElementById('qQty');
  
  const amount = parseFloat(qAmount?.value || '0');
  const price = parseFloat(qPrice?.value || '0');
  
  if (amount > 0 && price > 0) {
    const qty = (amount / price).toFixed(2);
    if (qQty) qQty.value = qty;
  }
}

/**
 * Calculate amount from entered quantity
 */
function calculateAmountFromQty() {
  const qQty = document.getElementById('qQty');
  const qPrice = document.getElementById('qPrice');
  const qAmount = document.getElementById('qAmount');
  
  const qty = parseFloat(qQty?.value || '0');
  const price = parseFloat(qPrice?.value || '0');
  
  if (qty > 0 && price > 0) {
    const amount = (qty * price).toFixed(2);
    if (qAmount) qAmount.value = amount;
  }
}

/**
 * Reads quantity & unit from modal, converts to appropriate format,
 * and calls addItemToCartById(itemId, qty)
 */
function addQuantityToCart() {
  const qQtyEl = document.getElementById('qQty');
  const qUnitEl = document.getElementById('qUnit');

  if (!currentItemForQty) {
    showToast('No item selected', 'error');
    return;
  }
  
  const qtyRaw = parseFloat(qQtyEl?.value || '0');
  const unit = qUnitEl?.value || 'kg';

  if (!qtyRaw || qtyRaw <= 0) {
    showToast('Enter a valid quantity', 'warn');
    return;
  }

  // Convert to appropriate unit based on item type
  let finalQty = qtyRaw;
  
  if (currentItemType === 'packet' || unit === 'packet' || unit === 'units') {
    // Packet items: quantity is discrete units
    finalQty = Math.round(qtyRaw);
  } else if (unit === 'g') {
    // Grams: convert to kilograms
    finalQty = qtyRaw / 1000;
  } else if (unit === 'kg') {
    // Already in kilograms
    finalQty = qtyRaw;
  }

  try {
    addItemToCartById(currentItemForQty, finalQty);
    closeQuantityModal();
  } catch (err) {
    console.error('Failed to add to cart:', err);
    showToast('Could not add item to cart', 'error');
  }
}



function renderInventoryTable(items) {
  const tbody = document.getElementById('itemsBody');
  if (!items || items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9">No items found</td></tr>';
    return;
  }

  tbody.innerHTML = items.map(it => {
    const barcodeDisplay = it.sku ? `<span style="font-family:monospace;background:rgba(157,93,255,.1);padding:2px 6px;border-radius:4px;">📱 ${it.sku}</span>` : '-';
    return `
    <tr>
      <td>#${it.id}</td>
      <td><strong>${it.name}</strong></td>
      <td>${it.type || 'loose'}</td>
      <td>₹${Number(it.pricePerKg || 0).toFixed(2)}</td>
      <td>₹${Number(it.mrp || 0).toFixed(2)}</td>
      <td>₹${Number(it.costPerKg || 0).toFixed(2)}</td>
      <td>${Number(it.quantity || 0).toFixed(2)}</td>
      <td>${Number(it.reorderThreshold || 5).toFixed(2)}</td>
      <td>${barcodeDisplay}</td>
      <td>
  <button class="btn-secondary btn-sm" onclick="openQuantityModal(${it.id}, ${it.pricePerKg || 0}, '${it.type || 'loose'}')">Select Qty</button>
  <button class="btn-secondary btn-sm" onclick="addToCartQuick(${it.id})">Add to Cart</button>
  <button class="btn-secondary btn-sm" onclick="openEditModal(${it.id})">Edit</button>
  <button class="btn-danger btn-sm" onclick="deleteItem(${it.id})">Delete</button>
</td>
    </tr>
  `;
  }).join('');
}
















async function deleteItem(id) {
  if (!confirm('Delete this item?')) return;
  await fetch(`${API_BASE}/items/${id}`, { method: 'DELETE' });
  loadInventory();
}

// Backwards-compatible wrapper: some templates call openEditModal()
function openEditModal(id) {
  // delegate to editItem which loads the modal and populates fields
  editItem(id);
}

// Quick add: add one unit for packet items or 1 kg for loose items
async function addToCartQuick(itemId) {
  try {
    const items = await getItems();
    const item = items.find(i => Number(i.id) === Number(itemId));
    if (!item) return showToast('Item not found', 'error');

    let qty = 1;
    // For loose items, qty=1 means 1 kg; for packet/items, qty is 1 packet/unit
    if (item.type && item.type.toString().toLowerCase() === 'packet') {
      qty = 1; // 1 packet
    } else {
      qty = 1; // 1 kg for loose
    }

    await addItemToCartById(itemId, qty);
  } catch (e) {
    console.error('addToCartQuick error', e);
    showToast('Failed to add item', 'error');
  }
}
function showAddItemModal() {
  currentEditItemId = null;
  document.getElementById('modalTitle').innerText = 'Add Product';
  document.getElementById('itemForm').reset();
  document.getElementById('itemModal').classList.add('show');
}

async function editItem(id) {
  const items = await getItems();
  const item = items.find(it => it.id === id);
  if (!item) return alert('Item not found');
  
  currentEditItemId = id;
  const el = (id) => document.getElementById(id);
  const setVal = (id, value) => {
    const e = el(id);
    if (!e) return;
    try { e.value = value; } catch (err) { /* ignore readonly or other edge cases */ }
  };

  if (el('modalTitle')) el('modalTitle').innerText = 'Edit Product';
  setVal('modalName', item.name || '');
  setVal('modalType', item.type || 'loose');
  setVal('modalSku', item.sku || '');
  setVal('modalPrice', String(Number(item.pricePerKg || 0)));
  setVal('modalMrp', String(Number(item.mrp || 0)));
  setVal('modalCost', String(Number(item.costPerKg || 0)));
  setVal('modalQuantity', String(Number(item.quantity || 0)));
  setVal('modalCategory', item.category || '');
  setVal('modalBaseQty', item.baseQuantity || '');
  setVal('modalSupplier', item.supplierId || '');
  setVal('modalBatchNo', item.batchNo || '');
  setVal('modalExpiryDate', item.expiryDate ? item.expiryDate.split('T')[0] : '');
  setVal('modalReorderThreshold', String(Number(item.reorderThreshold || 5)));
  setVal('modalReorderQuantity', String(Number(item.reorderQuantity || 10)));
  setVal('modalDescription', item.description || '');

  const modalEl = el('itemModal');
  if (modalEl) modalEl.classList.add('show');
}

async function saveItem() {
  const el = (id) => document.getElementById(id);
  const str = (id) => {
    const e = el(id); return e && e.value !== undefined ? String(e.value) : '';
  };
  const num = (id, def = 0) => {
    const v = str(id);
    if (v === null || v === undefined || v === '') return def;
    const n = Number(v);
    return isNaN(n) ? def : n;
  };

  const payload = {
    name: (str('modalName') || '').trim(),
    type: (str('modalType') || '').trim() || 'loose',
    sku: (str('modalSku') || '').trim() || null,
    pricePerKg: num('modalPrice', 0),
    mrp: num('modalMrp', 0),
    costPerKg: num('modalCost', 0),
    quantity: num('modalQuantity', 0),
    category: (str('modalCategory') || '').trim() || null,
    baseQuantity: (str('modalBaseQty') || '').trim() || null,
    supplierId: (str('modalSupplier') || '') || null,
    batchNo: (str('modalBatchNo') || '').trim() || null,
    expiryDate: (str('modalExpiryDate') || null) || null,
    reorderThreshold: num('modalReorderThreshold', 5),
    reorderQuantity: num('modalReorderQuantity', 10),
    description: (str('modalDescription') || '').trim()
  };
  
  if (!payload.name || !payload.pricePerKg) {
    return alert('Name and price are required');
  }
  
  try {
    showToast('Saving product...', 'info', 2000);
    if (currentEditItemId) {
      await fetch(`${API_BASE}/items/${currentEditItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      await fetch(`${API_BASE}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
    closeModal();
    loadInventory();
  } catch (e) {
    console.error('saveItem error', e);
    alert('Error saving product: ' + (e.message || JSON.stringify(e)));
  }
}

function closeModal() {
  document.getElementById('itemModal').classList.remove('show');
  currentEditItemId = null;
}

// Voice Search (Web Speech API)
function setupVoiceSearch() {
  const btn = document.getElementById('voiceSearchBtn');
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  
  btn.addEventListener('click', () => {
    recognition.start();
    btn.innerText = '🎤 Listening...';
  });
  
  recognition.addEventListener('result', (e) => {
    const transcript = Array.from(e.results)
      .map(result => result[0].transcript)
      .join('');
    document.getElementById('searchInput').value = transcript;
    performSearch(transcript);
    btn.innerText = '🎤 Voice Search';
  });
  
  recognition.addEventListener('error', () => {
    btn.innerText = '🎤 Voice Search';
  });
}

// ===== CSV IMPORT =====
function openCsvImportModal() {
  const modal = document.getElementById('csvImportModal');
  if (modal) {
    modal.classList.add('show');
    document.getElementById('csvFileInput').value = '';
    document.getElementById('csvPreview').style.display = 'none';
    document.getElementById('csvImportStatus').style.display = 'none';
    document.getElementById('csvImportError').style.display = 'none';
    document.getElementById('csvPreviewBtn').style.display = 'block';
    document.getElementById('csvImportBtn').style.display = 'none';
  }
}

function closeCsvImportModal() {
  const modal = document.getElementById('csvImportModal');
  if (modal) modal.classList.remove('show');
}

let csvData = []; // Store parsed CSV data for import

function previewCsv() {
  const fileInput = document.getElementById('csvFileInput');
  const file = fileInput.files[0];
  if (!file) {
    showToast('Please select a CSV file', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const csv = e.target.result;
      const lines = csv.trim().split('\n');
      if (lines.length < 2) {
        showToast('CSV must have header and at least 1 row', 'error');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const requiredCols = ['name', 'price'];
      const missingCols = requiredCols.filter(col => !headers.includes(col));
      if (missingCols.length > 0) {
        showToast(`Missing required columns: ${missingCols.join(', ')}`, 'error');
        return;
      }

      csvData = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.every(v => !v)) continue; // skip empty lines
        
        const row = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });
        
        // Parse and validate
        const name = row.name || '';
        const price = Number(row.price) || 0;
        const mrp = Number(row.mrp) || price;
        const type = (row.type || 'loose').toLowerCase();
        const qty = Number(row.quantity) || 1;
        const sku = row.sku || null;

        if (!name || price <= 0) {
          showToast(`Row ${i + 1}: Name and Price are required`, 'error');
          return;
        }

        csvData.push({
          name, price, mrp, type, qty, sku,
          costPerKg: Number(row.cost) || 0,
          category: row.category || null,
          reorderThreshold: Number(row.reorderat) || 5,
          reorderQuantity: Number(row.reorderqty) || 10
        });
      }

      if (csvData.length === 0) {
        showToast('No valid rows in CSV', 'error');
        return;
      }

      // Show preview
      renderCsvPreview(csvData);
      document.getElementById('csvPreview').style.display = 'block';
      document.getElementById('csvPreviewBtn').style.display = 'none';
      document.getElementById('csvImportBtn').style.display = 'inline-block';
      showToast(`Ready to import ${csvData.length} products`, 'success');
    } catch (err) {
      console.error('CSV parse error', err);
      showToast('Error parsing CSV: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

function renderCsvPreview(items) {
  let html = '<table style="width:100%; border-collapse: collapse; font-size: 12px;"><thead><tr style="background: #9d5dff; color: #fff;"><th style="border: 1px solid #555; padding: 6px;">Name</th><th style="border: 1px solid #555; padding: 6px;">Price</th><th style="border: 1px solid #555; padding: 6px;">MRP</th><th style="border: 1px solid #555; padding: 6px;">Type</th><th style="border: 1px solid #555; padding: 6px;">Qty</th><th style="border: 1px solid #555; padding: 6px;">SKU</th></tr></thead><tbody>';
  items.slice(0, 20).forEach((item, idx) => {
    html += `<tr style="background: ${idx % 2 ? 'rgba(255,255,255,.05)' : 'transparent'};">
      <td style="border: 1px solid #555; padding: 6px;">${item.name}</td>
      <td style="border: 1px solid #555; padding: 6px;">₹${item.price}</td>
      <td style="border: 1px solid #555; padding: 6px;">₹${item.mrp}</td>
      <td style="border: 1px solid #555; padding: 6px;">${item.type}</td>
      <td style="border: 1px solid #555; padding: 6px;">${item.qty}</td>
      <td style="border: 1px solid #555; padding: 6px;">${item.sku || '—'}</td>
    </tr>`;
  });
  if (items.length > 20) {
    html += `<tr style="text-align: center; padding: 8px;"><td colspan="6"><em>... and ${items.length - 20} more items</em></td></tr>`;
  }
  html += '</tbody></table>';
  document.getElementById('csvPreviewTable').innerHTML = html;
}

async function importCsv() {
  if (csvData.length === 0) {
    showToast('No data to import', 'error');
    return;
  }

  const statusEl = document.getElementById('csvImportStatus');
  const errorEl = document.getElementById('csvImportError');
  statusEl.style.display = 'none';
  errorEl.style.display = 'none';

  try {
    let imported = 0;
    let failed = 0;

    for (const item of csvData) {
      try {
        const payload = {
          name: item.name,
          sku: item.sku,
          type: item.type,
          pricePerKg: item.price,
          mrp: item.mrp,
          costPerKg: item.costPerKg,
          quantity: item.qty,
          category: item.category,
          reorderThreshold: item.reorderThreshold,
          reorderQuantity: item.reorderQuantity
        };
        
        await fetch(`${API_BASE}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        imported++;
      } catch (err) {
        console.error(`Failed to import ${item.name}:`, err);
        failed++;
      }
    }

    statusEl.innerText = `✅ Import complete: ${imported} products added, ${failed} failed.`;
    statusEl.style.display = 'block';
    
    if (failed > 0) {
      errorEl.innerText = `⚠️ ${failed} items could not be imported. Check console for details.`;
      errorEl.style.display = 'block';
    }

    showToast(`✅ Imported ${imported} products`, 'success', 3000);
    setTimeout(() => {
      closeCsvImportModal();
      loadInventory();
    }, 2000);
  } catch (err) {
    console.error('CSV import error', err);
    errorEl.innerText = `❌ Import failed: ${err.message}`;
    errorEl.style.display = 'block';
    showToast('Import error: ' + err.message, 'error');
  }
}

// ===== BARCODE SCANNER (hardware keyboard-emulating) =====
function setupBarcodeInput() {
  const barcodeInput = document.getElementById('barcodeInput');
  const focusBtn = document.getElementById('focusBarcodeBtn');

  // If the scan button exists (inventory), focus hidden input so hardware scanner types there
  focusBtn?.addEventListener('click', () => {
    barcodeInput.focus();
    // provide a tiny visual hint
    focusBtn.innerText = '🔍 Ready';
    setTimeout(() => focusBtn.innerText = '🔍 Scan', 1500);
  });

  // Handle Enter key: scanners usually send the code and an Enter
  barcodeInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const code = barcodeInput.value.trim();
      barcodeInput.value = '';
      if (!code) return;
      try {
        // Use cached item lookup (instant)
        const item = getItemBySku(code);
        if (!item) {
          showToast(`No item found for barcode/SKU: ${code}`, 'warn');
          logBarcodeDebug && logBarcodeDebug('USB scanner: no item found for ' + code);
          return;
        }

        // If billing page active, add to cart; otherwise open edit modal
        const activePage = document.querySelector('.page.active')?.id;
        if (activePage === 'billing') {
          // default qty: 1
          await addItemToCartById(item.id, 1);
          logBarcodeDebug && logBarcodeDebug('USB scanner added: ' + item.name);
          // addItemToCartById already shows a success toast
        } else if (activePage === 'inventory') {
          // Open edit item modal for this SKU
          currentEditItemId = item.id;
          await editItem(item.id);
        } else {
          // default: show a quick info
          showToast(`${item.name}: ${Number(item.quantity||0)} in stock`, 'info');
        }
      } catch (err) {
        console.error('Barcode lookup failed', err);
        logBarcodeDebug && logBarcodeDebug('USB scanner lookup error: ' + (err && err.message));
        showToast('Lookup failed: ' + err.message, 'error');
      }
    }
  });

  // Auto-focus hidden barcode input on page load so USB scanner is ready immediately
  try {
    barcodeInput.focus();
  } catch (e) {
    // ignore
  }
}

async function performSearch(q) {
  currentSearchTerm = q;
  if (!q.trim()) {
    loadInventory();
  } else {
    const items = await fetch(`${API_BASE}/items?search=${encodeURIComponent(q)}`).then(r => r.json());
    renderInventoryTable(items);
    
    // Auto-select if exact barcode match (first item with matching SKU)
    if (items.length > 0 && items[0].sku && items[0].sku.trim().toLowerCase() === q.trim().toLowerCase()) {
      // Auto-expand/highlight the first result
      setTimeout(() => {
        const rows = document.querySelectorAll('#itemsBody tr');
        if (rows.length > 0) {
          rows[0].style.background = 'rgba(157,93,255,.15)';
          rows[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
          showToast(`✓ Found: ${items[0].name}`, 'success');
        }
      }, 100);
    }
  }
}

// ===== PREDICTIONS =====
async function loadPredictions() {
  try {
    const pred = await fetch(`${API_BASE}/predictions`).then(r => r.json());
    renderPredictions(pred);
  } catch (e) {
    document.getElementById('predictionsTable').innerText = 'Error loading predictions';
  }
}

function renderPredictions(items) {
  const el = document.getElementById('predictionsTable');
  if (!items || items.length === 0) {
    el.innerHTML = '<p>No items running low on stock.</p>';
    return;
  }
  
  el.innerHTML = '<table class="predictions-table">' + 
    '<thead><tr><th>Item</th><th>Current Qty</th><th>Reorder At</th><th>Avg Daily Sales</th><th>Days to Stockout</th><th>Suggest Reorder</th></tr></thead><tbody>' + 
    items.map(it => `
      <tr>
        <td><strong>${it.name}</strong></td>
        <td>${Number(it.quantity).toFixed(2)}</td>
        <td>${Number(it.reorderThreshold).toFixed(2)}</td>
        <td>${Number(it.avgDailySales).toFixed(2)}</td>
        <td style="color:${it.daysUntilStockout <= 3 ? 'red' : 'orange'}"><strong>${it.daysUntilStockout} days</strong></td>
        <td>${Number(it.suggestedReorder).toFixed(2)}</td>
      </tr>
    `).join('') + 
    '</tbody></table>';
}

// ===== BILLING =====
let cart = [];
let currentCustomer = null;
let lastBillId = null;

async function loadBillingItems() {
  const items = await getItems();
  // Update cache for fast barcode lookup
  cachedItems = items;
  buildItemIndices();
  populateSelect(items);
  populateBillItemSelect(items);
}

function populateBillItemSelect(items) {
  const sel = document.getElementById('billItemSelect'); // <-- Use correct element ID
  if (!sel) return;
  sel.innerHTML = '<option value="">Select item...</option>' + (items.length === 0 ? '' : items.map(i => `<option value="${i.id}" data-price="${i.pricePerKg}" data-mrp="${i.mrp}" data-type="${i.type || 'loose'}">${i.name} (MRP ₹${Number(i.mrp||i.pricePerKg).toFixed(2)})</option>`).join(''));
}

// Populate the simple item select used by quick billing
function populateSelect(items) {
  const sel = document.getElementById('itemSelect');
  if (!sel) return;
  if (!items || items.length === 0) {
    sel.innerHTML = '<option value="">-- no items --</option>';
    return;
  }
  sel.innerHTML = items.map(i => `<option value="${i.id}" data-mrp="${i.mrp}" data-price="${i.pricePerKg}">${i.name} — MRP ₹${Number(i.mrp||i.pricePerKg).toFixed(2)}</option>`).join('');
}

// Simple toast helper: type = 'success' | 'info' | 'warn' | 'error'
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) {
    // Fallback to alert if container missing
    return alert(message);
  }
  const t = document.createElement('div');
  t.className = 'toast ' + (type === 'info' ? '' : type);
  t.innerHTML = `<div class="toast-msg">${message}</div><button class="toast-close" aria-label="Close">&times;</button>`;
  const closeBtn = t.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => { t.remove(); });
  container.appendChild(t);
  if (duration > 0) setTimeout(() => t.remove(), duration);
  return t;
}

// Add item to cart by itemId with a given quantity (create or increment)
async function addItemToCartById(itemId, qty = 1) {
  // Fetch item info (prefer cached list if available)
  let itemData;
  try {
    const items = await getItems();
    itemData = items.find(i => Number(i.id) === Number(itemId));
  } catch (err) {
    console.error('Failed to fetch item info', err);
    return showToast('Could not fetch item info', 'error');
  }

  if (!itemData) {
    return showToast('Item not found', 'error');
  }

  // Default qty conversion: if `packet` type, treat qty as discrete units.
  const addQty = (itemData.type === 'packet') ? Math.round(Number(qty)) : Number(qty);
  const existing = cart.find(c => c.itemId === itemData.id);
  if (existing) {
    existing.quantity = Number(existing.quantity) + addQty;
  } else {
    cart.push({
      itemId: itemData.id,
      quantity: addQty,
      name: itemData.name,
      unitPrice: Number(itemData.pricePerKg || itemData.mrp || 0),
      mrp: (itemData.mrp !== undefined && itemData.mrp !== null) ? Number(itemData.mrp) : null
    });
  }
  renderCart();
  // Show success toast
  showToast(`Added ${addQty} × ${itemData.name} to cart`, 'success');

  // Low stock / out-of-stock hints (informational only)
  try {
    const remaining = Number(itemData.quantity || 0) - addQty;
    if (remaining <= 0) {
      showToast(`${itemData.name} is out of stock (stock: ${Number(itemData.quantity||0)})`, 'error', 5000);
    } else if (itemData.reorderThreshold !== undefined && remaining <= Number(itemData.reorderThreshold)) {
      showToast(`${itemData.name} is low on stock (${remaining} left) — consider reordering`, 'warn', 5000);
    }
  } catch (e) {
    // ignore
  }
}

// expose helper globally for inline onclick usage if needed
window.addItemToCartById = addItemToCartById;

function addToCart() {
  (async () => {
    const itemSelect = document.getElementById('billItemSelect');
    const selectedOption = itemSelect.options[itemSelect.selectedIndex];
    const itemId = Number(document.getElementById('billItemSelect').value);
    let qty = Number(document.getElementById('billQuantity').value);
    if (!itemId || isNaN(qty) || qty <= 0) return showToast('Select item and enter quantity', 'warn');

    const itemType = selectedOption.dataset.type;
    if (itemType === 'loose') {
        const unit = document.getElementById('billUnit').value;
        if (unit === 'g') {
            qty = qty / 1000; // convert grams to kg
        }
    }

    await addItemToCartById(itemId, qty);
    document.getElementById('billItemSelect').value = '';
    document.getElementById('billQuantity').value = '1';
    document.getElementById('billUnit').style.display = 'none';
    document.getElementById('billPrice').style.display = 'none';
    document.getElementById('billPrice').value = '';
  })();
}

function removeFromCart(itemId) {
  cart = cart.filter(c => c.itemId !== itemId);
  renderCart();
}

function updateCartQuantity(itemId, qty) {
  const item = cart.find(c => c.itemId === itemId);
  if (item) {
    if (qty <= 0) {
      removeFromCart(itemId);
    } else {
      item.quantity = qty;
      renderCart();
    }
  }
}

function renderCart() {
  const el = document.getElementById('cartItems');
  if (cart.length === 0) {
    el.innerHTML = '<p style="color:#999">Cart is empty</p>';
    // Clear amount paid when cart empties
    const amountPaidInput = document.getElementById('amountPaidInput');
    if (amountPaidInput) amountPaidInput.value = '';
    updateBillTotals();
    return;
  }

  el.innerHTML = '<table class="cart-table"><tbody>' + 
    cart.map(item => {
      const itemTotal = item.quantity * item.unitPrice;
      const hasMrp = item.mrp && Number(item.mrp) > 0;
      const saved = hasMrp ? (item.mrp - item.unitPrice) * item.quantity : 0;
      const savedPercent = hasMrp && item.mrp > 0 ? Math.round(((item.mrp - item.unitPrice) / item.mrp) * 100) : 0;
      return `<tr>
        <td><strong>${item.name}</strong></td>
        <td>
          <input type="number" step="0.01" min="0.01" value="${Number(item.quantity).toFixed(2)}" 
                 onchange="updateCartQuantity(${item.itemId}, this.value)" style="width:60px;padding:4px;">
        </td>
        <td>
          ₹${Number(item.unitPrice).toFixed(2)}${hasMrp ? ` <small style="color:#666">(MRP ₹${Number(item.mrp).toFixed(2)})</small>` : ''}
        </td>
        <td><strong>₹${Number(itemTotal).toFixed(2)}</strong></td>
        <td>${hasMrp && saved > 0 ? `<small style="color:green">Saved ₹${Number(saved).toFixed(2)} (${savedPercent}%)</small>` : ''}</td>
        <td><button class="btn-sm btn-danger" onclick="removeFromCart(${item.itemId})">✕</button></td>
      </tr>`;
    }).join('') + 
    '</tbody></table>';
  updateBillTotals();
}

function updateBillTotals() {
  const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const loyaltyUsed = Number(document.getElementById('loyaltyDiscount').value) || 0;
  const POINT_VALUE = 1; // ₹1 per loyalty point redeemed
  const discount = Math.min(loyaltyUsed * POINT_VALUE, subtotal);
  const tax = 0; // no tax for now
  const total = subtotal - discount + tax;

  document.getElementById('billSubtotal').innerText = '₹' + Number(subtotal).toFixed(2);
  document.getElementById('billDiscount').innerText = '-₹' + Number(discount).toFixed(2);
  document.getElementById('billTax').innerText = '₹' + Number(tax).toFixed(2);
  document.getElementById('billTotal').innerText = '₹' + Number(total).toFixed(2);
  
  // Compute due amount if partial payment is entered
  const amountPaidInput = document.getElementById('amountPaidInput');
  const amountPaidHint = document.getElementById('amountPaidHint');
  const dueCustomerFields = document.getElementById('dueCustomerFields');
  if (amountPaidInput && amountPaidHint) {
    const amountPaid = Number(amountPaidInput.value) || 0;
    if (amountPaid > 0 && amountPaid < total) {
      const due = total - amountPaid;
      amountPaidHint.innerText = `Paid: ₹${Number(amountPaid).toFixed(2)} | Due: ₹${Number(due).toFixed(2)}`;
      amountPaidHint.style.color = '#ff9800';
      if (dueCustomerFields) dueCustomerFields.style.display = 'block';
    } else if (amountPaid >= total) {
      amountPaidHint.innerText = `Amount paid covers full bill ✓`;
      amountPaidHint.style.color = '#4caf50';
      if (dueCustomerFields) dueCustomerFields.style.display = 'none';
    } else {
      amountPaidHint.innerText = 'Leave blank = customer pays full total. Enter amount for partial payment.';
      amountPaidHint.style.color = '#666';
      if (dueCustomerFields) dueCustomerFields.style.display = 'none';
    }
  }
  
  // compute savings vs MRP
  const totalMrpValue = cart.reduce((s, item) => s + (item.mrp && item.mrp > 0 ? item.quantity * item.mrp : item.quantity * item.unitPrice), 0);
  const savings = Math.max(0, totalMrpValue - subtotal);
  const savingsPercent = totalMrpValue > 0 ? Math.round((savings / totalMrpValue) * 100) : 0;
  document.getElementById('billSavings').innerText = (savings > 0 ? '-₹' + Number(savings).toFixed(2) : '₹0.00') + (savingsPercent > 0 ? ` (${savingsPercent}%)` : '');
}

// ----- Offline queue (IndexedDB) for bills -----
const OUTBOX_DB = 'vendora-outbox';
const OUTBOX_STORE = 'bills';

function openOutboxDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OUTBOX_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) db.createObjectStore(OUTBOX_STORE, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function addToOutbox(payload) {
  const db = await openOutboxDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, 'readwrite');
    const store = tx.objectStore(OUTBOX_STORE);
    store.add({ payload, created_at: new Date().toISOString() });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function getOutboxItems() {
  const db = await openOutboxDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, 'readonly');
    const store = tx.objectStore(OUTBOX_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function removeOutboxItem(id) {
  const db = await openOutboxDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OUTBOX_STORE, 'readwrite');
    tx.objectStore(OUTBOX_STORE).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function syncOutbox() {
  if (!navigator.onLine) return;
  const items = await getOutboxItems();
  for (const it of items) {
    try {
      const res = await fetch(`${API_BASE}/bill`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(it.payload) });
      if (res && res.ok) {
        const j = await res.json();
        // Remove from outbox on success
        await removeOutboxItem(it.id);
        console.log('Synced outbox bill', it.id, j);
      }
    } catch (e) {
      console.warn('Failed to sync outbox item', it.id, e);
      // keep remaining items
    }
  }
}

// Register service worker and online sync handler
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => console.log('SW registered', reg.scope)).catch(() => {});
  });
}

window.addEventListener('online', () => {
  showToast('Online — syncing queued bills', 'info');
  syncOutbox();
});

window.addEventListener('offline', () => {
  showToast('You are offline — bills will be queued', 'warn');
});


async function searchCustomer() {
  const phone = document.getElementById('customerPhone').value.trim();
  if (!phone) return;

  try {
    const resp = await fetch(`${API_BASE}/customer/${phone}`);
    if (!resp.ok) {
      // Customer not found or error
      const name = prompt('New customer. Enter name:');
      if (name) {
        const createResp = await fetch(`${API_BASE}/customer`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ phone, name })
        });
        if (createResp.ok) {
          searchCustomer(); // reload
        } else {
          showToast('Failed to create customer', 'error');
        }
      }
      return;
    }
    
    const cust = await resp.json();
    if (cust && cust.id) {
      currentCustomer = cust;
      document.getElementById('customerName').innerText = cust.name || 'Unknown';
      document.getElementById('customerPoints').innerText = Math.floor(cust.loyalty_points || 0);
      
      // Fetch customer balance (credit/debt)
      try {
        const balResp = await fetch(`${API_BASE}/customer/${cust.id}/balance`);
        const balance = balResp.ok ? await balResp.json() : { balance: 0 };
        const balanceEl = document.getElementById('customerBalance');
        const balanceHintEl = document.getElementById('balanceHint');
        if (balanceEl) {
          const bal = Number(balance.balance || 0);
          balanceEl.innerText = (bal >= 0 ? '₹' : '-₹') + Math.abs(bal).toFixed(2);
          balanceEl.style.color = bal >= 0 ? '#0f0' : '#f88';
          if (balanceHintEl) {
            if (bal > 0) {
              balanceHintEl.innerText = '✓ Customer has paid in advance (credit)';
            } else if (bal < 0) {
              balanceHintEl.innerText = '⚠ Customer owes ₹' + Math.abs(bal).toFixed(2);
            } else {
              balanceHintEl.innerText = 'Balance settled';
            }
          }
        }
      } catch (e) {
        console.error('Failed to fetch balance', e);
      }
      
      // Fetch and display customer credit history
      try {
        const credits = await fetch(`${API_BASE}/customer/${cust.id}/credits`).then(r => r.json());
        displayCustomerCredits(credits);
      } catch (e) {
        console.warn('Failed to fetch customer credits', e);
      }
      
      document.getElementById('customerInfo').style.display = 'block';
      document.getElementById('noCustomer').style.display = 'none';
    }
  } catch (e) {
    console.error('searchCustomer error:', e);
    showToast('Error searching customer', 'error');
  }
}

function displayCustomerCredits(credits) {
  const creditsContainer = document.getElementById('customerCreditsHistory');
  if (!creditsContainer) return;
  
  if (!credits || credits.length === 0) {
    creditsContainer.innerHTML = '<small style="color:#999;">No pending dues or credit history</small>';
    return;
  }
  
  // Show only unpaid dues
  const unpaid = credits.filter(c => c.dueAmount > 0);
  if (unpaid.length === 0) {
    creditsContainer.innerHTML = '<small style="color:#0f0;">✓ No pending dues</small>';
    return;
  }
  
  let html = '<small style="color:#ff9800;">📋 Pending Dues:</small><table style="width:100%;font-size:11px;margin-top:4px;border-collapse:collapse;">';
  html += '<thead style="background:rgba(157,93,255,.1);"><tr><th style="padding:4px;text-align:left;">Bill #</th><th style="text-align:right;">Due</th><th style="text-align:right;">Paid</th><th style="text-align:left;">Date</th></tr></thead><tbody>';
  
  unpaid.forEach(c => {
    const billDate = c.billDate ? new Date(c.billDate).toLocaleDateString() : '—';
    html += `<tr style="border-bottom:1px solid #eee;"><td style="padding:4px;">#${c.billId || '?'}</td><td style="text-align:right;padding:4px;color:#f88;">₹${Number(c.dueAmount).toFixed(2)}</td><td style="text-align:right;padding:4px;">₹${Number(c.paidAmount).toFixed(2)}</td><td style="padding:4px;font-size:10px;">${billDate}</td></tr>`;
  });
  
  const totalDue = unpaid.reduce((s, c) => s + Number(c.dueAmount), 0);
  html += `<tr style="background:rgba(157,93,255,.08);font-weight:bold;"><td style="padding:6px;">TOTAL</td><td style="text-align:right;padding:6px;color:#f88;">₹${Number(totalDue).toFixed(2)}</td><td colspan="2"></td></tr>`;
  html += '</tbody></table>';
  
  creditsContainer.innerHTML = html;
}

async function generateBill() {
  if (cart.length === 0) {
    return alert('Cart is empty');
  }

  const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const usedPoints = Number(document.getElementById('loyaltyDiscount').value) || 0;
  const discount = Math.min(usedPoints, subtotal); // 1 point = ₹1 discount
  const tax = 0;
  const total = subtotal - discount + tax;
  const paymentMethod = document.getElementById('paymentMethod').value;
  const customerNameInput = (document.getElementById('customerName_input') || {}).value || '';
  const customerPhoneInput = (document.getElementById('customerPhone') || {}).value || '';
  // If a due is present and the operator filled the optional due-specific fields, prefer those for recording the credit
  const dueCustomerName = (document.getElementById('dueCustomerName') || {}).value || '';
  const dueCustomerPhone = (document.getElementById('dueCustomerPhone') || {}).value || '';

  const billData = {
    customerId: currentCustomer ? currentCustomer.id : null,
    // prefer due-specific entries when present (optional), otherwise use the main customer inputs
    customerName: (dueCustomerName.trim() || customerNameInput.trim()),
    customerPhone: (dueCustomerPhone.trim() || (currentCustomer ? (currentCustomer.phone || '') : customerPhoneInput.trim())),
    items: cart.map(c => ({ itemId: c.itemId, quantity: c.quantity, unitPrice: c.unitPrice, mrp: c.mrp || null, name: c.name })),
    subtotal,
    discount,
    tax,
    paymentMethod,
    usedPoints
  };

  // If payment method is 'debit' we need to collect extra info (name, phone, date)
  let debitDetails = null;
  if (paymentMethod === 'debit') {
    try {
      debitDetails = await showDebitModalAwait(total);
      // ensure amount matches total (user may edit amount separately)
      if (!debitDetails || typeof debitDetails.amount === 'undefined') {
        return alert('Debit details required');
      }
    } catch (e) {
      // user cancelled
      return;
    }
  }

  try {
    // Compute `paid` amount from the UI field or debit details
    let paidToSend = total; // default: full payment
    
    const amountPaidInput = document.getElementById('amountPaidInput');
    const amountPaidByUser = amountPaidInput ? Number(amountPaidInput.value) : 0;
    
    if (amountPaidByUser > 0) {
      // User entered an amount paid in the "Amount Paid" field
      paidToSend = amountPaidByUser;
    } else if (paymentMethod === 'debit' && debitDetails && typeof debitDetails.amount !== 'undefined') {
      // For debit, use the debit modal amount if no amount paid field entry
      paidToSend = Number(debitDetails.amount);
    }
    // Otherwise default to full total
    
    let res;
    try {
      res = await fetch(`${API_BASE}/bill`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(Object.assign({}, billData, { paid: paidToSend }))
      }).then(r => r.json());
    } catch (e) {
      // Network error — queue bill for later sync
      try {
        await addToOutbox(Object.assign({}, billData, { paid: paidToSend }));
        showToast('Offline: Bill queued and will sync when online', 'warn');
        // produce a fake response so UI proceeds with lastBillId placeholder
        res = { success: true, billId: 'queued-' + Date.now(), total: Number(billData.subtotal - billData.discount + billData.tax || 0), due: Math.max(0, Number(billData.subtotal - billData.discount + billData.tax || 0) - paidToSend) };
        lastBillId = null; // queued, no server id
      } catch (qErr) {
        return alert('Failed to save bill offline: ' + (qErr && qErr.message));
      }
    }

    if (res.success) {
      lastBillId = res.billId;
      const dueAmount = Number(res.due || 0);
      const statusMsg = dueAmount > 0 
        ? `Bill #${res.billId} created! Total: ₹${Number(res.total).toFixed(2)} | Due: ₹${dueAmount.toFixed(2)}`
        : `Bill #${res.billId} created! Total: ₹${Number(res.total).toFixed(2)} (Paid)`;
      alert(statusMsg);

      // If debit details were collected earlier, send debit record linked to bill
      try {
        if (paymentMethod === 'debit' && debitDetails) {
          const debitResp = await fetch(`${API_BASE}/debit`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              name: debitDetails.name,
              phone: debitDetails.phone,
              amount: debitDetails.amount,
              date: debitDetails.date,
              total: debitDetails.total,
              billId: res.billId
            })
          }).then(r => r.json());

          if (!debitResp || !debitResp.success) {
            console.warn('Failed to save debit record', debitResp);
            showToast('Warning: debit record not saved', 'warn');
          }
        }
      } catch (e) {
        console.error('Error saving debit record:', e);
      }
      
      // Update customer if applicable
      if (currentCustomer) {
        // server returns pointsGained and redeemedPoints
        const gained = Number(res.pointsGained || 0);
        const redeemed = Number(res.redeemedPoints || 0);
        currentCustomer.loyalty_points = (currentCustomer.loyalty_points || 0) - redeemed + gained;
        document.getElementById('customerPoints').innerText = Math.floor(currentCustomer.loyalty_points || 0);

        // Adjust customer balance based on payment method
        let balanceAdjustment = 0;
        let reason = '';
        
        if (paymentMethod === 'credit') {
          // Customer paid in advance - add to their credit balance
          balanceAdjustment = total;
          reason = `Bill #${res.billId} - Prepaid (Credit)`;
        } else if (paymentMethod === 'debt') {
          // Customer owes - subtract from balance (negative debt)
          balanceAdjustment = -total;
          reason = `Bill #${res.billId} - Debt`;
        }
        // cash and online don't change balance (settled immediately)

        if (balanceAdjustment !== 0) {
          try {
            const balRes = await fetch(`${API_BASE}/customer/${currentCustomer.id}/balance/adjust`, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ amount: balanceAdjustment, reason })
            }).then(r => r.json());

            if (balRes.success) {
              // Update displayed balance
              const balanceEl = document.getElementById('customerBalance');
              if (balanceEl) {
                const newBalance = Number(balRes.balance || 0);
                balanceEl.innerText = (newBalance >= 0 ? '₹' : '-₹') + Math.abs(newBalance).toFixed(2);
                balanceEl.style.color = newBalance >= 0 ? '#0f0' : '#f88';
                
                const balanceHintEl = document.getElementById('balanceHint');
                if (balanceHintEl) {
                  if (newBalance > 0) {
                    balanceHintEl.innerText = '✓ Customer has paid in advance (credit)';
                  } else if (newBalance < 0) {
                    balanceHintEl.innerText = '⚠ Customer owes ₹' + Math.abs(newBalance).toFixed(2);
                  } else {
                    balanceHintEl.innerText = 'Balance settled';
                  }
                }
              }
            }
          } catch (e) {
            console.error('Failed to update customer balance:', e);
          }
        }
      }
      
      cart = [];
      renderCart();
      document.getElementById('loyaltyDiscount').value = '';
    } else {
      alert('Error: ' + (res.error || 'Unknown error'));
    }
  } catch (e) {
    console.error('generateBill error:', e);
    alert('Error creating bill: ' + e.message);
  }
}

function clearCart() {
  if (!confirm('Clear cart?')) return;
  cart = [];
  renderCart();
}

// ===== Debit modal helper (returns Promise resolved with details)
let _debitModalPromise = null;
function showDebitModalAwait(totalAmount) {
  return new Promise((resolve, reject) => {
    _debitModalPromise = { resolve, reject };
    const modal = document.getElementById('debitModal');
    if (!modal) return reject('no-modal');
    // populate fields
    const today = new Date().toISOString().slice(0,10);
    const amtEl = document.getElementById('debitAmount');
    const totalEl = document.getElementById('debitTotal');
    const dateEl = document.getElementById('debitDate');
    if (amtEl) { amtEl.value = Number(totalAmount || 0).toFixed(2); }
    if (totalEl) { totalEl.value = Number(totalAmount || 0).toFixed(2); }
    if (dateEl) { dateEl.value = today; }
    modal.classList.add('show');
    const nameEl = document.getElementById('debitName');
    if (nameEl) nameEl.focus();
  });
}

function closeDebitModal() {
  const modal = document.getElementById('debitModal');
  if (modal) modal.classList.remove('show');
  if (_debitModalPromise) {
    _debitModalPromise.reject('cancel');
    _debitModalPromise = null;
  }
}

async function submitDebitForm() {
  const name = (document.getElementById('debitName') || {}).value || '';
  const phone = (document.getElementById('debitPhone') || {}).value || '';
  const amount = Number((document.getElementById('debitAmount') || {}).value || 0);
  const date = (document.getElementById('debitDate') || {}).value || new Date().toISOString().slice(0,10);
  const total = Number((document.getElementById('debitTotal') || {}).value || amount || 0);

  if (!name) {
    alert('Name is required for Debit records');
    return;
  }

  const details = { name, phone, amount, date, total };
  // close modal
  const modal = document.getElementById('debitModal');
  if (modal) modal.classList.remove('show');

  if (_debitModalPromise) {
    _debitModalPromise.resolve(details);
    _debitModalPromise = null;
  }
}

// Barcode Scanner
let barcodeStream = null;
let barcodeIntervalId = null;
let currentVideoTrack = null;
let torchOn = false;
let zxingReader = null; // ZXing reader instance (if used)

function openBarcodeScanner() {
  const modal = document.getElementById('barcodeScannerModal');
  modal.classList.add('show');
  startBarcodeScanning();
}

function openInventoryBarcodeScanner() {
  // Same as billing but with inventory context
  const modal = document.getElementById('barcodeScannerModal');
  modal.classList.add('show');
  startBarcodeScanning('inventory');
}

function closeBarcodeScanner() {
  const modal = document.getElementById('barcodeScannerModal');
  modal.classList.remove('show');
  stopBarcodeScanning();
}

async function startBarcodeScanning() {
  const video = document.getElementById('videoElement');
  const statusEl = document.getElementById('barcodeStatus');
  const toggleFlashBtn = document.getElementById('toggleFlashBtn');
  logBarcodeDebug && logBarcodeDebug('startBarcodeScanning called');
  
  try {
    statusEl.innerText = 'Requesting camera access...';
    // Use lower resolution for faster processing on mobile devices
    const constraints = {
      video: {
        facingMode: 'environment',
        width: { ideal: 640 },
        height: { ideal: 480 }
      },
      audio: false
    };
    
    barcodeStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = barcodeStream;
    // Save current video track for torch control
    try {
      currentVideoTrack = barcodeStream.getVideoTracks()[0] || null;
    } catch (e) {
      currentVideoTrack = null;
    }
    // Query and display capabilities, then auto-tune constraints
    await tuneAndDisplayCameraCapabilities(currentVideoTrack);
    statusEl.innerText = 'Camera active - Point at barcode to scan';
    logBarcodeDebug && logBarcodeDebug('camera stream obtained');
    // Setup flash toggle if supported
    try {
      if (currentVideoTrack && currentVideoTrack.getCapabilities) {
        const caps = currentVideoTrack.getCapabilities();
        if (caps && caps.torch) {
          toggleFlashBtn.style.display = 'inline-block';
          toggleFlashBtn.innerText = torchOn ? '💡 Flash On' : '💡 Flash Off';
          toggleFlashBtn.onclick = async () => {
            try {
              torchOn = !torchOn;
              await currentVideoTrack.applyConstraints({ advanced: [{ torch: torchOn }] });
              toggleFlashBtn.innerText = torchOn ? '💡 Flash On' : '💡 Flash Off';
            } catch (e) {
              console.warn('Torch toggle failed:', e);
              showToast('Flash not available on this device', 'warn');
            }
          };
        } else {
          toggleFlashBtn.style.display = 'none';
        }
      }
    } catch (e) {
      toggleFlashBtn.style.display = 'none';
    }

    // Tap-to-focus: allow user to tap video to request a single-shot focus (if supported)
    try {
      video.style.cursor = 'pointer';
      const tapHandler = async (ev) => {
        try {
          if (!currentVideoTrack) return;
          const caps = currentVideoTrack.getCapabilities();
          // Try single-shot focus if supported
          if (caps && caps.focusMode && caps.focusMode.includes('single-shot')) {
            await currentVideoTrack.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] });
            statusEl.innerText = '🔎 Tap focus: trying single-shot focus...';
            setTimeout(() => { statusEl.innerText = '📷 Scanning... (point camera at barcode)'; }, 1200);
            logBarcodeDebug && logBarcodeDebug('Tap-to-focus: single-shot applied');
            return;
          }

          // If focus distance supported, try setting to midpoint
          if (caps && typeof caps.focusDistance !== 'undefined') {
            const fmin = caps.focusDistance.min || 0;
            const fmax = caps.focusDistance.max || 0;
            const mid = fmin + (fmax - fmin) * 0.5;
            await currentVideoTrack.applyConstraints({ advanced: [{ focusDistance: mid }] });
            statusEl.innerText = '🔎 Tap focus adjusted';
            setTimeout(() => { statusEl.innerText = '📷 Scanning... (point camera at barcode)'; }, 800);
            logBarcodeDebug && logBarcodeDebug('Tap-to-focus: focusDistance set to ' + mid);
            return;
          }

          // Fallback: briefly toggle torch to give camera a chance to re-autofocus
          if (currentVideoTrack && currentVideoTrack.getCapabilities && currentVideoTrack.getCapabilities().torch) {
            try {
              await currentVideoTrack.applyConstraints({ advanced: [{ torch: true }] });
              setTimeout(async () => {
                try { await currentVideoTrack.applyConstraints({ advanced: [{ torch: false }] }); } catch (e) {}
              }, 300);
            } catch (e) {
              // ignore
            }
          }
        } catch (err) {
          console.warn('Tap-to-focus failed', err);
        }
      };
      // Remove previous handler if set
      video._tapFocusHandler && video.removeEventListener('click', video._tapFocusHandler);
      video.addEventListener('click', tapHandler);
      video._tapFocusHandler = tapHandler;
    } catch (e) {
      // ignore
    }
    // Wire Snap & Decode button (captures high-res still and attempts decode)
    try {
      const snapBtn = document.getElementById('snapDecodeBtn');
      if (snapBtn) {
        snapBtn.onclick = async () => { try { await snapAndDecode(statusEl); } catch(err){ console.warn('snapAndDecode failed', err); } };
      }
    } catch(e) {
      // ignore
    }
    // Try to load barcode detection library (Quagga.js)
    // Prefer ZXing if available (WASM-backed, more accurate and fast)
    if (typeof ZXing !== 'undefined' && ZXing.BrowserMultiFormatReader) {
      startZxingBarcodeDetection(video, statusEl);
    } else if (typeof Quagga === 'undefined') {
      // Fallback: Use simple pattern matching from video canvas
      startCanvasBarcodeDetection(video, statusEl);
    } else {
      startQuaggaBarcodeDetection(video, statusEl);
    }
  } catch (err) {
    console.error('Camera access failed:', err);
    statusEl.innerText = '❌ Camera access denied or not available';
    logBarcodeDebug && logBarcodeDebug('camera access failed: ' + (err && err.message));
    showToast('Camera access required for barcode scanning', 'error');
    closeBarcodeScanner();
  }
}

function stopBarcodeScanning() {
  if (barcodeStream) {
    barcodeStream.getTracks().forEach(track => track.stop());
    barcodeStream = null;
  }
  if (barcodeIntervalId) {
    try { cancelAnimationFrame(barcodeIntervalId); } catch (e) { try { clearInterval(barcodeIntervalId); } catch (e2) {} }
    barcodeIntervalId = null;
  }
  // Stop Quagga if running
  try {
    if (typeof Quagga !== 'undefined' && Quagga.stop) {
      Quagga.stop();
    }
  } catch (e) {
    // ignore
  }
  // Stop ZXing reader if running
  try {
    if (zxingReader && zxingReader.reset) {
      zxingReader.reset();
    }
    zxingReader = null;
  } catch (e) {
    // ignore
  }
  // Turn off torch if it was left on
  try {
    if (currentVideoTrack && torchOn) {
      try { currentVideoTrack.applyConstraints({ advanced: [{ torch: false }] }); } catch (e2) {}
      torchOn = false;
    }
  } catch (e) {
    // ignore
  }
  currentVideoTrack = null;
}

// Capture a still frame (ImageCapture or canvas) and attempt to decode it with ZXing or Quagga fallback
async function snapAndDecode(statusEl) {
  const video = document.getElementById('videoElement');
  if (!video) return;
  statusEl = statusEl || document.getElementById('barcodeStatus');
  statusEl.innerText = '📸 Capturing image...';
  logBarcodeDebug && logBarcodeDebug('snapAndDecode: capturing');

  let blob = null;
  try {
    if (currentVideoTrack && window.ImageCapture) {
      try {
        const ic = new ImageCapture(currentVideoTrack);
        blob = await ic.takePhoto();
        logBarcodeDebug && logBarcodeDebug('snapAndDecode: taken with ImageCapture.takePhoto');
      } catch (e) {
        logBarcodeDebug && logBarcodeDebug('ImageCapture.takePhoto failed: ' + (e && e.message));
      }
    }
  } catch (e) {
    logBarcodeDebug && logBarcodeDebug('ImageCapture error: ' + (e && e.message));
  }

  let dataUrl = null;
  try {
    if (!blob) {
      // Fallback: draw current frame to canvas at video resolution
      const canvas = document.createElement('canvas');
      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      canvas.width = w; canvas.height = h;
      // when reading back from canvas frequently, hint to the browser for better performance
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
      logBarcodeDebug && logBarcodeDebug('snapAndDecode: captured via canvas (' + w + 'x' + h + ')');
    } else {
      // create dataUrl from blob for Quagga fallback
      dataUrl = await new Promise((resolve) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = () => resolve(null);
        fr.readAsDataURL(blob);
      });
    }
  } catch (e) {
    logBarcodeDebug && logBarcodeDebug('snapAndDecode capture failed: ' + (e && e.message));
  }

  if (!blob) {
    statusEl.innerText = '❌ Capture failed';
    return;
  }

  // Create image element for ZXing decoding
  const img = document.createElement('img');
  img.style.display = 'none';
  document.body.appendChild(img);
  try {
    img.src = URL.createObjectURL(blob);
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Image load failed'));
    });
  } catch (e) {
    logBarcodeDebug && logBarcodeDebug('snapAndDecode: image load failed: ' + (e && e.message));
  }

  // Try ZXing first (WASM-backed)
  try {
    if (typeof ZXing !== 'undefined' && ZXing.BrowserMultiFormatReader) {
      const reader = new ZXing.BrowserMultiFormatReader();
      try {
        let result = null;
        if (typeof reader.decodeFromImage === 'function') {
          result = await reader.decodeFromImage(img);
        } else if (typeof reader.decodeFromImageElement === 'function') {
          result = await reader.decodeFromImageElement(img);
        } else if (typeof reader.decodeFromImage === 'undefined' && typeof reader.decodeFromImageElement === 'undefined') {
          // Some builds offer decodeFromImage with signature (undefined, img)
          try { result = await reader.decodeFromImage(undefined, img); } catch(e) { result = null; }
        }

        if (result) {
          const code = (result && (result.getText ? result.getText() : result.text)) || String(result);
          logBarcodeDebug && logBarcodeDebug('snapAndDecode ZXing detected: ' + code);
          statusEl.innerText = `✓ Detected: ${code}`;
          processBarcodeInput(code, statusEl);
          URL.revokeObjectURL(img.src);
          img.remove();
          return;
        }
      } catch (e) {
        logBarcodeDebug && logBarcodeDebug('snapAndDecode ZXing decode failed: ' + (e && e.message));
      }
    }
  } catch (e) {
    logBarcodeDebug && logBarcodeDebug('snapAndDecode ZXing unexpected error: ' + (e && e.message));
  }

  // Fallback: Quagga.decodeSingle using dataUrl
  try {
    if (typeof Quagga !== 'undefined' && Quagga.decodeSingle && dataUrl) {
      statusEl.innerText = '🔎 Decoding image...';
      Quagga.decodeSingle({
        src: dataUrl,
        numOfWorkers: 0,
        inputStream: { size: 800 },
        decoder: { readers: ['ean_reader','upc_reader','code_128_reader'] }
      }, function(result) {
        try {
          if (result && result.codeResult && result.codeResult.code) {
            const code = result.codeResult.code;
            logBarcodeDebug && logBarcodeDebug('snapAndDecode Quagga detected: ' + code);
            statusEl.innerText = `✓ Detected: ${code}`;
            processBarcodeInput(code, statusEl);
          } else {
            statusEl.innerText = 'No barcode detected in photo';
            logBarcodeDebug && logBarcodeDebug('snapAndDecode Quagga no result');
            showManualBarcodeInput(statusEl);
          }
        } finally {
          URL.revokeObjectURL(img.src);
          try { img.remove(); } catch(e) {}
        }
      });
      return;
    }
  } catch (e) {
    logBarcodeDebug && logBarcodeDebug('snapAndDecode Quagga failed: ' + (e && e.message));
  }

  statusEl.innerText = 'Could not decode image';
  showManualBarcodeInput(statusEl);
  URL.revokeObjectURL(img.src);
  try { img.remove(); } catch(e) {}
}

// ZXing-based scanner using BrowserMultiFormatReader (WASM-backed). Fast and accurate.
function startZxingBarcodeDetection(video, statusEl) {
  statusEl.innerText = 'Initializing ZXing scanner...';
  try {
    // Reset previous reader if any
    if (zxingReader && zxingReader.reset) zxingReader.reset();
    const codeReader = new ZXing.BrowserMultiFormatReader();
    zxingReader = codeReader;

    // Use the video element id (already assigned to live stream)
    const videoId = 'videoElement';
    let lastCode = null;
    let lastTime = 0;

    codeReader.decodeFromVideoDevice(null, videoId, (result, err) => {
      if (result) {
        const code = (result && (result.getText ? result.getText() : result.text)) || String(result);
        const now = Date.now();
        // Debounce quickly to avoid duplicates but allow fast repeated scans
        if (code === lastCode && now - lastTime < 200) return;
        lastCode = code;
        lastTime = now;

        // Basic validation: numeric EAN/UPC (6-13) or alphanumeric (6-20)
        const isNumeric = /^[0-9]{6,13}$/.test(code);
        const isAlnum = /^[A-Z0-9\-]{6,20}$/i.test(code);
        if (!(isNumeric || isAlnum)) {
          logBarcodeDebug && logBarcodeDebug('ZXing ignored invalid detection: ' + code);
          return;
        }

        statusEl.innerText = `✓ Detected: ${code}`;
        logBarcodeDebug && logBarcodeDebug('ZXing detected: ' + code);
        processBarcodeInput(code, statusEl);
      } else if (err && !(err instanceof ZXing.NotFoundException)) {
        // NotFoundException is normal when no barcode in frame; ignore it
        logBarcodeDebug && logBarcodeDebug('ZXing error: ' + (err && err.message));
      }
    });

    statusEl.innerText = '📷 Scanning... (point camera at barcode)';
    } catch (e) {
    console.error('startZxingBarcodeDetection error', e);
    statusEl.innerText = 'ZXing scanner unavailable - falling back';
    // Fallback to Quagga or canvas
    if (typeof Quagga !== 'undefined') startQuaggaBarcodeDetection(video, statusEl);
    else startCanvasBarcodeDetection(video, statusEl);
  }
}

// Query device camera capabilities and auto-tune constraints, display in debug log
async function tuneAndDisplayCameraCapabilities(track) {
  if (!track || !track.getCapabilities) {
    logBarcodeDebug && logBarcodeDebug('Device does not support getCapabilities()');
    return;
  }
  
  try {
    const caps = track.getCapabilities();
    const settings = track.getSettings();
    
    // Log capabilities
    let capLog = '📷 Camera Capabilities:';
    capLog += '\n  focusMode: ' + (caps.focusMode ? caps.focusMode.join(', ') : 'N/A');
    capLog += '\n  zoom: ' + (typeof caps.zoom !== 'undefined' ? (caps.zoom.min + '-' + caps.zoom.max) : 'N/A');
    capLog += '\n  torch: ' + (caps.torch ? 'yes' : 'no');
    capLog += '\n  exposureMode: ' + (caps.exposureMode ? caps.exposureMode.join(', ') : 'N/A');
    capLog += '\n  focusDistance: ' + (typeof caps.focusDistance !== 'undefined' ? (caps.focusDistance.min + '-' + caps.focusDistance.max) : 'N/A');
    capLog += '\n  width: ' + (caps.width ? (caps.width.min + '-' + caps.width.max) : 'N/A');
    capLog += '\n  height: ' + (caps.height ? (caps.height.min + '-' + caps.height.max) : 'N/A');
    logBarcodeDebug && logBarcodeDebug(capLog);
    
    // Current settings
    let setLog = '⚙️ Current Settings:';
    setLog += '\n  focusMode: ' + (settings.focusMode || 'N/A');
    setLog += '\n  zoom: ' + (typeof settings.zoom !== 'undefined' ? settings.zoom.toFixed(2) : 'N/A');
    setLog += '\n  torch: ' + (settings.torch ? 'ON' : 'OFF');
    setLog += '\n  exposureMode: ' + (settings.exposureMode || 'N/A');
    setLog += '\n  width x height: ' + (settings.width && settings.height ? settings.width + 'x' + settings.height : 'N/A');
    logBarcodeDebug && logBarcodeDebug(setLog);
    
    // Auto-tune: apply continuous focus/exposure if available, increase resolution if good focus support
    const adv = [];
    
    // Prefer continuous focus
    if (caps.focusMode && caps.focusMode.includes('continuous')) {
      adv.push({ focusMode: 'continuous' });
      logBarcodeDebug && logBarcodeDebug('✅ Applying: focusMode=continuous');
    }
    
    // Try continuous exposure
    if (caps.exposureMode && caps.exposureMode.includes('continuous')) {
      adv.push({ exposureMode: 'continuous' });
      logBarcodeDebug && logBarcodeDebug('✅ Applying: exposureMode=continuous');
    }
    
    // If device supports continuous focus, try higher resolution
    if (caps.focusMode && caps.focusMode.includes('continuous')) {
      const wmax = caps.width ? caps.width.max : 1920;
      const hmax = caps.height ? caps.height.max : 1080;
      if (wmax >= 1280 && hmax >= 720) {
        logBarcodeDebug && logBarcodeDebug('✅ Device supports high-res; upgrading to 1280x720 ideal');
        // Re-apply higher resolution constraint if possible
        try {
          await track.applyConstraints({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } }
          });
          logBarcodeDebug && logBarcodeDebug('✅ Applied higher resolution constraint');
        } catch (e) {
          logBarcodeDebug && logBarcodeDebug('Could not apply higher resolution: ' + (e && e.message));
        }
      }
    }
    
    // Apply focus/exposure tuning
    if (adv.length > 0) {
      try {
        await track.applyConstraints({ advanced: adv });
      } catch (e) {
        logBarcodeDebug && logBarcodeDebug('Could not apply advanced constraints: ' + (e && e.message));
      }
    }
  } catch (e) {
    logBarcodeDebug && logBarcodeDebug('tuneAndDisplayCameraCapabilities error: ' + (e && e.message));
  }
}

// Warm up ZXing on page load to reduce first-scan latency
function warmUpZxing() {
  try {
    if (typeof ZXing === 'undefined' || !ZXing.BrowserMultiFormatReader) return;
    // Create reader and query devices to initialize WASM & codecs
    const reader = new ZXing.BrowserMultiFormatReader();
    zxingReader = reader; // keep for reuse
    reader.getVideoInputDevices().then((devices) => {
      logBarcodeDebug && logBarcodeDebug('ZXing warmed up, video devices: ' + (devices && devices.length));
    }).catch((e) => {
      // ignore errors during warmup
      logBarcodeDebug && logBarcodeDebug('ZXing warmup failed: ' + (e && e.message));
    });
  } catch (e) {
    // ignore
  }
}

function startCanvasBarcodeDetection(video, statusEl) {
  const canvas = document.createElement('canvas');
  // When performing repeated readbacks with getImageData, set willReadFrequently for better performance
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let lastScannedCode = '';
  let lastScanTime = 0;
  
  const detectFromFrame = () => {
    if (video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
      barcodeIntervalId = requestAnimationFrame(detectFromFrame);
      return;
    }
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Simple barcode pattern detection (looks for vertical bars)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Scan for barcode patterns in the middle section
    let barcodeDetected = false;
    const scanRow = Math.floor(canvas.height / 2);
    let barCount = 0;
    let lastWasBar = false;
    
    for (let i = 0; i < canvas.width * 4; i += 4) {
      const idx = (scanRow * canvas.width * 4) + i;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      const isBar = brightness < 128;
      
      if (isBar && !lastWasBar) barCount++;
      lastWasBar = isBar;
    }
    
    // If we detect significant bar patterns, simulate barcode scan
    if (barCount > 10) {
      const now = Date.now();
      // Debounce shorter (300ms) so multiple items can be scanned quickly
      if (now - lastScanTime > 300) {
        lastScanTime = now;
        barcodeDetected = true;
      }
    }
    
    if (barcodeDetected) {
      // In real implementation, use Quagga.js library for actual barcode reading
      statusEl.innerText = '📷 Barcode detected! Please confirm or enter code below.';
      // Show manual entry UI so user can enter/confirm barcode
      logBarcodeDebug && logBarcodeDebug('Canvas heuristic detected barcode (barCount=' + barCount + ')');
      showManualBarcodeInput(statusEl);
    }
    
    barcodeIntervalId = requestAnimationFrame(detectFromFrame);
  };
  
  barcodeIntervalId = requestAnimationFrame(detectFromFrame);
}

// Manual barcode input helpers
function showManualBarcodeInput(statusEl) {
  const container = document.getElementById('barcodeManual');
  const input = document.getElementById('barcodeManualInput');
  const submit = document.getElementById('barcodeManualSubmit');
  const cancel = document.getElementById('barcodeManualCancel');
  if (!container || !input || !submit || !cancel) return;
  container.style.display = 'block';
  input.value = '';
  input.focus();
  const onSubmit = async () => {
    const code = input.value && String(input.value).trim();
    if (!code) return showToast('Enter barcode to add', 'warn');
    hideManualBarcodeInput();
    statusEl.innerText = `Searching for barcode: ${code}...`;
    await processBarcodeInput(code, statusEl);
  };
  const onCancel = () => { hideManualBarcodeInput(); statusEl.innerText = 'Scanning for next item...'; };
  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };
  submit.addEventListener('click', onSubmit);
  cancel.addEventListener('click', onCancel);
  input.addEventListener('keydown', onKeyDown);
  // attach one-time handlers stored on element for cleanup
  container._onSubmit = onSubmit;
  container._onCancel = onCancel;
  container._onKeyDown = onKeyDown;
}

function hideManualBarcodeInput() {
  const container = document.getElementById('barcodeManual');
  const input = document.getElementById('barcodeManualInput');
  const submit = document.getElementById('barcodeManualSubmit');
  const cancel = document.getElementById('barcodeManualCancel');
  if (!container) return;
  container.style.display = 'none';
  if (submit && container._onSubmit) submit.removeEventListener('click', container._onSubmit);
  if (cancel && container._onCancel) cancel.removeEventListener('click', container._onCancel);
  if (input && container._onKeyDown) input.removeEventListener('keydown', container._onKeyDown);
  container._onSubmit = null; container._onCancel = null; container._onKeyDown = null;
  if (input) input.value = '';
}

// Simple logger visible inside scanner modal
function logBarcodeDebug(msg) {
  try {
    const el = document.getElementById('barcodeDebug');
    if (!el) return;
    const time = new Date().toLocaleTimeString();
    el.textContent = `${time} — ${msg}\n` + el.textContent;
    // trim to last 40 lines
    const lines = el.textContent.split('\n');
    if (lines.length > 80) el.textContent = lines.slice(0, 80).join('\n');
  } catch (e) {
    // ignore
  }
}

async function processBarcodeInput(barcode, statusEl) {
  try {
    statusEl.innerText = `Searching for barcode: ${barcode}...`;
    
    // Use cached item lookup (instant, no API call)
    const matchedItem = getItemBySku(barcode);
    
    if (matchedItem) {
      statusEl.innerText = `✅ Found: ${matchedItem.name}`;
      logBarcodeDebug && logBarcodeDebug('Scanned: ' + matchedItem.name + ' (ID: ' + matchedItem.id + ')');
      
      // Context-based action
      const activePage = document.querySelector('.page.active')?.id;
      if (activePage === 'billing') {
        // Billing: set item select and show name in UI, then add to cart
        const itemSelect = document.getElementById('billItemSelect');
        if (itemSelect) {
          itemSelect.value = matchedItem.id;
          // Trigger change event so dependent UI updates
          itemSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
        // Show product name prominently
        const productNameEl = document.getElementById('scannedProductName');
        if (productNameEl) {
          productNameEl.innerText = matchedItem.name;
          productNameEl.style.display = 'block';
        }
        // Auto-add to cart
        await addItemToCartById(matchedItem.id, 1);
        showToast(`✅ ${matchedItem.name} added to cart`, 'success');
      } else if (activePage === 'inventory') {
        // Inventory: open edit modal
        currentEditItemId = matchedItem.id;
        await editItem(matchedItem.id);
        showToast(`Opened ${matchedItem.name} for editing`, 'info');
      }
      
      setTimeout(() => {
        statusEl.innerText = 'Scanning for next item...';
      }, 1500);
    } else {
      // Product not found — offer to create new item
      statusEl.innerText = `❌ Not found. Creating new product...`;
      logBarcodeDebug && logBarcodeDebug('Barcode not found: ' + barcode + ' — showing quick create');
      hideManualBarcodeInput();
      closeBarcodeScanner();
      
      // Determine context for quick-create
      const activePage = document.querySelector('.page.active')?.id;
      const context = activePage === 'billing' ? 'billing' : 'inventory';
      showQuickCreateModal(barcode, context);
    }
  } catch (err) {
    console.error('Barcode processing error:', err);
    statusEl.innerText = 'Error processing barcode';
  }
}

function startQuaggaBarcodeDetection(video, statusEl) {
  statusEl.innerText = 'Initializing barcode scanner...';
  logBarcodeDebug && logBarcodeDebug('startQuaggaBarcodeDetection init');

  // Use QuaggaJS to attach to the live video stream and decode barcodes
  try {
    const config = {
      inputStream: {
        name: 'Live',
        type: 'LiveStream',
        target: document.querySelector('#scannerContainer'),
        constraints: {
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      },
      // Lighter locator & fewer workers to improve responsiveness on phones
      locator: { patchSize: 'small', halfSample: true },
      numOfWorkers: 1,
      decoder: {
        readers: [
          'ean_reader', 'upc_reader', 'code_128_reader'
        ]
      },
      // Avoid full locate pass by default (faster). If detection fails, the code falls
      // back to a more thorough canvas heuristic.
      locate: false
    };

    let lastCode = null;
    let lastTime = 0;

    Quagga.init(config, function(err) {
      if (err) {
        console.error('Quagga init error', err);
        logBarcodeDebug && logBarcodeDebug('Quagga init error: ' + (err && err.message));
        statusEl.innerText = 'Camera failed - using manual input';
        // Fallback to canvas heuristic
        startCanvasBarcodeDetection(video, statusEl);
        return;
      }
      Quagga.start();
      statusEl.innerText = '📷 Scanning... (point camera at barcode)';

      Quagga.onDetected(function(result) {
        try {
          const code = result && result.codeResult && result.codeResult.code;
          if (!code) return;
          const now = Date.now();
          // Debounce duplicate detections quickly (300ms) to allow very fast scanning
          if (code === lastCode && now - lastTime < 300) return;
          lastCode = code;
          lastTime = now;

          // Basic validation: require reasonable length and characters to avoid
          // spurious / random-looking results. Accept common barcode patterns
          // (numeric EAN/UPC 8-13) or short alphanumeric codes (Code128).
          const isNumeric = /^[0-9]{6,13}$/.test(code);
          const isAlnum = /^[A-Z0-9\-]{6,20}$/i.test(code);
          if (!(isNumeric || isAlnum)) {
            logBarcodeDebug && logBarcodeDebug('Ignored invalid detection: ' + code);
            // ignore and continue scanning
            return;
          }

          statusEl.innerText = `✓ Detected: ${code}`;
          logBarcodeDebug && logBarcodeDebug('Quagga detected: ' + code);
          // Process the barcode (adds to cart if matched)
          processBarcodeInput(code, statusEl);
        } catch (e) {
          console.error('Quagga onDetected error', e);
        }
      });

      // Timeout: if no barcode detected in 30 seconds, prompt manual entry
      setTimeout(() => {
        if (statusEl.innerText.includes('Scanning')) {
          statusEl.innerText = 'No barcode detected - enter manually (ESC to close)';
        }
      }, 30000);
    });
  } catch (e) {
    console.error('startQuaggaBarcodeDetection error', e);
    statusEl.innerText = 'Scanner unavailable - using manual input';
    startCanvasBarcodeDetection(video, statusEl);
  }
}

// Voice commands for cart
function setupVoiceCart() {
  const btn = document.getElementById('voiceCartBtn');
  if (!btn) return;
  
  // Check if browser supports speech recognition
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    btn.innerText = '🎤 Voice not supported';
    btn.disabled = true;
    return;
  }
  
  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  
  btn.addEventListener('click', async () => {
    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      recognition.start();
      btn.innerText = '🎤 Listening...';
      btn.disabled = true;
    } catch (e) {
      console.error('Microphone permission denied:', e);
      showToast('Microphone permission denied', 'error');
      btn.innerText = '🎤 Permission denied';
    }
  });
  
  recognition.addEventListener('result', (e) => {
    const transcript = Array.from(e.results)
      .map(result => result[0].transcript)
      .join('').toLowerCase();
    
    // Parse patterns: "add 2 packets of milk" or "remove 1 rice"
    const addMatch = transcript.match(/add\s+(\d+(?:\.\d+)?)\s+(?:packets?|packs?|of\s+)?(.+)/i);
    const removeMatch = transcript.match(/remove\s+(\d+(?:\.\d+)?)\s+(?:packets?|packs?|of\s+)?(.+)/i);
    
    if (addMatch) {
      const [, qty, productName] = addMatch;
      matchAndAddProduct(Number(qty), productName.trim());
    } else if (removeMatch) {
      const [, qty, productName] = removeMatch;
      matchAndRemoveProduct(Number(qty), productName.trim());
    }
    
    btn.innerText = '🎤 Voice';
    btn.disabled = false;
  });
  
  recognition.addEventListener('error', (e) => {
    console.error('Speech recognition error:', e);
    btn.innerText = '🎤 Voice';
    btn.disabled = false;
    showToast('Voice recognition error: ' + e.error, 'error');
  });
  
  recognition.addEventListener('end', () => {
    btn.innerText = '🎤 Voice';
    btn.disabled = false;
  });
}

async function matchAndAddProduct(qty, productName) {
  const items = await getItems();
  const matched = items.find(i => i.name.toLowerCase().includes(productName.toLowerCase()));
  if (matched) {
    const existing = cart.find(c => c.itemId === matched.id);
    if (existing) {
      existing.quantity += qty;
    } else {
      cart.push({ itemId: matched.id, quantity: qty, name: matched.name, unitPrice: Number(matched.pricePerKg || matched.mrp || 0), mrp: (matched.mrp !== undefined && matched.mrp !== null) ? Number(matched.mrp) : null });
    }
    renderCart();
  } else {
    alert(`Product "${productName}" not found`);
  }
}

async function matchAndRemoveProduct(qty, productName) {
  const matched = cart.find(c => c.name.toLowerCase().includes(productName.toLowerCase()));
  if (matched) {
    matched.quantity -= qty;
    if (matched.quantity <= 0) {
      removeFromCart(matched.itemId);
    } else {
      renderCart();
    }
  } else {
    alert(`"${productName}" not in cart`);
  }
}

// Print & Share
async function printBill() {
  if (!lastBillId) return alert('No bill to print');
  let bill = await fetch(`${API_BASE}/bill/${lastBillId}`).then(r => r.json()).catch(() => null);
  if (!bill) return alert('Bill not found');

  // If backend didn't attach store/profile info, fetch it client-side so the printed bill shows header
  if (!bill.store) {
    try {
      const profile = await fetch(`${API_BASE}/profile`).then(r => r.json()).catch(() => ({}));
      if (profile) bill.store = { name: profile.store_name || profile.storeName || 'Vendora', address: profile.store_address || profile.storeAddress || '', phone: profile.phone || '' };
    } catch (e) {
      bill.store = { name: 'Vendora', address: '', phone: '' };
    }
  }

  // Send bill data to main process for printing (ESC/POS)
  try {
    const result = await window.api.printBill(bill);
    if (result && result.success) {
      alert('Print job sent to printer.');
    } else {
      alert('Failed to print bill.');
    }
  } catch (e) {
    alert('Error sending print job: ' + (e && e.message ? e.message : e));
  }
}

function generateBillHtml(bill) {
  const items = JSON.parse(bill.items_json || '[]');
  const itemRows = items.map(item => {
    const itemName = item.name || ('Item #' + item.itemId);
    const unitPrice = Number(item.unitPrice || item.pricePerKg || 0);
    const mrp = item.mrp ? Number(item.mrp) : null;
    const lineTotal = item.quantity * unitPrice;
    const saved = mrp && mrp > 0 ? (mrp - unitPrice) * item.quantity : 0;
    const savedPercent = mrp && mrp > 0 ? Math.round(((mrp - unitPrice) / mrp) * 100) : 0;
    return `<tr>
      <td>${itemName}</td>
      <td>${Number(item.quantity).toFixed(2)}</td>
      <td>₹${Number(unitPrice).toFixed(2)}${mrp ? ` <small style="color:#666">(MRP ₹${Number(mrp).toFixed(2)})</small>` : ''}</td>
      <td>₹${Number(lineTotal).toFixed(2)}</td>
      <td>${saved > 0 ? `<small style="color:green">Saved ₹${Number(saved).toFixed(2)} (${savedPercent}%)</small>` : ''}</td>
    </tr>`;
  }).join('');
  const totalSaved = items.reduce((s, item) => {
    const unitPrice = Number(item.unitPrice || item.pricePerKg || 0);
    const mrp = item.mrp ? Number(item.mrp) : null;
    return s + (mrp && mrp > 0 ? (mrp - unitPrice) * item.quantity : 0);
  }, 0);

  const customerDisplay = bill.customerName || bill.name || (bill.phone ? `Phone: ${bill.phone}` : 'Walk-in');
  // Store/profile info (if provided by backend)
  const store = bill.store || {};
  const storeName = store.name || 'Vendora';
  const storeAddress = store.address || '';
  const storePhone = store.phone || '';

  // Determine due amount from whichever field is present: prefer bill.dueAmount, then bill.due (POST response),
  // then compute from total - paidAmount as a fallback.
  const computedPaid = Number(bill.paidAmount || 0);
  const computedDue = Number(typeof bill.dueAmount !== 'undefined' ? bill.dueAmount : (typeof bill.due !== 'undefined' ? bill.due : (Number(bill.total || 0) - computedPaid)));

  // Receipt-style narrow layout similar to screenshot
  return `
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Bill #${bill.id}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;padding:8px;color:#111;}
        .receipt{max-width:400px;margin:0 auto;}
        .center{text-align:center}
        .muted{color:#666;font-size:12px}
        .items{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
        .items th{border-bottom:1px dashed #999;padding:6px 0;text-align:left}
        .items td{padding:6px 0;border-bottom:1px dotted #eee}
        .right{text-align:right}
        .totals{margin-top:8px;font-size:14px}
        .totals .line{display:flex;justify-content:space-between;padding:3px 0}
        .big{font-weight:bold;font-size:16px}
        hr.sep{border:none;border-top:1px dashed #bbb;margin:8px 0}
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="center">
          <div style="font-size:18px;font-weight:700">${storeName}</div>
          ${storeAddress ? `<div class="muted">${storeAddress}</div>` : ''}
          ${storePhone ? `<div class="muted">Phone: ${storePhone}</div>` : ''}
        </div>

        <hr class="sep" />
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <div><strong>Bill No:</strong> ${bill.id}</div>
          <div><strong>Date:</strong> ${new Date(bill.created_at).toLocaleDateString()}</div>
        </div>

        <table class="items">
          <thead>
            <tr>
              <th style="width:6%">SN</th>
              <th style="width:54%">Item</th>
              <th style="width:12%" class="right">Qty</th>
              <th style="width:14%" class="right">Price</th>
              <th style="width:14%" class="right">Amt</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((it, idx) => {
              const name = (it.name || ('Item #' + it.itemId)).substring(0, 30);
              const qty = Number(it.quantity || 0);
              const unit = Number(it.unitPrice || it.pricePerKg || 0).toFixed(2);
              const amt = (qty * Number(unit)).toFixed(2);
              return `<tr><td>${idx+1}</td><td>${name}</td><td class="right">${qty}</td><td class="right">₹${Number(unit).toFixed(2)}</td><td class="right">₹${amt}</td></tr>`;
            }).join('')}
          </tbody>
        </table>

        <div class="totals">
          <div class="line"><div>Subtotal</div><div>₹${Number(bill.subtotal||0).toFixed(2)}</div></div>
          <div class="line"><div>Discount</div><div>₹${Number(bill.discount||0).toFixed(2)}</div></div>
          ${Number(totalSaved) > 0 ? `<div class="line"><div>Saved (vs MRP)</div><div>₹${Number(totalSaved).toFixed(2)}</div></div>` : ''}
          <hr />
          <div class="line big"><div>TOTAL</div><div>₹${Number(bill.total||0).toFixed(2)}</div></div>
          ${computedDue && Number(computedDue) > 0 ? `<div class="line" style="color:#d00;font-weight:700"><div>Due</div><div>₹${Number(computedDue).toFixed(2)}</div></div>` : ''}
          <div class="line"><div>Paid</div><div>₹${Number(computedPaid || 0).toFixed(2)}</div></div>
          ${Number(computedPaid || 0) > Number(bill.total || 0) ? `<div class="line"><div>Change</div><div>₹${Number((computedPaid - Number(bill.total || 0))).toFixed(2)}</div></div>` : ''}
          <div class="line"><div>Payment</div><div>${(bill.payment_method || '').toString().toUpperCase() || 'CASH'}</div></div>
        </div>

        <div class="center muted" style="margin-top:14px">Thank You</div>
      </div>
    </body>
    </html>
  `;
}

function shareBill() {
  if (!lastBillId) return alert('No bill to share');
  (async () => {
    try {
      const resp = await fetch(`${API_BASE}/share/bill/${lastBillId}`);
      if (!resp.ok) {
        showToast('Failed to prepare bill for sharing', 'error');
        return;
      }
      const res = await resp.json();
      if (res && res.text) {
        // Offer options: open WhatsApp, open SMS, copy to clipboard
        const action = prompt('Share Bill - type: whatsapp | sms | copy (default: whatsapp)', 'whatsapp');
        if (!action) return;
        const act = action.toLowerCase().trim();
        if (act === 'whatsapp') {
          window.open(res.whatsappUrl, '_blank');
        } else if (act === 'sms') {
          window.open(res.smsUrl);
        } else if (act === 'copy') {
          try { 
            await navigator.clipboard.writeText(res.text); 
            showToast('Message copied to clipboard', 'success'); 
          } catch (e) { 
            alert(res.text); 
          }
        } else {
          // fallback: open WhatsApp
          window.open(res.whatsappUrl, '_blank');
        }
      } else {
        showToast('Could not prepare share message', 'error');
      }
    } catch (e) {
      console.error('shareBill error', e);
      showToast('Error preparing share: ' + e.message, 'error');
    }
  })();
}

// Share a stock alert for a given item id
async function shareStockAlert(itemId) {
  try {
    const resp = await fetch(`${API_BASE}/share/stock-alert/${itemId}`);
    if (!resp.ok) {
      showToast('Failed to prepare stock alert', 'error');
      return;
    }
    const res = await resp.json();
    if (!res || !res.text) {
      showToast('Could not prepare alert', 'error');
      return;
    }

    const action = prompt('Share stock alert - type: whatsapp | sms | copy (default: whatsapp)', 'whatsapp');
    if (!action) return;
    const act = action.toLowerCase().trim();
    if (act === 'whatsapp') {
      window.open(res.whatsappUrl, '_blank');
    } else if (act === 'sms') {
      window.open(res.smsUrl);
    } else if (act === 'copy') { 
      try { 
        await navigator.clipboard.writeText(res.text); 
        showToast('Alert copied to clipboard', 'success'); 
      } catch (e) { 
        alert(res.text); 
      } 
    } else {
      window.open(res.whatsappUrl, '_blank');
    }
  } catch (e) {
    console.error('shareStockAlert error', e);
    showToast('Failed to prepare share: ' + e.message, 'error');
  }
}

// ===== RETURNS SYSTEM =====

function openReturnModal() {
  document.getElementById('returnModal').style.display = 'flex';
  document.getElementById('returnForm').reset();
  document.getElementById('returnItemSelect').innerHTML = '<option value="">Select item from bill...</option>';
  document.getElementById('refundPreview').innerText = '₹0.00';
}

function closeReturnModal() {
  document.getElementById('returnModal').style.display = 'none';
}

async function loadBillItemsForReturn() {
  const billId = Number(document.getElementById('returnBillId').value);
  if (!billId) {
    showToast('Enter a bill ID first', 'warn');
    return;
  }

  try {
    const bill = await fetch(`${API_BASE}/bill/${billId}`).then(r => r.json());
    if (!bill || !bill.items) {
      showToast('Bill not found', 'error');
      return;
    }

    const items = bill.items || [];
    const select = document.getElementById('returnItemSelect');
    select.innerHTML = '<option value="">Select item from bill...</option>';
    
    items.forEach((item, idx) => {
      const label = `${item.name || 'Item ' + item.itemId} (Qty: ${item.quantity}, Price: ₹${item.unitPrice})`;
      const opt = document.createElement('option');
      opt.value = JSON.stringify({ itemId: item.itemId, unitPrice: item.unitPrice, name: item.name });
      opt.textContent = label;
      select.appendChild(opt);
    });

    if (items.length === 0) {
      showToast('No items in this bill', 'info');
    }
  } catch (e) {
    console.error('loadBillItemsForReturn error', e);
    showToast('Failed to load bill items', 'error');
  }
}

function updateRefundPreview() {
  const itemStr = document.getElementById('returnItemSelect').value;
  const qty = Number(document.getElementById('returnQuantity').value) || 0;
  
  if (!itemStr || !qty) {
    document.getElementById('refundPreview').innerText = '₹0.00';
    return;
  }

  try {
    const item = JSON.parse(itemStr);
    const refund = (item.unitPrice * qty).toFixed(2);
    document.getElementById('refundPreview').innerText = '₹' + refund;
  } catch (e) {
    document.getElementById('refundPreview').innerText = '₹0.00';
  }
}

async function submitReturn() {
  const billId = Number(document.getElementById('returnBillId').value);
  const itemStr = document.getElementById('returnItemSelect').value;
  const qty = Number(document.getElementById('returnQuantity').value);
  const reason = document.getElementById('returnReason').value || '';

  if (!billId || !itemStr || !qty || qty <= 0) {
    showToast('Please fill all required fields', 'warn');
    return;
  }

  try {
    const item = JSON.parse(itemStr);
    const payload = {
      billId,
      customerId: null,
      itemId: item.itemId,
      quantityReturned: qty,
      reason
    };

    const res = await fetch(`${API_BASE}/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(r => r.json());

    if (res && res.success) {
      const msg = `✓ Return created! ${res.itemName} × ${res.quantityReturned} — Refund: ₹${res.refundAmount}. New stock: ${res.newStock}`;
      showToast(msg, 'success');
      closeReturnModal();
      loadReturns();
    } else {
      showToast('Failed to create return: ' + (res && res.error), 'error');
    }
  } catch (e) {
    console.error('submitReturn error', e);
    showToast('Error creating return: ' + e.message, 'error');
  }
}

async function loadReturns() {
  try {
    const res = await fetch(`${API_BASE}/returns`).then(r => r.json());
    const tbody = document.getElementById('returnsBody');
    if (!tbody) return; // returns section not loaded

    if (!res || !res.returns || res.returns.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999">No returns yet</td></tr>';
      return;
    }

    const rows = res.returns.map(r => `
      <tr>
        <td>${r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
        <td>#${r.billId || '?'}</td>
        <td>${r.itemName || '?'}</td>
        <td>${Number(r.quantityReturned).toFixed(2)}</td>
        <td>₹${Number(r.refundAmount).toFixed(2)}</td>
        <td>${r.reason || '—'}</td>
      </tr>
    `).join('');

    tbody.innerHTML = rows;
  } catch (e) {
    console.error('loadReturns error', e);
    const tbody = document.getElementById('returnsBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#f88">Failed to load returns</td></tr>';
  }
}

// ===== PURCHASES MODULE =====
let currentEditSupplierId = null;

async function loadPurchases() {
  const suppliers = await getSuppliers();
  const items = await getItems();
  const purchases = await fetch(`${API_BASE}/purchases`).then(r => r.json());
  
  // Populate dropdowns
  const supplierSelect = document.getElementById('purchaseSupplier');
  const itemSelect = document.getElementById('purchaseItem');
  const filterSelect = document.getElementById('purchaseFilterItem');
  
  supplierSelect.innerHTML = '<option value="">Select supplier...</option>';
  suppliers.forEach(s => {
    supplierSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`;
  });
  
  itemSelect.innerHTML = '<option value="">Select product...</option>';
  items.forEach(i => {
    itemSelect.innerHTML += `<option value="${i.id}">${i.name}</option>`;
  });
  
  filterSelect.innerHTML = '<option value="">All products</option>';
  items.forEach(i => {
    filterSelect.innerHTML += `<option value="${i.id}">${i.name}</option>`;
  });
  
  // Set default purchase date to today
  document.getElementById('purchaseDate').valueAsDate = new Date();
  
  // Load purchase history
  renderPurchaseList(purchases);
  renderSuppliersList(suppliers);
  loadPurchaseSummary();
}

function renderPurchaseList(purchases) {
  const tbody = document.getElementById('purchasesBody');
  
  if (!purchases || purchases.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;">No purchases recorded yet</td></tr>';
    return;
  }
  
  tbody.innerHTML = purchases.map(p => `
    <tr>
      <td>${new Date(p.created_at).toLocaleDateString()}</td>
      <td>${p.itemName || 'Unknown'}</td>
      <td>${p.supplierName || 'Unknown'}</td>
      <td>${Number(p.quantity).toFixed(2)}</td>
      <td>₹${Number(p.costPerUnit).toFixed(2)}</td>
      <td>₹${Number(p.totalCost).toFixed(2)}</td>
      <td>
        <button class="btn-small" onclick="editPurchase(${p.id})">Edit</button>
        <button class="btn-small btn-danger" onclick="deletePurchase(${p.id})">Delete</button>
      </td>
    </tr>
  `).join('');
}

function renderSuppliersList(suppliers) {
  const container = document.getElementById('suppliersList');
  
  if (!suppliers || suppliers.length === 0) {
    container.innerHTML = '<p style="color:#999;">No suppliers yet. Add your first supplier above.</p>';
    return;
  }
  
  container.innerHTML = '<div class="suppliers-cards">' + suppliers.map(s => `
    <div class="supplier-card">
      <div class="supplier-name">${s.name}</div>
      <div class="supplier-contact">
        ${s.phone ? `📱 ${s.phone}` : ''}
        ${s.email ? `<br>📧 ${s.email}` : ''}
      </div>
      <div class="supplier-actions" style="margin-top:8px;">
        <button class="btn-small" onclick="editSupplier(${s.id}, '${s.name}', '${s.phone || ''}', '${s.email || ''}', '${s.address || ''}', '${s.notes || ''}')">Edit</button>
        <button class="btn-small btn-danger" onclick="deleteSupplier(${s.id})">Delete</button>
      </div>
    </div>
  `).join('') + '</div>';
}

async function loadPurchaseSummary() {
  try {
    const weekSummary = await fetch(`${API_BASE}/purchases/summary?period=week`).then(r => r.json());
    const monthSummary = await fetch(`${API_BASE}/purchases/summary?period=month`).then(r => r.json());
    
    document.getElementById('summaryWeek').innerText = `₹${weekSummary.totalSpent.toFixed(2)} (${weekSummary.purchaseCount} orders)`;
    document.getElementById('summaryMonth').innerText = `₹${monthSummary.totalSpent.toFixed(2)} (${monthSummary.purchaseCount} orders)`;
  } catch (e) {
    console.error('Error loading purchase summary:', e);
  }
}

// ===== SETTINGS =====
async function loadSettings() {
  try {
    const profile = await fetch(`${API_BASE}/profile`).then(r => r.json());
    document.getElementById('profileOwner').value = profile.owner_name || '';
    document.getElementById('profileStore').value = profile.store_name || '';
    document.getElementById('profileAddress').value = profile.store_address || '';
    document.getElementById('profilePhone').value = profile.phone || '';
    document.getElementById('profileEmail').value = profile.email || '';

    const planObj = await fetch(`${API_BASE}/subscription`).then(r => r.json());
    document.getElementById('currentPlan').innerText = planObj.plan || 'free';

    await loadStores();
  } catch (e) {
    console.error('Failed to load settings', e);
  }
}

async function saveProfileHandler(e) {
  e.preventDefault();
  const payload = {
    owner_name: document.getElementById('profileOwner').value.trim(),
    store_name: document.getElementById('profileStore').value.trim(),
    store_address: document.getElementById('profileAddress').value.trim(),
    phone: document.getElementById('profilePhone').value.trim(),
    email: document.getElementById('profileEmail').value.trim()
  };
  const res = await mainApi.settings.saveProfile(payload);
  if (res && res.success) alert('Profile saved');
  else alert('Failed to save profile');
}

async function loadStores() {
  const stores = await mainApi.settings.stores();
  const container = document.getElementById('storesList');
  if (!stores || stores.length === 0) {
    container.innerHTML = '<p style="color:#999;">No stores configured.</p>';
    return;
  }
  container.innerHTML = '<div class="stores-grid">' + stores.map(s => `
    <div class="store-card">
      <div><strong>${s.name}</strong> ${s.is_primary ? '<small>(primary)</small>' : ''}</div>
      <div style="color:#555">${s.address || ''} ${s.city ? ', ' + s.city : ''}</div>
      <div style="margin-top:8px;display:flex;gap:6px;">
        <button class="btn-small" onclick="editStore(${s.id})">Edit</button>
        <button class="btn-small btn-danger" onclick="deleteStore(${s.id})">Delete</button>
      </div>
    </div>
  `).join('') + '</div>';
}

window.editStore = async function(id) {
  const stores = await mainApi.settings.stores();
  const s = stores.find(x=>x.id===id);
  if (!s) return alert('Store not found');
  const name = prompt('Store name', s.name);
  if (name === null) return;
  const address = prompt('Address', s.address || '');
  if (address === null) return;
  const city = prompt('City', s.city || '');
  if (city === null) return;
  const phone = prompt('Phone', s.phone || '');
  if (phone === null) return;
  const is_primary = confirm('Make primary store? (OK = yes)');
  const res = await mainApi.settings.updateStore(id, { name, address, city, phone, is_primary });
  if (res && res.success) loadStores(); else alert('Failed to update store');
}

window.deleteStore = async function(id) {
  if (!confirm('Delete this store?')) return;
  const res = await mainApi.settings.deleteStore(id);
  if (res && res.success) loadStores(); else alert('Failed to delete store');
}

document.getElementById('addStoreBtn')?.addEventListener('click', async () => {
  const name = prompt('Store name'); if (!name) return;
  const address = prompt('Address') || '';
  const city = prompt('City') || '';
  const phone = prompt('Phone') || '';
  const is_primary = confirm('Make primary store? (OK = yes)');
  const res = await mainApi.settings.addStore({ name, address, city, phone, is_primary });
  if (res && res.success) loadStores(); else alert('Failed to add store');
});

document.getElementById('refreshStoresBtn')?.addEventListener('click', loadStores);

document.getElementById('profileForm')?.addEventListener('submit', saveProfileHandler);

document.getElementById('upgradeBtn')?.addEventListener('click', async () => {
  const res = await mainApi.settings.setSubscription('pro');
  if (res && res.success) document.getElementById('currentPlan').innerText = 'pro';
});

document.getElementById('downgradeBtn')?.addEventListener('click', async () => {
  const res = await mainApi.settings.setSubscription('free');
  if (res && res.success) document.getElementById('currentPlan').innerText = 'free';
});

document.getElementById('purchaseForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const supplier = document.getElementById('purchaseSupplier').value;
  const item = document.getElementById('purchaseItem').value;
  const qty = parseFloat(document.getElementById('purchaseQty').value);
  const cost = parseFloat(document.getElementById('purchaseCost').value);
  const date = document.getElementById('purchaseDate').value;
  const notes = document.getElementById('purchaseNotes').value;
  
  if (!supplier || !item || !qty || !cost) {
    return alert('Please fill all required fields');
  }
  
  try {
    const result = await mainApi.purchase({
      itemId: parseInt(item),
      supplierId: parseInt(supplier),
      quantity: qty,
      costPerUnit: cost,
      purchaseDate: date,
      notes
    });
    
    if (result.success) {
      alert(result.message || 'Purchase recorded successfully!');
      document.getElementById('purchaseForm').reset();
      document.getElementById('purchaseDate').valueAsDate = new Date();
      loadPurchases(); // Refresh the list
    } else {
      alert('Error: ' + (result.error || 'Failed to record purchase'));
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
});

async function editPurchase(purchaseId) {
  // Open edit modal and populate with purchase data
  const purchases = await getPurchases();
  const p = purchases.find(x => x.id === purchaseId);
  if (!p) return alert('Purchase not found');

  window.currentEditPurchaseId = purchaseId;
  document.getElementById('editPurchaseQty').value = Number(p.quantity).toFixed(2);
  document.getElementById('editPurchaseCost').value = Number(p.costPerUnit).toFixed(2);
  if (p.purchaseDate) document.getElementById('editPurchaseDate').value = p.purchaseDate.split('T')[0] || p.purchaseDate;
  document.getElementById('editPurchaseNotes').value = p.notes || '';
  document.getElementById('purchaseModal').style.display = 'block';
}

async function deletePurchase(purchaseId) {
  if (!confirm('Delete this purchase record? Stock will be decremented.')) return;
  
  try {
    const result = await fetch(`${API_BASE}/purchase/${purchaseId}`, { method: 'DELETE' }).then(r => r.json());
    
    if (result.success) {
      alert(result.message || 'Purchase deleted');
      loadPurchases();
    } else {
      alert('Error: ' + (result.error || 'Failed to delete'));
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

document.getElementById('addSupplierBtn')?.addEventListener('click', showAddSupplierModal);
document.getElementById('newSupplierBtn')?.addEventListener('click', showAddSupplierModal);

function showAddSupplierModal() {
  currentEditSupplierId = null;
  document.getElementById('supplierModalTitle').innerText = 'Add Supplier';
  document.getElementById('supplierForm').reset();
  document.getElementById('supplierModal').style.display = 'block';
}

function editSupplier(id, name, phone, email, address, notes) {
  currentEditSupplierId = id;
  document.getElementById('supplierModalTitle').innerText = 'Edit Supplier';
  document.getElementById('supplierName').value = name;
  document.getElementById('supplierPhone').value = phone;
  document.getElementById('supplierEmail').value = email;
  document.getElementById('supplierAddress').value = address;
  document.getElementById('supplierNotes').value = notes;
  document.getElementById('supplierModal').style.display = 'block';
}

document.getElementById('supplierForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const payload = {
    name: document.getElementById('supplierName').value,
    phone: document.getElementById('supplierPhone').value,
    email: document.getElementById('supplierEmail').value,
    address: document.getElementById('supplierAddress').value,
    notes: document.getElementById('supplierNotes').value
  };
  
  try {
    const result = currentEditSupplierId 
      ? await mainApi.updateSupplier(currentEditSupplierId, payload)
      : await mainApi.addSupplier(payload);
    
    if (result.success) {
      alert('Supplier saved successfully!');
      document.getElementById('supplierModal').style.display = 'none';
      loadPurchases();
    } else {
      alert('Error: ' + (result.error || 'Failed to save supplier'));
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
});

async function deleteSupplier(supplierId) {
  if (!confirm('Delete this supplier?')) return;
  
  try {
    const result = await mainApi.deleteSupplier(supplierId);
    if (result.success) {
      alert('Supplier deleted');
      loadPurchases();
    } else {
      alert('Error: ' + (result.error || 'Failed to delete'));
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

document.getElementById('purchaseFilterItem')?.addEventListener('change', async (e) => {
  const itemId = e.target.value;
  const purchases = await getPurchases(itemId);
  renderPurchaseList(purchases);
});

// Modal close handlers for supplier modal
document.addEventListener('click', (e) => {
  if (e.target.id === 'supplierModal') {
    document.getElementById('supplierModal').style.display = 'none';
  }
  if (e.target.classList.contains('modal-close') && e.target.closest('#supplierModal')) {
    document.getElementById('supplierModal').style.display = 'none';
  }
});

document.getElementById('supplierCancelBtn')?.addEventListener('click', () => {
  document.getElementById('supplierModal').style.display = 'none';
});


















// ===== QUICK CREATE MODAL (for unknown barcodes) =====
let quickCreateContext = 'billing'; // 'billing' or 'inventory'

function showQuickCreateModal(barcode, context = 'billing') {
  quickCreateContext = context;
  const modal = document.getElementById('quickCreateModal');
  if (!modal) return;
  const headerEl = modal.querySelector('.modal-header h2');
  if (headerEl) {
    headerEl.innerText = context === 'billing' 
      ? '📱 Create Product & Add to Cart' 
      : '📦 Create Product & Add to Inventory';
  }
  document.getElementById('qcSku').value = barcode || '';
  document.getElementById('qcName').value = '';
  document.getElementById('qcPrice').value = '';
  document.getElementById('qcMrp').value = '';
  document.getElementById('qcType').value = 'loose';
  document.getElementById('qcQty').value = context === 'inventory' ? '10' : '1';
  modal.classList.add('show');
  document.getElementById('qcName').focus();
}

function closeQuickCreateModal() {
  const modal = document.getElementById('quickCreateModal');
  if (modal) modal.classList.remove('show');
}

async function saveQuickCreateItem() {
  const sku = document.getElementById('qcSku').value.trim();
  const name = document.getElementById('qcName').value.trim();
  const price = Number(document.getElementById('qcPrice').value || 0);
  const mrp = Number(document.getElementById('qcMrp').value || 0);
  const type = document.getElementById('qcType').value;
  const qty = Number(document.getElementById('qcQty').value || 1);

  if (!name || price <= 0) {
    return showToast('Enter product name and price', 'error');
  }

  try {
    const itemData = {
      name,
      sku: sku || null,
      pricePerKg: price,
      mrp: mrp || price,
      type: type || 'loose',
      quantity: qty,
      reorderThreshold: 5
    };

    const res = await fetch(`${API_BASE}/item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(itemData)
    }).then(r => r.json());

    if (res && res.id) {
      closeQuickCreateModal();
      showToast(`✅ Product created: ${name}`, 'success');
      logBarcodeDebug && logBarcodeDebug('Quick create saved: ' + name + ' (SKU: ' + sku + ', context: ' + quickCreateContext + ')');
      
      // Update cache immediately so next scan is fast
      const newItem = { ...itemData, id: res.id };
      cachedItems.push(newItem);
      buildItemIndices();
      
      // Context-based post-save action
      if (quickCreateContext === 'billing') {
        // Add to cart and refresh billing
        await addItemToCartById(res.id, 1);
        showToast(`Added ${name} to cart`, 'success');
      } else if (quickCreateContext === 'inventory') {
        // Reload inventory to show new product
        loadInventory();
        showToast(`Added ${name} to inventory`, 'success');
      }
    } else {
      showToast('Error creating product', 'error');
    }
  } catch (err) {
    console.error('saveQuickCreateItem error:', err);
    showToast('Error: ' + err.message, 'error');
  }
}

// ===== KEYBOARD HANDLERS =====
// Close modals with ESC key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // Close any open modal
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
      if (modal.classList.contains('show')) {
        modal.classList.remove('show');
      }
    });
  }
});

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async () => {
  setupLoginForm();
  if (!await validateToken()) {
    showLoginModal();
    return;
  }

  setupNavigation();
  
  // Dashboard - Setup filter buttons
  document.getElementById('applyFilters')?.addEventListener('click', () => {
    const filters = getDashboardFilters();
    loadDashboard(filters);
  });
  document.getElementById('resetFilters')?.addEventListener('click', () => {
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    document.getElementById('paymentMethodFilter').value = '';
    document.getElementById('categoryFilter').value = '';
    document.getElementById('staffNameFilter').value = '';
    loadDashboard();
  });
  populateStaffFilter();
  populateCategoryFilter();
  
  // Inventory
  document.getElementById('addItemBtn').addEventListener('click', showAddItemModal);
  document.getElementById('inventoryScannerBtn')?.addEventListener('click', openInventoryBarcodeScanner);
  document.getElementById('importCsvBtn')?.addEventListener('click', openCsvImportModal);
  // Populate supplier dropdown for modal when opening add/edit
  mainApi.suppliers().then(suppliers => {
    const sel = document.getElementById('modalSupplier');
    if (!sel) return;
    sel.innerHTML = '<option value="">Select supplier...</option>' + suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  }).catch(() => {});
  document.getElementById('searchInput').addEventListener('input', (e) => performSearch(e.target.value));
  
  // Detect barcode scanner input (usually rapid text + Enter key)
  // Barcode scanners typically append a newline after the barcode
  document.getElementById('searchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const searchVal = (e.target.value || '').trim();
      if (searchVal.length >= 5) { // Typical barcode length
        performSearch(searchVal);
        // Keep the search value visible
      }
    }
  });
  setupVoiceSearch();
  document.getElementById('itemForm').addEventListener('submit', (e) => {
    e.preventDefault();
    saveItem();
  });
  // Also attach click handler to Save button (fallback)
  const saveBtn = document.getElementById('modalSaveBtn');
  if (saveBtn) saveBtn.addEventListener('click', (e) => { e.preventDefault(); saveItem(); });
  document.querySelector('.modal-close').addEventListener('click', closeModal);
  document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
  
  // Billing
  document.getElementById('addToCartBtn').addEventListener('click', addToCart);
  document.getElementById('openBarcodeScanner').addEventListener('click', openBarcodeScanner);
  document.getElementById('clearCartBtn').addEventListener('click', clearCart);
  document.getElementById('searchCustomerBtn').addEventListener('click', searchCustomer);
  document.getElementById('generateBillBtn').addEventListener('click', generateBill);
  document.getElementById('printBillBtn').addEventListener('click', printBill);
  document.getElementById('shareBillBtn').addEventListener('click', shareBill);
  document.getElementById('loyaltyDiscount').addEventListener('input', updateBillTotals);
  document.getElementById('amountPaidInput')?.addEventListener('input', updateBillTotals);
  document.getElementById('applyLoyaltyBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (!currentCustomer) return showToast('No customer selected', 'warn');
    const available = Number(currentCustomer.loyalty_points || 0);
    if (available <= 0) return showToast('Customer has no points', 'warn');
    // Fill the loyalty input with available points (capped)
    document.getElementById('loyaltyDiscount').value = Math.floor(available);
    updateBillTotals();
    showToast(`Applied ${Math.floor(available)} points`, 'success');
  });

  // Returns System
  document.getElementById('openReturnModalBtn')?.addEventListener('click', openReturnModal);
  document.getElementById('returnBillId')?.addEventListener('change', loadBillItemsForReturn);
  document.getElementById('returnItemSelect')?.addEventListener('change', updateRefundPreview);
  document.getElementById('returnQuantity')?.addEventListener('input', updateRefundPreview);

  setupVoiceCart();
  
  // Purchases
  // Will be loaded when Purchases tab is clicked (in setupNavigation)
  
  // Expenses
  document.getElementById('expenseForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveExpense();
  });
  document.getElementById('expenseCategoryFilter')?.addEventListener('change', filterExpenses);
  document.getElementById('expenseSearch')?.addEventListener('input', filterExpenses);
  
  // Initial load
  loadDashboard();
  setupChat();
  setupBarcodeInput();
  // Warm up ZXing reader for faster first scan
  warmUpZxing();
});

// ===== AI CHAT UI =====
function setupChat() {
  const openBtn = document.getElementById('chatOpenBtn');
  const modal = document.getElementById('chatModal');
  const closeBtn = document.getElementById('chatCloseBtn');
  const sendBtn = document.getElementById('chatSendBtn');
  const input = document.getElementById('chatInput');

  openBtn?.addEventListener('click', () => { modal.style.display = 'flex'; input.focus(); });
  closeBtn?.addEventListener('click', () => { modal.style.display = 'none'; });
  document.getElementById('chatModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('chatModal')) document.getElementById('chatModal').style.display = 'none';
  });

  sendBtn?.addEventListener('click', () => sendChat());
  input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
}

function renderChatMessage(text, who='bot') {
  const body = document.getElementById('chatBody');
  const el = document.createElement('div');
  el.className = `chat-message ${who}`;
  el.innerText = text;
  body.appendChild(el);
  body.scrollTop = body.scrollHeight;
}

async function sendChat() {
  const input = document.getElementById('chatInput');
  const q = (input.value || '').trim();
  if (!q) return;
  renderChatMessage(q, 'user');
  input.value = '';
  renderChatMessage('Thinking...', 'bot');
  try {
    const res = await mainApi.ai.query(q);
    // remove the 'Thinking...' placeholder
    const body = document.getElementById('chatBody');
    const placeholders = body.querySelectorAll('.chat-message.bot');
    if (placeholders.length) placeholders[placeholders.length-1].remove();

    if (res && res.answer) {
      renderChatMessage(res.answer, 'bot');
    } else if (res && res.error) {
      renderChatMessage('Error: ' + res.error, 'bot');
    } else {
      renderChatMessage('Sorry, I do not have an answer for that.', 'bot');
    }
  } catch (e) {
    renderChatMessage('Error: ' + e.message, 'bot');
  }
}

// Handle purchase edit form
document.getElementById('purchaseEditForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = window.currentEditPurchaseId;
  if (!id) return alert('No purchase selected');
  const qty = parseFloat(document.getElementById('editPurchaseQty').value);
  const cost = parseFloat(document.getElementById('editPurchaseCost').value);
  const date = document.getElementById('editPurchaseDate').value;
  const notes = document.getElementById('editPurchaseNotes').value;

  if (!qty || isNaN(cost)) return alert('Quantity and cost are required');

  try {
    const res = await fetch(`${API_BASE}/purchase/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: qty, costPerUnit: cost, purchaseDate: date, notes })
    }).then(r => r.json());

    if (res.success) {
      alert(res.message || 'Purchase updated');
      document.getElementById('purchaseModal').style.display = 'none';
      loadPurchases();
    } else {
      alert('Error: ' + (res.error || 'Failed to update'));
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
});

document.getElementById('editPurchaseCancel')?.addEventListener('click', () => {
  document.getElementById('purchaseModal').style.display = 'none';
});

// ===== KEYBOARD SHORTCUTS =====
const KEYBOARD_SHORTCUTS = {
  'alt+shift+h': { page: null, desc: 'Help — Show all shortcuts', action: () => showShortcutsHelp() },
  'alt+d': { page: 'dashboard', desc: 'Dashboard', action: () => showPage('dashboard') },
  'alt+i': { page: 'inventory', desc: 'Inventory', action: () => showPage('inventory') },
  'alt+p': { page: 'predictions', desc: 'Predictions', action: () => showPage('predictions') },
  'alt+b': { page: 'billing', desc: 'Billing', action: () => showPage('billing') },
  'alt+u': { page: 'purchases', desc: 'Purchases', action: () => showPage('purchases') },
  'alt+e': { page: 'expenses', desc: 'Expenses', action: () => showPage('expenses') },
  'alt+r': { page: 'reports', desc: 'Reports', action: () => showPage('reports') },
  'alt+s': { page: 'settings', desc: 'Settings', action: () => showPage('settings') },
  'alt+g': { page: 'billing', desc: 'Generate Bill', action: () => { showPage('billing'); setTimeout(() => document.getElementById('generateBillBtn')?.click(), 100); } },
  'alt+c': { page: 'billing', desc: 'Clear Cart', action: () => { showPage('billing'); setTimeout(() => document.getElementById('clearCartBtn')?.click(), 100); } },
  'alt+plus': { page: 'inventory', desc: 'Add Product', action: () => { showPage('inventory'); setTimeout(() => document.getElementById('addItemBtn')?.click(), 100); } },
  'alt+q': { page: null, desc: 'Quick Search (Inventory)', action: () => { showPage('inventory'); setTimeout(() => document.getElementById('searchInput')?.focus(), 100); } }
};

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Build shortcut key (e.g., "alt+g", "ctrl+s")
    const mods = [];
    if (e.ctrlKey) mods.push('ctrl');
    if (e.shiftKey) mods.push('shift');
    if (e.altKey) mods.push('alt');
    if (e.metaKey) mods.push('meta');
    
    // Get key name (handle special keys)
    let keyName = (typeof e.key === 'string') ? e.key.toLowerCase() : '';
    if (keyName === '+') keyName = 'plus';
    else if (keyName === '=') keyName = 'plus'; // = key also triggers +
    else if (keyName === '-') keyName = 'minus';
    
    const fullKey = mods.length > 0 ? mods.join('+') + '+' + keyName : keyName;
    
    // Check if it matches a shortcut
    if (KEYBOARD_SHORTCUTS[fullKey]) {
      e.preventDefault();
      KEYBOARD_SHORTCUTS[fullKey].action();
    }
  });
}

function showShortcutsHelp() {
  const shortcuts = Object.entries(KEYBOARD_SHORTCUTS).map(([key, val]) => {
    return { key: key.toUpperCase(), desc: val.desc };
  });

  const html = `
    <div style="max-height: 400px; overflow-y: auto;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="background: rgba(157,93,255,.1); border-bottom: 1px solid rgba(0,0,0,.1);">
            <th style="padding: 8px; text-align: left;"><strong>Shortcut</strong></th>
            <th style="padding: 8px; text-align: left;"><strong>Action</strong></th>
          </tr>
        </thead>
        <tbody>
          ${shortcuts.map(s => `
            <tr style="border-bottom: 1px solid rgba(0,0,0,.05);">
              <td style="padding: 8px; font-family: monospace; color: #9d5dff; font-weight: bold;">${s.key}</td>
              <td style="padding: 8px;">${s.desc}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div style="margin-top: 12px; color: #999; font-size: 12px;">
      <small>💡 Tip: Press <strong>Alt+Shift+H</strong> anytime to see this help again.</small>
    </div>
  `;

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'shortcutsHelpModal';
  modal.style.display = 'block';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>⌨️ Keyboard Shortcuts</h2>
        <button class="modal-close" onclick="document.getElementById('shortcutsHelpModal')?.remove()">&times;</button>
      </div>
      ${html}
      <div class="modal-actions" style="margin-top: 16px;">
        <button class="btn-primary" onclick="document.getElementById('shortcutsHelpModal')?.remove()">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// Initialize shortcuts on page load
setupKeyboardShortcuts();

// Wire up help button
document.getElementById('helpBtn')?.addEventListener('click', showShortcutsHelp);

// ============================================
// RETURN & EXCHANGE SYSTEM
// ============================================

// ===== PAGE LOAD =====
async function loadReturnsPage() {
  try {
    const res = await fetch(`${API_BASE}/returns`).then(r => r.json());
    const tbody = document.getElementById('returnsHistoryBody');
    if (!tbody) return;

    if (!res || !res.returns || res.returns.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;padding:20px;">No returns yet</td></tr>';
      return;
    }

    const rows = res.returns.map(r => {
      const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A';
      const type = r.refundType === 'cash' ? '💵 Cash' : r.refundType === 'exchange' ? '🔄 Even' : '🔄 Extra';
      const exchangeBill = r.adjustedBillId ? `Bill #${r.adjustedBillId}` : '-';
      return `
        <tr>
          <td>${date}</td>
          <td>Bill #${r.billId}</td>
          <td>${r.productName || 'N/A'}</td>
          <td>${r.quantityReturned}</td>
          <td>₹${(r.refundAmount || 0).toFixed(2)}</td>
          <td>${type}</td>
          <td>${exchangeBill}</td>
        </tr>
      `;
    }).join('');
    tbody.innerHTML = rows;
  } catch (e) {
    console.error('loadReturnsPage error', e);
    showToast('Failed to load returns', 'error');
  }
}

// ===== CASH REFUND MODAL =====
function openCashRefundModal() {
  document.getElementById('cashRefundModal').style.display = 'flex';
  document.getElementById('cashRefundForm').reset();
  document.getElementById('crProductSelect').innerHTML = '<option value="">Select product from bill...</option>';
  document.getElementById('crRefundAmount').innerText = '0.00';
}

function closeCashRefundModal() {
  document.getElementById('cashRefundModal').style.display = 'none';
}

async function loadCashRefundBillItems() {
  const billId = Number(document.getElementById('crBillId').value);
  if (!billId) {
    showToast('Enter a bill ID first', 'warn');
    return;
  }

  try {
    const resp = await fetch(`${API_BASE}/bill-items/${billId}`);
    const contentType = resp.headers.get('content-type') || '';
    let res;
    if (contentType.includes('application/json')) {
      res = await resp.json();
    } else {
      const txt = await resp.text();
      console.error('loadCashRefundBillItems: non-json response', txt);
      showToast('Server returned non-JSON response. Check server logs.', 'error');
      return;
    }

    if (!res.success || !res.items) {
      showToast('Bill not found', 'error');
      return;
    }

    const select = document.getElementById('crProductSelect');
    select.innerHTML = '<option value="">Select product from bill...</option>';
    
    res.items.forEach(item => {
      const label = `${item.name} (₹${item.unitPrice}/unit)`;
      const opt = document.createElement('option');
      opt.value = JSON.stringify({ itemId: item.itemId, unitPrice: item.unitPrice, name: item.name });
      opt.textContent = label;
      select.appendChild(opt);
    });

    if (res.items.length === 0) {
      showToast('No items in this bill', 'info');
    }
  } catch (e) {
    console.error('loadCashRefundBillItems error', e);
    showToast('Failed to load bill items', 'error');
  }
}

function updateCashRefundPreview() {
  const itemStr = document.getElementById('crProductSelect').value;
  const qty = Number(document.getElementById('crQuantity').value) || 0;
  
  if (!itemStr || !qty) {
    document.getElementById('crRefundAmount').innerText = '0.00';
    return;
  }

  try {
    const item = JSON.parse(itemStr);
    const refund = (item.unitPrice * qty).toFixed(2);
    document.getElementById('crRefundAmount').innerText = refund;
  } catch (e) {
    document.getElementById('crRefundAmount').innerText = '0.00';
  }
}

async function processCashRefund() {
  const billId = Number(document.getElementById('crBillId').value);
  const itemStr = document.getElementById('crProductSelect').value;
  const qty = Number(document.getElementById('crQuantity').value);

  if (!billId || !itemStr || !qty || qty <= 0) {
    showToast('Please fill all required fields', 'warn');
    return;
  }

  try {
    const item = JSON.parse(itemStr);
    const payload = {
      billId,
      productId: item.itemId,
      quantityReturned: qty,
      refundType: 'cash'
    };

    const res = await fetch(`${API_BASE}/return-item`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(r => r.json());

    if (res && res.success) {
      const msg = `✓ Cash Refund Created!\n${res.productName} × ${res.quantityReturned}\nRefund: ₹${res.refundAmount.toFixed(2)}\nNew Stock: ${res.newStock}`;
      showToast(msg, 'success');
      closeCashRefundModal();
      loadReturnsPage();
    } else {
      showToast('Failed to create refund: ' + (res && res.error), 'error');
    }
  } catch (e) {
    console.error('processCashRefund error', e);
    showToast('Error: ' + e.message, 'error');
  }
}

// ===== EXCHANGE MODAL =====
// Store for new products being added to exchange
let exchangeNewProducts = [];

function openExchangeModal() {
  document.getElementById('exchangeModal').style.display = 'flex';
  document.getElementById('exBillId').value = '';
  document.getElementById('exProductSelect').innerHTML = '<option value="">Select product to return...</option>';
  document.getElementById('exReturnQty').value = '';
  document.getElementById('exNewProductSelect').innerHTML = '<option value="">Select product...</option>';
  document.getElementById('exNewProductQty').value = '';
  document.getElementById('exNewProductsList').innerHTML = '<p style="color:#999;margin:0;text-align:center;">Products will appear here</p>';
  exchangeNewProducts = [];
  updateExchangeSummary();
  loadAllItemsForExchange();
}

function closeExchangeModal() {
  document.getElementById('exchangeModal').style.display = 'none';
  exchangeNewProducts = [];
}

async function loadExchangeReturnBillItems() {
  const billId = Number(document.getElementById('exBillId').value);
  if (!billId) {
    showToast('Enter a bill ID first', 'warn');
    return;
  }

  try {
    const resp = await fetch(`${API_BASE}/bill-items/${billId}`);
    const contentType = resp.headers.get('content-type') || '';
    let res;
    if (contentType.includes('application/json')) {
      res = await resp.json();
    } else {
      const txt = await resp.text();
      console.error('loadExchangeReturnBillItems: non-json response', txt);
      showToast('Server returned non-JSON response. Check server logs.', 'error');
      return;
    }

    if (!res.success || !res.items) {
      showToast('Bill not found', 'error');
      return;
    }

    const select = document.getElementById('exProductSelect');
    select.innerHTML = '<option value="">Select product to return...</option>';
    
    res.items.forEach(item => {
      const label = `${item.name} (₹${item.unitPrice}/unit, Available: ${item.quantity})`;
      const opt = document.createElement('option');
      opt.value = JSON.stringify({ itemId: item.itemId, unitPrice: item.unitPrice, name: item.name });
      opt.textContent = label;
      select.appendChild(opt);
    });

    if (res.items.length === 0) {
      showToast('No items in this bill', 'info');
    }
  } catch (e) {
    console.error('loadExchangeReturnBillItems error', e);
    showToast('Failed to load bill items', 'error');
  }
}

async function loadAllItemsForExchange() {
  try {
    const res = await fetch(`${API_BASE}/items`).then(r => r.json());
    if (!res.items) {
      showToast('Failed to load products', 'error');
      return;
    }

    const select = document.getElementById('exNewProductSelect');
    select.innerHTML = '<option value="">Select product...</option>';
    
    res.items.forEach(item => {
      const label = `${item.name} (₹${item.unitPrice}/unit)`;
      const opt = document.createElement('option');
      opt.value = JSON.stringify({ itemId: item.id, unitPrice: item.unitPrice, name: item.name });
      opt.textContent = label;
      select.appendChild(opt);
    });
  } catch (e) {
    console.error('loadAllItemsForExchange error', e);
  }
}

function addProductToExchange() {
  const productStr = document.getElementById('exNewProductSelect').value;
  const qty = Number(document.getElementById('exNewProductQty').value);

  if (!productStr || !qty || qty <= 0) {
    showToast('Select product and enter quantity', 'warn');
    return;
  }

  try {
    const product = JSON.parse(productStr);
    const price = (product.unitPrice * qty).toFixed(2);

    // Check if already added
    const idx = exchangeNewProducts.findIndex(p => p.itemId === product.itemId);
    if (idx >= 0) {
      exchangeNewProducts[idx].quantity += qty;
      exchangeNewProducts[idx].amount = (exchangeNewProducts[idx].unitPrice * exchangeNewProducts[idx].quantity).toFixed(2);
    } else {
      exchangeNewProducts.push({
        itemId: product.itemId,
        name: product.name,
        unitPrice: product.unitPrice,
        quantity: qty,
        amount: price
      });
    }

    // Clear inputs
    document.getElementById('exNewProductSelect').value = '';
    document.getElementById('exNewProductQty').value = '';

    // Update display
    renderExchangeNewProducts();
    updateExchangeSummary();
  } catch (e) {
    console.error('addProductToExchange error', e);
    showToast('Error adding product', 'error');
  }
}

function removeProductFromExchange(itemId) {
  exchangeNewProducts = exchangeNewProducts.filter(p => p.itemId !== itemId);
  renderExchangeNewProducts();
  updateExchangeSummary();
}

function renderExchangeNewProducts() {
  const container = document.getElementById('exNewProductsList');
  if (exchangeNewProducts.length === 0) {
    container.innerHTML = '<p style="color:#999;margin:0;text-align:center;">Products will appear here</p>';
    return;
  }

  const html = exchangeNewProducts.map((p, idx) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border-bottom:1px solid rgba(0,0,0,.05);font-size:14px;">
      <div style="flex:1;">
        <strong>${p.name}</strong><br>
        <span style="color:#666;font-size:12px;">${p.quantity} × ₹${p.unitPrice.toFixed(2)} = ₹${p.amount}</span>
      </div>
      <button type="button" style="background:#ff5252;color:white;border:none;padding:4px 8px;border-radius:3px;cursor:pointer;" onclick="removeProductFromExchange(${p.itemId})">Remove</button>
    </div>
  `).join('');
  container.innerHTML = html;
}

function updateExchangeSummary() {
  const refundBalance = parseFloat(
    (Number(document.getElementById('exReturnQty').value) || 0) *
    ((() => {
      try {
        const itemStr = document.getElementById('exProductSelect').value;
        return itemStr ? JSON.parse(itemStr).unitPrice : 0;
      } catch {
        return 0;
      }
    })())
  ).toFixed(2);

  const newBillTotal = exchangeNewProducts.reduce((sum, p) => sum + parseFloat(p.amount), 0).toFixed(2);
  const exchangeDifference = (parseFloat(newBillTotal) - parseFloat(refundBalance)).toFixed(2);

  document.getElementById('exSummaryRefund').innerText = refundBalance;
  document.getElementById('exSummaryNewTotal').innerText = newBillTotal;
  document.getElementById('exSummaryDiff').innerText = exchangeDifference;

  // Update note based on difference
  const diffNote = document.getElementById('exDiffNote');
  const diffContainer = document.getElementById('exDiffContainer');
  
  if (parseFloat(exchangeDifference) === 0) {
    diffNote.innerText = 'Even exchange — no payment needed';
    diffContainer.style.borderLeftColor = '#4caf50';
    diffContainer.style.background = 'rgba(76,175,80,.08)';
    document.getElementById('exSummaryDiff').style.color = '#4caf50';
  } else if (parseFloat(exchangeDifference) > 0) {
    diffNote.innerText = `Customer needs to pay extra ₹${exchangeDifference}`;
    diffContainer.style.borderLeftColor = '#ff9800';
    diffContainer.style.background = 'rgba(255,152,0,.08)';
    document.getElementById('exSummaryDiff').style.color = '#ff9800';
  } else {
    const credit = Math.abs(parseFloat(exchangeDifference)).toFixed(2);
    diffNote.innerText = `Remaining credit: ₹${credit} (can refund or save for next purchase)`;
    diffContainer.style.borderLeftColor = '#2196F3';
    diffContainer.style.background = 'rgba(33,150,243,.08)';
    document.getElementById('exSummaryDiff').style.color = '#2196F3';
  }
}

async function processExchange() {
  const billId = Number(document.getElementById('exBillId').value);
  const itemStr = document.getElementById('exProductSelect').value;
  const qty = Number(document.getElementById('exReturnQty').value);

  if (!billId || !itemStr || !qty || qty <= 0) {
    showToast('Please select bill, product, and quantity', 'warn');
    return;
  }

  if (exchangeNewProducts.length === 0) {
    showToast('Add at least one product to the exchange', 'warn');
    return;
  }

  try {
    const item = JSON.parse(itemStr);
    const payload = {
      billId,
      returnProductId: item.itemId,
      quantityReturned: qty,
      newBillItems: exchangeNewProducts.map(p => ({
        itemId: p.itemId,
        name: p.name,
        unitPrice: p.unitPrice,
        quantity: p.quantity
      })),
      paymentMethod: 'exchange'
    };

    const res = await fetch(`${API_BASE}/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(r => r.json());

    if (res && res.success) {
      let msg = `✓ Exchange Completed!\n\nReturned: ${item.name} × ${qty}`;
      msg += `\nRefund Balance: ₹${res.refundBalance.toFixed(2)}`;
      msg += `\nNew Bill Total: ₹${res.newBillTotal.toFixed(2)}`;
      
      if (res.exchangeDifference === 0) {
        msg += `\n\n✓ Even exchange — no payment needed`;
      } else if (res.exchangeDifference > 0) {
        msg += `\n\n💰 Customer pays extra: ₹${res.exchangeDifference.toFixed(2)}`;
      } else {
        msg += `\n\n💳 Remaining credit: ₹${Math.abs(res.exchangeDifference).toFixed(2)}`;
      }
      
      msg += `\nExchange Bill: #${res.newBillId}`;
      showToast(msg, 'success');
      closeExchangeModal();
      loadReturnsPage();
    } else {
      showToast('Failed: ' + (res && res.error), 'error');
    }
  } catch (e) {
    console.error('processExchange error', e);
    showToast('Error: ' + e.message, 'error');
  }
}

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', () => {
  // Cash Refund Events
  document.getElementById('crBillId')?.addEventListener('change', loadCashRefundBillItems);
  document.getElementById('crProductSelect')?.addEventListener('change', updateCashRefundPreview);
  document.getElementById('crQuantity')?.addEventListener('input', updateCashRefundPreview);

  // Exchange Events
  document.getElementById('exBillId')?.addEventListener('change', loadExchangeReturnBillItems);
  document.getElementById('exProductSelect')?.addEventListener('change', updateExchangeSummary);
  document.getElementById('exReturnQty')?.addEventListener('input', updateExchangeSummary);
  document.getElementById('exAddProductBtn')?.addEventListener('click', addProductToExchange);
  document.getElementById('exNewProductQty')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addProductToExchange();
    }
  });

  // Page Navigation Button Events
  document.getElementById('returnsCashBtn')?.addEventListener('click', openCashRefundModal);
  document.getElementById('returnsExchangeBtn')?.addEventListener('click', openExchangeModal);
});
