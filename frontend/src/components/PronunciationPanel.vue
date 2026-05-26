<template>
  <div class="pronunciation-panel">
    <h3>🎯 發音練習</h3>
    
    <div class="practice-section">
      <p class="hint">{{ hintText }}</p>
      
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
          <span>{{ isRecording ? '錄音中...' : '按住練習' }}</span>
        </button>
      </div>
      
      <div v-if="spokenText" class="spoken-text">
        <p><strong>你講咗：</strong>{{ spokenText }}</p>
      </div>
      
      <div v-if="feedback" class="feedback" :class="feedback.type">
        <div class="feedback-header">
          <span class="score">{{ feedback.score }}分</span>
          <span class="grade">{{ gradeText }}</span>
        </div>
        <div v-if="feedback.phonemes" class="phonemes">
          <span 
            v-for="(p, i) in feedback.phonemes" 
            :key="i"
            :class="['phoneme', p.correct ? 'correct' : 'wrong']"
          >
            {{ p.char }}
          </span>
        </div>
        <ul v-if="feedback.suggestions" class="suggestions">
          <li v-for="(s, i) in feedback.suggestions" :key="i">{{ s }}</li>
        </ul>
        <p v-if="feedback.errors && feedback.errors.length > 0" class="errors">
          <strong>注意：</strong>{{ feedback.errors.join('、') }}
        </p>
      </div>
    </div>
    
    <div class="progress">
      <div class="progress-bar">
        <div class="fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
      <p>{{ currentIndex + 1 }} / {{ phrases.length }}</p>
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

const props = defineProps(['language'])

const isRecording = ref(false)
const currentIndex = ref(0)
const feedback = ref(null)
const spokenText = ref('')
const abortController = ref(null)

const { isRecording: speechRecording, toggle: toggleSpeech } = useSpeechRecognition()

const hintText = computed(() => {
  return props.language === 'cantonese'
    ? '跟住讀出下面嘅句子，AI 會評估你嘅發音準確度'
    : '跟着读出下面的句子，AI 会评估你的发音准确度'
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
  if (score >= 90) return '優秀！🌟'
  if (score >= 80) return '很好！👍'
  if (score >= 60) return '不錯！💪'
  return '再加油！🎯'
})

function playAudio() {
  const utterance = new SpeechSynthesisUtterance(currentPhrase.value.text)
  utterance.lang = props.language === 'cantonese' ? 'zh-HK' : 'zh-CN'
  utterance.rate = 0.85
  speechSynthesis.speak(utterance)
}

function playAudioSlow() {
  const utterance = new SpeechSynthesisUtterance(currentPhrase.value.text)
  utterance.lang = props.language === 'cantonese' ? 'zh-HK' : 'zh-CN'
  utterance.rate = 0.5
  speechSynthesis.speak(utterance)
}

async function toggleRecording() {
  if (speechRecording.value) {
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

  try {
    const res = await fetch('/api/pronunciation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abortController.value.signal,
      body: JSON.stringify({
        spoken,
        target: currentPhrase.value.text,
        language: props.language
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
        phonemes: backendPhonemes
      }

      // Save to stats
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
    suggestions: similarity > 0.8 ? ['發音很好！'] : ['請再練習多幾次'],
    phonemes: generatePhonemes(spoken, currentPhrase.value.text)
  }

  savePracticeStats(Math.round(similarity * 100))
}

function generatePhonemes(spoken, target) {
  const maxLen = Math.max(spoken.length, target.length)
  const phonemes = []
  for (let i = 0; i < maxLen; i++) {
    phonemes.push({
      char: target[i] || ' ',
      correct: i < spoken.length && spoken[i] === target[i]
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

function sanitizeStats(stats) {
  if (!stats || typeof stats !== 'object') return { practiceCount: 0, totalScore: 0, avgScore: 0, totalChats: 0, streakDays: 0, lastActivityDate: null }
  const s = { practiceCount: 0, totalScore: 0, avgScore: 0, totalChats: 0, streakDays: 0, lastActivityDate: null }
  if (typeof stats.practiceCount === 'number') s.practiceCount = Math.max(0, stats.practiceCount)
  if (typeof stats.totalScore === 'number') s.totalScore = Math.max(0, stats.totalScore)
  if (typeof stats.totalChats === 'number') s.totalChats = Math.max(0, stats.totalChats)
  if (typeof stats.streakDays === 'number') s.streakDays = Math.max(0, stats.streakDays)
  if (typeof stats.lastActivityDate === 'string') s.lastActivityDate = stats.lastActivityDate
  s.avgScore = s.practiceCount > 0 ? Math.round(s.totalScore / s.practiceCount) : 0
  return s
}

function savePracticeStats(score) {
  try {
    const saved = localStorage.getItem('learning-stats')
    const raw = saved ? JSON.parse(saved) : null
    const stats = sanitizeStats(raw)
    stats.practiceCount = (stats.practiceCount || 0) + 1
    stats.totalScore = (stats.totalScore || 0) + score
    stats.avgScore = Math.round(stats.totalScore / stats.practiceCount)

    // Update streak
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
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  margin-top: 1rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.pronunciation-panel h3 {
  margin-bottom: 1rem;
  color: #4F46E5;
}

.hint {
  color: #6b7280;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.phrase-card {
  background: #f9fafb;
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
  margin-bottom: 1rem;
}

.phrase {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.pinyin {
  color: #6b7280;
  font-size: 1rem;
  margin-bottom: 1rem;
}

.phrase-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.play-btn, .slow-btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 20px;
  background: #4F46E5;
  color: white;
  cursor: pointer;
}

.play-btn:focus-visible,
.slow-btn:focus-visible,
.record-btn:focus-visible,
.nav-buttons button:focus-visible {
  outline: 2px solid #4F46E5;
  outline-offset: 2px;
}

.slow-btn {
  background: #8B5CF6;
}

.record-section {
  text-align: center;
  margin: 1rem 0;
}

.record-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 2rem;
  border: 3px solid #e5e7eb;
  border-radius: 50px;
  background: white;
  cursor: pointer;
  font-size: 1.1rem;
  transition: all 0.2s;
}

.record-btn.recording {
  border-color: #ef4444;
  background: #fef2f2;
}

.record-icon {
  font-size: 1.5rem;
}

.spoken-text {
  padding: 0.75rem;
  background: #eef2ff;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.feedback {
  padding: 1rem;
  border-radius: 8px;
  margin: 1rem 0;
}

.feedback.success {
  background: #d1fae5;
  color: #065f46;
}

.feedback.warning {
  background: #fef3c7;
  color: #92400e;
}

.feedback.error {
  background: #fee2e2;
  color: #991b1b;
}

.feedback-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.score {
  font-size: 1.5rem;
  font-weight: 700;
}

.grade {
  font-size: 1rem;
}

.phonemes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin: 0.5rem 0;
  justify-content: center;
}

.phoneme {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 1.2rem;
}

.phoneme.correct {
  background: #6ee7b7;
}

.phoneme.wrong {
  background: #fca5a5;
}

.suggestions {
  margin-top: 0.5rem;
  padding-left: 1.2rem;
}

.suggestions li {
  margin-bottom: 0.25rem;
}

.errors {
  margin-top: 0.5rem;
  font-size: 0.9rem;
}

.progress {
  margin: 1rem 0;
}

.progress-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.fill {
  height: 100%;
  background: linear-gradient(90deg, #4F46E5, #7C3AED);
  transition: width 0.3s;
}

.nav-buttons {
  display: flex;
  gap: 0.5rem;
}

.nav-buttons button {
  flex: 1;
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  cursor: pointer;
}

.nav-buttons button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
