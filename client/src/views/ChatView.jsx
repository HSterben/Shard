// View: Chat display UI
import { useState, useEffect, useRef } from 'react';
import { ConvexClient } from 'convex/browser';
import { api } from '../../../backend/convex/_generated/api';
import './ChatView.css';

const ChatView = () => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(null); // null = checking, true/false = known
  const [authToken, setAuthToken] = useState(null);
  const [attachedFiles, setAttachedFiles] = useState([]); // Array of { file, dataUrl, type }
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const conversationContext = useRef([]); // Store conversation history for context
  
  // Initialize Convex client
  const CONVEX_URL = 'https://elegant-greyhound-73.convex.cloud';
  const convex = useRef(new ConvexClient(CONVEX_URL));

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await window.electronAPI.getAuthToken();
        if (token) {
          setAuthToken(token);
          // setAuth expects a function that returns the token
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

    // Listen for auth error events
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
    // Refresh failed - user needs to log in again
    setIsAuthenticated(false);
    return false;
  };

  // Helper function to convert file to base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Helper function to convert PDF to image (simplified - shows placeholder)
  // Note: For full PDF support, consider using pdf.js library
  const pdfToImage = async (file) => {
    // For now, we'll create a placeholder image for PDFs
    // In production, you might want to use pdf.js to render PDF pages as images
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

  // Function to call OpenRouter API with streaming
  const askOpenRouterStream = async (message = '', files = [], model = 'nvidia/nemotron-nano-12b-v2-vl:free', options = {}, onChunk, isRetry = false) => {
    // Build messages array with conversation context
    const contextMessages = conversationContext.current.map(msg => {
      if (msg.images && msg.images.length > 0) {
        // Handle multimodal message with images
        const content = [{ type: 'text', text: msg.text }];
        msg.images.forEach(img => {
          content.push({
            type: 'image_url',
            image_url: { url: img }
          });
        });
        return {
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: content
        };
      }
      return {
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      };
    });
    
    // Build current message with images if any
    let currentMessageContent;
    if (files.length > 0) {
      currentMessageContent = [{ type: 'text', text: message || '' }];
      for (const fileData of files) {
        currentMessageContent.push({
          type: 'image_url',
          image_url: { url: fileData.dataUrl }
        });
      }
    } else {
      currentMessageContent = message;
    }
    
    // Add current message
    contextMessages.push({
      role: 'user',
      content: currentMessageContent
    });

    try {
      // Ensure we have auth token
      if (!authToken) {
        throw new Error('Authentication token not available. Please log in.');
      }

      // Get Convex URL and auth token
      const convexUrl = CONVEX_URL.replace('https://', '').replace('.convex.cloud', '');
      const streamUrl = `https://${convexUrl}.convex.site/openrouter/stream`;
      
      console.log('Calling streaming endpoint:', streamUrl);
      
      // Call streaming endpoint
      const response = await fetch(streamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          messages: contextMessages,
          model,
          systemInstruction: 'Start every sentence with "Hey, I\'m Shard, your personal assistant."',
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
          console.log('Auth error detected in stream, attempting token refresh...');
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return {
                content: fullContent,
                id: messageId,
                finishReason: finishReason || 'stop',
              };
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;
              
              if (delta?.content) {
                fullContent += delta.content;
                onChunk(delta.content); // Call the callback with each chunk
              }

              if (parsed.id) messageId = parsed.id;
              if (parsed.choices?.[0]?.finish_reason) {
                finishReason = parsed.choices[0].finish_reason;
              }
            } catch (e) {
              // Skip invalid JSON
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

  // Function to call OpenRouter API via Convex (non-streaming, kept for fallback)
  const askOpenRouter = async (message = '', files = [], model = 'nvidia/nemotron-nano-12b-v2-vl:free', options = {}, isRetry = false) => {
    // Build messages array with conversation context
    const contextMessages = conversationContext.current.map(msg => {
      if (msg.images && msg.images.length > 0) {
        // Handle multimodal message with images
        const content = [{ type: 'text', text: msg.text }];
        msg.images.forEach(img => {
          content.push({
            type: 'image_url',
            image_url: { url: img }
          });
        });
        return {
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: content
        };
      }
      return {
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      };
    });
    
    // Build current message with images if any
    let currentMessageContent;
    if (files.length > 0) {
      currentMessageContent = [{ type: 'text', text: message || '' }];
      for (const fileData of files) {
        currentMessageContent.push({
          type: 'image_url',
          image_url: { url: fileData.dataUrl }
        });
      }
    } else {
      currentMessageContent = message;
    }
    
    // Add current message
    contextMessages.push({
      role: 'user',
      content: currentMessageContent
    });

    try {
      // Call Convex action
      const response = await convex.current.action(api.openrouter.sendMessage, {
        messages: contextMessages,
        model,
        systemInstruction: 'Start every sentence with "Hey, I\'m Shard, your personal assistant."',
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        topP: options.topP,
        frequencyPenalty: options.frequencyPenalty,
        presencePenalty: options.presencePenalty,
        stop: options.stop,
        stream: options.stream,
      });

      return response;
    } catch (error) {
      // Check if it's an authentication error and we haven't retried yet
      if (!isRetry && error.message && error.message.includes('Authentication required')) {
        console.log('Auth error detected, attempting token refresh...');
        const refreshed = await refreshAndRetry();
        if (refreshed) {
          // Retry the request with the new token
          return askOpenRouter(message, files, model, options, true);
        }
      }
      // Re-throw if not an auth error or retry failed
      throw error;
    }
  };

  // Get AI response for a message with streaming
  const getAIResponse = async (userMessage, files = []) => {
    setIsLoading(true);
    
    // Create a placeholder message that we'll update as we stream
    const aiMessageId = Date.now() + 1;
    const aiMessage = {
      id: aiMessageId,
      text: ' ',
      sender: 'ai',
      timestamp: new Date(),
      isStreaming: true
    };

    // Add placeholder message immediately
    setMessages(prev => [...prev, aiMessage]);

    try {
      let fullContent = '';
      
      const response = await askOpenRouterStream(
        userMessage,
        files,
        'nvidia/nemotron-nano-12b-v2-vl:free',
        {
          temperature: 0.7,
          maxTokens: 500,
        },
        (chunk) => {
          // Update message as chunks arrive
          fullContent += chunk;
          setMessages(prev => prev.map(msg => 
            msg.id === aiMessageId 
              ? { ...msg, text: fullContent }
              : msg
          ));
        }
      );

      // Finalize the message
      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId 
          ? { ...msg, text: response.content || fullContent, isStreaming: false }
          : msg
      ));
      
      // Update conversation context
      const finalContent = response.content || fullContent;
      conversationContext.current = [
        ...conversationContext.current,
        { 
          text: userMessage, 
          sender: 'user',
          images: files.length > 0 ? files.map(f => f.dataUrl) : undefined
        },
        { text: finalContent, sender: 'ai' }
      ];
    } catch (error) {
      console.error('Error getting AI response:', error);
      // Remove the streaming message and add error message
      setMessages(prev => prev.filter(msg => msg.id !== aiMessageId));
      const errorMessage = {
        id: Date.now() + 1,
        text: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Get initial message from URL query parameter
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
    // Scroll to bottom when messages change (including during streaming)
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle clipboard paste for images
  useEffect(() => {
    const handlePaste = async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      // Look for image in clipboard
      let hasImage = false;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // Check if it's an image
        if (item.type.indexOf('image') !== -1) {
          hasImage = true;
          e.preventDefault(); // Prevent default paste behavior for images
          
          const file = item.getAsFile();
          if (!file) continue;

          try {
            // Convert to base64
            const dataUrl = await fileToBase64(file);
            
            // Create a file data object
            const fileData = {
              file,
              dataUrl,
              type: file.type,
              name: `pasted-image-${Date.now()}.${file.type.split('/')[1] || 'png'}`
            };

            // Add to attached files
            setAttachedFiles(prev => [...prev, fileData]);
          } catch (error) {
            console.error('Error pasting image:', error);
          }
          break; // Only handle the first image found
        }
      }

      // If no image was found, allow normal paste behavior (text, etc.)
      // This happens automatically if we don't preventDefault
    };

    // Add paste event listener to the document
    // This will capture paste events anywhere in the chat view
    document.addEventListener('paste', handlePaste);
    
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, []);

  const handleClose = () => {
    if (window.electronAPI && window.electronAPI.closeMessageWindow) {
      window.electronAPI.closeMessageWindow();
    }
  };

  const handleLogin = () => {
    if (window.electronAPI && window.electronAPI.openLogin) {
      window.electronAPI.openLogin();
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

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

  // Show login screen if not authenticated
  if (isAuthenticated === false) {
    return (
      <div className="chat-view">
        <div className="chat-title-bar">
          <span className="chat-title-text">Shard</span>
          <button 
            className="chat-close-button"
            onClick={handleClose}
            aria-label="Close chat"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
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

  // Show loading state while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="chat-view">
        <div className="chat-title-bar">
          <span className="chat-title-text">Shard</span>
          <button 
            className="chat-close-button"
            onClick={handleClose}
            aria-label="Close chat"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
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
      <div className="chat-title-bar">
        <span className="chat-title-text">Shard</span>
        <button 
          className="chat-close-button"
          onClick={handleClose}
          aria-label="Close chat"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
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
                  {msg.text && (
                    <div className="message-text">
                      {msg.text}
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
