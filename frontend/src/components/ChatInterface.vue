<template>
  <div class="chat-interface">
    <div class="model-status">
      <div class="status-left">
        <span :class="['status-dot', isOnline ? 'online' : 'offline']"></span>
        <span class="status-text">{{ isOnline ? '後端已連線' : '後端離線' }}</span>
        <span class="engine-tag" v-if="currentEngine">{{ currentEngine }}</span>
      </div>
      <button class="clear-btn" @click="clearChat">🗑️ 清空對話</button>
    </div>
    
    <div class="messages" ref="messagesContainer">
      <div 
        v-for="msg in messages" 
        :key="msg.id"
        :class="['message', msg.role]"
      >
        <div class="avatar">{{ msg.role === 'user' ? '👤' : '🤖' }}</div>
        <div class="content-wrapper">
          <div class="content">
            <p>{{ msg.content }}</p>
            <div v-if="msg.audioUrl" class="audio-player">
              <audio :src="msg.audioUrl" controls></audio>
            </div>
            
            <div class="msg-actions" v-if="msg.role === 'assistant'">
              <button class="action-btn" @click="speakText(msg.content)" title="朗讀">🔊</button>
              <button class="action-btn" @click="analyzeMessage(msg.content)" title="分析句子">🧐</button>
            </div>
            <div class="msg-actions" v-else>
              <button class="action-btn" @click="speakText(msg.content)" title="朗讀">🔊</button>
            </div>
          </div>
          <span class="time">{{ formatTime(msg.timestamp) }}</span>
        </div>
      </div>
      <div v-if="isLoading" class="message assistant loading">
        <div class="avatar">🤖</div>
        <div class="content-wrapper">
          <div class="content">
            <div class="typing">AI 思考中<span>.</span><span>.</span><span>.</span></div>
          </div>
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

    <!-- Analysis Modal -->
    <div v-if="showAnalysisModal" class="modal-overlay" @click.self="showAnalysisModal = false">
      <div class="modal-content glass-card animate-scale-up">
        <div class="modal-header">
          <h4>🧐 句子分析 / Sentence Analysis</h4>
          <button class="close-btn" @click="showAnalysisModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div v-if="isAnalyzing" class="loading-analysis">
            <div class="mini-spinner"></div>
            <p>AI 正在進行深度語法及詞彙分析...</p>
          </div>
          <div v-else-if="activeExplanation">
            <div class="section">
              <h5>英文翻譯 / English Translation</h5>
              <p class="trans-text">{{ activeExplanation.translation }}</p>
            </div>
            <div class="section">
              <h5>拼音指南 / Pronunciation (Jyutping / Pinyin)</h5>
              <p class="pron-text">{{ activeExplanation.pronunciation }}</p>
            </div>
            <div class="section" v-if="activeExplanation.vocabulary && activeExplanation.vocabulary.length > 0">
              <h5>重點詞彙拆解 / Vocabulary</h5>
              <div class="table-wrapper">
                <table class="vocab-table">
                  <thead>
                    <tr>
                      <th>詞彙 / Word</th>
                      <th>拼音 / Pinyin</th>
                      <th>解釋 / Meaning</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(v, i) in activeExplanation.vocabulary" :key="i">
                      <td class="word">{{ v.word }}</td>
                      <td class="pinyin">{{ v.pinyin }}</td>
                      <td class="meaning">{{ v.meaning }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useChatMessages } from '../composables/useChatMessages.js'
import { useSpeechRecognition } from '../composables/useSpeechRecognition.js'
import { getApiUrl } from '../utils/api.js'
import { speakText as speakTextUtil } from '../utils/speech.js'

const props = defineProps(['language'])

const {
  messages, isLoading, messagesContainer,
  loadHistory, saveHistory, clearChat: clearChatBase, addMessage,
  scrollToBottom, createAbortController, cancelRequests, generateId
} = useChatMessages(props.language)

const inputMessage = ref('')
const isOnline = ref(false)
const autoTTS = ref(false)
const currentEngine = ref('')
const onlineCheckInterval = ref(null)

// Analysis Modal state
const showAnalysisModal = ref(false)
const isAnalyzing = ref(false)
const activeExplanation = ref(null)

const { isRecording, toggle: toggleSpeech } = useSpeechRecognition()

const placeholderText = computed(() => {
  const hints = {
    cantonese: '輸入廣東話... 或按住 🎤 說話',
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
      ? '你好！我係你嘅 AI 廣東話導師。我哋可以一齊隨意傾偈。你想傾啲咩？'
      : '你好！我是你的 AI 普通话导师。我们可以一起随意聊聊。你想聊什么？'
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
      ? '你好！我係你嘅 AI 廣東話導師。我哋可以一齊隨意傾偈。你想傾啲咩？'
      : '你好！我是你的 AI 普通话导师。我们可以一起随意聊聊。你想聊什么？'
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
    ? '對話已清空。有咩想傾？'
    : '对话已清空。有什么想聊？'
  clearChatBase(welcome)
}

async function checkOnline() {
  try {
    const res = await fetch(getApiUrl('api/health'))
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
  
  // Load AI Settings
  const savedSettings = localStorage.getItem('ai-instructor-settings')
  const settings = savedSettings ? JSON.parse(savedSettings) : { activeEngine: 'demo', geminiApiKey: '', opencodeApiKey: '', modelName: 'opencode-go/minimax-m2.7' }

  try {
    const response = await fetch(getApiUrl('api/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        language: props.language,
        messages: messages.value.slice(-10).map(m => ({
          role: m.role,
          content: m.content
        })),
        activeEngine: settings.activeEngine,
        geminiApiKey: settings.geminiApiKey,
        opencodeApiKey: settings.opencodeApiKey,
        model: settings.modelName || 'opencode-go/minimax-m2.7'
      })
    })
    
    if (response.ok) {
      const data = await response.json()
      
      // Update engine label
      const engineLabels = {
        'ollama': 'Ollama',
        'llm-studio': 'LM Studio',
        'opencode': 'OpenCode Go',
        'gemini': 'Gemini AI',
        'gemini-fallback': 'Gemini AI',
        'demo-mock': '離線模擬'
      }
      currentEngine.value = engineLabels[data.endpoint] || ''

      const assistantMsg = {
        role: 'assistant',
        content: data.content,
        timestamp: Date.now()
      }
      
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
        ? '抱歉，暫時無法連線至 AI 服務。請喺「設定」中檢查您嘅連線組態。'
        : '抱歉，暂时无法连线至 AI 服务。请在「设置」中检查您的连线配置。',
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

async function analyzeMessage(text) {
  isAnalyzing.value = true
  activeExplanation.value = null
  showAnalysisModal.value = true

  // Load AI Settings
  const savedSettings = localStorage.getItem('ai-instructor-settings')
  const settings = savedSettings ? JSON.parse(savedSettings) : { activeEngine: 'demo', geminiApiKey: '', opencodeApiKey: '' }

  try {
    const res = await fetch(getApiUrl('api/explain'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        language: props.language,
        activeEngine: settings.activeEngine,
        geminiApiKey: settings.geminiApiKey,
        opencodeApiKey: settings.opencodeApiKey
      })
    })

    if (res.ok) {
      const data = await res.json()
      activeExplanation.value = data.explanation
    } else {
      throw new Error('Analysis failed')
    }
  } catch (e) {
    console.error(e)
    activeExplanation.value = {
      translation: props.language === 'cantonese' ? '分析失敗，請檢查設定。' : '分析失败，请检查设置。',
      pronunciation: 'N/A',
      vocabulary: []
    }
  } finally {
    isAnalyzing.value = false
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
  speakTextUtil(text, props.language)
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
</script>

<style scoped>
.chat-interface {
  background: rgba(20, 21, 33, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  backdrop-filter: blur(12px);
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
}

.model-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 0.8rem;
  color: #94a3b8;
}

.status-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f87171;
  box-shadow: 0 0 8px rgba(248, 113, 113, 0.5);
}

.status-dot.online {
  background: #34d399;
  box-shadow: 0 0 8px rgba(52, 211, 153, 0.5);
}

.engine-tag {
  background: rgba(168, 85, 247, 0.15);
  color: #c084fc;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.7rem;
  border: 1px solid rgba(168, 85, 247, 0.25);
}

.clear-btn {
  padding: 0.3rem 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: #e2e8f0;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.2s;
}

.clear-btn:hover {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
  border-color: rgba(239, 68, 68, 0.25);
}

.messages {
  height: 420px;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  scroll-behavior: smooth;
}

/* Custom Scrollbar */
.messages::-webkit-scrollbar {
  width: 6px;
}
.messages::-webkit-scrollbar-track {
  background: transparent;
}
.messages::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}
.messages::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

.message {
  display: flex;
  gap: 0.75rem;
  max-width: 85%;
  animation: messageFadeIn 0.3s ease-out;
}

@keyframes messageFadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.message.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message.assistant {
  align-self: flex-start;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 1.1rem;
  flex-shrink: 0;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
}

.message.user .avatar {
  background: rgba(99, 102, 241, 0.2);
  border-color: rgba(99, 102, 241, 0.3);
}

.content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.message.user .content-wrapper {
  align-items: flex-end;
}

.content {
  padding: 0.85rem 1.1rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 0.95rem;
  color: #f1f5f9;
  position: relative;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.message.user .content {
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  border: none;
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.25);
}

.msg-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding-top: 0.4rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.action-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.95rem;
  opacity: 0.5;
  transition: opacity 0.2s, transform 0.1s;
  padding: 0.15rem 0.3rem;
}

.action-btn:hover {
  opacity: 1;
  transform: scale(1.1);
}

.time {
  font-size: 0.7rem;
  color: #64748b;
}

.typing span {
  animation: blink 1.4s infinite;
  font-weight: bold;
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
  padding: 1.25rem;
  background: rgba(255, 255, 255, 0.01);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.mic-btn, .send-btn, .tts-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #f1f5f9;
  cursor: pointer;
  font-size: 1.15rem;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.mic-btn:hover, .tts-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: scale(1.05);
}

.mic-btn.recording {
  background: #ef4444;
  color: white;
  border-color: #f87171;
  animation: pulse 1.2s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  50% { transform: scale(1.08); box-shadow: 0 0 10px 4px rgba(239, 68, 68, 0.2); }
}

.send-btn {
  background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%);
  border: none;
  box-shadow: 0 4px 12px rgba(168, 85, 247, 0.2);
}

.send-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 4px 15px rgba(168, 85, 247, 0.4);
}

.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

.tts-btn.active {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
  border-color: rgba(16, 185, 129, 0.4);
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.15);
}

input {
  flex: 1;
  padding: 0.75rem 1.25rem;
  background: rgba(10, 11, 18, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 24px;
  color: #f1f5f9;
  font-size: 0.95rem;
  outline: none;
  transition: all 0.2s;
}

input:focus {
  border-color: #a855f7;
  box-shadow: 0 0 10px rgba(168, 85, 247, 0.15);
}

input:disabled {
  background: rgba(255, 255, 255, 0.01);
  color: #64748b;
}

/* Modal Overlay Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.modal-content {
  background: rgba(20, 21, 33, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  width: 100%;
  max-width: 580px;
  backdrop-filter: blur(20px);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
  overflow: hidden;
}

.animate-scale-up {
  animation: scaleUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes scaleUp {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.modal-header h4 {
  font-family: 'Outfit', sans-serif;
  color: #c084fc;
  font-weight: 700;
}

.close-btn {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 1.25rem;
  cursor: pointer;
  transition: color 0.2s;
}

.close-btn:hover {
  color: white;
}

.modal-body {
  padding: 1.5rem;
  max-height: 400px;
  overflow-y: auto;
}

.loading-analysis {
  text-align: center;
  padding: 3rem 1rem;
  color: #94a3b8;
}

.mini-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255,255,255,0.05);
  border-top-color: #a855f7;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.section {
  margin-bottom: 1.5rem;
}

.section h5 {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #a855f7;
  margin-bottom: 0.5rem;
  font-weight: 700;
}

.trans-text {
  font-size: 1.05rem;
  color: #f1f5f9;
  background: rgba(255,255,255,0.02);
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border-left: 3px solid #6366f1;
}

.pron-text {
  font-family: 'SFMono-Regular', Consolas, Menlo, monospace;
  font-size: 1.05rem;
  color: #38bdf8;
  background: rgba(255,255,255,0.02);
  padding: 0.75rem 1rem;
  border-radius: 8px;
}

.table-wrapper {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.05);
}

.vocab-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.9rem;
}

.vocab-table th, .vocab-table td {
  padding: 0.75rem 1rem;
  background: rgba(10, 11, 18, 0.4);
}

.vocab-table th {
  color: #94a3b8;
  font-weight: 600;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}

.vocab-table td {
  border-bottom: 1px solid rgba(255,255,255,0.04);
}

.vocab-table tr:last-child td {
  border-bottom: none;
}

.vocab-table .word {
  font-size: 1rem;
  font-weight: 700;
  color: #ffffff;
}

.vocab-table .pinyin {
  color: #38bdf8;
}

.vocab-table .meaning {
  color: #cbd5e1;
}
</style>
