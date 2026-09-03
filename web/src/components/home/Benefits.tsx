import { Box, GitBranch, Maximize2, Crosshair } from 'lucide-react'
import Reveal from '../ui/Reveal'
import Sparkline from '../ui/Sparkline'

const traits = [
  { icon: Box, label: 'Modular' },
  { icon: GitBranch, label: 'Routing' },
  { icon: Maximize2, label: 'Scalable' },
  { icon: Crosshair, label: 'Precise' },
]

export default function Benefits() {
  return (
    <section id="features" className="bg-canvas py-16 text-ink md:py-20">
      <div className="page">
        <Reveal className="mb-10 max-w-xl">
          <p className="eyebrow">Why PROXY X</p>
          <h2 className="display mt-3 font-semibold">Built for speed, control, and daily work.</h2>
        </Reveal>

        <div className="grid gap-3 lg:grid-cols-5">
          <Reveal className="card-dark relative overflow-hidden lg:col-span-3 p-7 md:p-10">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/45">
              Route <span className="mx-1.5 inline-block h-1 w-1 rounded-full bg-signal align-middle" /> Connect{' '}
              <span className="mx-1.5 inline-block h-1 w-1 rounded-full bg-signal align-middle" /> Scale
            </p>
            <h3 className="mt-5 text-xl font-semibold md:text-[22px]">Fast by design</h3>
            <p className="mt-3 max-w-[42ch] text-base leading-relaxed text-white/60">
              PROXY X is a focused assistant, not a heavy suite. Open it, ask, and keep moving, with
              streaming replies that stay out of your way.
            </p>
            <div className="mt-8 overflow-hidden rounded-[10px] border border-white/10 bg-black p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/45">Live reply</p>
                <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-white/45">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                  Operational
                </span>
              </div>
              <p className="mt-3 text-base leading-relaxed text-white">
                Draft a shorter status update
                <span className="ml-2 inline-block h-4 w-px animate-pulse bg-signal align-middle" />
              </p>
              <Sparkline className="mt-6 h-16 w-full" />
            </div>
          </Reveal>

          <div className="grid gap-3 lg:col-span-2">
            <Reveal delay={80} className="card p-7">
              <h3 className="text-xl font-semibold md:text-[22px]">Tuned to you</h3>
              <p className="mt-3 text-base leading-relaxed text-ink/55">
                Presets and preferences shape tone, length, and style so replies already sound like
                how you work.
              </p>
            </Reveal>
            <Reveal delay={120} className="card p-7">
              <h3 className="text-xl font-semibold md:text-[22px]">Available where you work</h3>
              <p className="mt-3 text-base leading-relaxed text-ink/55">
                Use the Windows desktop app or the web client. Same assistant, same presets, same
                conversations.
              </p>
              <ul className="mt-6 grid grid-cols-2 gap-3 border-t border-hairline pt-5">
                {traits.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-2 text-[12px] uppercase tracking-[0.12em] text-ink/60">
                    <Icon className="h-4 w-4 text-signal" strokeWidth={1.5} />
                    {label}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}
