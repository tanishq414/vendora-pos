# Vendora - Changelog

All notable changes to Vendora will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.5.0] - December 1, 2025

### Added
- **Keyboard Shortcuts** - Quick navigation with Alt+B, Alt+I, Alt+G, Alt+Shift+H for shortcuts help
- **Daily Total Sales Card** - Dashboard now shows daily sales prominently with date context
- **Barcode Auto-Search** - Inventory search now prioritizes exact barcode matches, highlights results instantly
- **Customer Name Field** - Optional name field in Billing to personalize receipts without phone lookup
- **Debit Payment Recording** - Record customer debits with name, phone, amount, date, and track in Reports
- **Debits Management** - View all recorded debits in Reports page with phone filter and refresh controls
- **Mobile Responsive Design** - Full mobile-first CSS with touch-friendly buttons and card layouts
- **Light Theme** - White background with dark text for better readability
- **Auto-Updater Scripts** - UPDATE_AIPOS.bat and UPDATE_AIPOS.sh for one-click updates with database backup

### Improved
- Payment method dropdown now shows Cash, Online, Credit, and Debit options
- Bill printing displays customer name prominently
- Search results display barcode with visual badge and 📱 icon
- Barcode detection supports USB scanners and manual input
- Dashboard filters now calculate daily sales for the selected period
- Error handling for barcode search (graceful fallback to text search)
- Keyboard shortcut hints in tooltips on main buttons

### Fixed
- Select dropdown coloring on light background
- Table header alignment in desktop view
- JSON parse errors in debits filter
- Payment hint text updated to remove deprecated "Debt" reference

### Technical
- Added `customerName` column to bills table
- Added debits table with id, name, phone, amount, total, date, billId, notes, created_at
- Backend /search endpoint now prioritizes exact SKU/barcode matches
- Backend /debits endpoint returns list with limit and count
- Frontend performSearch() now auto-highlights exact barcode matches
- Version tracking with version.txt file

---

## [1.4.0] - November 28, 2025

### Added
- **Credit Payment Option** - Customers can pay later; balance tracked automatically
- **Dual-Mode Scanning** - Barcode scanning in Billing and Inventory management
- **CSV Import** - Bulk import products from CSV file (Name, Price, MRP, Type, Quantity, SKU)
- **Quick Create Modal** - Instantly create products when scanning unknown barcodes
- **Loyalty Points System** - 1 point per ₹10 spent; customers can redeem points for discount
- **Predictions Page** - Shows items running low on stock with days-to-stockout calculations

### Improved
- Inventory caching for O(1) barcode lookup
- SKU indexing for fast product search
- Reports page enhanced with recent transactions and profit margins

### Fixed
- Barcode scanner modal styling
- Camera permission handling for mobile browsers

---

## [1.3.0] - November 20, 2025

### Added
- **Reports Page** - Sales trends, top products, peak hours, profit margins
- **Dashboard Filters** - Filter by date range, payment method, category, staff
- **Auto Insights** - AI-powered sales recommendations
- **Stock Alerts** - Real-time alerts for low inventory items

### Improved
- Dashboard UI with metric cards
- Sales trend visualization with SVG charts
- Better date range handling

---

## [1.2.0] - November 10, 2025

### Added
- **Expense Tracker** - Record operational expenses by category
- **Purchase Management** - Track supplier purchases and costs
- **Profit Calculations** - Automatic profit margin calculations based on cost vs price

### Improved
- Better inventory cost tracking
- Expense categories standardized

---

## [1.1.0] - October 28, 2025

### Added
- **Responsive Mobile Design** - Works on phones, tablets, and desktops
- **Multi-Device LAN Support** - Access POS from multiple devices on same network
- **Bill Sharing** - Share bills via WhatsApp, SMS, or copy to clipboard
- **Customer Search** - Quick lookup of existing customers by phone

### Improved
- UI/UX improvements for touch screens
- Better bill printing format

---

## [1.0.0] - October 15, 2025

### Added
- **Core POS Features**
  - Product inventory management
  - Shopping cart and billing
  - Multiple payment methods (Cash, Card, UPI)
  - Bill printing and receipt generation
  
- **Dashboard**
  - Revenue and profit tracking
  - Daily sales overview
  - Product and stock management
  
- **Offline First**
  - SQLite database
  - No internet required
  - Automatic data persistence
  
- **Easy Deployment**
  - Double-click START_POS.bat to launch
  - Automatic dependency installation
  - Cross-platform support (Windows, Mac, Linux)

---

## Update Instructions

### For Windows:
1. Double-click `UPDATE_AIPOS.bat`
2. Click "Update" when prompted
3. Wait for download and installation to complete
4. Your database is automatically backed up before updating

### For Mac/Linux:
1. Run `chmod +x UPDATE_AIPOS.sh`
2. Run `./UPDATE_AIPOS.sh`
3. Enter "y" when prompted
4. Updates will be downloaded and applied
5. Your database is automatically backed up

### Manual Update:
1. Go to https://github.com/your-repo/aipos
2. Click "Code" → "Download ZIP"
3. Extract to a new folder
4. Copy your `pos.db` file to the new folder
5. Delete old folder, rename new folder
6. Run START_POS.bat

---

## Version Numbering

Versions follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0) - Breaking changes
- **MINOR** (1.1.0) - New features, backward compatible
- **PATCH** (1.0.1) - Bug fixes, backward compatible

---

## Support & Feedback

- Check README.md for common issues
- Review SETUP_GUIDE.md for configuration help
- Report bugs or suggest features on GitHub Issues

---

## Contributors

- **Vendora Team** - Development and maintenance

---

**Last Updated:** December 1, 2025
