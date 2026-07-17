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
import {
  forceRelogin,
  getLearnerDepartments,
  getLearnerProfile,
  updateLearnerPassword,
  updateLearnerProfile,
} from '../../api/learnerProfile'

const props = defineProps({ user: { type: Object, default: () => ({}) } })
const emit = defineEmits(['profile-saved', 'open-courses'])

const form = reactive({ realName: '', username: '', phone: '', deptId: '', departmentName: '' })
const passwordForm = reactive({ newPassword: '', confirmPassword: '' })
const saved = ref(false)
const passwordSaved = ref(false)
const profileLoading = ref(false)
const profileSaving = ref(false)
const passwordSaving = ref(false)
const profileError = ref('')
const passwordError = ref('')
const departments = ref([])
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
const learningRhythmText = computed(() => {
  const activeDays = Number(report.value?.overview?.activeDays || 0)
  const averageMinutes = Number(report.value?.overview?.averageMinutesPerActiveDay || 0)
  if (activeDays >= 5) return `本周期保持了较高频率的学习，共有 ${activeDays} 个活跃学习日。`
  if (activeDays >= 3) return `本周期已有 ${activeDays} 个活跃学习日，学习节奏较为稳定。`
  if (activeDays > 0) return `本周期已开始学习，活跃 ${activeDays} 天${averageMinutes ? `，活跃日平均学习 ${averageMinutes} 分钟` : ''}。`
  return '本周期尚未形成稳定学习节奏，可以从一次短时学习开始。'
})
const assessmentText = computed(() => {
  const count = Number(report.value?.overview?.assessmentCount || 0)
  const averageScore = report.value?.overview?.averageScore
  if (count && averageScore !== null && averageScore !== undefined) return `本周期完成 ${count} 次考核，平均成绩 ${averageScore} 分。`
  if (count) return `本周期已参与 ${count} 次考核，成绩数据仍在汇总。`
  return '本周期暂无考核记录，完成课程学习后可通过考核检验掌握情况。'
})
const nextSuggestion = computed(() => {
  const overview = report.value?.overview || {}
  if (!Number(overview.studyMinutes || 0)) return '先完成一次有效课程学习，建立本周学习记录。'
  if (!Number(overview.completedPoints || 0)) return '继续当前课程，优先完成一个课程知识点。'
  if (!Number(overview.assessmentCount || 0)) return '完成当前学习内容后，参加一次课程考核检验学习效果。'
  return '保持当前学习频率，继续推进正在学习的课程内容。'
})

function highlightTypeText(type) {
  return ({
    LEARNING_CONTINUITY: '学习连续性',
    POINT_COMPLETION: '内容完成',
    ASSESSMENT: '考核表现',
  })[type] || '学习表现'
}

function formatLocalDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function currentWeeklyPeriod() {
  const today = new Date()
  const monday = new Date(today)
  const day = today.getDay()
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
  return {
    periodStart: formatLocalDate(monday),
    periodEnd: formatLocalDate(today),
  }
}

function normalizeApiData(value) {
  if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'data')) {
    return value.data
  }
  return value ?? null
}

function hydrateForm() {
  Object.assign(form, {
    realName: props.user.realName || props.user.nickname || '',
    username: props.user.username || '',
    phone: props.user.phone || '',
    deptId: props.user.deptId || props.user.departmentId || '',
    departmentName: props.user.departmentName || props.user.deptName || '',
  })
}

function applyProfile(profile) {
  if (!profile) return
  Object.assign(form, {
    realName: profile.realName || '',
    username: profile.username || '',
    phone: profile.phone || '',
    deptId: profile.deptId || '',
    departmentName: profile.departmentName || '',
  })
  const next = {
    ...props.user,
    id: profile.userId || props.user.id,
    username: profile.username,
    realName: profile.realName,
    nickname: profile.realName || profile.username,
    phone: profile.phone,
    deptId: profile.deptId,
    departmentName: profile.departmentName,
    role: String(profile.roleType || props.user.role || 1),
  }
  localStorage.setItem('userInfo', JSON.stringify(next))
  emit('profile-saved', next)
}

async function loadProfile() {
  profileLoading.value = true
  profileError.value = ''
  try {
    const [profile, options] = await Promise.all([
      getLearnerProfile(),
      getLearnerDepartments(),
    ])
    departments.value = Array.isArray(options) ? options : []
    applyProfile(profile)
  } catch (error) {
    profileError.value = error.message || '个人信息加载失败'
  } finally {
    profileLoading.value = false
  }
}

async function saveProfile() {
  profileSaving.value = true
  profileError.value = ''
  saved.value = false
  try {
    const profile = await updateLearnerProfile({
      realName: form.realName,
      phone: form.phone,
      deptId: form.deptId ? Number(form.deptId) : null,
    })
    applyProfile(profile)
    saved.value = true
    window.setTimeout(() => { saved.value = false }, 2200)
  } catch (error) {
    profileError.value = error.message || '个人信息保存失败'
  } finally {
    profileSaving.value = false
  }
}

async function changePassword() {
  passwordSaving.value = true
  passwordError.value = ''
  passwordSaved.value = false
  try {
    await updateLearnerPassword({ ...passwordForm })
    Object.assign(passwordForm, { newPassword: '', confirmPassword: '' })
    passwordSaved.value = true
    window.setTimeout(forceRelogin, 900)
  } catch (error) {
    passwordError.value = error.message || '密码修改失败'
  } finally {
    passwordSaving.value = false
  }
}

function onDepartmentChange() {
  const dept = departments.value.find(item => String(item.deptId) === String(form.deptId))
  form.departmentName = dept?.departmentName || ''
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
    const [currentResponse, conditionResponse] = await Promise.all([
      getCurrentReport('WEEKLY'),
      getReportEligibility('WEEKLY'),
    ])
    const current = normalizeApiData(currentResponse)
    const condition = normalizeApiData(conditionResponse)
    const eligible = condition?.eligible === true || condition?.eligible === 1 || condition?.eligible === 'true'
    report.value = current
    eligibility.value = condition ? { ...condition, eligible } : null
    if (isGenerating.value) {
      pollStartedAt = Date.now()
      pollReport(report.value.reportId, report.value.retryAfterSeconds || 2)
    } else if (!current && eligible) {
      await generateReport(false)
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
      : await createLearningReport({
          reportType: 'WEEKLY',
          ...currentWeeklyPeriod(),
          forceRegenerate: false,
        })
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

onMounted(() => { hydrateForm(); loadProfile(); loadReport() })
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
        <label><span>姓名</span><input v-model.trim="form.realName" :disabled="profileLoading" placeholder="请输入姓名" required /></label>
        <label><span>账号</span><input v-model="form.username" disabled /></label>
        <label>
          <span>手机号</span>
          <input v-model.trim="form.phone" :disabled="profileLoading" inputmode="tel" maxlength="11" placeholder="请输入手机号" />
        </label>
        <label>
          <span>所属科室</span>
          <select v-model="form.deptId" :disabled="profileLoading || !departments.length" required @change="onDepartmentChange">
            <option value="" disabled>请选择科室</option>
            <option v-for="dept in departments" :key="dept.deptId" :value="dept.deptId">{{ dept.departmentName }}</option>
          </select>
        </label>
        <p v-if="profileError" class="profile-error">{{ profileError }}</p>
        <p class="profile-save-note" :class="{ visible: saved }">资料已保存</p>
        <button class="profile-save-button" :disabled="profileLoading || profileSaving" type="submit">{{ profileSaving ? '保存中...' : '保存修改' }}</button>
      </form>

      <div class="profile-divider"></div>
      <form class="profile-form password-reset-form" @submit.prevent="changePassword">
        <div class="profile-section-title"><strong>重置密码</strong><span>输入新密码后即可重置，修改成功后需要重新登录</span></div>
        <label><span>新密码</span><input v-model="passwordForm.newPassword" type="password" autocomplete="new-password" minlength="8" maxlength="20" placeholder="请输入8-20位新密码" required /></label>
        <label><span>确认新密码</span><input v-model="passwordForm.confirmPassword" type="password" autocomplete="new-password" minlength="8" maxlength="20" placeholder="请再次输入新密码" required /></label>
        <p v-if="passwordError" class="profile-error">{{ passwordError }}</p>
        <p class="profile-save-note" :class="{ visible: passwordSaved }">密码已修改，即将返回登录页</p>
        <button class="profile-save-button secondary" :disabled="passwordSaving" type="submit">{{ passwordSaving ? '修改中...' : '修改密码' }}</button>
      </form>
    </aside>

    <section class="report-column">
      <header class="report-heading">
        <div><span class="ai-label">AI 学习助手</span><h2>本周学习报告</h2><p>基于你的学习行为与考核表现生成个性化建议</p></div>
        <button v-if="report?.status === 'SUCCESS'" :disabled="actionLoading" type="button" @click="generateReport(true)">重新生成</button>
      </header>

      <div v-if="loading" class="report-state-card"><span class="report-spinner"></span><strong>正在准备你的个性化学习报告</strong><p>检查本周学习数据，符合条件后将自动开始生成</p></div>

      <div v-else-if="errorMessage && !report" class="report-state-card error">
        <strong>报告暂时无法生成</strong><p>{{ errorMessage }}</p><button type="button" @click="loadReport">重新尝试</button>
      </div>

      <div v-else-if="!report" class="report-welcome">
        <div class="report-orb">AI</div><span>你的专属学习洞察</span><h3>让每一次学习都有迹可循</h3>
        <p>系统将分析学习时长、课程进度和考核表现，为你总结优势、定位待提升知识点，并规划下一步学习任务。</p>
        <div class="eligibility-row"><span>数据质量 {{ eligibility?.dataQuality?.score || 0 }}%</span><span>已记录 {{ eligibility?.validLearningEventCount || 0 }} 次学习行为</span></div>
        <button v-if="eligibility?.eligible" :disabled="actionLoading" type="button" @click="generateReport(false)">{{ actionLoading ? '正在创建生成任务…' : '立即生成本周报告' }}</button>
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

        <article class="report-content-card highlights-card">
          <header class="report-section-heading"><div><span>本周表现</span><h3>学习亮点</h3></div><p>值得肯定的学习行为与成果</p></header>
          <div v-if="report.highlights?.length" class="highlight-list">
            <div v-for="(highlight, index) in report.highlights" :key="`${highlight.type}-${index}`" class="highlight-item">
              <b>{{ index + 1 }}</b>
              <div><span>{{ highlightTypeText(highlight.type) }}</span><strong>{{ highlight.title }}</strong><p>{{ highlight.description }}</p><small v-if="highlight.evidence?.length">{{ highlight.evidence.join(' · ') }}</small></div>
            </div>
          </div>
          <p v-else class="report-empty-copy">本周期暂无可展示的学习亮点，继续完成课程学习后会自动更新。</p>
        </article>

        <div class="report-analysis-grid">
          <article class="report-content-card compact-report-card"><span>学习节奏</span><h3>{{ report.overview?.activeDays || 0 }} 个活跃日</h3><p>{{ learningRhythmText }}</p></article>
          <article class="report-content-card compact-report-card assessment-overview"><span>考核表现</span><h3>{{ report.overview?.averageScore ?? '--' }} 分</h3><p>{{ assessmentText }}</p></article>
        </div>

        <div class="report-analysis-grid">
          <article class="report-content-card compact-report-card"><span>数据说明</span><h3>分析限制</h3><ul v-if="report.dataQuality?.limitations?.length"><li v-for="item in report.dataQuality.limitations" :key="item">{{ item }}</li></ul><p v-else>当前数据质量良好，暂无额外分析限制。</p></article>
          <article class="report-content-card compact-report-card next-suggestion"><span>下一步</span><h3>通用学习建议</h3><p>{{ nextSuggestion }}</p><button type="button" @click="emit('open-courses')">进入我的课程</button></article>
        </div>

        <footer class="report-footer"><p>“{{ report.encouragement || '保持学习节奏，每一点进步都值得记录。' }}”</p><div><span>{{ feedback === null ? '这份报告对你有帮助吗？' : '感谢你的反馈' }}</span><button :class="{ active: feedback === true }" type="button" @click="sendFeedback(true)">有帮助</button><button :class="{ active: feedback === false }" type="button" @click="sendFeedback(false)">待改进</button></div><small>{{ report.disclaimer }}</small></footer>
      </template>

      <div v-else class="report-welcome">
        <div class="report-orb">AI</div><h3>本周报告尚未生成</h3>
        <p>点击下方按钮创建个性化学习报告，系统会在生成完成后自动展示。</p>
        <button :disabled="actionLoading" type="button" @click="generateReport(false)">{{ actionLoading ? '正在创建生成任务…' : '生成本周报告' }}</button>
      </div>

      <p v-if="errorMessage && report" class="report-inline-error">{{ errorMessage }}</p>
    </section>
  </div>
</template>
