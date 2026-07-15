export const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

export function getAccessToken() {
  return localStorage.getItem('accessToken') || ''
}

export function setAuthSession(session) {
  localStorage.setItem('tokenType', session.tokenType || 'Bearer')
  localStorage.setItem('accessToken', session.accessToken)
  localStorage.setItem('expiresIn', String(session.expiresIn || ''))
  localStorage.setItem('userInfo', JSON.stringify(session.user || {}))
}

export function clearAuthSession() {
  localStorage.removeItem('tokenType')
  localStorage.removeItem('accessToken')
  localStorage.removeItem('expiresIn')
  localStorage.removeItem('userInfo')
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('userInfo') || '{}')
  } catch {
    return {}
  }
}

function createRequestError(result, response) {
  const error = new Error(result?.message || `Request failed: ${response.status}`)
  error.code = result?.code
  error.status = response.status
  error.data = result?.data
  return error
}

function isAuthExpired(result, response) {
  return response.status === 401 || result?.code === 401
}

function notifyAuthExpired() {
  clearAuthSession()
  window.dispatchEvent(new CustomEvent('auth-expired'))
}

export async function request(path, options = {}) {
  const token = getAccessToken()
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  const result = await response.json().catch(() => null)

  if (!response.ok) {
    if (isAuthExpired(result, response)) {
      notifyAuthExpired()
    }
    throw createRequestError(result, response)
  }

  if (result && typeof result.code === 'number' && result.code !== 0) {
    if (isAuthExpired(result, response)) {
      notifyAuthExpired()
    }
    throw createRequestError(result, response)
  }

  return result?.data ?? result
}
