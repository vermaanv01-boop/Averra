export const SKILL_TYPES = ['teach', 'learn']

export const SKILL_CATEGORIES = [
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

export const PROFICIENCY_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert']

export const SKILL_TYPE_LABELS = {
  teach: 'Can teach',
  learn: 'Want to learn'
}

export const DISCOVERY_SORTS = [
  { value: 'recent', label: 'Recently joined' },
  { value: 'name', label: 'Name' },
  { value: 'username', label: 'Username' },
  { value: 'skills', label: 'Most matched skills' }
]

export const SESSION_STATUSES = [
  'pending',
  'confirmed',
  'declined',
  'reschedule_requested',
  'cancelled',
  'completed'
]

export const SESSION_ACTIVE_STATUSES = ['pending', 'confirmed', 'reschedule_requested']

export const SESSION_STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  declined: 'Declined',
  reschedule_requested: 'Reschedule proposed',
  cancelled: 'Cancelled',
  completed: 'Completed'
}

export const MEETING_METHODS = ['online', 'in-person', 'other']

export const MEETING_METHOD_LABELS = {
  online: 'Online',
  'in-person': 'In person',
  other: 'Other'
}

export const SESSION_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Africa/Cairo',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Australia/Sydney'
]

export const PROFILE_LIMITS = {
  name: { min: 2, max: 80 },
  username: { min: 3, max: 30 },
  bio: { max: 500 },
  location: { max: 120 },
  interests: { max: 20, itemMax: 50 }
}

export const SKILL_LIMITS = {
  name: { min: 2, max: 60 },
  experience: { max: 1000 }
}

export function formatLabel(value) {
  if (!value) return ''
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}
