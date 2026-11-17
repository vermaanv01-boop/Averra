const assert = require('node:assert/strict')
const { before, after, beforeEach, describe, it } = require('node:test')
const request = require('supertest')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-only-secret'
process.env.RATE_LIMIT_MAX = '10000'
process.env.AUTH_RATE_LIMIT_MAX = '1000'
process.env.BCRYPT_SALT_ROUNDS = '4'

let mongoServer
let app
let User
let Skill
let ExchangeRequest
let Session

const auth = (token) => ({ Authorization: `Bearer ${token}` })

const registerUser = async (suffix) => {
  const response = await request(app).post('/api/auth/register').send({
    name: `Session User ${suffix}`,
    username: `session${suffix}`,
    email: `session${suffix}@example.test`,
    password: 'Password1'
  })
  assert.equal(response.status, 201, JSON.stringify(response.body))
  return response.body.data
}

const createTeachSkill = async (token, name) => {
  const response = await request(app).post('/api/skills').set(auth(token)).send({
    name,
    category: 'technology',
    type: 'teach',
    proficiency: 'advanced',
    experience: 'Practice experience'
  })
  assert.equal(response.status, 201, JSON.stringify(response.body))
  return response.body.data.skill
}

const createAcceptedPair = async (firstUser, suffix) => {
  const secondUser = await registerUser(suffix)

  const [firstSkill, secondSkill] = await Promise.all([
    createTeachSkill(firstUser.token, `First skill ${suffix}`),
    createTeachSkill(secondUser.token, `Second skill ${suffix}`)
  ])

  const created = await request(app).post('/api/exchange-requests').set(auth(firstUser.token)).send({
    recipientId: secondUser.user.id,
    offeredSkillId: firstSkill.id,
    requestedSkillId: secondSkill.id
  })
  assert.equal(created.status, 201, JSON.stringify(created.body))

  const accepted = await request(app)
    .patch(`/api/exchange-requests/${created.body.data.request.id}/accept`)
    .set(auth(secondUser.token))
    .send({})
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body))

  return {
    firstUser,
    secondUser,
    firstSkill,
    secondSkill,
    requestId: created.body.data.request.id
  }
}

const newPair = async (suffix) => {
  const firstUser = await registerUser(`a${suffix}`)
  return createAcceptedPair(firstUser, `b${suffix}`)
}

const sessionPayload = (requestId, overrides = {}) => ({
  exchangeRequestId: requestId,
  title: 'Skill exchange session',
  description: 'Practice together',
  scheduledDate: '2028-06-15',
  startTime: '10:00',
  duration: 60,
  timezone: 'America/New_York',
  meetingMethod: 'online',
  meetingLink: 'https://meet.example.test/room',
  ...overrides
})

const proposeSession = async (token, requestId, overrides = {}) => {
  const response = await request(app)
    .post('/api/sessions')
    .set(auth(token))
    .send(sessionPayload(requestId, overrides))
  assert.equal(response.status, 201, JSON.stringify(response.body))
  return response.body.data.session
}

const acceptSession = async (token, sessionId) => {
  const response = await request(app)
    .patch(`/api/sessions/${sessionId}/accept`)
    .set(auth(token))
    .send({})
  assert.equal(response.status, 200, JSON.stringify(response.body))
  return response.body.data.session
}

before(async () => {
  mongoServer = await MongoMemoryServer.create()
  process.env.MONGODB_URI = mongoServer.getUri()

  app = require('../app')
  User = require('../models/User')
  Skill = require('../models/Skill')
  ExchangeRequest = require('../models/ExchangeRequest')
  Session = require('../models/Session')

  await mongoose.connect(mongoServer.getUri())
  await Promise.all([User.init(), Skill.init(), ExchangeRequest.init(), Session.init()])
})

after(async () => {
  await mongoose.disconnect()
  await mongoServer.stop()
})

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Skill.deleteMany({}),
    ExchangeRequest.deleteMany({}),
    Session.deleteMany({})
  ])
})

describe('Session creation', () => {
  it('creates a pending session with both exchange participants', async () => {
    const pair = await newPair(1)
    const session = await proposeSession(pair.firstUser.token, pair.requestId)

    assert.equal(session.status, 'pending')
    assert.equal(session.proposedBy.id, pair.firstUser.user.id)
    assert.equal(session.participants.length, 2)
    assert.deepEqual(
      session.participants.map((participant) => participant.id).sort(),
      [pair.firstUser.user.id, pair.secondUser.user.id].sort()
    )
    assert.equal(session.exchangeRequest.id, pair.requestId)
    assert.equal(session.startAt, '2028-06-15T14:00:00.000Z')
    assert.equal(session.endAt, '2028-06-15T15:00:00.000Z')
    assert.equal(session.email, undefined)
    assert.equal(session.passwordHash, undefined)
  })

  it('rejects outsiders and exchange requests that are not accepted', async () => {
    const pair = await newPair(2)
    const outsider = await registerUser('outsider2')

    const outsiderResponse = await request(app)
      .post('/api/sessions')
      .set(auth(outsider.token))
      .send(sessionPayload(pair.requestId))
    assert.equal(outsiderResponse.status, 404)

    const firstUser = await registerUser('pendinga2')
    const secondUser = await registerUser('pendingb2')
    const firstSkill = await createTeachSkill(firstUser.token, 'Pending first skill')
    const secondSkill = await createTeachSkill(secondUser.token, 'Pending second skill')
    const created = await request(app)
      .post('/api/exchange-requests')
      .set(auth(firstUser.token))
      .send({
        recipientId: secondUser.user.id,
        offeredSkillId: firstSkill.id,
        requestedSkillId: secondSkill.id
      })

    const pendingResponse = await request(app)
      .post('/api/sessions')
      .set(auth(firstUser.token))
      .send(sessionPayload(created.body.data.request.id))
    assert.equal(pendingResponse.status, 409)
    assert.match(pendingResponse.body.message, /accepted exchange requests/)
  })

  it('rejects completed exchange requests', async () => {
    const pair = await newPair(3)
    await request(app)
      .patch(`/api/exchange-requests/${pair.requestId}/complete`)
      .set(auth(pair.firstUser.token))
      .send({})

    const response = await request(app)
      .post('/api/sessions')
      .set(auth(pair.firstUser.token))
      .send(sessionPayload(pair.requestId))
    assert.equal(response.status, 409)
  })

  it('rejects past dates, invalid calendar dates, invalid durations and bad meeting details', async () => {
    const pair = await newPair(4)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const past = await request(app)
      .post('/api/sessions')
      .set(auth(pair.firstUser.token))
      .send(sessionPayload(pair.requestId, {
        scheduledDate: yesterday,
        startTime: '10:00',
        timezone: 'UTC'
      }))
    assert.equal(past.status, 400)

    const impossibleDate = await request(app)
      .post('/api/sessions')
      .set(auth(pair.firstUser.token))
      .send(sessionPayload(pair.requestId, { scheduledDate: '2028-02-30' }))
    assert.equal(impossibleDate.status, 400)

    const shortDuration = await request(app)
      .post('/api/sessions')
      .set(auth(pair.firstUser.token))
      .send(sessionPayload(pair.requestId, { duration: 10 }))
    assert.equal(shortDuration.status, 400)

    const longDuration = await request(app)
      .post('/api/sessions')
      .set(auth(pair.firstUser.token))
      .send(sessionPayload(pair.requestId, { duration: 500 }))
    assert.equal(longDuration.status, 400)

    const onlineWithoutLink = await request(app)
      .post('/api/sessions')
      .set(auth(pair.firstUser.token))
      .send(sessionPayload(pair.requestId, { meetingLink: '' }))
    assert.equal(onlineWithoutLink.status, 400)

    const inPersonWithoutLocation = await request(app)
      .post('/api/sessions')
      .set(auth(pair.firstUser.token))
      .send(sessionPayload(pair.requestId, {
        meetingMethod: 'in-person',
        meetingLink: '',
        location: ''
      }))
    assert.equal(inPersonWithoutLocation.status, 400)

    const invalidTimezone = await request(app)
      .post('/api/sessions')
      .set(auth(pair.firstUser.token))
      .send(sessionPayload(pair.requestId, { timezone: 'Mars/Olympus' }))
    assert.equal(invalidTimezone.status, 400)
  })

  it('rejects local times that do not exist because of daylight saving changes', async () => {
    const pair = await newPair(5)

    const response = await request(app)
      .post('/api/sessions')
      .set(auth(pair.firstUser.token))
      .send(sessionPayload(pair.requestId, {
        scheduledDate: '2028-03-12',
        startTime: '02:30',
        timezone: 'America/New_York'
      }))
    assert.equal(response.status, 400)
    assert.match(response.body.message, /does not exist/)
  })

  it('prevents a second active session for the same exchange request', async () => {
    const pair = await newPair(6)
    await proposeSession(pair.firstUser.token, pair.requestId)

    const duplicate = await request(app)
      .post('/api/sessions')
      .set(auth(pair.firstUser.token))
      .send(sessionPayload(pair.requestId, { scheduledDate: '2028-06-16' }))
    assert.equal(duplicate.status, 409)
  })
})

describe('Session responses and conflicts', () => {
  it('allows the recipient to accept or decline, but not the proposer', async () => {
    const acceptedPair = await newPair(7)
    const session = await proposeSession(acceptedPair.firstUser.token, acceptedPair.requestId)

    const proposerResponse = await request(app)
      .patch(`/api/sessions/${session.id}/accept`)
      .set(auth(acceptedPair.firstUser.token))
      .send({})
    assert.equal(proposerResponse.status, 403)

    const accepted = await acceptSession(acceptedPair.secondUser.token, session.id)
    assert.equal(accepted.status, 'confirmed')

    const repeat = await request(app)
      .patch(`/api/sessions/${session.id}/accept`)
      .set(auth(acceptedPair.secondUser.token))
      .send({})
    assert.equal(repeat.status, 409)

    const declinedPair = await newPair(8)
    const declinedSession = await proposeSession(
      declinedPair.firstUser.token,
      declinedPair.requestId
    )
    const declined = await request(app)
      .patch(`/api/sessions/${declinedSession.id}/decline`)
      .set(auth(declinedPair.secondUser.token))
      .send({})
    assert.equal(declined.status, 200)
    assert.equal(declined.body.data.session.status, 'declined')
  })

  it('detects overlapping confirmed sessions across different timezones on acceptance', async () => {
    const firstPair = await newPair(9)
    const firstSession = await proposeSession(firstPair.firstUser.token, firstPair.requestId)
    await acceptSession(firstPair.secondUser.token, firstSession.id)

    const secondPair = await createAcceptedPair(firstPair.firstUser, 'c9')
    const secondSession = await proposeSession(secondPair.secondUser.token, secondPair.requestId, {
      timezone: 'Europe/London',
      startTime: '15:00',
      title: 'Overlapping session'
    })
    assert.equal(secondSession.startAt, '2028-06-15T14:00:00.000Z')

    const conflict = await request(app)
      .patch(`/api/sessions/${secondSession.id}/accept`)
      .set(auth(firstPair.firstUser.token))
      .send({})
    assert.equal(conflict.status, 409)
    assert.match(conflict.body.message, /Scheduling conflict/)
    assert.equal(conflict.body.details[0].id, firstSession.id)

    const unchanged = await request(app)
      .get(`/api/sessions/${secondSession.id}`)
      .set(auth(firstPair.firstUser.token))
    assert.equal(unchanged.body.data.session.status, 'pending')
  })
})

describe('Rescheduling', () => {
  it('accepts a rescheduling proposal and updates the session schedule', async () => {
    const pair = await newPair(10)
    const session = await proposeSession(pair.firstUser.token, pair.requestId)
    await acceptSession(pair.secondUser.token, session.id)

    const proposed = await request(app)
      .post(`/api/sessions/${session.id}/reschedule-requests`)
      .set(auth(pair.firstUser.token))
      .send({
        scheduledDate: '2028-06-16',
        startTime: '15:00',
        duration: 90,
        timezone: 'Europe/London'
      })
    assert.equal(proposed.status, 200, JSON.stringify(proposed.body))
    assert.equal(proposed.body.data.session.status, 'reschedule_requested')
    assert.equal(proposed.body.data.session.reschedulingHistory.length, 1)
    const proposalId = proposed.body.data.session.reschedulingHistory[0].id

    const selfResponse = await request(app)
      .patch(`/api/sessions/${session.id}/reschedule-requests/${proposalId}/accept`)
      .set(auth(pair.firstUser.token))
      .send({})
    assert.equal(selfResponse.status, 403)

    const accepted = await request(app)
      .patch(`/api/sessions/${session.id}/reschedule-requests/${proposalId}/accept`)
      .set(auth(pair.secondUser.token))
      .send({})
    assert.equal(accepted.status, 200, JSON.stringify(accepted.body))
    assert.equal(accepted.body.data.session.status, 'confirmed')
    assert.equal(accepted.body.data.session.scheduledDate, '2028-06-16')
    assert.equal(accepted.body.data.session.startTime, '15:00')
    assert.equal(accepted.body.data.session.duration, 90)
    assert.equal(accepted.body.data.session.timezone, 'Europe/London')
    assert.equal(accepted.body.data.session.startAt, '2028-06-16T14:00:00.000Z')
    assert.equal(accepted.body.data.session.reschedulingHistory[0].status, 'accepted')
  })

  it('rejects a rescheduling proposal and restores the confirmed status', async () => {
    const pair = await newPair(11)
    const session = await proposeSession(pair.firstUser.token, pair.requestId)
    await acceptSession(pair.secondUser.token, session.id)

    const proposed = await request(app)
      .post(`/api/sessions/${session.id}/reschedule-requests`)
      .set(auth(pair.secondUser.token))
      .send({
        scheduledDate: '2028-06-17',
        startTime: '11:00',
        duration: 60,
        timezone: 'America/New_York'
      })
    const proposalId = proposed.body.data.session.reschedulingHistory[0].id

    const rejected = await request(app)
      .patch(`/api/sessions/${session.id}/reschedule-requests/${proposalId}/reject`)
      .set(auth(pair.firstUser.token))
      .send({})
    assert.equal(rejected.status, 200)
    assert.equal(rejected.body.data.session.status, 'confirmed')
    assert.equal(rejected.body.data.session.scheduledDate, '2028-06-15')
    assert.equal(rejected.body.data.session.reschedulingHistory[0].status, 'rejected')
  })

  it('rejects overlapping rescheduling proposals', async () => {
    const firstPair = await newPair(12)
    const firstSession = await proposeSession(firstPair.firstUser.token, firstPair.requestId)
    await acceptSession(firstPair.secondUser.token, firstSession.id)

    const secondPair = await createAcceptedPair(firstPair.firstUser, 'c12')
    const secondSession = await proposeSession(secondPair.secondUser.token, secondPair.requestId, {
      startTime: '17:00'
    })
    await acceptSession(firstPair.firstUser.token, secondSession.id)

    const conflict = await request(app)
      .post(`/api/sessions/${secondSession.id}/reschedule-requests`)
      .set(auth(firstPair.firstUser.token))
      .send({
        scheduledDate: '2028-06-15',
        startTime: '15:00',
        duration: 60,
        timezone: 'Europe/London'
      })
    assert.equal(conflict.status, 409)
    assert.match(conflict.body.message, /Scheduling conflict/)
  })

  it('does not allow rescheduling a pending or completed session', async () => {
    const pair = await newPair(13)
    const session = await proposeSession(pair.firstUser.token, pair.requestId)

    const pendingResponse = await request(app)
      .post(`/api/sessions/${session.id}/reschedule-requests`)
      .set(auth(pair.firstUser.token))
      .send({
        scheduledDate: '2028-06-16',
        startTime: '10:00',
        duration: 60,
        timezone: 'America/New_York'
      })
    assert.equal(pendingResponse.status, 409)

    await acceptSession(pair.secondUser.token, session.id)
    await request(app)
      .patch(`/api/sessions/${session.id}/complete`)
      .set(auth(pair.firstUser.token))
      .send({})

    const completedResponse = await request(app)
      .post(`/api/sessions/${session.id}/reschedule-requests`)
      .set(auth(pair.firstUser.token))
      .send({
        scheduledDate: '2028-06-16',
        startTime: '10:00',
        duration: 60,
        timezone: 'America/New_York'
      })
    assert.equal(completedResponse.status, 409)
  })
})

describe('Cancellation, completion and authorization', () => {
  it('cancels an active session with a reason', async () => {
    const pair = await newPair(14)
    const session = await proposeSession(pair.firstUser.token, pair.requestId)
    await acceptSession(pair.secondUser.token, session.id)

    const cancelled = await request(app)
      .patch(`/api/sessions/${session.id}/cancel`)
      .set(auth(pair.firstUser.token))
      .send({ reason: 'Scheduling conflict on our side' })
    assert.equal(cancelled.status, 200)
    assert.equal(cancelled.body.data.session.status, 'cancelled')
    assert.equal(cancelled.body.data.session.cancellationReason, 'Scheduling conflict on our side')
  })

  it('completes a confirmed session and protects terminal states', async () => {
    const pair = await newPair(15)
    const session = await proposeSession(pair.firstUser.token, pair.requestId)

    const pendingComplete = await request(app)
      .patch(`/api/sessions/${session.id}/complete`)
      .set(auth(pair.firstUser.token))
      .send({})
    assert.equal(pendingComplete.status, 409)

    await acceptSession(pair.secondUser.token, session.id)

    const completed = await request(app)
      .patch(`/api/sessions/${session.id}/complete`)
      .set(auth(pair.secondUser.token))
      .send({})
    assert.equal(completed.status, 200)
    assert.equal(completed.body.data.session.status, 'completed')
    assert.ok(completed.body.data.session.completedAt)

    const repeatCancel = await request(app)
      .patch(`/api/sessions/${session.id}/cancel`)
      .set(auth(pair.firstUser.token))
      .send({ reason: 'Too late' })
    assert.equal(repeatCancel.status, 409)
  })

  it('hides sessions and blocks modifications for non-participants', async () => {
    const pair = await newPair(16)
    const outsider = await registerUser('outsider16')
    const session = await proposeSession(pair.firstUser.token, pair.requestId)

    const getResponse = await request(app)
      .get(`/api/sessions/${session.id}`)
      .set(auth(outsider.token))
    assert.equal(getResponse.status, 404)

    const actions = ['accept', 'decline', 'complete']
    for (const action of actions) {
      const response = await request(app)
        .patch(`/api/sessions/${session.id}/${action}`)
        .set(auth(outsider.token))
        .send({})
      assert.equal(response.status, 404)
    }

    const cancelResponse = await request(app)
      .patch(`/api/sessions/${session.id}/cancel`)
      .set(auth(outsider.token))
      .send({ reason: 'Not allowed' })
    assert.equal(cancelResponse.status, 404)

    const unauthenticated = await request(app).get('/api/sessions')
    assert.equal(unauthenticated.status, 401)
  })
})

describe('Session history', () => {
  it('returns upcoming, pending invitations, completed and cancelled sessions', async () => {
    const pendingPair = await newPair(17)
    await proposeSession(pendingPair.firstUser.token, pendingPair.requestId)

    const confirmedPair = await newPair(18)
    const confirmedSession = await proposeSession(
      confirmedPair.firstUser.token,
      confirmedPair.requestId
    )
    await acceptSession(confirmedPair.secondUser.token, confirmedSession.id)

    const completedPair = await newPair(19)
    const completedSession = await proposeSession(
      completedPair.firstUser.token,
      completedPair.requestId
    )
    await acceptSession(completedPair.secondUser.token, completedSession.id)
    await request(app)
      .patch(`/api/sessions/${completedSession.id}/complete`)
      .set(auth(completedPair.firstUser.token))
      .send({})

    const cancelledPair = await newPair(20)
    const cancelledSession = await proposeSession(
      cancelledPair.firstUser.token,
      cancelledPair.requestId
    )
    await request(app)
      .patch(`/api/sessions/${cancelledSession.id}/cancel`)
      .set(auth(cancelledPair.firstUser.token))
      .send({ reason: 'No longer needed' })

    const invitations = await request(app)
      .get('/api/sessions/pending-invitations')
      .set(auth(pendingPair.secondUser.token))
    assert.equal(invitations.status, 200)
    assert.equal(invitations.body.data.pagination.total, 1)

    const senderInvitations = await request(app)
      .get('/api/sessions/pending-invitations')
      .set(auth(pendingPair.firstUser.token))
    assert.equal(senderInvitations.body.data.pagination.total, 0)

    const upcoming = await request(app)
      .get('/api/sessions/upcoming')
      .set(auth(confirmedPair.firstUser.token))
    assert.equal(upcoming.status, 200)
    assert.equal(upcoming.body.data.pagination.total, 1)
    assert.equal(upcoming.body.data.items[0].id, confirmedSession.id)

    const completed = await request(app)
      .get('/api/sessions/completed')
      .set(auth(completedPair.firstUser.token))
    assert.equal(completed.status, 200)
    assert.equal(completed.body.data.pagination.total, 1)

    const cancelled = await request(app)
      .get('/api/sessions/cancelled')
      .set(auth(cancelledPair.firstUser.token))
    assert.equal(cancelled.status, 200)
    assert.equal(cancelled.body.data.pagination.total, 1)

    const all = await request(app).get('/api/sessions').set(auth(confirmedPair.firstUser.token))
    assert.equal(all.body.data.pagination.total, 1)
  })

  it('supports filtering by status and pagination', async () => {
    const user = await registerUser('filteruser')
    const firstPair = await createAcceptedPair(user, 'filtera')
    const secondPair = await createAcceptedPair(user, 'filterb')

    const firstSession = await proposeSession(user.token, firstPair.requestId)
    const secondSession = await proposeSession(user.token, secondPair.requestId, {
      scheduledDate: '2028-06-16'
    })
    await acceptSession(firstPair.secondUser.token, firstSession.id)
    await acceptSession(secondPair.secondUser.token, secondSession.id)

    const filtered = await request(app)
      .get('/api/sessions?status=confirmed&limit=1&page=2&sort=latest')
      .set(auth(user.token))
    assert.equal(filtered.status, 200)
    assert.equal(filtered.body.data.pagination.total, 2)
    assert.equal(filtered.body.data.pagination.totalPages, 2)
    assert.equal(filtered.body.data.items.length, 1)

    const dateFiltered = await request(app)
      .get('/api/sessions?from=2028-06-16&to=2028-06-16')
      .set(auth(user.token))
    assert.equal(dateFiltered.body.data.pagination.total, 1)
    assert.equal(dateFiltered.body.data.items[0].id, secondSession.id)

    const invalidQuery = await request(app)
      .get('/api/sessions?status=unknown')
      .set(auth(user.token))
    assert.equal(invalidQuery.status, 400)
  })

  it('rejects invalid identifiers', async () => {
    const user = await registerUser('invalidid')
    const response = await request(app)
      .get('/api/sessions/not-an-id')
      .set(auth(user.token))
    assert.equal(response.status, 400)
  })
})
