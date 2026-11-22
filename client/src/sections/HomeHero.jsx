import { ArrowRight } from 'lucide-react'
import PageContainer from '../components/common/PageContainer.jsx'
import { buttonStyles } from '../components/ui/Button.jsx'
import { Link } from 'react-router-dom'

export default function HomeHero() {
  return (
    <section className="border-b border-ink-200/70">
      <PageContainer className="grid gap-12 py-16 md:grid-cols-[1.05fr_0.95fr] md:items-center md:py-24">
        <div className="animate-rise">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lavender-700">
            A considered marketplace for skills
          </p>
          <h1 className="mt-5 max-w-2xl text-balance text-4xl leading-[1.08] text-ink-900 sm:text-5xl lg:text-6xl">
            Trade what you know for what you want to learn.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-ink-600">
            Averra gives skill exchange a clear structure: find the right people, agree on the terms,
            and keep every session moving.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/register" className={buttonStyles({ size: 'lg' })}>
              Create your account
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link to="/login" className={buttonStyles({ variant: 'secondary', size: 'lg' })}>
              Sign in
            </Link>
          </div>
        </div>

        <div className="animate-fade-in">
          <div className="rounded-card border border-ink-200 bg-white p-6 shadow-soft">
            <div className="flex items-start justify-between gap-4 border-b border-ink-100 pb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                  Exchange note
                </p>
                <h2 className="mt-2 text-xl text-ink-900">A clear plan, from first hello.</h2>
              </div>
              <span className="rounded-full border border-lavender-200 bg-lavender-50 px-2.5 py-1 text-xs font-medium text-lavender-700">
                Draft
              </span>
            </div>

            <dl className="divide-y divide-ink-100 text-sm">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4 py-4">
                <dt className="text-ink-500">Offering</dt>
                <dd className="text-ink-900">Product design</dd>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4 py-4">
                <dt className="text-ink-500">Looking for</dt>
                <dd className="text-ink-900">Frontend engineering</dd>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4 py-4">
                <dt className="text-ink-500">Next step</dt>
                <dd className="text-ink-900">Agree on a time</dd>
              </div>
            </dl>

            <div className="mt-5 flex items-center gap-2 rounded-lg bg-ivory-100 px-3.5 py-3 text-xs text-ink-600">
              <span className="h-1.5 w-1.5 rounded-full bg-lavender-500" aria-hidden="true" />
              Structured exchanges, without the noise.
            </div>
          </div>
        </div>
      </PageContainer>
    </section>
  )
}
