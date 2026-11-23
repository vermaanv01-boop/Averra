import assert from 'node:assert/strict'
import test from 'node:test'
import {
  actorId,
  actorName,
  actorSummary,
  actorUsername,
  applyNotificationRead,
  DEFAULT_NOTIFICATION_PREFERENCES,
  formatNotificationTime,
  isNotificationType,
  NOTIFICATION_GROUPS,
  NOTIFICATION_TYPES,
  normalizePreferences,
  notificationDestination,
  notificationGroup,
  removeNotificationById,
  upsertNotification
} from '../src/utils/notifications.js'

function notification(overrides = {}) {
  return {
    id: 'notification-1',
    recipient: 'owner-id',
    actor: { id: 'actor-id', name: 'Friend', username: 'friend', profileImage: '' },
    type: 'exchange_request',
    title: 'New request',
    message: 'Friend sent you an exchange request.',
    relatedEntity: 'request-1',
    relatedEntityType: 'ExchangeRequest',
    isRead: false,
    readAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  }
}

test('notification types mirror the backend enum and group into four categories', () => {
  assert.equal(NOTIFICATION_TYPES.length, 12)
  assert.deepEqual(
    NOTIFICATION_GROUPS.map((group) => group.id),
    ['exchangeRequests', 'sessions', 'messages', 'reviews']
  )
  assert.equal(isNotificationType('session_completed'), true)
  assert.equal(isNotificationType('unknown_type'), false)
  assert.equal(notificationGroup('review_received')?.preferenceKey, 'exchangeRequests')
})

test('preferences normalize missing values and keep only backend fields', () => {
  assert.deepEqual(normalizePreferences(null), DEFAULT_NOTIFICATION_PREFERENCES)
  assert.deepEqual(normalizePreferences({ sessions: false }), {
    exchangeRequests: true,
    sessions: false,
    messages: true
  })
})

test('actor helpers handle populated, string and missing actors', () => {
  assert.equal(actorId(notification()), 'actor-id')
  assert.equal(actorName(notification()), 'Friend')
  assert.equal(actorUsername(notification()), 'friend')
  assert.deepEqual(actorSummary(notification({ actor: 'actor-id' })), {
    id: 'actor-id',
    name: 'Someone',
    username: '',
    profileImage: ''
  })
  assert.equal(actorId(notification({ actor: null })), '')
})

test('notification destinations use the related entity type without inventing fields', () => {
  assert.deepEqual(notificationDestination(notification()), {
    pathname: '/app',
    search: '?request=request-1'
  })
  assert.deepEqual(
    notificationDestination(notification({ relatedEntity: 'conversation-1', relatedEntityType: 'Conversation' })),
    { pathname: '/app/messages', search: '?conversation=conversation-1' }
  )
  assert.deepEqual(
    notificationDestination(notification({ relatedEntity: 'message-1', relatedEntityType: 'Message' })),
    { pathname: '/app/messages', search: '?message=message-1' }
  )
  assert.deepEqual(
    notificationDestination(notification({ relatedEntity: 'session-1', relatedEntityType: 'Session' })),
    { pathname: '/app/sessions', search: '?session=session-1' }
  )
  assert.deepEqual(
    notificationDestination(notification({ relatedEntity: 'review-1', relatedEntityType: 'Review' })),
    { pathname: '/app/reviews', search: '?review=review-1' }
  )
  assert.deepEqual(
    notificationDestination(notification({ relatedEntity: 'review-1', relatedEntityType: 'Review', actor: 'actor-id' })),
    { pathname: '/app/reviews', search: '?review=review-1' }
  )
  assert.equal(notificationDestination(notification({ relatedEntity: null })), null)
})

test('upsert deduplicates notifications by id and places new ones first', () => {
  const existing = [notification({ id: 'a' }), notification({ id: 'b' })]
  const added = upsertNotification(existing, notification({ id: 'c' }))
  assert.deepEqual(added.map((item) => item.id), ['c', 'a', 'b'])

  const updated = upsertNotification(added, notification({ id: 'a', isRead: true }))
  assert.equal(updated.length, 3)
  assert.equal(updated.find((item) => item.id === 'a').isRead, true)
})

test('read events update single and bulk notification identifiers', () => {
  const items = [notification({ id: 'a' }), notification({ id: 'b' })]
  const single = applyNotificationRead(items, { id: 'a', readAt: '2026-01-02T00:00:00.000Z' })
  assert.equal(single[0].isRead, true)
  assert.equal(single[1].isRead, false)

  const bulk = applyNotificationRead(items, { ids: ['a', 'b'], readAt: '2026-01-02T00:00:00.000Z' })
  assert.equal(bulk.every((item) => item.isRead), true)
})

test('delete and timestamp helpers handle missing values', () => {
  const items = [notification({ id: 'a' }), notification({ id: 'b' })]
  assert.deepEqual(removeNotificationById(items, 'a').map((item) => item.id), ['b'])
  assert.equal(formatNotificationTime('not-a-date'), '')
  assert.equal(formatNotificationTime(new Date().toISOString()), 'Just now')
})
