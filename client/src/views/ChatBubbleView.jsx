// View: Chat bubble input UI
import {useState, useEffect} from 'react'
import MessageController from '../controllers/MessageController'
import '../index.css'

const ChatBubbleView = () => {
  const [message, setMessage] = useState('')
  const [sizeMultiplier, setSizeMultiplier] = useState(1)
  const messageController = new MessageController()

  // Calculate size multiplier based on window width (base: 420px)
  useEffect(() => {
    const updateSizeMultiplier = () => {
      const baseWidth = 420
      const currentWidth = window.innerWidth
      const multiplier = currentWidth / baseWidth
      setSizeMultiplier(multiplier)
      document.documentElement.style.setProperty('--size-multiplier', multiplier.toString())
    }

    updateSizeMultiplier()
    window.addEventListener('resize', updateSizeMultiplier)
    return () => window.removeEventListener('resize', updateSizeMultiplier)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (message.trim()) {
      const messageText = message.trim()
      setMessage('') // Clear input immediately
      
      // Send message via controller
      await messageController.sendMessage(messageText)
    }
  }

  return (
    <div className="chat-container">
      <form className="chat-bubble" onSubmit={handleSubmit}>
        <input
          type="text"
          className="chat-input"
          placeholder="Ask anything..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          autoFocus
        />
        <button 
          type="submit" 
          className="chat-send-button"
          disabled={!message.trim()}
          aria-label="Send"
        >
          <svg 
            width={16 * sizeMultiplier} 
            height={16 * sizeMultiplier} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>
    </div>
  )
}

export default ChatBubbleView


