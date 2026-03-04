import { useState, useEffect, useRef } from "react";
import "./SettingsView.css";
import crystalIcon from "../icon/crystal.png";

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

export default function SettingsView() {
  const [keybind, setKeybind] = useState("");
  const [keybindEditing, setKeybindEditing] = useState(false);
  const [windowSize, setWindowSize] = useState("Regular");
  const [windowPosition, setWindowPosition] = useState("bottom-right");
  const [presetsPath, setPresetsPath] = useState("");
  const [runOnStartup, setRunOnStartup] = useState(false);
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
    if (result?.success) showMessage("Presets exported.");
    else showMessage(result?.error || "Export failed", true);
  };

  const handleImport = async () => {
    const result = await api?.importPresets();
    if (result?.canceled) return;
    if (result?.success) showMessage("Presets imported.");
    else showMessage(result?.error || "Import failed", true);
  };

  const handleDefaultPreset = async () => {
    const result = await api?.setPresetsPathToDefault();
    if (result?.success) {
      const path = await api?.getBundledPresetsPath();
      setPresetsPath(path || "Default (shard-presets.json)");
      showMessage("Using default preset file.");
    } else showMessage("Failed to set default.", true);
  };

  const handleRunOnStartupChange = async (e) => {
    const enabled = e.target.checked;
    setRunOnStartup(enabled);
    const result = await api?.setRunOnStartup?.(enabled);
    if (result && !result.success) showMessage(result.error || "Failed to update", true);
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
      <div className="settings-title-bar">
        <img src={crystalIcon} alt="" className="settings-title-icon" />
        <span className="settings-title-text">Settings</span>
        <button
          type="button"
          className="settings-title-close"
          onClick={handleClose}
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="settings-scroll">
        {message && (
          <div className={`settings-message ${message.isError ? "error" : ""}`}>{message.text}</div>
        )}

        <section className="settings-section">
        <h2>Run on startup</h2>
        <p className="settings-hint">Open Shard when you log in to your computer.</p>
        <label className="settings-checkbox-row">
          <input
            type="checkbox"
            checked={runOnStartup}
            onChange={handleRunOnStartupChange}
            className="settings-checkbox"
          />
          <span>Run Shard at system startup</span>
        </label>
      </section>

        <section className="settings-section">
        <h2>Global keybind</h2>
        <p className="settings-hint">Shortcut to show/hide the chat bubble.</p>
        <div className="settings-keybind-row">
          <input
            ref={keybindInputRef}
            type="text"
            className="settings-keybind-input"
            value={keybindEditing ? "Press keys..." : formatKeybind(keybind)}
            readOnly
            onFocus={handleKeybindClick}
          />
          <button type="button" className="settings-btn" onClick={handleKeybindClick}>
            Change
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h2>Chat bubble size</h2>
        <p className="settings-hint">Percentage of screen (XSmall → XLarge).</p>
        <div className="settings-slider-row">
          <input
            type="range"
            min={0}
            max={4}
            value={Math.max(0, SIZE_LABELS.indexOf(windowSize))}
            onChange={(e) => handleSizeChange({ target: { value: SIZE_LABELS[Number(e.target.value)] } })}
            className="settings-slider"
          />
          <span className="settings-size-label">{windowSize}</span>
        </div>
      </section>

      <section className="settings-section">
        <h2>Chat bubble position</h2>
        <p className="settings-hint">Corner of the screen.</p>
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
      </section>

      <section className="settings-section">
        <h2>Presets (shard-presets.json)</h2>
        <p className="settings-hint">Current file: {presetsPath || "—"}</p>
        <div className="settings-presets-row">
          <button type="button" className="settings-btn" onClick={handleExport}>
            Export presets
          </button>
          <button type="button" className="settings-btn" onClick={handleImport}>
            Import presets
          </button>
          <button type="button" className="settings-btn primary" onClick={handleDefaultPreset}>
            Use default preset
          </button>
        </div>
        <p className="settings-hint">
          Default preset uses the bundled <code>shard-presets.json</code> in the app folder.
        </p>
      </section>
      </div>
    </div>
  );
}
