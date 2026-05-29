<template>
  <div class="pronunciation-panel">
    <h3>🎯 發音練習 / Pronunciation</h3>
    <p class="hint">{{ hintText }}</p>
    
    <div class="practice-section">
      <div class="phrase-card">
        <p class="phrase">{{ currentPhrase.text }}</p>
        <p class="pinyin">{{ currentPhrase.pinyin }}</p>
        <div class="phrase-actions">
          <button class="play-btn" @click="playAudio">
            🔊 播放示範
          </button>
          <button class="slow-btn" @click="playAudioSlow">
            🐢 慢速播放
          </button>
        </div>
      </div>
      
      <div class="record-section">
        <button 
          class="record-btn"
          :class="{ recording: isRecording }"
          @click="toggleRecording"
        >
          <span class="record-icon">{{ isRecording ? '⏹️' : '🎙️' }}</span>
          <span>{{ isRecording ? '錄音中...' : '按住並讀出' }}</span>
        </button>
      </div>
      
      <div v-if="spokenText" class="spoken-text animate-fade-in">
        <p><strong>您講出嘅文字：</strong>{{ spokenText }}</p>
      </div>
      
      <div v-if="feedback" class="feedback animate-scale-up" :class="feedback.type">
        <div class="feedback-header">
          <div class="score-circle">
            <span class="score">{{ feedback.score }}</span>
            <span class="score-lbl">分</span>
          </div>
          <div class="feedback-meta">
            <span class="grade">{{ gradeText }}</span>
            <span class="fallback-note" v-if="feedback.fallback">（演算法模擬評分）</span>
          </div>
        </div>

        <div v-if="feedback.phonemes" class="phonemes">
          <span 
            v-for="(p, i) in feedback.phonemes" 
            :key="i"
            :class="['char-p', p.correct ? 'correct' : 'wrong']"
            :title="p.correct ? '發音正確' : '發音偏差'"
          >
            {{ p.char }}
          </span>
        </div>

        <div class="suggestions-wrapper" v-if="feedback.suggestions && feedback.suggestions.length > 0">
          <h5>💡 改善建議：</h5>
          <ul class="suggestions">
            <li v-for="(s, i) in feedback.suggestions" :key="i">{{ s }}</li>
          </ul>
        </div>
        
        <p v-if="feedback.errors && feedback.errors.length > 0" class="errors">
          <strong>⚠️ 需注意：</strong>{{ feedback.errors.join('、') }}
        </p>
      </div>
    </div>
    
    <div class="progress">
      <div class="progress-bar">
        <div class="fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
      <p class="progress-lbl">句子：{{ currentIndex + 1 }} / {{ phrases.length }}</p>
    </div>
    
    <div class="nav-buttons">
      <button @click="prevPhrase" :disabled="currentIndex === 0">⬅️ 上一句</button>
      <button @click="nextPhrase" :disabled="currentIndex === phrases.length - 1">下一句 ➡️</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useSpeechRecognition } from '../composables/useSpeechRecognition.js'
import { getApiUrl } from '../utils/api.js'
import { speakText as speakTextUtil } from '../utils/speech.js'

const props = defineProps(['language'])

const currentIndex = ref(0)
const feedback = ref(null)
const spokenText = ref('')
const abortController = ref(null)

const { isRecording, toggle: toggleSpeech } = useSpeechRecognition()

const hintText = computed(() => {
  return props.language === 'cantonese'
    ? '點擊示範收聽標準發音，然後按住錄音鍵讀出句子，AI 會分析你嘅發音。'
    : '点击示范收听标准发音，然后按住录音键读出句子，AI 会分析你的发音。'
})

const phrases = computed(() => {
  const data = {
    cantonese: [
      { text: '早晨，食咗早餐未？', pinyin: 'zou2 san4, sik6 zo2 zou2 caan1 mei6?' },
      { text: '我想去旺角買嘢。', pinyin: 'ngo5 soeng2 heoi3 wong6 gok3 maai5 je5.' },
      { text: '今日天氣好好。', pinyin: 'gam1 jat6 tin1 hei3 hou2 hou2.' },
      { text: '呢個幾錢呀？', pinyin: 'ni1 go3 gei2 cin2 aa3?' },
      { text: '多謝你幫手！', pinyin: 'do1 ze6 nei5 bong1 sau2!' },
      { text: '我唔舒服，想睇醫生。', pinyin: 'ngo5 m4 syu1 fuk6, soeng2 tai2 ji1 sang1.' },
      { text: '呢度有冇廁所？', pinyin: 'ni1 dou6 jau5 mou5 ci3 so2?' },
      { text: '我鍾意食海鮮。', pinyin: 'ngo5 zung1 ji3 sik6 hoi2 sin1.' }
    ],
    mandarin: [
      { text: '你好，请问您贵姓？', pinyin: 'nǐ hǎo, qǐng wèn nín guì xìng?' },
      { text: '我想去王府井买东西。', pinyin: 'wǒ xiǎng qù wáng fǔ jǐng mǎi dōng xi.' },
      { text: '今天天气很好。', pinyin: 'jīn tiān tiān qì hěn hǎo.' },
      { text: '这个多少钱？', pinyin: 'zhè gè duō shǎo qián?' },
      { text: '谢谢您的帮助！', pinyin: 'xiè xiè nín de bāng zhù!' },
      { text: '我不太舒服，想去看医生。', pinyin: 'wǒ bú tài shū fu, xiǎng qù kàn yī shēng.' },
      { text: '请问附近有洗手间吗？', pinyin: 'qǐng wèn fù jìn yǒu xǐ shǒu jiān ma?' },
      { text: '我喜欢吃海鲜。', pinyin: 'wǒ xǐ huan chī hǎi xiān.' }
    ]
  }
  return data[props.language] || data.cantonese
})

const currentPhrase = computed(() => phrases.value[currentIndex.value])

const progressPercent = computed(() => {
  return ((currentIndex.value + 1) / phrases.value.length) * 100
})

const gradeText = computed(() => {
  const score = feedback.value?.score || 0
  if (score >= 90) return '優秀！🌟 Perfect!'
  if (score >= 80) return '很好！👍 Well done!'
  if (score >= 60) return '不錯！💪 Good effort!'
  return '再加油！🎯 Keep trying!'
})

function playAudio() {
  speakTextUtil(currentPhrase.value.text, props.language, 0.85)
}

function playAudioSlow() {
  speakTextUtil(currentPhrase.value.text, props.language, 0.55)
}

async function toggleRecording() {
  if (isRecording.value) {
    toggleSpeech()
    return
  }
  feedback.value = null
  spokenText.value = ''
  
  toggleSpeech({
    lang: props.language === 'cantonese' ? 'zh-HK' : 'zh-CN',
    onResult: async (transcript) => {
      spokenText.value = transcript
      await evaluatePronunciation(transcript)
    },
    onError: (err) => {
      console.warn('Speech recognition error:', err)
    }
  })
}

async function evaluatePronunciation(spoken) {
  if (abortController.value) abortController.value.abort()
  abortController.value = new AbortController()

  // Load Settings
  const savedSettings = localStorage.getItem('ai-instructor-settings')
  const settings = savedSettings ? JSON.parse(savedSettings) : { activeEngine: 'demo', geminiApiKey: '', opencodeApiKey: '', modelName: 'opencode-go/minimax-m2.7' }

  try {
    const res = await fetch(getApiUrl('api/pronunciation'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abortController.value.signal,
      body: JSON.stringify({
        spoken,
        target: currentPhrase.value.text,
        language: props.language,
        activeEngine: settings.activeEngine,
        geminiApiKey: settings.geminiApiKey,
        opencodeApiKey: settings.opencodeApiKey,
        model: settings.modelName || 'opencode-go/minimax-m2.7'
      })
    })

    if (res.ok) {
      const data = await res.json()
      const backendPhonemes = data.phonemes || generatePhonemes(spoken, currentPhrase.value.text)
      feedback.value = {
        type: data.feedback.score >= 80 ? 'success' : data.feedback.score >= 60 ? 'warning' : 'error',
        score: data.feedback.score,
        errors: data.feedback.errors || [],
        suggestions: data.feedback.suggestions || [],
        phonemes: backendPhonemes,
        fallback: data.fallback || false
      }

      savePracticeStats(data.feedback.score)
      return
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      console.warn('Pronunciation eval aborted')
      return
    }
    console.error('Backend eval failed:', e)
  }

  // Fallback
  const similarity = calculateSimilarity(spoken, currentPhrase.value.text)
  feedback.value = {
    type: similarity > 0.8 ? 'success' : similarity > 0.5 ? 'warning' : 'error',
    score: Math.round(similarity * 100),
    errors: [],
    suggestions: similarity > 0.8 ? ['發音非常好！'] : ['請再嘗試練習，注意聲調'],
    phonemes: generatePhonemes(spoken, currentPhrase.value.text),
    fallback: true
  }

  savePracticeStats(Math.round(similarity * 100))
}

function generatePhonemes(spoken, target) {
  const cleanSpoken = spoken.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?？。，、！]/g,"")
  const cleanTarget = target.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?？。，、！]/g,"")
  
  const phonemes = []
  for (let i = 0; i < cleanTarget.length; i++) {
    const char = cleanTarget[i]
    phonemes.push({
      char,
      correct: cleanSpoken.includes(char)
    })
  }
  return phonemes
}

function calculateSimilarity(a, b) {
  if (!a && !b) return 1
  if (!a || !b) return 0
  const matrix = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i-1] === a[j-1]
        ? matrix[i-1][j-1]
        : Math.min(matrix[i-1][j-1], matrix[i][j-1], matrix[i-1][j]) + 1
    }
  }
  const distance = matrix[b.length][a.length]
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - distance / maxLen
}

function savePracticeStats(score) {
  try {
    const saved = localStorage.getItem('learning-stats')
    const raw = saved ? JSON.parse(saved) : null
    const stats = raw ? { ...raw } : { practiceCount: 0, totalScore: 0, avgScore: 0, totalChats: 0, streakDays: 0, lastActivityDate: null }
    stats.practiceCount = (stats.practiceCount || 0) + 1
    stats.totalScore = (stats.totalScore || 0) + score
    stats.avgScore = Math.round(stats.totalScore / stats.practiceCount)

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
    logActivity('pronunciation', score)
  } catch (e) {
    console.error('Save stats failed:', e)
  }
}

function logActivity(type, detail) {
  try {
    const saved = localStorage.getItem('learning-activities')
    const activities = saved ? JSON.parse(saved) : []
    const icons = { chat: '💬', pronunciation: '🎯', scenario: '🎭' }
    const descriptions = {
      chat: '進行咗對話練習',
      pronunciation: `發音練習得分 ${detail} 分`,
      scenario: '完成咗場景練習'
    }
    activities.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      type,
      icon: icons[type] || '📌',
      description: descriptions[type] || '學習活動',
      timestamp: Date.now()
    })
    localStorage.setItem('learning-activities', JSON.stringify(activities.slice(-100)))
  } catch (e) {
    console.error('Log activity failed:', e)
  }
}

function prevPhrase() {
  if (currentIndex.value > 0) {
    currentIndex.value--
    feedback.value = null
    spokenText.value = ''
  }
}

function nextPhrase() {
  if (currentIndex.value < phrases.value.length - 1) {
    currentIndex.value++
    feedback.value = null
    spokenText.value = ''
  }
}

onUnmounted(() => {
  if (abortController.value) {
    abortController.value.abort()
  }
})

watch(() => props.language, () => {
  currentIndex.value = 0
  feedback.value = null
  spokenText.value = ''
})
</script>

<style scoped>
.pronunciation-panel {
  background: rgba(20, 21, 33, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 1.5rem;
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

h3 {
  color: #a855f7;
  font-size: 1.5rem;
  margin-bottom: 0.25rem;
}

.hint {
  color: #94a3b8;
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
}

.phrase-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 2rem 1.5rem;
  text-align: center;
  margin-bottom: 1.5rem;
  box-shadow: inset 0 0 20px rgba(255,255,255,0.01);
}

.phrase {
  font-family: 'Outfit', sans-serif;
  font-size: 1.8rem;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 0.5rem;
  letter-spacing: -0.01em;
}

.pinyin {
  color: #38bdf8;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 1.05rem;
  margin-bottom: 1.25rem;
}

.phrase-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.play-btn, .slow-btn {
  padding: 0.5rem 1.25rem;
  border: none;
  border-radius: 20px;
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 10px rgba(99, 102, 241, 0.25);
}

.play-btn:hover, .slow-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
}

.slow-btn {
  background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
  box-shadow: 0 4px 10px rgba(168, 85, 247, 0.25);
}

.slow-btn:hover {
  box-shadow: 0 4px 15px rgba(168, 85, 247, 0.4);
}

.record-section {
  text-align: center;
  margin: 1.5rem 0;
}

.record-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 2.5rem;
  background: rgba(255, 255, 255, 0.03);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 50px;
  color: #f1f5f9;
  cursor: pointer;
  font-size: 1.1rem;
  font-weight: 600;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.record-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}

.record-btn.recording {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.15);
  color: white;
  animation: pulse 1.2s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
}

.record-icon {
  font-size: 1.5rem;
}

.spoken-text {
  padding: 0.85rem 1.25rem;
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 10px;
  margin-bottom: 1.5rem;
  font-size: 0.95rem;
  color: #cbd5e1;
}

/* Feedback Styling */
.feedback {
  padding: 1.5rem;
  border-radius: 12px;
  margin: 1.5rem 0;
  backdrop-filter: blur(8px);
}

.feedback.success {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.2);
  color: #a7f3d0;
}

.feedback.warning {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.2);
  color: #fde68a;
}

.feedback.error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #fca5a5;
}

.feedback-header {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  margin-bottom: 1.25rem;
}

.score-circle {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  border: 4px solid currentColor;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-weight: 800;
}

.score {
  font-size: 1.75rem;
  line-height: 1;
}

.score-lbl {
  font-size: 0.65rem;
  font-weight: bold;
}

.feedback-meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.grade {
  font-size: 1.15rem;
  font-weight: 700;
}

.fallback-note {
  font-size: 0.75rem;
  opacity: 0.6;
}

.phonemes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 1rem 0;
  justify-content: center;
}

.char-p {
  padding: 0.3rem 0.65rem;
  border-radius: 6px;
  font-size: 1.25rem;
  font-weight: 700;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.char-p.correct {
  background: rgba(16, 185, 129, 0.25);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.char-p.wrong {
  background: rgba(239, 68, 68, 0.25);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.suggestions-wrapper h5 {
  font-size: 0.85rem;
  margin-bottom: 0.4rem;
  color: #cbd5e1;
}

.suggestions {
  padding-left: 1.2rem;
  font-size: 0.9rem;
  color: #94a3b8;
}

.suggestions li {
  margin-bottom: 0.35rem;
}

.errors {
  margin-top: 0.75rem;
  font-size: 0.85rem;
}

/* Progress Section */
.progress {
  margin: 1.5rem 0;
}

.progress-bar {
  height: 8px;
  background: rgba(255,255,255,0.05);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.fill {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #a855f7);
  box-shadow: 0 0 10px rgba(168, 85, 247, 0.3);
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.progress-lbl {
  text-align: right;
  font-size: 0.8rem;
  color: #94a3b8;
}

/* Navigation Buttons */
.nav-buttons {
  display: flex;
  gap: 0.75rem;
}

.nav-buttons button {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  color: #e2e8f0;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-buttons button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  color: white;
}

.nav-buttons button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.animate-fade-in {
  animation: fadeIn 0.3s ease;
}

.animate-scale-up {
  animation: scaleUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleUp {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
</style>
