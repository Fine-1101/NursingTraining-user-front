import { request } from './request'

export function getCourseAssessment(courseId) {
  return request(`/api/learner/courses/${courseId}/assessment`)
}

export function getCourseAssessments(courseId) {
  return request(`/api/learner/courses/${courseId}/assessments`)
}

export function startAssessment(assessmentId) {
  return request(`/api/learner/assessments/${assessmentId}/start`, {
    method: 'POST',
  })
}

export function getAssessmentAttempt(attemptId) {
  return request(`/api/learner/assessment-attempts/${attemptId}`)
}

export function saveAssessmentAnswer(attemptId, attemptQuestionId, selectedOptionKey) {
  return request(`/api/learner/assessment-attempts/${attemptId}/answers/${attemptQuestionId}`, {
    method: 'PUT',
    body: JSON.stringify({ selectedOptionKey }),
  })
}

export function submitAssessmentAttempt(attemptId) {
  return request(`/api/learner/assessment-attempts/${attemptId}/submit`, {
    method: 'POST',
  })
}

export function getAssessmentResult(attemptId) {
  return request(`/api/learner/assessment-attempts/${attemptId}/result`)
}

export function getAssessmentResultHistory(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) query.set(key, value)
  })
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return request(`/api/learner/assessment-results${suffix}`)
}

export function getAssessmentAttemptReview(attemptId) {
  return request(`/api/learner/assessment-attempts/${attemptId}/review`)
}
