<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import {
  createLearningReport,
  getCurrentReport,
  getLearningReport,
  getReportEligibility,
  regenerateLearningReport,
  submitLearningReportFeedback,
} from '../../api/learnerLearningReports'

const props = defineProps({ user: { type: Object, default: () => ({}) } })
const emit = defineEmits(['profile-saved', 'open-courses'])

const form = reactive({ realName: '', username: '', phone: '', departmentName: '', email: '' })
const saved = ref(false)
const report = ref(null)
const eligibility = ref(null)
const loading = ref(true)
const actionLoading = ref(false)
const errorMessage = ref('')
const feedback = ref(null)
let pollTimer = null
let pollStartedAt = 0

const displayName = computed(() => form.realName || props.user.nickname || form.username || '学员')
const initials = computed(() => displayName.value.slice(0, 1))
const isGenerating = computed(() => ['PENDING', 'GENERATING'].includes(report.value?.status))
const qualityText = computed(() => ({ INSUFFICIENT: '数据不足', LOW: '初步分析', MEDIUM: '数据良好', HIGH: '数据充分' }[report.value?.dataQuality?.level] || '持续积累中'))
const performanceText = computed(() => ({ EXCELLENT: '表现优秀', GOOD: '表现良好', STABLE: '状态平稳', NEEDS_IMPROVEMENT: '建议加强', UNKNOWN: '待观察' }[report.value?.performanceLevel] || '待观察'))

function hydrateForm() {
  Object.assign(form, {
    realName: props.user.realName || props.user.nickname || '',
    username: props.user.username || '',
    phone: props.user.phone || '',
    departmentName: props.user.departmentName || props.user.deptName || '',
    email: props.user.email || '',
  })
}

function saveProfile() {
  const next = { ...props.user, ...form, nickname: form.realName || props.user.nickname }
  localStorage.setItem('userInfo', JSON.stringify(next))
  saved.value = true
  emit('profile-saved', next)
  window.setTimeout(() => { saved.value = false }, 2200)
}

function clearPolling() {
  if (pollTimer) window.clearTimeout(pollTimer)
  pollTimer = null
}

async function pollReport(reportId, delaySeconds = 2) {
  clearPolling()
  if (Date.now() - pollStartedAt > 60000) return
  pollTimer = window.setTimeout(async () => {
    try {
      report.value = await getLearningReport(reportId)
      if (['PENDING', 'GENERATING'].includes(report.value?.status)) {
        pollReport(reportId, report.value.retryAfterSeconds || 3)
      }
    } catch (error) {
      errorMessage.value = error.message || '报告状态更新失败'
    }
  }, delaySeconds * 1000)
}

async function loadReport() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [current, condition] = await Promise.all([
      getCurrentReport('WEEKLY'),
      getReportEligibility('WEEKLY'),
    ])
    report.value = current
    eligibility.value = condition
    if (isGenerating.value) {
      pollStartedAt = Date.now()
      pollReport(report.value.reportId, report.value.retryAfterSeconds || 2)
    }
  } catch (error) {
    errorMessage.value = error.message || '学习报告加载失败'
  } finally {
    loading.value = false
  }
}

async function generateReport(regenerate = false) {
  actionLoading.value = true
  errorMessage.value = ''
  feedback.value = null
  try {
    const result = regenerate && report.value?.reportId
      ? await regenerateLearningReport(report.value.reportId)
      : await createLearningReport('WEEKLY')
    report.value = { ...result, progress: result.status === 'PENDING' ? 8 : result.progress }
    if (result.reportMode === 'GUIDANCE_ONLY') return
    if (result.status === 'SUCCESS') {
      report.value = await getLearningReport(result.reportId)
      return
    }
    pollStartedAt = Date.now()
    pollReport(result.reportId, 2)
  } catch (error) {
    errorMessage.value = error.message || '报告生成失败，请稍后重试'
  } finally {
    actionLoading.value = false
  }
}

async function sendFeedback(helpful) {
  if (!report.value?.reportId || feedback.value !== null) return
  try {
    await submitLearningReportFeedback(report.value.reportId, helpful)
    feedback.value = helpful
  } catch (error) {
    errorMessage.value = error.message || '反馈提交失败'
  }
}

onMounted(() => { hydrateForm(); loadReport() })
onBeforeUnmount(clearPolling)
</script>

<template>
  <div class="profile-page">
    <aside class="profile-card profile-editor">
      <div class="profile-identity">
        <span class="profile-avatar">{{ initials }}</span>
        <div><h2>{{ displayName }}</h2><p>{{ form.departmentName || '护理学习中心' }} · 学员</p></div>
      </div>
      <div class="profile-divider"></div>
      <form class="profile-form" @submit.prevent="saveProfile">
        <label><span>姓名</span><input v-model.trim="form.realName" placeholder="请输入姓名" /></label>
        <label><span>账号</span><input v-model="form.username" disabled /></label>
        <label><span>所属科室</span><input v-model.trim="form.departmentName" placeholder="请输入所属科室" /></label>
        <label><span>手机号码</span><input v-model.trim="form.phone" inputmode="tel" placeholder="请输入手机号码" /></label>
        <label><span>电子邮箱</span><input v-model.trim="form.email" type="email" placeholder="请输入电子邮箱" /></label>
        <p class="profile-save-note" :class="{ visible: saved }">资料已保存</p>
        <button class="profile-save-button" type="submit">保存修改</button>
      </form>
    </aside>

    <section class="report-column">
      <header class="report-heading">
        <div><span class="ai-label">AI 学习助手</span><h2>本周学习报告</h2><p>基于你的学习行为与考核表现生成个性化建议</p></div>
        <button v-if="report?.status === 'SUCCESS'" :disabled="actionLoading" type="button" @click="generateReport(true)">重新生成</button>
      </header>

      <div v-if="loading" class="report-state-card"><span class="report-spinner"></span><strong>正在整理你的学习数据</strong><p>请稍候，马上为你呈现</p></div>

      <div v-else-if="errorMessage && !report" class="report-state-card error">
        <strong>报告暂时无法加载</strong><p>{{ errorMessage }}</p><button type="button" @click="loadReport">重新加载</button>
      </div>

      <div v-else-if="!report" class="report-welcome">
        <div class="report-orb">AI</div><span>你的专属学习洞察</span><h3>让每一次学习都有迹可循</h3>
        <p>系统将分析学习时长、课程进度和考核表现，为你总结优势、定位待提升知识点，并规划下一步学习任务。</p>
        <div class="eligibility-row"><span>数据质量 {{ eligibility?.dataQuality?.score || 0 }}%</span><span>已记录 {{ eligibility?.validLearningEventCount || 0 }} 次学习行为</span></div>
        <button v-if="eligibility?.eligible" :disabled="actionLoading" type="button" @click="generateReport(false)">{{ actionLoading ? '正在创建…' : '生成本周报告' }}</button>
        <button v-else class="secondary" type="button" @click="emit('open-courses')">去完成一次学习</button>
        <small v-if="!eligibility?.eligible">{{ eligibility?.reasonMessage || '完成课程学习后即可生成报告' }}</small>
      </div>

      <div v-else-if="isGenerating" class="report-state-card generating">
        <span class="report-spinner"></span><strong>AI 正在生成你的学习报告</strong><p>正在聚合学习记录并分析知识掌握情况</p>
        <div class="report-progress"><i :style="{ width: `${report.progress || 18}%` }"></i></div><small>生成完成后会自动展示，无需刷新页面</small>
      </div>

      <div v-else-if="report.reportMode === 'GUIDANCE_ONLY'" class="report-welcome guidance">
        <div class="report-orb">↗</div><h3>{{ report.guidance?.title || '开始你的第一次学习' }}</h3><p>{{ report.guidance?.description || '完成至少一个课程知识点后，即可生成入门学习报告。' }}</p>
        <button type="button" @click="emit('open-courses')">{{ report.guidance?.actionLabel || '选择课程' }}</button>
      </div>

      <div v-else-if="report.status === 'FAILED'" class="report-state-card error">
        <strong>报告生成遇到一点问题</strong><p>{{ report.failure?.message || '你仍可以查看本周基础学习概览' }}</p>
        <p v-if="report.fallbackReport?.summary" class="fallback-summary">{{ report.fallbackReport.summary }}</p>
        <button v-if="report.failure?.retryable" type="button" @click="generateReport(true)">再试一次</button>
      </div>

      <template v-else-if="report.status === 'SUCCESS'">
        <article class="report-summary-card">
          <div class="report-summary-top"><div><span>{{ report.reportMode === 'ONBOARDING' ? '入门报告' : '完整报告' }}</span><h3>{{ report.title || '本周学习报告' }}</h3><p>{{ report.period?.displayText || '本周学习表现概览' }}</p></div><strong>{{ performanceText }}</strong></div>
          <p class="report-summary-text">{{ report.summary }}</p>
          <div class="report-metrics">
            <div><strong>{{ report.overview?.studyMinutes || 0 }}</strong><span>学习分钟</span></div><div><strong>{{ report.overview?.activeDays || 0 }}</strong><span>活跃天数</span></div><div><strong>{{ report.overview?.completedPoints || 0 }}</strong><span>完成知识点</span></div><div><strong>{{ report.overview?.averageScore ?? '--' }}</strong><span>平均成绩</span></div>
          </div>
          <div class="quality-line"><span>数据质量 · {{ qualityText }}</span><i><b :style="{ width: `${report.dataQuality?.score || 0}%` }"></b></i><strong>{{ report.dataQuality?.score || 0 }}%</strong></div>
        </article>

        <div class="report-detail-grid">
          <article class="insight-card strengths"><header><span>✓</span><div><h3>学习优势</h3><p>继续保持这些良好表现</p></div></header><div v-for="item in report.strengths || []" :key="item.knowledgePointId" class="knowledge-row"><div><strong>{{ item.name }}</strong><p>{{ item.analysis }}</p></div><em>{{ item.masteryScore }}%</em></div><p v-if="!report.strengths?.length" class="muted">继续学习，更多优势正在被发现</p></article>
          <article class="insight-card weaknesses"><header><span>!</span><div><h3>重点提升</h3><p>建议优先关注的知识点</p></div></header><div v-for="item in report.weaknesses || []" :key="item.knowledgePointId" class="knowledge-row"><div><strong>{{ item.name }}</strong><p>{{ item.analysis }}</p></div><em>{{ item.masteryScore }}%</em></div><p v-if="!report.weaknesses?.length" class="muted">本周暂无明显薄弱项</p></article>
        </div>

        <article class="study-plan-card"><header><div><span>下一步</span><h3>推荐学习计划</h3></div><p>按顺序完成，效果更佳</p></header><div v-for="plan in report.studyPlan || []" :key="plan.sequence" class="plan-row"><b>{{ plan.sequence }}</b><div><strong>{{ plan.title }}</strong><p>{{ plan.action }}</p><span>{{ plan.reason }}</span></div><em>{{ plan.estimatedMinutes }} 分钟</em></div><p v-if="!report.studyPlan?.length" class="muted">保持当前节奏，新的学习计划将在下期更新</p></article>

        <footer class="report-footer"><p>“{{ report.encouragement || '保持学习节奏，每一点进步都值得记录。' }}”</p><div><span>{{ feedback === null ? '这份报告对你有帮助吗？' : '感谢你的反馈' }}</span><button :class="{ active: feedback === true }" type="button" @click="sendFeedback(true)">有帮助</button><button :class="{ active: feedback === false }" type="button" @click="sendFeedback(false)">待改进</button></div><small>{{ report.disclaimer }}</small></footer>
      </template>

      <p v-if="errorMessage && report" class="report-inline-error">{{ errorMessage }}</p>
    </section>
  </div>
</template>
