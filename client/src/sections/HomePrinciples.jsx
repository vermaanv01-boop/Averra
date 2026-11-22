import { CalendarCheck, Compass, Scale } from 'lucide-react'
import PageContainer from '../components/common/PageContainer.jsx'

const principles = [
  {
    icon: Compass,
    title: 'Clear intent',
    description: 'Say what you offer and what you hope to learn before the conversation begins.'
  },
  {
    icon: Scale,
    title: 'Fair exchange',
    description: 'Keep expectations visible so both people know what the exchange involves.'
  },
  {
    icon: CalendarCheck,
    title: 'Follow-through',
    description: 'Plan sessions in one place and keep the details easy to find.'
  }
]

export default function HomePrinciples() {
  return (
    <section className="py-16 sm:py-20">
      <PageContainer>
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lavender-700">
            How Averra works
          </p>
          <h2 className="mt-3 text-3xl text-ink-900 sm:text-4xl">
            Good exchanges start with good structure.
          </h2>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {principles.map(({ icon: Icon, title, description }, index) => (
            <article
              key={title}
              className="animate-fade-in rounded-card border border-ink-200/80 bg-white p-5 shadow-soft"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-lavender-200 bg-lavender-50 text-lavender-700">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg text-ink-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-600">{description}</p>
            </article>
          ))}
        </div>
      </PageContainer>
    </section>
  )
}
