import { clearAuthSession, request } from './request'

export function getLearnerProfile() {
  return request('/api/learner/profile')
}

export function updateLearnerProfile(payload) {
  return request('/api/learner/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function updateLearnerPassword(payload) {
  return request('/api/learner/profile/password', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function getLearnerDepartments() {
  return request('/api/learner/profile/departments')
}

export function forceRelogin() {
  clearAuthSession()
  window.dispatchEvent(new CustomEvent('auth-expired'))
}
