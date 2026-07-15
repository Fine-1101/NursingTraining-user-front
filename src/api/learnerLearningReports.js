import { request } from './request'

const BASE = '/api/learner/learning-reports'

function idempotencyKey() {
  return globalThis.crypto?.randomUUID?.() || `report-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function unwrapData(result) {
  if (result && typeof result === 'object' && Object.prototype.hasOwnProperty.call(result, 'data')) {
    return result.data
  }
  return result
}

export async function getReportEligibility(reportType = 'WEEKLY') {
  return unwrapData(await request(`${BASE}/eligibility?reportType=${reportType}`))
}

export async function getCurrentReport(reportType = 'WEEKLY') {
  return unwrapData(await request(`${BASE}/current?reportType=${reportType}`))
}

export async function getLearningReport(reportId) {
  return unwrapData(await request(`${BASE}/${reportId}`))
}

export async function createLearningReport(payload = {}) {
  return unwrapData(await request(BASE, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey() },
    body: JSON.stringify({
      reportType: 'WEEKLY',
      forceRegenerate: false,
      ...payload,
    }),
  }))
}

export async function regenerateLearningReport(reportId) {
  return unwrapData(await request(`${BASE}/${reportId}/regenerate`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey() },
    body: JSON.stringify({ reason: 'USER_REFRESH' }),
  }))
}

export async function submitLearningReportFeedback(reportId, helpful) {
  return unwrapData(await request(`${BASE}/${reportId}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ helpful, reasonCodes: helpful ? ['PLAN_ACTIONABLE'] : ['CONTENT_TOO_GENERIC'] }),
  }))
}
