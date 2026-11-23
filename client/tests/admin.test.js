import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ADMIN_AUDIT_ACTIONS,
  ADMIN_AUDIT_TARGET_TYPES,
  ADMIN_REPORT_ACTIONS,
  ADMIN_REPORT_REASONS,
  ADMIN_REVIEW_STATUSES,
  auditActorName,
  auditTargetLabel,
  buildModeratePayload,
  buildReportDecisionPayload,
  buildRestorePayload,
  buildSuspendPayload,
  enumLabel,
  formatAdminError,
  formatReason,
  formatTimestamp,
  metadataEntries,
  optionList,
  participantLabel,
  toneForStatus,
  userLabel,
  validateReason
} from '../src/utils/admin.js'

test('admin enums mirror the backend contract', () => {
  assert.deepEqual(ADMIN_REVIEW_STATUSES, ['visible', 'flagged', 'hidden'])
  assert.deepEqual(ADMIN_REPORT_REASONS, ['spam', 'abuse', 'inappropriate', 'fake', 'off_topic', 'other'])
  assert.deepEqual(ADMIN_REPORT_ACTIONS, ['resolved', 'dismissed', 'escalated'])
  assert.equal(ADMIN_AUDIT_ACTIONS.length, 8)
  assert.deepEqual(ADMIN_AUDIT_TARGET_TYPES, ['Admin', 'User', 'Review', 'ReviewReport'])
  assert.deepEqual(optionList(['off_topic']), [{ value: 'off_topic', label: 'Off Topic' }])
  assert.equal(enumLabel(null), '—')
})

test('admin action payloads contain only backend fields', () => {
  assert.deepEqual(buildSuspendPayload('  repeated abuse  '), { reason: 'repeated abuse' })
  assert.deepEqual(buildRestorePayload('  '), { reason: '' })
  assert.deepEqual(buildModeratePayload('hidden', ' spam '), { status: 'hidden', reason: 'spam' })
  assert.deepEqual(buildReportDecisionPayload('escalated', ' needs review '), {
    action: 'escalated',
    reason: 'needs review'
  })
})

test('reason validation matches suspend and decision requirements', () => {
  assert.equal(validateReason('abuse', { required: true, min: 3, max: 500 }), '')
  assert.equal(validateReason('  ', { required: true, min: 3 }), 'A reason is required.')
  assert.equal(validateReason('ab', { required: true, min: 3 }), 'Use at least 3 characters.')
  assert.equal(validateReason('x'.repeat(501), { max: 500 }), 'Keep the reason under 500 characters.')
  assert.equal(validateReason('', { max: 500 }), '')
})

test('status tones and labels use only supported values', () => {
  assert.equal(toneForStatus('active'), 'success')
  assert.equal(toneForStatus('flagged'), 'warning')
  assert.equal(toneForStatus('hidden'), 'neutral')
  assert.equal(toneForStatus('unknown'), 'neutral')
  assert.equal(enumLabel('review_hidden'), 'Review Hidden')
})

test('formatters handle timestamps, reasons and backend validation details', () => {
  assert.equal(formatTimestamp('bad-date'), '—')
  assert.match(formatTimestamp('2026-01-01T00:00:00.000Z'), /2026/)
  assert.equal(formatReason('  '), '—')
  assert.equal(
    formatAdminError({
      message: 'Invalid request data',
      details: [{ path: 'reason', message: 'Too small' }]
    }),
    'Invalid request data reason: Too small'
  )
})

test('audit and participant display helpers handle populated and string values', () => {
  assert.equal(auditActorName({ name: 'Admin', username: 'admin' }), 'Admin')
  assert.equal(auditActorName('actor-id'), 'actor-id')
  assert.equal(auditActorName(null), 'Unknown')
  assert.equal(auditTargetLabel({ type: 'Review', id: 'abcdef1234567890' }), 'Review · abcdef12…7890')
  assert.deepEqual(metadataEntries({ previousStatus: 'active', extra: { count: 1 } }), [
    ['Previous Status', 'active'],
    ['Extra', '{"count":1}']
  ])
  assert.equal(userLabel({ username: 'member', name: 'Member' }), '@member')
  assert.equal(participantLabel({ name: 'Rae', username: 'rae' }), 'Rae')
})
