import {createRoot} from 'react-dom/client'
import { initTheme } from './hooks/useTheme'
import ChatBubbleView from './views/ChatBubbleView'

initTheme()

const container = document.getElementById('root')
const root = createRoot(container)
root.render(<ChatBubbleView />)
