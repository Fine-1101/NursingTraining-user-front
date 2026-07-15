import { API_BASE, request } from './request'

export function getMessages(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, value)
    }
  })

  const suffix = query.toString() ? `?${query.toString()}` : ''
  return request(`/api/messages${suffix}`)
}

export function getUnreadMessageCount() {
  return request('/api/messages/unread-count')
}

export function markMessageRead(messageId) {
  return request(`/api/messages/${messageId}/read`, {
    method: 'PATCH',
  })
}

export function getWebSocketTicket() {
  return request('/api/ws/ticket', {
    method: 'POST',
  })
}

export function resolveWebSocketUrl(path, ticket) {
  const configuredBase = import.meta.env.VITE_WS_BASE_URL
  const base = configuredBase || API_BASE || window.location.origin
  const url = new URL(path, base)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.searchParams.set('ticket', ticket)
  return url.toString()
}
