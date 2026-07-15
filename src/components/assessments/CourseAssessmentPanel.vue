<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getCourseAssessments } from '../../api/learnerAssessments'

const props = defineProps({
  courseId: {
    type: [Number, String],
    required: true,
  },
})

const emit = defineEmits(['start-exam', 'view-result'])

const loading = ref(false)
const errorMessage = ref('')
const assessments = ref([])
const clock = ref(Date.now())
let timer = null

const hasAssessment = computed(() => assessments.value.length > 0)

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

function startTimer() {
  stopTimer()
  clock.value = Date.now()
  timer = window.setInterval(() => { clock.value = Date.now() }, 1000)
}

function secondsUntilStart(item) {
  if (item?.state !== 'NOT_OPEN') return 0
  const startAt = parseTime(item.startAt)
  if (!startAt) return 0
  return Math.max(0, Math.floor((startAt.getTime() - clock.value) / 1000))
}

function canEnterExam(item) {
  return item?.actionEnabled && ['START', 'CONTINUE', 'RETRY'].includes(item?.action)
}

function canViewResult(item) {
  return item?.latestAttemptId && ['VIEW_RESULT', 'RETRY'].includes(item?.action)
}

async function loadAssessment() {
  loading.value = true
  errorMessage.value = ''

  try {
    const data = await getCourseAssessments(props.courseId)
    assessments.value = Array.isArray(data) ? data : []
    startTimer()
  } catch (error) {
    errorMessage.value = error.message || '考核信息加载失败'
    assessments.value = []
  } finally {
    loading.value = false
  }
}

function handlePrimaryAction(assessment) {
  if (!assessment?.assessmentId || !canEnterExam(assessment)) return
  emit('start-exam', {
    courseId: props.courseId,
    assessmentId: assessment.assessmentId,
    attemptId: assessment.currentAttemptId,
  })
}

function handleViewResult(assessment) {
  if (!assessment?.latestAttemptId) return
  emit('view-result', {
    courseId: props.courseId,
    assessmentId: assessment.assessmentId,
    attemptId: assessment.latestAttemptId,
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

    <div v-else class="assessment-card-list">
    <article v-for="assessment in assessments" :key="assessment.assessmentId" class="assessment-card">
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
        <span>最晚提交时间：{{ formatDateTime(assessment.endAt) }}</span>
        <span>考试时长：{{ assessment.durationMinutes || 0 }} 分钟</span>
        <span>及格分：{{ assessment.passScore || 0 }} 分</span>
        <span>考试次数：{{ assessment.usedAttempts || 0 }} / {{ assessment.maxAttempts || 0 }}</span>
        <span>剩余次数：{{ assessment.remainingAttempts ?? 0 }}</span>
      </div>

      <div v-if="assessment.state === 'NOT_OPEN'" class="assessment-countdown">
        <span>距离考试开始</span>
        <strong>{{ formatCountdown(secondsUntilStart(assessment)) }}</strong>
      </div>

      <p v-if="assessment.disabledReason" class="assessment-reason">{{ assessment.disabledReason }}</p>

      <div class="assessment-actions">
        <button type="button" class="assessment-primary" :disabled="!canEnterExam(assessment)" @click="handlePrimaryAction(assessment)">
          {{ assessment.state === 'NOT_OPEN' ? '考试未开始' : actionTextMap[assessment.action] || '进入考试' }}
        </button>
        <button v-if="canViewResult(assessment)" type="button" class="assessment-secondary" @click="handleViewResult(assessment)">
          查看成绩
        </button>
      </div>
    </article>
    </div>
  </section>
</template>

<style scoped>
.assessment-card-list{display:grid;gap:16px}
</style>
