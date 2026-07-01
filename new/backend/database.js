const os = require('os');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const ExcelJS = require('exceljs');

// Set the database location to the app's user data directory
const userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Vendora');
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}
const dbPath = path.join(userDataPath, 'database.sqlite');


const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database at', dbPath);
  }
  // Ensure invoice_sequence table exists for atomic invoice numbers
  db.run(`CREATE TABLE IF NOT EXISTS invoice_sequence (id INTEGER PRIMARY KEY CHECK (id = 1), next_invoice INTEGER NOT NULL)`, (err) => {
    if (!err) {
      db.get('SELECT next_invoice FROM invoice_sequence WHERE id = 1', (err, row) => {
        if (!row) {
          db.run('INSERT INTO invoice_sequence (id, next_invoice) VALUES (1, 1)');
        }
      });
    }
  });
});

function closeDatabase(callback) {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed.');
    }
    if (callback) callback(err);
  });
}

// Enable SQLite's WAL (Write-Ahead Logging) mode for crash safety
db.exec('PRAGMA journal_mode = WAL;', (err) => {
  if (err) {
    console.error('Failed to enable WAL mode:', err.message);
  } else {
    console.log('WAL mode enabled for SQLite database.');
  }
});

// Initialize schema: items (with optional columns), sales, settings
db.serialize(() => {
  // items table
  db.run(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      pricePerKg REAL,
      mrp REAL DEFAULT 0,
      category TEXT,
      costPerKg REAL DEFAULT 0,
      quantity REAL DEFAULT 0,
      baseQuantity TEXT,
      supplierId INTEGER,
      batchNo TEXT,
      expiryDate TEXT,
      type TEXT DEFAULT 'loose',
      reorderThreshold REAL DEFAULT 5,
      reorderQuantity REAL DEFAULT 10,
      sku TEXT UNIQUE,
      description TEXT
    )
  `);
  
  // Create index for fast search
  db.run(`CREATE INDEX IF NOT EXISTS idx_items_name ON items(name)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_items_sku ON items(sku)`);

  // Ensure 'mrp' column exists for older DBs
  db.all("PRAGMA table_info(items)", (err, cols) => {
    if (err) return console.error('Failed to read table info', err.message);
    const hasMrp = cols && cols.some(c => c.name === 'mrp');
    if (!hasMrp) {
      db.run('ALTER TABLE items ADD COLUMN mrp REAL DEFAULT 0', (aErr) => {
        if (aErr) console.error('Failed to add mrp column', aErr.message);
        else console.log('Added mrp column to items table');
      });
    }
    // add new optional columns if missing
    const needCategory = !(cols && cols.some(c => c.name === 'category'));
    if (needCategory) db.run('ALTER TABLE items ADD COLUMN category TEXT', (aErr) => { if (aErr) console.error('Failed to add category column', aErr.message); else console.log('Added category column'); });
    const needBaseQty = !(cols && cols.some(c => c.name === 'baseQuantity'));
    if (needBaseQty) db.run('ALTER TABLE items ADD COLUMN baseQuantity TEXT', (aErr) => { if (aErr) console.error('Failed to add baseQuantity column', aErr.message); else console.log('Added baseQuantity column'); });
    const needSupplierId = !(cols && cols.some(c => c.name === 'supplierId'));
    if (needSupplierId) db.run('ALTER TABLE items ADD COLUMN supplierId INTEGER', (aErr) => { if (aErr) console.error('Failed to add supplierId column', aErr.message); else console.log('Added supplierId column'); });
    const needBatch = !(cols && cols.some(c => c.name === 'batchNo'));
    if (needBatch) db.run('ALTER TABLE items ADD COLUMN batchNo TEXT', (aErr) => { if (aErr) console.error('Failed to add batchNo column', aErr.message); else console.log('Added batchNo column'); });
    const needExpiry = !(cols && cols.some(c => c.name === 'expiryDate'));
    if (needExpiry) db.run('ALTER TABLE items ADD COLUMN expiryDate TEXT', (aErr) => { if (aErr) console.error('Failed to add expiryDate column', aErr.message); else console.log('Added expiryDate column'); });
  });

  // sales table: store snapshot of price/cost at time of sale
  db.run(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      itemId INTEGER,
      weight REAL,
      pricePerKg REAL,
      costPerKg REAL,
      total REAL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // settings table for storing key/value pairs like daily target
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // customers table
  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE,
      name TEXT,
      email TEXT,
      loyalty_points REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // customer_balance table: track credit/debt for each customer
  db.run(`
    CREATE TABLE IF NOT EXISTS customer_balance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customerId INTEGER UNIQUE,
      balance REAL DEFAULT 0,
      notes TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(customerId) REFERENCES customers(id)
    )
  `);

  // bills table (enhanced with customer and payment info)
  db.run(`
    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customerId INTEGER,
      customerName TEXT,
      subtotal REAL,
      discount REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total REAL,
      payment_method TEXT,
      items_json TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(customerId) REFERENCES customers(id)
    )
  `);

  // suppliers table: track vendors
  db.run(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      phone TEXT,
      email TEXT,
      address TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // purchases table: track stock purchases from suppliers
  db.run(`
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      itemId INTEGER,
      supplierId INTEGER,
      quantity REAL,
      costPerUnit REAL,
      totalCost REAL,
      purchaseDate TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(itemId) REFERENCES items(id),
      FOREIGN KEY(supplierId) REFERENCES suppliers(id)
    )
  `);

  // Create indexes for fast lookup
  db.run(`CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_bills_customerId ON bills(customerId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_bills_created_at ON bills(created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_purchases_itemId ON purchases(itemId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_purchases_supplierId ON purchases(supplierId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at)`);
  
  // audit log for important changes
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity TEXT,
      entityId INTEGER,
      action TEXT,
      old_value TEXT,
      new_value TEXT,
      user TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entityId)`);
  
  // profile table for owner/store basic info
  db.run(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_name TEXT,
      store_name TEXT,
      store_address TEXT,
      phone TEXT,
      email TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // users table for authentication
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      passwordHash TEXT,
      role TEXT DEFAULT 'user',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)`);

  // stores table for multi-store management
  db.run(`
    CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      address TEXT,
      city TEXT,
      phone TEXT,
      is_primary INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ensure subscriptionPlan setting exists
  db.run("INSERT OR IGNORE INTO settings(key,value) VALUES('subscriptionPlan','free')");

  // expenses table: track all operational expenses
  db.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT,
      category TEXT,
      amount REAL,
      expenseDate TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  
  db.run(`CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_expenses_expenseDate ON expenses(expenseDate)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at)`);
  
    // customer_credit table: records partial payments (due amounts) linked to bills
    db.run(`
      CREATE TABLE IF NOT EXISTS customer_credit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customerId INTEGER,
        billId INTEGER,
        dueAmount REAL,
        paidAmount REAL DEFAULT 0,
        note TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT,
        FOREIGN KEY(customerId) REFERENCES customers(id),
        FOREIGN KEY(billId) REFERENCES bills(id)
      )
    `);
    db.run(`CREATE INDEX IF NOT EXISTS idx_customer_credit_customerId ON customer_credit(customerId)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_customer_credit_billId ON customer_credit(billId)`);

    // Ensure customer_credit has customerName and customerPhone columns for walk-in entries
    db.all("PRAGMA table_info(customer_credit)", (tcErr, tcCols) => {
      if (tcErr) return console.error('Failed to read customer_credit info', tcErr.message);
      const hasCustomerName = tcCols && tcCols.some(c => c.name === 'customerName');
      const hasCustomerPhone = tcCols && tcCols.some(c => c.name === 'customerPhone');
      if (!hasCustomerName) {
        db.run('ALTER TABLE customer_credit ADD COLUMN customerName TEXT', (aErr) => { if (aErr) console.error('Failed to add customerName to customer_credit', aErr.message); else console.log('Added customerName column to customer_credit'); });
      }
      if (!hasCustomerPhone) {
        db.run('ALTER TABLE customer_credit ADD COLUMN customerPhone TEXT', (aErr) => { if (aErr) console.error('Failed to add customerPhone to customer_credit', aErr.message); else console.log('Added customerPhone column to customer_credit'); });
      }
    });

    // debits table: records debit payments (customer bought on credit/debit)
    db.run(`
      CREATE TABLE IF NOT EXISTS debits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        phone TEXT,
        amount REAL,
        total REAL,
        date TEXT,
        billId INTEGER,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    db.run(`CREATE INDEX IF NOT EXISTS idx_debits_phone ON debits(phone)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_debits_created_at ON debits(created_at)`);

    // customer_returns table: comprehensive returns + exchanges tracking
    db.run(`
      CREATE TABLE IF NOT EXISTS customer_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        billId INTEGER NOT NULL,
        productId INTEGER NOT NULL,
        quantityReturned REAL NOT NULL,
        refundAmount REAL NOT NULL,
        refundType TEXT NOT NULL DEFAULT 'cash',
        adjustedBillId INTEGER,
        createdAt TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(billId) REFERENCES bills(id),
        FOREIGN KEY(productId) REFERENCES items(id),
        FOREIGN KEY(adjustedBillId) REFERENCES bills(id)
      )
    `);
    db.run(`CREATE INDEX IF NOT EXISTS idx_customer_returns_billId ON customer_returns(billId)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_customer_returns_productId ON customer_returns(productId)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_customer_returns_createdAt ON customer_returns(createdAt)`);

    // keep old returns + customer_refunds for backward compatibility (optional cleanup later)
    // returns table: track customer returns (LEGACY - for backward compat)
    db.run(`
      CREATE TABLE IF NOT EXISTS returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        billId INTEGER,
        customerId INTEGER,
        itemId INTEGER,
        quantityReturned REAL,
        refundAmount REAL,
        reason TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(billId) REFERENCES bills(id),
        FOREIGN KEY(customerId) REFERENCES customers(id),
        FOREIGN KEY(itemId) REFERENCES items(id)
      )
    `);
    db.run(`CREATE INDEX IF NOT EXISTS idx_returns_billId ON returns(billId)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_returns_customerId ON returns(customerId)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_returns_created_at ON returns(created_at)`);

    // customer_refunds table: track refunds given to customers (LEGACY)
    db.run(`
      CREATE TABLE IF NOT EXISTS customer_refunds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customerId INTEGER,
        refundAmount REAL,
        reason TEXT,
        returnId INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(customerId) REFERENCES customers(id),
        FOREIGN KEY(returnId) REFERENCES returns(id)
      )
    `);
    db.run(`CREATE INDEX IF NOT EXISTS idx_customer_refunds_customerId ON customer_refunds(customerId)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_customer_refunds_created_at ON customer_refunds(created_at)`);
});

// Backup the database
function backupDatabase() {
  const backupPath = path.join(userDataPath, `database-backup-${Date.now()}.sqlite`);
  fs.copyFile(dbPath, backupPath, (err) => {
    if (err) {
      console.error('Error creating database backup:', err.message);
    } else {
      console.log('Database backup created at', backupPath);
    }
  });
}

// Restore the database from a backup
function restoreDatabase(backupFilePath) {
  fs.copyFile(backupFilePath, dbPath, (err) => {
    if (err) {
      console.error('Error restoring database:', err.message);
    } else {
      console.log('Database restored from', backupFilePath);
    }
  });
}

// Wrap billing operations in a transaction for atomicity
function performBillingOperation(billingData, callback) {
  db.serialize(() => {
    db.run('BEGIN TRANSACTION;');

    // Example billing operation
    db.run('INSERT INTO billing (item, amount) VALUES (?, ?);', [billingData.item, billingData.amount], (err) => {
      if (err) {
        console.error('Error during billing operation:', err.message);
        db.run('ROLLBACK;');
        callback(err);
      } else {
        db.run('COMMIT;', (commitErr) => {
          if (commitErr) {
            console.error('Error committing transaction:', commitErr.message);
            callback(commitErr);
          } else {
            console.log('Billing operation completed successfully.');
            callback(null);
          }
        });
      }
    });
  });
}

// Export SQLite data to Excel
function exportToExcel(tableName, outputPath, callback) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(tableName);

  db.all(`SELECT * FROM ${tableName}`, (err, rows) => {
    if (err) {
      console.error('Error fetching data for export:', err.message);
      callback(err);
      return;
    }

    if (rows.length > 0) {
      // Add column headers
      worksheet.columns = Object.keys(rows[0]).map((key) => ({ header: key, key }));

      // Add rows
      rows.forEach((row) => {
        worksheet.addRow(row);
      });
    }

    workbook.xlsx.writeFile(outputPath)
      .then(() => {
        console.log(`Data exported to Excel file at ${outputPath}`);
        callback(null);
      })
      .catch((writeErr) => {
        console.error('Error writing Excel file:', writeErr.message);
        callback(writeErr);
      });
  });
}

module.exports = { db, backupDatabase, restoreDatabase, performBillingOperation, exportToExcel, closeDatabase };
