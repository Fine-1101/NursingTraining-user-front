import { request } from './request'

export function getCourseAssessment(courseId) {
  return request(`/api/learner/courses/${courseId}/assessment`)
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
