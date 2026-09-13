import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'

type ButtonProps = {
  children: ReactNode
  href?: string
  variant?: 'primary' | 'primary-light' | 'outline-dark' | 'outline-light' | 'ghost-dark' | 'ghost-light'
  className?: string
  icon?: boolean
  onClick?: () => void
  type?: 'button' | 'submit'
}

const variants = {
  primary:
    'min-h-11 rounded-[10px] bg-black px-6 py-3 text-base font-semibold text-white transition-colors duration-200 hover:bg-black/80',
  'primary-light':
    'min-h-11 rounded-[10px] bg-white px-6 py-3 text-base font-semibold text-black transition-colors duration-200 hover:bg-white/90',
  'outline-dark':
    'min-h-11 rounded-[10px] border border-hairline bg-transparent px-6 py-3 text-base font-medium text-ink transition-colors duration-200 hover:border-ink/40',
  'outline-light':
    'min-h-11 rounded-[10px] border border-white/20 bg-transparent px-6 py-3 text-base font-medium text-white transition-colors duration-200 hover:border-white hover:bg-white/5',
  'ghost-dark':
    'min-h-11 rounded-[10px] px-4 py-2 text-base font-medium text-ink/70 transition-colors duration-200 hover:text-ink',
  'ghost-light':
    'min-h-11 rounded-[10px] px-4 py-2 text-base font-medium text-white/70 transition-colors duration-200 hover:text-white',
}

export default function Button({
  children,
  href,
  variant = 'primary',
  className = '',
  icon = false,
  onClick,
  type = 'button',
}: ButtonProps) {
  const classes = `pressable inline-flex items-center justify-center gap-2 ${variants[variant]} ${className}`

  const content = (
    <>
      {children}
      {icon && <ArrowUpRight className="h-4 w-4" />}
    </>
  )

  if (href) {
    const isExternal = href.startsWith('http')
    if (isExternal) {
      return (
        <a href={href} className={classes} target="_blank" rel="noreferrer">
          {content}
        </a>
      )
    }
    return (
      <Link to={href} className={classes}>
        {content}
      </Link>
    )
  }

  return (
    <button type={type} className={classes} onClick={onClick}>
      {content}
    </button>
  )
}
