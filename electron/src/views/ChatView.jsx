// View: Chat display UI
import { useState, useEffect, useRef } from 'react';
import './ChatView.css';

const ChatView = () => {
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Get initial message from URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const encodedData = urlParams.get('data');
    
    if (encodedData) {
      try {
        const data = JSON.parse(decodeURIComponent(encodedData));
        const initialMessage = data.message || '';
        
        if (initialMessage) {
          setMessages([{
            id: Date.now(),
            text: initialMessage,
            sender: 'user',
            timestamp: new Date()
          }]);
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
          messages.map((msg) => (
            <div key={msg.id} className={`message message-${msg.sender}`}>
              <div className="message-bubble">{msg.text}</div>
              <div className="message-time">{formatTime(msg.timestamp)}</div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default ChatView;

