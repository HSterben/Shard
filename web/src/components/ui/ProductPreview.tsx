import Orb from '../Orb'

export type LengthMode = 'concise' | 'detailed'
export type ToneMode = 'casual' | 'professional'
export type StyleMode = 'creative' | 'precise'

type ProductPreviewProps = {
  length?: LengthMode
  tone?: ToneMode
  style?: StyleMode
  processing?: boolean
  showOrb?: boolean
  compact?: boolean
  className?: string
}

const replies: Record<`${LengthMode}-${ToneMode}-${StyleMode}`, string> = {
  'concise-professional-precise':
    'Here is a tighter client email: thank them, confirm the timeline, and ask for the two missing assets by Friday.',
  'concise-professional-creative':
    'Lead with the outcome, then one clear ask. I can draft a version that still sounds like you.',
  'concise-casual-precise':
    'Short version: thanks, timeline confirmed, need those two files by Friday.',
  'concise-casual-creative':
    'Keep it light and short, thanks, we’re on track, send the files when you can this week.',
  'detailed-professional-precise':
    'Thank you for the update. We can keep the original Friday delivery if we receive the remaining two assets by end of day Thursday. I’ll send a revised outline once those files are in.',
  'detailed-professional-creative':
    'Appreciate the note. We’re in a good place on structure. If the remaining assets arrive Thursday, I can turn around a polished draft Friday morning and leave room for your review.',
  'detailed-casual-precise':
    'Thanks for the update. If those two files land Thursday, we still hit Friday. I’ll send a revised outline as soon as I have them.',
  'detailed-casual-creative':
    'Thanks, we’re in good shape. Send the last two files when you can; I’ll reshape the draft around them and have something ready for Friday.',
}

export default function ProductPreview({
  length = 'concise',
  tone = 'professional',
  style = 'precise',
  processing = false,
  showOrb = true,
  compact = false,
  className = '',
}: ProductPreviewProps) {
  const reply = replies[`${length}-${tone}-${style}`]
  const preset = tone === 'professional' ? 'Writing' : 'Everyday'

  return (
    <div className={`relative ${compact ? '' : 'h-full'} ${className}`}>
      {showOrb && (
        <div
          className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 opacity-40 md:h-52 md:w-52"
          aria-hidden="true"
        >
          <Orb hue={0} hoverIntensity={0} rotateOnHover={false} backgroundColor="#080B0F" />
        </div>
      )}

      <div
        className={`relative flex flex-col overflow-hidden border ${
          compact
            ? 'rounded-[1.25rem] border-border-dark bg-surface-dark'
            : 'h-full rounded-[10px] border-white/10 bg-black shadow-[0_24px_60px_rgb(0_0_0_/_0.35)]'
        }`}
      >
        <div className={`flex items-center justify-between border-b ${compact ? 'border-border-dark px-3 py-2' : 'border-white/10 px-3 py-2.5 md:px-4 md:py-3'}`}>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-light/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-light/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-light/20" />
            <p className="ml-2 text-sm font-medium text-light">PROXY X</p>
          </div>
          <p className="text-xs font-medium text-muted-light">Windows · Web</p>
        </div>

        <div className={`grid min-h-0 flex-1 ${compact ? '' : 'md:grid-cols-[148px_1fr]'}`}>
          {!compact && (
            <aside className="hidden border-r border-white/10 p-3 md:block">
              <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">
                Presets
              </p>
              {['Writing', 'Everyday', 'Research'].map((name) => (
                <div
                  key={name}
                  className={`rounded-[8px] px-2 py-2 text-sm ${
                    name === preset ? 'bg-white/10 text-signal' : 'text-white/45'
                  }`}
                >
                  {name}
                </div>
              ))}
            </aside>
          )}

          <div
            className={`flex flex-col ${
              compact ? 'gap-2 p-3' : 'min-h-[320px] p-3 md:min-h-[380px] md:p-5'
            }`}
          >
            {compact ? null : (
            <div className="mb-3 flex flex-wrap gap-2">
              <span className="rounded-[6px] border border-white/12 px-3 py-1 text-xs font-medium text-white">
                {length === 'concise' ? 'Concise' : 'Detailed'}
              </span>
              <span className="rounded-[6px] border border-white/12 px-3 py-1 text-xs font-medium text-white">
                {tone === 'casual' ? 'Casual' : 'Professional'}
              </span>
              <span className="rounded-[6px] bg-signal/15 px-3 py-1 text-xs font-medium text-signal">
                {style === 'creative' ? 'Creative' : 'Precise'}
              </span>
            </div>
            )}

            <div className={`ml-auto max-w-[85%] px-3 text-light ${compact ? 'rounded-[14px] bg-surface-elevated py-1.5 text-xs' : 'rounded-[10px] bg-white/10 py-2.5 text-sm leading-relaxed'}`}>
              Rewrite this paragraph for a client email.
            </div>

            <div className={`mt-2 max-w-[90%] px-3 text-light/90 ${compact ? 'line-clamp-2 rounded-[14px] border border-border-dark bg-graphite py-1.5 text-xs leading-snug' : 'mt-3 rounded-[10px] border border-white/10 bg-black py-2.5 text-sm leading-relaxed'}`}>
              {processing ? (
                <span className="inline-flex items-center gap-2 text-muted-light">
                  <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${compact ? 'bg-brand' : 'bg-signal'}`} />
                  Processing
                </span>
              ) : (
                reply
              )}
            </div>

            <div className={compact ? 'pt-2' : 'mt-auto pt-4'}>
              <div
                className={`flex items-center px-4 text-muted-light ${
                  compact
                    ? 'h-8 rounded-full border border-border-dark bg-graphite text-xs'
                    : 'min-h-11 rounded-[10px] border border-white/10 bg-black text-sm'
                }`}
              >
                Ask PROXY X…
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
