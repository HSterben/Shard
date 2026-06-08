import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  globalShortcut,
  nativeImage,
  screen,
  ipcMain,
  shell,
  dialog,
} from "electron";
import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import started from "electron-squirrel-startup";
import Store from "electron-store";

const CLIENT_ROOT = path.join(__dirname, "..", "..");

function loadEnvFile(name) {
  const filePath = path.join(CLIENT_ROOT, name);
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

function getOpenRouterModelNameFromEnv() {
  return (
    process.env.openrouter_model_name?.trim() ||
    process.env.OPENROUTER_MODEL_NAME?.trim() ||
    null
  );
}

loadEnvFile(".env.local");
loadEnvFile(".env");

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Initialize secure store for auth tokens
const store = new Store({
  name: "shard-auth",
  encryptionKey: "shard-secure-storage-key-2024",
});

// App config (no encryption) for presets and window settings
const configStore = new Store({ name: "shard-config" });
const PRESETS_PATH_KEY = "presetsPath";
const KEYBIND_KEY = "keybind";
const WINDOW_SIZE_KEY = "windowSize";
const WINDOW_POSITION_KEY = "windowPosition";

const SIZE_PRESETS = {
  XSmall: 0.08,
  Small: 0.12,
  Regular: 0.20,   // was XLarge
  Large: 0.28,
  XLarge: 0.36,
};
const SIZE_LABELS = ["XSmall", "Small", "Regular", "Large", "XLarge"];
const POSITION_OPTIONS = ["bottom-right", "bottom-left", "top-right", "top-left"];
const DEFAULT_KEYBIND = "CommandOrControl+Alt+I";
const MARGIN = 20;

function getDefaultPresetsPath() {
  return path.join(app.getPath("userData"), "shard-presets.json");
}

// Icon path: dev = app path/src/icon; packaged = resources/icon (from extraResource)
function getIconPath(filename) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "icon", filename);
  }
  return path.join(app.getAppPath(), "src", "icon", filename);
}

function getPresetsPathsToTry() {
  const custom = configStore.get(PRESETS_PATH_KEY);
  if (custom) return [custom];
  const primary = getDefaultPresetsPath();
  if (process.platform === "win32") {
    const roaming = path.join(process.env.APPDATA || "", "shard", "shard-presets.json");
    if (roaming) return [roaming, primary];
  }
  return [primary];
}

const DEFAULT_PRESETS = {
  Simplify: {
    description: "Simplify the following text.",
    systemInstruction: "You are a helpful assistant that simplifies text. Use shorter sentences and plain language.",
    temperature: 0.3,
    frequencyPenalty: 0,
    presencePenalty: 0,
  },
};

// Auth configuration
// Note: .convex.cloud is for queries/mutations, .convex.site is for HTTP endpoints
const CONVEX_HTTP_URL = "https://strong-poodle-712.convex.site";
const AUTH_LOGIN_URL = `${CONVEX_HTTP_URL}/auth/login`;
const AUTH_REFRESH_URL = `${CONVEX_HTTP_URL}/auth/refresh`;
const STRIPE_PORTAL_URL = `${CONVEX_HTTP_URL}/stripe/create-portal-session-auth`;
const STRIPE_CHECKOUT_URL = `${CONVEX_HTTP_URL}/stripe/create-checkout-session-auth`;

// Helper: Decode JWT and check if expired
function isTokenExpired(token) {
  if (!token) return true;
  try {
    // JWT is base64url encoded: header.payload.signature
    const parts = token.split(".");
    if (parts.length !== 3) return true;

    // Decode payload (middle part)
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    );

    // Check expiration (exp is in seconds, Date.now() is in ms)
    // Add 60 second buffer to refresh before actual expiry
    const expirationTime = payload.exp * 1000;
    const bufferMs = 60 * 1000; // 1 minute buffer
    return Date.now() >= expirationTime - bufferMs;
  } catch (err) {
    console.error("Error decoding token:", err);
    return true;
  }
}

// Helper: Refresh the access token using refresh token
async function refreshAccessToken() {
  const refreshToken = store.get("refreshToken");
  if (!refreshToken) {
    console.log("No refresh token available");
    return null;
  }

  try {
    console.log("Attempting to refresh access token...");
    const response = await fetch(AUTH_REFRESH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      console.error("Token refresh failed:", response.status);
      // Clear invalid tokens
      store.delete("accessToken");
      store.delete("refreshToken");
      return null;
    }

    const data = await response.json();
    console.log("Token refresh successful");

    // Store new tokens
    if (data.access_token) {
      store.set("accessToken", data.access_token);
    }
    if (data.refresh_token) {
      store.set("refreshToken", data.refresh_token);
    }

    return data.access_token;
  } catch (err) {
    console.error("Error refreshing token:", err);
    return null;
  }
}

async function getValidAccessToken() {
  let token = store.get("accessToken");
  if (token && !isTokenExpired(token)) return token;
  if (token || store.get("refreshToken")) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send("auth-success", { token: newToken });
      });
      return newToken;
    }
  }
  return null;
}

async function stripeAuthedPost(url, body = {}) {
  const token = await getValidAccessToken();
  if (!token) {
    return { success: false, error: "Not signed in. Please sign in and try again." };
  }
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { success: false, error: data.error || `Request failed (${response.status})` };
    }
    return { success: true, data };
  } catch (err) {
    console.error("Stripe API request failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error contacting billing server",
    };
  }
}

let mainWindow = null;
let tray = null;
let isToggling = false; // Prevent double-toggle

// Register custom protocol for OAuth callback
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("shard", process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient("shard");
}

// Handle deep link on Windows/Linux (single instance)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, commandLine) => {
    console.log("Second instance detected, commandLine:", commandLine);
    // Someone tried to run a second instance, handle the deep link
    const url = commandLine.find((arg) => arg.startsWith("shard://"));
    if (url) {
      console.log("Found shard:// URL in second instance:", url);
      handleAuthCallback(url);
    }

    // Focus main window if exists
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Handle deep link on macOS
app.on("open-url", (event, url) => {
  event.preventDefault();
  handleAuthCallback(url);
});

// Process auth callback URL
function handleAuthCallback(url) {
  console.log("Handling auth callback URL:", url);
  try {
    const parsedUrl = new URL(url);
    // For shard://auth/success, hostname="auth", pathname="/success"
    // Combine them to get the full path
    const fullPath = parsedUrl.hostname + parsedUrl.pathname;
    console.log("Parsed path:", fullPath);

    if (fullPath === "auth/success") {
      const token = parsedUrl.searchParams.get("token");
      const refresh = parsedUrl.searchParams.get("refresh");
      console.log("Token received:", token ? "yes" : "no");

      if (token) {
        // Store tokens securely
        store.set("accessToken", token);
        if (refresh) {
          store.set("refreshToken", refresh);
        }
        console.log("Token stored successfully");

        // Notify all windows of successful auth
        BrowserWindow.getAllWindows().forEach((win) => {
          win.webContents.send("auth-success", { token });
        });
      }
    } else if (fullPath === "auth/error") {
      const message =
        parsedUrl.searchParams.get("message") || "Authentication failed";
      console.log("Auth error:", message);

      // Notify all windows of auth error
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send("auth-error", { message });
      });
    }
  } catch (err) {
    console.error("Error handling auth callback:", err);
  }
}

// Fade animation functions
const fadeIn = (window, callback) => {
  if (!window) return;
  window.setOpacity(0);
  let opacity = 0;
  const fadeInterval = setInterval(() => {
    opacity += 0.1;
    if (opacity >= 1) {
      clearInterval(fadeInterval);
      window.setOpacity(1);
      if (callback) callback();
    } else {
      window.setOpacity(opacity);
    }
  }, 16); // ~60fps
};

const fadeOut = (window, callback) => {
  if (!window) return;
  let opacity = window.getOpacity();
  const fadeInterval = setInterval(() => {
    opacity -= 0.1;
    if (opacity <= 0) {
      clearInterval(fadeInterval);
      window.setOpacity(0);
      if (callback) callback();
    } else {
      window.setOpacity(opacity);
    }
  }, 16); // ~60fps
};

function getWindowSizePreset() {
  return configStore.get(WINDOW_SIZE_KEY) || "Regular";
}

function getWindowPositionPreset() {
  return configStore.get(WINDOW_POSITION_KEY) || "bottom-right";
}

const ASPECT_RATIO = 56 / 420;

function calculateWindowSize(screenWidth) {
  const sizeKey = getWindowSizePreset();
  const sizePercentage = SIZE_PRESETS[sizeKey] ?? SIZE_PRESETS.Regular;
  const windowWidth = Math.round(screenWidth * sizePercentage);
  const windowHeight = Math.round(windowWidth * ASPECT_RATIO);
  return { width: windowWidth, height: windowHeight };
}

function getWindowPositionXY(workArea, width, height) {
  const { x: wx, y: wy, width: ww, height: wh } = workArea;
  const pos = getWindowPositionPreset();
  switch (pos) {
    case "bottom-left":
      return { x: wx + MARGIN, y: wy + wh - height - MARGIN };
    case "top-right":
      return { x: wx + ww - width - MARGIN, y: wy + MARGIN };
    case "top-left":
      return { x: wx + MARGIN, y: wy + MARGIN };
    default:
      return { x: wx + ww - width - MARGIN, y: wy + wh - height - MARGIN };
  }
}

const createWindow = () => {
  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workArea;
  const { width, height } = calculateWindowSize(workArea.width);
  const { x, y } = getWindowPositionXY(workArea, width, height);

  const windowIcon = getIconPath(process.platform === "win32" ? "crystal.ico" : "crystal.png");
  mainWindow = new BrowserWindow({
    width,
    height,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    icon: windowIcon,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.setPosition(x, y);

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();

  // Set initial opacity to 0 for fade-in animation
  mainWindow.setOpacity(0);

  // Hide window when closed instead of destroying it
  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Ensure window stays hidden until ready
  mainWindow.once("ready-to-show", () => {
    // Window is ready but we keep it hidden
    mainWindow.setOpacity(0);
  });
};

const toggleWindow = () => {
  // Prevent double-toggle
  if (isToggling) return;

  if (mainWindow) {
    if (mainWindow.isVisible()) {
      // Fade out animation
      isToggling = true;
      fadeOut(mainWindow, () => {
        mainWindow.hide();
        isToggling = false;
      });
    } else {
      isToggling = true;
      const primaryDisplay = screen.getPrimaryDisplay();
      const workArea = primaryDisplay.workArea;
      const { width, height } = calculateWindowSize(workArea.width);
      const { x, y } = getWindowPositionXY(workArea, width, height);
      mainWindow.setBounds({ x, y, width, height });

      // Show window with fade-in animation
      mainWindow.setOpacity(0);
      mainWindow.show();
      mainWindow.focus();

      // Fade in animation
      fadeIn(mainWindow, () => {
        isToggling = false;
      });
    }
  }
};

const createTray = () => {
  const iconPath = getIconPath("crystal.png");
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) icon = nativeImage.createEmpty();
  } catch {
    icon = nativeImage.createEmpty();
  }
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show/Hide",
      click: toggleWindow,
    },
    {
      type: "separator",
    },
    {
      label: "Logout",
      click: () => {
        store.delete("accessToken");
        store.delete("refreshToken");
        BrowserWindow.getAllWindows().forEach((win) => {
          win.webContents.send("auth-success", { token: null });
        });
      },
    },
    {
      type: "separator",
    },
    {
      label: "Settings",
      click: createSettingsWindow,
    },
    {
      label: "Manage Subscription",
      click: createSubscriptionWindow,
    },
    {
      label: "Presets",
      click: createPresetsWindow,
    },
    {
      type: "separator",
    },
    {
      label: "Quit",
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip("Shard");
  tray.setContextMenu(contextMenu);

  // Also allow clicking the tray icon to toggle window
  tray.on("click", toggleWindow);
};

function registerKeybind() {
  globalShortcut.unregisterAll();
  const accel = configStore.get(KEYBIND_KEY) || DEFAULT_KEYBIND;
  try {
    globalShortcut.register(accel, toggleWindow);
  } catch (e) {
    console.warn("Failed to register keybind:", accel, e);
    configStore.set(KEYBIND_KEY, DEFAULT_KEYBIND);
    globalShortcut.register(DEFAULT_KEYBIND, toggleWindow);
  }
}

let settingsWindow = null;
let presetsWindow = null;
let subscriptionWindow = null;

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  const windowIcon = getIconPath(process.platform === "win32" ? "crystal.ico" : "crystal.png");
  settingsWindow = new BrowserWindow({
    width: 480,
    height: 560,
    show: false,
    frame: false,
    title: "Shard Settings",
    backgroundColor: "#000000",
    icon: windowIcon,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });
  settingsWindow.on("closed", () => { settingsWindow = null; });
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    settingsWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL + "/settings.html");
  } else {
    settingsWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/settings.html`)
    );
  }
  settingsWindow.once("ready-to-show", () => {
    settingsWindow.show();
    settingsWindow.focus();
  });
}

function createSubscriptionWindow() {
  if (subscriptionWindow && !subscriptionWindow.isDestroyed()) {
    subscriptionWindow.focus();
    return;
  }
  const windowIcon = getIconPath(process.platform === "win32" ? "crystal.ico" : "crystal.png");
  subscriptionWindow = new BrowserWindow({
    width: 480,
    height: 520,
    show: false,
    frame: false,
    title: "Shard — Manage Subscription",
    backgroundColor: "#000000",
    icon: windowIcon,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });
  subscriptionWindow.on("closed", () => { subscriptionWindow = null; });
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    subscriptionWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL + "/subscription.html");
  } else {
    subscriptionWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/subscription.html`)
    );
  }
  subscriptionWindow.once("ready-to-show", () => {
    subscriptionWindow.show();
    subscriptionWindow.focus();
  });
}

function createPresetsWindow() {
  if (presetsWindow && !presetsWindow.isDestroyed()) {
    presetsWindow.focus();
    return;
  }
  const windowIcon = getIconPath(process.platform === "win32" ? "crystal.ico" : "crystal.png");
  presetsWindow = new BrowserWindow({
    width: 600,
    height: 680,
    show: false,
    frame: false,
    title: "Shard Presets",
    backgroundColor: "#000000",
    icon: windowIcon,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });
  presetsWindow.on("closed", () => { presetsWindow = null; });
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    presetsWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL + "/presets.html");
  } else {
    presetsWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/presets.html`)
    );
  }
  presetsWindow.once("ready-to-show", () => {
    presetsWindow.show();
    presetsWindow.focus();
  });
}

ipcMain.handle("get-openrouter-model-name", async () => getOpenRouterModelNameFromEnv());

// Auth IPC Handlers
ipcMain.handle("get-auth-token", async () => {
  let token = store.get("accessToken");

  // Check if token exists and is not expired
  if (token && !isTokenExpired(token)) {
    return token;
  }

  // Token is expired or missing - try to refresh
  if (token || store.get("refreshToken")) {
    console.log("Access token expired, attempting refresh...");
    const newToken = await refreshAccessToken();
    if (newToken) {
      // Notify all windows of the new token
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send("auth-success", { token: newToken });
      });
      return newToken;
    }
  }

  // No valid token and refresh failed
  return null;
});

ipcMain.handle("open-login", async () => {
  // Open the login URL in the system default browser
  shell.openExternal(AUTH_LOGIN_URL);
  return { success: true };
});

ipcMain.handle("open-external", async (_event, url) => {
  try {
    if (typeof url !== "string" || url.length === 0) {
      return { success: false, error: "Invalid URL" };
    }
    await shell.openExternal(url);
    return { success: true };
  } catch (err) {
    console.error("Failed to open external URL:", err);
    return { success: false, error: "Failed to open URL" };
  }
});

ipcMain.handle("stripe-create-portal-session", async () => {
  const result = await stripeAuthedPost(STRIPE_PORTAL_URL, {});
  if (!result.success) return result;
  if (!result.data?.url) {
    return { success: false, error: "No billing portal URL returned." };
  }
  return { success: true, url: result.data.url };
});

ipcMain.handle("stripe-create-checkout-session", async (_event, priceId) => {
  if (!priceId || typeof priceId !== "string") {
    return { success: false, error: "Invalid plan selected." };
  }
  const result = await stripeAuthedPost(STRIPE_CHECKOUT_URL, { priceId });
  if (!result.success) return result;
  if (!result.data?.url) {
    return { success: false, error: "No checkout URL returned." };
  }
  return { success: true, url: result.data.url };
});

ipcMain.handle("logout", async () => {
  store.delete("accessToken");
  store.delete("refreshToken");
  return { success: true };
});

ipcMain.handle("refresh-auth-token", async () => {
  const newToken = await refreshAccessToken();
  if (newToken) {
    // Notify all windows of the new token
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send("auth-success", { token: newToken });
    });
    return { success: true, token: newToken };
  }
  return { success: false, token: null };
});

// Presets: JSON file (word -> AI options). Path is user-configurable.
ipcMain.handle("get-presets-path", async () => {
  return configStore.get(PRESETS_PATH_KEY) || getDefaultPresetsPath();
});

ipcMain.handle("set-presets-path", async (_event, newPath) => {
  if (typeof newPath !== "string" || !newPath.trim()) return { success: false, error: "Invalid path" };
  configStore.set(PRESETS_PATH_KEY, newPath.trim());
  return { success: true };
});

ipcMain.handle("read-presets", async () => {
  const pathsToTry = getPresetsPathsToTry();
  let lastError = null;
  for (const presetsPath of pathsToTry) {
    if (!presetsPath) continue;
    try {
      const data = await fsp.readFile(presetsPath, "utf8");
      const presets = JSON.parse(data) || {};
      if (Object.keys(presets).length > 0) {
        return { success: true, presets };
      }
    } catch (err) {
      lastError = err;
    }
  }
  const presetsPath = pathsToTry[0];
  if (lastError?.code === "ENOENT") {
    try {
      await fsp.mkdir(path.dirname(presetsPath), { recursive: true });
      await fsp.writeFile(presetsPath, JSON.stringify(DEFAULT_PRESETS, null, 2), "utf8");
      return { success: true, presets: DEFAULT_PRESETS };
    } catch (writeErr) {
      return { success: false, error: writeErr.message, presets: DEFAULT_PRESETS };
    }
  }
  return { success: false, error: lastError?.message || "Failed to read presets", presets: {} };
});

function getBundledPresetsPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "shard-presets.json");
  }
  return path.join(app.getAppPath(), "shard-presets.json");
}

ipcMain.handle("get-bundled-presets-path", async () => getBundledPresetsPath());

ipcMain.handle("set-presets-path-to-default", async () => {
  configStore.set(PRESETS_PATH_KEY, getBundledPresetsPath());
  return { success: true };
});

ipcMain.handle("export-presets", async () => {
  const pathsToTry = getPresetsPathsToTry();
  let content = "{}";
  for (const p of pathsToTry) {
    try {
      content = await fsp.readFile(p, "utf8");
      break;
    } catch (_) {}
  }
  const parentWindow =
    presetsWindow && !presetsWindow.isDestroyed()
      ? presetsWindow
      : settingsWindow && !settingsWindow.isDestroyed()
        ? settingsWindow
        : null;
  const { canceled, filePath } = await dialog.showSaveDialog(parentWindow, {
    title: "Export presets",
    defaultPath: "shard-presets.json",
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (canceled || !filePath) return { success: false, canceled: true };
  await fsp.writeFile(filePath, content, "utf8");
  return { success: true };
});

ipcMain.handle("import-presets", async () => {
  const parentWindow =
    presetsWindow && !presetsWindow.isDestroyed()
      ? presetsWindow
      : settingsWindow && !settingsWindow.isDestroyed()
        ? settingsWindow
        : null;
  const { canceled, filePaths } = await dialog.showOpenDialog(parentWindow, {
    title: "Import presets",
    filters: [{ name: "JSON", extensions: ["json"] }],
    properties: ["openFile"],
  });
  if (canceled || !filePaths?.length) return { success: false, canceled: true };
  try {
    const content = await fsp.readFile(filePaths[0], "utf8");
    const data = JSON.parse(content);
    if (typeof data !== "object" || data === null) throw new Error("Invalid presets JSON");
    const presetsPath = configStore.get(PRESETS_PATH_KEY) || getDefaultPresetsPath();
    await fsp.mkdir(path.dirname(presetsPath), { recursive: true });
    await fsp.writeFile(presetsPath, JSON.stringify(data, null, 2), "utf8");
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send("presets-updated");
    });
    return { success: true, presets: data };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

function validatePresetsPayload(data) {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return "Presets must be a JSON object with preset names as keys.";
  }
  for (const [k, v] of Object.entries(data)) {
    if (typeof k !== "string" || !k.trim()) {
      return "Each preset name must be a non-empty string.";
    }
    if (v === null || typeof v !== "object" || Array.isArray(v)) {
      return `Preset "${k}" must be an object (e.g. description, systemInstruction, temperature).`;
    }
  }
  return null;
}

ipcMain.handle("write-presets", async (_event, presets) => {
  const err = validatePresetsPayload(presets);
  if (err) return { success: false, error: err };
  const presetsPath = configStore.get(PRESETS_PATH_KEY) || getDefaultPresetsPath();
  try {
    await fsp.mkdir(path.dirname(presetsPath), { recursive: true });
    await fsp.writeFile(presetsPath, JSON.stringify(presets, null, 2), "utf8");
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send("presets-updated");
    });
    return { success: true, presets };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Window / keybind settings
ipcMain.handle("get-keybind", async () => configStore.get(KEYBIND_KEY) || DEFAULT_KEYBIND);
ipcMain.handle("set-keybind", async (_e, accel) => {
  if (typeof accel !== "string" || !accel.trim()) return { success: false, error: "Invalid keybind" };
  configStore.set(KEYBIND_KEY, accel.trim());
  registerKeybind();
  return { success: true };
});

ipcMain.handle("get-window-size", async () => getWindowSizePreset());
ipcMain.handle("set-window-size", async (_e, size) => {
  if (!SIZE_PRESETS[size]) return { success: false };
  configStore.set(WINDOW_SIZE_KEY, size);
  return { success: true };
});

ipcMain.handle("get-window-position", async () => getWindowPositionPreset());
ipcMain.handle("set-window-position", async (_e, position) => {
  if (!POSITION_OPTIONS.includes(position)) return { success: false };
  configStore.set(WINDOW_POSITION_KEY, position);
  return { success: true };
});

ipcMain.handle("get-size-presets", async () => SIZE_LABELS);
ipcMain.handle("get-position-options", async () => [...POSITION_OPTIONS]);

// Run on startup (Windows: startup folder / registry, macOS: Login Items; Linux: may not be supported)
ipcMain.handle("get-run-on-startup", async () => {
  const settings = app.getLoginItemSettings();
  return settings.openAtLogin === true;
});
ipcMain.handle("set-run-on-startup", async (_e, enabled) => {
  try {
    app.setLoginItemSettings({ openAtLogin: Boolean(enabled) });
    return { success: true };
  } catch (err) {
    console.error("Set run on startup failed:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("close-window", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) win.close();
});

ipcMain.handle("open-presets-window", async () => {
  createPresetsWindow();
  return { success: true };
});

ipcMain.handle("open-subscription-window", async () => {
  createSubscriptionWindow();
  return { success: true };
});

// Existing IPC Handlers
ipcMain.handle("send-message", async (event, message) => {
  // Hide the chat window
  if (mainWindow && mainWindow.isVisible()) {
    fadeOut(mainWindow, () => {
      mainWindow.hide();
    });
  }

  //* Create message display window

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } =
    primaryDisplay.workAreaSize;

  const windowIcon = getIconPath(process.platform === "win32" ? "crystal.ico" : "crystal.png");
  const messageWindow = new BrowserWindow({
    width: screenWidth / 2,
    height: screenHeight * 0.6,
    frame: false,
    transparent: false,
    backgroundColor: "#000000",
    resizable: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    show: false,
    icon: windowIcon,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Encode message to pass as query parameter
  const encodedMessage = encodeURIComponent(JSON.stringify({ message }));

  // Load the message page HTML file with message as query parameter
  if (MESSAGE_WINDOW_VITE_DEV_SERVER_URL || MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    const devServerUrl =
      MESSAGE_WINDOW_VITE_DEV_SERVER_URL || MAIN_WINDOW_VITE_DEV_SERVER_URL;
    const url = `${devServerUrl}/chat.html?data=${encodedMessage}`;
    messageWindow.loadURL(url);
  } else {
    const filePath = path.join(
      __dirname,
      `../renderer/${MESSAGE_WINDOW_VITE_NAME}/chat.html`
    );
    messageWindow.loadFile(filePath, { query: { data: encodedMessage } });
  }

  // Show window when ready
  messageWindow.once("ready-to-show", () => {
    messageWindow.show();
    messageWindow.focus();
  });

  return { success: true };
});

ipcMain.handle("hide-window", async () => {
  if (mainWindow && mainWindow.isVisible()) {
    fadeOut(mainWindow, () => {
      mainWindow.hide();
    });
  }
  return { success: true };
});

ipcMain.handle("close-message-window", async (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    fadeOut(window, () => {
      window.close();
    });
  }
  return { success: true };
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();
  createTray();

  registerKeybind();

  // Handle deep link URL passed on initial launch (Windows/Linux)
  // This happens when the app wasn't running and user clicks the protocol link
  const protocolUrl = process.argv.find((arg) => arg.startsWith("shard://"));
  if (protocolUrl) {
    console.log("Found protocol URL in argv:", protocolUrl);
    // Delay slightly to ensure windows are ready
    setTimeout(() => handleAuthCallback(protocolUrl), 500);
  }

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      toggleWindow();
    }
  });
});

// Prevent quitting when all windows are closed (run in background)
app.on("window-all-closed", () => {
  // Don't quit - keep running in background
  // The app will only quit when explicitly requested via tray menu
});

// Unregister all shortcuts when app quits
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  // Close message window if it exists
  if (messageWindow) {
    messageWindow.close();
    messageWindow = null;
  }
});
