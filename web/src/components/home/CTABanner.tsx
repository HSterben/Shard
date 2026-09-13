import Button from '../ui/Button'
import Reveal from '../ui/Reveal'
import Sparkline from '../ui/Sparkline'
import { DESKTOP_DOWNLOAD_URL } from '../../data/content'

export default function CTABanner() {
  return (
    <section data-nav-tone="dark" className="bg-graphite py-16 text-white md:py-20">
      <div className="page">
        <Reveal>
          <div className="card-dark relative overflow-hidden px-8 py-12 md:px-14 md:py-16">
            <p className="text-center text-[11px] font-medium uppercase tracking-[0.2em] text-white/45">
              Web <span className="mx-1.5 inline-block h-1 w-1 rounded-full bg-signal align-middle" /> Windows{' '}
              <span className="mx-1.5 inline-block h-1 w-1 rounded-full bg-signal align-middle" /> States
            </p>
            <h2 className="display mx-auto mt-5 max-w-2xl text-center font-semibold">
              Open PROXY in the browser or install on Windows
            </h2>
            <p className="mx-auto mt-4 max-w-[40ch] text-center text-lg leading-relaxed text-white/55">
              Sign in to chat with an active plan. Download the latest Windows installer from GitHub
              Releases.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button href="/app" variant="primary-light" className="w-full sm:w-auto">
                Open PROXY Web
              </Button>
              <Button href={DESKTOP_DOWNLOAD_URL} variant="outline-light" className="w-full sm:w-auto">
                Download for Windows
              </Button>
            </div>
            <Sparkline className="mx-auto mt-10 h-16 w-full max-w-xl opacity-80" />
          </div>
        </Reveal>
      </div>
    </section>
  )
}
