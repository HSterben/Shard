// Main renderer entry point - Chat View
import { createRoot } from 'react-dom/client';
import ChatView from './views/ChatView';

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<ChatView />);

