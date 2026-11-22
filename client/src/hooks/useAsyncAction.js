import { useCallback, useState } from 'react'
import { ApiError } from '../utils/errors.js'

export default function useAsyncAction(action) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  const run = useCallback(
    async (...args) => {
      setLoading(true)
      setError(null)

      try {
        const result = await action(...args)
        setData(result)
        return { data: result, error: null }
      } catch (caught) {
        const normalized =
          caught instanceof ApiError
            ? caught
            : new ApiError(caught?.message || 'Something went wrong. Please try again.')
        setError(normalized)
        return { data: null, error: normalized }
      } finally {
        setLoading(false)
      }
    },
    [action]
  )

  const reset = useCallback(() => {
    setLoading(false)
    setError(null)
    setData(null)
  }, [])

  return { run, reset, loading, error, data }
}
