import { ArrowUpRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import Orb from '../Orb'
import ProductPreview from '../ui/ProductPreview'
import { HeroNav } from '../layout/Navbar'

export default function Hero() {
  const reduce = useReducedMotion()
  const enter = (delay: number) =>
    reduce
      ? { initial: false as const, animate: { opacity: 1 }, transition: { duration: 0.2 } }
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.22, delay },
        }

  return (
    <section className="section-dark min-h-screen px-3 pb-4 pt-4 md:min-h-[100dvh] md:px-4 md:pb-5 md:pt-5">
      <div className="mx-auto flex h-full max-w-[1400px] flex-col">
        <HeroNav />

        <div className="grid flex-1 grid-cols-6 gap-2 md:grid-cols-12 md:grid-rows-[minmax(280px,34vh)_minmax(140px,auto)_minmax(120px,auto)] md:gap-3">
          <motion.div
            className="hero-radius col-span-6 flex min-h-[220px] items-end bg-paper p-7 text-ink md:col-span-5 md:col-start-1 md:row-start-1 md:min-h-0 md:p-10 lg:p-12"
            {...enter(0)}
          >
            <h1 className="text-[1.65rem] font-semibold leading-[1.12] tracking-tight sm:text-3xl md:text-[2rem] lg:text-[2.45rem]">
              Intelligence that responds.
              <br />
              Customization that lasts.
            </h1>
          </motion.div>

          <motion.div
            className="hero-radius col-span-3 hidden aspect-square items-center justify-center bg-paper md:col-span-2 md:col-start-11 md:row-start-1 md:flex"
            {...enter(0.05)}
          >
            <Link
              to="/contact"
              className="pressable flex h-full w-full items-center justify-center"
              aria-label="Get the app"
            >
              <ArrowUpRight className="h-[4.25rem] w-[4.25rem] text-ink lg:h-[5rem] lg:w-[5rem]" strokeWidth={1.15} />
            </Link>
          </motion.div>

          <motion.div
            className="hero-radius relative col-span-6 aspect-square overflow-hidden bg-ink md:col-span-5 md:col-start-6 md:row-span-3 md:row-start-1 md:aspect-auto md:min-h-0"
            initial={reduce ? false : { opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.24, delay: 0.08 }}
          >
            <div className="absolute inset-0">
              <Orb hue={0} hoverIntensity={0} rotateOnHover backgroundColor="#080B0F" />
            </div>
          </motion.div>

          <motion.div
            className="hero-radius col-span-6 flex flex-col justify-between bg-paper p-5 text-ink md:col-span-2 md:col-start-11 md:row-span-2 md:row-start-2 md:min-h-[220px] md:p-6"
            {...enter(0.12)}
          >
            <Sparkles className="h-5 w-5 text-ink/35" strokeWidth={1.5} />
            <p className="text-[15px] leading-snug">
              <span className="font-semibold">Impact:</span>{' '}
              <span className="text-muted-dark">
                One assistant on desktop and the web, synced, instant, everywhere.
              </span>
            </p>
          </motion.div>

          <motion.div
            className="col-span-6 flex flex-col justify-between gap-6 px-1 md:col-span-5 md:col-start-1 md:row-span-2 md:row-start-2 md:px-2"
            {...enter(0.06)}
          >
            <div>
              <p className="max-w-sm text-[15px] leading-relaxed text-light/75 md:max-w-[22rem] md:text-base">
                PROXY X is a lightweight, fine-tune customizable AI assistant, native app and web,
                built for speed and shaped entirely by you.
              </p>
              <Link to="/#features" className="link-underline-light mt-5 w-fit">
                Discover more
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>

            <ProductPreview compact showOrb={false} />
          </motion.div>

          <motion.div className="col-span-6 flex gap-2 md:hidden" {...enter(0.22)}>
            <Link
              to="/contact"
              className="pressable hero-radius flex flex-1 items-center justify-center bg-paper p-5"
              aria-label="Get the app"
            >
              <ArrowUpRight className="h-10 w-10 text-ink" strokeWidth={1.25} />
            </Link>
            <Link
              to="/contact"
              className="pressable hero-radius flex min-h-11 flex-[2] items-center justify-center gap-2 bg-brand-surface p-5 text-[15px] font-semibold text-ink"
            >
              Get the app
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
