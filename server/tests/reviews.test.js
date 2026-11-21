const assert = require('node:assert/strict')
const http = require('node:http')
const { before, after, beforeEach, afterEach, describe, it } = require('node:test')
const request = require('supertest')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')
const { io: ioClient } = require('socket.io-client')

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-only-secret'
process.env.RATE_LIMIT_MAX = '10000'
process.env.AUTH_RATE_LIMIT_MAX = '1000'
process.env.BCRYPT_SALT_ROUNDS = '4'
process.env.REVIEW_REPORT_THRESHOLD = '2'

let mongoServer
let app
let io
let httpServer
let baseUrl
let User
let Skill
let ExchangeRequest
let Notification
let Review
let ReviewReport
let ratingService
let reviewService
let closeSocket
let sockets = []

const auth = (token) => ({ Authorization: `Bearer ${token}` })
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const registerUser = async (suffix) => {
  const response = await request(app).post('/api/auth/register').send({
    name: `Review User ${suffix}`,
    username: `review${suffix}`,
    email: `review${suffix}@example.test`,
    password: 'Password1'
  })
  assert.equal(response.status, 201, JSON.stringify(response.body))
  return response.body.data
}

const createSkill = async (token, name) => {
  const response = await request(app)
    .post('/api/skills')
    .set(auth(token))
    .send({ name, category: 'technology', type: 'teach', proficiency: 'advanced' })
  assert.equal(response.status, 201, JSON.stringify(response.body))
  return response.body.data.skill
}

const createExchange = async (label, sender, recipient, accept = true) => {
  const [offered, requested] = await Promise.all([
    createSkill(sender.token, `Offer ${label}`),
    createSkill(recipient.token, `Request ${label}`)
  ])

  const created = await request(app)
    .post('/api/exchange-requests')
    .set(auth(sender.token))
    .send({
      recipientId: recipient.user.id,
      offeredSkillId: offered.id,
      requestedSkillId: requested.id
    })
  assert.equal(created.status, 201, JSON.stringify(created.body))
  const requestId = created.body.data.request.id

  if (accept) {
    const accepted = await request(app)
      .patch(`/api/exchange-requests/${requestId}/accept`)
      .set(auth(recipient.token))
      .send({})
    assert.equal(accepted.status, 200, JSON.stringify(accepted.body))
  }

  return requestId
}

const completeExchange = async (label, sender, recipient) => {
  const requestId = await createExchange(label, sender, recipient, true)
  const completed = await request(app)
    .patch(`/api/exchange-requests/${requestId}/complete`)
    .set(auth(sender.token))
    .send({})
  assert.equal(completed.status, 200, JSON.stringify(completed.body))
  return requestId
}

const createCompletedPair = async (label) => {
  const sender = await registerUser(`${label}a`)
  const recipient = await registerUser(`${label}b`)
  const requestId = await completeExchange(label, sender, recipient)
  return { sender, recipient, requestId }
}

const reviewPayload = (requestId, overrides = {}) => ({
  exchangeRequestId: requestId,
  overallRating: 5,
  teachingRating: 4,
  learningRating: 4,
  comment: 'A genuinely useful exchange.',
  ...overrides
})

const postReview = async (token, requestId, overrides = {}) =>
  request(app)
    .post('/api/reviews')
    .set(auth(token))
    .send(reviewPayload(requestId, overrides))

const getReviews = (path, token) => request(app).get(path).set(auth(token))

const statsFor = (userId) => ratingService.getStats(userId)

const createSocket = (token) => {
  const socket = ioClient(baseUrl, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    auth: token ? { token } : {}
  })
  sockets.push(socket)
  return socket
}

const waitConnected = (socket) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('connect timeout')), 3000)
    socket.once('connect', () => {
      clearTimeout(timer)
      resolve(socket)
    })
    socket.once('connect_error', reject)
  })

const waitForRoom = async (room, socketId) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (io.sockets.adapter.rooms.get(room)?.has(socketId)) return
    await delay(20)
  }
  throw new Error(`timeout waiting for room ${room}`)
}

const onceEvent = (socket, event, timeoutMs = 2500) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler)
      reject(new Error(`timeout waiting for ${event}`))
    }, timeoutMs)
    const handler = (payload) => {
      clearTimeout(timer)
      socket.off(event, handler)
      resolve(payload)
    }
    socket.on(event, handler)
  })

before(async () => {
  mongoServer = await MongoMemoryServer.create()
  process.env.MONGODB_URI = mongoServer.getUri()

  app = require('../app')
  User = require('../models/User')
  Skill = require('../models/Skill')
  ExchangeRequest = require('../models/ExchangeRequest')
  Notification = require('../models/Notification')
  Review = require('../models/Review')
  ReviewReport = require('../models/ReviewReport')
  ratingService = require('../services/rating.service')
  reviewService = require('../services/review.service')

  const socketModule = require('../socket')
  closeSocket = socketModule.closeSocket

  await mongoose.connect(mongoServer.getUri())
  await Promise.all([
    User.init(),
    Skill.init(),
    ExchangeRequest.init(),
    Notification.init(),
    Review.init(),
    ReviewReport.init()
  ])

  httpServer = http.createServer(app)
  io = socketModule.initSocket(httpServer)
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`
})

after(async () => {
  await closeSocket(io)
  if (httpServer.listening) {
    await new Promise((resolve) => httpServer.close(resolve))
  }
  await mongoose.disconnect()
  await mongoServer.stop()
})

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Skill.deleteMany({}),
    ExchangeRequest.deleteMany({}),
    Notification.deleteMany({}),
    Review.deleteMany({}),
    ReviewReport.deleteMany({})
  ])
})

afterEach(async () => {
  for (const socket of sockets) socket.close()
  sockets = []
})

describe('Review creation and eligibility', () => {
  it('creates a valid review for the other participant and updates reputation', async () => {
    const { sender, recipient, requestId } = await createCompletedPair('create')

    const response = await postReview(recipient.token, requestId)
    assert.equal(response.status, 201, JSON.stringify(response.body))
    const review = response.body.data.review || response.body.data

    assert.equal(review.exchangeRequest, requestId)
    assert.equal(review.reviewer.id, recipient.user.id)
    assert.equal(review.reviewee.id, sender.user.id)
    assert.equal(review.overallRating, 5)
    assert.equal(review.teachingRating, 4)
    assert.equal(review.learningRating, 4)
    assert.equal(review.comment, 'A genuinely useful exchange.')
    assert.equal(review.moderationStatus, 'visible')
    assert.equal(review.reportCount, 0)
    assert.equal(await Review.countDocuments({}), 1)

    const senderStats = await statsFor(sender.user.id)
    assert.equal(senderStats.totalReviews, 1)
    assert.equal(senderStats.averageOverallRating, 5)
    assert.equal(senderStats.averageTeachingRating, 4)
    assert.equal(senderStats.averageLearningRating, 4)
    assert.deepEqual(senderStats.ratingDistribution, [0, 0, 0, 0, 1])
    assert.equal(senderStats.completedExchanges, 1)
    assert.equal(senderStats.score, 4)

    const recipientStats = await statsFor(recipient.user.id)
    assert.equal(recipientStats.totalReviews, 0)
    assert.equal(recipientStats.completedExchanges, 1)
    assert.equal(recipientStats.score, 3)
  })

  it('blocks incomplete exchanges, non-participants, and self-review attempts', async () => {
    const sender = await registerUser('eligiblesa')
    const recipient = await registerUser('eligiblesb')
    const outsider = await registerUser('eligiblesx')
    const requestId = await createExchange('eligible', sender, recipient, false)

    const incomplete = await postReview(recipient.token, requestId)
    assert.equal(incomplete.status, 409, JSON.stringify(incomplete.body))

    const accepted = await request(app)
      .patch(`/api/exchange-requests/${requestId}/accept`)
      .set(auth(recipient.token))
      .send({})
    assert.equal(accepted.status, 200)
    const completed = await request(app)
      .patch(`/api/exchange-requests/${requestId}/complete`)
      .set(auth(sender.token))
      .send({})
    assert.equal(completed.status, 200)

    const outsiderResponse = await postReview(outsider.token, requestId)
    assert.equal(outsiderResponse.status, 404, JSON.stringify(outsiderResponse.body))

    const extraField = await request(app)
      .post('/api/reviews')
      .set(auth(recipient.token))
      .send({ ...reviewPayload(requestId), revieweeId: recipient.user.id })
    assert.equal(extraField.status, 400, JSON.stringify(extraField.body))

    await assert.rejects(
      Review.create({
        exchangeRequest: requestId,
        reviewer: recipient.user.id,
        reviewee: recipient.user.id,
        overallRating: 5,
        teachingRating: 5,
        learningRating: 5,
        comment: 'Self review'
      }),
      /cannot review themselves/
    )
  })

  it('rejects invalid rating values', async () => {
    const { recipient, requestId } = await createCompletedPair('ratingvalid')

    for (const overallRating of [0, 6, 1.5, '5', null]) {
      const response = await postReview(recipient.token, requestId, { overallRating })
      assert.equal(response.status, 400, JSON.stringify({ overallRating, body: response.body }))
    }

    const missing = await request(app)
      .post('/api/reviews')
      .set(auth(recipient.token))
      .send({
        exchangeRequestId: requestId,
        teachingRating: 5,
        learningRating: 5,
        comment: 'Missing overall rating'
      })
    assert.equal(missing.status, 400, JSON.stringify(missing.body))
    assert.equal(await Review.countDocuments({}), 0)
  })

  it('prevents duplicate reviews for the same exchange', async () => {
    const { recipient, requestId } = await createCompletedPair('duplicate')

    const first = await postReview(recipient.token, requestId)
    assert.equal(first.status, 201, JSON.stringify(first.body))
    const second = await postReview(recipient.token, requestId)
    assert.equal(second.status, 409, JSON.stringify(second.body))
    assert.equal(await Review.countDocuments({}), 1)
    assert.equal(
      await Notification.countDocuments({
        type: 'review_received',
        relatedEntity: first.body.data.id
      }),
      1
    )
  })
})

describe('Review retrieval, editing and deletion', () => {
  it('lists visible reviews for a user and an exchange with sorting and pagination', async () => {
    const recipient = await registerUser('listb')
    const reviewers = [
      await registerUser('lista'),
      await registerUser('listc'),
      await registerUser('listd')
    ]
    const ratings = [5, 4, 3]
    const requestIds = []

    for (const [index, reviewer] of reviewers.entries()) {
      requestIds.push(
        await completeExchange(`list${index}`, reviewer, recipient)
      )
      const response = await postReview(reviewer.token, requestIds[index], {
        overallRating: ratings[index]
      })
      assert.equal(response.status, 201, JSON.stringify(response.body))
    }

    const byUser = await getReviews(
      `/api/reviews/user/${recipient.user.id}?sort=highest&limit=2&page=1`,
      recipient.token
    )
    assert.equal(byUser.status, 200, JSON.stringify(byUser.body))
    assert.equal(byUser.body.data.reviews.length, 2)
    assert.equal(byUser.body.data.reviews[0].overallRating, 5)
    assert.equal(byUser.body.data.reviews[1].overallRating, 4)
    assert.equal(byUser.body.data.pagination.total, 3)
    assert.equal(byUser.body.data.pagination.hasNext, true)

    const byExchange = await getReviews(
      `/api/reviews/exchange/${requestIds[1]}`,
      recipient.token
    )
    assert.equal(byExchange.status, 200, JSON.stringify(byExchange.body))
    assert.equal(byExchange.body.data.reviews.length, 1)
    assert.equal(byExchange.body.data.reviews[0].overallRating, 4)

    const one = await getReviews(
      `/api/reviews/${byUser.body.data.reviews[0].id}`,
      recipient.token
    )
    assert.equal(one.status, 200, JSON.stringify(one.body))
    assert.equal(one.body.data.overallRating, 5)
  })

  it('allows only the original reviewer to edit or delete and recalculates stats', async () => {
    const { sender, recipient, requestId } = await createCompletedPair('edit')
    const created = await postReview(recipient.token, requestId)
    assert.equal(created.status, 201)
    const reviewId = created.body.data.id

    const wrongEditor = await request(app)
      .patch(`/api/reviews/${reviewId}`)
      .set(auth(sender.token))
      .send({ overallRating: 2 })
    assert.equal(wrongEditor.status, 403, JSON.stringify(wrongEditor.body))

    const edited = await request(app)
      .patch(`/api/reviews/${reviewId}`)
      .set(auth(recipient.token))
      .send({ overallRating: 2, comment: 'Updated after reflection.' })
    assert.equal(edited.status, 200, JSON.stringify(edited.body))
    assert.equal(edited.body.data.overallRating, 2)
    assert.equal(edited.body.data.comment, 'Updated after reflection.')

    const afterEdit = await statsFor(sender.user.id)
    assert.equal(afterEdit.averageOverallRating, 2)
    assert.equal(afterEdit.score, 2.5)

    const emptyEdit = await request(app)
      .patch(`/api/reviews/${reviewId}`)
      .set(auth(recipient.token))
      .send({})
    assert.equal(emptyEdit.status, 400, JSON.stringify(emptyEdit.body))

    const wrongDeleter = await request(app)
      .delete(`/api/reviews/${reviewId}`)
      .set(auth(sender.token))
    assert.equal(wrongDeleter.status, 403, JSON.stringify(wrongDeleter.body))

    const deleted = await request(app)
      .delete(`/api/reviews/${reviewId}`)
      .set(auth(recipient.token))
    assert.equal(deleted.status, 200, JSON.stringify(deleted.body))
    assert.equal(deleted.body.data.deleted, true)
    assert.equal(await Review.countDocuments({}), 0)

    const afterDelete = await statsFor(sender.user.id)
    assert.equal(afterDelete.totalReviews, 0)
    assert.equal(afterDelete.averageOverallRating, 0)
    assert.deepEqual(afterDelete.ratingDistribution, [0, 0, 0, 0, 0])
    assert.equal(afterDelete.score, 3)
  })
})

describe('Rating aggregation and reputation', () => {
  it('aggregates ratings, distribution and completed exchanges deterministically', async () => {
    const target = await registerUser('aggtarget')
    const reviewers = [
      await registerUser('aggone'),
      await registerUser('aggtwo'),
      await registerUser('aggthree')
    ]
    const ratings = [5, 4, 3]

    for (const [index, reviewer] of reviewers.entries()) {
      const requestId = await completeExchange(`agg${index}`, reviewer, target)
      const response = await postReview(reviewer.token, requestId, {
        overallRating: ratings[index],
        teachingRating: ratings[index],
        learningRating: ratings[index] - 1
      })
      assert.equal(response.status, 201, JSON.stringify(response.body))
    }

    const stats = await statsFor(target.user.id)
    assert.equal(stats.totalReviews, 3)
    assert.equal(stats.averageOverallRating, 4)
    assert.equal(stats.averageTeachingRating, 4)
    assert.equal(stats.averageLearningRating, 3)
    assert.deepEqual(stats.ratingDistribution, [0, 0, 1, 1, 1])
    assert.equal(stats.completedExchanges, 3)
    assert.equal(stats.score, 3.5)
    assert.ok(stats.recalculatedAt)
  })

  it('uses a neutral score until a user has visible reviews', async () => {
    const { sender, recipient, requestId } = await createCompletedPair('neutral')
    await postReview(recipient.token, requestId)

    const before = await statsFor(sender.user.id)
    assert.equal(before.score, 4)

    await reviewService.moderate(
      (await Review.findOne({})).id,
      'hidden',
      recipient.user.id
    )

    const after = await statsFor(sender.user.id)
    assert.equal(after.totalReviews, 0)
    assert.equal(after.completedExchanges, 1)
    assert.equal(after.score, 3)
    assert.equal(ratingService.calculateScore(0, 0, 0), 0)
  })
})

describe('Reporting and moderation', () => {
  it('validates reports, blocks self-reports and duplicates, and flags at the threshold', async () => {
    const { sender, recipient, requestId } = await createCompletedPair('report')
    const reporterOne = await registerUser('reportone')
    const reporterTwo = await registerUser('reporttwo')
    const reporterThree = await registerUser('reportthree')

    const created = await postReview(recipient.token, requestId)
    assert.equal(created.status, 201)
    const reviewId = created.body.data.id

    const selfReport = await request(app)
      .post(`/api/reviews/${reviewId}/report`)
      .set(auth(recipient.token))
      .send({ reason: 'abuse' })
    assert.equal(selfReport.status, 400, JSON.stringify(selfReport.body))

    const invalidReason = await request(app)
      .post(`/api/reviews/${reviewId}/report`)
      .set(auth(reporterOne.token))
      .send({ reason: 'not-a-reason' })
    assert.equal(invalidReason.status, 400, JSON.stringify(invalidReason.body))

    const first = await request(app)
      .post(`/api/reviews/${reviewId}/report`)
      .set(auth(reporterOne.token))
      .send({ reason: 'spam', details: 'Repetitive text' })
    assert.equal(first.status, 200, JSON.stringify(first.body))
    assert.equal(first.body.data.reportCount, 1)
    assert.equal(first.body.data.moderationStatus, 'visible')

    const duplicate = await request(app)
      .post(`/api/reviews/${reviewId}/report`)
      .set(auth(reporterOne.token))
      .send({ reason: 'spam' })
    assert.equal(duplicate.status, 409, JSON.stringify(duplicate.body))

    const second = await request(app)
      .post(`/api/reviews/${reviewId}/report`)
      .set(auth(reporterTwo.token))
      .send({ reason: 'abuse' })
    assert.equal(second.status, 200, JSON.stringify(second.body))
    assert.equal(second.body.data.reportCount, 2)
    assert.equal(second.body.data.moderationStatus, 'flagged')

    const third = await request(app)
      .post(`/api/reviews/${reviewId}/report`)
      .set(auth(reporterThree.token))
      .send({ reason: 'other' })
    assert.equal(third.status, 200, JSON.stringify(third.body))
    assert.equal(third.body.data.reportCount, 3)
    assert.equal(third.body.data.moderationStatus, 'flagged')

    const stored = await Review.findById(reviewId)
    assert.equal(stored.reportCount, 3)
    assert.equal(
      stored.moderationHistory.filter((entry) => entry.status === 'flagged').length,
      1
    )
    assert.equal(await ReviewReport.countDocuments({ review: reviewId }), 3)
    assert.equal((await statsFor(sender.user.id)).totalReviews, 0)
  })

  it('hides and restores reviews through the moderation service with full history', async () => {
    const { sender, recipient, requestId } = await createCompletedPair('moderate')
    const moderator = await registerUser('moderatorx')
    const created = await postReview(recipient.token, requestId)
    assert.equal(created.status, 201)
    const reviewId = created.body.data.id

    const hidden = await reviewService.moderate(
      reviewId,
      'hidden',
      moderator.user.id,
      'offensive language'
    )
    assert.equal(hidden.moderationStatus, 'hidden')
    assert.equal(hidden.moderationHistory.length, 2)
    assert.equal(hidden.moderationHistory[1].moderatedBy, moderator.user.id)

    const hiddenRead = await getReviews(`/api/reviews/${reviewId}`, recipient.token)
    assert.equal(hiddenRead.status, 404, JSON.stringify(hiddenRead.body))
    assert.equal((await statsFor(sender.user.id)).totalReviews, 0)

    const queued = await reviewService.listForModeration({ page: 1, limit: 20 })
    assert.equal(queued.reviews.length, 1)
    assert.equal(queued.reviews[0].id, reviewId)

    const restored = await reviewService.moderate(
      reviewId,
      'visible',
      moderator.user.id,
      'appeal approved'
    )
    assert.equal(restored.moderationStatus, 'visible')
    assert.equal(restored.moderationHistory.length, 3)
    assert.equal((await statsFor(sender.user.id)).totalReviews, 1)

    const idempotent = await reviewService.moderate(
      reviewId,
      'visible',
      moderator.user.id
    )
    assert.equal(idempotent.moderationHistory.length, 3)

    const listed = await reviewService.listForModeration({ page: 1, limit: 20 })
    assert.equal(listed.reviews.length, 0)

    await assert.rejects(
      reviewService.moderate(reviewId, 'flagged', moderator.user.id),
      /must be hidden or visible/
    )
    await assert.rejects(
      reviewService.moderate(reviewId, 'hidden', null),
      /moderator identity/
    )
  })

  it('does not expose admin review endpoints without admin authorization', async () => {
    const list = await request(app).get('/api/admin/reviews')
    assert.equal(list.status, 404, JSON.stringify(list.body))

    const moderate = await request(app)
      .patch('/api/admin/reviews/000000000000000000000000/moderate')
      .send({ status: 'hidden' })
    assert.equal(moderate.status, 404, JSON.stringify(moderate.body))
  })
})

describe('Review notifications and access control', () => {
  it('notifies only the reviewee in real time and respects preferences', async () => {
    const sender = await registerUser('notifya')
    const recipient = await registerUser('notifyb')
    const requestId = await completeExchange('notify', sender, recipient)

    const socket = createSocket(recipient.token)
    await waitConnected(socket)
    await waitForRoom(`user:${recipient.user.id}`, socket.id)
    const eventPromise = onceEvent(socket, 'notification:new')

    const response = await postReview(recipient.token, requestId)
    assert.equal(response.status, 201, JSON.stringify(response.body))
    const reviewId = response.body.data.id

    const event = await eventPromise
    assert.equal(event.type, 'review_received')
    assert.equal(event.relatedEntity, reviewId)
    assert.equal(event.relatedEntityType, 'Review')
    assert.equal(event.actor.id, recipient.user.id)

    const recipientNotifications = await request(app)
      .get('/api/notifications?type=review_received')
      .set(auth(recipient.token))
    assert.equal(recipientNotifications.status, 200)
    assert.equal(recipientNotifications.body.data.notifications.length, 1)
    assert.equal(recipientNotifications.body.data.notifications[0].relatedEntity, reviewId)

    const senderNotifications = await request(app)
      .get('/api/notifications?type=review_received')
      .set(auth(sender.token))
    assert.equal(senderNotifications.status, 200)
    assert.equal(senderNotifications.body.data.notifications.length, 0)

    const preference = await request(app)
      .patch('/api/notifications/preferences')
      .set(auth(sender.token))
      .send({ exchangeRequests: false })
    assert.equal(preference.status, 200, JSON.stringify(preference.body))

    const secondRequestId = await completeExchange('notify2', recipient, sender)
    const secondReview = await postReview(sender.token, secondRequestId)
    assert.equal(secondReview.status, 201, JSON.stringify(secondReview.body))

    const afterPreference = await request(app)
      .get('/api/notifications?type=review_received')
      .set(auth(sender.token))
    assert.equal(afterPreference.status, 200)
    assert.equal(afterPreference.body.data.notifications.length, 0)
    assert.equal(await Review.countDocuments({}), 2)
  })

  it('requires authentication and validates identifiers', async () => {
    const { sender, recipient, requestId } = await createCompletedPair('authcheck')
    const created = await postReview(recipient.token, requestId)
    assert.equal(created.status, 201)
    const reviewId = created.body.data.id

    const anonymousCreate = await request(app)
      .post('/api/reviews')
      .send(reviewPayload(requestId))
    assert.equal(anonymousCreate.status, 401, JSON.stringify(anonymousCreate.body))

    const anonymousList = await request(app).get(
      `/api/reviews/user/${sender.user.id}`
    )
    assert.equal(anonymousList.status, 401, JSON.stringify(anonymousList.body))

    const badId = await getReviews('/api/reviews/not-an-id', recipient.token)
    assert.equal(badId.status, 400, JSON.stringify(badId.body))

    const badUser = await getReviews('/api/reviews/user/nope', recipient.token)
    assert.equal(badUser.status, 400, JSON.stringify(badUser.body))

    const unknownUser = await getReviews(
      `/api/reviews/user/${new mongoose.Types.ObjectId()}`,
      recipient.token
    )
    assert.equal(unknownUser.status, 404, JSON.stringify(unknownUser.body))

    const unknownExchange = await getReviews(
      `/api/reviews/exchange/${new mongoose.Types.ObjectId()}`,
      recipient.token
    )
    assert.equal(unknownExchange.status, 404, JSON.stringify(unknownExchange.body))

    const pending = await createExchange('pendingreview', sender, recipient, false)
    const pendingReview = await postReview(recipient.token, pending)
    assert.equal(pendingReview.status, 409, JSON.stringify(pendingReview.body))
  })
})
