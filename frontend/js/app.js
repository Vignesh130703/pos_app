// ─── TOAST SYSTEM ───────────────────────────────────────────────
const toast = {
  show(title, msg, type = 'info', duration = 3500) {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `
      <span class="toast-icon">${icons[type]}</span>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
      </div>`;
    c.appendChild(t);
    setTimeout(() => {
      t.classList.add('removing');
      setTimeout(() => t.remove(), 250);
    }, duration);
  },
  success(title, msg) { this.show(title, msg, 'success'); },
  error(title, msg)   { this.show(title, msg, 'error', 5000); },
  warning(title, msg) { this.show(title, msg, 'warning'); },
  info(title, msg)    { this.show(title, msg, 'info'); },
};

// ─── HELPERS ─────────────────────────────────────────────────────
const fmt = {
  currency(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },
  date(d)     { if (!d) return '—'; return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); },
  datetime(d) { if (!d) return '—'; return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); },
  percent(n)  { return Number(n || 0).toFixed(1) + '%'; },
  number(n)   { return Number(n || 0).toLocaleString('en-IN'); },
};

function el(id) { return document.getElementById(id); }
function qs(sel, ctx = document) { return ctx.querySelector(sel); }
function qsa(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function closeAllModals() { qsa('.modal-overlay').forEach(m => m.classList.remove('open')); }

function confirmDialog(message) { return window.confirm(message); }

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(); osc.stop(ctx.currentTime + 0.15);
  } catch(e) {}
}

function loadingBtn(btn, loading) {
  if (loading) {
    btn._text = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span>`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn._text || btn.innerHTML;
  }
}

// ─── APP STATE ────────────────────────────────────────────────────
const app = {
  user: null,
  currentPage: 'billing',
  notifCount: 0,

  init() {
    this.checkAuth();
    this.setupClock();
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
  },

  async checkAuth() {
    const token = localStorage.getItem('pos_token');
    const userData = localStorage.getItem('pos_user');
    if (!token || !userData) { this.showLogin(); return; }
    try {
      this.user = JSON.parse(userData);
      await api.me(); // validate token
      this.showApp();
    } catch(e) {
      this.showLogin();
    }
  },

  showLogin() {
    el('login-page').classList.add('active');
    el('app-shell').style.display = 'none';
    auth.init();
  },

  showApp() {
    el('login-page').classList.remove('active');
    el('app-shell').style.display = 'flex';
    this.renderUserInfo();
    this.setupNav();
    this.navigateTo(this.currentPage);
    this.pollNotifications();
    this.initExpiryCheck();
  },

  renderUserInfo() {
    if (!this.user) return;
    const initials = this.user.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    el('user-avatar').textContent = initials;
    el('user-name').textContent = this.user.name;
    el('user-role').textContent = this.user.role;
    // Hide admin-only nav items for cashier
    if (this.user.role !== 'admin') {
      qsa('.admin-only').forEach(el => el.style.display = 'none');
    }
  },

  setupNav() {
    qsa('[data-page]').forEach(item => {
      item.addEventListener('click', () => {
        this.navigateTo(item.dataset.page);
      });
    });
  },

  navigateTo(pageId) {
    this.currentPage = pageId;
    qsa('[data-page]').forEach(item => item.classList.toggle('active', item.dataset.page === pageId));
    qsa('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + pageId));

    const pageLoader = pageLoaders[pageId];
    if (pageLoader) pageLoader();

    const titles = {
      billing: 'Billing', products: 'Products', inventory: 'Inventory',
      expiry: 'Expiry Management', returns: 'Returns', customers: 'Customers',
      suppliers: 'Suppliers', purchases: 'Purchases', bills: 'Bill History',
      damaged: 'Damaged Stock', analytics: 'Analytics Dashboard', users: 'User Management', audit: 'Audit Logs',
    };
    el('page-title').textContent = titles[pageId] || pageId;
  },

  setupEventListeners() {
    // Logout
    el('btn-logout').addEventListener('click', () => auth.logout());

    // Notification bell
    el('btn-notif').addEventListener('click', () => {
      const panel = el('notif-panel');
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) notifications.load();
    });

    // Close modals on overlay click
    qsa('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.classList.remove('open');
      });
    });

    // Mark all read
    el('btn-mark-all-read')?.addEventListener('click', async () => {
      await api.markAllRead();
      this.notifCount = 0;
      this.updateBadge();
      notifications.load();
    });
  },

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
      if (e.altKey) {
        const shortcuts = {
          'b': 'billing', 'p': 'products', 'i': 'inventory',
          'r': 'returns', 'c': 'customers', 'a': 'analytics',
          's': 'suppliers', 'h': 'bills',
        };
        if (shortcuts[e.key]) {
          e.preventDefault();
          this.navigateTo(shortcuts[e.key]);
        }
      }
      // Ctrl+T ➜ new billing tab
      if ((e.ctrlKey || e.metaKey) && e.key === 't' && this.currentPage === 'billing') {
        e.preventDefault();
        billing.addTab();
      }
      if (e.key === 'Escape') closeAllModals();
      if (e.key === 'F2') { this.navigateTo('billing'); billing.focusScan(); }
    });
  },

  setupClock() {
    const update = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
      el('topbar-time').textContent = `${dateStr}  ${timeStr}`;
    };
    update();
    setInterval(update, 1000);
  },

  async pollNotifications() {
    const load = async () => {
      try {
        const data = await api.getNotifications();
        this.notifCount = data.unread || 0;
        this.updateBadge();
      } catch(e) {}
    };
    load();
    setInterval(load, 30000);
  },

  updateBadge() {
    const badge = qs('#btn-notif .badge');
    if (badge) {
      badge.textContent = this.notifCount;
      badge.style.display = this.notifCount > 0 ? 'flex' : 'none';
    }
  },

  async initExpiryCheck() {
    try {
      const data = await api.getExpiryAlerts();
      if (data.expired?.length) toast.warning('Expired Items', `${data.expired.length} batch(es) have expired!`);
      else if (data.expiring3?.length) toast.warning('Expiry Alert', `${data.expiring3.length} batch(es) expire within 3 days!`);
    } catch(e) {}
  },
};

// ─── QUICK-ADD PRODUCT (from billing modal) ────────────────────────
async function quickAddProduct(event) {
  event.preventDefault();
  const data = {
    barcode:       el('qp-barcode').value.trim() || null,
    name:          el('qp-name').value.trim(),
    category:      el('qp-category').value,
    cost_price:    parseFloat(el('qp-cost').value) || 0,
    selling_price: parseFloat(el('qp-price').value),
    gst_percent:   parseFloat(el('qp-gst').value) || 0,
    unit:          el('qp-unit').value,
    min_stock:     parseInt(el('qp-minstock').value) || 5,
  };
  if (!data.name || !data.selling_price) { toast.error('Validation', 'Name and sell price required'); return; }
  try {
    const result = await api.createProduct(data);
    const qty = parseInt(el('qp-qty').value) || 0;
    if (qty > 0 && result.id) {
      await api.addBatch({ product_id: result.id, quantity: qty, purchase_price: data.cost_price });
    }
    const fullProduct = await api.getProduct(result.id);
    billing.addToCart({ ...fullProduct, stock: qty || 999 });
    closeModal('modal-quick-add');
    toast.success('Product Added!', `${data.name} added and put in cart`);
  } catch(e) { toast.error('Error', e.message); }
}
