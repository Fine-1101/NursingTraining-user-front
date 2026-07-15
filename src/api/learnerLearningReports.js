import { request } from './request'

const BASE = '/api/learner/learning-reports'

function idempotencyKey() {
  return globalThis.crypto?.randomUUID?.() || `report-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function getReportEligibility(reportType = 'WEEKLY') {
  return request(`${BASE}/eligibility?reportType=${reportType}`)
}

export function getCurrentReport(reportType = 'WEEKLY') {
  return request(`${BASE}/current?reportType=${reportType}`)
}

export function getLearningReport(reportId) {
  return request(`${BASE}/${reportId}`)
}

export function createLearningReport(reportType = 'WEEKLY') {
  return request(BASE, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey() },
    body: JSON.stringify({ reportType, forceRegenerate: false }),
  })
}

export function regenerateLearningReport(reportId) {
  return request(`${BASE}/${reportId}/regenerate`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey() },
    body: JSON.stringify({ reason: 'USER_REFRESH' }),
  })
}

export function submitLearningReportFeedback(reportId, helpful) {
  return request(`${BASE}/${reportId}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ helpful, reasonCodes: helpful ? ['PLAN_ACTIONABLE'] : ['CONTENT_TOO_GENERIC'] }),
  })
}
