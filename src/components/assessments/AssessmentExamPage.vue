<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  getAssessmentAttempt,
  saveAssessmentAnswer,
  startAssessment,
  submitAssessmentAttempt,
} from '../../api/learnerAssessments'

const props = defineProps({
  assessmentId: {
    type: [Number, String],
    required: true,
  },
  attemptId: {
    type: [Number, String],
    default: null,
  },
})

const emit = defineEmits(['back', 'submitted'])

const loading = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const saveMessage = ref('')
const attempt = ref(null)
const currentAttemptId = ref(props.attemptId)
const currentQuestionId = ref(null)
const remainingSeconds = ref(0)
const savingMap = ref({})
let timer = null

const questions = computed(() => attempt.value?.questions || [])
const answeredCount = computed(() => questions.value.filter((question) => question.selectedOptionKey).length)
const currentQuestion = computed(() => questions.value.find((question) => question.attemptQuestionId === currentQuestionId.value) || questions.value[0])

function parseTime(value) {
  if (!value) return null
  const normalized = String(value).includes('T') ? value : String(value).replace(' ', 'T')
  const time = new Date(normalized)
  return Number.isNaN(time.getTime()) ? null : time
}

function formatCountdown(totalSeconds) {
  const value = Math.max(0, Number(totalSeconds || 0))
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const seconds = value % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function questionTypeText(type) {
  return Number(type) === 2 ? '判断题' : '单选题'
}

function stopTimer() {
  if (timer) {
    window.clearInterval(timer)
    timer = null
  }
}

function syncExamCountdown(data) {
  stopTimer()
  const deadlineAt = parseTime(data?.deadlineAt)
  const serverTime = parseTime(data?.serverTime)
  if (!deadlineAt || !serverTime) return

  remainingSeconds.value = Math.max(0, Math.floor((deadlineAt.getTime() - serverTime.getTime()) / 1000))
  timer = window.setInterval(() => {
    remainingSeconds.value = Math.max(0, remainingSeconds.value - 1)
    if (remainingSeconds.value <= 0) {
      stopTimer()
      emit('submitted', { attemptId: currentAttemptId.value })
    }
  }, 1000)
}

async function loadAttempt(attemptId) {
  const data = await getAssessmentAttempt(attemptId)
  attempt.value = data
  currentAttemptId.value = data.attemptId
  currentQuestionId.value = data.questions?.[0]?.attemptQuestionId || null
  syncExamCountdown(data)
}

async function loadExam() {
  loading.value = true
  errorMessage.value = ''

  try {
    let attemptId = currentAttemptId.value
    if (!attemptId) {
      const startData = await startAssessment(props.assessmentId)
      attemptId = startData.attemptId
      currentAttemptId.value = attemptId
      syncExamCountdown(startData)
    }
    await loadAttempt(attemptId)
  } catch (error) {
    if (error.code === 8028 && currentAttemptId.value) {
      emit('submitted', { attemptId: currentAttemptId.value })
      return
    }
    errorMessage.value = error.message || '试卷加载失败'
  } finally {
    loading.value = false
  }
}

function scrollToQuestion(question) {
  currentQuestionId.value = question.attemptQuestionId
  nextTick(() => {
    document.getElementById(`exam-question-${question.attemptQuestionId}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  })
}

async function selectAnswer(question, optionKey) {
  const oldValue = question.selectedOptionKey
  question.selectedOptionKey = optionKey
  saveMessage.value = ''
  savingMap.value = { ...savingMap.value, [question.attemptQuestionId]: true }

  try {
    await saveAssessmentAnswer(currentAttemptId.value, question.attemptQuestionId, optionKey)
  } catch (error) {
    if (error.code === 8028) {
      emit('submitted', { attemptId: currentAttemptId.value })
      return
    }
    question.selectedOptionKey = oldValue
    saveMessage.value = '保存失败，稍后重试'
  } finally {
    const next = { ...savingMap.value }
    delete next[question.attemptQuestionId]
    savingMap.value = next
  }
}

async function submitExam() {
  if (!currentAttemptId.value || submitting.value) return
  const confirmed = window.confirm('确认交卷吗？交卷后不能继续修改答案。')
  if (!confirmed) return

  submitting.value = true
  errorMessage.value = ''

  try {
    const result = await submitAssessmentAttempt(currentAttemptId.value)
    emit('submitted', {
      attemptId: currentAttemptId.value,
      result,
    })
  } catch (error) {
    if (error.code === 8028 || error.code === 8026) {
      emit('submitted', { attemptId: currentAttemptId.value })
      return
    }
    errorMessage.value = error.message || '交卷失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}

function handleBeforeUnload(event) {
  event.preventDefault()
  event.returnValue = ''
}

function handleBack() {
  const confirmed = window.confirm('离开后考试不会暂停，剩余时间将继续倒计时，已保存答案会保留。')
  if (confirmed) emit('back')
}

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload)
  loadExam()
})

onBeforeUnmount(() => {
  stopTimer()
  window.removeEventListener('beforeunload', handleBeforeUnload)
})
</script>

<template>
  <main class="assessment-exam-page">
    <header class="exam-topbar">
      <button type="button" @click="handleBack">返回课程详情</button>
      <div>
        <h1>{{ attempt?.assessmentTitle || '课程考核' }}</h1>
        <p>已答 {{ answeredCount }} / {{ questions.length }}</p>
      </div>
      <strong>{{ formatCountdown(remainingSeconds) }}</strong>
    </header>

    <p v-if="loading" class="empty-text">试卷加载中...</p>
    <section v-else-if="errorMessage" class="exam-error">
      <strong>{{ errorMessage }}</strong>
      <button type="button" @click="loadExam">重试</button>
    </section>

    <section v-else-if="attempt" class="exam-layout">
      <div class="exam-question-area">
        <article
          v-for="question in questions"
          :id="`exam-question-${question.attemptQuestionId}`"
          :key="question.attemptQuestionId"
          class="exam-question-card"
          :class="{ current: currentQuestion?.attemptQuestionId === question.attemptQuestionId }"
          @mouseenter="currentQuestionId = question.attemptQuestionId"
        >
          <div class="exam-question-head">
            <span>第 {{ question.number }} 题</span>
            <em>{{ questionTypeText(question.questionType) }}</em>
            <strong>{{ question.score }} 分</strong>
          </div>
          <h2>{{ question.stem }}</h2>

          <div class="exam-options">
            <button
              v-for="option in question.options"
              :key="option.optionKey"
              type="button"
              :class="{ selected: question.selectedOptionKey === option.optionKey }"
              :disabled="savingMap[question.attemptQuestionId]"
              @click="selectAnswer(question, option.optionKey)"
            >
              <span>{{ option.optionKey === 'TRUE' ? '对' : option.optionKey === 'FALSE' ? '错' : option.optionKey }}</span>
              <p>{{ option.content }}</p>
            </button>
          </div>
        </article>
      </div>

      <aside class="exam-answer-card">
        <div class="answer-card-head">
          <h2>答题卡</h2>
          <span>{{ answeredCount }}/{{ questions.length }}</span>
        </div>
        <div class="answer-grid">
          <button
            v-for="question in questions"
            :key="question.attemptQuestionId"
            type="button"
            :class="{
              answered: question.selectedOptionKey,
              current: currentQuestion?.attemptQuestionId === question.attemptQuestionId,
            }"
            @click="scrollToQuestion(question)"
          >
            {{ question.number }}
          </button>
        </div>
        <p v-if="saveMessage" class="save-error">{{ saveMessage }}</p>
      </aside>

      <button class="exam-submit-button" type="button" :disabled="submitting" @click="submitExam">
        {{ submitting ? '交卷中...' : '交卷' }}
      </button>
    </section>
  </main>
</template>
