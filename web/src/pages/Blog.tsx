import { Link } from 'react-router-dom'
import { blogPosts } from '../data/blog'
import Reveal from '../components/ui/Reveal'

export default function Blog() {
  return (
    <>
      <section className="bg-black pb-12 pt-28 text-white">
        <div className="page">
          <Reveal className="card max-w-2xl p-8 text-ink md:p-12">
            <p className="eyebrow">Blog</p>
            <h1 className="display mt-4 font-semibold">Insights from the PROXY X team</h1>
            <p className="mt-4 max-w-[42ch] text-lg text-ink/55">
              Guides on fine-tuning, speed, and getting the most from your AI assistant.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="bg-canvas pb-20 pt-10 text-ink">
        <div className="page grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {blogPosts.map((post, i) => (
            <Reveal key={post.slug} delay={i * 60}>
              <Link to={`/blog/${post.slug}`} className="group card block overflow-hidden">
                <div className="aspect-[16/10] overflow-hidden">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="h-full w-full object-cover grayscale transition-opacity duration-200 group-hover:opacity-90"
                    loading="lazy"
                  />
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3 text-xs text-ink/45">
                    <span className="font-medium uppercase tracking-[0.12em] text-signal">{post.category}</span>
                    <span>{post.date}</span>
                  </div>
                  <h2 className="mt-3 text-xl font-semibold">{post.title}</h2>
                  <p className="mt-2 line-clamp-2 text-base text-ink/55">{post.excerpt}</p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  )
}
