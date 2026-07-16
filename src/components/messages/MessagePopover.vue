<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  getMessages,
  getUnreadMessageCount,
  getWebSocketTicket,
  markMessageRead,
  resolveWebSocketUrl,
} from '../../api/learnerMessages'
import { getAccessToken } from '../../api/request'

const open = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const messages = ref([])
const unreadCount = ref(0)
const pageInfo = ref({
  page: 1,
  size: 20,
  total: 0,
  pages: 0,
})
const expandedMessageId = ref(null)
const toast = ref(null)

let socket = null
let reconnectTimer = null
let reconnectAttempt = 0
let manuallyClosed = false
let toastTimer = null

const hasUnread = computed(() => unreadCount.value > 0)

function formatTime(value) {
  if (!value) return '--'
  const normalized = String(value).includes('T') ? value : String(value).replace(' ', 'T')
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function normalizeList(data) {
  return {
    records: data?.records || [],
    total: data?.total || 0,
    page: data?.page || 1,
    size: data?.size || 20,
    pages: data?.pages || 0,
  }
}

async function loadMessages() {
  loading.value = true
  errorMessage.value = ''

  try {
    const data = normalizeList(await getMessages({ page: 1, size: 20, readStatus: 'ALL' }))
    messages.value = data.records
    pageInfo.value = {
      page: data.page,
      size: data.size,
      total: data.total,
      pages: data.pages,
    }
  } catch (error) {
    errorMessage.value = error.message || '消息加载失败'
  } finally {
    loading.value = false
  }
}

async function loadUnreadCount() {
  try {
    const data = await getUnreadMessageCount()
    unreadCount.value = Number(data?.unreadCount || 0)
  } catch {
    unreadCount.value = 0
  }
}

function prependMessage(message) {
  if (!message?.messageId) return
  const exists = messages.value.some((item) => item.messageId === message.messageId)
  if (exists) return

  messages.value = [message, ...messages.value].slice(0, pageInfo.value.size || 20)
  pageInfo.value = {
    ...pageInfo.value,
    total: pageInfo.value.total + 1,
  }
  if (!message.read) unreadCount.value += 1
}

function showNotification(message) {
  toast.value = {
    title: message.courseTitle || '课程消息',
    content: message.content || '',
  }

  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.value = null
  }, 4500)

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(toast.value.title, {
      body: toast.value.content,
    })
  }
}

function scheduleReconnect() {
  if (manuallyClosed || !getAccessToken()) return
  const baseDelay = Math.min(30000, 1000 * (2 ** reconnectAttempt))
  const jitter = Math.floor(Math.random() * 500)
  reconnectAttempt += 1

  window.clearTimeout(reconnectTimer)
  reconnectTimer = window.setTimeout(connectWebSocket, baseDelay + jitter)
}

async function connectWebSocket() {
  if (manuallyClosed || !getAccessToken()) return

  try {
    const { ticket, webSocketPath } = await getWebSocketTicket()
    if (!ticket || !webSocketPath) return

    socket = new WebSocket(resolveWebSocketUrl(webSocketPath, ticket))

    socket.onopen = () => {
      reconnectAttempt = 0
      loadMessages()
      loadUnreadCount()
    }

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload.event === 'COURSE_STUDENT_MESSAGE_CREATED') {
          prependMessage(payload.data)
          showNotification(payload.data)
        }
      } catch {
        // Ignore malformed WebSocket payloads.
      }
    }

    socket.onclose = scheduleReconnect
    socket.onerror = () => {
      socket?.close()
    }
  } catch (error) {
    if (error?.status === 401 || !getAccessToken()) {
      closeWebSocket()
      return
    }
    scheduleReconnect()
  }
}

function closeWebSocket() {
  manuallyClosed = true
  window.clearTimeout(reconnectTimer)
  reconnectTimer = null
  if (socket) {
    socket.onclose = null
    socket.close()
    socket = null
  }
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    loadMessages()
    loadUnreadCount()
  }
}

async function handleToggleOpen() {
  open.value = !open.value
  if (open.value) {
    await Promise.all([loadMessages(), loadUnreadCount()])
  }
}

async function handleMessageClick(message) {
  expandedMessageId.value = expandedMessageId.value === message.messageId ? null : message.messageId
  if (message.read) return

  try {
    await markMessageRead(message.messageId)
    message.read = true
    message.readAt = new Date().toISOString()
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  } catch (error) {
    errorMessage.value = error.message || '消息已读状态更新失败'
  }
}

onMounted(() => {
  manuallyClosed = false
  loadUnreadCount()
  loadMessages()
  connectWebSocket()
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onBeforeUnmount(() => {
  closeWebSocket()
  window.clearTimeout(toastTimer)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
</script>

<template>
  <div class="message-center">
    <button class="message-bell-button" type="button" title="消息通知" @click="handleToggleOpen">
      <svg viewBox="0 0 24 24"><path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5-6.7V3a2 2 0 1 0-4 0v1.3A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z" /></svg>
      <span v-if="hasUnread">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
    </button>

    <section v-if="open" class="message-popover">
      <header>
        <div>
          <h2>消息通知</h2>
          <p>{{ unreadCount }} 条未读</p>
        </div>
        <button type="button" @click="loadMessages">刷新</button>
      </header>

      <p v-if="loading" class="empty-text">消息加载中...</p>
      <p v-else-if="errorMessage" class="home-error">{{ errorMessage }}</p>
      <div v-else-if="messages.length" class="message-list">
        <button
          v-for="message in messages"
          :key="message.messageId"
          type="button"
          class="message-item"
          :class="{ unread: !message.read, expanded: expandedMessageId === message.messageId }"
          @click="handleMessageClick(message)"
        >
          <span class="message-unread-dot"></span>
          <strong>{{ message.courseTitle || '课程消息' }}</strong>
          <p>{{ message.content }}</p>
          <small>{{ message.senderName || '系统' }} · {{ formatTime(message.createdAt) }}</small>
        </button>
      </div>
      <p v-else class="empty-text">暂无消息</p>
    </section>

    <aside v-if="toast" class="message-toast">
      <strong>{{ toast.title }}</strong>
      <p>{{ toast.content }}</p>
    </aside>
  </div>
</template>
