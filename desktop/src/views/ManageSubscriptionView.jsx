import { useState, useEffect, useRef, useCallback } from "react";
import { ConvexClient } from "convex/browser";
import { api } from "../../../backend/convex/_generated/api";
import TitleBar from "../components/TitleBar";
import { convexUrl } from "../lib/convexUrls";
import "./SettingsView.css";
import "./ManageSubscriptionView.css";

const api_ = typeof window !== "undefined" ? window.electronAPI : null;

const CONVEX_URL = convexUrl;

function formatDate(ms) {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatQuota(used, limit) {
  if (!limit) return "—";
  const pct = Math.min(100, Math.round((used / limit) * 100));
  return `${pct}% used this period`;
}

export default function ManageSubscriptionView() {
  const convex = useRef(new ConvexClient(CONVEX_URL));
  const [authToken, setAuthToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const showMessage = (text, isError = false) => {
    setMessage({ text, isError });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadAccount = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const data = await convex.current.query(api.account.getMyAccount, {});
      setAccount(data);
    } catch (err) {
      console.error("Failed to load account:", err);
      showMessage("Could not load account details.", true);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    const init = async () => {
      if (!api_) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
      try {
        const token = await api_.getAuthToken();
        if (token) {
          setAuthToken(token);
          convex.current.setAuth(async () => token);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
          setLoading(false);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        setIsAuthenticated(false);
        setLoading(false);
      }
    };
    init();

    api_?.onAuthSuccess?.((data) => {
      if (data.token) {
        setAuthToken(data.token);
        convex.current.setAuth(async () => data.token);
        setIsAuthenticated(true);
      } else {
        setAuthToken(null);
        convex.current.clearAuth();
        setIsAuthenticated(false);
        setAccount(null);
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadAccount();
  }, [isAuthenticated, loadAccount]);

  const openWebsiteBilling = async () => {
    const base = (account?.websiteUrl || "http://localhost:5173").replace(/\/$/, "");
    await api_?.openExternal?.(`${base}/account/billing`);
  };

  const status = account?.status || "none";
  const badgeClass = status === "none" ? "canceled" : status.replace(/ /g, "_");

  if (!api_) {
    return (
      <div className="settings-view">
        <p style={{ padding: 24 }}>Account details are only available in the Electron app.</p>
      </div>
    );
  }

  return (
    <div className="settings-view">
      <TitleBar title="Account" onClose={() => api_?.closeWindow?.()} />

      <div className="settings-scroll">
        {message && (
          <div className={`settings-message ${message.isError ? "error" : ""}`}>{message.text}</div>
        )}

        {isAuthenticated === null || (isAuthenticated && loading) ? (
          <div className="subscription-loading">
            <div className="subscription-spinner" />
            <span>Loading account…</span>
          </div>
        ) : !isAuthenticated ? (
          <div className="subscription-auth-prompt">
            <h2>Sign in required</h2>
            <p>Log in to see your PROXY X subscription and usage.</p>
            <button type="button" className="settings-btn primary" onClick={() => api_?.openLogin?.()}>
              Sign in
            </button>
          </div>
        ) : (
          <>
            <section className="settings-section">
              <h2>Your account</h2>
              <p className="settings-hint">
                Subscribe, upgrade, or cancel on the PROXY X website. This app only reads your account state.
              </p>

              <div className="subscription-status-card">
                <div className="subscription-status-row">
                  <span className="subscription-status-label">Status</span>
                  <span className={`subscription-badge ${badgeClass}`}>
                    {status === "none" ? "Not subscribed" : status.replace(/_/g, " ")}
                  </span>
                </div>
                {account?.email && (
                  <div className="subscription-status-row">
                    <span className="subscription-status-label">Account</span>
                    <span className="subscription-status-value">{account.email}</span>
                  </div>
                )}
                {account?.plan && (
                  <div className="subscription-status-row">
                    <span className="subscription-status-label">Plan</span>
                    <span className="subscription-status-value">{account.plan}</span>
                  </div>
                )}
                {account?.currentPeriodEnd && account.subscriptionActive && (
                  <div className="subscription-status-row">
                    <span className="subscription-status-label">Renews on</span>
                    <span className="subscription-status-value">
                      {formatDate(account.currentPeriodEnd)}
                    </span>
                  </div>
                )}
                {account && (
                  <div className="subscription-status-row">
                    <span className="subscription-status-label">Usage</span>
                    <span className="subscription-status-value">
                      {formatQuota(account.weightedTokensUsed, account.weightedTokenLimit)}
                    </span>
                  </div>
                )}
              </div>

              <div className="subscription-actions">
                <button type="button" className="settings-btn primary" onClick={openWebsiteBilling}>
                  Manage on website
                </button>
                <button type="button" className="settings-btn" onClick={loadAccount} disabled={loading}>
                  Refresh
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
