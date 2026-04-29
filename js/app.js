/**
 * Display Logic Dashboard — Application Logic
 * Handles: navigation, products CRUD, quotes CRUD, display rules CRUD,
 *          localStorage persistence, and display-logic rule evaluation.
 */

/* =====================================================================
   STATE
   ===================================================================== */
const state = {
  products: [],
  quotes:   [],
  rules:    [],
  nextQuoteNum: 1,
};

/* =====================================================================
   PERSISTENCE
   ===================================================================== */
function saveState() {
  localStorage.setItem('dl_products', JSON.stringify(state.products));
  localStorage.setItem('dl_quotes',   JSON.stringify(state.quotes));
  localStorage.setItem('dl_rules',    JSON.stringify(state.rules));
  localStorage.setItem('dl_nextQuoteNum', String(state.nextQuoteNum));
}

function loadState() {
  try {
    state.products     = JSON.parse(localStorage.getItem('dl_products') || '[]');
    state.quotes       = JSON.parse(localStorage.getItem('dl_quotes')   || '[]');
    state.rules        = JSON.parse(localStorage.getItem('dl_rules')    || '[]');
    state.nextQuoteNum = parseInt(localStorage.getItem('dl_nextQuoteNum') || '1', 10);
  } catch (_) {
    /* silently ignore corrupt data */
  }
}

/* =====================================================================
   UTILITIES
   ===================================================================== */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function fmt(n) {
  return '$' + parseFloat(n || 0).toFixed(2);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/* =====================================================================
   TOAST
   ===================================================================== */
let toastTimer = null;
function showToast(msg, type = 'default') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast visible ' + (type !== 'default' ? type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 3000);
}

/* =====================================================================
   NAVIGATION
   ===================================================================== */
function navigate(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const viewEl = document.getElementById('view-' + viewName);
  if (viewEl) viewEl.classList.add('active');

  const navEl = document.querySelector(`.nav-item[data-view="${viewName}"]`);
  if (navEl) navEl.classList.add('active');

  const titles = { dashboard: 'Dashboard', products: 'Products', quotes: 'Quotes', rules: 'Display Rules' };
  document.getElementById('pageTitle').textContent = titles[viewName] || viewName;

  if (viewName === 'products') renderProducts();
  if (viewName === 'quotes')   renderQuotes();
  if (viewName === 'rules')    renderRules();
  if (viewName === 'dashboard') renderDashboard();
}

/* =====================================================================
   MODAL HELPERS
   ===================================================================== */
function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function clearErrors(...ids) {
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = ''; }
  });
}

function setError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

/* =====================================================================
   DISPLAY LOGIC — RULE ENGINE
   ===================================================================== */
function applyRules(product) {
  const result = { hidden: false, highlighted: false, discount: 0 };
  state.rules
    .filter(r => r.active)
    .forEach(rule => {
      if (evaluateCondition(product, rule)) {
        if (rule.action === 'hide')      result.hidden      = true;
        if (rule.action === 'show')      result.hidden      = false;
        if (rule.action === 'highlight') result.highlighted = true;
        if (rule.action === 'discount')  result.discount    = Math.max(result.discount, 10);
      }
    });
  return result;
}

function evaluateCondition(product, rule) {
  const fieldMap = { stock: 'stock', price: 'price', category: 'category', visible: 'visible' };
  const field = fieldMap[rule.conditionField];
  if (!field) return false;

  let productVal = product[field];
  let ruleVal    = rule.conditionValue;

  // Coerce types for numeric fields
  if (field === 'stock' || field === 'price') {
    productVal = parseFloat(productVal) || 0;
    ruleVal    = parseFloat(ruleVal)    || 0;
  } else if (field === 'visible') {
    productVal = Boolean(productVal);
    ruleVal    = ruleVal === 'true' || ruleVal === true;
  } else {
    productVal = String(productVal).toLowerCase();
    ruleVal    = String(ruleVal).toLowerCase();
  }

  switch (rule.conditionOp) {
    case 'eq':       return productVal === ruleVal;
    case 'neq':      return productVal !== ruleVal;
    case 'lt':       return productVal <   ruleVal;
    case 'lte':      return productVal <=  ruleVal;
    case 'gt':       return productVal >   ruleVal;
    case 'gte':      return productVal >=  ruleVal;
    case 'contains': return String(productVal).toLowerCase().includes(String(ruleVal).toLowerCase());
    default:         return false;
  }
}

/* =====================================================================
   DASHBOARD
   ===================================================================== */
function renderDashboard() {
  document.getElementById('stat-products').textContent    = state.products.length;
  document.getElementById('stat-quotes').textContent      = state.quotes.length;
  document.getElementById('stat-rules').textContent       = state.rules.length;
  document.getElementById('stat-active-quotes').textContent =
    state.quotes.filter(q => q.status === 'sent' || q.status === 'draft').length;

  // Recent products (last 5)
  const prodBody = document.getElementById('dash-products-body');
  const recent   = state.products.slice(-5).reverse();
  if (recent.length === 0) {
    prodBody.innerHTML = '<tr class="empty-row"><td colspan="4">No products yet.</td></tr>';
  } else {
    prodBody.innerHTML = recent.map(p => {
      const ruleEffect = applyRules(p);
      const visible    = p.visible && !ruleEffect.hidden;
      return `<tr>
        <td>${escHtml(p.name)}</td>
        <td>${escHtml(p.category)}</td>
        <td>${fmt(p.price)}</td>
        <td><span class="badge badge-${visible ? 'yes' : 'no'}">${visible ? 'Visible' : 'Hidden'}</span></td>
      </tr>`;
    }).join('');
  }

  // Recent quotes (last 5)
  const quoteBody = document.getElementById('dash-quotes-body');
  const recentQ   = state.quotes.slice(-5).reverse();
  if (recentQ.length === 0) {
    quoteBody.innerHTML = '<tr class="empty-row"><td colspan="4">No quotes yet.</td></tr>';
  } else {
    quoteBody.innerHTML = recentQ.map(q => `<tr>
      <td>${escHtml(q.customer)}</td>
      <td>${fmt(q.total)}</td>
      <td><span class="badge badge-${escHtml(q.status)}">${escHtml(q.status)}</span></td>
      <td>${fmtDate(q.createdAt)}</td>
    </tr>`).join('');
  }
}

/* =====================================================================
   PRODUCTS
   ===================================================================== */
function renderProducts(filter = '') {
  const search   = (filter || document.getElementById('productSearch').value).toLowerCase();
  const catFilter = document.getElementById('productCategoryFilter').value;

  // Rebuild category filter options
  const cats = [...new Set(state.products.map(p => p.category))].sort();
  const catSel = document.getElementById('productCategoryFilter');
  const currentCat = catSel.value;
  catSel.innerHTML = '<option value="">All Categories</option>' +
    cats.map(c => `<option value="${escHtml(c)}" ${c === currentCat ? 'selected' : ''}>${escHtml(c)}</option>`).join('');

  const body = document.getElementById('products-body');
  let products = state.products;
  if (search)    products = products.filter(p => p.name.toLowerCase().includes(search) || p.category.toLowerCase().includes(search));
  if (catFilter) products = products.filter(p => p.category === catFilter);

  if (products.length === 0) {
    body.innerHTML = '<tr class="empty-row"><td colspan="6">No products found.</td></tr>';
    return;
  }

  body.innerHTML = products.map(p => {
    const ruleEffect = applyRules(p);
    const visible    = p.visible && !ruleEffect.hidden;
    const highlight  = ruleEffect.highlighted ? 'style="background:#fef9c3"' : '';
    const dispPrice  = ruleEffect.discount > 0
      ? `<span style="text-decoration:line-through;color:#94a3b8">${fmt(p.price)}</span> <span style="color:var(--color-success)">${fmt(p.price * (1 - ruleEffect.discount / 100))}</span>`
      : fmt(p.price);

    return `<tr ${highlight}>
      <td><strong>${escHtml(p.name)}</strong>${p.description ? `<br><span style="color:var(--color-text-muted);font-size:12px">${escHtml(p.description.slice(0, 60))}${p.description.length > 60 ? '…' : ''}</span>` : ''}</td>
      <td>${escHtml(p.category)}</td>
      <td>${dispPrice}</td>
      <td>${p.stock}</td>
      <td><span class="badge badge-${visible ? 'yes' : 'no'}">${visible ? 'Yes' : 'No'}</span></td>
      <td>
        <div class="action-btns">
          <button class="btn btn-ghost btn-icon" title="Edit" data-action="edit-product" data-id="${p.id}">✏️</button>
          <button class="btn btn-ghost btn-icon" title="Delete" data-action="delete-product" data-id="${p.id}">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function openProductModal(id = null) {
  const p = id ? state.products.find(x => x.id === id) : null;
  document.getElementById('productModalTitle').textContent = p ? 'Edit Product' : 'New Product';
  document.getElementById('productId').value          = p ? p.id : '';
  document.getElementById('productName').value        = p ? p.name : '';
  document.getElementById('productCategory').value    = p ? p.category : '';
  document.getElementById('productDescription').value = p ? p.description : '';
  document.getElementById('productPrice').value       = p ? p.price : '';
  document.getElementById('productStock').value       = p ? p.stock : 0;
  document.getElementById('productVisible').checked   = p ? p.visible : true;

  clearErrors('productNameErr', 'productCategoryErr', 'productPriceErr');
  document.querySelectorAll('#productForm .form-input').forEach(el => el.classList.remove('error'));
  openModal('productModal');
  setTimeout(() => document.getElementById('productName').focus(), 50);
}

function saveProduct() {
  const nameEl  = document.getElementById('productName');
  const catEl   = document.getElementById('productCategory');
  const priceEl = document.getElementById('productPrice');
  let valid = true;

  clearErrors('productNameErr', 'productCategoryErr', 'productPriceErr');
  [nameEl, catEl, priceEl].forEach(el => el.classList.remove('error'));

  if (!nameEl.value.trim()) {
    setError('productNameErr', 'Product name is required.');
    nameEl.classList.add('error');
    valid = false;
  }
  if (!catEl.value.trim()) {
    setError('productCategoryErr', 'Category is required.');
    catEl.classList.add('error');
    valid = false;
  }
  if (!priceEl.value || isNaN(parseFloat(priceEl.value)) || parseFloat(priceEl.value) < 0) {
    setError('productPriceErr', 'Enter a valid price (≥ 0).');
    priceEl.classList.add('error');
    valid = false;
  }
  if (!valid) return;

  const id = document.getElementById('productId').value;
  const product = {
    id:          id || uid(),
    name:        nameEl.value.trim(),
    category:    catEl.value.trim(),
    description: document.getElementById('productDescription').value.trim(),
    price:       parseFloat(priceEl.value),
    stock:       parseInt(document.getElementById('productStock').value, 10) || 0,
    visible:     document.getElementById('productVisible').checked,
    createdAt:   id ? (state.products.find(p => p.id === id) || {}).createdAt || new Date().toISOString() : new Date().toISOString(),
  };

  if (id) {
    const idx = state.products.findIndex(p => p.id === id);
    if (idx !== -1) state.products[idx] = product;
  } else {
    state.products.push(product);
  }

  saveState();
  closeModal('productModal');
  renderProducts();
  renderDashboard();
  showToast(id ? 'Product updated.' : 'Product created.', 'success');
}

function deleteProduct(id) {
  state.products = state.products.filter(p => p.id !== id);
  saveState();
  renderProducts();
  renderDashboard();
  showToast('Product deleted.');
}

/* =====================================================================
   QUOTES
   ===================================================================== */
function calcLineTotal(qty, price, disc) {
  return qty * price * (1 - disc / 100);
}

function calcQuoteTotals() {
  const items = [...document.querySelectorAll('.line-item')];
  let subtotal = 0;
  items.forEach(row => {
    const qty   = parseFloat(row.querySelector('.li-qty').value)   || 0;
    const price = parseFloat(row.querySelector('.li-price').value) || 0;
    const disc  = parseFloat(row.querySelector('.li-disc').value)  || 0;
    const total = calcLineTotal(qty, price, disc);
    row.querySelector('.line-total').textContent = fmt(total);
    subtotal += total;
  });
  const globalDisc = parseFloat(document.getElementById('quoteDiscount').value) || 0;
  const grandTotal = subtotal * (1 - globalDisc / 100);
  document.getElementById('quoteSubtotal').textContent = fmt(subtotal);
  document.getElementById('quoteTotal').textContent    = fmt(grandTotal);
  return { subtotal, grandTotal };
}

function addLineItem(product = null) {
  const container = document.getElementById('quoteLineItems');

  // Build visible product options respecting display logic
  const visibleProds = state.products.filter(p => {
    const effect = applyRules(p);
    return p.visible && !effect.hidden;
  });

  const productOpts = [
    '<option value="">— Select product —</option>',
    ...visibleProds.map(p => {
      const effect   = applyRules(p);
      const adjPrice = p.price * (1 - effect.discount / 100);
      return `<option value="${p.id}" data-price="${adjPrice}" ${product && product.id === p.id ? 'selected' : ''}>${escHtml(p.name)} (${fmt(adjPrice)})</option>`;
    })
  ].join('');

  const initQty   = product ? 1 : 1;
  const initPrice = product ? (p => {
    const effect = applyRules(p); return p.price * (1 - effect.discount / 100);
  })(product) : 0;

  const div = document.createElement('div');
  div.className = 'line-item';
  div.innerHTML = `
    <select class="form-input li-product">${productOpts}</select>
    <input type="number" class="form-input li-qty"   value="${initQty}"   min="1"  step="1"    placeholder="1" />
    <input type="number" class="form-input li-price" value="${initPrice}" min="0"  step="0.01" placeholder="0.00" />
    <input type="number" class="form-input li-disc"  value="0"            min="0"  max="100"   step="0.1" placeholder="0" />
    <span class="line-total">${fmt(initQty * initPrice)}</span>
    <button type="button" class="remove-line" title="Remove">×</button>
  `;
  container.appendChild(div);

  // When product is selected, auto-fill price
  div.querySelector('.li-product').addEventListener('change', function () {
    const sel     = this.options[this.selectedIndex];
    const adjPrice = parseFloat(sel.dataset.price) || 0;
    div.querySelector('.li-price').value = adjPrice.toFixed(2);
    calcQuoteTotals();
  });

  div.querySelectorAll('.li-qty, .li-price, .li-disc').forEach(el =>
    el.addEventListener('input', calcQuoteTotals)
  );

  calcQuoteTotals();
}

function renderQuotes(filter = '') {
  const search     = (filter || document.getElementById('quoteSearch').value).toLowerCase();
  const statusFilter = document.getElementById('quoteStatusFilter').value;

  let quotes = state.quotes;
  if (search)      quotes = quotes.filter(q => q.customer.toLowerCase().includes(search) || String(q.quoteNum).includes(search));
  if (statusFilter) quotes = quotes.filter(q => q.status === statusFilter);

  const body = document.getElementById('quotes-body');
  if (quotes.length === 0) {
    body.innerHTML = '<tr class="empty-row"><td colspan="7">No quotes found.</td></tr>';
    return;
  }

  body.innerHTML = quotes.slice().reverse().map(q => `<tr>
    <td><strong>#${String(q.quoteNum).padStart(4, '0')}</strong></td>
    <td>${escHtml(q.customer)}</td>
    <td>${q.lines.length} item${q.lines.length !== 1 ? 's' : ''}</td>
    <td>${fmt(q.total)}</td>
    <td><span class="badge badge-${escHtml(q.status)}">${escHtml(q.status)}</span></td>
    <td>${fmtDate(q.createdAt)}</td>
    <td>
      <div class="action-btns">
        <button class="btn btn-ghost btn-icon" title="Edit" data-action="edit-quote" data-id="${q.id}">✏️</button>
        <button class="btn btn-ghost btn-icon" title="Delete" data-action="delete-quote" data-id="${q.id}">🗑️</button>
      </div>
    </td>
  </tr>`).join('');
}

function openQuoteModal(id = null) {
  const q = id ? state.quotes.find(x => x.id === id) : null;
  document.getElementById('quoteModalTitle').textContent   = q ? `Edit Quote #${String(q.quoteNum).padStart(4,'0')}` : 'New Quote';
  document.getElementById('quoteId').value                 = q ? q.id : '';
  document.getElementById('quoteCustomer').value           = q ? q.customer : '';
  document.getElementById('quoteEmail').value              = q ? q.email : '';
  document.getElementById('quoteNotes').value              = q ? q.notes : '';
  document.getElementById('quoteStatus').value             = q ? q.status : 'draft';
  document.getElementById('quoteExpiry').value             = q ? q.expiry : '';
  document.getElementById('quoteDiscount').value           = q ? (q.globalDiscount || 0) : 0;
  document.getElementById('quoteLineItems').innerHTML      = '';

  clearErrors('quoteCustomerErr');
  document.getElementById('quoteCustomer').classList.remove('error');

  if (q && q.lines && q.lines.length > 0) {
    q.lines.forEach(line => {
      addLineItem();
      const items = document.querySelectorAll('.line-item');
      const row   = items[items.length - 1];
      row.querySelector('.li-product').value = line.productId || '';
      row.querySelector('.li-qty').value     = line.qty;
      row.querySelector('.li-price').value   = line.price;
      row.querySelector('.li-disc').value    = line.disc;
      row.querySelector('.line-total').textContent = fmt(calcLineTotal(line.qty, line.price, line.disc));
    });
  } else {
    addLineItem();
  }

  calcQuoteTotals();
  openModal('quoteModal');
  setTimeout(() => document.getElementById('quoteCustomer').focus(), 50);
}

function saveQuote() {
  const custEl = document.getElementById('quoteCustomer');
  let valid = true;

  clearErrors('quoteCustomerErr');
  custEl.classList.remove('error');

  if (!custEl.value.trim()) {
    setError('quoteCustomerErr', 'Customer name is required.');
    custEl.classList.add('error');
    valid = false;
  }
  if (!valid) return;

  const totals     = calcQuoteTotals();
  const lineItems  = [...document.querySelectorAll('.line-item')].map(row => ({
    productId: row.querySelector('.li-product').value,
    qty:       parseFloat(row.querySelector('.li-qty').value)   || 0,
    price:     parseFloat(row.querySelector('.li-price').value) || 0,
    disc:      parseFloat(row.querySelector('.li-disc').value)  || 0,
  }));

  const id       = document.getElementById('quoteId').value;
  const existing = id ? state.quotes.find(q => q.id === id) : null;

  const quote = {
    id:             id || uid(),
    quoteNum:       existing ? existing.quoteNum : state.nextQuoteNum++,
    customer:       custEl.value.trim(),
    email:          document.getElementById('quoteEmail').value.trim(),
    notes:          document.getElementById('quoteNotes').value.trim(),
    status:         document.getElementById('quoteStatus').value,
    expiry:         document.getElementById('quoteExpiry').value,
    globalDiscount: parseFloat(document.getElementById('quoteDiscount').value) || 0,
    lines:          lineItems,
    subtotal:       totals.subtotal,
    total:          totals.grandTotal,
    createdAt:      existing ? existing.createdAt : new Date().toISOString(),
  };

  if (id) {
    const idx = state.quotes.findIndex(q => q.id === id);
    if (idx !== -1) state.quotes[idx] = quote;
  } else {
    state.quotes.push(quote);
  }

  saveState();
  closeModal('quoteModal');
  renderQuotes();
  renderDashboard();
  showToast(id ? 'Quote updated.' : 'Quote created.', 'success');
}

function deleteQuote(id) {
  state.quotes = state.quotes.filter(q => q.id !== id);
  saveState();
  renderQuotes();
  renderDashboard();
  showToast('Quote deleted.');
}

/* =====================================================================
   DISPLAY RULES
   ===================================================================== */
const OP_LABELS = { eq: 'equals', neq: 'not equals', lt: '< ', lte: '≤ ', gt: '> ', gte: '≥ ', contains: 'contains' };
const FIELD_LABELS = { stock: 'Stock', price: 'Price', category: 'Category', visible: 'Visibility' };
const ACTION_LABELS = { hide: 'Hide', show: 'Show', highlight: 'Highlight', discount: 'Discount 10%' };

function renderRules(filter = '') {
  const search = (filter || document.getElementById('ruleSearch').value).toLowerCase();
  let rules = state.rules;
  if (search) rules = rules.filter(r => r.name.toLowerCase().includes(search));

  const body = document.getElementById('rules-body');
  if (rules.length === 0) {
    body.innerHTML = '<tr class="empty-row"><td colspan="6">No rules found. Click "New Rule" to add one.</td></tr>';
    return;
  }

  body.innerHTML = rules.map(r => {
    const condLabel = `${FIELD_LABELS[r.conditionField] || r.conditionField} ${OP_LABELS[r.conditionOp] || r.conditionOp} "${escHtml(r.conditionValue)}"`;
    return `<tr>
      <td><strong>${escHtml(r.name)}</strong></td>
      <td><code style="font-size:12px;background:#f1f5f9;padding:2px 6px;border-radius:4px">${condLabel}</code></td>
      <td>${ACTION_LABELS[r.action] || r.action}</td>
      <td>${getAffectedCount(r)} product${getAffectedCount(r) !== 1 ? 's' : ''}</td>
      <td>
        <label class="toggle" title="${r.active ? 'Deactivate' : 'Activate'}" data-action="toggle-rule" data-id="${r.id}">
          <input type="checkbox" ${r.active ? 'checked' : ''} readonly tabindex="-1" />
          <span class="toggle-slider"></span>
        </label>
      </td>
      <td>
        <div class="action-btns">
          <button class="btn btn-ghost btn-icon" title="Edit" data-action="edit-rule" data-id="${r.id}">✏️</button>
          <button class="btn btn-ghost btn-icon" title="Delete" data-action="delete-rule" data-id="${r.id}">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function getAffectedCount(rule) {
  return state.products.filter(p => evaluateCondition(p, rule)).length;
}

function openRuleModal(id = null) {
  const r = id ? state.rules.find(x => x.id === id) : null;
  document.getElementById('ruleModalTitle').textContent      = r ? 'Edit Rule' : 'New Display Rule';
  document.getElementById('ruleId').value                    = r ? r.id : '';
  document.getElementById('ruleName').value                  = r ? r.name : '';
  document.getElementById('ruleConditionField').value        = r ? r.conditionField : 'stock';
  document.getElementById('ruleConditionOp').value           = r ? r.conditionOp : 'eq';
  document.getElementById('ruleConditionValue').value        = r ? r.conditionValue : '';
  document.getElementById('ruleAction').value                = r ? r.action : 'hide';
  document.getElementById('ruleActive').checked              = r ? r.active : true;

  clearErrors('ruleNameErr', 'ruleConditionValueErr');
  document.getElementById('ruleName').classList.remove('error');
  document.getElementById('ruleConditionValue').classList.remove('error');
  openModal('ruleModal');
  setTimeout(() => document.getElementById('ruleName').focus(), 50);
}

function saveRule() {
  const nameEl  = document.getElementById('ruleName');
  const valueEl = document.getElementById('ruleConditionValue');
  let valid = true;

  clearErrors('ruleNameErr', 'ruleConditionValueErr');
  nameEl.classList.remove('error');
  valueEl.classList.remove('error');

  if (!nameEl.value.trim()) {
    setError('ruleNameErr', 'Rule name is required.');
    nameEl.classList.add('error');
    valid = false;
  }
  if (!valueEl.value.trim()) {
    setError('ruleConditionValueErr', 'Condition value is required.');
    valueEl.classList.add('error');
    valid = false;
  }
  if (!valid) return;

  const id = document.getElementById('ruleId').value;
  const rule = {
    id:             id || uid(),
    name:           nameEl.value.trim(),
    conditionField: document.getElementById('ruleConditionField').value,
    conditionOp:    document.getElementById('ruleConditionOp').value,
    conditionValue: valueEl.value.trim(),
    action:         document.getElementById('ruleAction').value,
    active:         document.getElementById('ruleActive').checked,
    createdAt:      id ? (state.rules.find(r => r.id === id) || {}).createdAt || new Date().toISOString() : new Date().toISOString(),
  };

  if (id) {
    const idx = state.rules.findIndex(r => r.id === id);
    if (idx !== -1) state.rules[idx] = rule;
  } else {
    state.rules.push(rule);
  }

  saveState();
  closeModal('ruleModal');
  renderRules();
  renderDashboard();
  showToast(id ? 'Rule updated.' : 'Rule created.', 'success');
}

function deleteRule(id) {
  state.rules = state.rules.filter(r => r.id !== id);
  saveState();
  renderRules();
  renderDashboard();
  showToast('Rule deleted.');
}

/* =====================================================================
   DELETE CONFIRM FLOW
   ===================================================================== */
let pendingDelete = null;

function confirmDelete(type, id, name) {
  pendingDelete = { type, id };
  document.getElementById('deleteMessage').textContent =
    `Are you sure you want to delete "${name}"? This action cannot be undone.`;
  openModal('deleteModal');
}

document.getElementById('confirmDelete').addEventListener('click', () => {
  if (!pendingDelete) return;
  const { type, id } = pendingDelete;
  pendingDelete = null;
  closeModal('deleteModal');
  if (type === 'product') deleteProduct(id);
  if (type === 'quote')   deleteQuote(id);
  if (type === 'rule')    deleteRule(id);
});

/* =====================================================================
   EVENT DELEGATION — table actions
   ===================================================================== */
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const id     = btn.dataset.id;

  if (action === 'edit-product') {
    openProductModal(id);
  } else if (action === 'delete-product') {
    const p = state.products.find(x => x.id === id);
    if (p) confirmDelete('product', id, p.name);
  } else if (action === 'edit-quote') {
    openQuoteModal(id);
  } else if (action === 'delete-quote') {
    const q = state.quotes.find(x => x.id === id);
    if (q) confirmDelete('quote', id, `Quote #${String(q.quoteNum).padStart(4,'0')} – ${q.customer}`);
  } else if (action === 'edit-rule') {
    openRuleModal(id);
  } else if (action === 'delete-rule') {
    const r = state.rules.find(x => x.id === id);
    if (r) confirmDelete('rule', id, r.name);
  } else if (action === 'toggle-rule') {
    const r = state.rules.find(x => x.id === id);
    if (r) {
      r.active = !r.active;
      saveState();
      renderRules();
      renderProducts();
      showToast(`Rule "${r.name}" ${r.active ? 'activated' : 'deactivated'}.`);
    }
  }
});

/* =====================================================================
   EVENT DELEGATION — modal close & nav
   ===================================================================== */
document.addEventListener('click', e => {
  // Close modal buttons
  const closeBtn = e.target.closest('[data-close]');
  if (closeBtn) { closeModal(closeBtn.dataset.close); return; }

  // Close on overlay click
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    return;
  }

  // Navigation links in sidebar
  const navItem = e.target.closest('.nav-item[data-view]');
  if (navItem) {
    e.preventDefault();
    navigate(navItem.dataset.view);
    return;
  }

  // "View All" buttons in dashboard cards
  const viewBtn = e.target.closest('[data-view]:not(.nav-item)');
  if (viewBtn) {
    navigate(viewBtn.dataset.view);
  }
});

/* =====================================================================
   SIDEBAR TOGGLE
   ===================================================================== */
document.getElementById('menuBtn').addEventListener('click', () => {
  const sidebar  = document.getElementById('sidebar');
  const wrapper  = document.querySelector('.main-wrapper');
  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    sidebar.classList.toggle('mobile-open');
  } else {
    sidebar.classList.toggle('collapsed');
    wrapper.classList.toggle('expanded');
  }
});

/* =====================================================================
   PRODUCT FORM — save button
   ===================================================================== */
document.getElementById('saveProduct').addEventListener('click', saveProduct);
document.getElementById('productForm').addEventListener('submit', e => { e.preventDefault(); saveProduct(); });

/* =====================================================================
   QUOTE FORM — save button & line items
   ===================================================================== */
document.getElementById('saveQuote').addEventListener('click', saveQuote);
document.getElementById('quoteForm').addEventListener('submit', e => { e.preventDefault(); saveQuote(); });

document.getElementById('addLineItem').addEventListener('click', () => addLineItem());

document.getElementById('quoteLineItems').addEventListener('click', e => {
  const rmBtn = e.target.closest('.remove-line');
  if (rmBtn) {
    const row = rmBtn.closest('.line-item');
    if (row) row.remove();
    calcQuoteTotals();
  }
});

document.getElementById('quoteDiscount').addEventListener('input', calcQuoteTotals);

/* =====================================================================
   RULE FORM — save button
   ===================================================================== */
document.getElementById('saveRule').addEventListener('click', saveRule);
document.getElementById('ruleForm').addEventListener('submit', e => { e.preventDefault(); saveRule(); });

/* =====================================================================
   MODAL OPEN BUTTONS
   ===================================================================== */
document.getElementById('openProductModal').addEventListener('click', () => openProductModal());
document.getElementById('openQuoteModal').addEventListener('click',   () => openQuoteModal());
document.getElementById('openRuleModal').addEventListener('click',    () => openRuleModal());

/* =====================================================================
   SEARCH & FILTER LIVE UPDATES
   ===================================================================== */
document.getElementById('productSearch').addEventListener('input', () => renderProducts());
document.getElementById('productCategoryFilter').addEventListener('change', () => renderProducts());
document.getElementById('quoteSearch').addEventListener('input', () => renderQuotes());
document.getElementById('quoteStatusFilter').addEventListener('change', () => renderQuotes());
document.getElementById('ruleSearch').addEventListener('input', () => renderRules());

/* =====================================================================
   KEYBOARD — close modal on Escape
   ===================================================================== */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

/* =====================================================================
   BOOTSTRAP
   ===================================================================== */
loadState();
renderDashboard();
