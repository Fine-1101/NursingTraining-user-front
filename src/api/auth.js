import { clearAuthSession, request, setAuthSession } from './request'

export async function login(username, password) {
  const session = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })

  if (String(session?.user?.role) !== '1') {
    clearAuthSession()
    throw new Error('当前端仅允许学生账号登录')
  }

  setAuthSession(session)
  return session
}

export async function register(payload) {
  const session = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ ...payload, roleType: 1 }),
  })

  setAuthSession(session)
  return session
}

export async function logout() {
  try {
    await request('/api/auth/logout', {
      method: 'POST',
    })
  } finally {
    clearAuthSession()
  }
}
