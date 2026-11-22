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
