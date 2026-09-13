import type { ReactNode } from 'react'

type BadgeProps = {
  children: ReactNode
  variant?: 'default' | 'new'
  className?: string
}

export default function Badge({
  children,
  variant = 'default',
  className = '',
}: BadgeProps) {
  if (variant === 'new') {
    return (
      <div
        className={`inline-flex items-center overflow-hidden rounded-full card-border text-xs ${className}`}
      >
        <span className="bg-brand px-3 py-1.5 font-medium text-surface">New</span>
        <span className="px-3 py-1.5 text-muted">{children}</span>
      </div>
    )
  }

  return (
    <span
      className={`inline-block rounded-full card-border px-4 py-1.5 text-xs font-medium text-muted ${className}`}
    >
      {children}
    </span>
  )
}
