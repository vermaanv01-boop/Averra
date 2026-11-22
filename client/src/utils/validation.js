import {
  PROFICIENCY_LEVELS,
  PROFILE_LIMITS,
  SKILL_CATEGORIES,
  SKILL_LIMITS,
  SKILL_TYPES
} from './constants.js'

const USERNAME_PATTERN = /^[a-z0-9_]+$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function asTrimmed(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function normalizeProfileValues(values = {}) {
  return {
    name: asTrimmed(values.name),
    username: asTrimmed(values.username).toLowerCase(),
    email: asTrimmed(values.email).toLowerCase(),
    profileImage: asTrimmed(values.profileImage),
    bio: asTrimmed(values.bio),
    location: asTrimmed(values.location),
    interests: Array.isArray(values.interests)
      ? values.interests.map(asTrimmed).filter(Boolean)
      : []
  }
}

export function normalizeSkillValues(values = {}) {
  return {
    name: asTrimmed(values.name),
    category: asTrimmed(values.category),
    type: asTrimmed(values.type),
    proficiency: asTrimmed(values.proficiency),
    experience: asTrimmed(values.experience)
  }
}

export function validateProfile(values = {}) {
  const normalized = normalizeProfileValues(values)
  const errors = {}

  if (
    normalized.name.length < PROFILE_LIMITS.name.min ||
    normalized.name.length > PROFILE_LIMITS.name.max
  ) {
    errors.name = `Name must be between ${PROFILE_LIMITS.name.min} and ${PROFILE_LIMITS.name.max} characters`
  }

  if (
    normalized.username.length < PROFILE_LIMITS.username.min ||
    normalized.username.length > PROFILE_LIMITS.username.max ||
    !USERNAME_PATTERN.test(normalized.username)
  ) {
    errors.username = 'Use 3–30 lowercase letters, numbers, or underscores'
  }

  if (!EMAIL_PATTERN.test(normalized.email)) {
    errors.email = 'Enter a valid email address'
  }

  if (normalized.profileImage && !isValidHttpUrl(normalized.profileImage)) {
    errors.profileImage = 'Enter a valid http or https URL, or leave this blank'
  }

  if (normalized.bio.length > PROFILE_LIMITS.bio.max) {
    errors.bio = `Bio must be ${PROFILE_LIMITS.bio.max} characters or fewer`
  }

  if (normalized.location.length > PROFILE_LIMITS.location.max) {
    errors.location = `Location must be ${PROFILE_LIMITS.location.max} characters or fewer`
  }

  if (normalized.interests.length > PROFILE_LIMITS.interests.max) {
    errors.interests = `You can add up to ${PROFILE_LIMITS.interests.max} interests`
  } else if (
    normalized.interests.some((interest) => interest.length > PROFILE_LIMITS.interests.itemMax)
  ) {
    errors.interests = `Each interest must be ${PROFILE_LIMITS.interests.itemMax} characters or fewer`
  }

  return errors
}

export function validateSkill(values = {}) {
  const normalized = normalizeSkillValues(values)
  const errors = {}

  if (
    normalized.name.length < SKILL_LIMITS.name.min ||
    normalized.name.length > SKILL_LIMITS.name.max
  ) {
    errors.name = `Skill name must be between ${SKILL_LIMITS.name.min} and ${SKILL_LIMITS.name.max} characters`
  }

  if (!SKILL_CATEGORIES.includes(normalized.category)) {
    errors.category = 'Choose a valid category'
  }

  if (!SKILL_TYPES.includes(normalized.type)) {
    errors.type = 'Choose a valid skill type'
  }

  if (!PROFICIENCY_LEVELS.includes(normalized.proficiency)) {
    errors.proficiency = 'Choose a valid proficiency level'
  }

  if (normalized.experience.length > SKILL_LIMITS.experience.max) {
    errors.experience = `Experience must be ${SKILL_LIMITS.experience.max} characters or fewer`
  }

  return errors
}

export function getChangedProfileValues(current = {}, values = {}) {
  const currentValues = normalizeProfileValues(current)
  const nextValues = normalizeProfileValues(values)
  const changes = {}

  Object.keys(nextValues).forEach((field) => {
    if (JSON.stringify(nextValues[field]) !== JSON.stringify(currentValues[field])) {
      changes[field] = nextValues[field]
    }
  })

  return changes
}

export function normalizeSkillName(name) {
  return asTrimmed(name).toLocaleLowerCase()
}

export function mapApiDetails(error) {
  const fields = {}
  const messages = []

  const details = Array.isArray(error?.details) ? error.details : []
  details.forEach((detail) => {
    const path = asTrimmed(detail?.path)
    const field = path.split('.')[0]
    const message = asTrimmed(detail?.message)

    if (!message) return
    if (field && field !== 'form') {
      fields[field] = message
    } else {
      messages.push(message)
    }
  })

  return { fields, messages }
}
