// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Existing message APIs
  sendMessage: (message) => ipcRenderer.invoke('send-message', message),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  getMessage: () => ipcRenderer.invoke('get-message'),
  closeMessageWindow: () => ipcRenderer.invoke('close-message-window'),
  
  // Auth APIs
  getAuthToken: () => ipcRenderer.invoke('get-auth-token'),
  refreshAuthToken: () => ipcRenderer.invoke('refresh-auth-token'),
  openLogin: () => ipcRenderer.invoke('open-login'),
  logout: () => ipcRenderer.invoke('logout'),
  onAuthSuccess: (callback) => {
    ipcRenderer.on('auth-success', (event, data) => callback(data));
  },
  onAuthError: (callback) => {
    ipcRenderer.on('auth-error', (event, data) => callback(data));
  },
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Presets JSON (word -> systemInstruction, temperature, etc.); path is user-configurable
  getPresetsPath: () => ipcRenderer.invoke('get-presets-path'),
  setPresetsPath: (filePath) => ipcRenderer.invoke('set-presets-path', filePath),
  readPresets: () => ipcRenderer.invoke('read-presets'),
});
