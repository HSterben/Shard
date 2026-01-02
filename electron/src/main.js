import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  globalShortcut,
  nativeImage,
  screen,
  ipcMain,
} from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let mainWindow = null;
let tray = null;
let isToggling = false; // Prevent double-toggle

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

// IPC Handlers
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

  // Calculate size for message window (slightly larger than chat bubble)
  // const { width: chatWidth } = calculateWindowSize(screenWidth);
  // const messageWidth = Math.min(chatWidth * 1.5, 600);
  // const messageHeight = 200;

  const messageWindow = new BrowserWindow({
    width: screenWidth / 2,
    height: screenHeight / 2,
    frame: false,
    transparent: false,
    backgroundColor: '#000000',
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
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
  // In dev mode, use the dev server (fallback to main window's if message window's isn't available)
  // In production, use the message window's built files
  if (MESSAGE_WINDOW_VITE_DEV_SERVER_URL || MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    const devServerUrl = MESSAGE_WINDOW_VITE_DEV_SERVER_URL || MAIN_WINDOW_VITE_DEV_SERVER_URL;
    const url = `${devServerUrl}/chat.html?data=${encodedMessage}`;
    // console.log("Loading message window from dev server:", url);
    messageWindow.loadURL(url);
  } else {
    const filePath = path.join(__dirname, `../renderer/${MESSAGE_WINDOW_VITE_NAME}/chat.html`);
    // console.log("Loading message window from file:", filePath);
    messageWindow.loadFile(filePath, { query: { data: encodedMessage } });
  }

  // Show window when ready
  messageWindow.once("ready-to-show", () => {
    // console.log("Message window ready, showing...");
    messageWindow.show();
    messageWindow.focus();
    // Open DevTools for debugging (remove in production)
    // messageWindow.webContents.openDevTools();
  });

  // Clean up on close
  // messageWindow.on("closed", () => {
  //   messageWindow = null;
  //   currentMessage = null;
  // });

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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
