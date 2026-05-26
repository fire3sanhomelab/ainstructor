import { ref, watch, nextTick } from 'vue'

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function sanitizeMessage(msg) {
  if (!msg || typeof msg !== 'object') return null
  const safe = {
    id: typeof msg.id === 'string' ? msg.id : generateId(),
    role: msg.role === 'user' || msg.role === 'assistant' ? msg.role : 'assistant',
    content: typeof msg.content === 'string' ? msg.content : '',
    timestamp: typeof msg.timestamp === 'number' && !isNaN(msg.timestamp) ? msg.timestamp : Date.now()
  }
  if (msg.audioUrl && typeof msg.audioUrl === 'string') {
    safe.audioUrl = msg.audioUrl
  }
  return safe
}

function sanitizeForStorage(messages) {
  return messages.map(sanitizeMessage).filter(Boolean)
}

export function useChatMessages(language) {
  const messages = ref([])
  const isLoading = ref(false)
  const messagesContainer = ref(null)
  const abortController = ref(null)

  function loadHistory() {
    try {
      const key = `chat-history-${language}`
      const saved = localStorage.getItem(key)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          messages.value = sanitizeForStorage(parsed)
        }
      }
    } catch (e) {
      console.error('Failed to load history:', e)
      messages.value = []
    }
  }

  function saveHistory() {
    try {
      const key = `chat-history-${language}`
      const toSave = sanitizeForStorage(messages.value.slice(-50))
      localStorage.setItem(key, JSON.stringify(toSave))
    } catch (e) {
      console.error('Failed to save history:', e)
      if (e.name === 'QuotaExceededError') {
        // Try to save just last 20 messages
        try {
          const key = `chat-history-${language}`
          const toSave = sanitizeForStorage(messages.value.slice(-20))
          localStorage.setItem(key, JSON.stringify(toSave))
        } catch (e2) {
          console.error('Still failed after reducing:', e2)
        }
      }
    }
  }

  function clearChat(welcomeMsg = '') {
    messages.value = []
    saveHistory()
    if (welcomeMsg) {
      messages.value.push({
        id: generateId(),
        role: 'assistant',
        content: welcomeMsg,
        timestamp: Date.now()
      })
      saveHistory()
    }
  }

  function addMessage(msg) {
    const safe = sanitizeMessage(msg)
    if (safe) {
      messages.value.push(safe)
    }
  }

  function scrollToBottom() {
    nextTick(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
      }
    })
  }

  function createAbortController() {
    if (abortController.value) {
      abortController.value.abort()
    }
    abortController.value = new AbortController()
    return abortController.value
  }

  function cancelRequests() {
    if (abortController.value) {
      abortController.value.abort()
      abortController.value = null
    }
  }

  // Watch length instead of deep watch for performance
  watch(() => messages.value.length, scrollToBottom)

  return {
    messages,
    isLoading,
    messagesContainer,
    loadHistory,
    saveHistory,
    clearChat,
    addMessage,
    scrollToBottom,
    createAbortController,
    cancelRequests,
    generateId,
    sanitizeMessage
  }
}
