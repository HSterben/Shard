import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

type RevealProps = {
  children: ReactNode
  className?: string
  delay?: number
}

export default function Reveal({ children, className = '', delay = 0 }: RevealProps) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.14, margin: '0px 0px -8% 0px' }}
      transition={
        reduce
          ? { duration: 0.2 }
          : { type: 'spring', bounce: 0, duration: 0.45, delay: delay / 1000 }
      }
    >
      {children}
    </motion.div>
  )
}
