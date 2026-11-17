const AppError = require('./AppError')

const datePattern = /^\d{4}-\d{2}-\d{2}$/
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/

const isValidTimeZone = (timeZone) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch (error) {
    return false
  }
}

const isValidCalendarDate = (value) => {
  if (!datePattern.test(value)) {
    return false
  }

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

const partsInZone = (date, timeZone) => {
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

const localTimeToUtc = (scheduledDate, startTime, timeZone) => {
  const [year, month, day] = scheduledDate.split('-').map(Number)
  const [hour, minute] = startTime.split(':').map(Number)
  let candidate = Date.UTC(year, month - 1, day, hour, minute)

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = partsInZone(new Date(candidate), timeZone)
    const candidateAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute
    )
    const offset = candidateAsUtc - candidate

    if (offset === 0) {
      break
    }

    candidate -= offset
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

const buildSchedule = ({ scheduledDate, startTime, duration, timezone }) => {
  if (!isValidCalendarDate(scheduledDate)) {
    throw new AppError('scheduledDate must be a real calendar date in YYYY-MM-DD format', 400)
  }

  if (!timePattern.test(startTime)) {
    throw new AppError('startTime must use HH:mm in 24-hour format', 400)
  }

  if (!isValidTimeZone(timezone)) {
    throw new AppError('timezone must be a valid IANA timezone', 400)
  }

  const startAt = localTimeToUtc(scheduledDate, startTime, timezone)

  if (!startAt) {
    throw new AppError('The proposed local time does not exist in the selected timezone', 400)
  }

  if (startAt.getTime() <= Date.now()) {
    throw new AppError('Sessions must be scheduled in the future', 400)
  }

  const endAt = new Date(startAt.getTime() + duration * 60 * 1000)

  return { startAt, endAt }
}

module.exports = {
  buildSchedule,
  isValidCalendarDate,
  isValidTimeZone
}
