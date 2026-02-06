import { Link } from 'react-router-dom';
import './landing.css';

const DOWNLOAD_URL = import.meta.env.VITE_DOWNLOAD_URL as string | undefined;

export default function LandingPage() {
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
            <p>Rich replies and first-word triggers (e.g. “Simplify”) to lock in tone and behavior.</p>
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
