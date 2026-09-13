import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ConvexClient } from 'convex/browser'
import { ChevronDown, LogOut, User } from 'lucide-react'
import { useAuth } from '../../auth/AuthSessionProvider'
import { api } from '../../convex/api'
import { convexUrl } from '../../lib/convexUrls'
import ProfileAvatar from '../ui/ProfileAvatar'

type AccountMenuProps = {
  variant?: 'light' | 'dark'
}

export default function AccountMenu({ variant = 'dark' }: AccountMenuProps) {
  const { user, isLoading, signIn, signOut, getAccessToken } = useAuth()
  const convex = useRef(new ConvexClient(convexUrl))
  const [open, setOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    if (!user) {
      setAvatarUrl(null)
      setDisplayName(null)
      return
    }
    convex.current.setAuth(async () => (await getAccessToken()) ?? null)
    void convex.current
      .query(api.users.getMyProfile, {})
      .then((p) => {
        const profile = p as { displayName?: string; avatarUrl?: string | null } | null
        if (profile?.displayName) setDisplayName(profile.displayName)
        setAvatarUrl(profile?.avatarUrl ?? null)
      })
      .catch(() => {
        /* ignore */
      })
  }, [user, getAccessToken])

  const isDark = variant === 'dark'
  const ghostBtn = isDark
    ? 'text-light/80 hover:text-light'
    : 'text-ink/50 hover:text-ink'
  const primaryBtn = isDark
    ? 'bg-light/10 text-light border border-light/20 hover:bg-light/15'
    : 'bg-black text-white hover:bg-black/85'

  if (isLoading) {
    return (
      <span
        className={`inline-flex min-h-11 items-center px-3 text-[15px] ${isDark ? 'text-light/50' : 'text-ink/40'}`}
      >
        …
      </span>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={`pressable inline-flex min-h-11 items-center rounded-full px-4 text-[15px] font-medium ${ghostBtn}`}
          onClick={() => void signIn({ state: { returnTo: '/account' } })}
        >
          Log in
        </button>
        <button
          type="button"
          className={`pressable inline-flex min-h-11 items-center rounded-full px-4 text-[15px] font-semibold ${primaryBtn}`}
          onClick={() => void signIn({ state: { returnTo: '/account' } })}
        >
          Sign up
        </button>
      </div>
    )
  }

  const label = displayName || user.email || user.firstName || 'Account'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={`pressable inline-flex min-h-11 max-w-[200px] items-center gap-2 rounded-full border px-2.5 py-1.5 text-[15px] font-medium ${
          isDark
            ? 'border-light/20 bg-light/5 text-light hover:bg-light/10'
            : 'border-hairline bg-white text-ink hover:bg-paper-muted'
        }`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <ProfileAvatar name={label} src={avatarUrl} size="sm" />
        <span className="truncate">{label}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" strokeWidth={1.5} />
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute right-0 top-[calc(100%+8px)] z-50 min-w-[200px] rounded-[12px] border p-1.5 shadow-lg ${
            isDark ? 'border-light/15 bg-graphite' : 'border-hairline bg-white'
          }`}
        >
          <Link
            to="/account"
            role="menuitem"
            className={`flex min-h-10 items-center gap-2 rounded-[8px] px-3 text-[15px] ${
              isDark ? 'text-light hover:bg-light/10' : 'text-ink hover:bg-paper-muted'
            }`}
            onClick={() => setOpen(false)}
          >
            <User className="h-4 w-4" strokeWidth={1.5} />
            Account
          </Link>
          <Link
            to="/account/billing"
            role="menuitem"
            className={`flex min-h-10 items-center gap-2 rounded-[8px] px-3 text-[15px] ${
              isDark ? 'text-light hover:bg-light/10' : 'text-ink hover:bg-paper-muted'
            }`}
            onClick={() => setOpen(false)}
          >
            Billing
          </Link>
          <div className={`my-1 h-px ${isDark ? 'bg-light/10' : 'bg-hairline'}`} />
          <button
            type="button"
            role="menuitem"
            className={`flex w-full min-h-10 items-center gap-2 rounded-[8px] px-3 text-left text-[15px] ${
              isDark ? 'text-light hover:bg-light/10' : 'text-ink hover:bg-paper-muted'
            }`}
            onClick={() => {
              setOpen(false)
              void signOut({ returnTo: '/' })
            }}
          >
            <LogOut className="h-4 w-4" strokeWidth={1.5} />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
