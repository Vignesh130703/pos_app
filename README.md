# 🛒 Smart Department Store POS System

<p align="center">
  <img src="https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif" width="300" />
</p>

<p align="center">
  ⚡ Fast • 📦 Smart Inventory • 🌐 LAN Enabled • 💳 Modern Billing
</p>

---

## 🚀 Overview

A **fully custom-built, enterprise-grade POS system** designed for supermarkets and department stores.

Built to handle **real-world retail workflows** with high performance, accuracy, and ease of use.

---

## ✨ Key Features

### 🧾 Advanced Billing Engine
- ⚡ Lightning-fast barcode scanning
- 🔄 Multi-bill sessions (pause & resume anytime)
- 🖨️ Live thermal receipt preview
- 💳 Split payments (Cash + UPI + Mixed)
- 📱 Auto UPI QR code with bill amount

---

### 📦 Smart Inventory (Batch + Expiry)
- 🔁 FIFO-based stock deduction
- 📅 Batch-wise expiry tracking
- 🚨 Smart alerts:
  - Low stock warnings
  - Expiry alerts (30 / 7 / 3 days)
- ⚠️ Damaged goods management

---

### 🌐 LAN-Based System
- 🖥️ No install needed on client PCs
- 🔗 Access via browser in local network
- ⚙️ Central server architecture
- 🔁 Auto-start with PM2

---

### 👥 Enterprise Modules

#### 🧑 Customers & Loyalty
- 📞 Track via phone number
- 🎁 Loyalty points system
- 📅 Last visit tracking

#### 🚚 Suppliers & Purchases
- 📦 Batch creation on purchase
- 🏢 Supplier tracking
- 🔄 Auto stock update

#### 🔁 Returns System
- ↩️ Handle customer returns
- 📦 Restock or mark damaged

#### 🔐 Role-Based Access
- 👑 Admin → Full access
- 🧾 Cashier → Billing only

#### 📊 Analytics Dashboard
- 📈 Sales & revenue insights
- 💰 Profit tracking
- 🗂️ Category performance

---

## 🏗️ System Architecture


Client PCs ---> Local Network ---> Main Server (Mac)
|
---> Central Database


---

## ⚙️ Installation

### 1️⃣ Clone the repo
```bash
git clone https://github.com/your-username/your-repo-name.git
cd your-repo-name
2️⃣ Install dependencies
npm install
3️⃣ Run server
npm start
4️⃣ Open in browser
http://localhost:3000
5️⃣ Access from other systems
http://<your-local-ip>:3000
🔄 PM2 Auto Start
npm install -g pm2
pm2 start server.js
pm2 save
pm2 startup
🎯 Use Cases
🏪 Supermarkets
🛍️ Department Stores
🧾 Retail Shops
💼 Multi-counter billing setups
🧠 Future Enhancements
📲 Mobile App Integration
☁️ Cloud Backup
🧾 GST Reports
💬 WhatsApp Bill Sharing
📡 Offline Mode
🏁 Version

v1.0 — Stable Release 🎉

🤝 Contributing

Contributions, suggestions, and improvements are welcome!

📄 License

MIT License

🙌 Built For Real Shops

Designed to solve real retail problems with speed and simplicity.

<p align="center"> ⭐ If you like this project, give it a star! </p> ```