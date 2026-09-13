// View: Quick launch shortcut bubble
import { useState, useEffect, useRef } from 'react';
import ProxyMark from '../components/ProxyMark';
import '../index.css';

const api = typeof window !== 'undefined' ? window.electronAPI : null;

function BubbleControls() {
  const hide = () => api?.hideWindow?.();
  return (
    <div className="bubble-controls">
      <button type="button" className="bubble-control-btn" onClick={hide} aria-label="Hide bubble">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path d="M2 6h8" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
      <button type="button" className="bubble-control-btn bubble-control-close" onClick={hide} aria-label="Hide bubble">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path d="M3 3l6 6M9 3L3 9" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
    </div>
  );
}

const ChatBubbleView = () => {
  const [message, setMessage] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [presets, setPresets] = useState({});
  const [activePreset, setActivePreset] = useState('');
  const [stateMenuOpen, setStateMenuOpen] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    api?.readPresets?.().then((result) => {
      if (result?.success && result.presets) setPresets(result.presets);
    });
    const unsub = api?.onPresetsUpdated?.(() => {
      api?.readPresets?.().then((result) => {
        if (result?.success && result.presets) setPresets(result.presets);
      });
    });
    return typeof unsub === 'function' ? unsub : undefined;
  }, []);

  useEffect(() => {
    const focusInput = () => {
      requestAnimationFrame(() => textareaRef.current?.focus());
    };
    focusInput();
    window.addEventListener('focus', focusInput);
    return () => window.removeEventListener('focus', focusInput);
  }, []);

  useEffect(() => {
    const handlePaste = async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;
          try {
            const reader = new FileReader();
            const dataUrl = await new Promise((resolve, reject) => {
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            setAttachedFiles((prev) => [
              ...prev,
              {
                file,
                dataUrl,
                type: file.type,
                name: `pasted-image-${Date.now()}.${file.type.split('/')[1] || 'png'}`,
              },
            ]);
          } catch (error) {
            console.error('Error pasting image:', error);
          }
          break;
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  const presetNames = Object.keys(presets).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  const stateLabel = activePreset || 'Quick';

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    const messageText = message.trim();
    if (!messageText && attachedFiles.length === 0) return;

    const filesToSend = [...attachedFiles];
    setMessage('');
    setAttachedFiles([]);

    let payload = messageText;
    if (activePreset && messageText) {
      payload = `${activePreset} ${messageText}`;
    } else if (activePreset && !messageText) {
      payload = activePreset;
    }

    if (filesToSend.length > 0) {
      const imageNote = `[${filesToSend.length} image(s) attached]`;
      payload = payload ? `${payload} ${imageNote}` : imageNote;
    }

    if (!api?.sendMessage) {
      console.warn('IPC not available');
      return;
    }

    try {
      await api.sendMessage(payload);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
    if (e.key === 'Escape') {
      api?.hideWindow?.();
    }
  };

  return (
    <div className="bubble-window">
      <header className="bubble-titlebar">
        <div className="bubble-brand">
          <ProxyMark size={18} />
          <span className="bubble-brand-name">PROXY</span>
        </div>
        <BubbleControls />
      </header>

      <form className="bubble-input-box" onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          className="bubble-textarea"
          placeholder="Ask PROXY…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          spellCheck
          autoComplete="off"
          autoCorrect="off"
        />

        <div className="bubble-input-footer">
          <div className="bubble-state-menu">
            <button
              type="button"
              className="bubble-state-pill"
              onClick={() => setStateMenuOpen((open) => !open)}
              aria-haspopup="listbox"
              aria-expanded={stateMenuOpen}
            >
              <svg className="bubble-state-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              <span className="bubble-state-label">{stateLabel}</span>
              <svg className="bubble-state-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {stateMenuOpen && (
              <div className="bubble-state-options" role="listbox" aria-label="State">
                {[{ value: '', label: 'Quick' }, ...presetNames.map((name) => ({ value: name, label: name }))].map(({ value, label }) => (
                  <button
                    key={value || 'quick'}
                    type="button"
                    className={`bubble-state-option${activePreset === value ? ' is-active' : ''}`}
                    role="option"
                    aria-selected={activePreset === value}
                    onClick={() => {
                      setActivePreset(value);
                      setStateMenuOpen(false);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {attachedFiles.length > 0 && (
            <span className="bubble-attach-badge">+{attachedFiles.length}</span>
          )}

          <button
            type="submit"
            className="bubble-send"
            disabled={!message.trim() && attachedFiles.length === 0}
            aria-label="Send"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatBubbleView;
