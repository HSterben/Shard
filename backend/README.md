# Welcome to your Convex + React (Vite) + WorkOS AuthKit app

This is a [Convex](https://convex.dev/) project created with [`npm create convex`](https://www.npmjs.com/package/create-convex).

After the initial setup (<2 minutes) you'll have a working full-stack app using:

- Convex as your backend (database, server logic)
- [React](https://react.dev/) as your frontend (web page interactivity)
- [Vite](https://vitest.dev/) for optimized web hosting
- [Tailwind](https://tailwindcss.com/) for building great looking accessible UI
- [WorkOS AuthKit](https://workos.com/docs/authkit) for authentication

## Get started

If you just cloned this codebase and didn't use `npm create convex`, run:

```bash
npm install
npm run dev
```

If you're reading this README on GitHub and want to use this template, run:

```bash
npm create convex@latest -- -t react-vite-workos-authkit
```

Then:

1. Sign up for [WorkOS](https://workos.com/) and create an application
2. Copy `.env.local.example` to `.env.local` and configure:
   - `VITE_WORKOS_CLIENT_ID`: Your WorkOS client ID
   - `VITE_WORKOS_REDIRECT_URI`: Your redirect URI (default: `http://localhost:5173/callback`)
   - `VITE_CONVEX_URL`: Your Convex deployment URL
3. Configure your WorkOS client ID as `WORKOS_CLIENT_ID` in your Convex dashboard environment variables

For user management and webhook integration with WorkOS, check out the [WorkOS documentation](https://workos.com/docs/user-management).

## Stripe subscriptions (sandbox)

This project includes a simple **Stripe Checkout subscription** flow served from Convex HTTP routes:

- Subscription page: `https://<your-deployment>.convex.site/subscribe`
- Webhook endpoint: `https://<your-deployment>.convex.site/webhooks/stripe`

### Required Convex environment variables

Set these in the Convex dashboard for your deployment:

- `STRIPE_SECRET_KEY` (secret, `sk_test_...` in sandbox)
- `STRIPE_WEBHOOK_SIGNING_SECRET` (secret, `whsec_...` from the webhook endpoint). Alternatively `STRIPE_WEBHOOK_SECRET`.
- `STRIPE_PRICE_ID_MONTHLY` (optional, `price_...`)
- `STRIPE_PRICE_ID_YEARLY` (optional, `price_...`)

Price IDs are created in the Stripe Dashboard (Products → Prices).

### Stripe CLI quickstart (recommended)

1. Install + login:

```bash
stripe login
```

1. Forward Stripe webhooks to your Convex endpoint:

```bash
stripe listen --forward-to "https://<your-deployment>.convex.site/webhooks/stripe"
```

The CLI prints a signing secret like `whsec_...` — copy that value into `STRIPE_WEBHOOK_SIGNING_SECRET` (or `STRIPE_WEBHOOK_SECRET`).

1. Test webhook delivery:

```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
```

### Why subscription stays "Pending" after payment

When a user completes Stripe Checkout in the browser, Stripe sends webhooks to the **endpoint you configure in the Stripe Dashboard**, not through the CLI. If that endpoint is missing, Convex never receives the event and the subscription row stays "pending".

**Add a webhook endpoint in Stripe:**

1. Open the **Webhooks** page: **[dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks)** (use Test mode toggle if needed).
2. Click **Create an event destination** (older UI) or **Create new destination** (Workbench). If you don’t see Webhooks in the sidebar, open **Workbench** first, then the **Webhooks** tab.
3. **Endpoint URL:** `https://<your-deployment>.convex.site/webhooks/stripe`
4. **Events to send:** `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
5. After creating the endpoint, open it and **Reveal** the **Signing secret** (`whsec_...`).
6. Set that value as **`STRIPE_WEBHOOK_SIGNING_SECRET`** in the Convex dashboard (or `STRIPE_WEBHOOK_SECRET`; replace the CLI secret if you were using that).

After that, completing a test payment will send events to Convex and the subscription status will update to "active".

## Learn more

To learn more about developing your project with Convex, check out:

- The [Tour of Convex](https://docs.convex.dev/get-started) for a thorough introduction to Convex principles.
- The rest of [Convex docs](https://docs.convex.dev/) to learn about all Convex features.
- [Stack](https://stack.convex.dev/) for in-depth articles on advanced topics.

## Join the community

Join thousands of developers building full-stack apps with Convex:

- Join the [Convex Discord community](https://convex.dev/community) to get help in real-time.
- Follow [Convex on GitHub](https://github.com/get-convex/), star and contribute to the open-source implementation of Convex.
