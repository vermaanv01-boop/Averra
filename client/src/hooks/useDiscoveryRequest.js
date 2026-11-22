import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../utils/errors.js'

function normalizeError(error) {
  return error instanceof ApiError
    ? error
    : new ApiError(error?.message || 'Something went wrong. Please try again.')
}

export default function useDiscoveryRequest(fetcher, params, enabled = true) {
  const serializedParams = JSON.stringify(params)
  const requestIdRef = useRef(0)
  const [reloadKey, setReloadKey] = useState(0)
  const [state, setState] = useState({ items: [], pagination: null, loading: true, error: null })

  useEffect(() => {
    if (!enabled) {
      requestIdRef.current += 1
      setState({ items: [], pagination: null, loading: false, error: null })
      return undefined
    }

    const requestId = ++requestIdRef.current
    setState((current) => ({ ...current, loading: true, error: null }))

    fetcher(JSON.parse(serializedParams))
      .then((data) => {
        if (requestId !== requestIdRef.current) return
        setState({
          items: Array.isArray(data?.items) ? data.items : [],
          pagination: data?.pagination || null,
          loading: false,
          error: null
        })
      })
      .catch((caught) => {
        if (requestId !== requestIdRef.current) return
        setState({ items: [], pagination: null, loading: false, error: normalizeError(caught) })
      })

    return () => {
      requestIdRef.current += 1
    }
  }, [fetcher, serializedParams, reloadKey, enabled])

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  return { ...state, reload }
}
