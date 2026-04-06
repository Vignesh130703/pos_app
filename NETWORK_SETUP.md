# 🌐 Veni Super Market — Network Setup Guide

## How It Works

```
        [ THIS MAC / SERVER PC ]
              ↓  port 3000
   ┌──────────────────────────┐
   │  Node.js Backend + SQLite │  ← All data stored here
   └──────────────────────────┘
        ↑         ↑         ↑
  [Cashier 1]  [Cashier 2]  [Manager]
  (browser)    (browser)    (browser)
```

The **server Mac** runs the database and the backend. Every other computer just **opens a browser** — no installation needed.

---

## Step 1 — Start the Server (on this Mac)

```bash
cd /Users/vicky/Downloads/pos_full_app/backend
pm2 start server.js --name smartpos
```

Or just use the shortcut:
```bash
pm2 restart smartpos
```

When it starts you will see the network URL printed:
```
  Network : http://192.168.0.105:3000  ← share this with cashiers
```

---

## Step 2 — Auto-Start on Boot (one-time setup)

Run this command **once** to make the server start automatically whenever the Mac restarts:

```bash
sudo env PATH=$PATH:/Users/vicky/.nvm/versions/node/v24.14.1/bin \
  /Users/vicky/.nvm/versions/node/v24.14.1/lib/node_modules/pm2/bin/pm2 \
  startup launchd -u vicky --hp /Users/vicky
```

Then save the process list:
```bash
pm2 save
```

---

## Step 3 — Cashier Computers

On **every cashier computer**, open any web browser and type:

```
http://192.168.0.105:3000
```

> ⚠️ **Important**: The server Mac and all cashier computers must be on the **same Wi-Fi / LAN network**.

That's it! All data (bills, products, stock) is shared automatically — all cashiers see the same data in real time.

---

## Step 4 — Check If Server Is Running

```bash
pm2 list
```

You should see `smartpos` with status **online**.

---

## Useful Commands

| Command | What it does |
|---------|-------------|
| `pm2 start server.js --name smartpos` | Start the server |
| `pm2 stop smartpos` | Stop the server |
| `pm2 restart smartpos` | Restart after updates |
| `pm2 logs smartpos` | See live logs |
| `pm2 list` | Check if running |

---

## Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Cashier | `cashier` | `cashier123` |

> Change passwords from **Admin → Users** after setup.

---

## Troubleshooting

**Cashier can't connect?**
- Make sure Mac firewall allows port 3000: `System Preferences → Security → Firewall → Allow Node.js`
- Both devices must be on the same Wi-Fi network
- Try pinging the server IP from cashier: `ping 192.168.0.105`

**IP changed after restart?**
- Set a static IP on this Mac: `System Preferences → Network → Advanced → TCP/IP → Configure IPv4: Manually`
- Or reserve the IP in your Wi-Fi router's DHCP settings
