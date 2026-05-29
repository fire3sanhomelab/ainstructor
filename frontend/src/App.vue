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
  { code: 'scenario', label: '場景練習', icon: '🎭' },
  { code: 'pronunciation', label: '發音訓練', icon: '🎯' },
  { code: 'progress', label: '學習進度', icon: '📊' },
  { code: 'settings', label: '設定', icon: '⚙️' }
]
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@500;600;700;800&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  background: radial-gradient(circle at 50% 0%, #15162c 0%, #07080d 70%);
  color: #f1f5f9;
  min-height: 100vh;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

.app {
  max-width: 800px;
  margin: 0 auto;
  min-height: 100vh;
  padding-bottom: 2rem;
}

.header {
  position: relative;
  padding: 3rem 2rem 2rem;
  text-align: center;
  overflow: hidden;
}

.glow-orb {
  position: absolute;
  top: -50px;
  left: 50%;
  transform: translateX(-50%);
  width: 250px;
  height: 250px;
  background: radial-gradient(circle, rgba(168, 85, 247, 0.4) 0%, rgba(99, 102, 241, 0) 70%);
  filter: blur(30px);
  pointer-events: none;
  z-index: 1;
}

.logo-text {
  font-family: 'Outfit', sans-serif;
  font-weight: 800;
  font-size: 2.5rem;
  background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 0.5rem;
  letter-spacing: -0.05em;
  z-index: 2;
  position: relative;
}

.subtitle-text {
  color: #94a3b8;
  font-size: 0.95rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  z-index: 2;
  position: relative;
}

.main {
  padding: 0 1rem;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  overflow-x: auto;
  padding: 0.25rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  scrollbar-width: none;
}

.tabs::-webkit-scrollbar {
  display: none;
}

.tab-btn {
  flex: 1;
  min-width: 90px;
  padding: 0.8rem 0.5rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.tab-btn:hover {
  color: #f1f5f9;
  background: rgba(255, 255, 255, 0.05);
}

.tab-btn.active {
  color: #ffffff;
  background: rgba(168, 85, 247, 0.2);
  border: 1px solid rgba(168, 85, 247, 0.35);
  box-shadow: 0 0 15px rgba(168, 85, 247, 0.15);
}

.tab-icon {
  font-size: 1.25rem;
}

.tab-label {
  font-size: 0.75rem;
}

.error-banner {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: #fca5a5;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.error-banner button {
  background: #ef4444;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: opacity 0.2s;
}

.error-banner button:hover {
  opacity: 0.9;
}
</style>
