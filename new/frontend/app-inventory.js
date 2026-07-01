// NOTE: This entire file is DEAD CODE. It is not included via a <script>
// tag in index.html - app.js has its own working versions of every
// function defined below (loadDashboard, loadInventory, saveItem, etc).
// It's kept only for reference. If you don't need it, delete this file
// to avoid confusion; do not add it to index.html without first replacing
// the undefined `inventoryApi` calls throughout with real API_BASE fetch
// calls, matching the pattern used in app.js.

// ===== DASHBOARD =====
async function loadDashboard() {
  try {
    const d = await inventoryApi.dashboard();
    document.getElementById('rev').innerText = '₹' + Number(d.revenue || 0).toFixed(2);
    document.getElementById('profit').innerText = '₹' + Number(d.profit || 0).toFixed(2);
    document.getElementById('insight').innerText = d.insight || '—';
    document.getElementById('targetInput').value = d.target || '';
    document.getElementById('progress').innerText = d.target ? Math.round(((d.todayRevenue||0)/d.target)*100) + '%' : '0%';

    const sa = document.getElementById('stockAlerts');
    if (d.stockLow && d.stockLow.length) {
      sa.innerHTML = d.stockLow.map(it=>`<div>#${it.id} ${it.name} — ${Number(it.quantity).toFixed(2)}</div>`).join('');
    } else sa.innerText = 'No alerts';
  } catch (e) {
    console.error('dashboard load failed', e);
  }
}

async function setTarget() {
  const v = Number(document.getElementById('targetInput').value);
  if (isNaN(v) || v < 0) return alert('Enter valid target');
  await inventoryApi.setTarget(v);
  loadDashboard();
}

// ===== INVENTORY =====
async function loadInventory() {
  if (currentSearchTerm) {
    const items = await inventoryApi.search(currentSearchTerm);
    const filtered = applyCategoryFilter(items);
    renderInventoryTable(filtered);
  } else {
    const items = await inventoryApi.items();
    const filtered = applyCategoryFilter(items);
    renderInventoryTable(filtered);
  }
}

function applyCategoryFilter(items) {
  if (!currentCategory) return items || [];
  return (items || []).filter(it => (it.category || '').toString() === currentCategory.toString());
}

async function loadInventoryCategories() {
  try {
    // Backend API call removed - was undefined 'res' variable, now a no-op
    const sel = document.getElementById('inventoryCategoryFilter');
    if (!sel) return;
    sel.innerHTML = '<option value="">All Categories</option>';
    try {
      const saved = localStorage.getItem('inventoryCategory') || '';
      if (saved) { sel.value = saved; currentCategory = saved; }
    } catch (e) {}
  } catch (e) {
    console.error('Failed to load categories', e);
  }
}

function renderInventoryTable(items) {
  const tbody = document.getElementById('itemsBody');
  if (!items || items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11">No items found</td></tr>';
    return;
  }
  
  tbody.innerHTML = items.map(it => `
    <tr>
      <td>#${it.id}</td>
      <td><strong>${it.name}</strong></td>
      <td>${it.type || 'loose'}</td>
      <td>${it.category || '-'}</td>
      <td>₹${Number(it.pricePerKg || 0).toFixed(2)}</td>
      <td>₹${Number(it.mrp || 0).toFixed(2)}</td>
      <td>₹${Number(it.costPerKg || 0).toFixed(2)}</td>
      <td>${Number(it.quantity || 0).toFixed(2)}</td>
      <td>${Number(it.reorderThreshold || 5).toFixed(2)}</td>
      <td>${it.sku || '-'}</td>
      <td>
        <button class="btn-sm" onclick="editItem(${it.id})">Edit</button>
        <button class="btn-sm btn-danger" onclick="deleteItem(${it.id})">Delete</button>
      </td>
    </tr>
  `).join('');
}

async function deleteItem(id) {
  if (!confirm('Delete this item?')) return;
  await inventoryApi.deleteItem(id);
  loadInventory();
}

function showAddItemModal() {
  currentEditItemId = null;
  document.getElementById('modalTitle').innerText = 'Add Product';
  document.getElementById('itemForm').reset();
  // reset supplier select to first option
  document.getElementById('modalSupplier').value = '';
  document.getElementById('itemModal').classList.add('show');
}

async function editItem(id) {
  const items = await inventoryApi.items();
  const item = items.find(it => it.id === id);
  if (!item) return alert('Item not found');
  
  currentEditItemId = id;
  document.getElementById('modalTitle').innerText = 'Edit Product';
  document.getElementById('modalName').value = item.name || '';
  document.getElementById('modalCategory').value = item.category || '';
  document.getElementById('modalType').value = item.type || 'loose';
  document.getElementById('modalSku').value = item.sku || '';
  document.getElementById('modalPrice').value = Number(item.pricePerKg || 0);
  document.getElementById('modalMrp').value = Number(item.mrp || 0);
  document.getElementById('modalCost').value = Number(item.costPerKg || 0);
  document.getElementById('modalQuantity').value = Number(item.quantity || 0);
  document.getElementById('modalReorderThreshold').value = Number(item.reorderThreshold || 5);
  document.getElementById('modalReorderQuantity').value = Number(item.reorderQuantity || 10);
  document.getElementById('modalDescription').value = item.description || '';
  
  document.getElementById('itemModal').classList.add('show');
}

async function saveItem() {
  const payload = {
    name: document.getElementById('modalName').value.trim(),
    category: (document.getElementById('modalCategory').value || '').trim() || null,
    type: document.getElementById('modalType').value,
    sku: document.getElementById('modalSku').value.trim() || null,
    pricePerKg: Number(document.getElementById('modalPrice').value),
    mrp: Number(document.getElementById('modalMrp').value) || 0,
    costPerKg: Number(document.getElementById('modalCost').value) || 0,
    quantity: Number(document.getElementById('modalQuantity').value) || 0,
    reorderThreshold: Number(document.getElementById('modalReorderThreshold').value) || 5,
    reorderQuantity: Number(document.getElementById('modalReorderQuantity').value) || 10,
    description: document.getElementById('modalDescription').value.trim()
  };
  
  if (!payload.name || !payload.pricePerKg) {
    return alert('Name and price are required');
  }
  
  try {
    if (currentEditItemId) {
      await inventoryApi.editItem(currentEditItemId, payload);
    } else {
      await inventoryApi.addItem(payload);
    }
    closeModal();
    loadInventory();
  } catch (e) {
    alert('Error: ' + e.message);
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

async function performSearch(q) {
  currentSearchTerm = q;
  if (!q.trim()) {
    loadInventory();
  } else {
    const items = await inventoryApi.search(q);
    renderInventoryTable(items);
  }
}

// ===== PREDICTIONS =====
async function loadPredictions() {
  try {
    const pred = await inventoryApi.predictions();
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
async function loadBillingItems() {
  const items = await inventoryApi.items();
  populateSelect(items);
}

function populateSelect(items) {
  const sel = document.getElementById('itemSelect');
  sel.innerHTML = items.length === 0 ? '<option value="">-- no items --</option>' : items.map(i => `<option value="${i.id}" data-mrp="${i.mrp}">${i.name} — MRP ₹${Number(i.mrp||i.pricePerKg).toFixed(2)}</option>`).join('');
}

async function createBill() {
  const itemId = Number(document.getElementById('itemSelect').value);
  const weight = Number(document.getElementById('weight').value);
  if (!itemId || isNaN(weight) || weight <= 0) {
    alert('Choose an item and enter a valid weight');
    return;
  }

  const res = await inventoryApi.sale({ itemId, weight });
  if (res && res.total !== undefined) {
    document.getElementById('result').innerText = 'Total: ₹' + Number(res.total).toFixed(2);
    loadBillingItems();
    loadDashboard();
  } else if (res && res.error) {
    document.getElementById('result').innerText = 'Error: ' + res.error;
  }
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  
  // Dashboard
  document.getElementById('setTargetBtn').addEventListener('click', setTarget);
  
  // Inventory
  document.getElementById('addItemBtn').addEventListener('click', showAddItemModal);
  document.getElementById('searchInput').addEventListener('input', (e) => performSearch(e.target.value));
  setupVoiceSearch();
  // Category filter
  document.getElementById('inventoryCategoryFilter')?.addEventListener('change', (e) => {
    currentCategory = e.target.value || '';
    try { localStorage.setItem('inventoryCategory', currentCategory); } catch (err) {}
    loadInventory();
  });
  document.getElementById('manageCategoriesBtn')?.addEventListener('click', () => {
    showToast('Manage categories is under construction — use the API to add categories.', 'info');
  });
  // Load categories dropdown
  loadInventoryCategories();
  document.getElementById('itemForm').addEventListener('submit', (e) => {
    e.preventDefault();
    saveItem();
  });
  document.querySelector('.modal-close').addEventListener('click', closeModal);
  document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
  
  // Billing
  document.getElementById('billBtn').addEventListener('click', createBill);
  
  // Initial load
  loadDashboard();
});
