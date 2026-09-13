import { Link } from 'react-router-dom'

type ProfileAvatarProps = {
  name: string
  src?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClass = {
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-xl',
}

export default function ProfileAvatar({
  name,
  src,
  size = 'md',
  className = '',
}: ProfileAvatarProps) {
  const initial = (name?.trim()?.[0] || '?').toUpperCase()
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`${sizeClass[size]} shrink-0 rounded-full object-cover ${className}`}
      />
    )
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-brand-surface font-semibold text-ink ${sizeClass[size]} ${className}`}
      aria-hidden
    >
      {initial}
    </span>
  )
}

export function AuthorByline({
  workosId,
  displayName,
  avatarUrl,
  isOfficial,
}: {
  workosId: string
  displayName: string
  avatarUrl?: string | null
  isOfficial?: boolean
}) {
  const inner = (
    <>
      <ProfileAvatar name={displayName} src={avatarUrl} size="sm" />
      <span className="min-w-0 truncate">
        <span className="text-ink/40">Published by </span>
        <span className="font-medium text-ink/70">{displayName}</span>
      </span>
    </>
  )

  if (isOfficial || workosId === 'proxy-official') {
    return (
      <div className="flex items-center gap-2 text-[13px]">
        {inner}
      </div>
    )
  }

  return (
    <Link
      to={`/u/${encodeURIComponent(workosId)}`}
      className="flex items-center gap-2 text-[13px] transition-opacity hover:opacity-80"
    >
      {inner}
    </Link>
  )
}
