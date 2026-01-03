// View: Chat display UI
import { useState, useEffect, useRef } from 'react';
import './ChatView.css';

const ChatView = () => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const conversationContext = useRef([]); // Store conversation history for context

  // Function to call OpenRouter API
  const askOpenRouter = async (message, model = 'mistralai/devstral-2512:free', options = {}) => {
    const apiUrl = 'http://localhost:3000';
    
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

    const requestBody = {
      messages: contextMessages,
      model,
      ...options,
    };

    const response = await fetch(`${apiUrl}/api/openrouter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
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
      
      // Update conversation context
      conversationContext.current = [
        ...conversationContext.current,
        { text: userMessage, sender: 'user' },
        { text: response.content, sender: 'ai' }
      ];
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

  return (
    <div className="chat-view">
      <div className="chat-title-bar">
        <span className="chat-title-text">12345</span>
      </div>
      <header className="chat-header">
        <div className="chat-header-title">
          <div className="chat-header-logo">S</div>
          <span className="chat-header-text">Shard</span>
        </div>
        <button 
          className="chat-close-button"
          onClick={handleClose}
          aria-label="Close chat"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </header>
      
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
    </div>
  );
};

export default ChatView;
