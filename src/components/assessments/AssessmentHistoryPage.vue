<script setup>
import { onMounted, reactive, ref } from 'vue'
import { getAssessmentAttemptReview, getAssessmentResultHistory } from '../../api/learnerAssessments'

const loading = ref(false)
const errorMessage = ref('')
const records = ref([])
const total = ref(0)
const pages = ref(0)
const query = reactive({ keyword: '', passed: '', page: 1, size: 10 })
const reviewOpen = ref(false)
const reviewLoading = ref(false)
const reviewError = ref('')
const review = ref(null)

function formatDateTime(value) {
  if (!value) return '—'
  return String(value).replace('T', ' ').slice(0, 16)
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return '—'
  const minutes = Math.max(1, Math.ceil(Number(seconds) / 60))
  return `${minutes} 分钟`
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const data = await getAssessmentResultHistory(query)
    records.value = data?.records || []
    total.value = Number(data?.total || 0)
    pages.value = Number(data?.pages || 0)
    query.page = Number(data?.page || query.page)
  } catch (error) {
    records.value = []
    errorMessage.value = error.message || '历史考核结果加载失败'
  } finally {
    loading.value = false
  }
}

function search() {
  query.page = 1
  load()
}

function changePage(page) {
  if (page < 1 || page > pages.value || page === query.page) return
  query.page = page
  load()
}

async function openReview(item) {
  reviewOpen.value = true
  reviewLoading.value = true
  reviewError.value = ''
  review.value = null
  try {
    review.value = await getAssessmentAttemptReview(item.attemptId)
  } catch (error) {
    reviewError.value = error.message || '试卷详情加载失败'
  } finally {
    reviewLoading.value = false
  }
}

function closeReview() {
  reviewOpen.value = false
  review.value = null
  reviewError.value = ''
}

function optionClass(option) {
  return {
    correct: option.correct,
    'wrong-selected': option.selected && !option.correct,
    selected: option.selected,
  }
}

function optionKeyText(optionKey) {
  if (optionKey === null || optionKey === undefined || optionKey === '') return '未作答'
  const normalized = String(optionKey).trim().toUpperCase()
  if (normalized === 'TRUE') return '对'
  if (normalized === 'FALSE') return '错'
  return optionKey
}

onMounted(load)
</script>

<template>
  <section class="assessment-history-page">
    <header class="history-heading">
      <div>
        <!-- <h2>往次考核结果</h2>
        <p>查看已经完成的考试记录、成绩和通过情况。</p> -->
      </div>
      <strong>共 {{ total }} 条记录</strong>
    </header>

    <form class="history-filters" @submit.prevent="search">
      <input v-model.trim="query.keyword" maxlength="100" placeholder="搜索课程或考核名称" />
      <select v-model="query.passed">
        <option value="">全部结果</option>
        <option value="true">已通过</option>
        <option value="false">未通过</option>
      </select>
      <button type="submit">查询</button>
    </form>

    <p v-if="loading" class="history-state">成绩记录加载中...</p>
    <p v-else-if="errorMessage" class="history-state error">{{ errorMessage }}</p>
    <div v-else-if="!records.length" class="history-empty">
      <strong>暂无往次考核结果</strong>
      <span>完成并提交课程考核后，成绩会显示在这里。</span>
    </div>

    <div v-else class="history-list">
      <article v-for="item in records" :key="item.attemptId" class="history-card">
        <div class="result-mark" :class="{ passed: item.passed }">
          <strong>{{ item.score ?? 0 }}</strong>
          <span>/ {{ item.totalScore ?? 0 }}</span>
        </div>
        <div class="result-main">
          <div>
            <span class="result-state" :class="{ passed: item.passed }">{{ item.passed ? '已通过' : '未通过' }}</span>
            <h3>{{ item.assessmentTitle || '课程考核' }}</h3>
          </div>
          <p>{{ item.courseTitle || '未命名课程' }} · 第 {{ item.attemptNo || 1 }} 次考试</p>
          <small>交卷时间：{{ formatDateTime(item.submittedAt) }}　考试用时：{{ formatDuration(item.durationSeconds) }}</small>
        </div>
        <button class="detail-button" type="button" @click="openReview(item)">查看详情</button>
      </article>
    </div>

    <footer v-if="pages > 1" class="history-pagination">
      <button type="button" :disabled="query.page <= 1" @click="changePage(query.page - 1)">上一页</button>
      <span>第 {{ query.page }} / {{ pages }} 页</span>
      <button type="button" :disabled="query.page >= pages" @click="changePage(query.page + 1)">下一页</button>
    </footer>

    <div v-if="reviewOpen" class="review-overlay" @click.self="closeReview">
      <section class="review-dialog" role="dialog" aria-modal="true" aria-label="考核试卷详情">
        <header>
          <div>
            <h2>{{ review?.assessmentTitle || '考核试卷详情' }}</h2>
            <p v-if="review">{{ review.courseTitle }} · 第 {{ review.attemptNo }} 次考试</p>
          </div>
          <button type="button" aria-label="关闭" @click="closeReview">×</button>
        </header>

        <p v-if="reviewLoading" class="review-state">试卷详情加载中...</p>
        <div v-else-if="reviewError" class="review-state error">
          <p>{{ reviewError }}</p>
          <button type="button" @click="closeReview">关闭</button>
        </div>

        <div v-else-if="review" class="review-content">
          <div class="review-summary">
            <article :class="{ passed: review.passed }"><span>{{ review.passed ? '已通过' : '未通过' }}</span><strong>{{ review.score ?? 0 }} / {{ review.totalScore ?? 0 }}</strong></article>
            <article><span>答对</span><strong>{{ review.correctCount ?? 0 }}</strong></article>
            <article><span>答错</span><strong>{{ review.wrongCount ?? 0 }}</strong></article>
            <article><span>未作答</span><strong>{{ review.unansweredCount ?? 0 }}</strong></article>
          </div>

          <div class="review-questions">
            <article v-for="question in review.questions" :key="question.attemptQuestionId" class="review-question">
              <header>
                <strong>第 {{ question.number }} 题</strong>
                <span>{{ question.earnedScore ?? 0 }} / {{ question.maxScore ?? 0 }} 分</span>
              </header>
              <h3>{{ question.stem }}</h3>
              <div class="review-options">
                <div v-for="option in question.options" :key="option.optionKey" :class="optionClass(option)">
                  <b>{{ optionKeyText(option.optionKey) }}</b>
                  <span>{{ option.content }}</span>
                  <em v-if="option.correct">正确答案</em>
                  <em v-if="option.selected">你的答案</em>
                </div>
              </div>
              <p class="answer-line">你的答案：{{ optionKeyText(question.selectedOptionKey) }}　正确答案：{{ optionKeyText(question.correctOptionKey) }}</p>
              <p v-if="question.analysis" class="analysis-line"><strong>答案解析：</strong>{{ question.analysis }}</p>
            </article>
          </div>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.assessment-history-page{padding:28px 34px 40px}.history-heading,.history-filters,.history-card,.history-pagination{display:flex;align-items:center}.history-heading{justify-content:space-between;margin-bottom:22px}.history-heading h2{margin:0 0 7px;font-size:24px}.history-heading p{margin:0;color:#748078}.history-heading>strong{color:#268250}.history-filters{gap:12px;margin-bottom:18px;padding:18px;background:#fff;border:1px solid #e4ebe7;border-radius:12px}.history-filters input,.history-filters select{height:42px;padding:0 13px;border:1px solid #dce5df;border-radius:8px;background:#fff}.history-filters input{flex:1}.history-filters select{width:150px}.history-filters button,.detail-button,.history-pagination button{height:40px;padding:0 20px;border:0;border-radius:8px;cursor:pointer}.history-filters button,.detail-button{color:#fff;background:#218651}.history-list{display:grid;gap:13px}.history-card{gap:18px;padding:20px;background:#fff;border:1px solid #e4ebe7;border-radius:13px}.result-mark{width:82px;height:72px;display:flex;align-items:baseline;justify-content:center;padding-top:13px;color:#cb554d;background:#fff2f0;border-radius:10px}.result-mark.passed{color:#218651;background:#edf8f1}.result-mark strong{font-size:28px}.result-mark span{font-size:13px}.result-main{flex:1;min-width:0}.result-main>div{display:flex;align-items:center;gap:10px}.result-main h3{margin:0;font-size:17px}.result-main p{margin:9px 0 7px;color:#59675f}.result-main small{color:#89938d}.result-state{padding:4px 9px;color:#bd4a43;background:#fff0ee;border-radius:12px;font-size:12px}.result-state.passed{color:#237f4e;background:#eaf7ef}.history-state,.history-empty{padding:60px;text-align:center;background:#fff;border:1px solid #e4ebe7;border-radius:12px;color:#78837c}.history-state.error{color:#c34c45}.history-empty{display:grid;gap:8px}.history-pagination{justify-content:center;gap:18px;margin-top:20px}.history-pagination button{border:1px solid #dce5df;background:#fff}.history-pagination button:disabled{opacity:.45;cursor:not-allowed}@media(max-width:720px){.assessment-history-page{padding:18px}.history-heading,.history-filters,.history-card{align-items:stretch;flex-direction:column}.history-filters select{width:100%}.detail-button{width:100%}}
.review-overlay{position:fixed;z-index:80;inset:0;display:grid;place-items:center;padding:24px;background:rgba(10,30,20,.48)}.review-dialog{width:min(960px,96vw);max-height:92vh;overflow:hidden;background:#f7f9f8;border-radius:16px;box-shadow:0 24px 80px rgba(0,30,15,.25)}.review-dialog>header{height:74px;display:flex;align-items:center;justify-content:space-between;padding:0 24px;background:#fff;border-bottom:1px solid #e2e9e5}.review-dialog>header h2{margin:0 0 5px;font-size:20px}.review-dialog>header p{margin:0;color:#77827b}.review-dialog>header button{font-size:30px;color:#69756e;background:none;border:0;cursor:pointer}.review-state{padding:80px;text-align:center}.review-state.error{color:#bd4a43}.review-content{max-height:calc(92vh - 74px);padding:22px;overflow:auto}.review-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}.review-summary article{display:grid;gap:6px;padding:15px;background:#fff;border:1px solid #e2e9e5;border-radius:10px}.review-summary article:first-child{color:#bf4d46}.review-summary article:first-child.passed{color:#218651}.review-summary span{color:#7b867f;font-size:13px}.review-summary strong{font-size:21px}.review-questions{display:grid;gap:14px}.review-question{padding:20px;background:#fff;border:1px solid #e2e9e5;border-radius:12px}.review-question>header{display:flex;justify-content:space-between;color:#278252}.review-question h3{margin:14px 0;font-size:16px;line-height:1.65}.review-options{display:grid;gap:8px}.review-options>div{display:grid;grid-template-columns:32px 1fr auto auto;align-items:center;gap:9px;padding:10px 12px;border:1px solid #e1e7e3;border-radius:8px}.review-options b{width:26px;height:26px;display:grid;place-items:center;border-radius:50%;background:#f0f4f1}.review-options em{padding:3px 7px;color:#526159;background:#eef2ef;border-radius:10px;font-size:11px;font-style:normal}.review-options>div.correct{border-color:#75c596;background:#effaf3}.review-options>div.correct b{color:#fff;background:#24905a}.review-options>div.wrong-selected{border-color:#e5a19c;background:#fff3f2}.review-options>div.wrong-selected b{color:#fff;background:#cf5b53}.answer-line,.analysis-line{margin:13px 0 0;padding:10px 12px;border-radius:8px;background:#f6f8f7;color:#536159}.analysis-line{line-height:1.65;background:#fff9eb}@media(max-width:720px){.review-summary{grid-template-columns:1fr 1fr}.review-options>div{grid-template-columns:32px 1fr}.review-options em{grid-column:2}.review-overlay{padding:8px}}
</style>
