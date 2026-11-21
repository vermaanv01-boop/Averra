const SKILL_TYPES = ['teach', 'learn']

const SKILL_CATEGORIES = [
  'technology',
  'design',
  'business',
  'languages',
  'music',
  'sports',
  'arts',
  'education',
  'lifestyle',
  'other'
]

const PROFICIENCY_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert']

const REQUEST_STATUSES = ['pending', 'accepted', 'rejected', 'cancelled', 'completed']

const ACTIVE_REQUEST_STATUSES = ['pending', 'accepted']

const SESSION_STATUSES = [
  'pending',
  'confirmed',
  'declined',
  'reschedule_requested',
  'cancelled',
  'completed'
]

const SESSION_ACTIVE_STATUSES = ['pending', 'confirmed', 'reschedule_requested']

const MEETING_METHODS = ['online', 'in-person', 'other']

const RESCHEDULE_STATUSES = ['pending', 'accepted', 'rejected']

const MESSAGE_TYPES = ['text']

const NOTIFICATION_TYPES = [
  'exchange_request',
  'exchange_accepted',
  'exchange_rejected',
  'exchange_cancelled',
  'session_invitation',
  'session_confirmed',
  'session_declined',
  'session_rescheduled',
  'session_cancelled',
  'session_completed',
  'new_message',
  'review_received'
]

const NOTIFICATION_CATEGORIES = ['exchangeRequests', 'sessions', 'messages']

const NOTIFICATION_ENTITY_TYPES = [
  'ExchangeRequest',
  'Session',
  'Conversation',
  'Message',
  'Review'
]

const NOTIFICATION_TYPE_CATEGORY = {
  exchange_request: 'exchangeRequests',
  exchange_accepted: 'exchangeRequests',
  exchange_rejected: 'exchangeRequests',
  exchange_cancelled: 'exchangeRequests',
  session_invitation: 'sessions',
  session_confirmed: 'sessions',
  session_declined: 'sessions',
  session_rescheduled: 'sessions',
  session_cancelled: 'sessions',
  session_completed: 'sessions',
  new_message: 'messages'
}

module.exports = {
  SKILL_TYPES,
  SKILL_CATEGORIES,
  PROFICIENCY_LEVELS,
  REQUEST_STATUSES,
  ACTIVE_REQUEST_STATUSES,
  SESSION_STATUSES,
  SESSION_ACTIVE_STATUSES,
  MEETING_METHODS,
  RESCHEDULE_STATUSES,
  MESSAGE_TYPES,
  NOTIFICATION_TYPES,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_ENTITY_TYPES,
  NOTIFICATION_TYPE_CATEGORY
}
