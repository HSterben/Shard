// View: Chat display UI
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ConvexClient } from 'convex/browser';
import { api } from '../../../backend/convex/_generated/api';
import AppShell from '../components/AppShell';
import ProxyMark from '../components/ProxyMark';
import WindowControls from '../components/WindowControls';
import { convexUrl, convexSiteUrl } from '../lib/convexUrls';
import './ChatView.css';

// ——— Constants ———
const CONVEX_URL = convexUrl;
const CONVEX_SITE_BASE = convexSiteUrl;

const getConvexSiteBaseUrl = () => CONVEX_SITE_BASE;

const DEFAULT_SYSTEM_INSTRUCTION =
  'You are PROXY X, an expert AI assistant. Be concise and helpful. Always provide clear, accurate information and assist the user to the best of your ability.'
// Model is chosen on the server (Convex `openrouter_model_name` env). Client does not send it.

const TONES = [
  { id: 'concise', label: 'Concise', instruction: 'Respond concisely. Prefer short, direct answers.' },
  { id: 'professional', label: 'Professional', instruction: 'Use a professional, polished tone.' },
  { id: 'precise', label: 'Precise', instruction: 'Be precise and specific. Avoid vague language.' },
];

const SUGGESTED_PROMPTS = [
  'Explain with an analogy',
  'Give me the short version',
  'What should I do next?',
];

const applyTone = (systemInstruction, toneId) => {
  const tone = TONES.find((t) => t.id === toneId);
  if (!tone) return systemInstruction;
  return `${systemInstruction}\n\nTone: ${tone.instruction}`;
};

const ChatView = () => {
  // State
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [subscriptionRequired, setSubscriptionRequired] = useState(false);
  const [accountGateReason, setAccountGateReason] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('http://localhost:5173');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [presets, setPresets] = useState({});
  const [activePreset, setActivePreset] = useState(null);
  const [activeTone, setActiveTone] = useState('precise');
  const [messageFeedback, setMessageFeedback] = useState({});

  const convex = useRef(new ConvexClient(CONVEX_URL));
  const conversationContext = useRef([]);
  const sessionOptionsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const presetSyncedRef = useRef(false);

  useEffect(() => {
    sessionOptionsRef.current = null;
  }, [activePreset, activeTone]);

  // ——— Effects ———
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.readPresets) {
      window.electronAPI
        .readPresets()
        .then((result) => {
          if (result?.success && result.presets) setPresets(result.presets);
        })
        .catch((err) => console.error('Failed to load presets:', err));
    }
  }, []);

  // Prefer cloud states when signed in; migrate local → cloud on first login
  useEffect(() => {
    if (!isAuthenticated || !authToken) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const cloud = await convex.current.query(api.states.getMyStates, {});
        if (cancelled) return;
        if (cloud?.states && Object.keys(cloud.states).length > 0) {
          setPresets(cloud.states);
          await window.electronAPI?.writePresets?.(cloud.states);
          return;
        }
        const local = await window.electronAPI?.readPresets?.();
        if (cancelled) return;
        if (local?.success && local.presets && Object.keys(local.presets).length > 0) {
          setPresets(local.presets);
          const sanitized = {};
          for (const [name, raw] of Object.entries(local.presets)) {
            if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
            const o = {};
            if (typeof raw.description === 'string') o.description = raw.description;
            else if (typeof raw.desc === 'string') o.description = raw.desc;
            if (typeof raw.systemInstruction === 'string') o.systemInstruction = raw.systemInstruction;
            else if (typeof raw.system_instruction === 'string') o.systemInstruction = raw.system_instruction;
            if (typeof raw.temperature === 'number') o.temperature = raw.temperature;
            if (typeof raw.maxTokens === 'number') o.maxTokens = raw.maxTokens;
            if (typeof raw.topP === 'number') o.topP = raw.topP;
            if (typeof raw.frequencyPenalty === 'number') o.frequencyPenalty = raw.frequencyPenalty;
            if (typeof raw.presencePenalty === 'number') o.presencePenalty = raw.presencePenalty;
            if (typeof raw.stop === 'string') o.stop = raw.stop;
            else if (Array.isArray(raw.stop) && raw.stop.every((s) => typeof s === 'string')) o.stop = raw.stop;
            sanitized[name] = o;
          }
          await convex.current.mutation(api.states.saveMyStates, { states: sanitized });
        }
      } catch (err) {
        console.error('Failed to sync cloud states:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authToken]);

  useEffect(() => {
    const unsub = window.electronAPI?.onPresetsUpdated?.(() => {
      window.electronAPI
        ?.readPresets()
        .then((result) => {
          if (result?.success && result.presets) setPresets(result.presets);
        })
        .catch((err) => console.error('Failed to reload presets:', err));
    });
    return typeof unsub === 'function' ? unsub : undefined;
  }, []);

  // Presets: loaded on mount from JSON file via electronAPI.readPresets().
  // presetsOverride: use when presets were just loaded in getAIResponse to avoid race.
  const getOptionsForMessage = (message, presetsOverride) => {
    const presetsMap = presetsOverride ?? presets;
    const base = {
      systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
      temperature: 0.5,
      maxTokens: 4096,
      topP: 0.95,
      frequencyPenalty: 0.0,
      presencePenalty: 0.3,
      stop: undefined,
    };
    const rawFirst = (message || '').trim().split(/\s+/)[0] || '';
    const firstWord = rawFirst.replace(/\W/g, ''); // strip punctuation so "Simplify," matches "Simplify"
    if (activePreset && presetsMap[activePreset]) {
      const p = presetsMap[activePreset];
      const systemInstructionRaw = p.systemInstruction ?? p.system_instruction;
      const systemInstruction =
        systemInstructionRaw != null && String(systemInstructionRaw).trim() !== ''
          ? String(systemInstructionRaw).trim()
          : DEFAULT_SYSTEM_INSTRUCTION;
      const descRaw = p.description ?? p.desc;
      const presetDescription =
        descRaw != null && String(descRaw).trim() !== '' ? String(descRaw).trim() : '';
      return {
        options: {
          ...base,
          systemInstruction: applyTone(systemInstruction, activeTone),
          temperature: p.temperature != null ? p.temperature : 0.7,
          maxTokens: p.maxTokens != null ? p.maxTokens : 4096,
          topP: p.topP != null ? p.topP : 0.95,
          frequencyPenalty: p.frequencyPenalty != null ? p.frequencyPenalty : 0.0,
          presencePenalty: p.presencePenalty != null ? p.presencePenalty : 0.3,
          stop: p.stop != null ? p.stop : undefined,
        },
        presetMatched: true,
        presetName: activePreset,
        presetDescription,
      };
    }
    if (!firstWord || !presetsMap || Object.keys(presetsMap).length === 0) {
      return {
        options: { ...base, systemInstruction: applyTone(base.systemInstruction, activeTone) },
        presetMatched: false,
        presetName: undefined,
        presetDescription: undefined,
      };
    }
    const key = Object.keys(presetsMap).find(
      (k) => k.toLowerCase() === firstWord.toLowerCase()
    );
    if (!key) {
      return {
        options: { ...base, systemInstruction: applyTone(base.systemInstruction, activeTone) },
        presetMatched: false,
        presetName: undefined,
        presetDescription: undefined,
      };
    }
    const p = presetsMap[key];
    const systemInstructionRaw = p.systemInstruction ?? p.system_instruction;
    const systemInstruction =
      systemInstructionRaw != null && String(systemInstructionRaw).trim() !== ''
        ? String(systemInstructionRaw).trim()
        : DEFAULT_SYSTEM_INSTRUCTION;
    const descRaw = p.description ?? p.desc;
    const presetDescription =
      descRaw != null && String(descRaw).trim() !== '' ? String(descRaw).trim() : '';
    return {
      options: {
        ...base,
        systemInstruction: applyTone(systemInstruction, activeTone),
        temperature: p.temperature != null ? p.temperature : 0.7,
        maxTokens: p.maxTokens != null ? p.maxTokens : 4096,
        topP: p.topP != null ? p.topP : 0.95,
        frequencyPenalty: p.frequencyPenalty != null ? p.frequencyPenalty : 0.0,
        presencePenalty: p.presencePenalty != null ? p.presencePenalty : 0.3,
        stop: p.stop != null ? p.stop : undefined,
      },
      presetMatched: true,
      presetName: key,
      presetDescription,
    };
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await window.electronAPI.getAuthToken();
        if (token) {
          setAuthToken(token);
          convex.current.setAuth(async () => token);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        setIsAuthenticated(false);
      }
    };

    checkAuth();

    // Listen for auth success events
    window.electronAPI.onAuthSuccess((data) => {
      if (data.token) {
        setAuthToken(data.token);
        convex.current.setAuth(async () => data.token);
        setIsAuthenticated(true);
      } else {
        setAuthToken(null);
        convex.current.clearAuth();
        setIsAuthenticated(false);
      }
    });
    window.electronAPI.onAuthError((data) => {
      console.error('Auth error:', data.message);
      setIsAuthenticated(false);
    });
  }, []);

  // Helper to refresh auth and update Convex client
  const refreshAndRetry = async () => {
    try {
      const result = await window.electronAPI.refreshAuthToken();
      if (result.success && result.token) {
        setAuthToken(result.token);
        convex.current.setAuth(async () => result.token);
        return true;
      }
    } catch (err) {
      console.error('Failed to refresh token:', err);
    }
    setIsAuthenticated(false);
    return false;
  };

  const openWebsiteBilling = async () => {
    const url = `${websiteUrl.replace(/\/$/, '')}/account/billing`;
    if (window.electronAPI?.openExternal) {
      await window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const checkAccountAccess = async () => {
    let account;
    try {
      account = await convex.current.query(api.account.getMyAccount, {});
    } catch (error) {
      const msg = error?.message || String(error);
      if (msg.includes('Could not find public function')) {
        throw new Error(
          `Account API not found on ${CONVEX_URL}. Run "npx convex dev" from backend/ or set VITE_CONVEX_URL to your deployment.`,
        );
      }
      throw error;
    }
    if (!account) {
      return { ok: false, reason: 'Could not load account. Try signing in again.', websiteUrl: 'http://localhost:5173' };
    }
    setWebsiteUrl(account.websiteUrl || 'http://localhost:5173');
    if (!account.subscriptionActive) {
      return { ok: false, reason: 'Subscription required', websiteUrl: account.websiteUrl };
    }
    if (!account.canUseAI) {
      return { ok: false, reason: 'Monthly usage limit reached', websiteUrl: account.websiteUrl };
    }
    return { ok: true, account };
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const pdfToImage = async (file) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 800;
    canvas.height = 1000;
    
    // Draw white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw PDF icon placeholder
    ctx.fillStyle = '#666666';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PDF', canvas.width / 2, canvas.height / 2 - 50);
    
    ctx.font = '24px Arial';
    ctx.fillText(file.name, canvas.width / 2, canvas.height / 2 + 20);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    
    return {
      file,
      dataUrl,
      type: 'image/jpeg',
      name: file.name.replace('.pdf', '.jpg'),
      isPDF: true // Flag to indicate this was a PDF
    };
  };

  const buildContextMessages = (message, files) => {
    const out = conversationContext.current.map((msg) => {
      const role = msg.sender === 'user' ? 'user' : 'assistant';
      if (msg.images?.length > 0) {
        const content = [{ type: 'text', text: msg.text }];
        msg.images.forEach((img) => content.push({ type: 'image_url', image_url: { url: img } }));
        return { role, content };
      }
      return { role, content: msg.text };
    });
    const currentContent =
      files.length > 0
        ? [{ type: 'text', text: message || '' }, ...files.map((f) => ({ type: 'image_url', image_url: { url: f.dataUrl } }))]
        : message;
    out.push({ role: 'user', content: currentContent });
    return out;
  };

  const askOpenRouterStream = async (message, files, options, onChunk, isRetry = false) => {
    const contextMessages = buildContextMessages(message, files);

    try {
      if (!authToken) throw new Error('Authentication token not available. Please log in.');

      const streamUrl = `${getConvexSiteBaseUrl()}/openrouter/stream`;
      const response = await fetch(streamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          messages: contextMessages,
          systemInstruction: options.systemInstruction ?? DEFAULT_SYSTEM_INSTRUCTION,
          temperature: options.temperature,
          maxTokens: options.maxTokens,
          topP: options.topP,
          frequencyPenalty: options.frequencyPenalty,
          presencePenalty: options.presencePenalty,
          stop: options.stop,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP error: ${response.status}`;
        
        // Check if it's an authentication error and we haven't retried yet
        if (!isRetry && (response.status === 401 || errorMessage.includes('Authentication'))) {
          const refreshed = await refreshAndRetry();
          if (refreshed) {
            return askOpenRouterStream(message, files, options, onChunk, true);
          }
        }

        if (response.status === 402 || response.status === 429) {
          setAccountGateReason(errorData.code === 'usage_limit_reached'
            ? 'Monthly usage limit reached'
            : 'Subscription required');
          setSubscriptionRequired(true);
          if (errorData.websiteUrl) setWebsiteUrl(errorData.websiteUrl);
        }
        
        throw new Error(errorMessage);
      }

      // Read the stream
      if (!response.body) {
        throw new Error('Response body is null - streaming not supported');
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let messageId = '';
      let finishReason = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // Process any remaining buffered data
          if (buffer.trim()) {
            const lines = buffer.split('\n');
            for (const line of lines) {
              // Handle SSE format: "data: {...}" or just "data:"
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') {
                  break;
                }
                if (data) {
                  try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta;
                    
                    // Handle content in delta
                    if (delta?.content) {
                      fullContent += delta.content;
                      onChunk(delta.content);
                    }
                    
                    // Also check for content in message (some APIs use this format)
                    const message = parsed.choices?.[0]?.message;
                    if (message?.content) {
                      fullContent += message.content;
                      onChunk(message.content);
                    }

                    if (parsed.id) messageId = parsed.id;
                    if (parsed.choices?.[0]?.finish_reason) {
                      finishReason = parsed.choices[0].finish_reason;
                    }
                  } catch (e) {
                    // Check if it's an error message
                    try {
                      const errorData = JSON.parse(data);
                      if (errorData.error) {
                        throw new Error(errorData.error);
                      }
                    } catch (_e2) {}
                  }
                }
              }
            }
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          // Handle SSE format: "data: {...}" or just "data:"
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              return {
                content: fullContent,
                id: messageId,
                finishReason: finishReason || 'stop',
              };
            }

            if (data) {
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;
                
                // Handle content in delta
                if (delta?.content) {
                  fullContent += delta.content;
                  onChunk(delta.content); // Call the callback with each chunk
                }
                
                // Also check for content in message (some APIs use this format)
                const message = parsed.choices?.[0]?.message;
                if (message?.content) {
                  fullContent += message.content;
                  onChunk(message.content);
                }

                if (parsed.id) messageId = parsed.id;
                if (parsed.choices?.[0]?.finish_reason) {
                  finishReason = parsed.choices[0].finish_reason;
                }
              } catch (e) {
                try {
                  const err = JSON.parse(data);
                  if (err.error) throw new Error(err.error);
                } catch (_e2) {}
              }
            }
          }
        }
      }

      return {
        content: fullContent,
        id: messageId,
        finishReason: finishReason || 'stop',
      };
    } catch (error) {
      console.error('Streaming fetch error:', error);
      // Provide more helpful error messages
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Could not connect to streaming endpoint. Please check your connection.');
      }
      throw error;
    }
  };

  const askOpenRouterComplete = async (message, files, options, isRetry = false) => {
    const contextMessages = buildContextMessages(message, files);
    if (!authToken) throw new Error('Authentication token not available. Please log in.');
    const url = `${getConvexSiteBaseUrl()}/openrouter/complete`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s for slow free models
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          messages: contextMessages,
          systemInstruction: options.systemInstruction ?? DEFAULT_SYSTEM_INSTRUCTION,
          temperature: options.temperature,
          maxTokens: options.maxTokens,
          topP: options.topP,
          frequencyPenalty: options.frequencyPenalty,
          presencePenalty: options.presencePenalty,
          stop: options.stop,
        }),
      });
    } catch (e) {
      clearTimeout(timeoutId);
      if (e?.name === 'AbortError') {
        throw new Error('Request timed out. The AI is taking too long; try a shorter question or try again.');
      }
      const msg = e?.message || String(e);
      if (msg === 'Failed to fetch' || msg.includes('fetch')) {
        throw new Error(
          `Could not reach the server (tried ${url}). Check your internet connection and deploy the Convex backend: run "npx convex deploy" from the backend folder.`
        );
      }
      throw e;
    }
    clearTimeout(timeoutId);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (!isRetry && (res.status === 401 || (err.error && err.error.includes('Authentication')))) {
        const refreshed = await refreshAndRetry();
        if (refreshed) return askOpenRouterComplete(message, files, options, true);
      }
      if (res.status === 402 || res.status === 429) {
        setAccountGateReason(err.code === 'usage_limit_reached'
          ? 'Monthly usage limit reached'
          : 'Subscription required');
        setSubscriptionRequired(true);
        return { content: '', blocked: true };
      }
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    if (data.model) {
      console.log('[PROXY X] OpenRouter model:', data.model, 'source:', data.modelSource);
    }
    return { content: data.content ?? '', model: data.model, modelSource: data.modelSource };
  };

  const getAIResponse = async (userMessage, files = []) => {
    try {
      const access = await checkAccountAccess();
      if (!access.ok) {
        setAccountGateReason(access.reason || 'Subscription required');
        setSubscriptionRequired(true);
        if (access.websiteUrl) setWebsiteUrl(access.websiteUrl);
        return;
      }
    } catch (error) {
      console.error('Error checking account:', error);
      setAccountGateReason(error?.message || 'Could not verify subscription.');
      setSubscriptionRequired(true);
      return;
    }

    setIsLoading(true);
    
    // Create a placeholder message that we'll update as we stream
    const aiMessageId = Date.now() + 1;
    const aiMessage = {
      id: aiMessageId,
      text: '',
      sender: 'ai',
      timestamp: new Date(),
      isStreaming: true
    };

    // Add placeholder message immediately
    setMessages(prev => [...prev, aiMessage]);

    try {
      let messageToSend = userMessage;
      if (sessionOptionsRef.current === null) {
        let presetsToUse = presets;
        if (Object.keys(presetsToUse).length === 0 && window.electronAPI?.readPresets) {
          const result = await window.electronAPI.readPresets();
          if (result?.success && result.presets && Object.keys(result.presets).length > 0) {
            presetsToUse = result.presets;
            setPresets(result.presets);
          }
        }
        const result = getOptionsForMessage(userMessage, presetsToUse);
        if (result.presetMatched) {
          const trimmedMessage = (userMessage || '').trim();
          const words = trimmedMessage.split(/\s+/);
          messageToSend = words.slice(1).join(' ').trim();
        }
        if (result.presetMatched && result.presetName) {
          setMessages((prev) => {
            if (prev.length < 2) return prev;
            const aiIdx = prev.length - 1;
            const userIdx = prev.length - 2;
            if (prev[aiIdx]?.id !== aiMessageId || prev[userIdx]?.sender !== 'user') return prev;
            const next = [...prev];
            next[userIdx] = {
              ...next[userIdx],
              presetName: result.presetName,
              presetDescription: result.presetDescription ?? '',
            };
            return next;
          });
        }
        sessionOptionsRef.current = { ...result, presetMatched: false };
      }
      const options = sessionOptionsRef.current.options || sessionOptionsRef.current;

      setMessages(prev => prev.map(msg =>
        msg.id === aiMessageId ? { ...msg, text: '' } : msg
      ));

      let contentToUse = '';
      let requestError = null;
      const tryComplete = async () => {
        const complete = await askOpenRouterComplete(messageToSend, files, options);
        return (complete.content || '').trim();
      };
      try {
        contentToUse = await tryComplete();
        if (!contentToUse) {
          setMessages(prev => prev.map(msg =>
            msg.id === aiMessageId ? { ...msg, text: 'Retrying…' } : msg
          ));
          await new Promise((r) => setTimeout(r, 2000));
          contentToUse = await tryComplete();
        }
      } catch (e) {
        requestError = e;
        console.error('AI request failed:', e);
      }

      if (!contentToUse) {
        const errText = requestError instanceof Error ? requestError.message : (requestError ? String(requestError) : '');
        const errorMessage = {
          id: Date.now() + 1,
          text: errText
            ? `Error: ${errText}`
            : 'Error: The AI returned no text. Free models can be slow or hit rate limits—wait a minute and try again, or try a shorter question.',
          sender: 'ai',
          timestamp: new Date()
        };
        setMessages(prev => [...prev.filter(msg => msg.id !== aiMessageId), errorMessage]);
      } else {
        // Update with final content
        setMessages(prev => prev.map(msg =>
          msg.id === aiMessageId
            ? { ...msg, text: contentToUse, isStreaming: false }
            : msg
        ));
        
        // Update conversation context
        conversationContext.current = [
          ...conversationContext.current,
          { 
            text: messageToSend, 
            sender: 'user',
            images: files.length > 0 ? files.map(f => f.dataUrl) : undefined
          },
          { text: contentToUse, sender: 'ai' }
        ];
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      // Remove the streaming message and add error message
      setMessages(prev => prev.filter(msg => msg.id !== aiMessageId));
      const errorMessage = {
        id: Date.now() + 1,
        text: `Error: ${error instanceof Error ? error.message : 'Failed to get response. Please try again.'}`,
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (presetSyncedRef.current) return;
    if (!presets || Object.keys(presets).length === 0) return;
    const first = messages.find((m) => m.sender === 'user');
    if (!first?.text) return;
    const firstWord = (first.text.trim().split(/\s+/)[0] || '').replace(/\W/g, '');
    if (!firstWord) return;
    const key = Object.keys(presets).find((k) => k.toLowerCase() === firstWord.toLowerCase());
    if (key) {
      setActivePreset(key);
      presetSyncedRef.current = true;
    }
  }, [presets, messages]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const encodedData = urlParams.get('data');
    
    if (encodedData) {
      try {
        const data = JSON.parse(decodeURIComponent(encodedData));
        const initialMessage = data.message || '';
        
        if (initialMessage) {
          const userMessage = {
            id: Date.now(),
            text: initialMessage,
            sender: 'user',
            timestamp: new Date()
          };
          
          setMessages([userMessage]);
          
          conversationContext.current = [{ text: initialMessage, sender: 'user' }];
          
          setTimeout(() => {
            if (isAuthenticated === true) {
              getAIResponse(initialMessage);
            }
          }, 100);
        }
      } catch (error) {
        console.error('Error parsing message data:', error);
      }
    }
  }, []);

  // Trigger AI response when auth becomes available and we have a pending message
  useEffect(() => {
    if (isAuthenticated === true && messages.length === 1 && messages[0].sender === 'user' && !isLoading) {
      getAIResponse(messages[0].text);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const el = messagesEndRef.current;
    if (!el) return;
    const scroller = el.closest('.chat-messages');
    if (scroller) {
      scroller.scrollTop = scroller.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const handlePaste = async (e) => {
      for (const item of e.clipboardData?.items ?? []) {
        if (item.type.indexOf('image') === -1) continue;
        const file = item.getAsFile();
        if (!file) continue;
        e.preventDefault();
        try {
          const dataUrl = await fileToBase64(file);
          setAttachedFiles((prev) => [
            ...prev,
            { file, dataUrl, type: file.type, name: `pasted-${Date.now()}.${file.type.split('/')[1] || 'png'}` },
          ]);
        } catch (err) {
          console.error('Error pasting image:', err);
        }
        break;
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  const handleClose = () => window.electronAPI?.closeMessageWindow?.();
  const handleLogin = () => window.electronAPI?.openLogin?.();
  const formatTime = (date) => date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const copyMessage = async (text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const setFeedback = (id, value) => {
    setMessageFeedback((prev) => ({ ...prev, [id]: prev[id] === value ? null : value }));
  };

  const presetNames = Object.keys(presets).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  const displayState = activePreset || 'Default';
  const lastMessage = messages[messages.length - 1];
  const showSuggestions = lastMessage?.sender === 'ai' && !lastMessage?.isStreaming && !isLoading;

  const renderAuthShell = (content) => (
    <AppShell active="chat">
      <div className="chat-panel">
        <header className="chat-header">
          <div className="chat-header-left">
            <span className="chat-header-label">PROXY X</span>
          </div>
          <WindowControls onClose={handleClose} />
        </header>
        {content}
      </div>
    </AppShell>
  );

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    const validFiles = files.filter(file => {
      const isImage = file.type.startsWith('image/');
      const isPDF = file.type === 'application/pdf';
      return isImage || isPDF;
    });

    if (validFiles.length === 0) {
      alert('Please select image or PDF files only.');
      return;
    }

    const fileDataPromises = validFiles.map(async (file) => {
      if (file.type === 'application/pdf') {
        // Convert PDF to image placeholder
        // Note: This creates a placeholder. For full PDF text extraction,
        // you would need to use pdf.js or a similar library
        try {
          return await pdfToImage(file);
        } catch (error) {
          console.error('Error processing PDF:', error);
          // Fallback: create a simple placeholder
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = 400;
          canvas.height = 500;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#666666';
          ctx.font = '24px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('PDF: ' + file.name, canvas.width / 2, canvas.height / 2);
          const dataUrl = canvas.toDataURL('image/jpeg');
          return {
            file,
            dataUrl,
            type: 'image/jpeg',
            name: file.name.replace('.pdf', '.jpg'),
            isPDF: true
          };
        }
      } else {
        // Handle images
        const dataUrl = await fileToBase64(file);
        return {
          file,
          dataUrl,
          type: file.type,
          name: file.name
        };
      }
    });

    const fileData = await Promise.all(fileDataPromises);
    setAttachedFiles(prev => [...prev, ...fileData]);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const messageText = inputValue.trim();
    
    if ((!messageText && attachedFiles.length === 0) || isLoading) return;
    
    // Store files for this message
    const filesToSend = [...attachedFiles];
    
    // Clear input and files immediately
    setInputValue('');
    setAttachedFiles([]);
    
    // Add user message to UI
    const userMessage = {
      id: Date.now(),
      text: messageText || (filesToSend.length > 0 ? 'Sent files' : ''),
      sender: 'user',
      timestamp: new Date(),
      images: filesToSend.map(f => f.dataUrl),
      files: filesToSend
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // Update conversation context
    conversationContext.current = [
      ...conversationContext.current,
      { 
        text: messageText || '', 
        sender: 'user',
        images: filesToSend.length > 0 ? filesToSend.map(f => f.dataUrl) : undefined
      }
    ];
    
    // Get AI response
    await getAIResponse(messageText || '', filesToSend);
  };

  if (isAuthenticated === false) {
    return renderAuthShell(
      <div className="chat-auth-container">
        <div className="chat-auth-content">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="7" r="4"></circle>
            <path d="M5.5 21a8.38 8.38 0 0 1 13 0"></path>
          </svg>
          <h2>Sign in to continue</h2>
          <p>Please log in to use PROXY X</p>
          <button className="chat-login-button" onClick={handleLogin}>
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (subscriptionRequired) {
    return renderAuthShell(
      <div className="chat-auth-container">
        <div className="chat-auth-content">
          <h2>{accountGateReason || 'Subscription required'}</h2>
          <p>
            Subscribe and manage billing on the PROXY X website. This app only checks your account status.
          </p>

          <button className="chat-login-button" onClick={openWebsiteBilling}>
            Open billing on website
          </button>

          <button
            className="chat-close-button"
            onClick={async () => {
              try {
                await convex.current.action(api.account.syncMySubscription, {});
              } catch (err) {
                console.error('syncMySubscription failed:', err);
              }
              setSubscriptionRequired(false);
              setAccountGateReason('');
              await getAIResponse(messages[0]?.text || '');
            }}
            style={{ marginTop: 16 }}
          >
            I already subscribed (retry)
          </button>
        </div>
      </div>
    );
  }

  if (isAuthenticated === null) {
    return renderAuthShell(
      <div className="chat-auth-container">
        <div className="chat-auth-content">
          <div className="chat-loading-spinner"></div>
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell active="chat">
      <div className="chat-panel">
        <header className="chat-header">
          <div className="chat-header-left">
            <label className="chat-state-select-wrap">
              <span className="chat-header-label">State</span>
              <select
                className="chat-state-select select-field"
                value={activePreset || ''}
                onChange={(e) => setActivePreset(e.target.value || null)}
                aria-label="Active state"
              >
                <option value="">Default</option>
                {presetNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="chat-header-actions">
            <button
              type="button"
              className="chat-header-icon-btn"
              aria-label="Open settings"
              title="Settings"
              onClick={() => window.electronAPI?.openSettingsWindow?.()}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
                <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
                <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
              </svg>
            </button>
            <WindowControls onClose={handleClose} />
          </div>
        </header>

        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="chat-empty">
              <ProxyMark size={32} />
              <p>Ask anything to get started</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`message message-${msg.sender}`}>
                <div className="message-body">
                  <div className="message-bubble">
                    {msg.sender === 'user' && msg.presetName && (
                      <span className="message-preset-indicator" title={`State: ${msg.presetName}`}>
                        <span className="message-preset-indicator-label">{msg.presetName}</span>
                      </span>
                    )}
                    {msg.images && msg.images.length > 0 && (
                      <div className="message-images">
                        {msg.images.map((img, idx) => (
                          <div key={idx} className="message-image-container">
                            {msg.files && msg.files[idx]?.type === 'application/pdf' ? (
                              <div className="message-pdf-preview">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                  <polyline points="14 2 14 8 20 8"></polyline>
                                </svg>
                                <span>{msg.files[idx]?.name || 'PDF'}</span>
                              </div>
                            ) : (
                              <img src={img} alt={`Attachment ${idx + 1}`} className="message-image" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {(msg.text || msg.isStreaming) && (
                      <div className="message-text message-text-markdown">
                        {msg.sender === 'ai' ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text || ''}</ReactMarkdown>
                        ) : (
                          msg.text
                        )}
                        {msg.isStreaming && <span className="streaming-cursor">▋</span>}
                      </div>
                    )}
                  </div>
                  {msg.sender === 'ai' && !msg.isStreaming && msg.text && (
                    <div className="message-actions">
                      <button type="button" className="message-action-btn" aria-label="Copy" onClick={() => copyMessage(msg.text)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                          <rect x="9" y="9" width="13" height="13" rx="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={`message-action-btn${messageFeedback[msg.id] === 'up' ? ' is-active' : ''}`}
                        aria-label="Good response"
                        onClick={() => setFeedback(msg.id, 'up')}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                          <path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={`message-action-btn${messageFeedback[msg.id] === 'down' ? ' is-active' : ''}`}
                        aria-label="Bad response"
                        onClick={() => setFeedback(msg.id, 'down')}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                          <path d="M17 14V2M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
                        </svg>
                      </button>
                    </div>
                  )}
                  <div className="message-time">{formatTime(msg.timestamp)}</div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {showSuggestions && (
          <div className="chat-suggestions" role="group" aria-label="Suggested follow-ups">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="chat-suggestion-chip"
                onClick={() => setInputValue(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {false && attachedFiles.length > 0 && (
          <div className="chat-attachments">
            {attachedFiles.map((fileData, idx) => (
              <div key={idx} className="chat-attachment-item">
                {fileData.type.startsWith('image/') ? (
                  <img src={fileData.dataUrl} alt={fileData.name} className="attachment-preview" />
                ) : (
                  <div className="attachment-pdf-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                  </div>
                )}
                <span className="attachment-name" title={fileData.name}>
                  {fileData.name.length > 15 ? fileData.name.substring(0, 15) + '...' : fileData.name}
                </span>
                <button
                  type="button"
                  className="attachment-remove"
                  onClick={() => removeFile(idx)}
                  aria-label="Remove attachment"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <form className="chat-input-container" onSubmit={handleSubmit}>
          <input
            type="text"
            className="chat-input-field"
            placeholder="Ask anything..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isLoading}
            autoFocus
          />
          <label className="chat-input-state">
            <span className="visually-hidden">State</span>
            <select
              className="chat-input-state-select select-field"
              value={activePreset || ''}
              onChange={(e) => setActivePreset(e.target.value || null)}
            >
              <option value="">{displayState}</option>
              {presetNames.filter((n) => n !== activePreset).map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="chat-input-submit"
            disabled={!inputValue.trim() || isLoading}
            aria-label="Send message"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </form>
      </div>
    </AppShell>
  );
};

export default ChatView;
