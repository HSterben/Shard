import { useState, useEffect, useCallback, useMemo } from "react";
import "./SettingsView.css";
import "./PresetsView.css";
import crystalIcon from "../icon/crystal.png";

const api = typeof window !== "undefined" ? window.electronAPI : null;

function rowId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function emptyEntry() {
  return {
    id: rowId(),
    name: "",
    description: "",
    systemInstruction: "",
    temperature: "",
    maxTokens: "",
    topP: "",
    frequencyPenalty: "",
    presencePenalty: "",
    stopLines: "",
  };
}

function fromRawPreset(name, raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...emptyEntry(), name };
  }
  const stop = raw.stop;
  let stopLines = "";
  if (Array.isArray(stop)) stopLines = stop.join("\n");
  else if (stop != null && String(stop).trim() !== "") stopLines = String(stop);

  const num = (v) => (v != null && v !== "" && !Number.isNaN(Number(v)) ? String(v) : "");

  return {
    id: rowId(),
    name,
    description: raw.description != null ? String(raw.description) : raw.desc != null ? String(raw.desc) : "",
    systemInstruction:
      raw.systemInstruction != null
        ? String(raw.systemInstruction)
        : raw.system_instruction != null
          ? String(raw.system_instruction)
          : "",
    temperature: num(raw.temperature),
    maxTokens: raw.maxTokens != null && raw.maxTokens !== "" ? String(raw.maxTokens) : "",
    topP: num(raw.topP),
    frequencyPenalty: num(raw.frequencyPenalty),
    presencePenalty: num(raw.presencePenalty),
    stopLines,
  };
}

function parseOptionalNumber(str, allowIntOnly) {
  const s = String(str ?? "").trim();
  if (s === "") return undefined;
  const n = allowIntOnly ? parseInt(s, 10) : parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

function parseStopLines(text) {
  const lines = String(text || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length === 0) return undefined;
  if (lines.length === 1) return lines[0];
  return lines;
}

function entryToPresetObject(e) {
  const o = {};
  const desc = e.description.trim();
  if (desc) o.description = desc;
  const sys = e.systemInstruction.trim();
  if (sys) o.systemInstruction = sys;

  const t = parseOptionalNumber(e.temperature, false);
  if (!Number.isNaN(t)) o.temperature = t;

  const mt = parseOptionalNumber(e.maxTokens, true);
  if (!Number.isNaN(mt)) o.maxTokens = mt;

  const tp = parseOptionalNumber(e.topP, false);
  if (!Number.isNaN(tp)) o.topP = tp;

  const fp = parseOptionalNumber(e.frequencyPenalty, false);
  if (!Number.isNaN(fp)) o.frequencyPenalty = fp;

  const pp = parseOptionalNumber(e.presencePenalty, false);
  if (!Number.isNaN(pp)) o.presencePenalty = pp;

  const stop = parseStopLines(e.stopLines);
  if (stop !== undefined) o.stop = stop;

  return o;
}

function entriesToPresetsObject(entries) {
  const out = {};
  for (const e of entries) {
    const name = e.name.trim();
    if (!name) continue;
    out[name] = entryToPresetObject(e);
  }
  return out;
}

function snapshotEntries(entries) {
  return JSON.stringify(
    entries.map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      systemInstruction: e.systemInstruction,
      temperature: e.temperature,
      maxTokens: e.maxTokens,
      topP: e.topP,
      frequencyPenalty: e.frequencyPenalty,
      presencePenalty: e.presencePenalty,
      stopLines: e.stopLines,
    }))
  );
}

function uniqueNewName(existing) {
  const lower = new Set(existing.map((n) => n.trim().toLowerCase()).filter(Boolean));
  let base = "NewPreset";
  let n = base;
  let i = 2;
  while (lower.has(n.toLowerCase())) {
    n = `${base}${i}`;
    i += 1;
  }
  return n;
}

export default function PresetsView() {
  const [presetsPath, setPresetsPath] = useState("");
  const [entries, setEntries] = useState([]);
  const [baselineSnapshot, setBaselineSnapshot] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  const showMessage = useCallback((text, isError = false) => {
    setMessage({ text, isError });
    setTimeout(() => setMessage(null), 4000);
  }, []);

  const loadPresets = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    try {
      const [pathResult, readResult] = await Promise.all([
        api.getPresetsPath(),
        api.readPresets(),
      ]);
      setPresetsPath(pathResult || "");
      const presets = readResult?.success && readResult.presets ? readResult.presets : {};
      const list = Object.entries(presets)
        .filter(([, v]) => v && typeof v === "object" && !Array.isArray(v))
        .map(([name, v]) => fromRawPreset(name, v))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      setEntries(list.length ? list : []);
      setBaselineSnapshot(snapshotEntries(list.length ? list : []));
      if (!readResult?.success && readResult?.error) {
        showMessage(readResult.error, true);
      }
    } catch (e) {
      console.error(e);
      showMessage(e?.message || "Failed to load presets", true);
    } finally {
      setLoading(false);
    }
  }, [showMessage]);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  useEffect(() => {
    if (!api?.onPresetsUpdated) return undefined;
    return api.onPresetsUpdated(() => {
      loadPresets();
    });
  }, [loadPresets]);

  const handleClose = () => api?.closeWindow?.();

  const dirty = useMemo(() => snapshotEntries(entries) !== baselineSnapshot, [entries, baselineSnapshot]);

  const updateEntry = (index, patch) => {
    setEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const removeEntry = (index) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const addEntry = () => {
    const names = entries.map((e) => e.name);
    setEntries((prev) => [...prev, { ...emptyEntry(), name: uniqueNewName(names) }]);
  };

  const validateBeforeSave = () => {
    const names = entries.map((e) => e.name.trim()).filter(Boolean);
    if (names.length !== entries.filter((e) => e.name.trim()).length) {
      return "Each preset needs a trigger word, or remove empty presets.";
    }
    const seen = new Set();
    for (const n of names) {
      const k = n.toLowerCase();
      if (seen.has(k)) return `Duplicate trigger word: "${n}" (matching is case-insensitive).`;
      seen.add(k);
    }
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const fields = [
        ["Temperature", e.temperature],
        ["Max tokens", e.maxTokens],
        ["Top P", e.topP],
        ["Frequency penalty", e.frequencyPenalty],
        ["Presence penalty", e.presencePenalty],
      ];
      for (const [label, val] of fields) {
        const s = String(val ?? "").trim();
        if (s === "") continue;
        const num = label === "Max tokens" ? parseInt(s, 10) : parseFloat(s);
        if (!Number.isFinite(num)) {
          return `Preset "${e.name.trim() || "(unnamed)"}": ${label} must be a number.`;
        }
      }
    }
    return null;
  };

  const handleSave = async () => {
    if (!api?.writePresets) return;
    const err = validateBeforeSave();
    if (err) {
      showMessage(err, true);
      return;
    }
    const payload = entriesToPresetsObject(entries);
    setSaving(true);
    try {
      const result = await api.writePresets(payload);
      if (result?.success) {
        const saved = result.presets ?? payload;
        const prevByLower = new Map(entries.map((e) => [e.name.trim().toLowerCase(), e]));
        const list = Object.entries(saved)
          .filter(([, v]) => v && typeof v === "object" && !Array.isArray(v))
          .map(([name, v]) => {
            const row = fromRawPreset(name, v);
            const prev = prevByLower.get(name.toLowerCase());
            if (prev) row.id = prev.id;
            return row;
          })
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
        setEntries(list);
        setBaselineSnapshot(snapshotEntries(list));
        showMessage("Presets saved.");
      } else {
        showMessage(result?.error || "Save failed", true);
      }
    } catch (e) {
      showMessage(e?.message || "Save failed", true);
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = () => {
    try {
      const parsed = JSON.parse(baselineSnapshot || "[]");
      setEntries(
        Array.isArray(parsed)
          ? parsed.map((e) => ({ ...emptyEntry(), ...e, id: e.id || rowId() }))
          : []
      );
    } catch {
      loadPresets();
    }
    showMessage("Reverted to last loaded version.");
  };

  if (!api) {
    return (
      <div className="settings-view">
        <p>Presets are only available in the Electron app.</p>
      </div>
    );
  }

  return (
    <div className="settings-view">
      <div className="settings-title-bar">
        <img src={crystalIcon} alt="" className="settings-title-icon" />
        <span className="settings-title-text">Presets</span>
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

      <div className="settings-scroll presets-scroll">
        {message && (
          <div className={`settings-message ${message.isError ? "error" : ""}`}>{message.text}</div>
        )}

        <section className="settings-section presets-intro">
          <h2>Your presets</h2>
          <p className="settings-hint">
            Saved to <code>{presetsPath || "—"}</code>
            {dirty ? " · Unsaved changes" : ""}
          </p>
          <p className="settings-hint">
            Type the trigger word first in chat (for example <code>Simplify hello</code>) to use that preset.
          </p>
        </section>

        {loading ? (
          <p className="settings-hint presets-loading">Loading…</p>
        ) : (
          <>
            {entries.length === 0 ? (
              <p className="settings-hint">No presets yet. Add one to get started.</p>
            ) : (
              entries.map((entry, index) => (
                <section key={entry.id} className="preset-card settings-section">
                  <div className="preset-card-head">
                    <h2 className="preset-card-title">{entry.name.trim() || "New preset"}</h2>
                    <button
                      type="button"
                      className="settings-btn preset-remove"
                      onClick={() => removeEntry(index)}
                    >
                      Remove
                    </button>
                  </div>

                  <label className="preset-field">
                    <span className="preset-label">Trigger word</span>
                    <input
                      type="text"
                      className="preset-input"
                      value={entry.name}
                      onChange={(e) => updateEntry(index, { name: e.target.value })}
                      placeholder="e.g. Simplify"
                      spellCheck={false}
                    />
                    <span className="preset-field-hint">One word, no spaces. Matched without caring about capital letters.</span>
                  </label>

                  <label className="preset-field">
                    <span className="preset-label">Short description</span>
                    <input
                      type="text"
                      className="preset-input"
                      value={entry.description}
                      onChange={(e) => updateEntry(index, { description: e.target.value })}
                      placeholder="What this preset does in one line"
                    />
                  </label>

                  <label className="preset-field">
                    <span className="preset-label">Instructions for the AI</span>
                    <textarea
                      className="preset-textarea"
                      value={entry.systemInstruction}
                      onChange={(e) => updateEntry(index, { systemInstruction: e.target.value })}
                      placeholder="System prompt: how the model should behave for this preset"
                      rows={5}
                      spellCheck={false}
                    />
                  </label>

                  <div className="preset-number-grid">
                    <label className="preset-field preset-field-compact">
                      <span className="preset-label">Temperature</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="preset-input"
                        value={entry.temperature}
                        onChange={(e) => updateEntry(index, { temperature: e.target.value })}
                        placeholder="e.g. 0.7"
                      />
                      <span className="preset-field-hint">Leave blank to use the app default when this preset runs.</span>
                    </label>
                    <label className="preset-field preset-field-compact">
                      <span className="preset-label">Max tokens</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="preset-input"
                        value={entry.maxTokens}
                        onChange={(e) => updateEntry(index, { maxTokens: e.target.value })}
                        placeholder="e.g. 4096"
                      />
                    </label>
                    <label className="preset-field preset-field-compact">
                      <span className="preset-label">Top P</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="preset-input"
                        value={entry.topP}
                        onChange={(e) => updateEntry(index, { topP: e.target.value })}
                        placeholder="e.g. 0.95"
                      />
                    </label>
                    <label className="preset-field preset-field-compact">
                      <span className="preset-label">Frequency penalty</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="preset-input"
                        value={entry.frequencyPenalty}
                        onChange={(e) => updateEntry(index, { frequencyPenalty: e.target.value })}
                        placeholder="e.g. 0"
                      />
                    </label>
                    <label className="preset-field preset-field-compact">
                      <span className="preset-label">Presence penalty</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="preset-input"
                        value={entry.presencePenalty}
                        onChange={(e) => updateEntry(index, { presencePenalty: e.target.value })}
                        placeholder="e.g. 0.3"
                      />
                    </label>
                  </div>

                  <label className="preset-field">
                    <span className="preset-label">Stop sequences (optional)</span>
                    <textarea
                      className="preset-textarea preset-textarea-sm"
                      value={entry.stopLines}
                      onChange={(e) => updateEntry(index, { stopLines: e.target.value })}
                      placeholder="One sequence per line, if your model supports it"
                      rows={2}
                      spellCheck={false}
                    />
                  </label>
                </section>
              ))
            )}

            <div className="presets-actions presets-actions-top">
              <button type="button" className="settings-btn" onClick={addEntry}>
                Add preset
              </button>
            </div>

            <div className="presets-actions presets-actions-sticky">
              <button
                type="button"
                className="settings-btn primary"
                onClick={handleSave}
                disabled={saving || !dirty}
              >
                {saving ? "Saving…" : "Save all"}
              </button>
              <button type="button" className="settings-btn" onClick={handleRevert} disabled={!dirty}>
                Revert
              </button>
              <button type="button" className="settings-btn" onClick={loadPresets}>
                Reload from disk
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
