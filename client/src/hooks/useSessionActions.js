import { useCallback, useRef, useState } from 'react'
import { ApiError } from '../utils/errors.js'

export default function useSessionActions() {
  const busyRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const clearError = useCallback(() => setError(null), [])

  const run = useCallback(async (operation) => {
    if (busyRef.current) {
      return {
        data: null,
        error: new ApiError('An action is already in progress. Please wait.', {
          code: 'ACTION_IN_PROGRESS'
        })
      }
    }

    busyRef.current = true
    setBusy(true)
    setError(null)

    try {
      const data = await operation()
      return { data, error: null }
    } catch (caught) {
      const normalized =
        caught instanceof ApiError
          ? caught
          : new ApiError(caught?.message || 'The action could not be completed.')
      setError(normalized)
      return { data: null, error: normalized }
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [])

  return { busy, error, run, clearError }
}
