import Reveal from '../components/ui/Reveal'
import Button from '../components/ui/Button'

const values = [
  { title: 'Speed first', description: 'Every millisecond matters. We optimize before we add features.' },
  { title: 'Yours, not ours', description: 'Presets and preferences are the product. PROXY X adapts to you, not the other way around.' },
  { title: 'Lightweight always', description: 'No bloat, no dark patterns. A focused app that does one thing well, on Windows and the web.' },
]

export default function About() {
  return (
    <>
      <section className="bg-black pb-16 pt-28 text-white">
        <div className="page">
          <Reveal className="card max-w-3xl p-8 text-ink md:p-12">
            <p className="eyebrow">About</p>
            <h1 className="display mt-4 font-semibold">An AI assistant that stays out of your way</h1>
            <p className="mt-6 max-w-[46ch] text-lg text-ink/55">
              PROXY X is a lightweight, fast-response AI assistant for Windows and the web, tuned to
              how you actually work.
            </p>
            <div className="mt-8">
              <Button href="/app">Try on the web</Button>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-canvas py-16 text-ink md:py-20">
        <div className="page">
          <Reveal className="mb-10">
            <h2 className="display font-semibold">Our mission</h2>
            <p className="mt-4 max-w-[52ch] text-lg text-ink/55">
              Most AI assistants are slow, generic, and bloated. We built PROXY X for instant responses,
              deep customization, and a small desktop footprint.
            </p>
          </Reveal>
          <div className="grid gap-3 md:grid-cols-3">
            {values.map((value, i) => (
              <Reveal key={value.title} delay={i * 60}>
                <div className={`p-6 md:p-8 ${i === 1 ? 'card-dark' : 'card'}`}>
                  <h3 className="text-xl font-semibold">{value.title}</h3>
                  <p className={`mt-3 text-base leading-relaxed ${i === 1 ? 'text-white/60' : 'text-ink/55'}`}>
                    {value.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
