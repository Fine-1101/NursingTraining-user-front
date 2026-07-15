<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getCourseAssessment } from '../../api/learnerAssessments'

const props = defineProps({
  courseId: {
    type: [Number, String],
    required: true,
  },
})

const emit = defineEmits(['start-exam', 'view-result'])

const loading = ref(false)
const errorMessage = ref('')
const assessment = ref(null)
const secondsToStart = ref(0)
let timer = null

const hasAssessment = computed(() => Boolean(assessment.value?.assessmentId))
const isNotOpen = computed(() => assessment.value?.state === 'NOT_OPEN')
const canEnterExam = computed(() => assessment.value?.actionEnabled && ['START', 'CONTINUE', 'RETRY'].includes(assessment.value?.action))
const canViewResult = computed(() => assessment.value?.latestAttemptId && ['VIEW_RESULT', 'RETRY'].includes(assessment.value?.action))

const stateTextMap = {
  NOT_OPEN: '考试未开始',
  NOT_STARTED: '待考试',
  IN_PROGRESS: '考试进行中',
  PASSED: '已通过',
  FAILED: '未通过',
  CLOSED: '考试已关闭',
  NO_ATTEMPTS: '次数已用完',
}

const actionTextMap = {
  START: '进入考试',
  CONTINUE: '继续考试',
  RETRY: '再次考试',
}

function parseTime(value) {
  if (!value) return null
  const normalized = String(value).includes('T') ? value : String(value).replace(' ', 'T')
  const time = new Date(normalized)
  return Number.isNaN(time.getTime()) ? null : time
}

function formatDateTime(value) {
  const time = parseTime(value)
  if (!time) return '--'
  return time.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function formatCountdown(totalSeconds) {
  const value = Math.max(0, Number(totalSeconds || 0))
  const days = Math.floor(value / 86400)
  const hours = Math.floor((value % 86400) / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const seconds = value % 60
  if (days > 0) return `${days}天 ${hours}小时 ${minutes}分`
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function stopTimer() {
  if (timer) {
    window.clearInterval(timer)
    timer = null
  }
}

function syncCountdown() {
  stopTimer()
  if (!assessment.value?.startAt || !assessment.value?.serverTime || assessment.value?.state !== 'NOT_OPEN') {
    secondsToStart.value = 0
    return
  }

  const startAt = parseTime(assessment.value.startAt)
  const serverTime = parseTime(assessment.value.serverTime)
  if (!startAt || !serverTime) return

  secondsToStart.value = Math.max(0, Math.floor((startAt.getTime() - serverTime.getTime()) / 1000))
  timer = window.setInterval(() => {
    secondsToStart.value = Math.max(0, secondsToStart.value - 1)
    if (secondsToStart.value <= 0) {
      stopTimer()
      loadAssessment()
    }
  }, 1000)
}

async function loadAssessment() {
  loading.value = true
  errorMessage.value = ''

  try {
    assessment.value = await getCourseAssessment(props.courseId)
    syncCountdown()
  } catch (error) {
    errorMessage.value = error.message || '考核信息加载失败'
    assessment.value = null
  } finally {
    loading.value = false
  }
}

function handlePrimaryAction() {
  if (!assessment.value?.assessmentId || !canEnterExam.value) return
  emit('start-exam', {
    courseId: props.courseId,
    assessmentId: assessment.value.assessmentId,
    attemptId: assessment.value.currentAttemptId,
  })
}

function handleViewResult() {
  if (!assessment.value?.latestAttemptId) return
  emit('view-result', {
    courseId: props.courseId,
    assessmentId: assessment.value.assessmentId,
    attemptId: assessment.value.latestAttemptId,
  })
}

onMounted(loadAssessment)
onBeforeUnmount(stopTimer)
watch(() => props.courseId, loadAssessment)
</script>

<template>
  <section class="assessment-panel">
    <div class="assessment-panel-head">
      <div>
        <h2>课程考核</h2>
        <p>完成课程学习后，在规定时间内参加考核。</p>
      </div>
      <button type="button" @click="loadAssessment">刷新</button>
    </div>

    <p v-if="loading" class="empty-text">考核信息加载中...</p>
    <p v-else-if="errorMessage" class="home-error">{{ errorMessage }}</p>

    <div v-else-if="!hasAssessment" class="assessment-empty-card">
      <strong>本课程暂未发布考核</strong>
      <span>请先完成课程学习，等待教师发布课程考核。</span>
    </div>

    <article v-else class="assessment-card">
      <div class="assessment-title-row">
        <div>
          <span class="assessment-state">{{ stateTextMap[assessment.state] || assessment.state }}</span>
          <h3>{{ assessment.title }}</h3>
          <p>{{ assessment.description || '请在规定时间内独立完成本次考核。' }}</p>
        </div>
        <strong v-if="assessment.latestScore !== null && assessment.latestScore !== undefined">
          {{ assessment.latestScore }} / {{ assessment.totalScore }}
        </strong>
      </div>

      <div class="assessment-meta-grid">
        <span>开始时间：{{ formatDateTime(assessment.startAt) }}</span>
        <span>结束时间：{{ formatDateTime(assessment.endAt) }}</span>
        <span>考试时长：{{ assessment.durationMinutes || 0 }} 分钟</span>
        <span>及格分：{{ assessment.passScore || 0 }} 分</span>
        <span>考试次数：{{ assessment.usedAttempts || 0 }} / {{ assessment.maxAttempts || 0 }}</span>
        <span>剩余次数：{{ assessment.remainingAttempts ?? 0 }}</span>
      </div>

      <div v-if="isNotOpen" class="assessment-countdown">
        <span>距离考试开始</span>
        <strong>{{ formatCountdown(secondsToStart) }}</strong>
      </div>

      <p v-if="assessment.disabledReason" class="assessment-reason">{{ assessment.disabledReason }}</p>

      <div class="assessment-actions">
        <button type="button" class="assessment-primary" :disabled="!canEnterExam" @click="handlePrimaryAction">
          {{ isNotOpen ? '考试未开始' : actionTextMap[assessment.action] || '进入考试' }}
        </button>
        <button v-if="canViewResult" type="button" class="assessment-secondary" @click="handleViewResult">
          查看成绩
        </button>
      </div>
    </article>
  </section>
</template>
