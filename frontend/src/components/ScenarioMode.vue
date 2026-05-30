<template>
  <div class="scenario-mode">
    <h3>🎭 場景練習 / Scenarios</h3>
    <p class="desc">選擇一個生活實用場景，同 AI 進行角色扮演對話練習。</p>
    
    <div v-if="isScenariosLoading" class="loading-state">
      <div class="spinner"></div>
      <p>載入場景中...</p>
    </div>
    
    <div v-else-if="!activeScenario" class="scenarios-grid">
      <div 
        v-for="scenario in scenarios" 
        :key="scenario.id"
        class="scenario-card animate-fade-in"
        @click="startScenario(scenario)"
      >
        <span class="icon">{{ scenario.icon || '📍' }}</span>
        <h4>{{ scenario.name }}</h4>
        <p>{{ scenario.description }}</p>
      </div>
    </div>
    
    <div v-else class="scenario-chat">
      <div class="scenario-header">
        <button class="back-btn" @click="activeScenario = null">⬅️ 返回列表</button>
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
          <div class="content-wrapper">
            <div class="content">
              <p>{{ msg.content }}</p>
              
              <div class="msg-actions">
                <button class="action-btn" @click="speakText(msg.content)" title="朗讀">🔊</button>
                <button class="action-btn" @click="analyzeMessage(msg.content)" title="分析句子">🧐</button>
              </div>
            </div>
            <span class="time">{{ formatTime(msg.timestamp) }}</span>
          </div>
        </div>
        <div v-if="isLoading" class="message assistant loading">
          <div class="avatar">🎭</div>
          <div class="content-wrapper">
            <div class="content">
              <div class="typing">AI 回覆中<span>.</span><span>.</span><span>.</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Suggested Responses Pills -->
      <div class="suggestions-bar" v-if="currentSuggestions.length > 0">
        <span class="label">💡 唔知講咩？試下點擊：</span>
        <div class="pills-wrapper">
          <button 
            v-for="(s, i) in currentSuggestions" 
            :key="i"
            class="suggestion-pill"
            @click="useSuggestion(s)"
          >
            {{ s }}
          </button>
        </div>
      </div>
      
      <div class="input-area">
        <button 
          class="mic-btn"
          :class="{ recording: isRecording }"
          @click="toggleRecording"
          title="語音輸入"
        >
          🎤
        </button>
        <input 
          v-model="inputMessage"
          type="text"
          :placeholder="language === 'cantonese' ? '用廣東話回答...' : '用普通话回答...'"
          @keyup.enter="sendMessage"
          :disabled="isLoading"
        />
        <button class="send-btn" @click="sendMessage" :disabled="!inputMessage.trim() || isLoading">
          📤
        </button>
      </div>
      
      <div class="hints">
        <p>💡 任務提示：{{ hintText }}</p>
      </div>
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
            <p>AI 正在分析中...</p>
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
import { ref, computed, nextTick, watch, onUnmounted } from 'vue'
import { useSpeechRecognition } from '../composables/useSpeechRecognition.js'
import { getApiUrl } from '../utils/api.js'
import { speakText as speakTextUtil } from '../utils/speech.js'

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

// Analysis Modal state
const showAnalysisModal = ref(false)
const isAnalyzing = ref(false)
const activeExplanation = ref(null)

const { isRecording, toggle: toggleSpeech } = useSpeechRecognition()

const hintText = computed(() => {
  const hints = {
    restaurant: '試下點餐、問價錢、提出少甜/走冰等要求',
    shopping: '問價錢、講數量、講價或者要個袋',
    taxi: '話畀司機聽目的地、問大概幾多錢、找錢唔該',
    hospital: '同醫生描述你有咩症狀（頭痛/感冒）、問下要食咩藥',
    friends: '同朋友約下星期飲茶、傾下最近忙啲咩',
    hotel: '辦理 check-in 入住、詢問可唔可以遲退房或早餐時間',
    interview: '做個簡單自我介紹、講下自己有咩優勢'
  }
  return hints[activeScenario.value?.id] || '自由發揮，盡量多講！'
})

// Custom Suggestions Pills for each scenario to aid learning
const scenarioSuggestions = {
  cantonese: {
    restaurant: [
      "唔該，我想點餐 (Order, please)",
      "今日有咩推介呀？ (What's recommended today?)",
      "我要一杯熱奶茶，少甜 (Hot milk tea, less sweet)",
      "唔該要一個菠蘿油 (A pineapple bun with butter, please)"
    ],
    shopping: [
      "呢個幾錢呀？ (How much is this?)",
      "平少少得唔得？ (Can it be cheaper?)",
      "我要兩斤菜心 (I want two catties of Choy Sum)",
      "有冇袋提供？ (Is there a bag available?)"
    ],
    taxi: [
      "唔該去尖沙咀 (To Tsim Sha Tsui, please)",
      "大概要幾多錢？ (About how much will it be?)",
      "呢度落車，唔該找錢 (Drop off here, change please)"
    ],
    hospital: [
      "我頭痛同埋有啲發燒 (I have headache and fever)",
      "呢隻藥要點樣食？ (How should I take this medicine?)",
      "洗唔洗覆診？ (Do I need a follow-up visit?)"
    ],
    friends: [
      "下星期六下晝得唔得？ (Is next Sat afternoon OK?)",
      "好耐無見，近排點呀？ (Long time no see, how are you?)",
      "我哋去旺角飲茶啦 (Let's go to Mong Kok for Dim Sum)"
    ]
  },
  mandarin: {
    restaurant: [
      "服务员，我想点菜 (Waiter, I want to order)",
      "有什么特色推荐吗？ (Any special recommendations?)",
      "我要一杯冰红茶，去冰 (Ice black tea, no ice)",
      "请问洗手间在哪里？ (Where is the restroom?)"
    ],
    shopping: [
      "这个多少钱？ (How much is this?)",
      "能便宜一点吗？ (Can it be cheaper?)",
      "我想买些新鲜水果 (I want to buy some fresh fruit)"
    ],
    taxi: [
      "您好，去火车站 (Hello, to the train station)",
      "请问走高速快吗？ (Is the highway faster?)",
      "在这儿停就可以了 (Stopping here is fine)"
    ],
    hotel: [
      "你好，我要办理入住 (Hello, I want to check in)",
      "请问有免费早餐吗？ (Is there free breakfast?)",
      "能延迟到一点退房吗？ (Can check-out be delayed?)"
    ],
    interview: [
      "您好，我是来面试的 (Hello, I'm here for the interview)",
      "这是我的个人简历 (Here is my resume)",
      "我对贵公司的发展很看好 (I'm optimistic about your company)"
    ]
  }
}

const currentSuggestions = computed(() => {
  if (!activeScenario.value) return []
  return scenarioSuggestions[props.language]?.[activeScenario.value.id] || []
})

function useSuggestion(text) {
  // Strip English descriptions in brackets
  const cleanText = text.split(' (')[0]
  inputMessage.value = cleanText
}

// Load scenarios
async function loadScenarios() {
  isScenariosLoading.value = true
  const controller = new AbortController()
  try {
    const res = await fetch(getApiUrl(`api/scenarios?language=${props.language}`), {
      signal: controller.signal
    })
    if (res.ok) {
      const data = await res.json()
      scenarios.value = data.scenarios
    } else {
      throw new Error(`Server returned status ${res.status}`)
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      console.warn('Scenarios load aborted')
      return
    }
    console.error('Failed to load scenarios:', e)
    // Fallback static list
    scenarios.value = props.language === 'cantonese' ? [
      { id: 'restaurant', name: '🍜 茶餐廳點餐', description: '練習喺茶餐廳點餐、問價錢', icon: '🍜' },
      { id: 'shopping', name: '🛍️ 街市買餸', description: '去街市買餸、講價', icon: '🛍' },
      { id: 'taxi', name: '🚕 搭的士', description: '截的士、講目的地', icon: '🚕' },
      { id: 'hospital', name: '🏥 睇醫生', description: '描述病徵、約時間', icon: '🏥' },
      { id: 'friends', name: '☕ 同朋友傾偈', description: '閒聊、約食飯', icon: '☕' }
    ] : [
      { id: 'restaurant', name: '🍜 餐厅点餐', description: '练习在餐厅点餐、询问价格', icon: '🍜' },
      { id: 'shopping', name: '🛍️ 超市购物', description: '超市购物、询价', icon: '🛍' },
      { id: 'taxi', name: '🚕 打出租车', description: '叫出租车、说目的地', icon: '🚕' },
      { id: 'hotel', name: '🏨 酒店入住', description: '办理入住、询问服务', icon: '🏨' },
      { id: 'interview', name: '💼 工作面试', description: '自我介绍、回答问题', icon: '💼' }
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
  
  // Load Settings
  const savedSettings = localStorage.getItem('ai-instructor-settings')
  const settings = savedSettings ? JSON.parse(savedSettings) : { activeEngine: 'demo', geminiApiKey: '', opencodeApiKey: '', modelName: 'minimax-m2.7' }

  try {
    const res = await fetch(getApiUrl('api/scenario-start'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abortController.value.signal,
      body: JSON.stringify({
        scenarioId: scenario.id,
        language: props.language,
        activeEngine: settings.activeEngine,
        geminiApiKey: settings.geminiApiKey,
        opencodeApiKey: settings.opencodeApiKey,
        model: settings.modelName || 'minimax-m2.7'
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
  
  // Load Settings
  const savedSettings = localStorage.getItem('ai-instructor-settings')
  const settings = savedSettings ? JSON.parse(savedSettings) : { activeEngine: 'demo', geminiApiKey: '', opencodeApiKey: '', modelName: 'minimax-m2.7' }

  try {
    const res = await fetch(getApiUrl('api/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abortController.value.signal,
      body: JSON.stringify({
        language: props.language,
        messages: scenarioMessages.value.slice(-8).map(m => ({
          role: m.role,
          content: m.content
        })),
        activeEngine: settings.activeEngine,
        geminiApiKey: settings.geminiApiKey,
        opencodeApiKey: settings.opencodeApiKey,
        scenarioId: activeScenario.value.id,
        model: settings.modelName || 'minimax-m2.7'
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

async function analyzeMessage(text) {
  isAnalyzing.value = true
  activeExplanation.value = null
  showAnalysisModal.value = true

  const savedSettings = localStorage.getItem('ai-instructor-settings')
  const settings = savedSettings ? JSON.parse(savedSettings) : { activeEngine: 'demo', geminiApiKey: '', opencodeApiKey: '', modelName: 'minimax-m2.7' }

  try {
    const res = await fetch(getApiUrl('api/explain'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        language: props.language,
        activeEngine: settings.activeEngine,
        geminiApiKey: settings.geminiApiKey,
        opencodeApiKey: settings.opencodeApiKey,
        model: settings.modelName || 'minimax-m2.7'
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
  background: rgba(15, 16, 26, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 1.5rem;
  backdrop-filter: blur(16px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

h3 {
  color: #7dd3fc;
  font-size: 1.35rem;
  margin-bottom: 0.2rem;
}

.desc {
  color: #64748b;
  font-size: 0.85rem;
  margin-bottom: 1.25rem;
}

.loading-state {
  text-align: center;
  padding: 2.5rem;
  color: #64748b;
}

.spinner {
  width: 36px;
  height: 36px;
  border: 2.5px solid rgba(255,255,255,0.04);
  border-top-color: #38bdf8;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 0.875rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Scenarios Grid */
.scenarios-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
}

.scenario-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 1.25rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.scenario-card:hover {
  border-color: rgba(56, 189, 248, 0.3);
  background: rgba(56, 189, 248, 0.06);
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(56, 189, 248, 0.1);
}

.scenario-card:active {
  transform: translateY(0) scale(0.97);
}

.scenario-card .icon {
  font-size: 2rem;
  display: block;
  margin-bottom: 0.4rem;
}

.scenario-card h4 {
  color: #e2e8f0;
  font-weight: 700;
  margin-bottom: 0.35rem;
  font-size: 0.95rem;
}

.scenario-card p {
  font-size: 0.775rem;
  color: #64748b;
  line-height: 1.4;
}

/* Scenario Chat */
.scenario-header {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  margin-bottom: 1rem;
  padding-bottom: 0.65rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.back-btn {
  padding: 0.35rem 0.7rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
  transition: all 0.2s;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #e2e8f0;
}

.back-btn:active {
  transform: scale(0.95);
}

.scenario-header h4 {
  color: #e2e8f0;
  font-size: 1rem;
  font-weight: 700;
}

.badge {
  margin-left: auto;
  padding: 0.175rem 0.45rem;
  background: rgba(56, 189, 248, 0.1);
  color: #7dd3fc;
  border: 1px solid rgba(56, 189, 248, 0.2);
  border-radius: 4px;
  font-size: 0.675rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.messages {
  height: 350px;
  overflow-y: auto;
  padding: 0.375rem;
  margin-bottom: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.messages::-webkit-scrollbar {
  width: 5px;
}
.messages::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
}

.message {
  display: flex;
  gap: 0.65rem;
  max-width: 85%;
}

.message.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message.assistant {
  align-self: flex-start;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 1rem;
  flex-shrink: 0;
}

.message.user .avatar {
  background: rgba(56, 189, 248, 0.12);
  border-color: rgba(56, 189, 248, 0.2);
}

.content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.message.user .content-wrapper {
  align-items: flex-end;
}

.content {
  padding: 0.75rem 1rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.04);
  font-size: 0.9rem;
  color: #e2e8f0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.message.user .content {
  background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%);
  border: none;
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.2);
}

.msg-actions {
  display: flex;
  gap: 0.35rem;
  margin-top: 0.4rem;
  padding-top: 0.35rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.action-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  opacity: 0.4;
  transition: opacity 0.2s, transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
  padding: 0.1rem 0.25rem;
}

.action-btn:hover {
  opacity: 1;
  transform: scale(1.15);
}

.action-btn:active {
  transform: scale(0.95);
}

.time {
  font-size: 0.65rem;
  color: #475569;
}

.typing span {
  animation: blink 1.4s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 0; }
  50% { opacity: 1; }
}

/* Suggestions Bar */
.suggestions-bar {
  background: rgba(255, 255, 255, 0.015);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  padding: 0.65rem 0.875rem;
  margin-bottom: 0.875rem;
}

.suggestions-bar .label {
  display: block;
  font-size: 0.7rem;
  color: #64748b;
  margin-bottom: 0.35rem;
  font-weight: 600;
}

.pills-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.suggestion-pill {
  padding: 0.3rem 0.65rem;
  background: rgba(56, 189, 248, 0.08);
  border: 1px solid rgba(56, 189, 248, 0.15);
  border-radius: 16px;
  color: #94a3b8;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.suggestion-pill:hover {
  background: rgba(56, 189, 248, 0.15);
  color: #e2e8f0;
  border-color: rgba(56, 189, 248, 0.3);
}

.suggestion-pill:active {
  transform: scale(0.95);
}

/* Input Area */
.input-area {
  display: flex;
  gap: 0.5rem;
  padding-top: 0.65rem;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.mic-btn, .send-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: #cbd5e1;
  cursor: pointer;
  font-size: 1.05rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.mic-btn:hover {
  background: rgba(255, 255, 255, 0.08);
}

.mic-btn:active {
  transform: scale(0.95);
}

.mic-btn.recording {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.35);
  color: #f87171;
}

.send-btn {
  background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%);
  border: none;
}

.send-btn:hover:not(:disabled) {
  box-shadow: 0 4px 10px rgba(14, 165, 233, 0.25);
}

.send-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.send-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

input {
  flex: 1;
  padding: 0.6rem 1.15rem;
  background: rgba(10, 11, 18, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  color: #e2e8f0;
  font-size: 0.875rem;
  font-family: inherit;
  outline: none;
  transition: all 0.2s;
}

input:focus {
  border-color: rgba(56, 189, 248, 0.4);
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.06);
}

input::placeholder {
  color: #475569;
}

.hints {
  margin-top: 0.65rem;
  padding: 0.55rem 0.875rem;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border-radius: 8px;
  font-size: 0.75rem;
}

/* Modal overlay & Content (shared) */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.modal-content {
  background: rgba(15, 16, 26, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  width: 100%;
  max-width: 560px;
  backdrop-filter: blur(24px);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  overflow: hidden;
}

.animate-scale-up {
  animation: scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes scaleUp {
  from { transform: scale(0.92); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.modal-header h4 {
  font-family: 'Outfit', sans-serif;
  color: #7dd3fc;
  font-weight: 700;
  font-size: 1rem;
}

.close-btn {
  background: none;
  border: none;
  color: #64748b;
  font-size: 1.2rem;
  cursor: pointer;
  transition: color 0.2s;
  padding: 0.25rem;
}

.close-btn:hover {
  color: #e2e8f0;
}

.close-btn:active {
  transform: scale(0.9);
}

.modal-body {
  padding: 1.25rem;
  max-height: 420px;
  overflow-y: auto;
}

.loading-analysis {
  text-align: center;
  padding: 2.5rem 1rem;
  color: #64748b;
}

.mini-spinner {
  width: 28px;
  height: 28px;
  border: 2.5px solid rgba(255,255,255,0.04);
  border-top-color: #38bdf8;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 0.875rem;
}

.section {
  margin-bottom: 1.25rem;
}

.section h5 {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #38bdf8;
  margin-bottom: 0.5rem;
  font-weight: 700;
}

.trans-text {
  font-size: 0.95rem;
  color: #e2e8f0;
  background: rgba(255,255,255,0.02);
  padding: 0.65rem 0.875rem;
  border-radius: 8px;
  border-left: 3px solid #6366f1;
}

.pron-text {
  font-family: 'SFMono-Regular', Consolas, Menlo, monospace;
  font-size: 0.95rem;
  color: #38bdf8;
  background: rgba(255,255,255,0.02);
  padding: 0.65rem 0.875rem;
  border-radius: 8px;
}

.table-wrapper {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.04);
}

.vocab-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.85rem;
}

.vocab-table th, .vocab-table td {
  padding: 0.65rem 0.875rem;
  background: rgba(10, 11, 18, 0.4);
}

.vocab-table th {
  color: #64748b;
  font-weight: 600;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.vocab-table td {
  border-bottom: 1px solid rgba(255,255,255,0.03);
}

.vocab-table tr:last-child td {
  border-bottom: none;
}

.vocab-table .word {
  font-size: 0.95rem;
  font-weight: 700;
  color: #e2e8f0;
}

.vocab-table .pinyin {
  color: #38bdf8;
}

.vocab-table .meaning {
  color: #94a3b8;
}

.animate-fade-in {
  animation: fadeIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
