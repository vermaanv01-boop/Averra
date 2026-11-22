import { CalendarDays, Clock3, MapPin, Video } from 'lucide-react'
import Badge from '../ui/Badge.jsx'
import Button from '../ui/Button.jsx'
import StatusBadge from './StatusBadge.jsx'
import {
  MEETING_METHOD_LABELS,
  SESSION_ACTIVE_STATUSES
} from '../../utils/constants.js'
import { formatDateParts, formatDuration, formatMeeting } from '../../utils/sessionFormat.js'

export default function SessionCard({
  session,
  currentUserId,
  busy = false,
  onView,
  onAccept,
  onDecline,
  onReschedule,
  onCancel,
  onComplete,
  onRespondReschedule
}) {
  const date = formatDateParts(session.scheduledDate)
  const meeting = formatMeeting(session)
  const other = session.participants?.find((participant) => participant.id !== currentUserId)
  const isProposer = session.proposedBy?.id === currentUserId
  const canRespond = session.status === 'pending' && !isProposer
  const pendingProposal = session.reschedulingHistory?.find((proposal) => proposal.status === 'pending')
  const canRespondToProposal =
    session.status === 'reschedule_requested' && pendingProposal && pendingProposal.proposedBy?.id !== currentUserId
  const canReschedule = session.status === 'confirmed'
  const canCancel = SESSION_ACTIVE_STATUSES.includes(session.status)
  const exchange = session.exchangeRequest

  return (
    <article className="flex h-full flex-col rounded-card border border-ink-200/80 bg-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-lavender-300 hover:shadow-lift">
      <div className="flex gap-4 p-5">
        <div className="flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-lavender-200 bg-lavender-50 text-lavender-700">
          <span className="text-[10px] font-semibold tracking-[0.16em]">{date.month}</span>
          <span className="text-2xl leading-tight text-ink-900">{date.day}</span>
          <span className="text-[10px] text-ink-500">{date.year}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-lg leading-snug text-ink-900">{session.title}</h3>
            <StatusBadge status={session.status} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              {session.startTime} · {formatDuration(session.duration)}
            </span>
            <span>{session.timezone}</span>
          </p>
          {other && (
            <p className="mt-2 truncate text-sm text-ink-600">
              With <span className="text-ink-900">{other.name}</span> · @{other.username}
            </p>
          )}
        </div>
      </div>

      {session.description && (
        <p className="line-clamp-2 px-5 pb-4 text-sm leading-6 text-ink-600">{session.description}</p>
      )}

      <div className="mx-5 space-y-2 border-t border-ink-100 py-4 text-xs text-ink-600">
        {meeting.value && (
          <p className="flex items-start gap-2">
            {session.meetingMethod === 'online' ? (
              <Video className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lavender-600" aria-hidden="true" />
            ) : (
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lavender-600" aria-hidden="true" />
            )}
            <span>
              <span className="font-medium text-ink-900">{MEETING_METHOD_LABELS[session.meetingMethod]}</span>
              {' · '}
              {meeting.href ? (
                <a href={meeting.href} target="_blank" rel="noreferrer" className="break-all hover:text-lavender-700">
                  {meeting.value}
                </a>
              ) : (
                meeting.value
              )}
            </span>
          </p>
        )}
        {exchange && (
          <p className="flex items-start gap-2">
            <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lavender-600" aria-hidden="true" />
            <span>
              {exchange.offeredSkill?.name || '一'} ↔ {exchange.requestedSkill?.name || '一'}
            </span>
          </p>
        )}
      </div>

      {pendingProposal && (
        <div className="mx-5 mb-4 rounded-lg border border-lavender-200 bg-lavender-50 px-3 py-2.5 text-xs leading-5 text-lavender-800">
          <p className="font-medium">New time proposed</p>
          <p>
            {pendingProposal.scheduledDate} · {pendingProposal.startTime} · {formatDuration(pendingProposal.duration)} ·{' '}
            {pendingProposal.timezone}
          </p>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-ink-100 px-5 py-4">
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => onView(session.id)}>
          Details
        </Button>
        {canRespond && (
          <>
            <Button size="sm" loading={busy} onClick={() => onAccept(session)}>
              Accept
            </Button>
            <Button variant="danger" size="sm" disabled={busy} onClick={() => onDecline(session)}>
              Decline
            </Button>
          </>
        )}
        {canRespondToProposal && (
          <>
            <Button size="sm" loading={busy} onClick={() => onRespondReschedule(session, pendingProposal, 'accept')}>
              Accept new time
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => onRespondReschedule(session, pendingProposal, 'reject')}
            >
              Reject
            </Button>
          </>
        )}
        {isProposer && session.status === 'pending' && (
          <Badge tone="neutral">Awaiting response</Badge>
        )}
        {canReschedule && (
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => onReschedule(session)}>
            Reschedule
          </Button>
        )}
        {session.status === 'confirmed' && (
          <Button variant="subtle" size="sm" disabled={busy} onClick={() => onComplete(session)}>
            Complete
          </Button>
        )}
        {canCancel && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => onCancel(session)}>
            Cancel
          </Button>
        )}
      </div>
    </article>
  )
}
