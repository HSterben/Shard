// Main renderer entry point - Chat Bubble View
import {createRoot} from 'react-dom/client'
import ChatBubbleView from './views/ChatBubbleView'

const container = document.getElementById('root')
const root = createRoot(container)
root.render(<ChatBubbleView />)