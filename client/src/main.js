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
} from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import Store from "electron-store";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Initialize secure store for auth tokens
const store = new Store({
  name: "shard-auth",
  encryptionKey: "shard-secure-storage-key-2024",
});

// Auth configuration
// Note: .convex.cloud is for queries/mutations, .convex.site is for HTTP endpoints
const CONVEX_HTTP_URL = "https://elegant-greyhound-73.convex.site";
const AUTH_LOGIN_URL = `${CONVEX_HTTP_URL}/auth/login`;
const AUTH_REFRESH_URL = `${CONVEX_HTTP_URL}/auth/refresh`;

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

// Calculate window dimensions based on screen width percentage
const calculateWindowSize = (screenWidth) => {
  // Use 12.5% of screen width (middle of 10-15% range)
  const sizePercentage = 0.125;
  const aspectRatio = 56 / 420; // height/width ratio

  // Calculate width with min/max bounds
  let windowWidth = screenWidth * sizePercentage;
  const minWidth = 380;
  const maxWidth = 700;
  windowWidth = Math.max(minWidth, Math.min(maxWidth, windowWidth));

  // Calculate height maintaining aspect ratio
  const windowHeight = windowWidth * aspectRatio;

  return { width: Math.round(windowWidth), height: Math.round(windowHeight) };
};

const createWindow = () => {
  // Get screen dimensions first
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;
  const { width, height } = calculateWindowSize(screenWidth);

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width,
    height,
    show: false, // Start hidden
    frame: false, // Remove title bar
    transparent: true, // Make window transparent
    resizable: false, // Prevent resizing
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Position window at bottom-right of screen
  const { height: screenHeight } = primaryDisplay.workAreaSize;
  const x = screenWidth - width - 20;
  const y = screenHeight - height - 20;
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
      // Recalculate position in case screen size changed
      isToggling = true;
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width: screenWidth, height: screenHeight } =
        primaryDisplay.workAreaSize;
      const { width, height } = calculateWindowSize(screenWidth);

      // Update window size if needed
      mainWindow.setSize(width, height);

      // Position window at bottom-right of screen
      const x = screenWidth - width - 20;
      const y = screenHeight - height - 20;
      mainWindow.setPosition(x, y);

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
  // Create a simple tray icon (using native icon as fallback)
  const iconPath = path.join(__dirname, "../assets/icon.png");
  let icon;

  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      // If icon doesn't exist or is empty, create a simple native icon
      icon = nativeImage.createEmpty();
    }
  } catch (error) {
    // If icon file doesn't exist, create an empty icon
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

  const messageWindow = new BrowserWindow({
    width: screenWidth / 2,
    height: screenHeight * 0.6,
    frame: false,
    transparent: false,
    backgroundColor: "#000000",
    resizable: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    show: false, // Don't show until ready
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

  // Register global shortcut Ctrl+Alt+I to show/hide window
  globalShortcut.register("CommandOrControl+Alt+I", toggleWindow);

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
