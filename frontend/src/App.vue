<template>
  <div class="app">
    <header class="header">
      <div class="glow-orb"></div>
      <h1 class="logo-text">🎓 AInstructor</h1>
      <p class="subtitle-text">廣東話 · 普通話 · AI 智能語言學習</p>
    </header>
    
    <main class="main">
      <div v-if="errorBoundary" class="error-banner">
        <p>⚠️ 發生錯誤：{{ errorBoundary.message }}</p>
        <button @click="errorBoundary = null">關閉</button>
      </div>
      
      <LanguageSelector v-model="currentLang" />
      
      <nav class="tabs">
        <button 
          v-for="tab in tabs" 
          :key="tab.code"
          :class="['tab-btn', { active: currentTab === tab.code }]"
          @click="currentTab = tab.code"
        >
          <span class="tab-icon">{{ tab.icon }}</span>
          <span class="tab-label">{{ tab.label }}</span>
        </button>
      </nav>
      
      <ChatInterface 
        v-if="currentTab === 'chat'" 
        :key="currentLang"
        :language="currentLang" 
      />

      <LiveTalking
        v-else-if="currentTab === 'livetalking'"
        :key="currentLang"
        :language="currentLang"
      />
      
      <ScenarioMode
        v-else-if="currentTab === 'scenario'"
        :key="currentLang"
        :language="currentLang"
      />
      
      <PronunciationPanel 
        v-else-if="currentTab === 'pronunciation'" 
        :key="currentLang"
        :language="currentLang" 
      />
      
      <ProgressPanel
        v-else-if="currentTab === 'progress'"
        :key="currentLang"
      />

      <SettingsPanel
        v-else-if="currentTab === 'settings'"
      />
    </main>
  </div>
</template>

<script setup>
import { ref, onErrorCaptured } from 'vue'
import LanguageSelector from './components/LanguageSelector.vue'
import ChatInterface from './components/ChatInterface.vue'
import LiveTalking from './components/LiveTalking.vue'
import PronunciationPanel from './components/PronunciationPanel.vue'
import ScenarioMode from './components/ScenarioMode.vue'
import ProgressPanel from './components/ProgressPanel.vue'
import SettingsPanel from './components/SettingsPanel.vue'

const currentLang = ref('cantonese')
const currentTab = ref('chat')
const errorBoundary = ref(null)

onErrorCaptured((err, instance, info) => {
  console.error('Error captured in App:', err, info)
  errorBoundary.value = {
    message: err.message || '發生錯誤',
    info,
    time: Date.now()
  }
  return false
})

const tabs = [
  { code: 'chat', label: '自由對話', icon: '💬' },
  { code: 'livetalking', label: '即時通話', icon: '📞' },
  { code: 'scenario', label: '場景練習', icon: '🎭' },
  { code: 'pronunciation', label: '發音訓練', icon: '🎯' },
  { code: 'progress', label: '學習進度', icon: '📊' },
  { code: 'settings', label: '設定', icon: '⚙️' }
]
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400;1,9..40,500&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  background: radial-gradient(ellipse at 30% 0%, #111220 0%, #07080d 60%);
  color: #e2e8f0;
  min-height: 100vh;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.app {
  max-width: 800px;
  margin: 0 auto;
  min-height: 100vh;
  padding-bottom: 2rem;
}

.header {
  position: relative;
  padding: 2.5rem 2rem 1.75rem;
  text-align: left;
  overflow: hidden;
}

.glow-orb {
  position: absolute;
  top: -60px;
  left: 15%;
  transform: translateX(-50%);
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(56, 189, 248, 0.25) 0%, rgba(56, 189, 248, 0) 70%);
  filter: blur(40px);
  pointer-events: none;
  z-index: 1;
}

.logo-text {
  font-family: 'Outfit', sans-serif;
  font-weight: 800;
  font-size: 2.25rem;
  background: linear-gradient(135deg, #38bdf8 0%, #818cf8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 0.35rem;
  letter-spacing: -0.04em;
  z-index: 2;
  position: relative;
}

.subtitle-text {
  color: #64748b;
  font-size: 0.875rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  z-index: 2;
  position: relative;
}

.main {
  padding: 0 1rem;
}

.tabs {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.375rem;
  margin-bottom: 1.25rem;
  padding: 0.25rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 12px;
}

.tab-btn {
  padding: 0.7rem 0.35rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  position: relative;
}

.tab-btn:hover {
  color: #cbd5e1;
  background: rgba(255, 255, 255, 0.03);
}

.tab-btn:active {
  transform: scale(0.96);
}

.tab-btn.active {
  color: #ffffff;
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.25);
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.08);
}

.tab-icon {
  font-size: 1.15rem;
}

.tab-label {
  font-size: 0.675rem;
  white-space: nowrap;
}

.error-banner {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  padding: 0.875rem 1rem;
  border-radius: 10px;
  margin-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
}

.error-banner button {
  background: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.3);
  padding: 0.4rem 0.85rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.8rem;
  transition: all 0.2s;
}

.error-banner button:hover {
  background: rgba(239, 68, 68, 0.3);
}

.error-banner button:active {
  transform: scale(0.96);
}
</style>
