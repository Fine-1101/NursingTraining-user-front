<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import AuthPage from './components/auth/AuthPage.vue'
import HomePage from './components/home/HomePage.vue'
import MyCoursesPage from './components/courses/MyCoursesPage.vue'
import CourseDetailPage from './components/courses/CourseDetailPage.vue'
import CourseLearningPage from './components/courses/CourseLearningPage.vue'
import AssessmentExamPage from './components/assessments/AssessmentExamPage.vue'
import AssessmentResultPage from './components/assessments/AssessmentResultPage.vue'
import LearningRecordsPage from './components/records/LearningRecordsPage.vue'
import DashboardLayout from './layouts/DashboardLayout.vue'
import { clearAuthSession, getStoredUser } from './api/request'
import { logout, register } from './api/auth'
import { getLearnerCourseDetail } from './api/learnerCourses'
import './styles/app.css'

const page = ref(getStoredUser().username ? 'dashboard' : 'auth')
const activeModule = ref('home')
const selectedCourseId = ref(null)
const selectedPointId = ref(null)
const selectedAssessmentId = ref(null)
const selectedAttemptId = ref(null)
const assessmentResultPayload = ref(null)
const authView = ref('login')
const selectedRole = ref('')
const registerDraft = ref({})
const registerLoading = ref(false)
const registerError = ref('')
const currentUser = ref(getStoredUser())

function resetToLogin() {
  clearAuthSession()
  currentUser.value = {}
  selectedCourseId.value = null
  selectedPointId.value = null
  selectedAssessmentId.value = null
  selectedAttemptId.value = null
  assessmentResultPayload.value = null
  activeModule.value = 'home'
  authView.value = 'login'
  page.value = 'auth'
}

function showLogin() {
  authView.value = 'login'
}

function showRegister() {
  authView.value = 'registerInfo'
}

function goRoleSelect(form) {
  registerDraft.value = form
  registerError.value = ''
  authView.value = 'registerRole'
}

async function completeRegister() {
  registerError.value = ''

  if (!selectedRole.value) {
    selectedRole.value = 'student'
  }

  registerLoading.value = true

  try {
    const roleType = selectedRole.value === 'teacher' ? 2 : 1
    const session = await register({
      username: registerDraft.value.username,
      password: registerDraft.value.password,
      realName: registerDraft.value.realName,
      deptId: registerDraft.value.deptId,
      roleType,
    })

    currentUser.value = session.user || getStoredUser()
    page.value = 'dashboard'
  } catch (error) {
    registerError.value = error.message || '注册失败，请检查填写信息'
  } finally {
    registerLoading.value = false
  }
}

function handleLoginSuccess(user) {
  currentUser.value = user || getStoredUser()
  page.value = 'dashboard'
}

function openCourseDetail(courseId) {
  selectedCourseId.value = courseId
  activeModule.value = 'courseDetail'
}

async function openCourseLearning(payload) {
  const courseId = payload?.courseId ?? selectedCourseId.value
  if (!courseId) return

  selectedCourseId.value = courseId

  let pointId = payload?.pointId ?? null
  if (pointId === null || pointId === undefined || pointId === '') {
    try {
      const detail = await getLearnerCourseDetail(courseId)
      pointId = detail?.nextPointId
        ?? detail?.lastPointId
        ?? detail?.lastLearnedPointId
        ?? detail?.chapters?.flatMap((chapter) => chapter.points || [])[0]?.pointId
        ?? null
    } catch {
      // The detail page can show the request error and let the learner retry.
    }
  }

  if (pointId === null || pointId === undefined || pointId === '') {
    selectedPointId.value = null
    activeModule.value = 'courseDetail'
    return
  }

  selectedPointId.value = pointId
  activeModule.value = 'courseLearning'
}

function backToCourses() {
  activeModule.value = 'courses'
}

function backToCourseDetail() {
  activeModule.value = selectedCourseId.value ? 'courseDetail' : 'courses'
}

function openAssessmentExam(payload) {
  selectedCourseId.value = payload?.courseId ?? selectedCourseId.value
  selectedAssessmentId.value = payload?.assessmentId ?? null
  selectedAttemptId.value = payload?.attemptId ?? null
  assessmentResultPayload.value = null
  if (selectedAssessmentId.value) {
    activeModule.value = 'assessmentExam'
  }
}

function openAssessmentResult(payload) {
  selectedCourseId.value = payload?.courseId ?? selectedCourseId.value
  selectedAssessmentId.value = payload?.assessmentId ?? selectedAssessmentId.value
  selectedAttemptId.value = payload?.attemptId ?? selectedAttemptId.value
  assessmentResultPayload.value = payload?.result ?? null
  if (selectedAttemptId.value) {
    activeModule.value = 'assessmentResult'
  }
}

function handleAssessmentSubmitted(payload) {
  selectedAttemptId.value = payload?.attemptId ?? selectedAttemptId.value
  assessmentResultPayload.value = payload?.result ?? null
  activeModule.value = 'assessmentResult'
}

async function handleLogout() {
  await logout()
  resetToLogin()
}

onMounted(() => {
  window.addEventListener('auth-expired', resetToLogin)
})

onBeforeUnmount(() => {
  window.removeEventListener('auth-expired', resetToLogin)
})
</script>

<template>
  <main class="app-shell">
    <Transition name="page-fade" mode="out-in">
      <AuthPage
        v-if="page === 'auth'"
        :view="authView"
        :selected-role="selectedRole"
        :register-loading="registerLoading"
        :register-error="registerError"
        @login-success="handleLoginSuccess"
        @show-register="showRegister"
        @show-login="showLogin"
        @register-next="goRoleSelect"
        @select-role="selectedRole = $event"
        @register-complete="completeRegister"
      />

      <AssessmentExamPage
        v-else-if="activeModule === 'assessmentExam' && selectedAssessmentId"
        :assessment-id="selectedAssessmentId"
        :attempt-id="selectedAttemptId"
        @back="backToCourseDetail"
        @submitted="handleAssessmentSubmitted"
      />

      <DashboardLayout
        v-else
        :user="currentUser"
        :active-module="activeModule"
        @change-module="activeModule = $event"
        @logout="handleLogout"
      >
        <HomePage
          v-if="activeModule === 'home'"
          @open-detail="openCourseDetail"
          @start-learning="openCourseLearning"
        />
        <MyCoursesPage
          v-else-if="activeModule === 'courses'"
          @open-detail="openCourseDetail"
          @start-learning="openCourseLearning"
        />
        <CourseDetailPage
          v-else-if="activeModule === 'courseDetail' && selectedCourseId"
          :course-id="selectedCourseId"
          @back="backToCourses"
          @start-learning="openCourseLearning"
          @start-assessment="openAssessmentExam"
          @view-assessment-result="openAssessmentResult"
        />
        <CourseLearningPage
          v-else-if="activeModule === 'courseLearning' && selectedCourseId"
          :course-id="selectedCourseId"
          :point-id="selectedPointId"
          @back="backToCourseDetail"
        />
        <AssessmentResultPage
          v-else-if="activeModule === 'assessmentResult' && selectedAttemptId"
          :attempt-id="selectedAttemptId"
          :result-payload="assessmentResultPayload"
          @back="backToCourseDetail"
        />
        <LearningRecordsPage v-else-if="activeModule === 'records'" />
        <div v-else class="module-placeholder">
          <h1>{{ activeModule === 'records' ? '学习记录' : '个人中心' }}</h1>
          <p>模块待开发</p>
        </div>
      </DashboardLayout>
    </Transition>
  </main>
</template>
