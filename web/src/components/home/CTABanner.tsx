import Button from '../ui/Button'
import Reveal from '../ui/Reveal'
import Sparkline from '../ui/Sparkline'

export default function CTABanner() {
  return (
    <section className="bg-black py-16 text-white md:py-20">
      <div className="page">
        <Reveal>
          <div className="card-dark relative overflow-hidden px-8 py-12 md:px-14 md:py-16">
            <p className="text-center text-[11px] font-medium uppercase tracking-[0.2em] text-white/45">
              Route <span className="mx-1.5 inline-block h-1 w-1 rounded-full bg-signal align-middle" /> Connect{' '}
              <span className="mx-1.5 inline-block h-1 w-1 rounded-full bg-signal align-middle" /> Scale
            </p>
            <h2 className="display mx-auto mt-5 max-w-2xl text-center font-semibold">
              Ready for an assistant that works your way?
            </h2>
            <p className="mx-auto mt-4 max-w-[40ch] text-center text-lg leading-relaxed text-white/55">
              Try PROXY X on the web or download the lightweight Windows app.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button href="/app" variant="primary-light" className="w-full sm:w-auto">
                Try on the web
              </Button>
              <Button href="/contact" variant="outline-light" className="w-full sm:w-auto">
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
