# Vendora — Point of Sale System
## Quick Start for Any Shop

Run the POS with **one double-click** — no technical knowledge needed!

---

## 📦 System Requirements

Before you start, make sure you have:

1. **Node.js** (v14 or higher)
   - Download from: https://nodejs.org/
   - Click the green "LTS" button and install
   - During installation, check ✓ "Add to PATH"

2. **A modern web browser**
   - Chrome, Edge, Safari, or Firefox (all work great)

---

## 🚀 Starting the POS

### **Windows Users:**
1. Find the file `START_POS.bat` in the Vendora folder
2. **Double-click** it
3. A black window will open and start the server
4. Open your browser and go to: **http://localhost:3000**

### **Mac/Linux Users:**
1. Open Terminal
2. Navigate to the Vendora folder: `cd /path/to/vendora`
3. Make the script executable: `chmod +x START_POS.sh`
4. Double-click `START_POS.sh` or run: `./START_POS.sh`
5. Open your browser and go to: **http://localhost:3000**

---

## 💡 Using the POS

### **First Time Setup:**
1. Go to **Settings** tab
2. Enter your shop name, address, phone, email
3. Go to **Inventory** and add your products
4. Start creating bills in **Billing** tab

### **Key Features:**
- **Barcode Scanning** — Use a USB barcode scanner or camera
- **Billing** — Fast checkout with multiple payment methods
- **Inventory** — Track stock and low-stock alerts
- **Reports** — View daily sales, top products, profit margins
- **Customer Tracking** — Save customer info and loyalty points

### **Keyboard Shortcuts:**
- **Alt+B** — Go to Billing
- **Alt+I** — Go to Inventory
- **Alt+G** — Generate Bill
- **Alt+Shift+H** — Show all keyboard shortcuts

---

## 🔗 Access from Multiple Devices (Same Shop)

If you want to use the POS on multiple phones/tablets in your shop:

1. Find your computer's IP address (instructions below)
2. On your phone/tablet, open: `http://<YOUR_COMPUTER_IP>:3000`

### **Find Your Computer IP:**

**Windows:**
- Open PowerShell
- Type: `ipconfig`
- Look for "IPv4 Address" (usually `192.168.x.x`)

**Mac/Linux:**
- Open Terminal
- Type: `ifconfig`
- Look for "inet" address under your Wi-Fi connection

---

## 📱 Sharing Your POS Across Devices

### **Option 1: Local Network (Same Wi-Fi) — FREE**
- All phones/tablets must be on the same Wi-Fi
- Use the IP address method above
- Data syncs instantly

### **Option 2: Cloud Deployment (Premium)**
- Deploy to Railway.app, Render.com, or Heroku
- Access from anywhere in the world
- Requires setup but most reliable for multi-location shops

---

## ⚙️ Troubleshooting

### **"Node.js not found"**
- Install Node.js: https://nodejs.org/
- Make sure to check "Add to PATH" during installation
- Restart your computer

### **"Port 3000 already in use"**
- Close other apps using port 3000
- Or change the port in `backend/server.js` line 1: `const PORT = 3000;` → `const PORT = 3001;`

### **"Cannot connect from another device"**
- Make sure devices are on the same Wi-Fi
- Check Windows Firewall — allow port 3000
- Verify the IP address is correct

### **Data not saving**
- Check that the `pos.db` file exists in the root directory
- Make sure the backend is running (the black window should say "Vendora server running...")

---

## 📞 Support

If you encounter issues:
1. Check this README
2. Open the black server window and look for error messages
3. Note the error and search online or ask for help

---

## 🎯 Next Steps

1. **Add Products** — Start with 10-20 products to test
2. **Test a Bill** — Create a sample bill to understand the flow
3. **Scan Barcodes** — Add barcodes to your products for faster billing
4. **Train Staff** — Show staff the keyboard shortcuts (Alt+B, Alt+G, etc.)

---

Enjoy using Vendora! 🎉
