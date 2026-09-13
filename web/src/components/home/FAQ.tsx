import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { faqs } from '../../data/content'
import Reveal from '../ui/Reveal'

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0)
  const reduce = useReducedMotion()

  return (
    <section className="border-t border-hairline bg-white py-16 text-ink md:py-20">
      <div className="mx-auto w-full max-w-3xl px-5 md:px-8">
        <Reveal className="mb-10">
          <p className="eyebrow">FAQ</p>
          <h2 className="display mt-3 font-semibold">Common questions</h2>
        </Reveal>

        <div className="border-t border-hairline">
          {faqs.map((faq, i) => {
            const isOpen = open === i
            return (
              <Reveal key={faq.question} delay={i * 40}>
                <div className="border-b border-hairline">
                  <button
                    type="button"
                    className="flex min-h-14 w-full items-center justify-between gap-4 py-5 text-left md:py-6"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${i}`}
                    id={`faq-button-${i}`}
                  >
                    <span className="text-base font-semibold md:text-lg">{faq.question}</span>
                    <motion.span
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex"
                    >
                      <ChevronDown className="h-5 w-5 shrink-0 text-ink/40" strokeWidth={1.5} />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={`faq-panel-${i}`}
                        role="region"
                        aria-labelledby={`faq-button-${i}`}
                        key="answer"
                        initial={reduce ? false : { height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="pb-6">
                          <p className="max-w-[62ch] text-base leading-relaxed text-ink/55">
                            {faq.answer}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
