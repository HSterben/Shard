type BrandMarkProps = {
  className?: string
  /** Light mark for dark backgrounds */
  inverted?: boolean
}

export default function BrandMark({ className = 'h-7 w-7', inverted = false }: BrandMarkProps) {
  const src = inverted ? '/brand/Proxy-Tp-Light.svg' : '/brand/Proxy-Tp-Dark.svg'

  return (
    <img
      src={src}
      alt=""
      className={className}
      width={28}
      height={28}
      aria-hidden="true"
    />
  )
}
