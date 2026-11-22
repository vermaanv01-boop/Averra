import Spinner from '../ui/Spinner.jsx'

export default function LoadingScreen({ message = 'Loading…' }) {
  return (
    <div className="flex min-h-[55vh] items-center justify-center px-5">
      <div className="flex items-center gap-3 rounded-lg border border-ink-200/70 bg-white px-4 py-3 text-sm text-ink-600 shadow-soft">
        <Spinner />
        <span>{message}</span>
      </div>
    </div>
  )
}
