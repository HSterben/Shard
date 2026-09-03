import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ConvexClient } from 'convex/browser'
import { useAuth } from '../auth/AuthSessionProvider'
import { api } from '../convex/api'
import { convexUrl } from '../lib/convexUrls'

type AccountSnapshot = {
  email?: string
  subscriptionActive: boolean
  status: string
  plan: string | null
  currentPeriodEnd?: number
  weightedTokensUsed: number
  weightedTokenLimit: number
  remaining: number
  canUseAI: boolean
}

function formatDate(ms?: number) {
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function Account() {
  const { user, isLoading, signIn, getAccessToken } = useAuth()
  const convex = useRef(new ConvexClient(convexUrl))
  const [account, setAccount] = useState<AccountSnapshot | null | undefined>(undefined)

  useEffect(() => {
    if (!user) return
    convex.current.setAuth(async () => (await getAccessToken()) ?? null)
    void convex.current
      .query(api.account.getMyAccount, {})
      .then((data) => setAccount(data as AccountSnapshot | null))
      .catch(() => setAccount(null))
  }, [user, getAccessToken])

  if (isLoading) {
    return <div className="page py-20 text-ink/50">Loading…</div>
  }

  if (!user) {
    return (
      <div className="page flex min-h-[50vh] flex-col items-center justify-center gap-4 py-20 text-center">
          <h1 className="display text-2xl font-semibold">Sign in to your account</h1>
          <p className="max-w-md text-ink/55">Manage subscription and usage for PROXY X web and desktop.</p>
          <button
            type="button"
            className="pressable rounded-[10px] bg-black px-5 py-3 text-[15px] font-semibold text-white"
            onClick={() => void signIn({ state: { returnTo: '/account' } })}
          >
            Log in
          </button>
      </div>
    )
  }

  const usagePct = account
    ? Math.min(100, Math.round((account.weightedTokensUsed / account.weightedTokenLimit) * 100))
    : 0

  return (
    <div className="page py-12 md:py-16">
        <p className="eyebrow">Account</p>
        <h1 className="display mt-3 text-3xl font-semibold">Your PROXY X account</h1>
        <p className="mt-3 max-w-xl text-ink/55">
          Subscription and usage for web and desktop. Billing changes happen on the billing page.
        </p>

        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <section className="card p-6 md:p-8">
            <h2 className="text-lg font-semibold">Subscription</h2>
            {account === undefined ? (
              <p className="mt-4 text-ink/50">Loading…</p>
            ) : (
              <dl className="mt-5 space-y-3 text-[15px]">
                <div className="flex justify-between gap-4 border-b border-hairline pb-3">
                  <dt className="text-ink/50">Email</dt>
                  <dd>{account?.email ?? user.email ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-hairline pb-3">
                  <dt className="text-ink/50">Status</dt>
                  <dd className="capitalize">{account?.status === 'none' ? 'Not subscribed' : account?.status}</dd>
                </div>
                {account?.plan && (
                  <div className="flex justify-between gap-4 border-b border-hairline pb-3">
                    <dt className="text-ink/50">Plan</dt>
                    <dd>{account.plan}</dd>
                  </div>
                )}
                {account?.currentPeriodEnd && account.subscriptionActive && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink/50">Renews</dt>
                    <dd>{formatDate(account.currentPeriodEnd)}</dd>
                  </div>
                )}
              </dl>
            )}
            <Link
              to="/account/billing"
              className="pressable mt-6 inline-flex min-h-11 items-center rounded-[10px] bg-black px-5 text-[15px] font-semibold text-white"
            >
              Manage billing
            </Link>
          </section>

          <section className="card p-6 md:p-8">
            <h2 className="text-lg font-semibold">Usage this period</h2>
            {account && (
              <>
                <dl className="mt-5 space-y-3 text-[15px]">
                  <div className="flex justify-between gap-4 border-b border-hairline pb-3">
                    <dt className="text-ink/50">Remaining</dt>
                    <dd>{account.remaining.toLocaleString()} weighted tokens</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink/50">Used</dt>
                    <dd>
                      {account.weightedTokensUsed.toLocaleString()} /{' '}
                      {account.weightedTokenLimit.toLocaleString()}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-hairline">
                  <div
                    className="h-full rounded-full bg-brand transition-[width] duration-300"
                    style={{ width: `${usagePct}%` }}
                  />
                </div>
              </>
            )}
          </section>
        </div>
      </div>
  )
}
