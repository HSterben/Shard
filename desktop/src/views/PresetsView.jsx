import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ConvexClient } from "convex/browser";
import { api as convexApi } from "../../../backend/convex/_generated/api";
import TitleBar from "../components/TitleBar";
import { convexUrl } from "../lib/convexUrls";
import "./SettingsView.css";
import "./PresetsView.css";
import "../components/AppShell.css";

const api = typeof window !== "undefined" ? window.electronAPI : null;

function sanitizePresetsForCloud(presets) {
  const out = {};
  for (const [name, raw] of Object.entries(presets || {})) {
    if (!name || !raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const o = {};
    if (typeof raw.description === "string") o.description = raw.description;
    else if (typeof raw.desc === "string") o.description = raw.desc;
    if (typeof raw.systemInstruction === "string") o.systemInstruction = raw.systemInstruction;
    else if (typeof raw.system_instruction === "string") o.systemInstruction = raw.system_instruction;
    if (typeof raw.temperature === "number") o.temperature = raw.temperature;
    if (typeof raw.maxTokens === "number") o.maxTokens = raw.maxTokens;
    if (typeof raw.topP === "number") o.topP = raw.topP;
    if (typeof raw.frequencyPenalty === "number") o.frequencyPenalty = raw.frequencyPenalty;
    if (typeof raw.presencePenalty === "number") o.presencePenalty = raw.presencePenalty;
    if (typeof raw.stop === "string") o.stop = raw.stop;
    else if (Array.isArray(raw.stop) && raw.stop.every((s) => typeof s === "string")) o.stop = raw.stop;
    out[name] = o;
  }
  return out;
}

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
  let base = "NewState";
  let n = base;
  let i = 2;
  while (lower.has(n.toLowerCase())) {
    n = `${base}${i}`;
    i += 1;
  }
  return n;
}

export default function PresetsView() {
  const convex = useRef(new ConvexClient(convexUrl));
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
      let presets = {};

      // Prefer cloud when signed in
      try {
        const token = await api.getAuthToken?.();
        if (token) {
          convex.current.setAuth(async () => token);
          const cloud = await convex.current.query(convexApi.states.getMyStates, {});
          if (cloud?.states && Object.keys(cloud.states).length > 0) {
            presets = cloud.states;
            await api.writePresets?.(presets);
          } else {
            const readResult = await api.readPresets();
            presets =
              readResult?.success && readResult.presets ? readResult.presets : {};
            if (Object.keys(presets).length > 0) {
              await convex.current.mutation(convexApi.states.saveMyStates, {
                states: sanitizePresetsForCloud(presets),
              });
            }
          }
        } else {
          const readResult = await api.readPresets();
          presets =
            readResult?.success && readResult.presets ? readResult.presets : {};
        }
      } catch (cloudErr) {
        console.error("Cloud states load failed, using local:", cloudErr);
        const readResult = await api.readPresets();
        presets =
          readResult?.success && readResult.presets ? readResult.presets : {};
      }

      const list = Object.entries(presets)
        .filter(([, v]) => v && typeof v === "object" && !Array.isArray(v))
        .map(([name, v]) => fromRawPreset(name, v))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      setEntries(list.length ? list : []);
      setBaselineSnapshot(snapshotEntries(list.length ? list : []));
    } catch (e) {
      console.error(e);
      showMessage(e?.message || "Failed to load states", true);
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

  useEffect(() => {
    api?.onAuthSuccess?.(() => {
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
      return "Each state needs a trigger word, or remove empty states.";
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
          return `State "${e.name.trim() || "(unnamed)"}": ${label} must be a number.`;
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
      if (!result?.success) {
        showMessage(result?.error || "Save failed", true);
        return;
      }

      const saved = result.presets ?? payload;
      try {
        const token = await api.getAuthToken?.();
        if (token) {
          convex.current.setAuth(async () => token);
          await convex.current.mutation(convexApi.states.saveMyStates, {
            states: sanitizePresetsForCloud(saved),
          });
        } else {
          showMessage("Saved locally. Sign in to sync states to your account.", true);
        }
      } catch (cloudErr) {
        console.error(cloudErr);
        showMessage("Saved locally, but cloud sync failed. Try again while signed in.", true);
      }

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
      showMessage("States saved.");
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
        <p>States are only available in the Electron app.</p>
      </div>
    );
  }

  return (
    <div className="settings-view">
      <TitleBar title="States" onClose={handleClose} />
      <div className="presets-layout">
      <div className="settings-scroll presets-scroll">
        {message && (
          <div className={`settings-message ${message.isError ? "error" : ""}`}>{message.text}</div>
        )}

        <section className="settings-section presets-intro">
          <h2>Your states</h2>
      <p className="settings-hint">
            {dirty ? "Unsaved changes · " : ""}
            Type the trigger word first in chat, like <code>Simplify hello</code>.
          </p>
        </section>

        {loading ? (
          <p className="settings-hint presets-loading">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="settings-hint">No states yet. Add one to get started.</p>
        ) : (
          entries.map((entry, index) => (
            <section key={entry.id} className="preset-card">
              <div className="preset-card-head">
                <input
                  type="text"
                  className="preset-input preset-name-input"
                  value={entry.name}
                  onChange={(e) => updateEntry(index, { name: e.target.value })}
                  placeholder="Trigger word"
                  spellCheck={false}
                  aria-label="Trigger word"
                />
                <button
                  type="button"
                  className="settings-btn preset-remove"
                  onClick={() => removeEntry(index)}
                >
                  Remove
                </button>
              </div>

              <input
                type="text"
                className="preset-input"
                value={entry.description}
                onChange={(e) => updateEntry(index, { description: e.target.value })}
                placeholder="Short description"
                aria-label="Description"
              />

              <textarea
                className="preset-textarea"
                value={entry.systemInstruction}
                onChange={(e) => updateEntry(index, { systemInstruction: e.target.value })}
                placeholder="Instructions for the AI"
                rows={4}
                spellCheck={false}
                aria-label="Instructions"
              />

              <details className="preset-advanced">
                <summary>Advanced</summary>
                <div className="preset-number-grid">
                  <label className="preset-field preset-field-compact">
                    <span className="preset-label">Temperature</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="preset-input"
                      value={entry.temperature}
                      onChange={(e) => updateEntry(index, { temperature: e.target.value })}
                      placeholder="0.7"
                    />
                  </label>
                  <label className="preset-field preset-field-compact">
                    <span className="preset-label">Max tokens</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="preset-input"
                      value={entry.maxTokens}
                      onChange={(e) => updateEntry(index, { maxTokens: e.target.value })}
                      placeholder="4096"
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
                      placeholder="0.95"
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
                      placeholder="0"
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
                      placeholder="0.3"
                    />
                  </label>
                </div>
                <textarea
                  className="preset-textarea preset-textarea-sm"
                  value={entry.stopLines}
                  onChange={(e) => updateEntry(index, { stopLines: e.target.value })}
                  placeholder="Stop sequences, one per line (optional)"
                  rows={2}
                  spellCheck={false}
                  aria-label="Stop sequences"
                />
              </details>
            </section>
          ))
        )}
      </div>

      {!loading && (
        <div className="presets-footer">
          <button type="button" className="presets-action presets-action-add" onClick={addEntry}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add state
          </button>
          <div className="presets-footer-right">
            <button type="button" className="presets-action presets-action-secondary" onClick={handleRevert} disabled={!dirty}>
              Revert
            </button>
            <button
              type="button"
              className="presets-action presets-action-primary"
              onClick={handleSave}
              disabled={saving || !dirty}
            >
              {saving ? "Saving…" : "Save all"}
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
