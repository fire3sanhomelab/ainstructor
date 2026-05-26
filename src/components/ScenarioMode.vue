<template>
  <div class="scenario-mode">
    <h3>🎭 場景練習</h3>
    <p class="desc">選擇一個生活場景，同 AI 進行角色扮演練習</p>
    
    <div v-if="isScenariosLoading" class="loading-state">
      <div class="spinner"></div>
      <p>載入場景中...</p>
    </div>
    <div v-else-if="!activeScenario" class="scenarios-grid">
      <div 
        v-for="scenario in scenarios" 
        :key="scenario.id"
        class="scenario-card"
        @click="startScenario(scenario)"
      >
        <span class="icon">{{ scenario.icon || '📍' }}</span>
        <h4>{{ scenario.name }}</h4>
        <p>{{ scenario.description }}</p>
      </div>
    </div>
    
    <div v-else class="scenario-chat">
      <div class="scenario-header">
        <button class="back-btn" @click="activeScenario = null">⬅️ 返回</button>
        <h4>{{ activeScenario.name }}</h4>
        <span class="badge">角色扮演</span>
      </div>
      
      <div class="messages" ref="messagesContainer">
        <div 
          v-for="msg in scenarioMessages" 
          :key="msg.id"
          :class="['message', msg.role]"
        >
          <div class="avatar">{{ msg.role === 'user' ? '👤' : '🎭' }}</div>
          <div class="content">
            <p>{{ msg.content }}</p>
            <span class="time">{{ formatTime(msg.timestamp) }}</span>
          </div>
        </div>
        <div v-if="isLoading" class="message assistant loading">
          <div class="avatar">🎭</div>
          <div class="content">
            <div class="typing">準備中<span>.</span><span>.</span><span>.</span></div>
          </div>
        </div>
      </div>
      
      <div class="input-area">
        <button 
          class="mic-btn"
          :class="{ recording: isRecording }"
          @click="toggleRecording"
        >
          🎤
        </button>
        <input 
          v-model="inputMessage"
          type="text"
          :placeholder="language === 'cantonese' ? '輸入對話...' : '输入对话...'"
          @keyup.enter="sendMessage"
        />
        <button class="send-btn" @click="sendMessage" :disabled="!inputMessage.trim()">
          📤
        </button>
      </div>
      
      <div class="hints">
        <p>💡 {{ hintText }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch, onUnmounted } from 'vue'
import { useSpeechRecognition } from '../composables/useSpeechRecognition.js'

const props = defineProps(['language'])

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

const scenarios = ref([])
const activeScenario = ref(null)
const scenarioMessages = ref([])
const inputMessage = ref('')
const isLoading = ref(false)
const isScenariosLoading = ref(true)
const messagesContainer = ref(null)
const abortController = ref(null)

const { isRecording, toggle: toggleSpeech } = useSpeechRecognition()

const hintText = computed(() => {
  const hints = {
    restaurant: '試下點餐、問價錢、講特殊要求',
    shopping: '問價錢、講數量、討價還價',
    taxi: '講目的地、問車費、約時間',
    hospital: '描述症狀、約覆診時間',
    friends: '閒聊近況、約食飯時間地點',
    hotel: '辦理入住、問房間設施',
    interview: '自我介紹、回答問題'
  }
  return hints[activeScenario.value?.id] || '自由發揮，盡量多講！'
})

// Load scenarios
async function loadScenarios() {
  isScenariosLoading.value = true
  const controller = new AbortController()
  try {
    const res = await fetch(`/api/ainstructor/scenarios?language=${props.language}`, {
      signal: controller.signal
    })
    if (res.ok) {
      const data = await res.json()
      scenarios.value = data.scenarios
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      console.warn('Scenarios load aborted')
      return
    }
    console.error('Failed to load scenarios:', e)
    // Fallback
    scenarios.value = [
      { id: 'restaurant', name: props.language === 'cantonese' ? '🍜 茶餐廳點餐' : '🍜 餐厅点餐', description: '練習點餐' },
      { id: 'shopping', name: props.language === 'cantonese' ? '🛍️ 買餸' : '🛍️ 购物', description: '練習買嘢' }
    ]
  } finally {
    isScenariosLoading.value = false
  }
}

loadScenarios()

async function startScenario(scenario) {
  activeScenario.value = scenario
  scenarioMessages.value = []
  isLoading.value = true
  
  if (abortController.value) abortController.value.abort()
  abortController.value = new AbortController()
  
  try {
    const res = await fetch('/api/ainstructor/scenario-start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abortController.value.signal,
      body: JSON.stringify({
        scenarioId: scenario.id,
        language: props.language
      })
    })
    
    if (res.ok) {
      const data = await res.json()
      scenarioMessages.value.push({
        id: generateId(),
        role: 'assistant',
        content: data.message,
        timestamp: Date.now()
      })
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      console.warn('Scenario start aborted')
      return
    }
    console.error('Scenario start failed:', e)
    scenarioMessages.value.push({
      id: generateId(),
      role: 'assistant',
      content: props.language === 'cantonese' ? '你好！有咩可以幫到你？' : '你好！有什么可以帮你的？',
      timestamp: Date.now()
    })
  } finally {
    isLoading.value = false
    scrollToBottom()
  }
}

async function sendMessage() {
  const text = inputMessage.value.trim()
  if (!text) return
  
  scenarioMessages.value.push({
    id: generateId(),
    role: 'user',
    content: text,
    timestamp: Date.now()
  })
  
  inputMessage.value = ''
  isLoading.value = true
  
  if (abortController.value) abortController.value.abort()
  abortController.value = new AbortController()
  
  try {
    const res = await fetch('/api/ainstructor/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abortController.value.signal,
      body: JSON.stringify({
        language: props.language,
        messages: scenarioMessages.value.slice(-8).map(m => ({
          role: m.role,
          content: m.content
        })),
        model: 'opencode-go/kimi-k2.6'
      })
    })
    
    if (res.ok) {
      const data = await res.json()
      scenarioMessages.value.push({
        id: generateId(),
        role: 'assistant',
        content: data.content,
        timestamp: Date.now()
      })
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      console.warn('Scenario chat aborted')
      return
    }
    console.error('Scenario chat failed:', e)
  } finally {
    isLoading.value = false
    scrollToBottom()
  }
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

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' })
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

watch(() => scenarioMessages.value.length, scrollToBottom)

onUnmounted(() => {
  if (abortController.value) {
    abortController.value.abort()
  }
})
</script>

<style scoped>
.scenario-mode {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.scenario-mode h3 {
  margin-bottom: 0.5rem;
  color: #4F46E5;
}

.desc {
  color: #6b7280;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.scenarios-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.scenario-card {
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.scenario-card:hover {
  border-color: #4F46E5;
  background: #eef2ff;
  transform: translateY(-2px);
}

.scenario-card .icon {
  font-size: 2rem;
  display: block;
  margin-bottom: 0.5rem;
}

.scenario-card h4 {
  margin-bottom: 0.25rem;
}

.scenario-card p {
  font-size: 0.85rem;
  color: #6b7280;
}

/* Scenario Chat */
.scenario-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.back-btn {
  padding: 0.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: white;
  cursor: pointer;
}

.badge {
  margin-left: auto;
  padding: 0.25rem 0.5rem;
  background: #eef2ff;
  color: #4F46E5;
  border-radius: 4px;
  font-size: 0.75rem;
}

.messages {
  height: 350px;
  overflow-y: auto;
  padding: 0.5rem;
  margin-bottom: 1rem;
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
  flex-shrink: 0;
}

.content {
  max-width: 70%;
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

.typing span {
  animation: blink 1.4s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 0; }
  50% { opacity: 1; }
}

.input-area {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  border-top: 1px solid #e5e7eb;
}

.mic-btn, .send-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: #f3f4f6;
  cursor: pointer;
}

.mic-btn.recording {
  background: #ef4444;
  color: white;
}

.send-btn {
  background: #4F46E5;
  color: white;
}

input {
  flex: 1;
  padding: 0.5rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 20px;
  outline: none;
}

input:focus {
  border-color: #4F46E5;
}

input:focus-visible,
.mic-btn:focus-visible,
.send-btn:focus-visible,
.back-btn:focus-visible,
.scenario-card:focus-visible {
  outline: 2px solid #4F46E5;
  outline-offset: 2px;
}

.loading-state {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e5e7eb;
  border-top-color: #4F46E5;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.hints {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: #fef3c7;
  border-radius: 8px;
  font-size: 0.85rem;
}
</style>
