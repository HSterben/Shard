import { Link } from 'react-router-dom'
import Button from '../components/ui/Button'

export default function NotFound() {
  return (
    <section className="flex min-h-[70vh] flex-col items-center justify-center bg-canvas px-6 pt-28 text-center text-ink">
      <p className="display-hero font-semibold text-ink/10">404</p>
      <h1 className="mt-4 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-ink/50">That URL is not on this site.</p>
      <div className="mt-8 flex gap-4">
        <Button href="/" variant="primary">Back to home</Button>
        <Link to="/contact" className="link-underline">Contact</Link>
      </div>
    </section>
  )
}
