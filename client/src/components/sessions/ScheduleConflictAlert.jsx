import Alert from '../ui/Alert.jsx'
import { getConflictDetails } from '../../utils/errors.js'
import { formatUtc } from '../../utils/sessionFormat.js'

export default function ScheduleConflictAlert({ error, title = 'Scheduling conflict' }) {
  if (!error) return null

  const conflicts = getConflictDetails(error)
  const isConflict = error.status === 409 && conflicts.length > 0

  return (
    <Alert variant={isConflict ? 'warning' : 'error'} title={isConflict ? title : 'Request not completed'}>
      <p>{error.message || 'The action could not be completed.'}</p>
      {isConflict && (
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {conflicts.map((conflict, index) => (
            <li key={conflict.id || index}>
              <span className="font-medium text-ink-900">{conflict.title}</span>
              {conflict.startAt && (
                <span className="text-ink-600">
                  {' '}
                  · {formatUtc(conflict.startAt)}
                  {conflict.endAt ? ` – ${formatUtc(conflict.endAt)}` : ''}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Alert>
  )
}
