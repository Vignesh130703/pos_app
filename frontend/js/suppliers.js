// ─── SUPPLIERS MODULE ────────────────────────────────────────────
const suppliers = {
  list: [],
  editId: null,

  async init() {
    await this.load();
    this.setupEvents();
  },

  async load() {
    try {
      this.list = await api.getSuppliers();
      this.render();
    } catch(e) { toast.error('Error', e.message); }
  },

  render() {
    const tbody = el('suppliers-tbody');
    if (!tbody) return;
    if (!this.list.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state" style="padding:20px"><div class="empty-icon">🏭</div><div class="empty-title">No suppliers</div></div></td></tr>`;
      return;
    }
    tbody.innerHTML = this.list.map(s => `<tr>
      <td><strong>${s.name}</strong></td>
      <td>${s.phone ? `<span class="badge badge-gray">📞 ${s.phone}</span>` : '—'}</td>
      <td>${s.email || '—'}</td>
      <td>${s.address || '—'}</td>
      <td>
        <a href="tel:${s.phone}" class="btn btn-success btn-sm">📞 Call</a>
        <a href="https://wa.me/${(s.phone||'').replace(/\D/g,'')}" target="_blank" class="btn btn-secondary btn-sm">💬 WhatsApp</a>
        <button class="btn btn-ghost btn-sm" onclick="suppliers.openEdit(${s.id})">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="suppliers.deleteSupplier(${s.id})">🗑️</button>
      </td>
    </tr>`).join('');
  },

  setupEvents() {
    el('btn-add-supplier')?.addEventListener('click', () => this.openAdd());
    el('supplier-form')?.addEventListener('submit', e => { e.preventDefault(); this.save(); });
  },

  openAdd() {
    this.editId = null;
    el('supplier-modal-title').textContent = '➕ Add Supplier';
    el('supplier-form').reset();
    openModal('modal-supplier');
  },

  openEdit(id) {
    const s = this.list.find(x => x.id === id);
    if (!s) return;
    this.editId = id;
    el('supplier-modal-title').textContent = '✏️ Edit Supplier';
    el('sup-name').value    = s.name;
    el('sup-phone').value   = s.phone || '';
    el('sup-email').value   = s.email || '';
    el('sup-address').value = s.address || '';
    openModal('modal-supplier');
  },

  async save() {
    const data = {
      name:    el('sup-name').value.trim(),
      phone:   el('sup-phone').value.trim(),
      email:   el('sup-email').value.trim(),
      address: el('sup-address').value.trim(),
    };
    if (!data.name) { toast.error('Validation', 'Name required'); return; }
    try {
      if (this.editId) { await api.updateSupplier(this.editId, data); toast.success('Updated', data.name); }
      else              { await api.createSupplier(data); toast.success('Added', data.name); }
      closeModal('modal-supplier');
      this.load();
    } catch(e) { toast.error('Error', e.message); }
  },

  async deleteSupplier(id) {
    if (!confirmDialog('Delete this supplier?')) return;
    await api.deleteSupplier(id);
    toast.success('Deleted');
    this.load();
  },
};

// ─── PURCHASES MODULE ────────────────────────────────────────────
const purchases = {
  items: [],
  supplierList: [],
  products: [],

  async init() {
    await this.loadList();
    await this.loadSuppliers();
    await this.loadProducts();
    this.setupEvents();
  },

  async loadList() {
    try {
      const data = await api.getPurchases();
      this.renderList(data);
    } catch(e) { toast.error('Error', e.message); }
  },

  async loadSuppliers() {
    this.supplierList = await api.getSuppliers().catch(() => []);
    const sel = el('purchase-supplier');
    if (sel) sel.innerHTML = `<option value="">No Supplier</option>` + this.supplierList.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  },

  async loadProducts() {
    this.products = await api.getProducts().catch(() => []);
  },

  renderList(data) {
    const tbody = el('purchases-tbody');
    if (!tbody) return;
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state" style="padding:20px"><div class="empty-icon">📦</div><div class="empty-title">No purchase orders</div></div></td></tr>`;
      return;
    }
    tbody.innerHTML = data.map(p => `<tr>
      <td>#${p.id}</td>
      <td>${p.supplier_name || '—'}</td>
      <td>${fmt.datetime(p.created_at)}</td>
      <td style="font-weight:700;color:var(--success)">${fmt.currency(p.total)}</td>
      <td>${p.created_by_name}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="purchases.viewDetail(${p.id})">👁️ View</button></td>
    </tr>`).join('');
  },

  setupEvents() {
    el('btn-new-purchase')?.addEventListener('click', () => this.openNew());
    el('btn-add-purchase-item')?.addEventListener('click', () => this.addItem());
    el('purchase-form')?.addEventListener('submit', e => { e.preventDefault(); this.save(); });
  },

  openNew() {
    this.items = [];
    el('purchase-form')?.reset();
    this.renderItems();
    openModal('modal-purchase');
  },

  addItem() {
    const productId = parseInt(el('pi-product').value);
    const product = this.products.find(p => p.id === productId);
    if (!product) { toast.warning('Select product'); return; }
    const qty     = parseInt(el('pi-qty').value) || 1;
    const cost    = parseFloat(el('pi-cost').value) || 0;
    const expiry  = el('pi-expiry').value;
    const batch   = el('pi-batch').value;
    this.items.push({ product_id: productId, name: product.name, quantity: qty, cost_price: cost, expiry_date: expiry || null, batch_no: batch || null });
    this.renderItems();
    el('pi-qty').value = 1;
    el('pi-cost').value = '';
    el('pi-expiry').value = '';
  },

  renderItems() {
    const c = el('purchase-items-list');
    if (!c) return;
    if (!this.items.length) { c.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:10px">No items added</div>'; return; }
    const total = this.items.reduce((s, i) => s + i.quantity * i.cost_price, 0);
    c.innerHTML = `<table style="width:100%"><thead><tr><th>Product</th><th>Qty</th><th>Cost</th><th>Expiry</th><th>Total</th><th></th></tr></thead><tbody>` +
    this.items.map((item, i) => `<tr>
      <td><strong>${item.name}</strong></td>
      <td>${item.quantity}</td>
      <td>${fmt.currency(item.cost_price)}</td>
      <td>${item.expiry_date || '—'}</td>
      <td style="font-weight:700">${fmt.currency(item.quantity * item.cost_price)}</td>
      <td><button class="btn btn-danger btn-sm" onclick="purchases.removeItem(${i})">✕</button></td>
    </tr>`).join('') + `</tbody><tfoot><tr><td colspan="4" style="text-align:right;font-weight:700;padding:10px">Grand Total</td><td style="font-weight:800;color:var(--accent-light)">${fmt.currency(total)}</td><td></td></tr></tfoot></table>`;

    // Update product dropdown
    const sel = el('pi-product');
    if (sel) sel.innerHTML = `<option value="">Select Product</option>` + this.products.map(p => `<option value="${p.id}">${p.name} (Stock: ${p.stock||0})</option>`).join('');
  },

  removeItem(idx) {
    this.items.splice(idx, 1);
    this.renderItems();
  },

  async save() {
    if (!this.items.length) { toast.warning('No items', 'Add items first'); return; }
    const payload = {
      supplier_id: parseInt(el('purchase-supplier').value) || null,
      items: this.items,
      notes: el('purchase-notes').value,
    };
    try {
      await api.createPurchase(payload);
      toast.success('Purchase Created!', `${this.items.length} items stocked`);
      closeModal('modal-purchase');
      this.items = [];
      this.loadList();
    } catch(e) { toast.error('Error', e.message); }
  },

  async viewDetail(id) {
    const data = await api.getPurchase(id).catch(() => null);
    if (!data) return;
    alert(`Purchase #${id}\nSupplier: ${data.supplier_id || 'N/A'}\nTotal: ₹${data.total}\nItems: ${data.items?.length || 0}`);
  },
};
