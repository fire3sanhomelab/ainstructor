<template>
  <div class="app">
    <header class="header">
      <h1>🎓 AI Instructor</h1>
      <p>廣東話 · 普通話 · AI 語言學習</p>
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
          {{ tab.icon }} {{ tab.label }}
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
  // Prevent error from propagating and crashing the app
  return false
})

const tabs = [
  { code: 'chat', label: '自由對話', icon: '💬' },
  { code: 'scenario', label: '場景練習', icon: '🎭' },
  { code: 'pronunciation', label: '發音訓練', icon: '🎯' },
  { code: 'progress', label: '學習進度', icon: '📊' }
]
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: #f5f5f5;
  color: #333;
}

.app {
  max-width: 800px;
  margin: 0 auto;
  min-height: 100vh;
}

.header {
  background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
  color: white;
  padding: 2rem;
  text-align: center;
}

.header h1 {
  font-size: 1.8rem;
  margin-bottom: 0.5rem;
}

.header p {
  opacity: 0.9;
  font-size: 0.95rem;
}

.main {
  padding: 1rem;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  overflow-x: auto;
}

.tab-btn {
  flex: 1;
  min-width: 80px;
  padding: 0.75rem 0.5rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
  white-space: nowrap;
}

.tab-btn.active {
  border-color: #4F46E5;
  background: #eef2ff;
  font-weight: 600;
}

.tab-btn:focus-visible,
.lang-btn:focus-visible {
  outline: 2px solid #4F46E5;
  outline-offset: 2px;
}

.error-banner {
  background: #fee2e2;
  color: #991b1b;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.error-banner button {
  background: #991b1b;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}
</style>
