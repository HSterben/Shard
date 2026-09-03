import { useScrollReveal } from '../../hooks/useScrollReveal'
import type { ReactNode } from 'react'

type SectionHeadingProps = {
  badge?: string
  title: string
  subtitle?: string
  align?: 'left' | 'center'
  className?: string
  children?: ReactNode
}

export default function SectionHeading({
  badge,
  title,
  subtitle,
  align = 'center',
  className = '',
}: SectionHeadingProps) {
  const { ref, visible } = useScrollReveal<HTMLDivElement>()

  return (
    <div
      ref={ref}
      className={`transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      } ${align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-2xl'} ${className}`}
    >
      {badge && <span className="eyebrow mb-4 inline-block">{badge}</span>}
      <h2 className="display text-3xl font-semibold md:text-4xl lg:text-5xl">{title}</h2>
      {subtitle && <p className="mt-4 text-base text-ink/55 md:text-lg">{subtitle}</p>}
    </div>
  )
}
