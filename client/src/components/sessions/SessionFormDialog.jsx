import { useEffect, useId, useMemo, useRef, useState } from 'react'
import Alert from '../ui/Alert.jsx'
import Button from '../ui/Button.jsx'
import Input from '../ui/Input.jsx'
import Modal from '../ui/Modal.jsx'
import Select from '../ui/Select.jsx'
import Spinner from '../ui/Spinner.jsx'
import Textarea from '../ui/Textarea.jsx'
import ScheduleConflictAlert from './ScheduleConflictAlert.jsx'
import {
  MEETING_METHODS,
  MEETING_METHOD_LABELS,
  SESSION_TIMEZONES
} from '../../utils/constants.js'
import { formatDuration, formatUtc } from '../../utils/sessionFormat.js'
import { validateSessionForm } from '../../utils/sessionValidation.js'

const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
const timezoneOptions = SESSION_TIMEZONES.includes(localZone)
  ? SESSION_TIMEZONES
  : [localZone, ...SESSION_TIMEZONES]
const durationOptions = [15, 30, 45, 60, 90, 120, 180, 240, 300, 360, 420, 480].map((value) => ({
  value: String(value),
  label: formatDuration(value)
}))
const methodOptions = MEETING_METHODS.map((value) => ({ value, label: MEETING_METHOD_LABELS[value] }))

function initialValues(mode, session) {
  if (mode === 'reschedule' && session) {
    return {
      scheduledDate: session.scheduledDate || '',
      startTime: session.startTime || '',
      duration: String(session.duration || 60),
      timezone: session.timezone || localZone
    }
  }

  return {
    exchangeRequestId: '',
    title: '',
    description: '',
    scheduledDate: '',
    startTime: '',
    duration: '60',
    timezone: localZone,
    meetingMethod: 'online',
    meetingLink: '',
    location: ''
  }
}

function requestLabel(request, currentUserId) {
  const other = [request.sender, request.recipient].find((person) => person?.id !== currentUserId)
  const skills = [request.offeredSkill?.name, request.requestedSkill?.name].filter(Boolean).join(' ↔ ')
  return [other?.name || 'Exchange', skills].filter(Boolean).join(' · ')
}

export default function SessionFormDialog({
  open,
  mode = 'create',
  session,
  acceptedRequests = [],
  currentUserId,
  submitting = false,
  serverError,
  onClose,
  onSubmit
}) {
  const formId = useId()
  const timezoneListId = useId()
  const submittingRef = useRef(false)
  const [values, setValues] = useState(() => initialValues(mode, session))
  const [errors, setErrors] = useState({})
  const [attempted, setAttempted] = useState(false)

  useEffect(() => {
    if (!open) return
    submittingRef.current = false
    setValues(initialValues(mode, session))
    setErrors({})
    setAttempted(false)
  }, [open, mode, session])

  const preview = useMemo(() => validateSessionForm(values, mode), [values, mode])
  const scheduleErrors = ['scheduledDate', 'startTime', 'duration', 'timezone']
  const hasScheduleErrors = scheduleErrors.some((field) => preview.errors[field])
  const requestOptions = acceptedRequests.map((request) => ({
    value: request.id,
    label: requestLabel(request, currentUserId)
  }))

  function setField(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submittingRef.current) return

    const validation = validateSessionForm(values, mode)
    if (Object.keys(validation.errors).length > 0) {
      setAttempted(true)
      setErrors(validation.errors)
      return
    }

    submittingRef.current = true
    setAttempted(false)
    setErrors({})
    await onSubmit(validation.payload)
    submittingRef.current = false
  }

  const showLink = mode === 'create' && ['online', 'other'].includes(values.meetingMethod)
  const showLocation = mode === 'create' && ['in-person', 'other'].includes(values.meetingMethod)
  const hasAcceptedRequests = acceptedRequests.length > 0

  return (
    <Modal
      open={open}
      title={mode === 'create' ? 'Propose a session' : 'Propose a new time'}
      description={
        mode === 'create'
          ? 'Schedule a real exchange with an accepted partner.'
          : 'Your partner must accept the new time before it replaces the current schedule.'
      }
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" disabled={submitting} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            loading={submitting}
            disabled={submitting || (mode === 'create' && !hasAcceptedRequests)}
          >
            {mode === 'create' ? 'Send proposal' : 'Propose time'}
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-6">
        <ScheduleConflictAlert error={serverError} />

        {mode === 'create' && !hasAcceptedRequests && (
          <Alert variant="info" title="No accepted exchanges yet">
            Sessions can only be proposed for accepted exchange requests.
          </Alert>
        )}

        {mode === 'reschedule' && session && (
          <Alert variant="info" title="Current schedule">
            <p>
              {session.scheduledDate} · {session.startTime} · {formatDuration(session.duration)} ·{' '}
              {session.timezone}
            </p>
          </Alert>
        )}

        {mode === 'create' && (
          <div className="space-y-4">
            <Select
              label="Exchange"
              placeholder="Select an accepted exchange"
              options={requestOptions}
              value={values.exchangeRequestId}
              error={attempted ? errors.exchangeRequestId : ''}
              disabled={submitting}
              required
              onChange={(event) => setField('exchangeRequestId', event.target.value)}
            />
            <Input
              label="Session title"
              value={values.title}
              maxLength={120}
              placeholder="e.g. Portfolio walkthrough"
              error={attempted ? errors.title : ''}
              disabled={submitting}
              required
              onChange={(event) => setField('title', event.target.value)}
            />
            <Textarea
              label="Details"
              value={values.description}
              maxLength={1000}
              rows={3}
              placeholder="What will you work on together?"
              helperText="Optional · up to 1000 characters"
              error={attempted ? errors.description : ''}
              disabled={submitting}
              onChange={(event) => setField('description', event.target.value)}
            />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Date"
            type="date"
            value={values.scheduledDate}
            error={attempted ? errors.scheduledDate : ''}
            disabled={submitting}
            required
            onChange={(event) => setField('scheduledDate', event.target.value)}
          />
          <Input
            label="Start time"
            type="time"
            value={values.startTime}
            error={attempted ? errors.startTime : ''}
            helperText="24-hour local time"
            disabled={submitting}
            required
            onChange={(event) => setField('startTime', event.target.value)}
          />
          <Select
            label="Duration"
            options={durationOptions}
            value={String(values.duration)}
            error={attempted ? errors.duration : ''}
            disabled={submitting}
            required
            onChange={(event) => setField('duration', event.target.value)}
          />
          <div>
            <Input
              label="Timezone"
              value={values.timezone}
              list={timezoneListId}
              placeholder="America/New_York"
              error={attempted ? errors.timezone : ''}
              helperText="IANA timezone"
              disabled={submitting}
              required
              onChange={(event) => setField('timezone', event.target.value)}
            />
            <datalist id={timezoneListId}>
              {timezoneOptions.map((zone) => (
                <option key={zone} value={zone} />
              ))}
            </datalist>
          </div>
        </div>

        {!hasScheduleErrors && preview.startAt && (
          <p className="rounded-lg border border-lavender-200 bg-lavender-50 px-3.5 py-2.5 text-xs leading-5 text-lavender-800">
            UTC preview: {formatUtc(preview.startAt)} → {formatUtc(preview.endAt)}
          </p>
        )}

        {mode === 'create' && (
          <div className="space-y-4 border-t border-ink-100 pt-5">
            <Select
              label="Meeting method"
              options={methodOptions}
              value={values.meetingMethod}
              error={attempted ? errors.meetingMethod : ''}
              disabled={submitting}
              required
              onChange={(event) => setField('meetingMethod', event.target.value)}
            />
            {showLink && (
              <Input
                label="Meeting link"
                type="url"
                value={values.meetingLink}
                placeholder="https://"
                error={attempted ? errors.meetingLink : ''}
                helperText={values.meetingMethod === 'online' ? 'Required for online sessions' : 'Optional'}
                disabled={submitting}
                onChange={(event) => setField('meetingLink', event.target.value)}
              />
            )}
            {showLocation && (
              <Input
                label="Location"
                value={values.location}
                maxLength={200}
                placeholder="City, venue, or address"
                error={attempted ? errors.location : ''}
                helperText={values.meetingMethod === 'in-person' ? 'Required for in-person sessions' : 'Optional'}
                disabled={submitting}
                onChange={(event) => setField('location', event.target.value)}
              />
            )}
          </div>
        )}
      </form>
    </Modal>
  )
}
