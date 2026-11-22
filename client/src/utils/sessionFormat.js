const utcFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
})

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
})

export function formatUtc(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${utcFormatter.format(date)} UTC`
}

export function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return dateFormatter.format(date)
}

export function formatDateParts(scheduledDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate || '')) {
    return { month: '—', day: '—', year: '' }
  }
  const [year, month, day] = scheduledDate.split('-')
  const monthName = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(
    new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  )
  return { month: monthName.toUpperCase(), day, year }
}

export function formatDuration(minutes) {
  const value = Number(minutes)
  if (!Number.isFinite(value) || value <= 0) return ''
  const hours = Math.floor(value / 60)
  const rest = value % 60
  if (!hours) return `${rest}m`
  if (!rest) return `${hours}h`
  return `${hours}h ${rest}m`
}

export function formatMeeting(session) {
  if (!session) return { label: '', value: '' }
  if (session.meetingMethod === 'online') {
    return { label: 'Meeting link', value: session.meetingLink || '', href: session.meetingLink || '' }
  }
  if (session.meetingMethod === 'in-person') {
    return { label: 'Location', value: session.location || '' }
  }
  return {
    label: 'Meeting details',
    value: [session.meetingLink, session.location].filter(Boolean).join(' · ')
  }
}
