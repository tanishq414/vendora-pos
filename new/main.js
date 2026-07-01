const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const dbModule = require('./backend/database');
const db = dbModule.db;
let mainWindow;
const { spawn } = require('child_process');
let backendProcess;

// App state can be managed here as needed

// Automatic database backup every 6 hours
const BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
if (dbModule && typeof dbModule.backupDatabase === 'function') {
  setInterval(() => {
    dbModule.backupDatabase();
  }, BACKUP_INTERVAL_MS);
}

// Backup and safely close database on app exit
function backupAndCloseDatabase() {
  if (dbModule && typeof dbModule.backupDatabase === 'function') {
    dbModule.backupDatabase();
  }
  if (dbModule && typeof dbModule.closeDatabase === 'function') {
    dbModule.closeDatabase();
  }
}

app.on('before-quit', backupAndCloseDatabase);
app.on('will-quit', () => {
  backupAndCloseDatabase();
  if (backendProcess) {
    backendProcess.kill();
  }
});

// Only keep IPC for print-bill and system-level tasks
ipcMain.handle('print-bill', async (event, billData) => {
  // Simulate random printer failure for testing
  console.log('Received print-bill IPC:', billData);
  if (Math.random() < 0.5) {
    // Simulate failure
    console.error('Simulated printer failure!');
    return { success: false, error: 'Printer not responding' };
  }
  // Simulate success
  return { success: true };
});

// IPC: Create Bill (with tax, totals, invoice number, and stock update)
ipcMain.handle('create-bill', async (event, billData) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN IMMEDIATE TRANSACTION;', (beginErr) => {
        if (beginErr) return reject(beginErr);
        // Atomic invoice number fetch and increment
        db.get('SELECT next_invoice FROM invoice_sequence WHERE id = 1', (seqErr, seqRow) => {
          if (seqErr || !seqRow) {
            db.run('ROLLBACK;');
            return reject(seqErr || new Error('Invoice sequence not found'));
          }
          const invoiceNumber = seqRow.next_invoice;
          db.run('UPDATE invoice_sequence SET next_invoice = ? WHERE id = 1', [invoiceNumber + 1], (updateErr) => {
            if (updateErr) {
              db.run('ROLLBACK;');
              return reject(updateErr);
            }
            // Calculate totals and tax
            const subtotal = billData.items.reduce((sum, item) => sum + (item.pricePerKg * item.weight), 0);
            const tax = billData.taxRate ? subtotal * billData.taxRate : 0;
            const total = subtotal + tax;
            // Insert bill with atomic invoice number
            db.run(`INSERT INTO bills (id, customerId, customerName, subtotal, discount, tax, total, payment_method, items_json, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [invoiceNumber, billData.customerId || null, billData.customerName || '', subtotal, billData.discount || 0, tax, total, billData.paymentMethod || '', JSON.stringify(billData.items), billData.notes || ''],
              function(err) {
                if (err) {
                  db.run('ROLLBACK;');
                  return reject(err);
                }
                // Insert sales and update stock synchronously
                let errorOccurred = false;
                for (const item of billData.items) {
                  db.run(`INSERT INTO sales (itemId, weight, pricePerKg, costPerKg, total) VALUES (?, ?, ?, ?, ?)`,
                    [item.id, item.weight, item.pricePerKg, item.costPerKg, item.pricePerKg * item.weight],
                    (err) => {
                      if (err) errorOccurred = true;
                    });
                  db.run(`UPDATE items SET quantity = quantity - ? WHERE id = ?`, [item.weight, item.id], (err) => {
                    if (err) errorOccurred = true;
                  });
                  if (errorOccurred) break;
                }
                if (errorOccurred) {
                  db.run('ROLLBACK;');
                  return reject(new Error('Error updating sales or stock.'));
                }
                db.run('COMMIT;', (commitErr) => {
                  if (commitErr) return reject(commitErr);
                  resolve({ billId: invoiceNumber, subtotal, tax, total });
                });
              });
          });
        });
      });
    });
  });
});

// IPC: Get next invoice number
ipcMain.handle('get-next-invoice', async () => {
  return new Promise((resolve, reject) => {
    db.get('SELECT MAX(id) as maxId FROM bills', (err, row) => {
      if (err) return reject(err);
      resolve((row && row.maxId ? row.maxId + 1 : 1));
    });
  });
});

// IPC: Update stock for an item
ipcMain.handle('update-stock', async (event, { itemId, quantity }) => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE items SET quantity = ? WHERE id = ?', [quantity, itemId], (err) => {
      if (err) return reject(err);
      resolve(true);
    });
  });
});

// Add these IPC handlers for frontend integration
// ipcMain.handle('add-item', async (event, itemData) => {
//   return new Promise((resolve, reject) => {
//     db.run(
//       `INSERT INTO items (name, pricePerKg, mrp, costPerKg, quantity, type, sku, description, reorderThreshold, reorderQuantity, category, baseQuantity, supplierId, batchNo, expiryDate)
//        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//       [
//         itemData.name,
//         itemData.pricePerKg,
//         itemData.mrp,
//         itemData.costPerKg,
//         itemData.quantity,
//         itemData.type,
//         itemData.sku,
//         itemData.description,
//         itemData.reorderThreshold,
//         itemData.reorderQuantity,
//         itemData.category,
//         itemData.baseQuantity,
//         itemData.supplierId,
//         itemData.batchNo,
//         itemData.expiryDate
//       ],
//       function (err) {
//         if (err) return reject(err);
//         resolve({ id: this.lastID });
//       }
//     );
//   });
// });

// ipcMain.handle('get-purchases', async () => {
//   return new Promise((resolve, reject) => {
//     db.all('SELECT * FROM purchases', (err, rows) => {
//       if (err) return reject(err);
//       resolve(rows);
//     });
//   });
// });

// ipcMain.handle('get-items', async () => {
//   return new Promise((resolve, reject) => {
//     db.all('SELECT * FROM items', (err, rows) => {
//       if (err) return reject(err);
//       resolve(rows);
//     });
//   });
// });

// ipcMain.handle('get-suppliers', async () => {
//   return new Promise((resolve, reject) => {
//     db.all('SELECT * FROM suppliers', (err, rows) => {
//       if (err) return reject(err);
//       resolve(rows);
//     });
//   });
// });

// ipcMain.handle('get-dashboard', async () => {
//   return new Promise((resolve, reject) => {
//     db.get(
//       `SELECT 
//         (SELECT COUNT(*) FROM items) as itemCount,
//         (SELECT COUNT(*) FROM suppliers) as supplierCount,
//         (SELECT COUNT(*) FROM bills) as billCount,
//         (SELECT SUM(total) FROM bills) as totalSales
//       `,
//       (err, row) => {
//         if (err) return reject(err);
//         resolve(row);
//       }
//     );
//   });
// });

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });


  const indexPath = path.join(__dirname, 'frontend', 'index.html');
  // Delay loading frontend to allow backend to start
  setTimeout(() => {
    mainWindow.loadFile(indexPath).catch((err) => {
      console.error('Failed to load frontend:', err);
    });
  }, 2000); // 2 second delay

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Backend is now part of main process: SQLite and state initialized here
  // dbModule.db is ready for use; expose via ipcMain as needed
}

app.on('ready', () => {
  // Auto-start backend server (robust: use node, shell true)
  const backendPath = path.join(__dirname, 'backend', 'server.js');
  backendProcess = spawn('node', [backendPath], {
    cwd: path.join(__dirname, 'backend'),
    stdio: 'inherit',
    shell: true
  });
  backendProcess.on('error', (err) => {
    console.error('Failed to start backend:', err);
  });
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});