import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthSessionProvider } from './auth/AuthSessionProvider'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <AuthSessionProvider>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </AuthSessionProvider>,
)
