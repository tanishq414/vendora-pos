## Vendora Setup Instructions for Shop Owners

### For Complete Beginners

Follow these steps in order:

---

### Step 1: Install Node.js (One-time only)

1. Go to: https://nodejs.org/
2. Click the big green button labeled **"LTS"**
3. Click **"Download"**
4. Once downloaded, open the installer
5. Click **"Next"** through the installation
6. ⚠️ **IMPORTANT**: Check the box for **"Add to PATH"**
7. Click **"Install"** and wait for it to finish
8. Click **"Finish"**

---

### Step 2: Get Vendora Files

1. If you don't have Vendora yet, download it or copy it to your computer
2. Extract/unzip the Vendora folder to a location like `C:\Users\YourName\Desktop\Vendora`

---

### Step 3: Start the POS System

#### Option A: Double-click (Easiest)
1. Inside the Vendora folder, find `START_POS.bat`
2. **Double-click** it
3. A black window will appear and say "Vendora server running..."
4. Done! The server is ready

#### Option B: Create a Desktop Shortcut (Recommended)
1. Inside the Vendora folder, find `Create_Desktop_Shortcut.bat`
2. **Double-click** it
3. A shortcut named "Vendora" will appear on your Desktop
4. **Next time, just double-click the "Vendora" shortcut to start**

#### Option C: Command Line (For advanced users)
1. Open PowerShell/Command Prompt
2. Navigate to the Vendora folder: `cd C:\Users\YourName\Desktop\Vendora`
3. Type: `npm start`

---

### Step 4: Open in Browser

1. Open any web browser (Chrome, Edge, Firefox, Safari)
2. Type in the address bar: `http://localhost:3000`
3. Press **Enter**
4. **Vendora is now running!** 🎉

---

### Step 5: Initial Setup (First Time Only)

1. Click the **"Settings"** tab
2. Fill in your shop details:
   - Owner Name
   - Store Name
   - Address
   - Phone
   - Email
3. Click **"Save Profile"**

---

### Step 6: Add Your Products

1. Click **"Inventory"** tab
2. Click **"+ Add Product"** button
3. Fill in product details:
   - **Name**: Product name (e.g., "Milk Packet", "Rice")
   - **Price**: Selling price (e.g., 60)
   - **MRP**: Max Retail Price (optional)
   - **Cost**: Your cost price (optional, for profit tracking)
   - **Type**: "Packet" or "Loose"
   - **Quantity**: How many you have in stock
   - **SKU**: Barcode (optional)
4. Click **"Save"**
5. Repeat for all your products

---

### Step 7: Create Your First Bill

1. Click **"Billing"** tab
2. Select a product from the dropdown
3. Enter quantity (e.g., 2)
4. Click **"+ Add"**
5. Repeat for more products
6. Select payment method (Cash, Card, etc.)
7. Click **"Generate Bill"**
8. Click **"Print"** to print the receipt

---

### Step 8: Train Your Staff

Show your staff these keyboard shortcuts:

- **Alt+B** — Go to Billing
- **Alt+I** — Go to Inventory  
- **Alt+G** — Generate Bill
- **Alt+C** — Clear Cart
- **Alt+Shift+H** — Show all shortcuts

---

## Using on Multiple Devices (Same Shop)

If you want to use Vendora on multiple phones/tablets in your shop:

1. **Find your computer's IP address:**
   - Open PowerShell
   - Type: `ipconfig`
   - Look for "IPv4 Address" (like `192.168.1.100`)

2. **On your phone/tablet:**
   - Connect to the same Wi-Fi as your computer
   - Open browser and type: `http://192.168.1.100:3000`
   - (Replace 192.168.1.100 with your actual IP)

3. **That's it!** Multiple devices can now access the same Vendora system

---

## Common Issues & Fixes

### Problem: "Node.js not found"
**Solution:**
- Reinstall Node.js from https://nodejs.org/
- Make sure to check "Add to PATH" during installation
- Restart your computer

### Problem: Black window appears and closes immediately
**Solution:**
- Make sure you're inside the Vendora folder
- Check that `backend/server.js` exists
- Try running `npm install` first

### Problem: "Port 3000 already in use"
**Solution:**
- Close other programs using port 3000
- Or start on a different port (change in `backend/server.js`)

### Problem: Browser says "Cannot reach localhost:3000"
**Solution:**
- Make sure the black server window is still open
- Try opening http://127.0.0.1:3000 instead
- Check if Windows Firewall is blocking port 3000

### Problem: Data not saving
**Solution:**
- Check that the `pos.db` file exists in the main Vendora folder
- Make sure you have write permissions to the folder
- Try running as Administrator

---

## Data Backup

Your data is stored in `pos.db` file. To backup:

1. Find the `pos.db` file in the Vendora folder
2. Copy it to another location (USB drive, cloud storage, etc.)
3. Done! You can restore from this backup anytime

---

## Need Help?

1. Check the black server window for error messages
2. Make sure Node.js is properly installed
3. Make sure all files in Vendora folder are intact
4. Try restarting your computer

---

**You're all set! Enjoy using Vendora!** 🎉
