import { useState, type FormEvent } from 'react'
import { Mail, Monitor, Globe } from 'lucide-react'
import Reveal from '../components/ui/Reveal'
import Button from '../components/ui/Button'

export default function Contact() {
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitted(true)
  }

  const inputClass =
    'w-full min-h-11 rounded-[10px] border border-hairline bg-white px-4 py-3 text-base outline-none transition-colors duration-200 focus:border-ink'

  return (
    <>
      <section className="bg-black pb-12 pt-28 text-white">
        <div className="page">
          <Reveal className="card max-w-2xl p-8 text-ink md:p-12">
            <p className="eyebrow">Contact</p>
            <h1 className="display mt-4 font-semibold">Try PROXY X, or reach out</h1>
            <p className="mt-4 max-w-[42ch] text-lg text-ink/55">
              Use the web client, download the Windows app, or contact us about Team plans.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="bg-canvas pb-20 pt-10 text-ink">
        <div className="page grid gap-10 lg:grid-cols-5 lg:gap-12">
          <Reveal className="lg:col-span-2">
            <div className="space-y-6">
              {[
                { icon: Globe, label: 'Web app', value: 'Try PROXY X in the browser' },
                { icon: Monitor, label: 'Windows app', value: 'Lightweight desktop install' },
                { icon: Mail, label: 'Email', value: 'hello@proxy-x.ai' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-hairline bg-white">
                    <Icon className="h-5 w-5 text-signal" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-base font-medium">{label}</p>
                    <p className="text-base text-ink/55">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={100} className="lg:col-span-3">
            {submitted ? (
              <div className="card p-8 text-center">
                <h2 className="text-xl font-semibold">Message sent</h2>
                <p className="mt-2 text-base text-ink/55">We&apos;ll get back to you within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="card p-6 md:p-8">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="name" className="mb-1.5 block text-base font-medium">Name</label>
                    <input id="name" name="name" required className={inputClass} placeholder="Your name" />
                  </div>
                  <div>
                    <label htmlFor="email" className="mb-1.5 block text-base font-medium">Email</label>
                    <input id="email" name="email" type="email" required className={inputClass} placeholder="you@email.com" />
                  </div>
                </div>
                <div className="mt-5">
                  <label htmlFor="topic" className="mb-1.5 block text-base font-medium">Topic</label>
                  <select id="topic" name="topic" className={inputClass}>
                    <option>Try on the web</option>
                    <option>Download for Windows</option>
                    <option>Pro plan</option>
                    <option>Team / Enterprise</option>
                    <option>Support</option>
                  </select>
                </div>
                <div className="mt-5">
                  <label htmlFor="message" className="mb-1.5 block text-base font-medium">Message</label>
                  <textarea id="message" name="message" required rows={5} className={`${inputClass} resize-none`} placeholder="Tell us how you plan to use PROXY X..." />
                </div>
                <div className="mt-6">
                  <Button type="submit" icon variant="primary" className="w-full sm:w-auto">
                    Send message
                  </Button>
                </div>
              </form>
            )}
          </Reveal>
        </div>
      </section>
    </>
  )
}
