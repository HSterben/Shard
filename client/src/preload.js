// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendMessage: (message) => ipcRenderer.invoke('send-message', message),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  getMessage: () => ipcRenderer.invoke('get-message'),
  closeMessageWindow: () => ipcRenderer.invoke('close-message-window'),
});