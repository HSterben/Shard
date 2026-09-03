import Hero from '../components/home/Hero'
import ProofStrip from '../components/home/ProofStrip'
import Benefits from '../components/home/Benefits'
import Process from '../components/home/Process'
import Customize from '../components/home/Customize'
import Pricing from '../components/home/Pricing'
import FAQ from '../components/home/FAQ'
import CTABanner from '../components/home/CTABanner'

export default function Home() {
  return (
    <>
      <Hero />
      <ProofStrip />
      <Benefits />
      <Process />
      <Customize />
      <Pricing />
      <FAQ />
      <CTABanner />
    </>
  )
}
