import { useState, useEffect, useRef } from "react";
import TitleBar from "../components/TitleBar";
import { useTheme } from "../hooks/useTheme";
import "./SettingsView.css";

const api = typeof window !== "undefined" ? window.electronAPI : null;

function formatKeybind(accel) {
  if (!accel) return "";
  return accel
    .replace("CommandOrControl", "Ctrl")
    .replace("+", " + ")
    .replace(/([A-Z])/g, " $1")
    .trim();
}

const KEY_TO_ACCEL = {
  " ": "Space",
  Tab: "Tab",
  Enter: "Return",
  Escape: "Escape",
  Backspace: "Backspace",
  Delete: "Delete",
  Insert: "Insert",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  F1: "F1", F2: "F2", F3: "F3", F4: "F4", F5: "F5", F6: "F6",
  F7: "F7", F8: "F8", F9: "F9", F10: "F10", F11: "F11", F12: "F12",
};

function keyToAcceleratorKey(e) {
  const fromMap = KEY_TO_ACCEL[e.key];
  if (fromMap) return fromMap;
  if (e.code && e.code.startsWith("Key")) return e.code.slice(3).toUpperCase();
  if (e.code && e.code.startsWith("Digit")) return e.code.slice(5);
  if (e.key.length === 1) return e.key.toUpperCase();
  return e.key;
}

function buildAccelerator(e) {
  e.preventDefault();
  e.stopPropagation();
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push("CommandOrControl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  const key = keyToAcceleratorKey(e);
  const isModifier = /^(Control|Alt|Shift|Meta)$/i.test(e.key);
  if (!key || isModifier) return null;
  parts.push(key);
  return parts.join("+");
}

const SIZE_LABELS = ["XSmall", "Small", "Regular", "Large", "XLarge"];
const POSITION_LABELS = [
  { value: "bottom-right", label: "Bottom Right" },
  { value: "bottom-left", label: "Bottom Left" },
  { value: "top-right", label: "Top Right" },
  { value: "top-left", label: "Top Left" },
];

const NAV = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "notifications", label: "Notifications" },
  { id: "privacy", label: "Privacy" },
  { id: "account", label: "Account" },
];

function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <div className="settings-row">
      <div>
        <div className="settings-row-label">{label}</div>
        {hint ? <div className="settings-row-hint">{hint}</div> : null}
      </div>
      <label className="settings-toggle">
        <input type="checkbox" checked={checked} onChange={onChange} />
        <span className="settings-toggle-slider" />
      </label>
    </div>
  );
}

export default function SettingsView() {
  const { preference, setTheme } = useTheme();
  const [section, setSection] = useState("general");
  const [keybind, setKeybind] = useState("");
  const [keybindEditing, setKeybindEditing] = useState(false);
  const [windowSize, setWindowSize] = useState("Regular");
  const [windowPosition, setWindowPosition] = useState("bottom-right");
  const [presetsPath, setPresetsPath] = useState("");
  const [runOnStartup, setRunOnStartup] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [usageDataEnabled, setUsageDataEnabled] = useState(false);
  const [message, setMessage] = useState(null);
  const keybindInputRef = useRef(null);

  const loadSettings = async () => {
    if (!api) return;
    try {
      const [kb, size, pos, path, startup] = await Promise.all([
        api.getKeybind(),
        api.getWindowSize(),
        api.getWindowPosition(),
        api.getPresetsPath(),
        api.getRunOnStartup?.() ?? Promise.resolve(false),
      ]);
      setKeybind(kb || "");
      setWindowSize(size || "Regular");
      setWindowPosition(pos || "bottom-right");
      setPresetsPath(path || "");
      setRunOnStartup(Boolean(startup));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (!keybindEditing) return;
    const onKeyDown = (e) => {
      const accel = buildAccelerator(e);
      if (accel) {
        api?.setKeybind(accel).then((r) => {
          if (r?.success) setKeybind(accel);
          setKeybindEditing(false);
        });
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [keybindEditing]);

  const handleKeybindClick = () => {
    setKeybindEditing(true);
    setTimeout(() => keybindInputRef.current?.focus(), 0);
  };

  const handleSizeChange = (e) => {
    const v = e.target.value;
    setWindowSize(v);
    api?.setWindowSize(v);
  };

  const handlePositionChange = (value) => {
    setWindowPosition(value);
    api?.setWindowPosition(value);
  };

  const showMessage = (text, isError = false) => {
    setMessage({ text, isError });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleExport = async () => {
    const result = await api?.exportPresets();
    if (result?.canceled) return;
    if (result?.success) showMessage("States exported.");
    else showMessage(result?.error || "Export failed", true);
  };

  const handleImport = async () => {
    const result = await api?.importPresets();
    if (result?.canceled) return;
    if (result?.success) showMessage("States imported.");
    else showMessage(result?.error || "Import failed", true);
  };

  const handleDefaultPreset = async () => {
    const result = await api?.setPresetsPathToDefault();
    if (result?.success) {
      const path = await api?.getBundledPresetsPath();
      setPresetsPath(path || "Default (proxy-x-presets.json)");
      showMessage("Using default states file.");
    } else showMessage("Failed to set default.", true);
  };

  const handleRunOnStartupChange = (e) => {
    const enabled = e.target.checked;
    setRunOnStartup(enabled);
    api?.setRunOnStartup?.(enabled).then((result) => {
      if (result && !result.success) showMessage(result.error || "Failed to update", true);
    });
  };

  const handleClose = () => api?.closeWindow?.();

  if (!api) {
    return (
      <div className="settings-view">
        <p>Settings are only available in the Electron app.</p>
      </div>
    );
  }

  return (
    <div className="settings-view">
      <TitleBar title="Settings" onClose={handleClose} />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {NAV.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`settings-nav-btn${section === id ? " is-active" : ""}`}
              onClick={() => setSection(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="settings-panel">
          {message && (
            <div className={`settings-message ${message.isError ? "error" : ""}`}>{message.text}</div>
          )}

          {section === "general" && (
            <>
              <h2>General</h2>
              <ToggleRow
                label="Launch on system start"
                hint="Open PROXY X when you log in"
                checked={runOnStartup}
                onChange={handleRunOnStartupChange}
              />
              <div className="settings-row">
                <div>
                  <div className="settings-row-label">Default state</div>
                  <div className="settings-row-hint">Manage states in the States window</div>
                </div>
                <button type="button" className="btn-secondary" onClick={() => api?.openPresetsWindow?.()}>
                  Manage
                </button>
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-row-label">States file</div>
                  <div className="settings-row-hint">{presetsPath || "—"}</div>
                </div>
              </div>
              <div className="settings-actions-row">
                <button type="button" className="btn-secondary" onClick={handleExport}>Export</button>
                <button type="button" className="btn-secondary" onClick={handleImport}>Import</button>
                <button type="button" className="btn-secondary" onClick={handleDefaultPreset}>Use default</button>
              </div>
            </>
          )}

          {section === "appearance" && (
            <>
              <h2>Appearance</h2>
              <div className="settings-row">
                <div>
                  <div className="settings-row-label">Theme</div>
                  <div className="settings-row-hint">Choose light, dark, or match your system</div>
                </div>
                <div className="theme-segment" role="group" aria-label="Theme">
                  {[
                    { id: "light", label: "Light" },
                    { id: "dark", label: "Dark" },
                    { id: "system", label: "System" },
                  ].map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      className={`theme-segment-btn${preference === id ? " is-active" : ""}`}
                      onClick={() => setTheme(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {section === "shortcuts" && (
            <>
              <h2>Shortcuts</h2>
              <div className="settings-row">
                <div>
                  <div className="settings-row-label">Quick launch</div>
                  <div className="settings-row-hint">Show or hide the chat bubble</div>
                </div>
                <div className="settings-keybind-row">
                  <input
                    ref={keybindInputRef}
                    type="text"
                    className="input-field settings-keybind-input"
                    value={keybindEditing ? "Press keys..." : formatKeybind(keybind)}
                    readOnly
                    onFocus={handleKeybindClick}
                    aria-label="Global keybind"
                  />
                  <button type="button" className="btn-secondary" onClick={handleKeybindClick}>
                    Change
                  </button>
                </div>
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-row-label">Bubble size</div>
                  <div className="settings-row-hint">{windowSize}</div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={4}
                  value={Math.max(0, SIZE_LABELS.indexOf(windowSize))}
                  onChange={(e) => handleSizeChange({ target: { value: SIZE_LABELS[Number(e.target.value)] } })}
                  className="settings-slider"
                  aria-label="Bubble size"
                />
              </div>
              <div className="settings-row settings-row-stack">
                <div className="settings-row-label">Bubble position</div>
                <div className="settings-position-grid">
                  {POSITION_LABELS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      className={`settings-position-btn ${windowPosition === value ? "active" : ""}`}
                      onClick={() => handlePositionChange(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {section === "account" && (
            <>
              <h2>Account</h2>
              <div className="settings-account-card">
                <p className="settings-row-hint">
                  Subscribe, upgrade, and manage billing on the PROXY X website. This app only reads your account state.
                </p>
                <button type="button" className="btn-primary" onClick={() => api?.openSubscriptionWindow?.()}>
                  View account & usage
                </button>
                <button
                  type="button"
                  className="settings-btn"
                  style={{ marginTop: 10 }}
                  onClick={() => api?.openExternal?.("http://localhost:5173/account/billing")}
                >
                  Manage billing on website
                </button>
                <div className="settings-version">PROXY X 1.0.0</div>
              </div>
            </>
          )}
          {section === "notifications" && (
            <>
              <h2>Notifications</h2>
              <ToggleRow
                label="Desktop notifications"
                hint="Notify you when a task needs your attention"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
              />
            </>
          )}

          {section === "privacy" && (
            <>
              <h2>Privacy</h2>
              <ToggleRow
                label="Share anonymous usage data"
                hint="Help improve PROXY X with diagnostic information"
                checked={usageDataEnabled}
                onChange={(e) => setUsageDataEnabled(e.target.checked)}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
