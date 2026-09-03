// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Existing message APIs
  sendMessage: (message) => ipcRenderer.invoke('send-message', message),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  getMessage: () => ipcRenderer.invoke('get-message'),
  closeMessageWindow: () => ipcRenderer.invoke('close-message-window'),
  
  getOpenRouterModelName: () => ipcRenderer.invoke('get-openrouter-model-name'),

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
  getBundledPresetsPath: () => ipcRenderer.invoke('get-bundled-presets-path'),
  setPresetsPathToDefault: () => ipcRenderer.invoke('set-presets-path-to-default'),
  exportPresets: () => ipcRenderer.invoke('export-presets'),
  importPresets: () => ipcRenderer.invoke('import-presets'),
  writePresets: (presets) => ipcRenderer.invoke('write-presets', presets),
  openPresetsWindow: () => ipcRenderer.invoke('open-presets-window'),
  openSubscriptionWindow: () => ipcRenderer.invoke('open-subscription-window'),
  onPresetsUpdated: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('presets-updated', handler);
    return () => ipcRenderer.removeListener('presets-updated', handler);
  },

  // Settings: keybind, window size/position
  getKeybind: () => ipcRenderer.invoke('get-keybind'),
  setKeybind: (accel) => ipcRenderer.invoke('set-keybind', accel),
  getWindowSize: () => ipcRenderer.invoke('get-window-size'),
  setWindowSize: (size) => ipcRenderer.invoke('set-window-size', size),
  getWindowPosition: () => ipcRenderer.invoke('get-window-position'),
  setWindowPosition: (position) => ipcRenderer.invoke('set-window-position', position),
  getSizePresets: () => ipcRenderer.invoke('get-size-presets'),
  getPositionOptions: () => ipcRenderer.invoke('get-position-options'),

  getRunOnStartup: () => ipcRenderer.invoke('get-run-on-startup'),
  setRunOnStartup: (enabled) => ipcRenderer.invoke('set-run-on-startup', enabled),

  closeWindow: () => ipcRenderer.invoke('close-window'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),

  getTheme: () => ipcRenderer.invoke('get-theme'),
  setTheme: (preference) => ipcRenderer.invoke('set-theme', preference),
  onThemeChanged: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('theme-changed', handler);
    return () => ipcRenderer.removeListener('theme-changed', handler);
  },
  openSettingsWindow: () => ipcRenderer.invoke('open-settings-window'),
  toggleBubble: () => ipcRenderer.invoke('toggle-bubble'),
});
