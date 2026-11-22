const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

function asTrimmed(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function isValidTimeZone(timeZone) {
  if (!timeZone) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

export function isValidCalendarDate(value) {
  if (!DATE_PATTERN.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function partsInZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date)

  const valueOf = (type) => parts.find((part) => part.type === type)?.value
  const hour = Number(valueOf('hour'))
  return {
    year: Number(valueOf('year')),
    month: Number(valueOf('month')),
    day: Number(valueOf('day')),
    hour: hour === 24 ? 0 : hour,
    minute: Number(valueOf('minute'))
  }
}

export function localTimeToUtc(scheduledDate, startTime, timeZone) {
  if (!isValidCalendarDate(scheduledDate) || !TIME_PATTERN.test(startTime) || !isValidTimeZone(timeZone)) {
    return null
  }

  const [year, month, day] = scheduledDate.split('-').map(Number)
  const [hour, minute] = startTime.split(':').map(Number)
  const target = Date.UTC(year, month - 1, day, hour, minute)
  let candidate = target

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = partsInZone(new Date(candidate), timeZone)
    const wallTimeAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute
    )
    const nextCandidate = target - (wallTimeAsUtc - candidate)
    if (nextCandidate === candidate) break
    candidate = nextCandidate
  }

  const result = new Date(candidate)
  const parts = partsInZone(result, timeZone)
  const matches =
    parts.year === year &&
    parts.month === month &&
    parts.day === day &&
    parts.hour === hour &&
    parts.minute === minute

  return matches ? result : null
}

function normalize(values) {
  return {
    exchangeRequestId: asTrimmed(values.exchangeRequestId),
    title: asTrimmed(values.title),
    description: asTrimmed(values.description),
    scheduledDate: asTrimmed(values.scheduledDate),
    startTime: asTrimmed(values.startTime),
    duration: values.duration === '' || values.duration === undefined ? NaN : Number(values.duration),
    timezone: asTrimmed(values.timezone),
    meetingMethod: asTrimmed(values.meetingMethod),
    meetingLink: asTrimmed(values.meetingLink),
    location: asTrimmed(values.location)
  }
}

export function validateSessionForm(values = {}, mode = 'create') {
  const normalized = normalize(values)
  const errors = {}

  if (mode === 'create') {
    if (!normalized.exchangeRequestId) {
      errors.exchangeRequestId = 'Choose an accepted exchange request'
    }
    if (normalized.title.length < 2 || normalized.title.length > 120) {
      errors.title = 'Title must be between 2 and 120 characters'
    }
    if (normalized.description.length > 1000) {
      errors.description = 'Details must be 1000 characters or fewer'
    }
  }

  if (!isValidCalendarDate(normalized.scheduledDate)) {
    errors.scheduledDate = 'Enter a real date in YYYY-MM-DD format'
  }

  if (!TIME_PATTERN.test(normalized.startTime)) {
    errors.startTime = 'Use HH:mm in 24-hour format'
  }

  if (!Number.isInteger(normalized.duration) || normalized.duration < 15 || normalized.duration > 480) {
    errors.duration = 'Duration must be between 15 and 480 minutes'
  }

  if (!isValidTimeZone(normalized.timezone) || normalized.timezone.length > 64) {
    errors.timezone = 'Enter a valid IANA timezone'
  }

  let startAt = null
  let endAt = null

  if (!errors.scheduledDate && !errors.startTime && !errors.timezone) {
    startAt = localTimeToUtc(normalized.scheduledDate, normalized.startTime, normalized.timezone)
    if (!startAt) {
      errors.startTime = 'This local time does not exist in the selected timezone'
    } else if (startAt.getTime() <= Date.now()) {
      errors.scheduledDate = 'Choose a date and time in the future'
    } else if (!errors.duration) {
      endAt = new Date(startAt.getTime() + normalized.duration * 60 * 1000)
    }
  }

  if (mode === 'create') {
    if (!['online', 'in-person', 'other'].includes(normalized.meetingMethod)) {
      errors.meetingMethod = 'Choose a meeting method'
    }

    if (normalized.meetingLink) {
      try {
        new URL(normalized.meetingLink)
      } catch {
        errors.meetingLink = 'Enter a valid URL or leave this blank'
      }
    }

    if (normalized.meetingMethod === 'online' && !normalized.meetingLink) {
      errors.meetingLink = 'A meeting link is required for online sessions'
    }

    if (normalized.location.length > 200) {
      errors.location = 'Location must be 200 characters or fewer'
    }

    if (normalized.meetingMethod === 'in-person' && !normalized.location) {
      errors.location = 'A location is required for in-person sessions'
    }
  }

  const payload =
    mode === 'create'
      ? {
          exchangeRequestId: normalized.exchangeRequestId,
          title: normalized.title,
          description: normalized.description,
          scheduledDate: normalized.scheduledDate,
          startTime: normalized.startTime,
          duration: normalized.duration,
          timezone: normalized.timezone,
          meetingMethod: normalized.meetingMethod,
          meetingLink: normalized.meetingLink,
          location: normalized.location
        }
      : {
          scheduledDate: normalized.scheduledDate,
          startTime: normalized.startTime,
          duration: normalized.duration,
          timezone: normalized.timezone
        }

  return { errors, payload, startAt, endAt }
}
