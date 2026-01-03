// View: Chat display UI
import { useState, useEffect, useRef } from 'react';
import { ConvexClient } from 'convex/browser';
import { api } from '../../../backend/convex/_generated/api';
import './ChatView.css';

const ChatView = () => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);
  const conversationContext = useRef([]); // Store conversation history for context
  
  // Initialize Convex client
  // TODO: Replace with your actual Convex deployment URL
  // You can get this from: backend/.env.local or Convex dashboard
  // NOTE: The Convex action requires authentication. You'll need to set up auth tokens
  // For Electron, you may need to use setAuth() method on the ConvexClient
  // Example: convex.current.setAuth("your-auth-token")
  const CONVEX_URL = 'https://elegant-greyhound-73.convex.cloud';
  const convex = useRef(new ConvexClient(CONVEX_URL));

  // Function to call OpenRouter API via Convex
  const askOpenRouter = async (message, model = 'mistralai/devstral-2512:free', options = {}) => {
    // Build messages array with conversation context
    const contextMessages = conversationContext.current.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text
    }));
    
    // Add current message
    contextMessages.push({
      role: 'user',
      content: message
    });

    // Call Convex action
    const response = await convex.current.action(api.openrouter.sendMessage, {
      messages: contextMessages,
      model,
      systemInstruction: options.systemInstruction,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      topP: options.topP,
      frequencyPenalty: options.frequencyPenalty,
      presencePenalty: options.presencePenalty,
      stop: options.stop,
      stream: options.stream,
    });

    return response;
  };

  // Get AI response for a message
  const getAIResponse = async (userMessage) => {
    setIsLoading(true);
    try {
      const response = await askOpenRouter(
        userMessage,
        'mistralai/devstral-2512:free',
        {
          systemInstruction: 'You are a helpful assistant.',
          temperature: 0.7,
          maxTokens: 500,
        }
      );

      // Add AI response to messages
      const aiMessage = {
        id: Date.now() + 1,
        text: response.content,
        sender: 'ai',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
      
      // Update conversation context with the full conversation history from response
      // The Convex action returns updated messages including the new assistant response
      if (response.messages) {
        conversationContext.current = response.messages.map(msg => ({
          text: msg.content,
          sender: msg.role === 'user' ? 'user' : msg.role === 'assistant' ? 'ai' : 'system'
        }));
      } else {
        // Fallback to manual update if messages not provided
        conversationContext.current = [
          ...conversationContext.current,
          { text: userMessage, sender: 'user' },
          { text: response.content, sender: 'ai' }
        ];
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      // Add error message
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
          
          // Get AI response
          getAIResponse(initialMessage);
        }
      } catch (error) {
        console.error('Error parsing message data:', error);
      }
    }
  }, []);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleClose = () => {
    if (window.electronAPI && window.electronAPI.closeMessageWindow) {
      window.electronAPI.closeMessageWindow();
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const messageText = inputValue.trim();
    
    if (!messageText || isLoading) return;
    
    // Clear input immediately
    setInputValue('');
    
    // Add user message to UI
    const userMessage = {
      id: Date.now(),
      text: messageText,
      sender: 'user',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // Update conversation context
    conversationContext.current = [
      ...conversationContext.current,
      { text: messageText, sender: 'user' }
    ];
    
    // Get AI response
    await getAIResponse(messageText);
  };

  return (
    <div className="chat-view">
      <div className="chat-title-bar">
        <span className="chat-title-text">12345</span>
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
                <div className="message-bubble">{msg.text}</div>
                <div className="message-time">{formatTime(msg.timestamp)}</div>
              </div>
            ))}
            {isLoading && (
              <div className="message message-ai">
                <div className="message-bubble message-loading">
                  <span className="loading-dots">Thinking</span>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <form className="chat-input-container" onSubmit={handleSubmit}>
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
          disabled={!inputValue.trim() || isLoading}
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
