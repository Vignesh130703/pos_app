
'use strict';
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// ─── DATABASE SETUP ───────────────────────────────────────────────────────────
const db = new sqlite3.Database(path.join(__dirname, 'pos.db'));

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err); else resolve(this);
    });
  });
}
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => { if (err) reject(err); else resolve(row); });
  });
}
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows); });
  });
}
function dbExec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, err => { if (err) reject(err); else resolve(); });
  });
}

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
async function initDB() {
  await dbExec(`PRAGMA foreign_keys = ON;`);
  await dbExec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'cashier',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'General',
      cost_price REAL DEFAULT 0,
      selling_price REAL NOT NULL,
      gst_percent REAL DEFAULT 0,
      unit TEXT DEFAULT 'pcs',
      min_stock INTEGER DEFAULT 5,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      purchase_price REAL DEFAULT 0,
      purchase_date TEXT DEFAULT (date('now','localtime')),
      expiry_date TEXT,
      batch_no TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE NOT NULL,
      name TEXT DEFAULT 'Walk-in Customer',
      email TEXT,
      total_spent REAL DEFAULT 0,
      loyalty_points INTEGER DEFAULT 0,
      last_visit TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS product_suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      supplier_id INTEGER,
      last_price REAL,
      last_date TEXT,
      UNIQUE(product_id, supplier_id)
    );
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER,
      total REAL DEFAULT 0,
      notes TEXT,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER,
      product_id INTEGER,
      quantity INTEGER NOT NULL,
      cost_price REAL DEFAULT 0,
      expiry_date TEXT,
      batch_no TEXT
    );
    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_no TEXT UNIQUE NOT NULL,
      customer_id INTEGER,
      subtotal REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      gst_amount REAL DEFAULT 0,
      total REAL DEFAULT 0,
      amount_paid REAL DEFAULT 0,
      payment_mode TEXT DEFAULT 'cash',
      payment_split TEXT,
      status TEXT DEFAULT 'paid',
      cashier_id INTEGER,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS bill_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER,
      product_id INTEGER,
      product_name TEXT,
      barcode TEXT,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      discount_percent REAL DEFAULT 0,
      gst_percent REAL DEFAULT 0,
      total_price REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_no TEXT UNIQUE NOT NULL,
      bill_id INTEGER,
      customer_id INTEGER,
      total_refund REAL DEFAULT 0,
      refund_mode TEXT DEFAULT 'cash',
      status TEXT DEFAULT 'completed',
      processed_by INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER,
      bill_item_id INTEGER,
      product_id INTEGER,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      condition TEXT DEFAULT 'good',
      reason TEXT
    );
    CREATE TABLE IF NOT EXISTS damaged_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      quantity INTEGER NOT NULL,
      reason TEXT,
      estimated_loss REAL DEFAULT 0,
      recorded_by INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      action TEXT NOT NULL,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      is_read INTEGER DEFAULT 0,
      related_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      user_id INTEGER,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // Seed defaults
  const adminExists = await dbGet('SELECT id FROM users WHERE role = ?', ['admin']);
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    await dbRun('INSERT INTO users (name,username,password_hash,role) VALUES (?,?,?,?)', ['Admin', 'admin', hash, 'admin']);
    const ch = bcrypt.hashSync('cashier123', 10);
    await dbRun('INSERT INTO users (name,username,password_hash,role) VALUES (?,?,?,?)', ['Cashier', 'cashier', ch, 'cashier']);

    for (const cat of ['General','Electronics','Groceries','Beverages','Dairy','Bakery','Snacks','Household','Personal Care','Medicines']) {
      await dbRun('INSERT OR IGNORE INTO categories (name) VALUES (?)', [cat]);
    }

    const demoProducts = [
      { barcode:'8901030751424', name:'Amul Butter 500g', category:'Dairy', cost_price:240, selling_price:280, gst_percent:5 },
      { barcode:'8904109505124', name:'Britannia Good Day 200g', category:'Bakery', cost_price:25, selling_price:35, gst_percent:5 },
      { barcode:'8901719120954', name:"Lay's Classic Salted 50g", category:'Snacks', cost_price:18, selling_price:25, gst_percent:12 },
      { barcode:'8901030784521', name:'Coca-Cola 500ml', category:'Beverages', cost_price:20, selling_price:30, gst_percent:12 },
      { barcode:'8906001112345', name:'Surf Excel 1kg', category:'Household', cost_price:115, selling_price:145, gst_percent:18 },
      { barcode:'8901262033070', name:'Parle-G Biscuits 800g', category:'Bakery', cost_price:60, selling_price:80, gst_percent:5 },
      { barcode:'8901858810039', name:'Maggi Noodles 70g', category:'Groceries', cost_price:12, selling_price:15, gst_percent:12 },
    ];
    for (const p of demoProducts) {
      const r = await dbRun('INSERT OR IGNORE INTO products (barcode,name,category,cost_price,selling_price,gst_percent,unit) VALUES (?,?,?,?,?,?,?)',
        [p.barcode, p.name, p.category, p.cost_price, p.selling_price, p.gst_percent, 'pcs']);
      if (r.lastID) {
        await dbRun('INSERT INTO batches (product_id,quantity,purchase_price,expiry_date) VALUES (?,?,?,?)', [r.lastID, 50, p.cost_price, '2027-12-31']);
      }
    }
    await dbRun('INSERT OR IGNORE INTO suppliers (name,phone,email) VALUES (?,?,?)', ['Metro Cash & Carry', '9876543210', 'metro@example.com']);
    await dbRun('INSERT OR IGNORE INTO suppliers (name,phone,email) VALUES (?,?,?)', ['Reliance Fresh Wholesale', '9123456789', 'reliance@example.com']);
    console.log('✅ Default data seeded');
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
async function auditLog(userId, username, action, details) {
  try {
    await dbRun('INSERT INTO audit_logs (user_id,username,action,details) VALUES (?,?,?,?)',
      [userId, username, action, typeof details === 'object' ? JSON.stringify(details) : (details || null)]);
  } catch(e) {}
}

async function getStock(productId) {
  const r = await dbGet('SELECT COALESCE(SUM(quantity),0) as stock FROM batches WHERE product_id=?', [productId]);
  return r ? r.stock : 0;
}

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
async function authMiddleware(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const session = await dbGet(
      `SELECT s.*, u.id as uid, u.name, u.username, u.role FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token=? AND datetime(s.expires_at) > datetime('now')`,
      [token]
    );
    if (!session) return res.status(401).json({ error: 'Invalid or expired session' });
    req.user = { id: session.uid, name: session.name, username: session.username, role: session.role };
    next();
  } catch(e) { res.status(500).json({ error: e.message }); }
}
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}
function wrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(e => res.status(500).json({ error: e.message }));
}

// ─── AUTH ROUTES ──────────────────────────────────────────────────────────────
app.post('/api/auth/login', wrap(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const user = await dbGet('SELECT * FROM users WHERE username=? AND is_active=1', [username]);
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Invalid credentials' });
  const token = uuidv4();
  const exp = new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace('T',' ').substring(0,19);
  await dbRun('INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,?)', [token, user.id, exp]);
  await auditLog(user.id, user.username, 'LOGIN', null);
  res.json({ token, user: { id: user.id, name: user.name, username: user.username, role: user.role } });
}));

app.post('/api/auth/logout', authMiddleware, wrap(async (req, res) => {
  await dbRun('DELETE FROM sessions WHERE token=?', [req.headers['x-auth-token']]);
  res.json({ success: true });
}));

app.get('/api/auth/me', authMiddleware, wrap(async (req, res) => {
  res.json({ user: req.user });
}));

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────
app.get('/api/products', authMiddleware, wrap(async (req, res) => {
  const { search, category } = req.query;
  let sql = `SELECT p.*, COALESCE(SUM(b.quantity),0) as stock FROM products p LEFT JOIN batches b ON p.id=b.product_id WHERE p.is_active=1`;
  const params = [];
  if (search) { sql += ` AND (p.name LIKE ? OR p.barcode LIKE ?)`; params.push(`%${search}%`, `%${search}%`); }
  if (category) { sql += ` AND p.category=?`; params.push(category); }
  sql += ` GROUP BY p.id ORDER BY p.name`;
  res.json(await dbAll(sql, params));
}));

app.get('/api/products/barcode/:code', authMiddleware, wrap(async (req, res) => {
  const p = await dbGet(`SELECT p.*, COALESCE(SUM(b.quantity),0) as stock FROM products p LEFT JOIN batches b ON p.id=b.product_id WHERE p.barcode=? AND p.is_active=1 GROUP BY p.id`, [req.params.code]);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  res.json(p);
}));

app.get('/api/products/:id', authMiddleware, wrap(async (req, res) => {
  const p = await dbGet(`SELECT p.*, COALESCE(SUM(b.quantity),0) as stock FROM products p LEFT JOIN batches b ON p.id=b.product_id WHERE p.id=? GROUP BY p.id`, [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Not found' });
  const batches = await dbAll('SELECT * FROM batches WHERE product_id=? ORDER BY expiry_date ASC', [req.params.id]);
  const suppliers = await dbAll('SELECT s.*, ps.last_price, ps.last_date FROM suppliers s JOIN product_suppliers ps ON s.id=ps.supplier_id WHERE ps.product_id=?', [req.params.id]);
  res.json({ ...p, batches, suppliers });
}));

app.post('/api/products', authMiddleware, adminOnly, wrap(async (req, res) => {
  const { barcode, name, category, cost_price, selling_price, gst_percent, unit, min_stock } = req.body;
  if (!name || !selling_price) return res.status(400).json({ error: 'Name and selling price required' });
  const r = await dbRun('INSERT INTO products (barcode,name,category,cost_price,selling_price,gst_percent,unit,min_stock) VALUES (?,?,?,?,?,?,?,?)',
    [barcode || null, name, category || 'General', cost_price || 0, selling_price, gst_percent || 0, unit || 'pcs', min_stock || 5]);
  await auditLog(req.user.id, req.user.username, 'ADD_PRODUCT', { name });
  res.json({ id: r.lastID, success: true });
}));

app.put('/api/products/:id', authMiddleware, adminOnly, wrap(async (req, res) => {
  const { barcode, name, category, cost_price, selling_price, gst_percent, unit, min_stock } = req.body;
  await dbRun('UPDATE products SET barcode=?,name=?,category=?,cost_price=?,selling_price=?,gst_percent=?,unit=?,min_stock=? WHERE id=?',
    [barcode, name, category, cost_price, selling_price, gst_percent, unit, min_stock, req.params.id]);
  await auditLog(req.user.id, req.user.username, 'EDIT_PRODUCT', { id: req.params.id, name });
  res.json({ success: true });
}));

app.delete('/api/products/:id', authMiddleware, adminOnly, wrap(async (req, res) => {
  await dbRun('UPDATE products SET is_active=0 WHERE id=?', [req.params.id]);
  await auditLog(req.user.id, req.user.username, 'DELETE_PRODUCT', { id: req.params.id });
  res.json({ success: true });
}));

// ─── CATEGORIES ────────────────────────────────────────────────────────────────
app.get('/api/categories', authMiddleware, wrap(async (req, res) => {
  res.json(await dbAll('SELECT * FROM categories ORDER BY name'));
}));
app.post('/api/categories', authMiddleware, adminOnly, wrap(async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const r = await dbRun('INSERT OR IGNORE INTO categories (name) VALUES (?)', [name]);
  res.json({ id: r.lastID, name });
}));

// ─── INVENTORY / BATCHES ───────────────────────────────────────────────────────
app.get('/api/inventory', authMiddleware, wrap(async (req, res) => {
  res.json(await dbAll(`SELECT p.*, COALESCE(SUM(b.quantity),0) as total_stock, COUNT(b.id) as batch_count FROM products p LEFT JOIN batches b ON p.id=b.product_id WHERE p.is_active=1 GROUP BY p.id ORDER BY total_stock ASC`));
}));

app.get('/api/batches/:productId', authMiddleware, wrap(async (req, res) => {
  res.json(await dbAll('SELECT * FROM batches WHERE product_id=? AND quantity>0 ORDER BY expiry_date ASC', [req.params.productId]));
}));

app.post('/api/batches', authMiddleware, adminOnly, wrap(async (req, res) => {
  const { product_id, quantity, purchase_price, expiry_date, batch_no } = req.body;
  if (!product_id || !quantity) return res.status(400).json({ error: 'product_id and quantity required' });
  const r = await dbRun('INSERT INTO batches (product_id,quantity,purchase_price,expiry_date,batch_no) VALUES (?,?,?,?,?)',
    [product_id, quantity, purchase_price || 0, expiry_date || null, batch_no || null]);
  await auditLog(req.user.id, req.user.username, 'ADD_BATCH', { product_id, quantity });
  res.json({ id: r.lastID, success: true });
}));

// Stock Adjust
app.post('/api/stock-adjust', authMiddleware, adminOnly, wrap(async (req, res) => {
  const { product_id, new_quantity, reason } = req.body;
  const current = await getStock(product_id);
  const diff = new_quantity - current;
  if (diff > 0) {
    await dbRun('INSERT INTO batches (product_id,quantity,purchase_price) VALUES (?,?,0)', [product_id, diff]);
  } else if (diff < 0) {
    let rem = Math.abs(diff);
    const batches = await dbAll('SELECT * FROM batches WHERE product_id=? AND quantity>0 ORDER BY id ASC', [product_id]);
    for (const b of batches) {
      if (rem <= 0) break;
      const d = Math.min(b.quantity, rem);
      await dbRun('UPDATE batches SET quantity=quantity-? WHERE id=?', [d, b.id]);
      rem -= d;
    }
  }
  await auditLog(req.user.id, req.user.username, 'STOCK_ADJUST', { product_id, old: current, new: new_quantity, reason });
  res.json({ success: true, old_quantity: current, new_quantity });
}));

// ─── BILLS ────────────────────────────────────────────────────────────────────
app.post('/api/bills', authMiddleware, wrap(async (req, res) => {
  const { customer_id, items, discount_amount, payment_mode, payment_split, notes, amount_paid } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'No items in bill' });

  let subtotal = 0, gstAmt = 0;
  // Validate stock
  for (const item of items) {
    const stock = await getStock(item.product_id);
    const product = await dbGet('SELECT * FROM products WHERE id=?', [item.product_id]);
    if (!product) return res.status(400).json({ error: `Product ${item.product_id} not found` });
    if (stock < item.quantity) return res.status(400).json({ error: `Insufficient stock for ${product.name}. Available: ${stock}` });
    const dp = item.unit_price * (1 - (item.discount_percent || 0) / 100);
    gstAmt += dp * item.quantity * (item.gst_percent || 0) / 100;
    subtotal += dp * item.quantity;
    item._discounted = dp;
  }

  const total = subtotal + gstAmt - (discount_amount || 0);
  const billNo = 'BILL' + Date.now() + Math.floor(Math.random() * 10000).toString().padStart(4, '0');

  const billR = await dbRun(
    `INSERT INTO bills (bill_no,customer_id,subtotal,discount_amount,gst_amount,total,amount_paid,payment_mode,payment_split,cashier_id,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [billNo, customer_id || null, subtotal, discount_amount || 0, gstAmt, total, amount_paid || total,
     payment_mode || 'cash', payment_split ? JSON.stringify(payment_split) : null, req.user.id, notes || null]
  );
  const billId = billR.lastID;

  for (const item of items) {
    const product = await dbGet('SELECT * FROM products WHERE id=?', [item.product_id]);
    const lineTotal = item._discounted * item.quantity + item._discounted * item.quantity * (item.gst_percent || 0) / 100;
    await dbRun('INSERT INTO bill_items (bill_id,product_id,product_name,barcode,quantity,unit_price,discount_percent,gst_percent,total_price) VALUES (?,?,?,?,?,?,?,?,?)',
      [billId, item.product_id, product.name, product.barcode, item.quantity, item.unit_price, item.discount_percent || 0, item.gst_percent || 0, lineTotal]);
    // Deduct FIFO
    let rem = item.quantity;
    const bats = await dbAll('SELECT * FROM batches WHERE product_id=? AND quantity>0 ORDER BY expiry_date ASC', [item.product_id]);
    for (const b of bats) {
      if (rem <= 0) break;
      const d = Math.min(b.quantity, rem);
      await dbRun('UPDATE batches SET quantity=quantity-? WHERE id=?', [d, b.id]);
      rem -= d;
    }
    // Low stock check
    const newStock = await getStock(item.product_id);
    if (product && newStock <= product.min_stock) {
      await dbRun('INSERT INTO notifications (type,title,message,related_id) VALUES (?,?,?,?)',
        ['low_stock', 'Low Stock Alert', `${product.name} is low on stock (${newStock} remaining)`, item.product_id]);
    }
  }

  if (customer_id) {
    await dbRun("UPDATE customers SET total_spent=total_spent+?, loyalty_points=loyalty_points+?, last_visit=datetime('now','localtime') WHERE id=?",
      [total, Math.floor(total / 100), customer_id]);
  }

  await auditLog(req.user.id, req.user.username, 'CREATE_BILL', { billNo, total });
  res.json({ id: billId, bill_no: billNo, total, subtotal, gst_amount: gstAmt });
}));

app.get('/api/bills', authMiddleware, wrap(async (req, res) => {
  const { date, customer_id, limit = 50, offset = 0 } = req.query;
  let sql = `SELECT b.*, c.name as customer_name, c.phone as customer_phone, u.name as cashier_name FROM bills b LEFT JOIN customers c ON b.customer_id=c.id LEFT JOIN users u ON b.cashier_id=u.id WHERE 1=1`;
  const params = [];
  if (date) { sql += ' AND date(b.created_at)=?'; params.push(date); }
  if (customer_id) { sql += ' AND b.customer_id=?'; params.push(customer_id); }
  sql += ' ORDER BY b.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  const bills = await dbAll(sql, params);
  const total = (await dbGet('SELECT COUNT(*) as cnt FROM bills')).cnt;
  res.json({ bills, total });
}));

app.get('/api/bills/no/:billNo', authMiddleware, wrap(async (req, res) => {
  const bill = await dbGet(`SELECT b.*, c.name as customer_name, u.name as cashier_name FROM bills b LEFT JOIN customers c ON b.customer_id=c.id LEFT JOIN users u ON b.cashier_id=u.id WHERE b.bill_no=?`, [req.params.billNo]);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });
  const items = await dbAll('SELECT * FROM bill_items WHERE bill_id=?', [bill.id]);
  res.json({ ...bill, items });
}));

app.get('/api/bills/:id', authMiddleware, wrap(async (req, res) => {
  const bill = await dbGet(`SELECT b.*, c.name as customer_name, u.name as cashier_name FROM bills b LEFT JOIN customers c ON b.customer_id=c.id LEFT JOIN users u ON b.cashier_id=u.id WHERE b.id=?`, [req.params.id]);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });
  const items = await dbAll('SELECT * FROM bill_items WHERE bill_id=?', [bill.id]);
  res.json({ ...bill, items });
}));

// ─── RETURNS ──────────────────────────────────────────────────────────────────
app.post('/api/returns', authMiddleware, wrap(async (req, res) => {
  const { bill_id, items, refund_mode } = req.body;
  if (!bill_id || !items || !items.length) return res.status(400).json({ error: 'bill_id and items required' });
  const bill = await dbGet('SELECT * FROM bills WHERE id=?', [bill_id]);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });
  const daysDiff = (Date.now() - new Date(bill.created_at)) / 86400000;
  if (daysDiff > 30) return res.status(400).json({ error: 'Return period (30 days) has expired' });

  const returnNo = 'RET' + Date.now();
  const retR = await dbRun('INSERT INTO returns (return_no,bill_id,customer_id,refund_mode,processed_by) VALUES (?,?,?,?,?)',
    [returnNo, bill_id, bill.customer_id, refund_mode || 'cash', req.user.id]);
  const returnId = retR.lastID;
  let totalRefund = 0;

  for (const item of items) {
    const billItem = await dbGet('SELECT * FROM bill_items WHERE id=? AND bill_id=?', [item.bill_item_id, bill_id]);
    if (!billItem) return res.status(400).json({ error: `Bill item not found` });
    if (item.quantity > billItem.quantity) return res.status(400).json({ error: 'Cannot return more than purchased' });
    const refund = billItem.unit_price * item.quantity * (1 - billItem.discount_percent / 100);
    totalRefund += refund;
    await dbRun('INSERT INTO return_items (return_id,bill_item_id,product_id,quantity,unit_price,condition,reason) VALUES (?,?,?,?,?,?,?)',
      [returnId, item.bill_item_id, billItem.product_id, item.quantity, billItem.unit_price, item.condition || 'good', item.reason || null]);
    if (item.condition === 'good') {
      const existing = await dbGet('SELECT id FROM batches WHERE product_id=? AND expiry_date IS NULL', [billItem.product_id]);
      if (existing) await dbRun('UPDATE batches SET quantity=quantity+? WHERE id=?', [item.quantity, existing.id]);
      else await dbRun('INSERT INTO batches (product_id,quantity,purchase_price) VALUES (?,?,0)', [billItem.product_id, item.quantity]);
    } else {
      await dbRun('INSERT INTO damaged_stock (product_id,quantity,reason,estimated_loss,recorded_by) VALUES (?,?,?,?,?)',
        [billItem.product_id, item.quantity, 'Returned damaged', refund, req.user.id]);
    }
  }

  await dbRun('UPDATE returns SET total_refund=? WHERE id=?', [totalRefund, returnId]);
  if (bill.customer_id) {
    await dbRun('UPDATE customers SET total_spent=MAX(0,total_spent-?), loyalty_points=MAX(0,loyalty_points-?) WHERE id=?',
      [totalRefund, Math.floor(totalRefund / 100), bill.customer_id]);
  }
  await auditLog(req.user.id, req.user.username, 'PROCESS_RETURN', { returnNo, totalRefund });
  res.json({ id: returnId, return_no: returnNo, total_refund: totalRefund });
}));

app.get('/api/returns', authMiddleware, wrap(async (req, res) => {
  res.json(await dbAll(`SELECT r.*, b.bill_no, c.name as customer_name, u.name as processed_by_name FROM returns r LEFT JOIN bills b ON r.bill_id=b.id LEFT JOIN customers c ON r.customer_id=c.id LEFT JOIN users u ON r.processed_by=u.id ORDER BY r.created_at DESC LIMIT 100`));
}));

app.get('/api/returns/:id', authMiddleware, wrap(async (req, res) => {
  const ret = await dbGet('SELECT * FROM returns WHERE id=?', [req.params.id]);
  if (!ret) return res.status(404).json({ error: 'Not found' });
  const items = await dbAll('SELECT ri.*, p.name as product_name FROM return_items ri JOIN products p ON ri.product_id=p.id WHERE ri.return_id=?', [req.params.id]);
  res.json({ ...ret, items });
}));

// ─── CUSTOMERS ────────────────────────────────────────────────────────────────
app.get('/api/customers', authMiddleware, wrap(async (req, res) => {
  const { search } = req.query;
  let sql = 'SELECT * FROM customers WHERE 1=1';
  const params = [];
  if (search) { sql += ' AND (name LIKE ? OR phone LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  sql += ' ORDER BY total_spent DESC LIMIT 100';
  res.json(await dbAll(sql, params));
}));
app.get('/api/customers/phone/:phone', authMiddleware, wrap(async (req, res) => {
  res.json(await dbGet('SELECT * FROM customers WHERE phone=?', [req.params.phone]) || null);
}));
app.post('/api/customers', authMiddleware, wrap(async (req, res) => {
  const { phone, name, email } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone required' });
  try {
    const r = await dbRun('INSERT INTO customers (phone,name,email) VALUES (?,?,?)', [phone, name || 'Walk-in Customer', email || null]);
    res.json({ id: r.lastID, phone, name: name || 'Walk-in Customer', success: true, loyalty_points: 0, total_spent: 0 });
  } catch(e) {
    const existing = await dbGet('SELECT * FROM customers WHERE phone=?', [phone]);
    if (existing) return res.json(existing);
    res.status(400).json({ error: e.message });
  }
}));
app.put('/api/customers/:id', authMiddleware, wrap(async (req, res) => {
  const { name, email, phone } = req.body;
  await dbRun('UPDATE customers SET name=?,email=?,phone=? WHERE id=?', [name, email, phone, req.params.id]);
  res.json({ success: true });
}));
app.get('/api/customers/:id', authMiddleware, wrap(async (req, res) => {
  const c = await dbGet('SELECT * FROM customers WHERE id=?', [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const bills = await dbAll('SELECT * FROM bills WHERE customer_id=? ORDER BY created_at DESC LIMIT 20', [req.params.id]);
  res.json({ ...c, bills });
}));

// ─── SUPPLIERS ────────────────────────────────────────────────────────────────
app.get('/api/suppliers', authMiddleware, wrap(async (req, res) => {
  res.json(await dbAll('SELECT * FROM suppliers ORDER BY name'));
}));
app.post('/api/suppliers', authMiddleware, adminOnly, wrap(async (req, res) => {
  const { name, phone, email, address } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const r = await dbRun('INSERT INTO suppliers (name,phone,email,address) VALUES (?,?,?,?)', [name, phone || null, email || null, address || null]);
  res.json({ id: r.lastID, success: true });
}));
app.put('/api/suppliers/:id', authMiddleware, adminOnly, wrap(async (req, res) => {
  const { name, phone, email, address } = req.body;
  await dbRun('UPDATE suppliers SET name=?,phone=?,email=?,address=? WHERE id=?', [name, phone, email, address, req.params.id]);
  res.json({ success: true });
}));
app.delete('/api/suppliers/:id', authMiddleware, adminOnly, wrap(async (req, res) => {
  await dbRun('DELETE FROM suppliers WHERE id=?', [req.params.id]);
  res.json({ success: true });
}));
app.post('/api/product-suppliers', authMiddleware, adminOnly, wrap(async (req, res) => {
  const { product_id, supplier_id, last_price } = req.body;
  await dbRun("INSERT OR REPLACE INTO product_suppliers (product_id,supplier_id,last_price,last_date) VALUES (?,?,?,date('now','localtime'))", [product_id, supplier_id, last_price || null]);
  res.json({ success: true });
}));

// ─── PURCHASES ────────────────────────────────────────────────────────────────
app.post('/api/purchases', authMiddleware, adminOnly, wrap(async (req, res) => {
  const { supplier_id, items, notes } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'No items' });
  const pur = await dbRun('INSERT INTO purchases (supplier_id,notes,created_by) VALUES (?,?,?)', [supplier_id || null, notes || null, req.user.id]);
  const purchaseId = pur.lastID;
  let total = 0;
  for (const item of items) {
    await dbRun('INSERT INTO purchase_items (purchase_id,product_id,quantity,cost_price,expiry_date,batch_no) VALUES (?,?,?,?,?,?)',
      [purchaseId, item.product_id, item.quantity, item.cost_price || 0, item.expiry_date || null, item.batch_no || null]);
    await dbRun('INSERT INTO batches (product_id,quantity,purchase_price,expiry_date,batch_no) VALUES (?,?,?,?,?)',
      [item.product_id, item.quantity, item.cost_price || 0, item.expiry_date || null, item.batch_no || null]);
    if (item.cost_price) await dbRun('UPDATE products SET cost_price=? WHERE id=?', [item.cost_price, item.product_id]);
    total += item.quantity * (item.cost_price || 0);
    if (supplier_id) {
      await dbRun("INSERT OR REPLACE INTO product_suppliers (product_id,supplier_id,last_price,last_date) VALUES (?,?,?,date('now','localtime'))", [item.product_id, supplier_id, item.cost_price || 0]);
    }
  }
  await dbRun('UPDATE purchases SET total=? WHERE id=?', [total, purchaseId]);
  await auditLog(req.user.id, req.user.username, 'CREATE_PURCHASE', { purchaseId, total });
  res.json({ id: purchaseId, total });
}));

app.get('/api/purchases', authMiddleware, adminOnly, wrap(async (req, res) => {
  res.json(await dbAll(`SELECT p.*, s.name as supplier_name, u.name as created_by_name FROM purchases p LEFT JOIN suppliers s ON p.supplier_id=s.id LEFT JOIN users u ON p.created_by=u.id ORDER BY p.created_at DESC LIMIT 100`));
}));
app.get('/api/purchases/:id', authMiddleware, adminOnly, wrap(async (req, res) => {
  const p = await dbGet('SELECT * FROM purchases WHERE id=?', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Not found' });
  const items = await dbAll('SELECT pi.*, pr.name as product_name FROM purchase_items pi JOIN products pr ON pi.product_id=pr.id WHERE pi.purchase_id=?', [req.params.id]);
  res.json({ ...p, items });
}));

// ─── DAMAGED STOCK ────────────────────────────────────────────────────────────
app.get('/api/damaged-stock', authMiddleware, wrap(async (req, res) => {
  const items = await dbAll(`SELECT d.*, p.name as product_name, p.selling_price, u.name as recorded_by_name FROM damaged_stock d JOIN products p ON d.product_id=p.id LEFT JOIN users u ON d.recorded_by=u.id ORDER BY d.created_at DESC`);
  const r = await dbGet('SELECT COALESCE(SUM(estimated_loss),0) as total FROM damaged_stock');
  res.json({ items, totalLoss: r.total });
}));
app.post('/api/damaged-stock', authMiddleware, wrap(async (req, res) => {
  const { product_id, quantity, reason } = req.body;
  if (!product_id || !quantity) return res.status(400).json({ error: 'product_id and quantity required' });
  const product = await dbGet('SELECT * FROM products WHERE id=?', [product_id]);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const estimatedLoss = product.selling_price * quantity;
  await dbRun('INSERT INTO damaged_stock (product_id,quantity,reason,estimated_loss,recorded_by) VALUES (?,?,?,?,?)', [product_id, quantity, reason || null, estimatedLoss, req.user.id]);
  let rem = quantity;
  const bats = await dbAll('SELECT * FROM batches WHERE product_id=? AND quantity>0 ORDER BY id ASC', [product_id]);
  for (const b of bats) {
    if (rem <= 0) break;
    const d = Math.min(b.quantity, rem);
    await dbRun('UPDATE batches SET quantity=quantity-? WHERE id=?', [d, b.id]);
    rem -= d;
  }
  await auditLog(req.user.id, req.user.username, 'RECORD_DAMAGE', { product_id, quantity });
  res.json({ success: true, estimatedLoss });
}));

// ─── EXPIRY ALERTS ────────────────────────────────────────────────────────────
app.get('/api/expiry-alerts', authMiddleware, wrap(async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const in3   = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
  const in7   = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const expired   = await dbAll(`SELECT b.*, p.name as product_name, p.barcode FROM batches b JOIN products p ON b.product_id=p.id WHERE b.expiry_date IS NOT NULL AND b.expiry_date < ? AND b.quantity > 0 ORDER BY b.expiry_date`, [today]);
  const expiring3 = await dbAll(`SELECT b.*, p.name as product_name, p.barcode FROM batches b JOIN products p ON b.product_id=p.id WHERE b.expiry_date BETWEEN ? AND ? AND b.quantity > 0`, [today, in3]);
  const expiring7 = await dbAll(`SELECT b.*, p.name as product_name, p.barcode FROM batches b JOIN products p ON b.product_id=p.id WHERE b.expiry_date BETWEEN ? AND ? AND b.quantity > 0`, [today, in7]);
  for (const item of expiring7) {
    const exists = await dbGet("SELECT id FROM notifications WHERE type=? AND related_id=? AND date(created_at)=date('now')", ['expiry_warning', item.id]);
    if (!exists) await dbRun('INSERT INTO notifications (type,title,message,related_id) VALUES (?,?,?,?)',
      ['expiry_warning', 'Expiry Alert', `${item.product_name} expires on ${item.expiry_date} (${item.quantity} units)`, item.id]);
  }
  res.json({ expired, expiring3, expiring7 });
}));

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
app.get('/api/analytics/dashboard', authMiddleware, adminOnly, wrap(async (req, res) => {
  const { period = 'today' } = req.query;
  const filters = {
    today: "date(b.created_at)=date('now','localtime')",
    week:  "b.created_at >= datetime('now','-7 days')",
    month: "b.created_at >= datetime('now','-30 days')",
    year:  "b.created_at >= datetime('now','-365 days')",
  };
  const f = filters[period] || filters.today;
  const totalSales = await dbGet(`SELECT COALESCE(SUM(total),0) as revenue, COUNT(*) as bills FROM bills b WHERE ${f} AND status='paid'`);
  const costData   = await dbGet(`SELECT COALESCE(SUM(bi.quantity * p.cost_price),0) as cost FROM bill_items bi JOIN bills b ON bi.bill_id=b.id JOIN products p ON bi.product_id=p.id WHERE ${f} AND b.status='paid'`);
  const profit = totalSales.revenue - costData.cost;
  const topProducts = await dbAll(`SELECT p.name, p.barcode, SUM(bi.quantity) as qty_sold, SUM(bi.total_price) as revenue FROM bill_items bi JOIN bills b ON bi.bill_id=b.id JOIN products p ON bi.product_id=p.id WHERE ${f} GROUP BY bi.product_id ORDER BY qty_sold DESC LIMIT 10`);
  const paymentBreakdown = await dbAll(`SELECT payment_mode, COUNT(*) as count, SUM(total) as amount FROM bills b WHERE ${f} AND status='paid' GROUP BY payment_mode`);
  const dailySales = await dbAll(`SELECT date(b.created_at) as date, SUM(b.total) as revenue, COUNT(*) as bills FROM bills b WHERE b.created_at >= datetime('now','-30 days') AND status='paid' GROUP BY date(b.created_at) ORDER BY date ASC`);
  const lowStock = await dbAll(`SELECT p.*, COALESCE(SUM(bt.quantity),0) as stock FROM products p LEFT JOIN batches bt ON p.id=bt.product_id WHERE p.is_active=1 GROUP BY p.id HAVING stock <= p.min_stock ORDER BY stock ASC LIMIT 10`);
  const damagedLoss = await dbGet(`SELECT COALESCE(SUM(estimated_loss),0) as total FROM damaged_stock`);
  const totalCustomers = await dbGet('SELECT COUNT(*) as count FROM customers');
  const totalProducts  = await dbGet('SELECT COUNT(*) as count FROM products WHERE is_active=1');
  res.json({ totalSales, profit, topProducts, paymentBreakdown, dailySales, lowStock, damagedLoss, totalCustomers, totalProducts });
}));

app.get('/api/analytics/sales-by-category', authMiddleware, adminOnly, wrap(async (req, res) => {
  const { period = 'month' } = req.query;
  const f = period === 'week' ? "b.created_at >= datetime('now','-7 days')"
    : period === 'year' ? "b.created_at >= datetime('now','-365 days')"
    : "b.created_at >= datetime('now','-30 days')";
  res.json(await dbAll(`SELECT p.category, SUM(bi.total_price) as revenue, SUM(bi.quantity) as qty FROM bill_items bi JOIN bills b ON bi.bill_id=b.id JOIN products p ON bi.product_id=p.id WHERE ${f} GROUP BY p.category ORDER BY revenue DESC`));
}));

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
app.get('/api/notifications', authMiddleware, wrap(async (req, res) => {
  const notifications = await dbAll('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50');
  const r = await dbGet('SELECT COUNT(*) as count FROM notifications WHERE is_read=0');
  res.json({ notifications, unread: r.count });
}));
app.put('/api/notifications/:id/read', authMiddleware, wrap(async (req, res) => {
  await dbRun('UPDATE notifications SET is_read=1 WHERE id=?', [req.params.id]);
  res.json({ success: true });
}));
app.put('/api/notifications/read-all', authMiddleware, wrap(async (req, res) => {
  await dbRun('UPDATE notifications SET is_read=1');
  res.json({ success: true });
}));

// ─── USERS ────────────────────────────────────────────────────────────────────
app.get('/api/users', authMiddleware, adminOnly, wrap(async (req, res) => {
  res.json(await dbAll('SELECT id,name,username,role,is_active,created_at FROM users ORDER BY name'));
}));
app.post('/api/users', authMiddleware, adminOnly, wrap(async (req, res) => {
  const { name, username, password, role } = req.body;
  if (!name || !username || !password) return res.status(400).json({ error: 'Name, username, password required' });
  const hash = bcrypt.hashSync(password, 10);
  const r = await dbRun('INSERT INTO users (name,username,password_hash,role) VALUES (?,?,?,?)', [name, username, hash, role || 'cashier']);
  await auditLog(req.user.id, req.user.username, 'CREATE_USER', { username, role });
  res.json({ id: r.lastID, success: true });
}));
app.put('/api/users/:id', authMiddleware, adminOnly, wrap(async (req, res) => {
  const { name, role, is_active, password } = req.body;
  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    await dbRun('UPDATE users SET name=?,role=?,is_active=?,password_hash=? WHERE id=?', [name, role, is_active, hash, req.params.id]);
  } else {
    await dbRun('UPDATE users SET name=?,role=?,is_active=? WHERE id=?', [name, role, is_active, req.params.id]);
  }
  await auditLog(req.user.id, req.user.username, 'UPDATE_USER', { id: req.params.id });
  res.json({ success: true });
}));

// ─── AUDIT LOGS ───────────────────────────────────────────────────────────────
app.get('/api/audit-logs', authMiddleware, adminOnly, wrap(async (req, res) => {
  res.json(await dbAll('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200'));
}));

// ─── SEARCH ───────────────────────────────────────────────────────────────────
app.get('/api/search', authMiddleware, wrap(async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ products: [], customers: [], bills: [] });
  const products = await dbAll(`SELECT p.*, COALESCE(SUM(b.quantity),0) as stock FROM products p LEFT JOIN batches b ON p.id=b.product_id WHERE p.is_active=1 AND (p.name LIKE ? OR p.barcode LIKE ?) GROUP BY p.id LIMIT 10`, [`%${q}%`, `%${q}%`]);
  const customers = await dbAll(`SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? LIMIT 5`, [`%${q}%`, `%${q}%`]);
  const bills = await dbAll(`SELECT b.*, c.name as customer_name FROM bills b LEFT JOIN customers c ON b.customer_id=c.id WHERE b.bill_no LIKE ? LIMIT 5`, [`%${q}%`]);
  res.json({ products, customers, bills });
}));

// ─── START ────────────────────────────────────────────────────────────────────
const os   = require('os');
const PORT = process.env.PORT || 3000;

function getLanIPs() {
  const ifaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
    }
  }
  return ips;
}

initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    const lanIPs = getLanIPs();
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║       🏪  VENI SUPER MARKET — SmartPOS          ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log(`\n  Local   : http://localhost:${PORT}`);
    if (lanIPs.length) {
      lanIPs.forEach(ip => {
        console.log(`  Network : http://${ip}:${PORT}  ← share this with cashiers`);
      });
    }
    console.log(`\n  Admin   : admin / admin123`);
    console.log(`  Cashier : cashier / cashier123`);
    console.log('\n  Open the Network URL on each cashier computer.\n');
  });
}).catch(err => {
  console.error('Database init failed:', err);
  process.exit(1);
});
