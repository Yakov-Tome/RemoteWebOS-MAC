const { contextBridge, ipcRenderer } = require('electron');

// The page is served over http://127.0.0.1, so it has no Node access by design.
// This is the only bridge it gets: resizing the window for compact mode, plus the
// menu's toggle coming back the other way.
contextBridge.exposeInMainWorld('remoteShell', {
  isShell: true,
  setCompact: (on) => ipcRenderer.invoke('remote:compact', !!on),
  onToggleCompact: (fn) => ipcRenderer.on('remote:toggle-compact', () => fn()),
});
