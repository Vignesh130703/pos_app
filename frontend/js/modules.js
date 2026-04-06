// ─── ANALYTICS MODULE ─────────────────────────────────────────────
const analytics = {
  salesChart: null,
  catChart: null,

  async init() {
    await this.load('today');
    this.setupEvents();
  },

  setupEvents() {
    qsa('.analytics-period').forEach(btn => {
      btn.addEventListener('click', () => {
        qsa('.analytics-period').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.load(btn.dataset.period);
      });
    });
  },

  async load(period = 'today') {
    try {
      const [dash, catData] = await Promise.all([api.getDashboard(period), api.getSalesByCategory(period)]);
      this.renderStats(dash);
      this.renderTopProducts(dash.topProducts);
      this.renderLowStock(dash.lowStock);
      this.renderPaymentChart(dash.paymentBreakdown);
      this.renderSalesChart(dash.dailySales);
      this.renderCategoryChart(catData);
    } catch(e) { toast.error('Error', e.message); }
  },

  renderStats(dash) {
    el('an-revenue').textContent    = fmt.currency(dash.totalSales?.revenue || 0);
    el('an-bills').textContent      = dash.totalSales?.bills || 0;
    el('an-profit').textContent     = fmt.currency(dash.profit || 0);
    el('an-damage').textContent     = fmt.currency(dash.damagedLoss?.total || 0);
    el('an-customers').textContent  = fmt.number(dash.totalCustomers?.count || 0);
    el('an-products').textContent   = fmt.number(dash.totalProducts?.count || 0);
  },

  renderTopProducts(products = []) {
    const c = el('top-products-list');
    if (!c) return;
    if (!products.length) { c.innerHTML = '<div class="empty-state" style="padding:20px"><div class="empty-icon">📊</div><div class="empty-title">No sales data</div></div>'; return; }
    c.innerHTML = products.map((p, i) => `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-light)">
        <div style="width:28px;height:28px;background:var(--accent-glow);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;color:var(--accent-light)">${i+1}</div>
        <div style="flex:1">
          <div style="font-weight:600;font-size:13px">${p.name}</div>
          <div style="font-size:11px;color:var(--text-muted)">${p.qty_sold} units sold</div>
        </div>
        <div style="font-weight:700;color:var(--success)">${fmt.currency(p.revenue)}</div>
      </div>`).join('');
  },

  renderLowStock(items = []) {
    const c = el('low-stock-list');
    if (!c) return;
    if (!items.length) { c.innerHTML = '<div class="empty-state" style="padding:20px"><div class="empty-icon">✅</div><div class="empty-title">All stocks sufficient</div></div>'; return; }
    c.innerHTML = items.map(p => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-light)">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600">${p.name}</div>
          <div style="font-size:11px;color:var(--text-muted)">${p.category}</div>
        </div>
        <span class="badge badge-${p.stock <= 0 ? 'danger' : 'warning'}">${p.stock||0} left</span>
      </div>`).join('');
  },

  renderPaymentChart(data = []) {
    const canvas = el('payment-chart');
    if (!canvas || !window.Chart) return;
    if (this.paymentChart) this.paymentChart.destroy();
    const colors = ['#6c63ff','#22c55e','#f59e0b','#3b82f6','#ef4444'];
    this.paymentChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: data.map(d => d.payment_mode.toUpperCase()),
        datasets: [{ data: data.map(d => d.amount), backgroundColor: colors, borderWidth: 2, borderColor: '#1a1d27' }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } } },
    });
  },

  renderSalesChart(dailySales = []) {
    const canvas = el('sales-chart');
    if (!canvas || !window.Chart) return;
    if (this.salesChart) this.salesChart.destroy();
    this.salesChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: dailySales.map(d => d.date),
        datasets: [{
          label: 'Revenue',
          data: dailySales.map(d => d.revenue),
          borderColor: '#6c63ff',
          backgroundColor: 'rgba(108,99,255,0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#6c63ff',
          pointRadius: 4,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#94a3b8' } } },
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: '#64748b', callback: v => '₹' + fmt.number(v) }, grid: { color: 'rgba(255,255,255,0.05)' } },
        },
      },
    });
  },

  renderCategoryChart(data = []) {
    const canvas = el('category-chart');
    if (!canvas || !window.Chart) return;
    if (this.catChart) this.catChart.destroy();
    const colors = ['#6c63ff','#22c55e','#f59e0b','#3b82f6','#ef4444','#a855f7','#ec4899','#14b8a6'];
    this.catChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.map(d => d.category),
        datasets: [{ label: 'Revenue', data: data.map(d => d.revenue), backgroundColor: colors, borderRadius: 6 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: '#64748b', callback: v => '₹' + fmt.number(v) }, grid: { color: 'rgba(255,255,255,0.05)' } },
        },
      },
    });
  },
};

// ─── BILLS HISTORY MODULE ─────────────────────────────────────────
const billsHistory = {
  async init() {
    await this.load();
    this.setupEvents();
  },

  async load(params = {}) {
    try {
      const data = await api.getBills({ limit: 100, ...params });
      this.render(data.bills);
    } catch(e) { toast.error('Error', e.message); }
  },

  render(bills) {
    const tbody = el('bills-tbody');
    if (!tbody) return;
    if (!bills.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state" style="padding:20px"><div class="empty-icon">🧾</div><div class="empty-title">No bills</div></div></td></tr>`;
      return;
    }
    tbody.innerHTML = bills.map(b => `<tr>
      <td><strong>${b.bill_no}</strong></td>
      <td>${b.customer_name || 'Walk-in'}</td>
      <td>${b.cashier_name}</td>
      <td>${fmt.currency(b.subtotal)}</td>
      <td style="color:var(--success)">${fmt.currency(b.gst_amount)}</td>
      <td style="font-weight:700;font-size:15px;color:var(--accent-light)">${fmt.currency(b.total)}</td>
      <td><span class="badge badge-info">${b.payment_mode}</span></td>
      <td>${fmt.datetime(b.created_at)}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="billsHistory.viewBill(${b.id})">👁️</button>
        <button class="btn btn-ghost btn-sm" onclick="billsHistory.printBill(${b.id})">🖨️</button>
      </td>
    </tr>`).join('');
  },

  setupEvents() {
    el('bills-date-filter')?.addEventListener('change', e => this.load({ date: e.target.value }));
    el('btn-refresh-bills')?.addEventListener('click', () => this.load());
  },

  async viewBill(id) {
    try {
      const bill = await api.getBill(id);
      el('receipt-content').innerHTML = billing.buildReceiptHTML(bill);
      openModal('modal-receipt');
    } catch(e) { toast.error('Error', e.message); }
  },

  async printBill(id) {
    await this.viewBill(id);
    setTimeout(() => window.print(), 300);
  },
};

// ─── DAMAGED STOCK MODULE ─────────────────────────────────────────
const damagedStock = {
  products: [],

  async init() {
    await this.load();
    this.products = await api.getProducts().catch(() => []);
    const sel = el('damage-product');
    if (sel) sel.innerHTML = `<option value="">Select Product</option>` + this.products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    el('damage-form')?.addEventListener('submit', e => { e.preventDefault(); this.save(); });
  },

  async load() {
    try {
      const data = await api.getDamagedStock();
      this.renderStats(data);
      this.renderList(data.items);
    } catch(e) { toast.error('Error', e.message); }
  },

  renderStats(data) {
    if (el('damage-total-loss')) el('damage-total-loss').textContent = fmt.currency(data.totalLoss);
    if (el('damage-total-count')) el('damage-total-count').textContent = (data.items || []).length;
  },

  renderList(items) {
    const tbody = el('damaged-tbody');
    if (!tbody) return;
    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state" style="padding:20px"><div class="empty-icon">✅</div><div class="empty-title">No damaged stock recorded</div></div></td></tr>`;
      return;
    }
    tbody.innerHTML = items.map(d => `<tr>
      <td><strong>${d.product_name}</strong></td>
      <td>${d.quantity}</td>
      <td>${fmt.currency(d.selling_price)}</td>
      <td style="color:var(--danger);font-weight:700">${fmt.currency(d.estimated_loss)}</td>
      <td>${d.reason || '—'}</td>
      <td>${d.recorded_by_name || '—'}</td>
      <td>${fmt.datetime(d.created_at)}</td>
    </tr>`).join('');
  },

  async save() {
    const data = {
      product_id: parseInt(el('damage-product').value),
      quantity:   parseInt(el('damage-qty').value),
      reason:     el('damage-reason').value,
    };
    if (!data.product_id || !data.quantity) { toast.error('Validation', 'Product and quantity required'); return; }
    try {
      const r = await api.recordDamage(data);
      toast.success('Recorded', `Estimated loss: ${fmt.currency(r.estimatedLoss)}`);
      el('damage-form').reset();
      this.load();
    } catch(e) { toast.error('Error', e.message); }
  },
};

// ─── USERS MODULE ────────────────────────────────────────────────
const usersModule = {
  async init() {
    await this.load();
    el('user-mgmt-form')?.addEventListener('submit', e => { e.preventDefault(); this.save(); });
  },

  async load() {
    try {
      const users = await api.getUsers();
      this.render(users);
    } catch(e) { toast.error('Error', e.message); }
  },

  render(users) {
    const c = el('users-list');
    if (!c) return;
    c.innerHTML = users.map(u => `
      <div class="card" style="display:flex;align-items:center;gap:14px;margin-bottom:10px">
        <div class="user-avatar" style="width:44px;height:44px;font-size:16px">${u.name[0]?.toUpperCase()}</div>
        <div style="flex:1">
          <div style="font-weight:700">${u.name}</div>
          <div style="font-size:12px;color:var(--text-muted)">@${u.username}</div>
        </div>
        <span class="badge badge-${u.role === 'admin' ? 'purple' : 'info'}">${u.role}</span>
        <span class="badge badge-${u.is_active ? 'success' : 'danger'}">${u.is_active ? 'Active' : 'Inactive'}</span>
        <button class="btn btn-secondary btn-sm" onclick="usersModule.toggleActive(${u.id}, ${u.is_active ? 0 : 1}, '${u.name}', '${u.username}', '${u.role}')">
          ${u.is_active ? '🚫 Disable' : '✅ Enable'}
        </button>
      </div>`).join('');
  },

  async save() {
    const data = {
      name:     el('new-user-name').value.trim(),
      username: el('new-user-username').value.trim(),
      password: el('new-user-password').value,
      role:     el('new-user-role').value,
    };
    if (!data.name || !data.username || !data.password) { toast.error('Validation', 'All fields required'); return; }
    try {
      await api.createUser(data);
      toast.success('User Created', `@${data.username} (${data.role})`);
      el('user-mgmt-form').reset();
      this.load();
    } catch(e) { toast.error('Error', e.message); }
  },

  async toggleActive(id, newStatus, name, username, role) {
    await api.updateUser(id, { name, username, role, is_active: newStatus });
    toast.info(newStatus ? 'Enabled' : 'Disabled', name);
    this.load();
  },
};

// ─── NOTIFICATIONS MODULE ─────────────────────────────────────────
const notifications = {
  async load() {
    try {
      const data = await api.getNotifications();
      this.render(data.notifications);
      app.notifCount = data.unread;
      app.updateBadge();
    } catch(e) {}
  },

  render(items) {
    const c = el('notif-list');
    if (!c) return;
    if (!items.length) { c.innerHTML = '<div class="empty-state" style="padding:30px"><div class="empty-icon">🔔</div><div class="empty-title">No notifications</div></div>'; return; }
    const icons = { low_stock: '📦', expiry_warning: '⚠️', expiry_info: '🗓️', info: 'ℹ️' };
    c.innerHTML = items.map(n => `
      <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="notifications.markRead(${n.id}, this)">
        <span class="notif-icon">${icons[n.type] || '🔔'}</span>
        <div>
          <div class="notif-title">${n.title}</div>
          <div class="notif-msg">${n.message || ''}</div>
          <div class="notif-time">${fmt.datetime(n.created_at)}</div>
        </div>
      </div>`).join('');
  },

  async markRead(id, el) {
    await api.markRead(id);
    el?.classList.remove('unread');
    app.notifCount = Math.max(0, app.notifCount - 1);
    app.updateBadge();
  },
};

// ─── AUDIT LOGS MODULE ────────────────────────────────────────────
const auditLogs = {
  async init() {
    try {
      const logs = await api.getAuditLogs();
      this.render(logs);
    } catch(e) { toast.error('Error', e.message); }
  },

  render(logs) {
    const c = el('audit-list');
    if (!c) return;
    if (!logs.length) { c.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">No audit logs</div></div>'; return; }
    c.innerHTML = logs.map(log => `
      <div class="audit-item">
        <div style="flex:1">
          <span class="audit-action">${log.action}</span>
          <span class="audit-user"> by ${log.username || 'System'}</span>
          ${log.details ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">${log.details}</div>` : ''}
        </div>
        <div style="font-size:11px;color:var(--text-muted);white-space:nowrap">${fmt.datetime(log.created_at)}</div>
      </div>`).join('');
  },
};

// ─── PAGE LOADER REGISTRY ─────────────────────────────────────────
const pageLoaders = {
  billing:   () => billing.init(),
  products:  () => products.init(),
  inventory: () => inventory.init(),
  expiry:    () => expiry.init(),
  returns:   () => returns.init(),
  customers: () => customers.init(),
  suppliers: () => suppliers.init(),
  purchases: () => purchases.init(),
  bills:     () => billsHistory.init(),
  damaged:   () => damagedStock.init(),
  analytics: () => analytics.init(),
  users:     () => usersModule.init(),
  audit:     () => auditLogs.init(),
};

// ─── BOOT ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => app.init());
