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

// NOTE: Billing, invoicing, and stock updates are handled entirely by the
// Express server (new/backend/server.js, spawned below) via HTTP fetch()
// calls from the frontend. The IPC handlers that used to live here
// (create-bill, get-next-invoice, update-stock, plus several commented-out
// stubs for add-item/get-purchases/get-items/get-suppliers/get-dashboard)
// duplicated that logic against the SAME SQLite file from a second
// connection in this process, which risked "database is locked" errors.
// They were dead code - the frontend never called them - so they've been
// removed. If main-process db access is needed in future, prefer calling
// the server.js HTTP API instead of opening a second db connection.

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
