// ─── API MODULE ─────────────────────────────────────────────────
// BASE_URL is derived from wherever this page was opened from,
// so http://192.168.x.x:3000 on cashier computers just works automatically.
const BASE_URL = window.location.origin;

const api = {
  getToken() { return localStorage.getItem('pos_token'); },

  async req(method, path, body = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    const token = this.getToken();
    if (token) opts.headers['x-auth-token'] = token;
    if (body) opts.body = JSON.stringify(body);
    try {
      const res = await fetch(BASE_URL + path, opts);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } catch(e) {
      if (e.message.includes('fetch') || e.message.includes('Failed')) {
        throw new Error('Cannot connect to server. Make sure backend is running on port 3000.');
      }
      throw e;
    }
  },

  get (path)         { return this.req('GET',    path); },
  post(path, body)   { return this.req('POST',   path, body); },
  put (path, body)   { return this.req('PUT',    path, body); },
  del (path)         { return this.req('DELETE', path); },

  // Auth
  login(username, password) { return this.post('/api/auth/login', { username, password }); },
  logout()                  { return this.post('/api/auth/logout'); },
  me()                      { return this.get('/api/auth/me'); },

  // Products
  getProducts(params = {})  {
    const q = new URLSearchParams(params).toString();
    return this.get('/api/products' + (q ? '?' + q : ''));
  },
  getProductByBarcode(code)  { return this.get('/api/products/barcode/' + encodeURIComponent(code)); },
  getProduct(id)             { return this.get('/api/products/' + id); },
  createProduct(data)        { return this.post('/api/products', data); },
  updateProduct(id, data)    { return this.put('/api/products/' + id, data); },
  deleteProduct(id)          { return this.del('/api/products/' + id); },

  // Categories
  getCategories()            { return this.get('/api/categories'); },
  createCategory(name)       { return this.post('/api/categories', { name }); },

  // Inventory & Batches
  getInventory()             { return this.get('/api/inventory'); },
  getBatches(productId)      { return this.get('/api/batches/' + productId); },
  addBatch(data)             { return this.post('/api/batches', data); },
  adjustStock(data)          { return this.post('/api/stock-adjust', data); },

  // Bills
  createBill(data)           { return this.post('/api/bills', data); },
  getBills(params = {})      {
    const q = new URLSearchParams(params).toString();
    return this.get('/api/bills' + (q ? '?' + q : ''));
  },
  getBill(id)                { return this.get('/api/bills/' + id); },
  getBillByNo(no)            { return this.get('/api/bills/no/' + encodeURIComponent(no)); },

  // Returns
  processReturn(data)        { return this.post('/api/returns', data); },
  getReturns()               { return this.get('/api/returns'); },
  getReturn(id)              { return this.get('/api/returns/' + id); },

  // Customers
  getCustomers(params = {})  {
    const q = new URLSearchParams(params).toString();
    return this.get('/api/customers' + (q ? '?' + q : ''));
  },
  getCustomerByPhone(phone)  { return this.get('/api/customers/phone/' + encodeURIComponent(phone)); },
  createCustomer(data)       { return this.post('/api/customers', data); },
  updateCustomer(id, data)   { return this.put('/api/customers/' + id, data); },
  getCustomer(id)            { return this.get('/api/customers/' + id); },

  // Suppliers
  getSuppliers()             { return this.get('/api/suppliers'); },
  createSupplier(data)       { return this.post('/api/suppliers', data); },
  updateSupplier(id, data)   { return this.put('/api/suppliers/' + id, data); },
  deleteSupplier(id)         { return this.del('/api/suppliers/' + id); },

  // Purchases
  createPurchase(data)       { return this.post('/api/purchases', data); },
  getPurchases()             { return this.get('/api/purchases'); },
  getPurchase(id)            { return this.get('/api/purchases/' + id); },

  // Damaged Stock
  getDamagedStock()          { return this.get('/api/damaged-stock'); },
  recordDamage(data)         { return this.post('/api/damaged-stock', data); },

  // Expiry
  getExpiryAlerts()          { return this.get('/api/expiry-alerts'); },

  // Analytics
  getDashboard(period)       { return this.get('/api/analytics/dashboard?period=' + (period || 'today')); },
  getSalesByCategory(period) { return this.get('/api/analytics/sales-by-category?period=' + (period || 'month')); },

  // Notifications
  getNotifications()         { return this.get('/api/notifications'); },
  markRead(id)               { return this.put('/api/notifications/' + id + '/read'); },
  markAllRead()              { return this.put('/api/notifications/read-all'); },

  // Users
  getUsers()                 { return this.get('/api/users'); },
  createUser(data)           { return this.post('/api/users', data); },
  updateUser(id, data)       { return this.put('/api/users/' + id, data); },

  // Audit
  getAuditLogs()             { return this.get('/api/audit-logs'); },

  // Search
  search(q)                  { return this.get('/api/search?q=' + encodeURIComponent(q)); },
};
