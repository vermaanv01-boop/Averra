import Alert from '../ui/Alert.jsx'
import Spinner from '../ui/Spinner.jsx'

const ITEMS = [
  {
    key: 'exchangeRequests',
    title: 'Exchange requests',
    description: 'Requests, responses and cancellations, plus reviews received.'
  },
  {
    key: 'sessions',
    title: 'Session activities',
    description: 'Invitations, confirmations, reschedules, cancellations and completions.'
  },
  {
    key: 'messages',
    title: 'Messages',
    description: 'New messages from your exchange conversations.'
  }
]

export default function NotificationPreferences({ preferences, saving, loading, error, onChange }) {
  return (
    <section className="border-t border-ink-100 bg-white px-4 py-5 sm:px-6" aria-labelledby="notification-preferences-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="notification-preferences-title" className="text-lg text-ink-900">
            Notification preferences
          </h2>
          <p className="mt-1 text-xs leading-5 text-ink-500">
            Saved to your account. Reviews received follow the exchange requests preference.
          </p>
        </div>
        {loading ? <Spinner label="Loading preferences" /> : saving ? <Spinner label="Saving preferences" /> : null}
      </div>

      {error && (
        <div className="mb-4">
          <Alert variant="error">{error.message}</Alert>
        </div>
      )}

      <div className="divide-y divide-ink-100 rounded-lg border border-ink-200">
        {ITEMS.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-ink-900">{item.title}</p>
              <p className="mt-0.5 text-xs leading-5 text-ink-500">{item.description}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(preferences?.[item.key])}
              aria-label={item.title}
              disabled={loading || saving}
              onClick={() => onChange(item.key, !preferences?.[item.key])}
              className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${
                preferences?.[item.key]
                  ? 'border-lavender-500 bg-lavender-500'
                  : 'border-ink-300 bg-ivory-100'
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                  preferences?.[item.key] ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
