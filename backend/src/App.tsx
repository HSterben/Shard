import { Routes, Route, Link } from 'react-router-dom';
import { Authenticated, Unauthenticated } from 'convex/react';
import { useAuth } from '@workos-inc/authkit-react';
import './landing.css';

const DOWNLOAD_URL = import.meta.env.VITE_DOWNLOAD_URL as string | undefined;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MainPage />} />
      <Route path="/app" element={<AppShell />} />
    </Routes>
  );
}

function MainPage() {
  const hasDownload = Boolean(DOWNLOAD_URL?.trim());

  return (
    <div className="landing-theme">
      <nav className="landing-nav">
        <div className="landing-nav-logo">
          Sh<span>ard</span>
        </div>
        <div className="landing-nav-links">
          <a href="#features">Features</a>
          <Link to="/app">Sign in</Link>
        </div>
      </nav>

      <section className="landing-hero">
        <h1>
          AI chat that lives <span className="accent">on your desktop</span>
        </h1>
        <p>
          Shard is a minimal, always-available assistant. Global shortcut, markdown replies,
          and first-word presets so you can tailor the AI in one tap.
        </p>
        {hasDownload ? (
          <a
            href={DOWNLOAD_URL}
            className="landing-cta"
            target="_blank"
            rel="noopener noreferrer"
            download
          >
            <DownloadIcon />
            Download for Windows
          </a>
        ) : (
          <span
            className="landing-cta landing-cta-placeholder"
            title="Set VITE_DOWNLOAD_URL to your installer URL (e.g. GitHub Releases or /downloads/Shard-Setup.exe)"
          >
            <DownloadIcon />
            Download for Windows
          </span>
        )}
      </section>

      <section id="features" className="landing-features">
        <h2>What you get</h2>
        <div className="landing-features-grid">
          <div className="landing-feature-card">
            <h3>Always on call</h3>
            <p>Global hotkey brings the chat bubble from anywhere—no need to leave your flow.</p>
          </div>
          <div className="landing-feature-card">
            <h3>Markdown & presets</h3>
            <p>Rich replies and first-word triggers (e.g. "Simplify") to lock in tone and behavior.</p>
          </div>
          <div className="landing-feature-card">
            <h3>Your data, your rules</h3>
            <p>Presets live in a simple JSON file you can edit, export, or reset to default.</p>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <p>
          Built with Convex and OpenRouter. Set <code>VITE_DOWNLOAD_URL</code> to your hosted
          installer URL to enable the download button.
        </p>
      </footer>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function AppShell() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-light dark:bg-dark p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        <Link to="/">Shard</Link>
        <AuthButton />
      </header>
      <main className="p-8 flex flex-col gap-16">
        <h1 className="text-4xl font-bold text-center">Convex + React + WorkOS AuthKit</h1>
        <Authenticated>
          <Content />
        </Authenticated>
        <Unauthenticated>
          <div className="flex flex-col gap-8 w-96 mx-auto">
            <p>Log in to see the numbers</p>
            <AuthButton />
          </div>
        </Unauthenticated>
      </main>
    </>
  );
}

function AuthButton() {
  const { user, signIn, signOut } = useAuth();

  if (user) {
    return (
      <button
        onClick={() => signOut()}
        className="bg-dark dark:bg-light text-light dark:text-dark text-sm px-4 py-2 rounded-md border-2"
      >
        Sign out
      </button>
    );
  }

  return (
    <button
      onClick={() => void signIn()}
      className="bg-dark dark:bg-light text-light dark:text-dark text-sm px-4 py-2 rounded-md border-2"
    >
      Sign in
    </button>
  );
}

function Content() {
  const { user } = useAuth();
  const displayName = user?.firstName ?? user?.email ?? 'there';

  return (
    <div className="flex flex-col gap-8 max-w-lg mx-auto">
      <p>Welcome, {displayName}!</p>
      <p>
        You’re signed in. Use the Shard desktop app for AI chat, or head back to the landing page
        to download it.
      </p>
      <p>
        <Link
          to="/"
          className="inline-block bg-dark dark:bg-light text-light dark:text-dark text-sm px-4 py-2 rounded-md border-2"
        >
          Back to Shard
        </Link>
      </p>
    </div>
  );
}
