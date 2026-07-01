const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mainApi', {
  addItem: (data) => ipcRenderer.invoke('add-item', data),
  purchases: () => ipcRenderer.invoke('get-purchases'),
  items: () => ipcRenderer.invoke('get-items'),
  suppliers: () => ipcRenderer.invoke('get-suppliers'),
  dashboard: () => ipcRenderer.invoke('get-dashboard')
});