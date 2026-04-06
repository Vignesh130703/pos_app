// ─── MULTI-SESSION BILLING MODULE ────────────────────────────────
// Each session holds an independent cart for one customer transaction.
// Cashiers can hold a mid-bill session and open a new tab for the next customer.

const billing = {
  sessions: [],       // array of session objects
  activeIdx: 0,       // index of currently visible session
  nextTabId: 1,       // increments for unique IDs

  // ── Current session shorthand ──────────────────────────────────
  get session() { return this.sessions[this.activeIdx]; },

  // ── Initialise module (first page load) ─────────────────────────
  async init() {
    if (this.sessions.length === 0) {
      this.newSession();           // first tab
    }
    this.renderTabs();
    this.renderAll();
    this.setupScanInput();
    this.setupPaymentMethods();
    this.setupCustomerSearch();
    this.setupChargeBtn();
    this.setupBillDiscount();
    this.focusScan();
  },

  // ── Create a new blank session ──────────────────────────────────
  newSession(label) {
    const id = this.nextTabId++;
    const session = {
      id,
      label: label || `Bill ${id}`,
      cart: [],
      customer: null,
      paymentMode: 'cash',
      discount: 0,
    };
    this.sessions.push(session);
    this.activeIdx = this.sessions.length - 1;
    return session;
  },

  // ── Switch to a session by index ────────────────────────────────
  switchTo(idx) {
    this.activeIdx = idx;
    this.renderTabs();
    this.renderAll();
    this.focusScan();
  },

  // ── Close a tab (with confirmation if not empty) ─────────────────
  closeTab(idx, e) {
    e && e.stopPropagation();
    const sess = this.sessions[idx];
    if (sess.cart.length > 0 && !confirmDialog(`"${sess.label}" has ${sess.cart.length} item(s). Close and discard?`)) return;
    this.sessions.splice(idx, 1);
    if (this.sessions.length === 0) this.newSession();
    this.activeIdx = Math.min(this.activeIdx, this.sessions.length - 1);
    this.renderTabs();
    this.renderAll();
    this.focusScan();
  },

  // ── Rename active tab (double-click) ────────────────────────────
  renameTab(idx) {
    const sess = this.sessions[idx];
    const name = prompt('Rename tab:', sess.label);
    if (name && name.trim()) {
      sess.label = name.trim();
      this.renderTabs();
    }
  },

  // ── Render the tab bar ──────────────────────────────────────────
  renderTabs() {
    const bar = el('billing-tabs');
    if (!bar) return;
    bar.innerHTML = this.sessions.map((s, i) => {
      const active = i === this.activeIdx;
      const itemCount = s.cart.length;
      const hasItems = itemCount > 0;
      return `
      <div class="bill-tab ${active ? 'active' : ''}" onclick="billing.switchTo(${i})" ondblclick="billing.renameTab(${i})">
        <span class="bill-tab-icon">${s.customer ? '👤' : '🧾'}</span>
        <span class="bill-tab-label">${s.label}</span>
        ${hasItems ? `<span class="bill-tab-badge">${itemCount}</span>` : ''}
        <button class="bill-tab-close" onclick="billing.closeTab(${i}, event)" title="Close tab">✕</button>
      </div>`;
    }).join('') +
    `<button class="bill-tab-add" onclick="billing.addTab()" title="New billing tab (Ctrl+T)">＋ New Bill</button>`;
  },

  // ── Add tab button handler ───────────────────────────────────────
  addTab() {
    const sess = this.newSession();
    this.renderTabs();
    this.renderAll();
    this.focusScan();
    toast.info('New Tab', `${sess.label} opened`);
  },

  // ─── Render everything for current session ─────────────────────
  renderAll() {
    this.renderCart();
    this.syncPaymentUI();
    this.syncCustomerUI();
    this.syncDiscountUI();
  },

  syncPaymentUI() {
    qsa('.pay-method').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === this.session.paymentMode));
  },

  syncCustomerUI() {
    const inp = el('customer-phone-input');
    const disp = el('customer-display');
    if (inp)  inp.value = this.session.customer?.phone || '';
    if (disp) {
      const c = this.session.customer;
      disp.textContent = c ? `👤 ${c.name} · ${fmt.currency(c.total_spent)} spent · ${c.loyalty_points} pts` : '';
    }
  },

  syncDiscountUI() {
    const inp = el('bill-discount');
    if (inp) inp.value = this.session.discount || 0;
  },

  focusScan() {
    const inp = el('scan-input');
    if (inp) { inp.value = ''; inp.focus(); }
  },

  // ─── Scan / Search ────────────────────────────────────────────
  setupScanInput() {
    const inp    = el('scan-input');
    const drop   = el('scan-dropdown');
    if (!inp) return;
    let timer;

    inp.addEventListener('input', () => {
      clearTimeout(timer);
      const val = inp.value.trim();
      if (!val) { drop.classList.remove('open'); return; }
      timer = setTimeout(async () => {
        // Exact barcode match first
        const byBarcode = await api.getProductByBarcode(val).catch(() => null);
        if (byBarcode) {
          this.addToCart(byBarcode);
          inp.value = '';
          drop.classList.remove('open');
          return;
        }
        // Name search
        const results = await api.getProducts({ search: val }).catch(() => []);
        this.renderDropdown(results, val, drop);
      }, 300);
    });

    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const first = qs('.dropdown-item', drop);
        if (first) { first.click(); return; }
        const val = inp.value.trim();
        if (val) this.openAddProduct(val);
      }
      if (e.key === 'Escape') drop.classList.remove('open');
    });

    document.addEventListener('click', e => {
      if (!inp.contains(e.target) && !drop.contains(e.target)) drop.classList.remove('open');
    });
  },

  renderDropdown(products, query, dropdown) {
    if (!products.length) {
      dropdown.innerHTML = `
        <div class="dropdown-empty">No product found for "<strong>${query}</strong>"</div>
        <div class="dropdown-add-new" id="add-new-trigger">➕ Add New Product "${query}"</div>`;
      dropdown.classList.add('open');
      el('add-new-trigger')?.addEventListener('click', () => {
        dropdown.classList.remove('open');
        this.openAddProduct(query);
      });
      return;
    }
    dropdown.innerHTML = products.slice(0, 8).map(p => `
      <div class="dropdown-item" data-id="${p.id}">
        <div>
          <div class="di-name">${p.name}</div>
          <div class="di-meta">${p.barcode || 'No barcode'} · ${p.category} · Stock: ${p.stock || 0}</div>
        </div>
        <div class="di-price">${fmt.currency(p.selling_price)}</div>
      </div>`).join('') +
      `<div class="dropdown-add-new" id="add-new-trigger">➕ Add New Product</div>`;
    dropdown.classList.add('open');

    qsa('.dropdown-item', dropdown).forEach(item => {
      item.addEventListener('click', () => {
        const p = products.find(p => p.id == item.dataset.id);
        if (p) { this.addToCart(p); el('scan-input').value = ''; dropdown.classList.remove('open'); }
      });
    });
    el('add-new-trigger')?.addEventListener('click', () => {
      dropdown.classList.remove('open');
      this.openAddProduct(query);
    });
  },

  // ─── Cart Operations ──────────────────────────────────────────
  addToCart(product) {
    playBeep();
    const sess = this.session;
    const existing = sess.cart.find(i => i.product_id === product.id);
    if (existing) {
      if (existing.quantity >= (product.stock || 999)) { toast.warning('Out of Stock', `Only ${product.stock} available`); return; }
      existing.quantity++;
    } else {
      if ((product.stock || 0) <= 0) { toast.warning('Out of Stock', `${product.name} is out of stock`); return; }
      sess.cart.push({
        product_id: product.id,
        name: product.name,
        barcode: product.barcode,
        unit_price: product.selling_price,
        gst_percent: product.gst_percent || 0,
        discount_percent: 0,
        quantity: 1,
        max_stock: product.stock || 999,
      });
    }
    this.renderCart();
    this.renderTabs();   // update item count badge on tab
    toast.success('Added', product.name);
  },

  removeFromCart(idx) {
    this.session.cart.splice(idx, 1);
    this.renderCart();
    this.renderTabs();
  },

  clearCart() {
    if (!this.session.cart.length) return;
    this.session.cart = [];
    this.renderCart();
    this.renderTabs();
  },

  updateQty(idx, qty) {
    const item = this.session.cart[idx];
    if (!item) return;
    item.quantity = Math.max(1, Math.min(parseInt(qty) || 1, item.max_stock));
    this.renderCart();
  },

  updateItemDiscount(idx, val) {
    const item = this.session.cart[idx];
    if (!item) return;
    item.discount_percent = Math.min(100, Math.max(0, parseFloat(val) || 0));
    this.renderCart();
  },

  // ─── Render Cart Table ───────────────────────────────────────
  renderCart() {
    const tbody = el('cart-body');
    if (!tbody) return;
    const cart = this.session.cart;

    if (!cart.length) {
      tbody.innerHTML = `<tr><td colspan="7">
        <div class="empty-state" style="padding:30px">
          <div class="empty-icon">🛒</div>
          <div class="empty-title">Cart is empty</div>
          <div class="empty-text">Scan a barcode or search a product to add items</div>
        </div></td></tr>`;
    } else {
      tbody.innerHTML = cart.map((item, i) => {
        const dp = item.unit_price * (1 - item.discount_percent / 100);
        const gst = dp * item.quantity * item.gst_percent / 100;
        const lineTotal = dp * item.quantity + gst;
        return `<tr>
          <td>
            <div style="font-weight:600;font-size:13px">${item.name}</div>
            <div style="font-size:11px;color:var(--text-muted)">${item.barcode || ''}</div>
          </td>
          <td>${fmt.currency(item.unit_price)}</td>
          <td>
            <div class="qty-ctrl">
              <button onclick="billing.updateQty(${i},${item.quantity-1})">−</button>
              <input type="number" value="${item.quantity}" min="1" max="${item.max_stock}"
                onchange="billing.updateQty(${i},this.value)"
                style="width:44px;text-align:center;background:var(--bg-input);border:1px solid var(--border);border-radius:6px;padding:4px;color:var(--text-primary);font-size:13px">
              <button onclick="billing.updateQty(${i},${item.quantity+1})">+</button>
            </div>
          </td>
          <td>
            <input type="number" value="${item.discount_percent}" min="0" max="100" step="0.5"
              onchange="billing.updateItemDiscount(${i},this.value)"
              style="width:60px;text-align:center;background:var(--bg-input);border:1px solid var(--border);border-radius:6px;padding:4px;color:var(--text-primary);font-size:12px">%
          </td>
          <td style="font-size:11px;color:var(--text-muted)">${item.gst_percent}%</td>
          <td style="font-weight:700;color:var(--accent-light)">${fmt.currency(lineTotal)}</td>
          <td><button class="btn btn-ghost btn-sm" onclick="billing.removeFromCart(${i})" title="Remove">🗑️</button></td>
        </tr>`;
      }).join('');
    }
    this.renderSummary();
    this.renderLiveReceipt();
    const countEl = el('cart-item-count');
    if (countEl) countEl.textContent = cart.length ? `${cart.length} item${cart.length > 1 ? 's' : ''}` : '';
  },

  // ─── Summary ─────────────────────────────────────────────────
  getTotals() {
    let subtotal = 0, gstTotal = 0;
    for (const item of this.session.cart) {
      const dp = item.unit_price * (1 - item.discount_percent / 100);
      subtotal  += dp * item.quantity;
      gstTotal  += dp * item.quantity * item.gst_percent / 100;
    }
    const discount = parseFloat(this.session.discount || 0);
    const total = Math.max(0, subtotal + gstTotal - discount);
    return { subtotal, gstTotal, discount, total };
  },

  renderSummary() {
    const { subtotal, gstTotal, discount, total } = this.getTotals();
    if (el('summary-subtotal')) el('summary-subtotal').textContent = fmt.currency(subtotal);
    if (el('summary-gst'))      el('summary-gst').textContent      = fmt.currency(gstTotal);
    if (el('summary-total'))    el('summary-total').textContent    = fmt.currency(total);
    if (el('charge-btn'))       el('charge-btn').textContent       = `💳 Charge ${fmt.currency(total)}`;
  },

  renderLiveReceipt() {
    const panel = el('live-receipt');
    if (!panel) return;
    const sess  = this.session;
    const cart  = sess.cart;
    const { subtotal, gstTotal, discount, total } = this.getTotals();
    const now   = new Date();
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const rpTime = el('rp-bill-time');
    if (rpTime) rpTime.textContent = timeStr;

    if (!cart.length) {
      panel.innerHTML = `<div class="receipt-empty-state"><div style="font-size:48px;margin-bottom:12px;opacity:.3">🧾</div><div style="font-size:13px;font-weight:600;opacity:.4">Add items to see bill preview</div></div>`;
      return;
    }

    const billNo   = `PREVIEW-${sess.id}`;
    const cashier  = (app.user && app.user.name) || 'Cashier';
    const custName = sess.customer ? sess.customer.name : 'Walk-in Customer';
    const custPhone = sess.customer ? sess.customer.phone : '';

    // Header row for items table
    const itemHeader = `<div style="display:flex;justify-content:space-between;font-weight:700;font-size:10px;border-bottom:1px solid #ccc;padding-bottom:3px;margin-bottom:4px;color:#333">
      <span style="flex:2">Item</span>
      <span style="flex:1;text-align:right">MRP</span>
      <span style="flex:0.6;text-align:center">Qty</span>
      <span style="flex:0.7;text-align:center">GST%</span>
      <span style="flex:0.7;text-align:center">Disc%</span>
      <span style="flex:1;text-align:right">Total</span>
    </div>`;

    const itemsHTML = cart.map(item => {
      const dp = item.unit_price * (1 - item.discount_percent / 100);
      const lineTotal = dp * item.quantity + (dp * item.quantity * item.gst_percent / 100);
      return `<div style="display:flex;justify-content:space-between;font-size:10px;padding:3px 0;border-bottom:1px dotted #eee">
        <span style="flex:2;font-weight:600">${item.name}</span>
        <span style="flex:1;text-align:right">Rs.${item.unit_price.toFixed(2)}</span>
        <span style="flex:0.6;text-align:center">${item.quantity}</span>
        <span style="flex:0.7;text-align:center">${item.gst_percent}%</span>
        <span style="flex:0.7;text-align:center">${item.discount_percent > 0 ? item.discount_percent + '%' : '-'}</span>
        <span style="flex:1;text-align:right;font-weight:700">Rs.${lineTotal.toFixed(2)}</span>
      </div>`;
    }).join('');

    const discRow = discount > 0 ? `<div class="lr-row"><span>Discount</span><span>- Rs.${discount.toFixed(2)}</span></div>` : '';

    panel.innerHTML = `<div class="live-receipt">
      <div class="lr-store">
        VENI SUPER MARKET
        <div style="font-size:10px;font-weight:400;margin-top:2px">Korattur, Chennai - 600080</div>
        <div style="font-size:10px;font-weight:400">Ph: 9876543210</div>
      </div>
      <div style="text-align:center;font-size:10px;color:#444;margin-bottom:4px">GSTIN: 33AAACU0985R1ZE</div>
      <div class="lr-divider"></div>
      <div class="lr-meta">Date   : ${dateStr} ${timeStr}</div>
      <div class="lr-meta">Bill # : ${billNo}</div>
      <div class="lr-meta">Cashier: ${cashier}</div>
      <div class="lr-divider"></div>
      ${itemHeader}
      ${itemsHTML}
      <div class="lr-divider"></div>
      <div class="lr-row"><span>Subtotal</span><span>Rs.${subtotal.toFixed(2)}</span></div>
      <div class="lr-row"><span>GST</span><span>Rs.${gstTotal.toFixed(2)}</span></div>
      ${discRow}
      <div class="lr-row lr-total"><span>TOTAL</span><span>Rs.${total.toFixed(2)}</span></div>
      <div class="lr-row" style="font-size:10px;color:#555;margin-top:3px"><span>Payment</span><span>${(sess.paymentMode||'cash').toUpperCase()}</span></div>
      <div class="lr-divider"></div>
      <div class="lr-footer">
        <div style="font-weight:700">${custName}</div>
        ${custPhone ? `<div>${custPhone}</div>` : ''}
        <div style="margin-top:6px;font-style:italic">"Thank you for shopping with us!</div>
        <div style="font-style:italic">Your trust is our greatest reward."</div>
        <div style="margin-top:4px">Please visit us again 😊</div>
        <div style="margin-top:6px;font-size:9px">Goods once sold will not be taken back</div>
        <div style="font-size:9px">Return within 30 days with valid bill</div>
      </div>
    </div>`;
  },

  // ─── Payment Methods ─────────────────────────────────────────
  setupPaymentMethods() {
    qsa('.pay-method').forEach(btn => {
      btn.addEventListener('click', () => {
        qsa('.pay-method').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.session.paymentMode = btn.dataset.mode;
        if (this.session.paymentMode === 'upi') this.showQR();
      });
    });
  },

  showQR() {
    const { total } = this.getTotals();
    el('qr-amount-display').textContent = fmt.currency(total);
    const canvas = el('qr-canvas');
    if (canvas && window.QRCode) {
      canvas.innerHTML = '';
      new QRCode(canvas, {
        text: `upi://pay?pa=storeupi@paytm&pn=SmartPOS&am=${total.toFixed(2)}&cu=INR`,
        width: 180, height: 180, colorDark: '#000000', colorLight: '#ffffff',
      });
    } else if (canvas) {
      canvas.innerHTML = `<div style="padding:40px;text-align:center;color:#333;font-size:13px">UPI QR<br><strong>₹${total.toFixed(2)}</strong></div>`;
    }
    openModal('modal-qr');
  },

  // ─── Customer Search ─────────────────────────────────────────
  setupCustomerSearch() {
    const inp = el('customer-phone-input');
    if (!inp) return;
    inp.addEventListener('keydown', async e => {
      if (e.key === 'Enter') {
        const phone = inp.value.trim();
        if (!phone) { this.session.customer = null; el('customer-display').textContent = ''; return; }
        try {
          let cust = await api.getCustomerByPhone(phone);
          if (!cust) { cust = await api.createCustomer({ phone }); toast.info('New Customer', phone); }
          this.session.customer = cust;
          // auto-label the tab with customer name
          if (this.session.label.startsWith('Bill ')) this.session.label = cust.name;
          el('customer-display').textContent = `👤 ${cust.name} · ${fmt.currency(cust.total_spent)} spent · ${cust.loyalty_points} pts`;
          this.renderTabs();
          toast.success('Customer', cust.name);
        } catch(e) { toast.error('Error', e.message); }
      }
    });
    el('clear-customer')?.addEventListener('click', () => {
      this.session.customer = null;
      inp.value = '';
      el('customer-display').textContent = '';
    });
  },

  // ─── Billing Discount ────────────────────────────────────────
  setupBillDiscount() {
    el('bill-discount')?.addEventListener('input', e => {
      this.session.discount = parseFloat(e.target.value) || 0;
      this.renderSummary();
    });
  },

  // ─── Charge Button ───────────────────────────────────────────
  setupChargeBtn() {
    el('charge-btn')?.addEventListener('click', () => this.processPayment());
  },

  async processPayment() {
    const sess = this.session;
    if (!sess.cart.length) { toast.warning('Empty Cart', 'Add items first'); return; }
    const { subtotal, gstTotal, discount, total } = this.getTotals();
    if (sess.paymentMode === 'upi') { this.showQR(); return; }

    const payload = {
      customer_id:     sess.customer?.id || null,
      items:           sess.cart.map(i => ({
        product_id:       i.product_id,
        quantity:         i.quantity,
        unit_price:       i.unit_price,
        discount_percent: i.discount_percent,
        gst_percent:      i.gst_percent,
      })),
      discount_amount: discount,
      payment_mode:    sess.paymentMode,
      amount_paid:     total,
    };

    const btn = el('charge-btn');
    loadingBtn(btn, true);
    try {
      const bill = await api.createBill(payload);
      closeAllModals();
      this.showReceipt(bill.id);

      // Reset session (keep tab open, cleared)
      const tabLabel = `Bill ${sess.id}`;
      sess.cart = [];
      sess.customer = null;
      sess.discount = 0;
      sess.label = tabLabel;
      sess.paymentMode = 'cash';

      this.syncPaymentUI();
      this.syncCustomerUI();
      this.syncDiscountUI();
      this.renderCart();
      this.renderTabs();
      toast.success('Bill Created!', `${bill.bill_no} · ${fmt.currency(bill.total)}`);
    } catch(e) {
      toast.error('Billing Error', e.message);
    } finally {
      loadingBtn(btn, false);
    }
  },

  // Called from QR modal "Mark as Paid"
  async confirmUpiPayment() {
    this.session.paymentMode = 'upi';
    closeAllModals();
    await this.processPayment();
  },

  // ─── Receipt ────────────────────────────────────────────────
  async showReceipt(billId) {
    try {
      const bill = await api.getBill(billId);
      el('receipt-content').innerHTML = this.buildReceiptHTML(bill);
      openModal('modal-receipt');
    } catch(e) { toast.error('Receipt error', e.message); }
  },

  buildReceiptHTML(bill) {
    const items     = bill.items || [];
    const custName  = bill.customer_name  || 'Walk-in Customer';
    const custPhone = bill.customer_phone || '';

    const itemRows = items.map(i => {
      const disc = i.discount_percent > 0 ? i.discount_percent + '%' : '-';
      return `
        <tr>
          <td style="padding:4px 2px;border-bottom:1px dotted #ddd">${i.product_name}</td>
          <td style="padding:4px 2px;border-bottom:1px dotted #ddd;text-align:right">${i.unit_price.toFixed(2)}</td>
          <td style="padding:4px 2px;border-bottom:1px dotted #ddd;text-align:center">${i.quantity}</td>
          <td style="padding:4px 2px;border-bottom:1px dotted #ddd;text-align:center">${i.gst_percent}%</td>
          <td style="padding:4px 2px;border-bottom:1px dotted #ddd;text-align:center">${disc}</td>
          <td style="padding:4px 2px;border-bottom:1px dotted #ddd;text-align:right;font-weight:700">${i.total_price.toFixed(2)}</td>
        </tr>`;
    }).join('');

    return `
    <div class="receipt">
      <div class="receipt-header">
        <div class="receipt-store">VENI SUPER MARKET</div>
        <div style="font-size:10px;margin-top:3px">Korattur, Chennai - 600080</div>
        <div style="font-size:10px">Ph: 9876543210</div>
        <div style="font-size:10px;margin-top:2px">GSTIN: 33AAACU0985R1ZE</div>
      </div>
      <div class="receipt-divider"></div>
      <div class="receipt-row"><span>Bill No :</span><span><b>${bill.bill_no}</b></span></div>
      <div class="receipt-row"><span>Date    :</span><span>${fmt.datetime(bill.created_at)}</span></div>
      <div class="receipt-row"><span>Cashier :</span><span>${bill.cashier_name}</span></div>
      <div class="receipt-divider"></div>
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead>
          <tr style="border-bottom:1px solid #999">
            <th style="text-align:left;padding:3px 2px">Item</th>
            <th style="text-align:right;padding:3px 2px">MRP</th>
            <th style="text-align:center;padding:3px 2px">Qty</th>
            <th style="text-align:center;padding:3px 2px">GST</th>
            <th style="text-align:center;padding:3px 2px">Disc</th>
            <th style="text-align:right;padding:3px 2px">Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div class="receipt-divider"></div>
      <div class="receipt-row"><span>Subtotal</span><span>Rs. ${bill.subtotal.toFixed(2)}</span></div>
      <div class="receipt-row"><span>GST</span><span>Rs. ${bill.gst_amount.toFixed(2)}</span></div>
      ${bill.discount_amount > 0 ? `<div class="receipt-row"><span>Discount</span><span>- Rs. ${bill.discount_amount.toFixed(2)}</span></div>` : ''}
      <div class="receipt-row total"><span>TOTAL</span><span>Rs. ${bill.total.toFixed(2)}</span></div>
      <div class="receipt-row" style="font-size:10px"><span>Payment</span><span>${bill.payment_mode.toUpperCase()}</span></div>
      <div class="receipt-divider"></div>
      <div class="receipt-footer">
        <div style="font-weight:700;font-size:12px">${custName}</div>
        ${custPhone ? `<div style="font-size:10px">${custPhone}</div>` : ''}
        <div style="margin-top:8px;font-style:italic">&ldquo;Thank you for shopping with us!</div>
        <div style="font-style:italic">Your trust is our greatest reward.&rdquo;</div>
        <div style="margin-top:6px">Please visit us again 😊</div>
        <div style="margin-top:6px;font-size:9px">Goods once sold will not be taken back</div>
        <div style="font-size:9px">Return within 30 days with valid bill</div>
      </div>
    </div>`;
  },

  // ─── Quick-Add Product (from billing dropdown) ─────────────────
  openAddProduct(barcode) {
    el('qp-barcode').value = (barcode && !isNaN(barcode)) ? barcode : '';
    el('qp-name').value   = (barcode && isNaN(barcode))   ? barcode : '';
    openModal('modal-quick-add');
    el('qp-name').focus();
  },
};
