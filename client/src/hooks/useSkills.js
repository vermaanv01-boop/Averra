import { useCallback, useEffect, useState } from 'react'
import { skillService } from '../services/index.js'
import { ApiError } from '../utils/errors.js'

function normalizeError(error) {
  return error instanceof ApiError
    ? error
    : new ApiError(error?.message || 'Something went wrong. Please try again.')
}

export default function useSkills() {
  const [skills, setSkills] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [mutating, setMutating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await skillService.list()
      setSkills(Array.isArray(data?.skills) ? data.skills : [])
      return { data, error: null }
    } catch (caught) {
      const normalized = normalizeError(caught)
      setError(normalized)
      return { data: null, error: normalized }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const create = useCallback(async (values) => {
    setMutating(true)
    try {
      const data = await skillService.create(values)
      const skill = data?.skill
      if (skill) setSkills((current) => [skill, ...current])
      return { data: skill, error: null }
    } catch (caught) {
      return { data: null, error: normalizeError(caught) }
    } finally {
      setMutating(false)
    }
  }, [])

  const update = useCallback(async (id, values) => {
    setMutating(true)
    try {
      const data = await skillService.update(id, values)
      const skill = data?.skill
      if (skill) {
        setSkills((current) => current.map((item) => (item.id === id ? skill : item)))
      }
      return { data: skill, error: null }
    } catch (caught) {
      return { data: null, error: normalizeError(caught) }
    } finally {
      setMutating(false)
    }
  }, [])

  const remove = useCallback(async (id) => {
    setMutating(true)
    try {
      const data = await skillService.remove(id)
      setSkills((current) => current.filter((item) => item.id !== id))
      return { data: data?.skill, error: null }
    } catch (caught) {
      return { data: null, error: normalizeError(caught) }
    } finally {
      setMutating(false)
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return { skills, loading, error, mutating, load, create, update, remove, clearError }
}
