<script setup>
defineProps({
  courseId: {
    type: [Number, String],
    required: true,
  },
  pointId: {
    type: [Number, String, null],
    default: null,
  },
})

const emit = defineEmits(['back'])
</script>

<template>
  <div class="course-learning-page">
    <!-- <section class="learning-toolbar">
      <button type="button" @click="emit('back')">
        <svg viewBox="0 0 24 24"><path d="m10 6-6 6 6 6 1.4-1.4L7.8 13H20v-2H7.8l3.6-3.6L10 6Z" /></svg>
        返回课程详情
      </button>
    </section> -->

    <section class="learning-stage">
      <div class="learning-player-placeholder">
        <svg viewBox="0 0 96 96"><path d="M18 16h60a8 8 0 0 1 8 8v42a8 8 0 0 1-8 8H18a8 8 0 0 1-8-8V24a8 8 0 0 1 8-8Zm22 17v24l20-12-20-12ZM30 82h36v-6H30v6Z" /></svg>
        <strong>学习内容待接入</strong>
        <p>当前已进入学习界面，后续可根据学习页接口加载视频、文档或实训内容。</p>
      </div>
    </section>
  </div>
</template>
