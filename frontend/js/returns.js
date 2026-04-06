// ─── RETURNS MODULE ──────────────────────────────────────────────
const returns = {
  currentBill: null,
  returnItems: [],

  async init() {
    await this.loadList();
    this.setupEvents();
  },

  async loadList() {
    try {
      const data = await api.getReturns();
      this.renderList(data);
    } catch(e) { toast.error('Error', e.message); }
  },

  renderList(data) {
    const tbody = el('returns-tbody');
    if (!tbody) return;
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state" style="padding:20px"><div class="empty-icon">🔁</div><div class="empty-title">No returns yet</div></div></td></tr>`;
      return;
    }
    tbody.innerHTML = data.map(r => `<tr>
      <td><strong>${r.return_no}</strong></td>
      <td>${r.bill_no}</td>
      <td>${r.customer_name || 'Walk-in'}</td>
      <td style="color:var(--danger);font-weight:700">${fmt.currency(r.total_refund)}</td>
      <td><span class="badge badge-info">${r.refund_mode}</span></td>
      <td>${r.processed_by_name}</td>
      <td>${fmt.datetime(r.created_at)}</td>
    </tr>`).join('');
  },

  setupEvents() {
    el('returns-bill-search')?.addEventListener('keydown', async e => {
      if (e.key === 'Enter') {
        const val = el('returns-bill-search').value.trim();
        if (!val) return;
        await this.loadBill(val);
      }
    });
    el('btn-search-bill')?.addEventListener('click', async () => {
      const val = el('returns-bill-search').value.trim();
      if (val) await this.loadBill(val);
    });
  },

  async loadBill(billNoOrId) {
    try {
      const bill = isNaN(billNoOrId) ? await api.getBillByNo(billNoOrId) : await api.getBill(billNoOrId);
      this.currentBill = bill;
      this.returnItems = [];
      this.renderBillForReturn(bill);
    } catch(e) { toast.error('Bill Not Found', e.message); }
  },

  renderBillForReturn(bill) {
    const c = el('return-bill-detail');
    if (!c) return;
    const daysDiff = Math.floor((Date.now() - new Date(bill.created_at)) / 86400000);
    const expired30 = daysDiff > 30;
    c.innerHTML = `
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
          <div>
            <div style="font-size:16px;font-weight:700">${bill.bill_no}</div>
            <div style="font-size:12px;color:var(--text-muted)">${fmt.datetime(bill.created_at)} · ${bill.cashier_name}</div>
            ${bill.customer_name ? `<div style="font-size:12px;margin-top:4px">👤 ${bill.customer_name}</div>` : ''}
          </div>
          <div style="text-align:right">
            <div style="font-size:20px;font-weight:800;color:var(--accent-light)">${fmt.currency(bill.total)}</div>
            <span class="badge ${expired30 ? 'badge-danger' : daysDiff > 25 ? 'badge-warning' : 'badge-success'}">
              ${daysDiff} days ago ${expired30 ? '— EXPIRED' : ''}
            </span>
          </div>
        </div>
        ${expired30 ? '<div style="color:var(--danger);font-weight:600;padding:10px;background:var(--danger-bg);border-radius:8px">⚠️ Return period (30 days) has expired for this bill.</div>' : ''}
      </div>
      <div class="card">
        <div class="card-title">Select Items to Return</div>
        <table style="width:100%">
          <thead><tr>
            <th><input type="checkbox" id="select-all-return" onchange="returns.toggleAll(this)"></th>
            <th>Product</th><th>Qty Bought</th><th>Return Qty</th><th>Condition</th><th>Price</th>
          </tr></thead>
          <tbody id="return-items-tbody">
            ${bill.items.map(item => `<tr data-item-id="${item.id}" data-max="${item.quantity}" data-price="${item.unit_price}">
              <td><input type="checkbox" class="return-check" data-id="${item.id}" ${expired30?'disabled':''}></td>
              <td><strong>${item.product_name}</strong></td>
              <td>${item.quantity} ${item.barcode||''}</td>
              <td><input type="number" class="form-control return-qty" data-id="${item.id}" value="1" min="1" max="${item.quantity}" ${expired30?'disabled':''} style="width:70px"></td>
              <td><select class="form-control return-cond" data-id="${item.id}" ${expired30?'disabled':''} style="width:120px">
                <option value="good">🟢 Good</option>
                <option value="damaged">🔴 Damaged</option>
              </select></td>
              <td>${fmt.currency(item.unit_price)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        ${!expired30 ? `
        <div style="margin-top:16px;display:flex;align-items:center;gap:12px">
          <select class="form-control" id="refund-mode" style="width:140px">
            <option value="cash">💵 Cash</option>
            <option value="upi">📱 UPI</option>
            <option value="store_credit">🎫 Store Credit</option>
          </select>
          <button class="btn btn-success" onclick="returns.submitReturn()">✅ Process Return</button>
        </div>` : ''}
      </div>`;
  },

  toggleAll(cb) {
    qsa('.return-check').forEach(c => c.checked = cb.checked);
  },

  async submitReturn() {
    const checked = qsa('.return-check:checked');
    if (!checked.length) { toast.warning('No Items', 'Select items to return'); return; }
    const items = checked.map(cb => {
      const id = cb.dataset.id;
      const qtyInput = qs(`input.return-qty[data-id="${id}"]`);
      const condSelect = qs(`select.return-cond[data-id="${id}"]`);
      return { bill_item_id: parseInt(id), quantity: parseInt(qtyInput?.value || 1), condition: condSelect?.value || 'good' };
    });
    const refundMode = el('refund-mode')?.value || 'cash';
    try {
      const result = await api.processReturn({ bill_id: this.currentBill.id, items, refund_mode: refundMode });
      toast.success('Return Processed!', `${result.return_no} · Refund: ${fmt.currency(result.total_refund)}`);
      el('return-bill-detail').innerHTML = '';
      el('returns-bill-search').value = '';
      this.loadList();
    } catch(e) { toast.error('Error', e.message); }
  },
};

// ─── CUSTOMERS MODULE ────────────────────────────────────────────
const customers = {
  async init() {
    await this.load();
    this.setupEvents();
  },

  async load(search = '') {
    try {
      const data = await api.getCustomers({ search });
      this.render(data);
    } catch(e) { toast.error('Error', e.message); }
  },

  render(data) {
    const tbody = el('customers-tbody');
    if (!tbody) return;
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state" style="padding:20px"><div class="empty-icon">👥</div><div class="empty-title">No customers yet</div></div></td></tr>`;
      return;
    }
    tbody.innerHTML = data.map(c => `<tr>
      <td><strong style="font-size:14px">${c.name}</strong></td>
      <td><span class="badge badge-gray">📞 ${c.phone}</span></td>
      <td>${c.email || '—'}</td>
      <td style="font-weight:700;color:var(--success)">${fmt.currency(c.total_spent)}</td>
      <td><span class="badge badge-purple">⭐ ${c.loyalty_points} pts</span></td>
      <td>${c.last_visit ? fmt.datetime(c.last_visit) : '—'}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="customers.viewDetail(${c.id})">👁️ View</button>
        <button class="btn btn-ghost btn-sm" onclick="customers.openEdit(${c.id})">✏️ Edit</button>
      </td>
    </tr>`).join('');
  },

  setupEvents() {
    el('customer-search-inp')?.addEventListener('input', e => this.load(e.target.value));
    el('btn-add-customer')?.addEventListener('click', () => this.openAdd());
    el('customer-form')?.addEventListener('submit', e => { e.preventDefault(); this.save(); });
  },

  openAdd() {
    el('cust-edit-id').value = '';
    el('customer-modal-title').textContent = '➕ Add Customer';
    el('customer-form').reset();
    openModal('modal-customer');
  },

  async openEdit(id) {
    const c = await api.getCustomer(id).catch(() => null);
    if (!c) return;
    el('cust-edit-id').value = c.id;
    el('customer-modal-title').textContent = '✏️ Edit Customer';
    el('cust-form-name').value  = c.name;
    el('cust-form-phone').value = c.phone;
    el('cust-form-email').value = c.email || '';
    openModal('modal-customer');
  },

  async save() {
    const id = el('cust-edit-id').value;
    const data = {
      name:  el('cust-form-name').value.trim(),
      phone: el('cust-form-phone').value.trim(),
      email: el('cust-form-email').value.trim(),
    };
    if (!data.phone) { toast.error('Validation', 'Phone required'); return; }
    try {
      if (id) { await api.updateCustomer(id, data); toast.success('Updated', data.name); }
      else    { await api.createCustomer(data); toast.success('Added', data.name); }
      closeModal('modal-customer');
      this.load();
    } catch(e) { toast.error('Error', e.message); }
  },

  async viewDetail(id) {
    const c = await api.getCustomer(id).catch(() => null);
    if (!c) return;
    el('cust-detail-body').innerHTML = `
      <div style="display:flex;gap:16px;align-items:flex-start;margin-bottom:20px">
        <div class="user-avatar" style="width:56px;height:56px;font-size:20px;border-radius:14px">${c.name[0]?.toUpperCase()}</div>
        <div>
          <div style="font-size:18px;font-weight:800">${c.name}</div>
          <div style="color:var(--text-muted)">📞 ${c.phone}${c.email ? ' · ' + c.email : ''}</div>
          <div style="margin-top:8px;display:flex;gap:8px">
            <span class="badge badge-success">💰 ${fmt.currency(c.total_spent)}</span>
            <span class="badge badge-purple">⭐ ${c.loyalty_points} pts</span>
            <span class="badge badge-info">📅 Since ${fmt.date(c.created_at)}</span>
          </div>
        </div>
      </div>
      <div style="font-size:13px;font-weight:700;margin-bottom:12px;color:var(--text-muted)">RECENT PURCHASES</div>
      ${!c.bills?.length ? '<div class="empty-state" style="padding:20px"><div class="empty-icon">🛒</div><div class="empty-title">No purchases</div></div>' :
      c.bills.map(b => `<div class="notif-item" style="cursor:default">
        <span style="font-size:20px">🧾</span>
        <div>
          <div style="font-weight:600">${b.bill_no}</div>
          <div style="font-size:12px;color:var(--text-muted)">${fmt.datetime(b.created_at)}</div>
        </div>
        <div style="margin-left:auto;font-weight:700;color:var(--accent-light)">${fmt.currency(b.total)}</div>
      </div>`).join('')}`;
    openModal('modal-customer-detail');
  },
};
