import api from './api.js'
import { SKILL_TYPES } from '../utils/constants.js'

const USER_QUERY_KEYS = ['skill', 'category', 'proficiency', 'type', 'page', 'limit', 'sort']
const MATCH_QUERY_KEYS = ['page', 'limit', 'category']

function buildParams(params, keys) {
  const clean = {}
  keys.forEach((key) => {
    const value = params[key]
    if (value === undefined || value === null || value === '') return
    clean[key] = key === 'page' || key === 'limit' ? Number(value) : value
  })
  return clean
}

function searchUsers(params = {}) {
  return api.get('/discovery/users', { params: buildParams(params, USER_QUERY_KEYS) })
}

function getMatches(params = {}) {
  return api.get('/discovery/matches', { params: buildParams(params, MATCH_QUERY_KEYS) })
}

async function findUserSkills(username) {
  const skills = { teach: [], learn: [] }
  const normalizedUsername = username.toLowerCase()

  for (const type of SKILL_TYPES) {
    let page = 1
    let found = false

    while (!found) {
      const data = await searchUsers({ type, page, limit: 50 })
      const user = (data?.items || []).find(
        (item) => item.username?.toLowerCase() === normalizedUsername
      )

      if (user) {
        skills[type] = Array.isArray(user.skills) ? user.skills : []
        found = true
        break
      }

      if (!data?.pagination?.hasNext) break
      page += 1
    }
  }

  return skills
}

export const discoveryService = {
  searchUsers,
  getMatches,
  findUserSkills
}
