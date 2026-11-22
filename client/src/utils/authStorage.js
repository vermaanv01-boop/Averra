const TOKEN_KEY = 'averra.auth.token'
const USER_KEY = 'averra.auth.user'

function read(key) {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key, value) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    return
  }
}

function remove(key) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
  } catch {
    return
  }
}

export function getStoredToken() {
  return read(TOKEN_KEY)
}

export function getStoredUser() {
  const raw = read(USER_KEY)
  if (!raw) return null

  try {
    const user = JSON.parse(raw)
    if (!user || typeof user !== 'object' || !user.id) return null
    return user
  } catch {
    remove(USER_KEY)
    return null
  }
}

export function saveSession({ token, user }) {
  if (token) write(TOKEN_KEY, token)
  if (user) write(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  remove(TOKEN_KEY)
  remove(USER_KEY)
}
