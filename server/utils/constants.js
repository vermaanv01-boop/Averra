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

module.exports = {
  SKILL_TYPES,
  SKILL_CATEGORIES,
  PROFICIENCY_LEVELS,
  REQUEST_STATUSES,
  ACTIVE_REQUEST_STATUSES,
  SESSION_STATUSES,
  SESSION_ACTIVE_STATUSES,
  MEETING_METHODS,
  RESCHEDULE_STATUSES
}
