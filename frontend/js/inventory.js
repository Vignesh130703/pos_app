// ─── INVENTORY MODULE ────────────────────────────────────────────
const inventory = {
  list: [],

  async init() {
    await this.load();
    this.setupEvents();
  },

  async load() {
    try {
      this.list = await api.getInventory();
      this.render();
    } catch(e) { toast.error('Error', e.message); }
  },

  render() {
    const tbody = el('inventory-tbody');
    if (!tbody) return;
    const search = el('inv-search')?.value?.toLowerCase() || '';
    const filter = el('inv-filter')?.value || 'all';
    let data = this.list;
    if (search) data = data.filter(p => p.name.toLowerCase().includes(search) || (p.barcode || '').includes(search));
    if (filter === 'low')  data = data.filter(p => p.total_stock > 0 && p.total_stock <= p.min_stock);
    if (filter === 'out')  data = data.filter(p => p.total_stock <= 0);
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state" style="padding:20px"><div class="empty-icon">📦</div><div class="empty-title">No items found</div></div></td></tr>`;
      return;
    }
    tbody.innerHTML = data.map(p => {
      const pct = p.min_stock > 0 ? Math.min(100, (p.total_stock / (p.min_stock * 5)) * 100) : 50;
      const cls = p.total_stock <= 0 ? 'danger' : p.total_stock <= p.min_stock ? 'warning' : 'success';
      return `<tr>
        <td><span class="badge badge-gray" style="font-family:monospace">${p.barcode||'—'}</span></td>
        <td><strong>${p.name}</strong><br><span style="font-size:11px;color:var(--text-muted)">${p.category}</span></td>
        <td>${fmt.currency(p.cost_price)}</td>
        <td>${fmt.currency(p.selling_price)}</td>
        <td>
          <span class="badge badge-${cls}" style="margin-bottom:6px">${p.total_stock} ${p.unit}</span>
          <div class="progress-bar"><div class="progress-fill ${cls}" style="width:${pct}%"></div></div>
          <span style="font-size:10px;color:var(--text-muted)">Min: ${p.min_stock} · ${p.batch_count} batch(es)</span>
        </td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="inventory.openAdjust(${p.id},'${p.name.replace(/'/g,"\\'")}',${p.total_stock})">⚙️ Adjust</button>
          <button class="btn btn-ghost btn-sm" onclick="inventory.openAddBatch(${p.id},'${p.name.replace(/'/g,"\\'")}')">+ Batch</button>
        </td>
      </tr>`;
    }).join('');
  },

  setupEvents() {
    el('inv-search')?.addEventListener('input', () => this.render());
    el('inv-filter')?.addEventListener('change', () => this.render());
    el('btn-refresh-inv')?.addEventListener('click', () => this.load());
  },

  openAdjust(productId, name, currentQty) {
    el('adj-product-name').textContent = name;
    el('adj-product-id').value = productId;
    el('adj-current').textContent = currentQty;
    el('adj-new-qty').value = currentQty;
    openModal('modal-adjust');
  },

  async saveAdjust(e) {
    e.preventDefault();
    const productId = el('adj-product-id').value;
    const newQty    = parseInt(el('adj-new-qty').value);
    const reason    = el('adj-reason').value;
    try {
      await api.adjustStock({ product_id: productId, new_quantity: newQty, reason });
      toast.success('Stock Adjusted', `New quantity: ${newQty}`);
      closeModal('modal-adjust');
      this.load();
    } catch(e) { toast.error('Error', e.message); }
  },

  openAddBatch(productId, name) {
    el('nb-product-name').textContent = name;
    el('nb-product-id').value = productId;
    el('nb-form').reset();
    el('nb-product-id').value = productId;
    openModal('modal-new-batch');
  },

  async saveNewBatch(e) {
    e.preventDefault();
    const data = {
      product_id:     parseInt(el('nb-product-id').value),
      quantity:       parseInt(el('nb-qty').value),
      purchase_price: parseFloat(el('nb-purchase-price').value) || 0,
      expiry_date:    el('nb-expiry').value || null,
      batch_no:       el('nb-batchno').value || null,
    };
    try {
      await api.addBatch(data);
      toast.success('Batch Added', `${data.quantity} units added`);
      closeModal('modal-new-batch');
      this.load();
    } catch(e) { toast.error('Error', e.message); }
  },
};

// ─── EXPIRY MODULE ───────────────────────────────────────────────
const expiry = {
  async init() {
    try {
      const data = await api.getExpiryAlerts();
      this.render(data);
    } catch(e) { toast.error('Error', e.message); }
  },

  render(data) {
    this.renderSection('expiry-expired', data.expired, 'danger', '☠️ Expired');
    this.renderSection('expiry-3days', data.expiring3, 'warning', '⚠️ Expiring in 3 days');
    this.renderSection('expiry-7days', data.expiring7, 'info', '⏳ Expiring in 7 days');

    el('stat-expired').textContent  = data.expired.length;
    el('stat-exp3').textContent     = data.expiring3.length;
    el('stat-exp7').textContent     = data.expiring7.length;
  },

  renderSection(containerId, items, cls, label) {
    const c = el(containerId);
    if (!c) return;
    if (!items || !items.length) {
      c.innerHTML = `<div class="empty-state" style="padding:20px"><div class="empty-icon">✅</div><div class="empty-title">None</div></div>`;
      return;
    }
    c.innerHTML = `<table style="width:100%"><thead><tr>
      <th>Product</th><th>Barcode</th><th>Batch</th><th>Qty</th><th>Expiry Date</th><th>Action</th>
    </tr></thead><tbody>` +
    items.map(b => `<tr>
      <td><strong>${b.product_name}</strong></td>
      <td><span class="badge badge-gray">${b.barcode||'—'}</span></td>
      <td>#${b.id}</td>
      <td>${b.quantity}</td>
      <td><span class="badge badge-${cls}">${b.expiry_date}</span></td>
      <td><button class="btn btn-danger btn-sm" onclick="expiry.recordDamage(${b.product_id},${b.quantity},'Expired batch #${b.id}')">Mark Damaged</button></td>
    </tr>`).join('') + `</tbody></table>`;
  },

  async recordDamage(productId, qty, reason) {
    if (!confirmDialog(`Mark ${qty} units as damaged?`)) return;
    try {
      await api.recordDamage({ product_id: productId, quantity: qty, reason });
      toast.success('Recorded', 'Items moved to damaged stock');
      this.init();
    } catch(e) { toast.error('Error', e.message); }
  },
};
