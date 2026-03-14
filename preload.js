const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
    retryConnexion: () => ipcRenderer.send('retry-connexion')
});