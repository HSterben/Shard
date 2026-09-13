import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ArrowUpRight, Menu, X } from 'lucide-react'
import BrandMark from '../ui/BrandMark'
import AccountMenu from './AccountMenu'

function LogoMark() {
  return (
    <span className="flex items-center gap-2.5 text-ink" aria-hidden="true">
      <BrandMark className="h-7 w-7" />
      <span className="text-base font-semibold tracking-tight">PROXY X</span>
    </span>
  )
}

const links = [
  { label: 'Features', href: '/#features' },
  { label: 'How it works', href: '/#process' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'About', href: '/about' },
  { label: 'Blog', href: '/blog' },
]

export default function Navbar() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (pathname === '/' || pathname === '/app') return null

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b bg-white transition-colors duration-200 ${
        scrolled || open ? 'border-hairline' : 'border-transparent'
      }`}
    >
      <div className="page flex h-16 items-center justify-between gap-4">
        <Link to="/" className="pressable shrink-0" aria-label="PROXY X home">
          <LogoMark />
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
          {links.map((link) =>
            link.href.startsWith('/#') ? (
              <a
                key={link.href}
                href={link.href}
                className="text-[15px] font-medium text-ink/50 transition-colors duration-200 hover:text-ink"
              >
                {link.label}
              </a>
            ) : (
              <NavLink
                key={link.href}
                to={link.href}
                className={({ isActive }) =>
                  `text-[15px] font-medium transition-colors duration-200 ${
                    isActive ? 'text-ink' : 'text-ink/50 hover:text-ink'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ),
          )}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            to="/contact"
            className="pressable inline-flex min-h-11 items-center rounded-[10px] px-3 text-[15px] font-medium text-ink/50 transition-colors duration-200 hover:text-ink"
          >
            Download for Windows
          </Link>
          <Link
            to="/app"
            className="pressable inline-flex min-h-11 items-center rounded-[10px] px-4 text-[15px] font-medium text-ink/50 transition-colors duration-200 hover:text-ink"
          >
            Try on the web
          </Link>
          <AccountMenu variant="light" />
        </div>

        <button
          type="button"
          className="pressable flex h-11 w-11 items-center justify-center rounded-[10px] border border-hairline text-ink lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" strokeWidth={1.5} /> : <Menu className="h-5 w-5" strokeWidth={1.5} />}
          <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
        </button>
      </div>

      {open && (
        <div id="mobile-nav" className="border-t border-hairline bg-white lg:hidden">
          <nav className="page flex flex-col gap-1 py-4" aria-label="Mobile">
            {links.map((link) =>
              link.href.startsWith('/#') ? (
                <a
                  key={link.href}
                  href={link.href}
                  className="flex min-h-11 items-center text-base text-ink"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  to={link.href}
                  className="flex min-h-11 items-center text-base text-ink"
                >
                  {link.label}
                </Link>
              ),
            )}
            <Link
              to="/app"
              className="mt-2 flex min-h-11 items-center justify-center rounded-[10px] border border-hairline text-base text-ink"
            >
              Try on the web
            </Link>
            <Link
              to="/contact"
              className="flex min-h-11 items-center justify-center rounded-[10px] border border-hairline text-base text-ink"
            >
              Download for Windows
            </Link>
            <div className="mt-3 px-1">
              <AccountMenu variant="light" />
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}

export function HeroNav() {
  const [open, setOpen] = useState(false)
  const heroLinks = [
    { label: 'Features', href: '/#features' },
    { label: 'About', href: '/about' },
    { label: 'Blog', href: '/blog' },
    { label: 'Pricing', href: '/#pricing' },
    { label: 'Contact', href: '/contact' },
  ]

  return (
    <nav className="relative mb-3 md:mb-4" aria-label="Primary">
      <div className="glass-nav hero-radius flex items-center justify-between gap-4 px-4 py-3 md:px-6 md:py-4">
        <Link to="/" className="pressable flex min-h-11 shrink-0 items-center gap-2.5 text-light">
          <BrandMark className="h-7 w-7" inverted />
          <span className="text-[15px] font-semibold tracking-tight">PROXY X</span>
        </Link>

        <ul className="hidden items-center gap-6 md:flex lg:gap-10">
          {heroLinks.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-[15px] text-light/75 transition-colors duration-200 hover:text-light"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <Link
            to="/app"
            className="pressable hidden min-h-11 shrink-0 items-center rounded-full border border-light/25 px-4 py-2 text-[15px] font-medium text-light transition-colors duration-200 hover:border-light hover:bg-light/10 sm:inline-flex md:px-5"
          >
            Try on the web
          </Link>
          <Link
            to="/contact"
            className="pressable hidden min-h-11 shrink-0 items-center gap-2 rounded-full border border-light/25 px-4 py-2 text-[15px] font-medium text-light transition-colors duration-200 hover:border-light hover:bg-light/10 md:inline-flex md:px-5"
          >
            Get the app
            <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} />
          </Link>
          <AccountMenu variant="dark" />
          <button
            type="button"
            className="pressable flex h-11 w-11 items-center justify-center rounded-full border border-light/20 text-light md:hidden"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
          </button>
        </div>
      </div>

      {open && (
        <div className="absolute inset-x-0 top-full z-20 mt-2 rounded-[20px] border border-light/15 bg-graphite p-3 md:hidden">
          {heroLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="flex min-h-11 items-center px-3 text-base text-light"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </nav>
  )
}
