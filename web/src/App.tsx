import { Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Home from './pages/Home'
import About from './pages/About'
import Blog from './pages/Blog'
import Article from './pages/Article'
import Contact from './pages/Contact'
import AppChat from './pages/AppChat'
import AuthCallback from './pages/AuthCallback'
import Account from './pages/Account'
import Billing from './pages/Billing'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <Routes>
      <Route path="app" element={<AppChat />} />
      <Route path="auth/callback" element={<AuthCallback />} />
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="account" element={<Account />} />
        <Route path="account/billing" element={<Billing />} />
        <Route path="about" element={<About />} />
        <Route path="blog" element={<Blog />} />
        <Route path="blog/:slug" element={<Article />} />
        <Route path="contact" element={<Contact />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
