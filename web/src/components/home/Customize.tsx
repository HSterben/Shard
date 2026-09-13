import { useState } from 'react'
import Reveal from '../ui/Reveal'
import ProductPreview, { type LengthMode, type StyleMode, type ToneMode } from '../ui/ProductPreview'

function Segment<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-white/50">{label}</legend>
      <div className="flex rounded-[10px] border border-white/12 p-1">
        {options.map((opt) => {
          const selected = value === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(opt.id)}
              className={`min-h-11 flex-1 rounded-[8px] px-3 text-sm font-medium transition-colors duration-200 ${
                selected ? 'bg-white text-black' : 'text-white/55 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

export default function Customize() {
  const [length, setLength] = useState<LengthMode>('concise')
  const [tone, setTone] = useState<ToneMode>('professional')
  const [style, setStyle] = useState<StyleMode>('precise')

  return (
    <section id="customize" data-nav-tone="dark" className="bg-graphite py-16 text-white md:py-20">
      <div className="page grid items-start gap-10 lg:grid-cols-2 lg:gap-14">
        <Reveal>
          <p className="eyebrow-dark">States</p>
          <h2 className="display mt-3 font-semibold">Preview length, tone, and style.</h2>
          <p className="mt-4 max-w-[42ch] text-lg leading-relaxed text-white/55">
            These controls mirror the kinds of preferences you can bake into a PROXY state. Switch
            them and watch the sample reply change.
          </p>

          <div className="mt-8 grid gap-5">
            <Segment
              label="Length"
              value={length}
              onChange={setLength}
              options={[
                { id: 'concise', label: 'Concise' },
                { id: 'detailed', label: 'Detailed' },
              ]}
            />
            <Segment
              label="Tone"
              value={tone}
              onChange={setTone}
              options={[
                { id: 'casual', label: 'Casual' },
                { id: 'professional', label: 'Professional' },
              ]}
            />
            <Segment
              label="Style"
              value={style}
              onChange={setStyle}
              options={[
                { id: 'creative', label: 'Creative' },
                { id: 'precise', label: 'Precise' },
              ]}
            />
          </div>
        </Reveal>

        <Reveal delay={80} className="min-w-0">
          <ProductPreview length={length} tone={tone} style={style} />
        </Reveal>
      </div>
    </section>
  )
}
