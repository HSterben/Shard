type SparklineProps = {
  className?: string
}

export default function Sparkline({ className = '' }: SparklineProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 320 88"
      fill="none"
      aria-hidden="true"
    >
      <g stroke="#2F6BFF" strokeOpacity="0.12" strokeWidth="1">
        {Array.from({ length: 8 }, (_, i) => (
          <line key={`v-${i}`} x1={i * 40 + 20} y1="8" x2={i * 40 + 20} y2="80" />
        ))}
        {Array.from({ length: 4 }, (_, i) => (
          <line key={`h-${i}`} x1="8" y1={i * 24 + 8} x2="312" y2={i * 24 + 8} />
        ))}
      </g>
      <path
        d="M12 64 C40 62, 52 48, 78 46 S120 58, 148 36 S196 18, 224 28 S276 52, 308 22"
        stroke="#2F6BFF"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
