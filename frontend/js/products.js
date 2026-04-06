// ─── PRODUCTS MODULE ─────────────────────────────────────────────
const products = {
  list: [],
  categories: [],
  editId: null,

  async init() {
    await this.loadCategories();
    await this.load();
    this.setupEvents();
  },

  async loadCategories() {
    try {
      this.categories = await api.getCategories();
      const selects = document.querySelectorAll('.product-category-select');
      selects.forEach(sel => {
        const val = sel.value;
        sel.innerHTML = `<option value="">All Categories</option>` +
          this.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        sel.value = val;
      });
    } catch(e) {}
  },

  async load(search = '', category = '') {
    try {
      const params = {};
      if (search) params.search = search;
      if (category) params.category = category;
      this.list = await api.getProducts(params);
      this.render();
    } catch(e) { toast.error('Error', e.message); }
  },

  render() {
    const tbody = el('products-tbody');
    if (!tbody) return;
    if (!this.list.length) {
      tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">📦</div><div class="empty-title">No products found</div></div></td></tr>`;
      return;
    }
    tbody.innerHTML = this.list.map(p => {
      const stockClass = p.stock <= 0 ? 'danger' : p.stock <= p.min_stock ? 'warning' : 'success';
      return `<tr>
        <td><span class="badge badge-gray" style="font-family:monospace">${p.barcode || '—'}</span></td>
        <td><strong>${p.name}</strong></td>
        <td><span class="badge badge-purple">${p.category}</span></td>
        <td>${fmt.currency(p.cost_price)}</td>
        <td style="font-weight:700;color:var(--accent-light)">${fmt.currency(p.selling_price)}</td>
        <td>${p.gst_percent}%</td>
        <td><span class="badge badge-${stockClass}">${p.stock || 0} ${p.unit}</span></td>
        <td>
          <div class="table-actions">
            <button class="btn btn-secondary btn-sm" onclick="products.openEdit(${p.id})">✏️ Edit</button>
            <button class="btn btn-ghost btn-sm" onclick="products.openBatches(${p.id},'${p.name}')">📦 Batches</button>
            <button class="btn btn-danger btn-sm" onclick="products.deleteProduct(${p.id})">🗑️</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  },

  setupEvents() {
    el('product-search')?.addEventListener('input', e => this.load(e.target.value, el('product-cat-filter')?.value));
    el('product-cat-filter')?.addEventListener('change', e => this.load(el('product-search')?.value, e.target.value));
    el('btn-add-product')?.addEventListener('click', () => this.openAdd());
    el('product-form')?.addEventListener('submit', e => { e.preventDefault(); this.save(); });
  },

  openAdd() {
    this.editId = null;
    el('product-modal-title').textContent = '➕ Add Product';
    el('product-form').reset();
    // Populate category options
    const sel = el('product-form-category');
    if (sel) sel.innerHTML = this.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    openModal('modal-product');
    el('product-form-name')?.focus();
  },

  async openEdit(id) {
    const p = await api.getProduct(id).catch(() => null);
    if (!p) return;
    this.editId = id;
    el('product-modal-title').textContent = '✏️ Edit Product';
    el('product-form-barcode').value   = p.barcode || '';
    el('product-form-name').value      = p.name;
    const sel = el('product-form-category');
    if (sel) sel.innerHTML = this.categories.map(c => `<option value="${c.name}" ${c.name===p.category?'selected':''}>${c.name}</option>`).join('');
    el('product-form-cost').value      = p.cost_price;
    el('product-form-price').value     = p.selling_price;
    el('product-form-gst').value       = p.gst_percent;
    el('product-form-unit').value      = p.unit;
    el('product-form-minstock').value  = p.min_stock;
    openModal('modal-product');
  },

  async save() {
    const data = {
      barcode:       el('product-form-barcode').value.trim() || null,
      name:          el('product-form-name').value.trim(),
      category:      el('product-form-category').value,
      cost_price:    parseFloat(el('product-form-cost').value) || 0,
      selling_price: parseFloat(el('product-form-price').value),
      gst_percent:   parseFloat(el('product-form-gst').value) || 0,
      unit:          el('product-form-unit').value || 'pcs',
      min_stock:     parseInt(el('product-form-minstock').value) || 5,
    };
    if (!data.name || !data.selling_price) { toast.error('Validation', 'Name and selling price required'); return; }
    try {
      if (this.editId) { await api.updateProduct(this.editId, data); toast.success('Updated', data.name); }
      else             { await api.createProduct(data); toast.success('Added', data.name); }
      closeModal('modal-product');
      this.load();
    } catch(e) { toast.error('Error', e.message); }
  },

  async deleteProduct(id) {
    if (!confirmDialog('Delete this product?')) return;
    await api.deleteProduct(id);
    toast.success('Deleted', 'Product removed');
    this.load();
  },

  async openBatches(productId, productName) {
    el('batch-product-name').textContent = productName;
    el('batch-product-id').value = productId;
    const batches = await api.getBatches(productId).catch(() => []);
    const tbody = el('batches-tbody');
    if (!batches.length) {
      tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state" style="padding:20px"><div class="empty-icon">📦</div><div class="empty-title">No batches</div></div></td></tr>`;
    } else {
      tbody.innerHTML = batches.map(b => {
        const today = new Date().toISOString().split('T')[0];
        const expired = b.expiry_date && b.expiry_date < today;
        const expiring = b.expiry_date && !expired && new Date(b.expiry_date) < new Date(Date.now() + 7 * 86400000);
        return `<tr>
          <td>${b.batch_no || '#' + b.id}</td>
          <td>${b.quantity}</td>
          <td>${fmt.currency(b.purchase_price)}</td>
          <td>${b.purchase_date || '—'}</td>
          <td>${b.expiry_date
            ? `<span class="badge badge-${expired?'danger':expiring?'warning':'success'}">${b.expiry_date}</span>`
            : '—'}</td>
        </tr>`;
      }).join('');
    }
    openModal('modal-batches');
  },
};

// ─── QUICK ADD FROM BILLING ──────────────────────────────────────
async function quickAddProduct(e) {
  e.preventDefault();
  const data = {
    barcode:       el('qp-barcode').value.trim() || null,
    name:          el('qp-name').value.trim(),
    category:      el('qp-category').value || 'General',
    cost_price:    parseFloat(el('qp-cost').value) || 0,
    selling_price: parseFloat(el('qp-price').value),
    gst_percent:   parseFloat(el('qp-gst').value) || 0,
    unit:          el('qp-unit').value || 'pcs',
    min_stock:     parseInt(el('qp-minstock').value) || 5,
  };
  const qty = parseInt(el('qp-qty').value) || 0;
  try {
    const result = await api.createProduct(data);
    if (qty > 0) await api.addBatch({ product_id: result.id, quantity: qty, purchase_price: data.cost_price });
    toast.success('Product Added', data.name);
    closeModal('modal-quick-add');
    // Auto-add to cart if on billing page
    if (app.currentPage === 'billing') {
      const product = await api.getProduct(result.id);
      if (product) billing.addToCart(product);
    }
    if (app.currentPage === 'products') products.load();
  } catch(e) {
    toast.error('Error', e.message);
  }
}
