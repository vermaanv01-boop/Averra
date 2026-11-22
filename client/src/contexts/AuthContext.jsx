import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import useAsyncAction from '../hooks/useAsyncAction.js'
import { ApiError, authService, subscribeToUnauthorized, userService } from '../services/index.js'
import { clearSession, getStoredToken, getStoredUser, saveSession } from '../utils/authStorage.js'

export const AuthContext = createContext(null)

function sessionExpiredError() {
  return new ApiError('Your session has expired. Please sign in again.', {
    status: 401,
    code: 'SESSION_EXPIRED'
  })
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(getStoredToken)
  const [user, setUser] = useState(getStoredUser)
  const [isInitializing, setIsInitializing] = useState(() => Boolean(getStoredToken()))
  const [sessionError, setSessionError] = useState(null)

  const loginAction = useAsyncAction(authService.login)
  const registerAction = useAsyncAction(authService.register)
  const logoutAction = useAsyncAction(authService.logout)
  const profileAction = useAsyncAction(userService.updateMe)

  useEffect(() => {
    let active = true
    const storedToken = getStoredToken()

    if (!storedToken) {
      setIsInitializing(false)
      return () => {
        active = false
      }
    }

    setIsInitializing(true)

    userService
      .getMe()
      .then((data) => {
        if (!active) return
        const nextUser = data?.user ?? null
        saveSession({ token: storedToken, user: nextUser })
        setToken(storedToken)
        setUser(nextUser)
        setSessionError(null)
      })
      .catch(() => {
        if (!active) return
        clearSession()
        setToken(null)
        setUser(null)
        setSessionError(sessionExpiredError())
      })
      .finally(() => {
        if (active) setIsInitializing(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(
    () =>
      subscribeToUnauthorized(() => {
        clearSession()
        setToken(null)
        setUser(null)
        setSessionError(sessionExpiredError())
      }),
    []
  )

  const completeSession = useCallback((data) => {
    if (!data?.token || !data?.user) return false
    saveSession(data)
    setToken(data.token)
    setUser(data.user)
    setSessionError(null)
    return true
  }, [])

  const login = useCallback(
    async (values) => {
      const result = await loginAction.run(values)
      if (result.data && !completeSession(result.data)) {
        return {
          data: null,
          error: new ApiError('The server returned an incomplete session.', {
            code: 'INVALID_SESSION_RESPONSE'
          })
        }
      }
      return result
    },
    [loginAction.run, completeSession]
  )

  const register = useCallback(
    async (values) => {
      const result = await registerAction.run(values)
      if (result.data && !completeSession(result.data)) {
        return {
          data: null,
          error: new ApiError('The server returned an incomplete session.', {
            code: 'INVALID_SESSION_RESPONSE'
          })
        }
      }
      return result
    },
    [registerAction.run, completeSession]
  )

  const logout = useCallback(async () => {
    const result = await logoutAction.run()
    clearSession()
    setToken(null)
    setUser(null)
    setSessionError(null)
    return result
  }, [logoutAction.run])

  const refreshUser = useCallback(async () => {
    const currentToken = getStoredToken()
    if (!currentToken) return null

    const data = await userService.getMe()
    if (data?.user) {
      saveSession({ token: currentToken, user: data.user })
      setUser(data.user)
    }
    return data
  }, [])

  const updateProfile = useCallback(
    async (values) => {
      const result = await profileAction.run(values)
      if (result.data?.user) {
        const currentToken = getStoredToken()
        saveSession({ token: currentToken, user: result.data.user })
        setUser(result.data.user)
      }
      return result
    },
    [profileAction.run]
  )

  const clearError = useCallback(() => {
    setSessionError(null)
    loginAction.reset()
    registerAction.reset()
    logoutAction.reset()
    profileAction.reset()
  }, [loginAction.reset, registerAction.reset, logoutAction.reset, profileAction.reset])

  const status = isInitializing ? 'loading' : token ? 'authenticated' : 'unauthenticated'
  const error = sessionError || loginAction.error || registerAction.error || logoutAction.error

  const value = useMemo(
    () => ({
      user,
      token,
      status,
      error,
      isAuthenticated: status === 'authenticated',
      isLoading: isInitializing || loginAction.loading || registerAction.loading || logoutAction.loading,
      loginLoading: loginAction.loading,
      registerLoading: registerAction.loading,
      logoutLoading: logoutAction.loading,
      login,
      register,
      logout,
      refreshUser,
      clearError
    }),
    [
      user,
      token,
      status,
      error,
      isInitializing,
      loginAction.loading,
      registerAction.loading,
      logoutAction.loading,
      login,
      register,
      logout,
      refreshUser,
      clearError
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
