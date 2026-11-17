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

const auth = (token) => ({ Authorization: `Bearer ${token}` })

const registerUser = async (suffix, overrides = {}) => {
  const payload = {
    name: `Test User ${suffix}`,
    username: `user${suffix}`,
    email: `user${suffix}@example.test`,
    password: 'Password1',
    ...overrides
  }
  const response = await request(app).post('/api/auth/register').send(payload)
  assert.equal(response.status, 201, JSON.stringify(response.body))
  return { ...response.body.data, password: payload.password }
}

const createSkill = async (token, payload) => {
  const response = await request(app).post('/api/skills').set(auth(token)).send(payload)
  assert.equal(response.status, 201, JSON.stringify(response.body))
  return response.body.data.skill
}

before(async () => {
  mongoServer = await MongoMemoryServer.create()
  process.env.MONGODB_URI = mongoServer.getUri()

  app = require('../app')
  User = require('../models/User')
  Skill = require('../models/Skill')
  ExchangeRequest = require('../models/ExchangeRequest')

  await mongoose.connect(mongoServer.getUri())
  await Promise.all([User.init(), Skill.init(), ExchangeRequest.init()])
})

after(async () => {
  await mongoose.disconnect()
  await mongoServer.stop()
})

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Skill.deleteMany({}),
    ExchangeRequest.deleteMany({})
  ])
})

describe('Health', () => {
  it('keeps the health endpoint available', async () => {
    const response = await request(app).get('/health')
    assert.equal(response.status, 200)
    assert.equal(response.body.success, true)
    assert.equal(response.body.data.status, 'ok')
  })
})

describe('Authentication', () => {
  it('registers a user without exposing the password hash', async () => {
    const user = await registerUser('one')

    assert.ok(user.token)
    assert.equal(user.user.username, 'userone')
    assert.equal(user.user.email, 'userone@example.test')
    assert.equal(user.user.passwordHash, undefined)

    const stored = await User.findOne({ email: 'userone@example.test' }).select('+passwordHash')
    assert.ok(stored.passwordHash)
    assert.notEqual(stored.passwordHash, 'Password1')
  })

  it('rejects duplicate email and username registrations', async () => {
    await registerUser('two')

    const duplicateEmail = await request(app).post('/api/auth/register').send({
      name: 'Other Name',
      username: 'othername',
      email: 'usertwo@example.test',
      password: 'Password1'
    })
    assert.equal(duplicateEmail.status, 409)

    const duplicateUsername = await request(app).post('/api/auth/register').send({
      name: 'Other Name',
      username: 'usertwo',
      email: 'other@example.test',
      password: 'Password1'
    })
    assert.equal(duplicateUsername.status, 409)
  })

  it('rejects invalid registration input', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'A',
      username: 'Bad Username',
      email: 'not-an-email',
      password: 'short'
    })
    assert.equal(response.status, 400)
    assert.ok(response.body.details.length >= 4)
  })

  it('logs in with valid credentials and rejects invalid ones', async () => {
    await registerUser('three')

    const success = await request(app).post('/api/auth/login').send({
      email: 'userthree@example.test',
      password: 'Password1'
    })
    assert.equal(success.status, 200)
    assert.ok(success.body.data.token)

    const wrongPassword = await request(app).post('/api/auth/login').send({
      email: 'userthree@example.test',
      password: 'WrongPassword'
    })
    assert.equal(wrongPassword.status, 401)

    const unknownEmail = await request(app).post('/api/auth/login').send({
      email: 'missing@example.test',
      password: 'Password1'
    })
    assert.equal(unknownEmail.status, 401)
  })

  it('protects private routes and revokes tokens on logout', async () => {
    const user = await registerUser('four')

    const noToken = await request(app).get('/api/users/me')
    assert.equal(noToken.status, 401)

    const badToken = await request(app).get('/api/users/me').set(auth('invalid.token.value'))
    assert.equal(badToken.status, 401)

    const logout = await request(app).post('/api/auth/logout').set(auth(user.token)).send({})
    assert.equal(logout.status, 200)

    const afterLogout = await request(app).get('/api/users/me').set(auth(user.token))
    assert.equal(afterLogout.status, 401)
  })
})

describe('Profiles', () => {
  it('returns the authenticated profile and allows editing', async () => {
    const user = await registerUser('five')

    const before = await request(app).get('/api/users/me').set(auth(user.token))
    assert.equal(before.status, 200)
    assert.equal(before.body.data.user.email, 'userfive@example.test')
    assert.equal(before.body.data.user.passwordHash, undefined)

    const update = await request(app).patch('/api/users/me').set(auth(user.token)).send({
      name: 'Renamed User',
      bio: 'Learning and teaching',
      location: 'Lisbon',
      interests: [' chess ', ' reading '],
      profileImage: 'https://example.test/avatar.png'
    })
    assert.equal(update.status, 200)
    assert.equal(update.body.data.user.name, 'Renamed User')
    assert.deepEqual(update.body.data.user.interests, ['chess', 'reading'])
    assert.equal(update.body.data.user.email, 'userfive@example.test')
  })

  it('rejects invalid and duplicate profile updates', async () => {
    const first = await registerUser('six')
    const second = await registerUser('seven')

    const badImage = await request(app)
      .patch('/api/users/me')
      .set(auth(first.token))
      .send({ profileImage: 'not-a-url' })
    assert.equal(badImage.status, 400)

    const duplicateUsername = await request(app)
      .patch('/api/users/me')
      .set(auth(first.token))
      .send({ username: second.user.username })
    assert.equal(duplicateUsername.status, 409)

    const emptyUpdate = await request(app).patch('/api/users/me').set(auth(first.token)).send({})
    assert.equal(emptyUpdate.status, 400)
  })

  it('returns a public profile without private fields', async () => {
    const user = await registerUser('eight')

    const response = await request(app).get(`/api/users/${user.user.username}`)
    assert.equal(response.status, 200)
    assert.equal(response.body.data.user.name, user.user.name)
    assert.equal(response.body.data.user.email, undefined)
    assert.equal(response.body.data.user.passwordHash, undefined)

    const missing = await request(app).get('/api/users/nobody')
    assert.equal(missing.status, 404)
  })
})

describe('Skills', () => {
  it('creates, lists, updates and deletes skills', async () => {
    const user = await registerUser('nine')

    const teach = await createSkill(user.token, {
      name: 'JavaScript',
      category: 'technology',
      type: 'teach',
      proficiency: 'advanced',
      experience: 'Five years of practice'
    })
    const learn = await createSkill(user.token, {
      name: 'Spanish',
      category: 'languages',
      type: 'learn',
      proficiency: 'beginner'
    })

    const list = await request(app).get('/api/skills').set(auth(user.token))
    assert.equal(list.status, 200)
    assert.equal(list.body.data.skills.length, 2)

    const updated = await request(app)
      .patch(`/api/skills/${teach.id}`)
      .set(auth(user.token))
      .send({ proficiency: 'expert', name: ' JavaScript ' })
    assert.equal(updated.status, 200)
    assert.equal(updated.body.data.skill.proficiency, 'expert')
    assert.equal(updated.body.data.skill.name, 'JavaScript')

    const removed = await request(app)
      .delete(`/api/skills/${learn.id}`)
      .set(auth(user.token))
    assert.equal(removed.status, 200)

    const finalList = await request(app).get('/api/skills').set(auth(user.token))
    assert.equal(finalList.body.data.skills.length, 1)
  })

  it('prevents duplicate skills and rejects invalid skill data', async () => {
    const user = await registerUser('ten')
    const payload = {
      name: 'Guitar',
      category: 'music',
      type: 'teach',
      proficiency: 'intermediate'
    }

    await createSkill(user.token, payload)

    const duplicate = await request(app).post('/api/skills').set(auth(user.token)).send(payload)
    assert.equal(duplicate.status, 409)

    const invalid = await request(app).post('/api/skills').set(auth(user.token)).send({
      name: 'Guitar',
      category: 'unknown',
      type: 'teach',
      proficiency: 'intermediate'
    })
    assert.equal(invalid.status, 400)
  })

  it('does not allow a user to modify another user skill', async () => {
    const owner = await registerUser('eleven')
    const other = await registerUser('twelve')
    const skill = await createSkill(owner.token, {
      name: 'Photography',
      category: 'arts',
      type: 'teach',
      proficiency: 'advanced'
    })

    const update = await request(app)
      .patch(`/api/skills/${skill.id}`)
      .set(auth(other.token))
      .send({ proficiency: 'beginner' })
    assert.equal(update.status, 404)

    const remove = await request(app)
      .delete(`/api/skills/${skill.id}`)
      .set(auth(other.token))
    assert.equal(remove.status, 404)
  })
})

describe('Discovery and matching', () => {
  it('searches users by skill with filters, sorting and pagination', async () => {
    const teacher = await registerUser('thirteen')
    await createSkill(teacher.token, {
      name: 'Python',
      category: 'technology',
      type: 'teach',
      proficiency: 'expert'
    })
    await createSkill(teacher.token, {
      name: 'French',
      category: 'languages',
      type: 'teach',
      proficiency: 'beginner'
    })

    const bySkill = await request(app).get('/api/discovery/users?skill=Python')
    assert.equal(bySkill.status, 200)
    assert.equal(bySkill.body.data.pagination.total, 1)
    assert.equal(bySkill.body.data.items[0].username, 'userthirteen')
    assert.equal(bySkill.body.data.items[0].email, undefined)

    const byCategory = await request(app).get('/api/discovery/users?category=languages&sort=name')
    assert.equal(byCategory.status, 200)
    assert.equal(byCategory.body.data.pagination.total, 1)
    assert.equal(byCategory.body.data.items[0].skills[0].name, 'French')

    const byProficiency = await request(app).get('/api/discovery/users?proficiency=expert&page=1&limit=1')
    assert.equal(byProficiency.status, 200)
    assert.equal(byProficiency.body.data.pagination.total, 1)

    const emptyPage = await request(app).get('/api/discovery/users?skill=Python&page=2&limit=1')
    assert.equal(emptyPage.status, 200)
    assert.equal(emptyPage.body.data.items.length, 0)

    const invalid = await request(app).get('/api/discovery/users?category=unknown')
    assert.equal(invalid.status, 400)
  })

  it('finds users who teach wanted skills and flags complementary exchanges', async () => {
    const current = await registerUser('fourteen')
    await createSkill(current.token, {
      name: 'JavaScript',
      category: 'technology',
      type: 'teach',
      proficiency: 'advanced'
    })
    await createSkill(current.token, {
      name: 'German',
      category: 'languages',
      type: 'learn',
      proficiency: 'beginner'
    })

    const complementary = await registerUser('fifteen')
    await createSkill(complementary.token, {
      name: 'German',
      category: 'languages',
      type: 'teach',
      proficiency: 'expert'
    })
    await createSkill(complementary.token, {
      name: 'JavaScript',
      category: 'technology',
      type: 'learn',
      proficiency: 'beginner'
    })

    const oneSided = await registerUser('sixteen')
    await createSkill(oneSided.token, {
      name: 'German',
      category: 'languages',
      type: 'teach',
      proficiency: 'intermediate'
    })

    const response = await request(app).get('/api/discovery/matches').set(auth(current.token))
    assert.equal(response.status, 200)
    assert.equal(response.body.data.pagination.total, 2)

    const complementaryMatch = response.body.data.items.find(
      (item) => item.user.username === 'userfifteen'
    )
    const oneSidedMatch = response.body.data.items.find(
      (item) => item.user.username === 'usersixteen'
    )

    assert.equal(complementaryMatch.complementary, true)
    assert.equal(complementaryMatch.wantsYouTeach.length, 1)
    assert.equal(complementaryMatch.teachesYouWant[0].name, 'German')
    assert.equal(oneSidedMatch.complementary, false)
    assert.equal(oneSidedMatch.wantsYouTeach.length, 0)

    const unauthorized = await request(app).get('/api/discovery/matches')
    assert.equal(unauthorized.status, 401)
  })

  it('returns no matches when the current user has no learn skills', async () => {
    const user = await registerUser('seventeen')
    await createSkill(user.token, {
      name: 'Drawing',
      category: 'arts',
      type: 'teach',
      proficiency: 'intermediate'
    })

    const response = await request(app).get('/api/discovery/matches').set(auth(user.token))
    assert.equal(response.status, 200)
    assert.equal(response.body.data.items.length, 0)
    assert.equal(response.body.data.pagination.total, 0)
  })
})

describe('Exchange requests', () => {
  const setupPair = async () => {
    const sender = await registerUser('eighteen')
    const recipient = await registerUser('nineteen')
    const offered = await createSkill(sender.token, {
      name: 'React',
      category: 'technology',
      type: 'teach',
      proficiency: 'advanced'
    })
    const requested = await createSkill(recipient.token, {
      name: 'Italian',
      category: 'languages',
      type: 'teach',
      proficiency: 'expert'
    })
    return { sender, recipient, offered, requested }
  }

  it('sends, lists, accepts and completes a request', async () => {
    const { sender, recipient, offered, requested } = await setupPair()

    const created = await request(app).post('/api/exchange-requests').set(auth(sender.token)).send({
      recipientId: recipient.user.id,
      offeredSkillId: offered.id,
      requestedSkillId: requested.id
    })
    assert.equal(created.status, 201, JSON.stringify(created.body))
    assert.equal(created.body.data.request.status, 'pending')
    const requestId = created.body.data.request.id

    const outgoing = await request(app)
      .get('/api/exchange-requests?box=outgoing')
      .set(auth(sender.token))
    assert.equal(outgoing.status, 200)
    assert.equal(outgoing.body.data.pagination.total, 1)

    const incoming = await request(app)
      .get('/api/exchange-requests?box=incoming&status=pending')
      .set(auth(recipient.token))
    assert.equal(incoming.status, 200)
    assert.equal(incoming.body.data.pagination.total, 1)

    const senderCannotAccept = await request(app)
      .patch(`/api/exchange-requests/${requestId}/accept`)
      .set(auth(sender.token))
      .send({})
    assert.equal(senderCannotAccept.status, 403)

    const accepted = await request(app)
      .patch(`/api/exchange-requests/${requestId}/accept`)
      .set(auth(recipient.token))
      .send({})
    assert.equal(accepted.status, 200)
    assert.equal(accepted.body.data.request.status, 'accepted')
    assert.ok(accepted.body.data.request.respondedAt)

    const repeatedAccept = await request(app)
      .patch(`/api/exchange-requests/${requestId}/accept`)
      .set(auth(recipient.token))
      .send({})
    assert.equal(repeatedAccept.status, 409)

    const completed = await request(app)
      .patch(`/api/exchange-requests/${requestId}/complete`)
      .set(auth(sender.token))
      .send({})
    assert.equal(completed.status, 200)
    assert.equal(completed.body.data.request.status, 'completed')
    assert.ok(completed.body.data.request.completedAt)
  })

  it('rejects a pending request', async () => {
    const { sender, recipient, offered, requested } = await setupPair()
    const created = await request(app).post('/api/exchange-requests').set(auth(sender.token)).send({
      recipientId: recipient.user.id,
      offeredSkillId: offered.id,
      requestedSkillId: requested.id
    })

    const rejected = await request(app)
      .patch(`/api/exchange-requests/${created.body.data.request.id}/reject`)
      .set(auth(recipient.token))
      .send({})
    assert.equal(rejected.status, 200)
    assert.equal(rejected.body.data.request.status, 'rejected')
  })

  it('cancels a pending outgoing request', async () => {
    const { sender, recipient, offered, requested } = await setupPair()
    const created = await request(app).post('/api/exchange-requests').set(auth(sender.token)).send({
      recipientId: recipient.user.id,
      offeredSkillId: offered.id,
      requestedSkillId: requested.id
    })
    const requestId = created.body.data.request.id

    const recipientCannotCancel = await request(app)
      .patch(`/api/exchange-requests/${requestId}/cancel`)
      .set(auth(recipient.token))
      .send({})
    assert.equal(recipientCannotCancel.status, 403)

    const cancelled = await request(app)
      .patch(`/api/exchange-requests/${requestId}/cancel`)
      .set(auth(sender.token))
      .send({})
    assert.equal(cancelled.status, 200)
    assert.equal(cancelled.body.data.request.status, 'cancelled')
  })

  it('prevents duplicate, invalid and self requests', async () => {
    const { sender, recipient, offered, requested } = await setupPair()
    const payload = {
      recipientId: recipient.user.id,
      offeredSkillId: offered.id,
      requestedSkillId: requested.id
    }

    await request(app).post('/api/exchange-requests').set(auth(sender.token)).send(payload)

    const duplicate = await request(app)
      .post('/api/exchange-requests')
      .set(auth(sender.token))
      .send(payload)
    assert.equal(duplicate.status, 409)

    const reverseDuplicate = await request(app)
      .post('/api/exchange-requests')
      .set(auth(recipient.token))
      .send({
        recipientId: sender.user.id,
        offeredSkillId: requested.id,
        requestedSkillId: offered.id
      })
    assert.equal(reverseDuplicate.status, 409)

    const selfRequest = await request(app).post('/api/exchange-requests').set(auth(sender.token)).send({
      ...payload,
      recipientId: sender.user.id
    })
    assert.equal(selfRequest.status, 400)

    const invalidSkillOwner = await request(app)
      .post('/api/exchange-requests')
      .set(auth(sender.token))
      .send({ ...payload, offeredSkillId: requested.id })
    assert.equal(invalidSkillOwner.status, 400)

    const invalidId = await request(app).post('/api/exchange-requests').set(auth(sender.token)).send({
      ...payload,
      recipientId: 'not-an-id'
    })
    assert.equal(invalidId.status, 400)

    const unknownRecipient = await request(app)
      .post('/api/exchange-requests')
      .set(auth(sender.token))
      .send({ ...payload, recipientId: new mongoose.Types.ObjectId().toString() })
    assert.equal(unknownRecipient.status, 404)
  })

  it('hides requests from users who are not participants', async () => {
    const { sender, recipient, offered, requested } = await setupPair()
    const outsider = await registerUser('twenty')
    const created = await request(app).post('/api/exchange-requests').set(auth(sender.token)).send({
      recipientId: recipient.user.id,
      offeredSkillId: offered.id,
      requestedSkillId: requested.id
    })
    const requestId = created.body.data.request.id

    const getRequest = await request(app)
      .get(`/api/exchange-requests/${requestId}`)
      .set(auth(outsider.token))
    assert.equal(getRequest.status, 404)

    const manageRequest = await request(app)
      .patch(`/api/exchange-requests/${requestId}/accept`)
      .set(auth(outsider.token))
      .send({})
    assert.equal(manageRequest.status, 404)

    const unauthenticated = await request(app).get('/api/exchange-requests')
    assert.equal(unauthenticated.status, 401)
  })
})
