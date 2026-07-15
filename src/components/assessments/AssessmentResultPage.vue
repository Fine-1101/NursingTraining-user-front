<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { getAssessmentResult } from '../../api/learnerAssessments'

const props = defineProps({
  attemptId: {
    type: [Number, String],
    required: true,
  },
  resultPayload: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['back'])

const loading = ref(false)
const errorMessage = ref('')
const result = ref(props.resultPayload)

const passedText = computed(() => {
  if (!result.value) return ''
  return result.value.passed ? '已通过' : '未通过'
})

async function loadResult() {
  if (props.resultPayload) {
    result.value = props.resultPayload
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    result.value = await getAssessmentResult(props.attemptId)
  } catch (error) {
    errorMessage.value = error.message || '成绩加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(loadResult)
watch(() => props.attemptId, loadResult)
</script>

<template>
  <div class="assessment-result-page">
    <section class="result-card">
      <p v-if="loading" class="empty-text">成绩加载中...</p>
      <div v-else-if="errorMessage" class="exam-error">
        <strong>{{ errorMessage }}</strong>
        <button type="button" @click="loadResult">重试</button>
      </div>

      <template v-else-if="result">
        <div class="result-hero" :class="{ passed: result.passed }">
          <span>{{ passedText }}</span>
          <strong>{{ result.score ?? 0 }}</strong>
          <p>总分 {{ result.totalScore ?? 0 }}，及格分 {{ result.passScore ?? 0 }}</p>
        </div>

        <div class="result-title-row">
          <div>
            <h2>{{ result.assessmentTitle || '课程考核成绩' }}</h2>
            <p>第 {{ result.attemptNo || 1 }} 次考试</p>
          </div>
          <button type="button" @click="emit('back')">返回课程详情</button>
        </div>

        <div class="result-stat-grid">
          <article>
            <span>正确题数</span>
            <strong>{{ result.correctCount ?? 0 }}</strong>
          </article>
          <article>
            <span>错误题数</span>
            <strong>{{ result.wrongCount ?? 0 }}</strong>
          </article>
          <article>
            <span>未答题数</span>
            <strong>{{ result.unansweredCount ?? 0 }}</strong>
          </article>
          <article>
            <span>剩余次数</span>
            <strong>{{ result.remainingAttempts ?? 0 }}</strong>
          </article>
        </div>
      </template>
    </section>
  </div>
</template>
