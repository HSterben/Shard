// View: Chat display UI
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ConvexClient } from 'convex/browser';
import { api } from '../../../backend/convex/_generated/api';
import './ChatView.css';
import crystalIcon from '../icon/crystal.png';

// ——— Constants ———
const CONVEX_URL = 'https://strong-poodle-712.convex.cloud';
// Optional override: set VITE_CONVEX_SITE_URL in .env to your HTTP actions base (e.g. https://your-deployment.convex.site)
const CONVEX_SITE_BASE = typeof import.meta !== 'undefined' && import.meta.env?.VITE_CONVEX_SITE_URL
  ? import.meta.env.VITE_CONVEX_SITE_URL.replace(/\/$/, '')
  : (() => {
      const base = CONVEX_URL.replace('https://', '').replace('.convex.cloud', '');
      return `https://${base}.convex.site`;
    })();

const getConvexSiteBaseUrl = () => CONVEX_SITE_BASE;

const DEFAULT_SYSTEM_INSTRUCTION =
  'You are Shard, an expert AI assistant. Be concise and helpful. Always provide clear, accurate information and assist the user to the best of your ability.'
const DEFAULT_MODEL = 'nvidia/nemotron-nano-12b-v2-vl:free';

// ——— Title bar (shared) ———
const TitleBar = ({ onClose }) => (
  <div className="chat-title-bar">
    <img src={crystalIcon} alt="" className="chat-title-icon" />
    <span className="chat-title-text">Shard</span>
    <button className="chat-close-button" onClick={onClose} aria-label="Close chat">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  </div>
);

const ChatView = () => {
  // State
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [subscriptionRequired, setSubscriptionRequired] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [stripePlans, setStripePlans] = useState({ monthly: null, yearly: null });
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [presets, setPresets] = useState({});

  // Refs
  const convex = useRef(new ConvexClient(CONVEX_URL));
  const conversationContext = useRef([]);
  const sessionOptionsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

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
    if (!firstWord || !presetsMap || Object.keys(presetsMap).length === 0) {
      return { options: base, presetMatched: false };
    }
    const key = Object.keys(presetsMap).find(
      (k) => k.toLowerCase() === firstWord.toLowerCase()
    );
    if (!key) {
      return { options: base, presetMatched: false };
    }
    const p = presetsMap[key];
    const systemInstructionRaw = p.systemInstruction ?? p.system_instruction;
    const systemInstruction =
      systemInstructionRaw != null && String(systemInstructionRaw).trim() !== ''
        ? String(systemInstructionRaw).trim()
        : DEFAULT_SYSTEM_INSTRUCTION;
    return {
      options: {
        ...base,
        systemInstruction,
        temperature: p.temperature != null ? p.temperature : 0.7,
        maxTokens: p.maxTokens != null ? p.maxTokens : 4096,
        topP: p.topP != null ? p.topP : 0.95,
        frequencyPenalty: p.frequencyPenalty != null ? p.frequencyPenalty : 0.0,
        presencePenalty: p.presencePenalty != null ? p.presencePenalty : 0.3,
        stop: p.stop != null ? p.stop : undefined,
      },
      presetMatched: true,
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

  const fetchStripePlans = async () => {
    try {
      const res = await fetch(`${getConvexSiteBaseUrl()}/stripe/plans`);
      const data = await res.json().catch(() => ({}));
      setStripePlans({
        monthly: data.monthly || null,
        yearly: data.yearly || null,
      });
    } catch (err) {
      console.error('Failed to fetch Stripe plans:', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated === true) {
      fetchStripePlans();
    }
  }, [isAuthenticated]);

  const startCheckout = async (priceId) => {
    if (!priceId) return;
    if (!authToken) return;

    setCheckoutLoading(true);
    try {
      const res = await fetch(`${getConvexSiteBaseUrl()}/stripe/create-checkout-session-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const url = data.url;
      if (!url) throw new Error('No checkout URL returned.');

      if (window.electronAPI?.openExternal) {
        await window.electronAPI.openExternal(url);
      } else {
        window.location.href = url;
      }
    } catch (err) {
      console.error('Failed to start checkout:', err);
      alert(err instanceof Error ? err.message : 'Failed to start checkout');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const hasActiveSubscription = async () => {
    const user = await convex.current.query(api.auth.getUser, {});
    const workosId = user?.id;
    const email = user?.email;

    if (!workosId) {
      return { active: false, reason: 'No user id found for this account.' };
    }

    const sub = await convex.current.query(api.subscriptions.getByWorkosId, { workosId });
    const status = sub?.status;
    const active = status === 'active' || status === 'trialing';
    return { active, status, email, workosId };
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

  const askOpenRouterStream = async (message, files, model, options, onChunk, isRetry = false) => {
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
          model,
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
            // Retry the request with the new token
            return askOpenRouterStream(message, files, model, options, onChunk, true);
          }
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

  const askOpenRouterComplete = async (message, files, model, options, isRetry = false) => {
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
          model,
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
        if (refreshed) return askOpenRouterComplete(message, files, model, options, true);
      }
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return { content: data.content ?? '' };
  };

  const getAIResponse = async (userMessage, files = []) => {
    // Enforce subscription before calling the AI
    try {
      const sub = await hasActiveSubscription();
      if (!sub.active) {
        setSubscriptionRequired(true);
        return;
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
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
        sessionOptionsRef.current = { ...result, presetMatched: false };
      }
      const options = sessionOptionsRef.current.options || sessionOptionsRef.current;

      setMessages(prev => prev.map(msg =>
        msg.id === aiMessageId ? { ...msg, text: '' } : msg
      ));

      let contentToUse = '';
      let requestError = null;
      const tryComplete = async () => {
        const complete = await askOpenRouterComplete(messageToSend, files, DEFAULT_MODEL, options);
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
          
          // Store in conversation context
          conversationContext.current = [{ text: initialMessage, sender: 'user' }];
          
          // Only get AI response if authenticated
          // We check after a short delay to allow auth state to settle
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    return (
      <div className="chat-view">
        <TitleBar onClose={handleClose} />
        <div className="chat-auth-container">
          <div className="chat-auth-content">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="7" r="4"></circle>
              <path d="M5.5 21a8.38 8.38 0 0 1 13 0"></path>
            </svg>
            <h2>Sign in to continue</h2>
            <p>Please log in to use Shard</p>
            <button className="chat-login-button" onClick={handleLogin}>
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (subscriptionRequired) {
    return (
      <div className="chat-view">
        <TitleBar onClose={handleClose} />
        <div className="chat-auth-container">
          <div className="chat-auth-content">
            <h2>Subscription required</h2>
            <p>Please subscribe to continue using AI features.</p>

            <button
              className="chat-login-button"
              onClick={() => startCheckout(stripePlans.monthly)}
              disabled={checkoutLoading || !stripePlans.monthly}
            >
              {checkoutLoading ? 'Opening Checkout...' : 'Subscribe (Monthly)'}
            </button>

            <button
              className="chat-login-button"
              onClick={() => startCheckout(stripePlans.yearly)}
              disabled={checkoutLoading || !stripePlans.yearly}
              style={{ marginTop: 10 }}
            >
              {checkoutLoading ? 'Opening Checkout...' : 'Subscribe (Yearly)'}
            </button>

            <button
              className="chat-close-button"
              onClick={async () => {
                setSubscriptionRequired(false);
                await getAIResponse(messages[0]?.text || '');
              }}
              style={{ marginTop: 16 }}
            >
              I already subscribed (retry)
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isAuthenticated === null) {
    return (
      <div className="chat-view">
        <TitleBar onClose={handleClose} />
        <div className="chat-auth-container">
          <div className="chat-auth-content">
            <div className="chat-loading-spinner"></div>
            <p>Checking authentication...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-view">
      <TitleBar onClose={handleClose} />
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">Start a conversation...</div>
        ) : (
          <>
            {messages.map((msg) => (
              <div key={msg.id} className={`message message-${msg.sender}`}>
                <div className="message-bubble">
                  {msg.images && msg.images.length > 0 && (
                    <div className="message-images">
                      {msg.images.map((img, idx) => (
                        <div key={idx} className="message-image-container">
                          {msg.files && msg.files[idx]?.type === 'application/pdf' ? (
                            <div className="message-pdf-preview">
                              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                <polyline points="10 9 9 9 8 9"></polyline>
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
                <div className="message-time">{formatTime(msg.timestamp)}</div>
              </div>
            ))}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {attachedFiles.length > 0 && (
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
          type="file"
          ref={fileInputRef}
          className="chat-file-input"
          accept="image/*,application/pdf"
          multiple
          onChange={handleFileSelect}
          aria-label="Attach file"
        />
        <button
          type="button"
          className="chat-attach-button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          aria-label="Attach file"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
          </svg>
        </button>
        <input
          type="text"
          className="chat-input-field"
          placeholder="Type your message..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={isLoading}
          autoFocus
        />
        <button
          type="submit"
          className="chat-input-submit"
          disabled={(!inputValue.trim() && attachedFiles.length === 0) || isLoading}
          aria-label="Send message"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>
    </div>
  );
};

export default ChatView;
