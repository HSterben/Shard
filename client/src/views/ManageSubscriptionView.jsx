import { useState, useEffect, useRef, useCallback } from "react";
import { ConvexClient } from "convex/browser";
import { api } from "../../../backend/convex/_generated/api";
import "./SettingsView.css";
import "./ManageSubscriptionView.css";
import crystalIcon from "../icon/crystal.png";

const api_ = typeof window !== "undefined" ? window.electronAPI : null;

const CONVEX_URL = "https://strong-poodle-712.convex.cloud";
const CONVEX_SITE_BASE =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_CONVEX_SITE_URL
    ? import.meta.env.VITE_CONVEX_SITE_URL.replace(/\/$/, "")
    : (() => {
        const base = CONVEX_URL.replace("https://", "").replace(".convex.cloud", "");
        return `https://${base}.convex.site`;
      })();

function formatDate(ms) {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function planLabel(priceId, plans) {
  if (!priceId) return "—";
  if (plans.monthly && priceId === plans.monthly) return "Monthly";
  if (plans.yearly && priceId === plans.yearly) return "Yearly";
  return "Subscription";
}

function statusDescription(status) {
  switch (status) {
    case "active":
      return "Your subscription is active. You can cancel anytime — access continues until the end of the billing period.";
    case "trialing":
      return "You are on a trial. Manage billing to cancel before the trial ends.";
    case "past_due":
      return "Payment failed. Update your payment method to restore access.";
    case "canceled":
      return "Your subscription has ended. Subscribe again to use AI features.";
    case "pending":
      return "Checkout is in progress or waiting for confirmation. If you just paid, refresh in a moment.";
    default:
      return "Manage billing to update payment details or cancel your subscription.";
  }
}

export default function ManageSubscriptionView() {
  const convex = useRef(new ConvexClient(CONVEX_URL));
  const [authToken, setAuthToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [stripePlans, setStripePlans] = useState({ monthly: null, yearly: null });
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const showMessage = (text, isError = false) => {
    setMessage({ text, isError });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadSubscription = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const user = await convex.current.query(api.auth.getUser, {});
      setUserEmail(user?.email || null);
      const workosId = user?.id;
      if (!workosId) {
        setSubscription(null);
        return;
      }
      const sub = await convex.current.query(api.subscriptions.getByWorkosId, { workosId });
      setSubscription(sub);
    } catch (err) {
      console.error("Failed to load subscription:", err);
      showMessage("Could not load subscription details.", true);
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
        setSubscription(null);
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetch(`${CONVEX_SITE_BASE}/stripe/plans`)
        .then((res) => res.json())
        .then((data) =>
          setStripePlans({ monthly: data.monthly || null, yearly: data.yearly || null })
        )
        .catch((err) => console.error("Failed to fetch plans:", err));
      loadSubscription();
    }
  }, [isAuthenticated, loadSubscription]);

  const openPortal = async () => {
    if (!authToken) return;
    setPortalLoading(true);
    try {
      const res = await fetch(`${CONVEX_SITE_BASE}/stripe/create-portal-session-auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (!data.url) throw new Error("No portal URL returned.");
      await api_?.openExternal?.(data.url);
    } catch (err) {
      console.error("Failed to open billing portal:", err);
      showMessage(err instanceof Error ? err.message : "Failed to open billing portal.", true);
    } finally {
      setPortalLoading(false);
    }
  };

  const startCheckout = async (priceId) => {
    if (!priceId || !authToken) return;
    setCheckoutLoading(true);
    try {
      const res = await fetch(`${CONVEX_SITE_BASE}/stripe/create-checkout-session-auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (!data.url) throw new Error("No checkout URL returned.");
      await api_?.openExternal?.(data.url);
      showMessage("Complete checkout in your browser, then refresh this page.");
    } catch (err) {
      console.error("Failed to start checkout:", err);
      showMessage(err instanceof Error ? err.message : "Failed to start checkout.", true);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const isActive =
    subscription?.status === "active" || subscription?.status === "trialing";
  const status = subscription?.status || "none";
  const badgeClass = status === "none" ? "canceled" : status.replace(/ /g, "_");

  if (!api_) {
    return (
      <div className="settings-view">
        <p style={{ padding: 24 }}>Subscription management is only available in the Electron app.</p>
      </div>
    );
  }

  return (
    <div className="settings-view">
      <div className="settings-title-bar">
        <img src={crystalIcon} alt="" className="settings-title-icon" />
        <span className="settings-title-text">Manage Subscription</span>
        <button
          type="button"
          className="settings-title-close"
          onClick={() => api_?.closeWindow?.()}
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="settings-scroll">
        {message && (
          <div className={`settings-message ${message.isError ? "error" : ""}`}>{message.text}</div>
        )}

        {isAuthenticated === null || (isAuthenticated && loading) ? (
          <div className="subscription-loading">
            <div className="subscription-spinner" />
            <span>Loading subscription…</span>
          </div>
        ) : !isAuthenticated ? (
          <div className="subscription-auth-prompt">
            <h2>Sign in required</h2>
            <p>Log in to view and manage your Shard subscription.</p>
            <button type="button" className="settings-btn primary" onClick={() => api_?.openLogin?.()}>
              Sign in
            </button>
          </div>
        ) : (
          <>
            <section className="settings-section">
              <h2>Your plan</h2>
              <p className="settings-hint">{statusDescription(status)}</p>

              <div className="subscription-status-card">
                <div className="subscription-status-row">
                  <span className="subscription-status-label">Status</span>
                  <span className={`subscription-badge ${badgeClass}`}>
                    {status === "none" ? "Not subscribed" : status.replace(/_/g, " ")}
                  </span>
                </div>
                {userEmail && (
                  <div className="subscription-status-row">
                    <span className="subscription-status-label">Account</span>
                    <span className="subscription-status-value">{userEmail}</span>
                  </div>
                )}
                {subscription?.priceId && (
                  <div className="subscription-status-row">
                    <span className="subscription-status-label">Plan</span>
                    <span className="subscription-status-value">
                      {planLabel(subscription.priceId, stripePlans)}
                    </span>
                  </div>
                )}
                {subscription?.currentPeriodEnd && isActive && (
                  <div className="subscription-status-row">
                    <span className="subscription-status-label">Renews on</span>
                    <span className="subscription-status-value">
                      {formatDate(subscription.currentPeriodEnd)}
                    </span>
                  </div>
                )}
              </div>

              <div className="subscription-actions">
                {subscription?.stripeCustomerId && (
                  <button
                    type="button"
                    className="settings-btn primary"
                    onClick={openPortal}
                    disabled={portalLoading}
                  >
                    {portalLoading ? "Opening…" : "Manage billing"}
                  </button>
                )}
                <button
                  type="button"
                  className="settings-btn"
                  onClick={loadSubscription}
                  disabled={loading}
                >
                  Refresh
                </button>
              </div>
            </section>

            {!isActive && (
              <section className="settings-section">
                <h2>Subscribe</h2>
                <p className="settings-hint">Choose a plan to unlock AI features in Shard.</p>
                <div className="subscription-actions">
                  <button
                    type="button"
                    className="settings-btn primary"
                    onClick={() => startCheckout(stripePlans.monthly)}
                    disabled={checkoutLoading || !stripePlans.monthly}
                  >
                    {checkoutLoading ? "Opening…" : "Monthly"}
                  </button>
                  <button
                    type="button"
                    className="settings-btn"
                    onClick={() => startCheckout(stripePlans.yearly)}
                    disabled={checkoutLoading || !stripePlans.yearly}
                  >
                    {checkoutLoading ? "Opening…" : "Yearly"}
                  </button>
                </div>
              </section>
            )}

            {isActive && (
              <section className="settings-section">
                <h2>Cancel subscription</h2>
                <p className="settings-hint">
                  Open the billing portal to cancel. You will keep access until the end of your current
                  billing period — you will not be charged again after that.
                </p>
                <button
                  type="button"
                  className="settings-btn"
                  onClick={openPortal}
                  disabled={portalLoading || !subscription?.stripeCustomerId}
                >
                  {portalLoading ? "Opening…" : "Cancel in billing portal"}
                </button>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
