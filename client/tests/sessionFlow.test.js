import assert from 'node:assert/strict'
import test from 'node:test'
import { ApiError, getConflictDetails } from '../src/utils/errors.js'
import {
  formatDateParts,
  formatDuration,
  formatMeeting,
  formatUtc
} from '../src/utils/sessionFormat.js'
import {
  isValidCalendarDate,
  isValidTimeZone,
  localTimeToUtc,
  validateSessionForm
} from '../src/utils/sessionValidation.js'

const REQUEST_ID = '507f1f77bcf86cd799439011'
const FUTURE_DATE = '2030-06-15'

function createValues(overrides = {}) {
  return {
    exchangeRequestId: REQUEST_ID,
    title: 'Portfolio walkthrough',
    description: 'Bring your questions',
    scheduledDate: FUTURE_DATE,
    startTime: '10:00',
    duration: 60,
    timezone: 'America/New_York',
    meetingMethod: 'online',
    meetingLink: 'https://example.com/meet',
    location: '',
    ...overrides
  }
}

test('create payload matches the backend schema and UTC conversion', () => {
  const result = validateSessionForm(createValues())

  assert.deepEqual(result.errors, {})
  assert.deepEqual(Object.keys(result.payload).sort(), [
    'description',
    'duration',
    'exchangeRequestId',
    'location',
    'meetingLink',
    'meetingMethod',
    'scheduledDate',
    'startTime',
    'timezone',
    'title'
  ])
  assert.equal(result.payload.exchangeRequestId, REQUEST_ID)
  assert.equal(result.startAt.toISOString(), '2030-06-15T14:00:00.000Z')
  assert.equal(result.endAt.toISOString(), '2030-06-15T15:00:00.000Z')
})

test('reschedule payload contains only the four fields accepted by the backend', () => {
  const result = validateSessionForm(
    createValues({
      scheduledDate: '2030-07-01',
      startTime: '15:00',
      timezone: 'Europe/London',
      meetingLink: 'not-a-url'
    }),
    'reschedule'
  )

  assert.deepEqual(result.errors, {})
  assert.deepEqual(Object.keys(result.payload).sort(), [
    'duration',
    'scheduledDate',
    'startTime',
    'timezone'
  ])
  assert.equal(result.startAt.toISOString(), '2030-07-01T14:00:00.000Z')
})

test('invalid, past, and impossible local times are rejected before submission', () => {
  assert.equal(isValidCalendarDate('2030-02-30'), false)
  assert.match(validateSessionForm(createValues({ scheduledDate: '2030-02-30' })).errors.scheduledDate, /real date/)
  assert.match(validateSessionForm(createValues({ startTime: '25:00' })).errors.startTime, /HH:mm/)
  assert.match(
    validateSessionForm(createValues({ scheduledDate: '2020-01-01', timezone: 'UTC' })).errors
      .scheduledDate,
    /future/
  )
  assert.equal(localTimeToUtc('2028-03-12', '02:30', 'America/New_York'), null)
  assert.match(
    validateSessionForm(
      createValues({ scheduledDate: '2028-03-12', startTime: '02:30' })
    ).errors.startTime,
    /does not exist/
  )
})

test('timezone validation accepts IANA names and rejects unknown ones', () => {
  assert.equal(isValidTimeZone('America/New_York'), true)
  assert.equal(isValidTimeZone('Not/A_Zone'), false)
  assert.match(validateSessionForm(createValues({ timezone: 'Not/A_Zone' })).errors.timezone, /IANA/)
})

test('meeting method requirements mirror the backend cross-field rules', () => {
  assert.match(
    validateSessionForm(createValues({ meetingLink: '' })).errors.meetingLink,
    /required for online/
  )
  assert.match(
    validateSessionForm(
      createValues({ meetingMethod: 'in-person', meetingLink: '', location: '' })
    ).errors.location,
    /required for in-person/
  )
  assert.deepEqual(
    validateSessionForm(
      createValues({ meetingMethod: 'other', meetingLink: '', location: '' })
    ).errors,
    {}
  )
  assert.match(
    validateSessionForm(createValues({ meetingLink: 'not-a-url' })).errors.meetingLink,
    /valid URL/
  )
})

test('exchange request id must be a valid object id', () => {
  assert.match(
    validateSessionForm(createValues({ exchangeRequestId: 'not-an-id' })).errors.exchangeRequestId,
    /accepted exchange/
  )
})

test('scheduling conflict details are extracted from backend 409 errors', () => {
  const error = new ApiError('Scheduling conflict: 1 confirmed session(s) overlap the proposed time', {
    status: 409,
    details: [
      {
        id: 'abcdefabcdefabcdefabcdef',
        title: 'Existing session',
        startAt: '2030-06-15T13:00:00.000Z',
        endAt: '2030-06-15T14:30:00.000Z'
      }
    ]
  })

  const conflicts = getConflictDetails(error)
  assert.equal(conflicts.length, 1)
  assert.equal(conflicts[0].title, 'Existing session')
  assert.equal(conflicts[0].startAt, '2030-06-15T13:00:00.000Z')
  assert.deepEqual(getConflictDetails(new ApiError('Request failed', { status: 409 })), [])
})

test('calendar tiles and UTC labels are formatted from backend fields', () => {
  assert.deepEqual(formatDateParts('2030-07-01'), { month: 'JUL', day: '01', year: '2030' })
  assert.equal(formatDuration(90), '1h 30m')
  assert.equal(formatUtc('2030-06-15T14:00:00.000Z').includes('14:00 UTC'), true)
  assert.deepEqual(formatMeeting({ meetingMethod: 'online', meetingLink: 'https://example.com' }), {
    label: 'Meeting link',
    value: 'https://example.com',
    href: 'https://example.com'
  })
  assert.deepEqual(formatMeeting({ meetingMethod: 'in-person', location: 'Main library' }), {
    label: 'Location',
    value: 'Main library'
  })
})
