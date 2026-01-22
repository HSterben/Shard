// View: Chat bubble input UI
import {useState, useEffect, useRef} from 'react'
import MessageController from '../controllers/MessageController'
import '../index.css'

const ChatBubbleView = () => {
  const [message, setMessage] = useState('')
  const [sizeMultiplier, setSizeMultiplier] = useState(1)
  const [attachedFiles, setAttachedFiles] = useState([]) // Array of { file, dataUrl, type, name }
  const messageController = new MessageController()

  // Helper function to convert file to base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

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
    };

    // Add paste event listener to the document
    document.addEventListener('paste', handlePaste);
    
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [])

  const removeFile = (index) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault()
    const messageText = message.trim()
    
    // Send message if there's text or attached files
    if (messageText || attachedFiles.length > 0) {
      // Store files for this message
      const filesToSend = [...attachedFiles]
      
      // Clear input and files immediately
      setMessage('')
      setAttachedFiles([])
      
      // Send message with image count indicator
      // Note: Full image data would cause 431 errors (header too large)
      // For now, just send text with image count
      if (filesToSend.length > 0) {
        const imageNote = `[${filesToSend.length} image(s) attached]`
        await messageController.sendMessage(messageText ? `${messageText} ${imageNote}` : imageNote)
      } else {
        await messageController.sendMessage(messageText)
      }
    }
  }

  return (
    <div className="chat-container">
      <form className="chat-bubble" onSubmit={handleSubmit}>
        {attachedFiles.length > 0 && (
          <div className="chat-bubble-attachment-badge">
            +{attachedFiles.length}
            <button
              type="button"
              className="chat-bubble-attachment-remove-badge"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setAttachedFiles([]);
              }}
              aria-label="Remove all attachments"
              title={`Remove ${attachedFiles.length} attachment(s)`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        )}
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
          disabled={!message.trim() && attachedFiles.length === 0}
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


