import type { ReactNode } from 'react'

type BentoTileProps = {
  children: ReactNode
  variant?: 'light' | 'dark' | 'accent'
  className?: string
  as?: 'div' | 'article' | 'section'
}

const variants = {
  light: 'tile-light',
  dark: 'tile-dark',
  accent: 'tile-accent',
}

export default function BentoTile({
  children,
  variant = 'light',
  className = '',
  as: Tag = 'div',
}: BentoTileProps) {
  return (
    <Tag className={`relative overflow-hidden p-6 md:p-8 ${variants[variant]} ${className}`}>
      <div className="relative z-[1]">{children}</div>
    </Tag>
  )
}
