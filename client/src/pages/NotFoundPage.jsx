import { Link } from 'react-router-dom'
import PageContainer from '../components/common/PageContainer.jsx'
import { buttonStyles } from '../components/ui/Button.jsx'

export default function NotFoundPage() {
  return (
    <PageContainer size="narrow" className="flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <div className="animate-rise">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lavender-700">404</p>
        <h1 className="mt-4 text-4xl text-ink-900 sm:text-5xl">This page isn’t here.</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-ink-600">
          The address may have changed, or the page may not exist yet.
        </p>
        <Link to="/" className={`${buttonStyles({ size: 'lg' })} mt-8`}>
          Back to home
        </Link>
      </div>
    </PageContainer>
  )
}
