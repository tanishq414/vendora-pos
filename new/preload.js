const { contextBridge, ipcRenderer } = require('electron');

// NOTE: addItem/purchases/items/suppliers/dashboard used to be exposed here
// via IPC, but their main.js handlers were dead code (never actually
// registered/used) and the frontend gets this data via fetch() to the
// Express server instead (see app.js). Only print-bill is a real IPC
// feature (native printing via the main process), so that's all that's
// exposed now.
contextBridge.exposeInMainWorld('mainApi', {
  printBill: (billData) => ipcRenderer.invoke('print-bill', billData)
});

// app.js calls window.api.printBill(), not window.mainApi.printBill(),
// so alias it here too to match what the frontend actually expects.
contextBridge.exposeInMainWorld('api', {
  printBill: (billData) => ipcRenderer.invoke('print-bill', billData)
});
