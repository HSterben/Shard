import { useState } from 'react'
import { Check } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { pricingPlans } from '../../data/content'
import Button from '../ui/Button'
import Reveal from '../ui/Reveal'

export default function Pricing() {
  const [annual, setAnnual] = useState(true)
  const reduce = useReducedMotion()
  const plans = annual ? pricingPlans.annually : pricingPlans.monthly
  const [free, pro, team] = plans

  return (
    <section id="pricing" className="bg-canvas py-16 text-ink md:py-20">
      <div className="page">
        <Reveal className="mb-8 max-w-xl">
          <p className="eyebrow">Pricing</p>
          <h2 className="display mt-3 font-semibold">Simple plans. No surprises.</h2>
        </Reveal>

        <Reveal className="mb-8 flex items-center gap-4">
          <span className={`text-base ${!annual ? 'text-ink' : 'text-ink/45'}`}>Monthly</span>
          <button
            type="button"
            role="switch"
            aria-checked={annual}
            aria-label="Bill annually"
            onClick={() => setAnnual(!annual)}
            className={`relative h-7 w-12 rounded-full transition-colors duration-200 ${
              annual ? 'bg-black' : 'bg-hairline'
            }`}
          >
            <motion.span
              className="absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-sm"
              animate={{ x: annual ? 20 : 0 }}
              transition={{ duration: reduce ? 0.15 : 0.2 }}
            />
          </button>
          <span className={`text-base ${annual ? 'text-ink' : 'text-ink/45'}`}>Annually</span>
        </Reveal>

        <div className="grid gap-4 lg:grid-cols-3">
          <Reveal>
            <PlanCard plan={free} />
          </Reveal>
          <Reveal delay={60}>
            <PlanCard plan={pro} featured />
          </Reveal>
          <Reveal delay={100}>
            <PlanCard plan={team} muted />
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function PlanCard({
  plan,
  featured = false,
  muted = false,
}: {
  plan: (typeof pricingPlans.monthly)[number]
  featured?: boolean
  muted?: boolean
}) {
  return (
    <div
      className={`flex h-full flex-col rounded-[10px] p-7 md:p-8 ${
        featured ? 'card-dark' : 'card'
      }`}
    >
      {featured && (
        <span className="mb-4 w-fit rounded-[6px] bg-signal px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-white">
          Recommended
        </span>
      )}
      {muted && (
        <span className="mb-4 w-fit text-[11px] font-medium uppercase tracking-[0.16em] text-ink/45">
          Organizations
        </span>
      )}
      <h3 className="text-xl font-semibold md:text-[22px]">{plan.name}</h3>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="display text-[2rem] font-semibold leading-none">{plan.price}</span>
        {plan.period && (
          <span className={`text-base ${featured ? 'text-white/50' : 'text-ink/45'}`}>
            {plan.period}
          </span>
        )}
      </div>
      <p className={`mt-3 text-base leading-relaxed ${featured ? 'text-white/60' : 'text-ink/55'}`}>
        {plan.description}
      </p>
      <div className="mt-6">
        <Button
          href={muted ? '/contact' : '/app'}
          variant={featured ? 'primary-light' : 'outline-dark'}
          className="w-full justify-center"
        >
          {'cta' in plan && plan.cta ? plan.cta : 'Choose plan'}
        </Button>
      </div>
      <ul className={`mt-8 space-y-3 border-t pt-6 ${featured ? 'border-white/10' : 'border-hairline'}`}>
        {plan.features.map((feature) => (
          <li
            key={feature}
            className={`flex items-start gap-3 text-base ${
              featured ? 'text-white/80' : 'text-ink/60'
            }`}
          >
            <Check className={`mt-1 h-4 w-4 shrink-0 ${featured ? 'text-signal' : 'text-ink'}`} strokeWidth={1.5} />
            {feature}
          </li>
        ))}
      </ul>
    </div>
  )
}
