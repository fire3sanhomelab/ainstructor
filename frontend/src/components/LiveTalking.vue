<template>
  <div class="live-talking">
    <div class="live-card glass-card">
      <div class="live-header">
        <span class="live-badge" :class="{ active: isCallActive }">
          {{ isCallActive ? '🔴 LIVE CALL' : '💤 IDLE' }}
        </span>
        <h3>即時語音通話 / Voice Call</h3>
        <p class="desc">同 AI 進行全語音無縫對話，好似打電話一樣。</p>
      </div>

      <div class="call-interface">
        <!-- Circular Pulsing Orb / Visualizer -->
        <div class="visualizer-container" @click="toggleCall">
          <div class="pulse-ring bg-ring" :class="[liveState, { active: isCallActive }]"></div>
          <div class="pulse-ring mid-ring" :class="[liveState, { active: isCallActive }]"></div>
          <div class="pulse-ring front-ring" :class="[liveState, { active: isCallActive }]"></div>
          
          <button class="call-btn" :class="[liveState, { active: isCallActive }]">
            <span class="emoji" v-if="!isCallActive">📞</span>
            <span class="emoji" v-else-if="liveState === 'listening'">🎙️</span>
            <span class="emoji" v-else-if="liveState === 'thinking'">⚡</span>
            <span class="emoji" v-else-if="liveState === 'speaking'">🔊</span>
          </button>
        </div>

        <!-- Call Status -->
        <div class="call-status">
          <h4 class="state-title">{{ stateTitle }}</h4>
          <p class="state-subtitle">{{ stateSubtitle }}</p>
        </div>

        <!-- Recent Transcripts Subtitles -->
        <div class="subtitles-box" v-if="recentExchange.length > 0">
          <div 
            v-for="msg in recentExchange" 
            :key="msg.id" 
            :class="['subtitle-line', msg.role]"
          >
            <span class="avatar-icon">{{ msg.role === 'user' ? '👤' : '🤖' }}</span>
            <span class="text">{{ msg.content }}</span>
          </div>
        </div>
      </div>

      <!-- Controls Footer -->
      <div class="controls-panel">
        <div class="control-row">
          <label>朗讀速度 / Speed</label>
          <div class="speed-toggle">
            <button 
              :class="{ active: rate === 0.55 }" 
              @click="rate = 0.55"
            >
              🐢 慢速
            </button>
            <button 
              :class="{ active: rate === 0.85 }" 
              @click="rate = 0.85"
            >
              ⚡ 標準
            </button>
          </div>
        </div>

        <button 
          class="action-call-btn" 
          :class="{ active: isCallActive }" 
          @click="toggleCall"
        >
          {{ isCallActive ? '🔴 掛斷 / End Call' : '📞 開始通話 / Start Call' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted, watch } from 'vue'
import { useSpeechRecognition } from '../composables/useSpeechRecognition.js'
import { getApiUrl } from '../utils/api.js'
import { speakText } from '../utils/speech.js'

const props = defineProps(['language'])

const isCallActive = ref(false)
const liveState = ref('idle') // 'listening', 'thinking', 'speaking', 'idle'
const rate = ref(0.85) // 0.85 standard, 0.55 slow
const messages = ref([])

const { isRecording, toggle: toggleSpeech, stop: stopSpeech } = useSpeechRecognition()

const recentExchange = computed(() => {
  return messages.value.slice(-3)
})

const stateTitle = computed(() => {
  if (!isCallActive.value) return props.language === 'cantonese' ? '已掛斷' : '已挂断'
  const titles = {
    listening: props.language === 'cantonese' ? '請講話... 聽緊你說話' : '请说话... 正在听你说话',
    thinking: props.language === 'cantonese' ? '導師思考中...' : '导师思考中...',
    speaking: props.language === 'cantonese' ? '導師回應中...' : '导师回应中...',
    idle: '連接中...'
  }
  return titles[liveState.value] || '請講話...'
})

const stateSubtitle = computed(() => {
  if (!isCallActive.value) return props.language === 'cantonese' ? '點擊按鈕開始即時通話' : '点击按钮开始即时通话'
  const subs = {
    listening: props.language === 'cantonese' ? '講完稍停即可，系統會自動發送' : '说完稍停即可，系统会自动发送',
    thinking: 'Sending voice message to AI...',
    speaking: 'Playing voice response',
    idle: ''
  }
  return subs[liveState.value] || ''
})

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function toggleCall() {
  if (isCallActive.value) {
    endCall()
  } else {
    startCall()
  }
}

function startCall() {
  isCallActive.value = true
  messages.value = []
  
  // Welcome message
  const welcome = props.language === 'cantonese'
    ? '你好！即時語音通話已連接。今日想同我傾啲咩呀？'
    : '你好！即时语音通话已连接。今天想和我聊点什么呢？'
    
  messages.value.push({
    id: generateId(),
    role: 'assistant',
    content: welcome
  })

  liveState.value = 'speaking'
  speakText(welcome, props.language, rate.value, () => {
    if (isCallActive.value) {
      startListening()
    }
  })
}

function endCall() {
  isCallActive.value = false
  liveState.value = 'idle'
  stopSpeech()
  window.speechSynthesis.cancel()
}

function startListening() {
  if (!isCallActive.value) return
  liveState.value = 'listening'
  
  toggleSpeech({
    lang: props.language === 'cantonese' ? 'zh-HK' : 'zh-CN',
    onResult: (transcript) => {
      if (!isCallActive.value) return
      handleUserSpeech(transcript)
    },
    onError: (err) => {
      console.warn('Live Speech Call Error:', err)
      if (isCallActive.value) {
        setTimeout(startListening, 1000)
      }
    }
  })
}

async function handleUserSpeech(text) {
  if (!text || !text.trim()) {
    startListening()
    return
  }
  
  messages.value.push({
    id: generateId(),
    role: 'user',
    content: text
  })
  
  liveState.value = 'thinking'
  
  const savedSettings = localStorage.getItem('ai-instructor-settings')
  const settings = savedSettings ? JSON.parse(savedSettings) : { activeEngine: 'demo', geminiApiKey: '', opencodeApiKey: '', modelName: 'minimax-m2.7' }

  try {
    const response = await fetch(getApiUrl('api/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: props.language,
        messages: messages.value.slice(-8).map(m => ({
          role: m.role,
          content: m.content
        })),
        activeEngine: settings.activeEngine,
        geminiApiKey: settings.geminiApiKey,
        opencodeApiKey: settings.opencodeApiKey,
        model: settings.modelName || 'minimax-m2.7'
      })
    })

    if (response.ok && isCallActive.value) {
      const data = await response.json()
      
      messages.value.push({
        id: generateId(),
        role: 'assistant',
        content: data.content
      })
      
      liveState.value = 'speaking'
      speakText(data.content, props.language, rate.value, () => {
        if (isCallActive.value) {
          startListening()
        }
      })
    } else {
      throw new Error('Call API error')
    }
  } catch (err) {
    console.error(err)
    if (isCallActive.value) {
      setTimeout(startListening, 1500)
    }
  }
}

onUnmounted(() => {
  endCall()
})

watch(() => props.language, () => {
  if (isCallActive.value) {
    endCall()
  }
})
</script>

<style scoped>
.live-talking {
  background: rgba(15, 16, 26, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 1.5rem;
  backdrop-filter: blur(16px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.04);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.live-card {
  width: 100%;
  max-width: 480px;
  background: rgba(255, 255, 255, 0.015);
  border: none;
  border-radius: 12px;
  padding: 0.75rem 0.25rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.75rem;
}

.live-header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
}

.live-badge {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #64748b;
  padding: 0.2rem 0.65rem;
  border-radius: 10px;
  font-size: 0.675rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  transition: all 0.3s;
}

.live-badge.active {
  background: rgba(239, 68, 68, 0.12);
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.25);
  animation: pulse-border 1.5s infinite;
}

@keyframes pulse-border {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
}

h3 {
  color: #7dd3fc;
  font-size: 1.35rem;
  font-weight: 700;
}

.desc {
  color: #64748b;
  font-size: 0.85rem;
}

.call-interface {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
}

.visualizer-container {
  position: relative;
  width: 160px;
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.call-btn {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  cursor: pointer;
  outline: none;
}

.call-btn:active {
  transform: scale(0.94);
}

.call-btn.active {
  background: rgba(255, 255, 255, 0.04);
}

.call-btn.listening {
  border-color: rgba(56, 189, 248, 0.5);
  box-shadow: 0 0 22px rgba(56, 189, 248, 0.3);
}

.call-btn.thinking {
  border-color: rgba(245, 158, 11, 0.5);
  box-shadow: 0 0 22px rgba(245, 158, 11, 0.3);
}

.call-btn.speaking {
  border-color: rgba(16, 185, 129, 0.5);
  box-shadow: 0 0 22px rgba(16, 185, 129, 0.3);
}

.call-btn .emoji {
  font-size: 2.2rem;
  transition: transform 0.2s;
}

.call-btn:hover {
  transform: scale(1.05);
}

.pulse-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  opacity: 0;
  transition: all 0.5s ease;
  z-index: 1;
}

.pulse-ring.active.listening {
  border: 2px solid rgba(56, 189, 248, 0.35);
  animation: pulse-out 2s infinite ease-out;
}
.pulse-ring.active.mid-ring.listening {
  border: 2px solid rgba(129, 140, 248, 0.35);
  animation: pulse-out 2s infinite ease-out 0.6s;
}
.pulse-ring.active.front-ring.listening {
  border: 2px solid rgba(56, 189, 248, 0.15);
  animation: pulse-out 2s infinite ease-out 1.2s;
}

.pulse-ring.active.thinking {
  border: 2px solid rgba(245, 158, 11, 0.4);
  animation: blob-rotate 1.5s infinite linear;
}

.pulse-ring.active.speaking {
  border: 2px solid rgba(16, 185, 129, 0.35);
  animation: pulse-out 1.8s infinite ease-out;
}
.pulse-ring.active.mid-ring.speaking {
  border: 2px solid rgba(56, 189, 248, 0.35);
  animation: pulse-out 1.8s infinite ease-out 0.6s;
}
.pulse-ring.active.front-ring.speaking {
  border: 2px solid rgba(16, 185, 129, 0.15);
  animation: pulse-out 1.8s infinite ease-out 1.2s;
}

@keyframes pulse-out {
  0% { transform: scale(0.45); opacity: 0; }
  50% { opacity: 0.5; }
  100% { transform: scale(1.45); opacity: 0; }
}

@keyframes blob-rotate {
  0% { transform: rotate(0deg) scale(0.85); opacity: 0.35; border-radius: 40% 60% 60% 40% / 40% 40% 60% 60%; }
  50% { transform: rotate(180deg) scale(1.1); opacity: 0.6; border-radius: 60% 40% 40% 60% / 60% 60% 40% 40%; }
  100% { transform: rotate(360deg) scale(0.85); opacity: 0.35; border-radius: 40% 60% 60% 40% / 40% 40% 60% 60%; }
}

.call-status {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.state-title {
  color: #e2e8f0;
  font-size: 1.15rem;
  font-weight: 700;
}

.state-subtitle {
  color: #64748b;
  font-size: 0.8rem;
}

.subtitles-box {
  width: 100%;
  background: rgba(10, 11, 18, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  padding: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  max-height: 140px;
  overflow-y: auto;
}

.subtitle-line {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  font-size: 0.85rem;
  animation: fadeIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.avatar-icon {
  font-size: 1rem;
  flex-shrink: 0;
}

.subtitle-line.user .text {
  color: #cbd5e1;
}

.subtitle-line.assistant .text {
  color: #7dd3fc;
  font-weight: 500;
}

.controls-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding-top: 0.875rem;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.control-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.control-row label {
  color: #64748b;
  font-size: 0.8rem;
  font-weight: 600;
}

.speed-toggle {
  display: flex;
  background: rgba(10, 11, 18, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  padding: 0.175rem;
}

.speed-toggle button {
  padding: 0.35rem 0.85rem;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.speed-toggle button:active {
  transform: scale(0.95);
}

.speed-toggle button.active {
  background: #0ea5e9;
  color: white;
}

.action-call-btn {
  width: 100%;
  padding: 0.75rem;
  background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%);
  border: none;
  border-radius: 10px;
  color: white;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 4px 10px rgba(14, 165, 233, 0.2);
}

.action-call-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 14px rgba(14, 165, 233, 0.35);
}

.action-call-btn:active {
  transform: translateY(0) scale(0.97);
}

.action-call-btn.active {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.25);
  box-shadow: none;
  color: #fca5a5;
}

.action-call-btn.active:hover {
  background: rgba(239, 68, 68, 0.25);
  box-shadow: none;
}
</style>
