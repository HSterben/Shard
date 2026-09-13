import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getPostBySlug } from '../data/blog'
import Reveal from '../components/ui/Reveal'
import NotFound from './NotFound'

export default function Article() {
  const { slug } = useParams()
  const post = slug ? getPostBySlug(slug) : undefined

  if (!post) return <NotFound />

  return (
    <article className="bg-canvas pb-20 pt-28 text-ink">
      <div className="mx-auto w-full max-w-3xl px-5 md:px-8">
        <Reveal>
          <Link
            to="/blog"
            className="mb-8 inline-flex min-h-11 items-center gap-2 text-sm text-ink/50 transition-colors duration-200 hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            Back to blog
          </Link>

          <div className="flex items-center gap-3 text-xs text-ink/45">
            <span className="font-medium uppercase tracking-[0.12em] text-signal">{post.category}</span>
            <span>{post.date}</span>
            <span>{post.readTime}</span>
          </div>

          <h1 className="display mt-4 text-3xl font-semibold md:text-4xl">{post.title}</h1>
          <p className="mt-4 text-lg text-ink/55">{post.excerpt}</p>
        </Reveal>

        <Reveal delay={100}>
          <div className="mt-10 aspect-[16/9] overflow-hidden rounded-[10px]">
            <img src={post.image} alt={post.title} className="h-full w-full object-cover grayscale" />
          </div>
        </Reveal>

        <Reveal delay={200}>
          <div className="mt-10 space-y-6">
            {post.content.map((paragraph, i) => (
              <p key={i} className="text-base leading-relaxed text-ink/60">
                {paragraph}
              </p>
            ))}
          </div>
        </Reveal>
      </div>
    </article>
  )
}
