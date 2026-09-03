import { Link } from 'react-router-dom'
import { homeAnchors, navLinks, socialLinks } from '../../data/content'
import BrandMark from '../ui/BrandMark'

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black py-14 text-white">
      <div className="page">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <Link to="/" className="flex items-center gap-2.5">
              <BrandMark inverted className="h-6 w-6" />
              <span className="text-base font-semibold tracking-tight">PROXY X</span>
            </Link>
            <p className="mt-4 max-w-[32ch] text-base leading-relaxed text-white/50">
              A fast, lightweight AI assistant for Windows and the web, tuned to how you work.
            </p>
            <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.2em] text-white/40">
              Route <span className="mx-1.5 inline-block h-1 w-1 rounded-full bg-signal align-middle" /> Connect{' '}
              <span className="mx-1.5 inline-block h-1 w-1 rounded-full bg-signal align-middle" /> Scale
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">Navigation</h3>
            <ul className="space-y-1">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="inline-flex min-h-11 items-center text-base text-white/55 transition-colors duration-200 hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">Product</h3>
            <ul className="space-y-1">
              {homeAnchors.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="inline-flex min-h-11 items-center text-base text-white/55 transition-colors duration-200 hover:text-white"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-6 md:flex-row md:items-center">
          <p className="text-sm text-white/40">
            &copy; {new Date().getFullYear()} PROXY X. All rights reserved.
          </p>
          <div className="flex gap-6">
            {socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-white/40 transition-colors duration-200 hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
