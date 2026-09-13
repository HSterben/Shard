import Reveal from '../components/ui/Reveal'
import Button from '../components/ui/Button'

const values = [
  {
    title: 'States you can name',
    description:
      'Trigger words, instructions, and optional model settings live in states you create or save from the gallery.',
  },
  {
    title: 'Windows and web',
    description:
      'Chat from the desktop app or the browser with the same PROXY account. Billing stays on this website.',
  },
  {
    title: 'Small desktop install',
    description:
      'The Windows build ships from GitHub Releases. Install it when you want a bubble and shortcuts outside the browser.',
  },
]

export default function About() {
  return (
    <>
      <section data-nav-tone="dark" className="bg-graphite pb-16 pt-28 text-white">
        <div className="page">
          <Reveal className="card max-w-3xl p-8 text-ink md:p-12">
            <p className="eyebrow">About</p>
            <h1 className="display mt-4 font-semibold">PROXY is a chat app with reusable states</h1>
            <p className="mt-6 max-w-[46ch] text-lg text-ink/55">
              Use it on Windows or in the browser. Sign in, pick a state, and send a message. Plan
              changes happen on the billing page.
            </p>
            <div className="mt-8">
              <Button href="/app">Open PROXY Web</Button>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-canvas py-16 text-ink md:py-20">
        <div className="page">
          <Reveal className="mb-10">
            <h2 className="display font-semibold">What PROXY is for</h2>
            <p className="mt-4 max-w-[52ch] text-lg text-ink/55">
              PROXY is built for people who want a named chat setup they can reuse, not a one-off
              prompt every time. States sync to your account after you sign in.
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
