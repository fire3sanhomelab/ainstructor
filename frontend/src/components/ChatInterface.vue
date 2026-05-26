<template>
  <div class="chat-interface">
    <div class="model-status">
      <span :class="['status-dot', isOnline ? 'online' : 'offline']"></span>
      {{ isOnline ? 'AI 在線' : 'AI 離線' }}
      <button class="clear-btn" @click="clearChat">🗑️ 清空</button>
    </div>
    
    <div class="messages" ref="messagesContainer">
      <div 
        v-for="msg in messages" 
        :key="msg.id"
        :class="['message', msg.role]"
      >
        <div class="avatar">{{ msg.role === 'user' ? '👤' : '🤖' }}</div>
        <div class="content">
          <p>{{ msg.content }}</p>
          <div v-if="msg.audioUrl" class="audio-player">
            <audio :src="msg.audioUrl" controls></audio>
          </div>
          <span class="time">{{ formatTime(msg.timestamp) }}</span>
        </div>
      </div>
      <div v-if="isLoading" class="message assistant loading">
        <div class="avatar">🤖</div>
        <div class="content">
          <div class="typing">思考中<span>.</span><span>.</span><span>.</span></div>
        </div>
      </div>
    </div>
    
    <div class="input-area">
      <button 
        class="mic-btn"
        :class="{ recording: isRecording }"
        @click="toggleRecording"
        :title="isRecording ? '停止錄音' : '語音輸入'"
      >
        🎤
      </button>
      <input 
        v-model="inputMessage"
        type="text"
        :placeholder="placeholderText"
        @keyup.enter="sendMessage"
        :disabled="isLoading"
      />
      <button class="send-btn" @click="sendMessage" :disabled="!inputMessage.trim() || isLoading">
        📤
      </button>
      <button 
        class="tts-btn"
        @click="toggleAutoTTS"
        :class="{ active: autoTTS }"
        title="自動朗讀 AI 回覆"
      >
        🔊
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useChatMessages } from '../composables/useChatMessages.js'
import { useSpeechRecognition } from '../composables/useSpeechRecognition.js'

const props = defineProps(['language'])

const {
  messages, isLoading, messagesContainer,
  loadHistory, saveHistory, clearChat: clearChatBase, addMessage,
  scrollToBottom, createAbortController, cancelRequests, generateId
} = useChatMessages(props.language)

const inputMessage = ref('')
const isOnline = ref(false)
const autoTTS = ref(false)
const onlineCheckInterval = ref(null)
const { isRecording, toggle: toggleSpeech } = useSpeechRecognition()

const placeholderText = computed(() => {
  const hints = {
    cantonese: '輸入廣東話... 或按住 🎤 講嘢',
    mandarin: '输入普通话... 或按住 🎤 说话'
  }
  return hints[props.language] || hints.cantonese
})

onMounted(() => {
  loadHistory()
  scrollToBottom()
  checkOnline()
  onlineCheckInterval.value = setInterval(checkOnline, 30000)
  // Welcome message
  if (messages.value.length === 0) {
    const welcome = props.language === 'cantonese'
      ? '你好！我係你嘅 AI 語言導師。我哋可以一齊練習廣東話或者普通話。你想學啲咩？'
      : '你好！我是你的 AI 语言导师。我们可以一起练习广东话或者普通话。你想学什么？'
    addMessage({
      role: 'assistant',
      content: welcome,
      timestamp: Date.now()
    })
    saveHistory()
  }
})

onUnmounted(() => {
  cancelRequests()
  if (onlineCheckInterval.value) {
    clearInterval(onlineCheckInterval.value)
  }
})

watch(() => props.language, () => {
  messages.value = []
  loadHistory()
  scrollToBottom()
  if (messages.value.length === 0) {
    const welcome = props.language === 'cantonese'
      ? '你好！我係你嘅 AI 語言導師。我哋可以一齊練習廣東話或者普通話。你想學啲咩？'
      : '你好！我是你的 AI 语言导师。我们可以一起练习广东话或者普通话。你想学什么？'
    addMessage({
      role: 'assistant',
      content: welcome,
      timestamp: Date.now()
    })
    saveHistory()
  }
})

function clearChat() {
  const welcome = props.language === 'cantonese'
    ? '對話已清空。有咩想學？'
    : '对话已清空。有什么想学？'
  clearChatBase(welcome)
}

async function checkOnline() {
  try {
    const res = await fetch('/api/health', { method: 'GET' })
    isOnline.value = res.ok
  } catch {
    isOnline.value = false
  }
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' })
}

async function sendMessage() {
  const text = inputMessage.value.trim()
  if (!text || isLoading.value) return
  
  addMessage({
    role: 'user',
    content: text,
    timestamp: Date.now()
  })
  inputMessage.value = ''
  isLoading.value = true
  saveHistory()
  
  const controller = createAbortController()
  
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        language: props.language,
        messages: messages.value.slice(-10).map(m => ({
          role: m.role,
          content: m.content
        })),
        model: 'opencode-go/kimi-k2.6'
      })
    })
    
    if (response.ok) {
      const data = await response.json()
      const assistantMsg = {
        role: 'assistant',
        content: data.content,
        timestamp: Date.now()
      }
      
      // Auto TTS
      if (autoTTS.value) {
        speakText(data.content)
      }
      
      addMessage(assistantMsg)
      saveHistory()
      recordActivity('chat')
    } else {
      throw new Error('Backend error')
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn('Chat request aborted')
      return
    }
    console.error('Chat error:', error)
    addMessage({
      role: 'assistant',
      content: props.language === 'cantonese'
        ? '抱歉，AI 服務暫時唔可用。請檢查後端服務是否運行緊。'
        : '抱歉，AI 服务暂时不可用。请检查后端服务是否运行。',
      timestamp: Date.now()
    })
    saveHistory()
    recordActivity('chat')
    scrollToBottom()
  } finally {
    isLoading.value = false
    scrollToBottom()
  }
}

function toggleAutoTTS() {
  autoTTS.value = !autoTTS.value
}

function recordActivity(type) {
  try {
    const saved = localStorage.getItem('learning-stats')
    const raw = saved ? JSON.parse(saved) : {}
    const stats = { totalChats: 0, practiceCount: 0, totalScore: 0, avgScore: 0, streakDays: 0, lastActivityDate: null, ...raw }
    stats.totalChats = (stats.totalChats || 0) + 1

    const today = new Date().toISOString().split('T')[0]
    if (stats.lastActivityDate) {
      const last = new Date(stats.lastActivityDate)
      const curr = new Date(today)
      const diffDays = Math.floor((curr - last) / (1000 * 60 * 60 * 24))
      if (diffDays === 1) {
        stats.streakDays = (stats.streakDays || 0) + 1
      } else if (diffDays > 1) {
        stats.streakDays = 1
      }
    } else {
      stats.streakDays = 1
    }
    stats.lastActivityDate = today

    if (stats.practiceCount > 0) {
      stats.avgScore = Math.round((stats.totalScore || 0) / stats.practiceCount)
    }

    localStorage.setItem('learning-stats', JSON.stringify(stats))

    // Log activity
    const actsSaved = localStorage.getItem('learning-activities')
    const activities = actsSaved ? JSON.parse(actsSaved) : []
    const icons = { chat: '💬', pronunciation: '🎯', scenario: '🎭' }
    const descriptions = {
      chat: '進行咗對話練習',
      pronunciation: '完成咗發音練習',
      scenario: '完成咗場景練習'
    }
    activities.push({
      id: generateId(),
      type,
      icon: icons[type] || '📌',
      description: descriptions[type] || '學習活動',
      timestamp: Date.now()
    })
    localStorage.setItem('learning-activities', JSON.stringify(activities.slice(-100)))
  } catch (e) {
    console.error('Record activity failed:', e)
  }
}

function speakText(text) {
  if (!window.speechSynthesis) return
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = props.language === 'cantonese' ? 'zh-HK' : 'zh-CN'
  utterance.rate = 0.85
  speechSynthesis.speak(utterance)
}

function toggleRecording() {
  if (isRecording.value) {
    toggleSpeech()
    return
  }
  toggleSpeech({
    lang: props.language === 'cantonese' ? 'zh-HK' : 'zh-CN',
    onResult: (transcript) => {
      inputMessage.value = transcript
      sendMessage()
    },
    onError: (err) => {
      console.warn('Speech recognition error:', err)
    }
  })
}

/* scrollToBottom is provided by useChatMessages composable */

/* Scrolling is handled by watching messages.value.length */
</script>

<style scoped>
.chat-interface {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  overflow: hidden;
}

.model-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #f9fafb;
  font-size: 0.85rem;
  color: #6b7280;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
}

.status-dot.online {
  background: #22c55e;
}

.clear-btn {
  margin-left: auto;
  padding: 0.25rem 0.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 0.8rem;
}

.messages {
  height: 400px;
  overflow-y: auto;
  padding: 1rem;
}

.message {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.message.user {
  flex-direction: row-reverse;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
  font-size: 1.1rem;
  flex-shrink: 0;
}

.content {
  max-width: 75%;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  background: #f3f4f6;
}

.message.user .content {
  background: #4F46E5;
  color: white;
}

.time {
  font-size: 0.7rem;
  opacity: 0.6;
  display: block;
  margin-top: 0.25rem;
}

.audio-player audio {
  max-width: 100%;
  margin-top: 0.5rem;
}

.typing span {
  animation: blink 1.4s infinite;
}

.typing span:nth-child(2) { animation-delay: 0.2s; }
.typing span:nth-child(3) { animation-delay: 0.4s; }

@keyframes blink {
  0%, 100% { opacity: 0; }
  50% { opacity: 1; }
}

.input-area {
  display: flex;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid #e5e7eb;
}

.mic-btn, .send-btn, .tts-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: #f3f4f6;
  cursor: pointer;
  font-size: 1.2rem;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mic-btn.recording {
  background: #ef4444;
  color: white;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.send-btn {
  background: #4F46E5;
  color: white;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tts-btn.active {
  background: #10b981;
  color: white;
}

input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 22px;
  font-size: 1rem;
  outline: none;
}

input:focus {
  border-color: #4F46E5;
}

input:focus-visible {
  outline: 2px solid #4F46E5;
  outline-offset: 2px;
}

.mic-btn:focus-visible,
.send-btn:focus-visible,
.tts-btn:focus-visible,
.clear-btn:focus-visible {
  outline: 2px solid #4F46E5;
  outline-offset: 2px;
}

input:disabled {
  background: #f9fafb;
}
</style>
