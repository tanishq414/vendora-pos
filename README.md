# Vendora — Advanced Offline POS System

A comprehensive Point-of-Sale system built with vanilla HTML/CSS/JS and Node.js + Express + SQLite.

## 🚀 Quick Start — Run with One Double-Click

**For Windows:**
1. Install Node.js from https://nodejs.org/ (click green "LTS" button)
2. Double-click `START_POS.bat` in the project folder
3. Open your browser to: **http://localhost:3000**

**For Mac/Linux:**
1. Install Node.js from https://nodejs.org/
2. Run: `chmod +x START_POS.sh && ./START_POS.sh`
3. Open your browser to: **http://localhost:3000**

📖 **For detailed setup & usage instructions, see:** [QUICK_START.md](QUICK_START.md)

---

## Features

### 1. Dashboard
- Real-time revenue and profit tracking
- Daily sales target tracking with progress
- Stock alerts for low-inventory items
- AI-powered sales insights (trend comparison)

### 2. Inventory Management
- Add/Edit/Delete products with full details (name, type, price, cost, quantity, SKU, description)
- **Voice Search**: Click 🎤 and speak product name
- Text search by name, SKU, or description
- Product types: Loose or Packet
- Reorder threshold configuration
- Automatic low-stock alerts

### 3. Reorder Predictions
- Shows items below reorder threshold
- Calculates average daily sales from past 7 days
- Displays days until stockout (color-coded)
- Suggests reorder quantity

### 4. Billing (Shopping Cart)
  - Search customers by phone
  - Add new customers instantly
  - Track loyalty points (1 point per ₹10 spent)
  - Apply loyalty discounts

## Tech Stack
### Prerequisites
- Node.js (v14+)
- npm

## Complete Feature Set Summary
Then open: **http://localhost:3000/**

### Production Run

```powershell
npm start
```

## How to Use

### Add Products (Inventory Tab)
### Search Products
- **Text Search**: Type in search box to filter by name/SKU
- **Voice Search**: Click 🎤, speak product name (e.g., "rice", "milk")

### Create a Bill (Billing Tab)
1. Select item from dropdown + enter quantity → click "+ Add" to cart
2. Or use **Voice**: Say "Add 2 packets of milk" 
3. Adjust cart quantities or remove items
4. Enter customer phone (or add new customer)
5. Choose payment method
6. Apply loyalty discount (optional)
7. Click "Generate Bill"
8. Print or Share via WhatsApp/SMS

### Track Sales (Dashboard)
- View total revenue, profit, progress to daily target
- See stock alerts and trending insights

### Predict Reorders (Predictions Tab)
- View items running low on stock
- See days until stockout and suggested reorder quantities

## Key Endpoints

**Products**
- `POST /item` — Add product
- `PUT /item/:id` — Edit product
- `DELETE /item/:id` — Delete product
- `GET /items` — List all products
- `GET /search?q=query` — Search products

**Customers & Loyalty**
- `POST /customer` — Add/update customer
- `GET /customer/:phone` — Get customer by phone
## Documentation Files

- `GET /bills?limit=10` — Get recent bills

**Dashboard**
- `GET /dashboard?range=today|week|month` — Sales overview
**items** — Products with pricing, inventory, reorder settings
**sales** — Individual sales transactions (for trend analysis)
**customers** — Customer info and loyalty points
**bills** — Bill records with items, discounts, customer info
**suppliers** — Supplier contact and address information
**purchases** — Purchase records from suppliers with cost and quantity tracking
**settings** — App settings (daily target, etc.)

## Offline First

✅ No internet required
✅ All data stored locally in SQLite
✅ Export data (future feature)
✅ Works on LAN without server

## Future Enhancements

- PDF bill generation
- Barcode scanning integration
- Stock photo API for product images
- Email/WhatsApp automation for bills
- Advanced analytics and reports
- Cloud backup (optional)

## License

Open source. Feel free to modify and use!
This is a minimal Point-of-Sale example using:

- Frontend: HTML + CSS + Vanilla JavaScript

How to run

### Record Purchases (Purchases Tab)
1. **Add Supplier** (Optional setup):
  - Click "+ New Supplier"
  - Fill supplier name, phone, email, address
  - Save
2. **Record a Purchase**:
  - Select supplier from dropdown
  - Select product to purchase
  - Enter quantity and cost per unit
  - Add invoice date and invoice number (in notes)
  - Click "Record Purchase"
3. **Verify Stock Update**:
  - Stock automatically increases in inventory
  - Cost per unit recalculated using weighted average
4. **View Purchase History**:
  - See all purchases with dates, suppliers, quantities
  - Filter by product to see purchasing history
  - View weekly/monthly spending summary
```powershell
npm install
```


3. Production (single process):

Open http://localhost:3000/ in your browser.
- Generate a bill by selecting an item and entering weight; the backend calculates total.

- Add edit/delete item endpoints and UI.
- Add receipts and printing support.
- Add authentication (optional) and data export.
