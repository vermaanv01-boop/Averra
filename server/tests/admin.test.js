const assert = require('node:assert/strict')
const http = require('node:http')
const { before, after, beforeEach, afterEach, describe, it } = require('node:test')
const request = require('supertest')
const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')
const { io: ioClient } = require('socket.io-client')
const bcrypt = require('bcrypt')

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
let Conversation
let Message
let Session
let Notification
let Review
let ReviewReport
let AuditLog
let adminService
let adminBootstrapService
let userService
let ratingService
let closeSocket
let sockets = []

const auth = (token) => ({ Authorization: `Bearer ${token}` })

const registerUser = async (suffix) => {
  const response = await request(app).post('/api/auth/register').send({
    name: `Admin User ${suffix}`,
    username: `admin${suffix}`,
    email: `admin${suffix}@example.test`,
    password: 'Password1'
  })
  assert.equal(response.status, 201, JSON.stringify(response.body))
  return response.body.data
}

const createAdmin = async (suffix) => {
  const credentials = {
    name: `Platform Admin ${suffix}`,
    username: `root${suffix}`,
    email: `root${suffix}@example.test`,
    password: 'AdminPass1'
  }
  const result = await adminBootstrapService.bootstrapAdmin(credentials)
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: credentials.email, password: credentials.password })
  assert.equal(login.status, 200, JSON.stringify(login.body))
  return {
    admin: result.user,
    token: login.body.data.token,
    credentials
  }
}

const createSkill = async (token, name) => {
  const response = await request(app)
    .post('/api/skills')
    .set(auth(token))
    .send({ name, category: 'technology', type: 'teach', proficiency: 'advanced' })
  assert.equal(response.status, 201, JSON.stringify(response.body))
  return response.body.data.skill
}

const createCompletedPair = async (label) => {
  const sender = await registerUser(`${label}a`)
  const recipient = await registerUser(`${label}b`)
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

  const accepted = await request(app)
    .patch(`/api/exchange-requests/${requestId}/accept`)
    .set(auth(recipient.token))
    .send({})
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body))

  const completed = await request(app)
    .patch(`/api/exchange-requests/${requestId}/complete`)
    .set(auth(sender.token))
    .send({})
  assert.equal(completed.status, 200, JSON.stringify(completed.body))

  return { sender, recipient, requestId }
}

const postReview = async (token, requestId) => {
  const response = await request(app)
    .post('/api/reviews')
    .set(auth(token))
    .send({
      exchangeRequestId: requestId,
      overallRating: 5,
      teachingRating: 4,
      learningRating: 4,
      comment: 'Solid exchange.'
    })
  assert.equal(response.status, 201, JSON.stringify(response.body))
  return response.body.data
}

const reportReview = async (token, reviewId, reason = 'spam') =>
  request(app)
    .post(`/api/reviews/${reviewId}/report`)
    .set(auth(token))
    .send({ reason })

const adminGet = (token, path) =>
  request(app).get(`/api/admin${path}`).set(auth(token))

const adminPatch = (token, path, body) =>
  request(app).patch(`/api/admin${path}`).set(auth(token)).send(body)

const connectWithToken = (token) =>
  new Promise((resolve) => {
    const socket = ioClient(baseUrl, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      auth: { token }
    })
    sockets.push(socket)
    socket.once('connect', () => resolve({ socket, error: null }))
    socket.once('connect_error', (error) => resolve({ socket, error: error.message }))
  })

before(async () => {
  mongoServer = await MongoMemoryServer.create()
  process.env.MONGODB_URI = mongoServer.getUri()

  app = require('../app')
  User = require('../models/User')
  Skill = require('../models/Skill')
  ExchangeRequest = require('../models/ExchangeRequest')
  Conversation = require('../models/Conversation')
  Message = require('../models/Message')
  Session = require('../models/Session')
  Notification = require('../models/Notification')
  Review = require('../models/Review')
  ReviewReport = require('../models/ReviewReport')
  AuditLog = require('../models/AuditLog')
  adminService = require('../services/admin.service')
  adminBootstrapService = require('../services/adminBootstrap.service')
  userService = require('../services/user.service')
  ratingService = require('../services/rating.service')

  const socketModule = require('../socket')
  closeSocket = socketModule.closeSocket

  await mongoose.connect(mongoServer.getUri())
  await Promise.all([
    User.init(),
    Skill.init(),
    ExchangeRequest.init(),
    Conversation.init(),
    Message.init(),
    Session.init(),
    Notification.init(),
    Review.init(),
    ReviewReport.init(),
    AuditLog.init()
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
    Conversation.deleteMany({}),
    Message.deleteMany({}),
    Session.deleteMany({}),
    Notification.deleteMany({}),
    Review.deleteMany({}),
    ReviewReport.deleteMany({}),
    AuditLog.collection.deleteMany({})
  ])
})

afterEach(async () => {
  for (const socket of sockets) socket.close()
  sockets = []
})

describe('Admin bootstrap and privilege boundaries', () => {
  it('creates the first admin with hashed credentials and an audit record', async () => {
    const { admin, token, credentials } = await createAdmin('first')

    assert.equal(admin.role, 'admin')
    assert.equal(admin.accountStatus, 'active')
    assert.equal(admin.passwordHash, undefined)

    const stored = await User.findById(admin.id).select('+passwordHash')
    assert.notEqual(stored.passwordHash, credentials.password)
    assert.match(stored.passwordHash, /^\$2[aby]\$/)
    assert.equal(await bcrypt.compare(credentials.password, stored.passwordHash), true)

    const logs = await AuditLog.find({ action: 'admin_bootstrap' })
    assert.equal(logs.length, 1)
    assert.equal(logs[0].target.type, 'Admin')
    assert.equal(logs[0].target.id.toString(), admin.id)
    assert.equal(logs[0].metadata.mode, 'created')

    const me = await request(app).get('/api/users/me').set(auth(token))
    assert.equal(me.status, 200, JSON.stringify(me.body))
    assert.equal(me.body.data.user.role, 'admin')

    await assert.rejects(
      adminBootstrapService.bootstrapAdmin({
        name: 'Second Admin',
        username: 'rootsecond',
        email: 'rootsecond@example.test',
        password: 'AdminPass1'
      }),
      /already exists/
    )
    assert.equal(await User.countDocuments({ role: 'admin' }), 1)
  })

  it('promotes an existing account only through controlled bootstrap', async () => {
    const target = await registerUser('promote')

    const publicEscalation = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Fake Admin',
        username: 'fakeadmin',
        email: 'fakeadmin@example.test',
        password: 'Password1',
        role: 'admin'
      })
    assert.equal(publicEscalation.status, 400, JSON.stringify(publicEscalation.body))

    const profileEscalation = await request(app)
      .patch('/api/users/me')
      .set(auth(target.token))
      .send({ role: 'admin', accountStatus: 'suspended' })
    assert.equal(profileEscalation.status, 400, JSON.stringify(profileEscalation.body))

    await assert.rejects(
      userService.updateProfile(target.user.id, { role: 'admin' }),
      /administrative fields/
    )
    assert.equal((await User.findById(target.user.id)).role, 'user')

    const result = await adminBootstrapService.bootstrapAdmin({
      name: target.user.name,
      username: target.user.username,
      email: target.user.email,
      password: 'Password1'
    })
    assert.equal(result.mode, 'promoted')
    assert.equal(result.user.id, target.user.id)
    assert.equal(result.user.passwordHash, undefined)

    const promoted = await User.findById(target.user.id)
    assert.equal(promoted.role, 'admin')
    assert.equal(promoted.passwordHash, target.user.passwordHash || promoted.passwordHash)
    assert.equal(await bcrypt.compare('Password1', promoted.passwordHash), true)
  })

  it('enforces admin checks in middleware and services', async () => {
    const { token } = await createAdmin('guard')
    const normal = await registerUser('guardnormal')

    const anonymous = await request(app).get('/api/admin/users')
    assert.equal(anonymous.status, 401, JSON.stringify(anonymous.body))

    const forbidden = await adminGet(normal.token, '/users')
    assert.equal(forbidden.status, 403, JSON.stringify(forbidden.body))

    await assert.rejects(
      adminService.listUsers(normal.user.id, { page: 1, limit: 20, sort: 'newest' }),
      /Administrator access required/
    )
    await assert.rejects(
      adminService.statistics(normal.user.id),
      /Administrator access required/
    )

    const admin = await adminService.assertAdmin(
      (await User.findOne({ role: 'admin' })).id
    )
    assert.equal(admin.role, 'admin')

    const allowed = await adminGet(token, '/users')
    assert.equal(allowed.status, 200, JSON.stringify(allowed.body))
  })
})

describe('User management', () => {
  it('lists, searches, filters and reads users with pagination', async () => {
    const { token, admin } = await createAdmin('list')
    const alpha = await registerUser('alpha')
    const beta = await registerUser('beta')

    const all = await adminGet(token, '/users?limit=1&page=1')
    assert.equal(all.status, 200, JSON.stringify(all.body))
    assert.equal(all.body.data.users.length, 1)
    assert.equal(all.body.data.pagination.total, 3)
    assert.equal(all.body.data.pagination.hasNext, true)

    const searched = await adminGet(token, `/users?search=${alpha.user.username}`)
    assert.equal(searched.status, 200, JSON.stringify(searched.body))
    assert.equal(searched.body.data.pagination.total, 1)
    assert.equal(searched.body.data.users[0].id, alpha.user.id)

    const suspended = await adminPatch(token, `/users/${beta.user.id}/suspend`, {
      reason: 'Policy violation'
    })
    assert.equal(suspended.status, 200, JSON.stringify(suspended.body))

    const filtered = await adminGet(token, '/users?status=suspended')
    assert.equal(filtered.body.data.pagination.total, 1)
    assert.equal(filtered.body.data.users[0].id, beta.user.id)

    const admins = await adminGet(token, '/users?role=admin')
    assert.equal(admins.body.data.pagination.total, 1)
    assert.equal(admins.body.data.users[0].id, admin.id)

    const detail = await adminGet(token, `/users/${alpha.user.id}`)
    assert.equal(detail.status, 200, JSON.stringify(detail.body))
    assert.equal(detail.body.data.user.email, alpha.user.email)
    assert.equal(detail.body.data.user.role, 'user')

    const invalid = await adminGet(token, '/users?role=superadmin')
    assert.equal(invalid.status, 400, JSON.stringify(invalid.body))
  })

  it('suspends and restores users with audit history and no self-suspension', async () => {
    const { token, admin } = await createAdmin('suspend')
    const target = await registerUser('target')

    const selfSuspend = await adminPatch(token, `/users/${admin.id}/suspend`, {
      reason: 'Accidental self suspension'
    })
    assert.equal(selfSuspend.status, 400, JSON.stringify(selfSuspend.body))

    const suspended = await adminPatch(token, `/users/${target.user.id}/suspend`, {
      reason: 'Repeated spam'
    })
    assert.equal(suspended.status, 200, JSON.stringify(suspended.body))
    const suspension = suspended.body.data.user.suspension
    assert.equal(suspended.body.data.user.accountStatus, 'suspended')
    assert.equal(suspension.reason, 'Repeated spam')
    assert.equal(suspension.suspendedBy, admin.id)
    assert.ok(suspension.suspendedAt)

    const duplicateSuspend = await adminPatch(token, `/users/${target.user.id}/suspend`, {
      reason: 'Again'
    })
    assert.equal(duplicateSuspend.status, 409, JSON.stringify(duplicateSuspend.body))

    const suspensionAudit = await AuditLog.findOne({ action: 'user_suspended' })
    assert.equal(suspensionAudit.target.type, 'User')
    assert.equal(suspensionAudit.target.id.toString(), target.user.id)
    assert.equal(suspensionAudit.reason, 'Repeated spam')
    assert.equal(suspensionAudit.actor.toString(), admin.id)

    const restored = await adminPatch(token, `/users/${target.user.id}/restore`, {
      reason: 'Appeal accepted'
    })
    assert.equal(restored.status, 200, JSON.stringify(restored.body))
    assert.equal(restored.body.data.user.accountStatus, 'active')
    assert.equal(restored.body.data.user.suspension.restoredBy, admin.id)
    assert.equal(restored.body.data.user.suspension.reason, 'Appeal accepted')
    assert.equal(restored.body.data.user.suspension.suspendedBy, admin.id)

    assert.equal(await AuditLog.countDocuments({ action: 'user_restored' }), 1)

    const duplicateRestore = await adminPatch(token, `/users/${target.user.id}/restore`, {})
    assert.equal(duplicateRestore.status, 409, JSON.stringify(duplicateRestore.body))
  })

  it('blocks suspended users from login, REST, and socket access', async () => {
    const { token } = await createAdmin('block')
    const target = await registerUser('blocked')

    const suspended = await adminPatch(token, `/users/${target.user.id}/suspend`, {
      reason: 'Security review'
    })
    assert.equal(suspended.status, 200, JSON.stringify(suspended.body))

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: target.user.email, password: 'Password1' })
    assert.equal(login.status, 403, JSON.stringify(login.body))

    const me = await request(app).get('/api/users/me').set(auth(target.token))
    assert.equal(me.status, 403, JSON.stringify(me.body))

    const skill = await request(app)
      .post('/api/skills')
      .set(auth(target.token))
      .send({ name: 'Blocked skill', category: 'technology', type: 'teach', proficiency: 'advanced' })
    assert.equal(skill.status, 403, JSON.stringify(skill.body))

    const blockedSocket = await connectWithToken(target.token)
    assert.equal(blockedSocket.error, 'Unauthorized')

    const restored = await adminPatch(token, `/users/${target.user.id}/restore`, {})
    assert.equal(restored.status, 200, JSON.stringify(restored.body))

    const meAfter = await request(app).get('/api/users/me').set(auth(target.token))
    assert.equal(meAfter.status, 200, JSON.stringify(meAfter.body))

    const allowedSocket = await connectWithToken(target.token)
    assert.equal(allowedSocket.error, null)
  })
})

describe('Review moderation', () => {
  it('lists, views, hides and restores reported reviews with history and audit', async () => {
    const { token, admin } = await createAdmin('moderate')
    const { sender, recipient, requestId } = await createCompletedPair('modrev')
    const reporterOne = await registerUser('modrepone')
    const reporterTwo = await registerUser('modreptwo')

    const review = await postReview(recipient.token, requestId)
    assert.equal((await reportReview(reporterOne.token, review.id)).status, 200)
    assert.equal((await reportReview(reporterTwo.token, review.id, 'abuse')).status, 200)

    const listed = await adminGet(token, '/reviews')
    assert.equal(listed.status, 200, JSON.stringify(listed.body))
    assert.equal(listed.body.data.reviews.length, 1)
    assert.equal(listed.body.data.reviews[0].moderationStatus, 'flagged')
    assert.equal(listed.body.data.reviews[0].reportCount, 2)

    const detail = await adminGet(token, `/reviews/${review.id}`)
    assert.equal(detail.status, 200, JSON.stringify(detail.body))
    assert.equal(detail.body.data.review.id, review.id)

    const hidden = await adminPatch(token, `/reviews/${review.id}/moderate`, {
      status: 'hidden',
      reason: 'Confirmed abuse'
    })
    assert.equal(hidden.status, 200, JSON.stringify(hidden.body))
    assert.equal(hidden.body.data.review.moderationStatus, 'hidden')
    assert.equal(hidden.body.data.review.moderationHistory.length, 3)
    assert.equal(
      hidden.body.data.review.moderationHistory[2].moderatedBy,
      admin.id
    )

    const publicRead = await request(app)
      .get(`/api/reviews/${review.id}`)
      .set(auth(recipient.token))
    assert.equal(publicRead.status, 404, JSON.stringify(publicRead.body))
    assert.equal((await ratingService.getStats(sender.user.id)).totalReviews, 0)

    const hiddenAudit = await AuditLog.findOne({ action: 'review_hidden' })
    assert.equal(hiddenAudit.target.id.toString(), review.id)
    assert.equal(hiddenAudit.reason, 'Confirmed abuse')
    assert.equal(hiddenAudit.actor.toString(), admin.id)

    const restored = await adminPatch(token, `/reviews/${review.id}/moderate`, {
      status: 'visible',
      reason: 'Appeal approved'
    })
    assert.equal(restored.status, 200, JSON.stringify(restored.body))
    assert.equal(restored.body.data.review.moderationStatus, 'visible')
    assert.equal(restored.body.data.review.moderationHistory.length, 4)
    assert.equal((await ratingService.getStats(sender.user.id)).totalReviews, 1)
    assert.equal(await AuditLog.countDocuments({ action: 'review_restored' }), 1)

    const filtered = await adminGet(token, '/reviews?status=hidden')
    assert.equal(filtered.status, 200, JSON.stringify(filtered.body))
    assert.equal(filtered.body.data.reviews.length, 0)

    const invalid = await adminPatch(token, `/reviews/${review.id}/moderate`, {
      status: 'flagged'
    })
    assert.equal(invalid.status, 400, JSON.stringify(invalid.body))
  })
})

describe('Report management', () => {
  it('lists, filters, views and decides reports with moderator metadata and audit', async () => {
    const { token, admin } = await createAdmin('reports')
    const pair = await createCompletedPair('reprev')
    const reporterOne = await registerUser('repone')
    const reporterTwo = await registerUser('reptwo')
    const reporterThree = await registerUser('repthree')

    const review = await postReview(pair.recipient.token, pair.requestId)
    assert.equal((await reportReview(reporterOne.token, review.id, 'spam')).status, 200)
    assert.equal((await reportReview(reporterTwo.token, review.id, 'abuse')).status, 200)
    assert.equal((await reportReview(reporterThree.token, review.id, 'other')).status, 200)

    const pending = await adminGet(token, '/reports?status=pending')
    assert.equal(pending.status, 200, JSON.stringify(pending.body))
    assert.equal(pending.body.data.pagination.total, 3)

    const spamOnly = await adminGet(token, '/reports?reason=spam')
    assert.equal(spamOnly.body.data.pagination.total, 1)
    assert.equal(spamOnly.body.data.reports[0].reason, 'spam')

    const reportId = spamOnly.body.data.reports[0].id
    const detail = await adminGet(token, `/reports/${reportId}`)
    assert.equal(detail.status, 200, JSON.stringify(detail.body))
    assert.equal(detail.body.data.report.review.id, review.id)
    assert.equal(detail.body.data.report.status, 'pending')

    const resolved = await adminPatch(token, `/reports/${reportId}`, {
      action: 'resolved',
      reason: 'Review removed after investigation'
    })
    assert.equal(resolved.status, 200, JSON.stringify(resolved.body))
    assert.equal(resolved.body.data.report.status, 'resolved')
    assert.equal(resolved.body.data.report.resolution.action, 'resolved')
    assert.equal(resolved.body.data.report.resolution.moderator, admin.id)
    assert.equal(
      resolved.body.data.report.resolution.reason,
      'Review removed after investigation'
    )
    assert.ok(resolved.body.data.report.resolution.resolvedAt)

    const decisionAudit = await AuditLog.findOne({ action: 'report_resolved' })
    assert.equal(decisionAudit.target.type, 'ReviewReport')
    assert.equal(decisionAudit.target.id.toString(), reportId)
    assert.equal(decisionAudit.actor.toString(), admin.id)

    const duplicate = await adminPatch(token, `/reports/${reportId}`, {
      action: 'dismissed',
      reason: 'Changed my mind'
    })
    assert.equal(duplicate.status, 409, JSON.stringify(duplicate.body))

    const otherReports = await adminGet(token, '/reports?status=pending')
    const secondId = otherReports.body.data.reports[0].id
    const dismissed = await adminPatch(token, `/reports/${secondId}`, {
      action: 'dismissed',
      reason: 'Insufficient evidence'
    })
    assert.equal(dismissed.status, 200, JSON.stringify(dismissed.body))
    assert.equal(dismissed.body.data.report.status, 'dismissed')

    const lastReport = await adminGet(token, '/reports?status=pending')
    const thirdId = lastReport.body.data.reports[0].id
    const escalated = await adminPatch(token, `/reports/${thirdId}`, {
      action: 'escalated',
      reason: 'Requires legal review'
    })
    assert.equal(escalated.status, 200, JSON.stringify(escalated.body))
    assert.equal(escalated.body.data.report.status, 'escalated')

    const counts = await adminGet(token, '/statistics')
    assert.equal(counts.body.data.reports.escalated, 1)
    assert.equal(counts.body.data.reports.dismissed, 1)
    assert.equal(counts.body.data.reports.resolved, 1)

    const invalidAction = await adminPatch(token, `/reports/${thirdId}`, {
      action: 'deleted',
      reason: 'Invalid action'
    })
    assert.equal(invalidAction.status, 400, JSON.stringify(invalidAction.body))

    const shortReason = await adminPatch(token, `/reports/${thirdId}`, {
      action: 'resolved',
      reason: 'x'
    })
    assert.equal(shortReason.status, 400, JSON.stringify(shortReason.body))
  })
})

describe('Statistics and audit logging', () => {
  it('returns real platform statistics from database data', async () => {
    const { token } = await createAdmin('stats')
    const pair = await createCompletedPair('statpair')
    const review = await postReview(pair.recipient.token, pair.requestId)
    const reporter = await registerUser('statrep')
    await reportReview(reporter.token, review.id)

    const conversation = await Conversation.findOne({
      participants: { $all: [pair.sender.user.id, pair.recipient.user.id] }
    })
    await Message.create({
      conversation: conversation._id,
      sender: pair.sender.user.id,
      content: 'Hello',
      clientMessageId: 'stats-message'
    })

    const response = await adminGet(token, '/statistics')
    assert.equal(response.status, 200, JSON.stringify(response.body))
    const stats = response.body.data

    assert.equal(stats.users.total, await User.countDocuments({}))
    assert.equal(stats.users.admins, await User.countDocuments({ role: 'admin' }))
    assert.equal(stats.skills.total, await Skill.countDocuments({}))
    assert.equal(stats.exchangeRequests.total, await ExchangeRequest.countDocuments({}))
    assert.equal(stats.exchangeRequests.completed, 1)
    assert.equal(stats.sessions.total, await Session.countDocuments({}))
    assert.equal(stats.messages.total, await Message.countDocuments({}))
    assert.equal(stats.messages.active, 1)
    assert.equal(stats.reviews.total, await Review.countDocuments({}))
    assert.equal(stats.reports.total, await ReviewReport.countDocuments({}))
    assert.equal(stats.reports.pending, 1)
  })

  it('exposes read-only audit logs and rejects direct mutation', async () => {
    const { token } = await createAdmin('audit')
    const target = await registerUser('audited')
    await adminPatch(token, `/users/${target.user.id}/suspend`, {
      reason: 'Audit test'
    })

    const logs = await adminGet(token, '/audit-logs?action=user_suspended')
    assert.equal(logs.status, 200, JSON.stringify(logs.body))
    assert.equal(logs.body.data.auditLogs.length, 1)
    assert.equal(logs.body.data.auditLogs[0].actor.username, 'rootaudit')
    assert.equal(logs.body.data.auditLogs[0].target.type, 'User')
    assert.equal(logs.body.data.auditLogs[0].target.id, target.user.id)

    const attemptedRoute = await request(app)
      .patch(`/api/admin/audit-logs/${logs.body.data.auditLogs[0].id}`)
      .set(auth(token))
      .send({ reason: 'tampered' })
    assert.equal(attemptedRoute.status, 404, JSON.stringify(attemptedRoute.body))

    const logId = logs.body.data.auditLogs[0].id
    await assert.rejects(
      AuditLog.updateOne({ _id: logId }, { $set: { reason: 'tampered' } }),
      /immutable/
    )
    await assert.rejects(AuditLog.deleteOne({ _id: logId }), /immutable/)

    const entry = await AuditLog.findById(logId)
    entry.reason = 'tampered'
    await assert.rejects(entry.save(), /immutable/)
  })
})
