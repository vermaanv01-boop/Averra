import { entityId } from './reviews.js'

export const ADMIN_USER_ROLES = ['user', 'admin']
export const ADMIN_ACCOUNT_STATUSES = ['active', 'suspended']
export const ADMIN_USER_SORTS = ['newest', 'oldest', 'username']
export const ADMIN_REVIEW_STATUSES = ['visible', 'flagged', 'hidden']
export const ADMIN_REPORT_STATUSES = ['pending', 'resolved', 'dismissed', 'escalated']
export const ADMIN_REPORT_REASONS = ['spam', 'abuse', 'inappropriate', 'fake', 'off_topic', 'other']
export const ADMIN_REPORT_ACTIONS = ['resolved', 'dismissed', 'escalated']
export const ADMIN_AUDIT_ACTIONS = [
  'admin_bootstrap',
  'user_suspended',
  'user_restored',
  'review_hidden',
  'review_restored',
  'report_resolved',
  'report_dismissed',
  'report_escalated'
]
export const ADMIN_AUDIT_TARGET_TYPES = ['Admin', 'User', 'Review', 'ReviewReport']

export function enumLabel(value) {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function optionList(values) {
  return values.map((value) => ({ value, label: enumLabel(value) }))
}

export const USER_ROLE_OPTIONS = optionList(ADMIN_USER_ROLES)
export const USER_STATUS_OPTIONS = optionList(ADMIN_ACCOUNT_STATUSES)
export const USER_SORT_OPTIONS = optionList(ADMIN_USER_SORTS)
export const REVIEW_STATUS_OPTIONS = optionList(ADMIN_REVIEW_STATUSES)
export const REPORT_STATUS_OPTIONS = optionList(ADMIN_REPORT_STATUSES)
export const REPORT_REASON_OPTIONS = optionList(ADMIN_REPORT_REASONS)
export const REPORT_ACTION_OPTIONS = optionList(ADMIN_REPORT_ACTIONS)
export const AUDIT_ACTION_OPTIONS = optionList(ADMIN_AUDIT_ACTIONS)
export const AUDIT_TARGET_TYPE_OPTIONS = optionList(ADMIN_AUDIT_TARGET_TYPES)

const TONES = {
  active: 'success',
  visible: 'success',
  resolved: 'success',
  admin: 'lavender',
  suspended: 'warning',
  flagged: 'warning',
  pending: 'warning',
  escalated: 'warning',
  hidden: 'neutral',
  dismissed: 'neutral'
}

export function toneForStatus(value) {
  return TONES[value] || 'neutral'
}

export function formatTimestamp(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
}

export function formatReason(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '—'
}

export function validateReason(value, { required = false, min = 0, max = 500 } = {}) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) return required ? 'A reason is required.' : ''
  if (trimmed.length < min) return `Use at least ${min} characters.`
  if (trimmed.length > max) return `Keep the reason under ${max} characters.`
  return ''
}

export function buildSuspendPayload(reason) {
  return { reason: String(reason ?? '').trim() }
}

export function buildRestorePayload(reason) {
  return { reason: String(reason ?? '').trim() }
}

export function buildModeratePayload(status, reason = '') {
  return { status, reason: String(reason ?? '').trim() }
}

export function buildReportDecisionPayload(action, reason) {
  return { action, reason: String(reason ?? '').trim() }
}

export function formatAdminError(error) {
  const message = error?.message || 'The request could not be completed.'
  const details = Array.isArray(error?.details)
    ? error.details
        .map((detail) => {
          const path = Array.isArray(detail?.path) ? detail.path.join('.') : detail?.path
          return path ? `${path}: ${detail.message}` : detail?.message
        })
        .filter(Boolean)
    : []
  return details.length ? `${message} ${details.join('; ')}` : message
}

export function userLabel(value) {
  if (!value) return '—'
  if (typeof value === 'string') return value
  if (value.username) return `@${value.username}`
  return value.name || entityId(value) || '—'
}

export function participantLabel(value) {
  if (!value) return '—'
  if (typeof value === 'string') return value
  return value.name || (value.username ? `@${value.username}` : entityId(value)) || '—'
}

export function auditActorName(actor) {
  if (!actor) return 'Unknown'
  if (typeof actor === 'string') return actor
  return actor.name || actor.username || entityId(actor) || 'Unknown'
}

function shortIdentifier(value) {
  const id = entityId(value)
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id
}

export function auditTargetLabel(target) {
  if (!target?.type) return '—'
  return `${enumLabel(target.type)} · ${shortIdentifier(target.id)}`
}

export function metadataEntries(metadata) {
  return Object.entries(metadata || {}).map(([key, value]) => [
    enumLabel(key),
    typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)
  ])
}
