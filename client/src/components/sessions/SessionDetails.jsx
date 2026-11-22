import Alert from '../ui/Alert.jsx'
import Badge from '../ui/Badge.jsx'
import Button from '../ui/Button.jsx'
import Modal from '../ui/Modal.jsx'
import Spinner from '../ui/Spinner.jsx'
import StatusBadge from './StatusBadge.jsx'
import { MEETING_METHOD_LABELS, formatLabel } from '../../utils/constants.js'
import { formatDuration, formatMeeting, formatUtc } from '../../utils/sessionFormat.js'

function DetailRow({ label, children }) {
  if (children === undefined || children === null || children === '') return null
  return (
    <div className="flex flex-col gap-1 border-b border-ink-100 py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <dt className="text-xs font-medium uppercase tracking-[0.12em] text-ink-500">{label}</dt>
      <dd className="break-words text-sm leading-6 text-ink-900 sm:text-right">{children}</dd>
    </div>
  )
}

function Person({ person, currentUserId }) {
  if (!person) return null
  const isSelf = person.id === currentUserId
  return (
    <div className="flex items-center gap-3 rounded-lg border border-ink-100 bg-ivory-50 px-3 py-2.5">
      {person.profileImage ? (
        <img src={person.profileImage} alt="" className="h-9 w-9 rounded-full border border-ink-200 object-cover" />
      ) : (
        <span className="grid h-9 w-9 place-items-center rounded-full border border-lavender-200 bg-lavender-100 text-xs font-semibold text-lavender-700">
          {person.name?.slice(0, 1).toUpperCase() || 'A'}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm text-ink-900">{person.name}</p>
        <p className="truncate text-xs text-ink-500">@{person.username}</p>
      </div>
      {isSelf && <Badge tone="lavender">You</Badge>}
    </div>
  )
}

export default function SessionDetails({ open, session, loading, error, currentUserId, onClose }) {
  const meeting = session ? formatMeeting(session) : null
  const exchange = session?.exchangeRequest

  return (
    <Modal
      open={open}
      title="Session details"
      description={session?.title || ''}
      onClose={onClose}
      footer={
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      {loading && (
        <div className="grid h-48 place-items-center">
          <Spinner label="Loading session details" />
        </div>
      )}

      {!loading && error && <Alert variant="error">{error.message}</Alert>}

      {!loading && !error && session && (
        <div className="space-y-7">
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-ink-900">Status</h3>
              <StatusBadge status={session.status} />
            </div>
            <dl>
              <DetailRow label="Scheduled date">{session.scheduledDate}</DetailRow>
              <DetailRow label="Start time">{session.startTime}</DetailRow>
              <DetailRow label="Duration">{formatDuration(session.duration)}</DetailRow>
              <DetailRow label="Timezone">{session.timezone}</DetailRow>
              <DetailRow label="Starts (UTC)">{formatUtc(session.startAt)}</DetailRow>
              <DetailRow label="Ends (UTC)">{formatUtc(session.endAt)}</DetailRow>
            </dl>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-ink-900">Participants</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {(session.participants || []).map((person) => (
                <Person key={person.id} person={person} currentUserId={currentUserId} />
              ))}
            </div>
            {session.proposedBy && (
              <p className="mt-2 text-xs text-ink-500">Proposed by {session.proposedBy.name}</p>
            )}
          </section>

          {exchange && (
            <section>
              <h3 className="mb-3 text-sm font-semibold text-ink-900">Related exchange</h3>
              <dl>
                <DetailRow label="Request status">{formatLabel(exchange.status)}</DetailRow>
                <DetailRow label="Offered skill">{exchange.offeredSkill?.name}</DetailRow>
                <DetailRow label="Requested skill">{exchange.requestedSkill?.name}</DetailRow>
                <DetailRow label="Exchange created">{formatUtc(exchange.createdAt)}</DetailRow>
              </dl>
            </section>
          )}

          <section>
            <h3 className="mb-3 text-sm font-semibold text-ink-900">Meeting</h3>
            <dl>
              <DetailRow label="Method">{MEETING_METHOD_LABELS[session.meetingMethod]}</DetailRow>
              {meeting.href ? (
                <DetailRow label={meeting.label}>
                  <a href={meeting.href} target="_blank" rel="noreferrer" className="break-all text-lavender-700 hover:text-lavender-600">
                    {meeting.value}
                  </a>
                </DetailRow>
              ) : (
                <DetailRow label={meeting.label}>{meeting.value}</DetailRow>
              )}
              <DetailRow label="Description">{session.description}</DetailRow>
            </dl>
          </section>

          {(session.cancellationReason || session.cancelledAt || session.completedAt) && (
            <section>
              <h3 className="mb-3 text-sm font-semibold text-ink-900">Outcome</h3>
              <dl>
                <DetailRow label="Reason">{session.cancellationReason}</DetailRow>
                <DetailRow label="Cancelled">{formatUtc(session.cancelledAt)}</DetailRow>
                <DetailRow label="Completed">{formatUtc(session.completedAt)}</DetailRow>
              </dl>
            </section>
          )}

          {session.reschedulingHistory?.length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-semibold text-ink-900">Rescheduling history</h3>
              <ul className="space-y-3">
                {session.reschedulingHistory.map((proposal) => (
                  <li key={proposal.id} className="rounded-lg border border-ink-100 bg-ivory-50 p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm text-ink-900">
                        {proposal.scheduledDate} · {proposal.startTime} · {formatDuration(proposal.duration)}
                      </p>
                      <Badge tone={proposal.status === 'accepted' ? 'success' : proposal.status === 'rejected' ? 'danger' : 'warning'}>
                        {formatLabel(proposal.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-ink-500">
                      {proposal.timezone} · proposed by {proposal.proposedBy?.name || 'a participant'} ·{' '}
                      {formatUtc(proposal.proposedAt)}
                    </p>
                    {proposal.resolvedAt && (
                      <p className="mt-1 text-xs text-ink-500">Resolved {formatUtc(proposal.resolvedAt)}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="mb-3 text-sm font-semibold text-ink-900">Record</h3>
            <dl>
              <DetailRow label="Created">{formatUtc(session.createdAt)}</DetailRow>
              <DetailRow label="Updated">{formatUtc(session.updatedAt)}</DetailRow>
            </dl>
          </section>
        </div>
      )}
    </Modal>
  )
}
