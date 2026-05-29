<template>
  <div class="settings-panel">
    <h3>⚙️ 設定 / 设置</h3>
    <p class="desc">設定您嘅 AI 引擎，以解鎖完整對話同發音評估功能。</p>

    <div class="card">
      <div class="form-group">
        <label>AI 引擎 / AI Engine</label>
        <select v-model="settings.activeEngine" @change="saveSettings">
          <option value="demo">✨ 離線模擬 (無需 API 金鑰 / Mock Demo)</option>
          <option value="gemini">☁️ Google Gemini API (雲端極速)</option>
          <option value="opencode">🧠 OpenCode Go (Kimi)</option>
          <option value="ollama">🖥️ Ollama (本地運行)</option>
          <option value="llm-studio">🖥️ LM Studio (本地運行)</option>
        </select>
      </div>

      <div v-if="settings.activeEngine === 'ollama' || settings.activeEngine === 'llm-studio' || settings.activeEngine === 'opencode'" class="form-group animate-slide-down">
        <label>
          本地/雲端模型名稱 / Model Name
          <span class="hint">(例如: opencode-go/kimi-k2.6)</span>
        </label>
        <input 
          v-model="settings.modelName" 
          type="text" 
          placeholder="opencode-go/kimi-k2.6" 
          @input="saveSettings"
        />
      </div>

      <div v-if="settings.activeEngine === 'gemini'" class="form-group animate-slide-down">
        <label>
          Gemini API 金鑰
          <span class="hint">可以喺 <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">Google AI Studio</a> 免費申請</span>
        </label>
        <div class="input-wrapper">
          <input 
            v-model="settings.geminiApiKey" 
            :type="showKey ? 'text' : 'password'" 
            placeholder="AIzaSy..." 
            @input="saveSettings"
          />
          <button class="toggle-btn" @click="showKey = !showKey">
            {{ showKey ? '🙈' : '👁️' }}
          </button>
        </div>
      </div>

      <div v-if="settings.activeEngine === 'opencode'" class="form-group animate-slide-down">
        <label>
          OpenCode API 金鑰
          <span class="hint">可以留空，默認將使用後端配置的金鑰</span>
        </label>
        <div class="input-wrapper">
          <input 
            v-model="settings.opencodeApiKey" 
            :type="showOpenCodeKey ? 'text' : 'password'" 
            placeholder="sk-..." 
            @input="saveSettings"
          />
          <button class="toggle-btn" @click="showOpenCodeKey = !showOpenCodeKey">
            {{ showOpenCodeKey ? '🙈' : '👁️' }}
          </button>
        </div>
      </div>

      <div class="form-group">
        <label>偏好設定 / Preferences</label>
        <div class="checkbox-wrapper">
          <input 
            id="show-jyutping" 
            v-model="settings.showJyutping" 
            type="checkbox" 
            @change="saveSettings"
          />
          <label for="show-jyutping">喺對話中默認顯示發音指南 (拼音 / 粵拼)</label>
        </div>
      </div>
    </div>

    <div class="card test-card">
      <h4>📡 連線測試 / Connection Test</h4>
      <div class="test-actions">
        <button 
          class="test-btn" 
          :disabled="isTesting" 
          @click="testConnection"
        >
          {{ isTesting ? '測試中...' : '開始測試' }}
        </button>
        <span v-if="testResult" :class="['result-badge', testResult.status]">
          {{ testResult.message }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getApiUrl } from '../utils/api.js'

const settings = ref({
  activeEngine: 'demo',
  geminiApiKey: '',
  opencodeApiKey: '',
  modelName: 'opencode-go/kimi-k2.6',
  showJyutping: true
})

const showKey = ref(false)
const showOpenCodeKey = ref(false)
const isTesting = ref(false)
const testResult = ref(null)

onMounted(() => {
  const saved = localStorage.getItem('ai-instructor-settings')
  if (saved) {
    try {
      settings.value = { ...settings.value, ...JSON.parse(saved) }
    } catch (e) {
      console.error(e)
    }
  } else {
    saveSettings()
  }
})

function saveSettings() {
  localStorage.setItem('ai-instructor-settings', JSON.stringify(settings.value))
}

async function testConnection() {
  isTesting.value = true
  testResult.value = null

  try {
    // 1. Test backend health
    const healthRes = await fetch(getApiUrl('api/health'))
    if (!healthRes.ok) {
      throw new Error('無法連線至後端伺服器 (Backend unreachable)')
    }

    // 2. Test chat route with selected engine
    const chatRes = await fetch(getApiUrl('api/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'hi' }],
        activeEngine: settings.value.activeEngine,
        geminiApiKey: settings.value.geminiApiKey,
        opencodeApiKey: settings.value.opencodeApiKey,
        model: settings.value.modelName
      })
    })

    if (chatRes.ok) {
      let data
      try {
        data = await chatRes.json()
      } catch {
        throw new Error('後端回覆格式錯誤 (Invalid response format from server)')
      }
      testResult.value = {
        status: 'success',
        message: `連線成功！已使用 ${data.endpoint} 引擎`
      }
    } else {
      let errMsg = '無法連線至 AI 引擎'
      try {
        const err = await chatRes.json()
        errMsg = err.error || errMsg
      } catch {
        try {
          const rawText = await chatRes.text()
          // Truncate to first 100 characters to keep message clean
          errMsg = rawText ? rawText.slice(0, 100) : `HTTP 錯誤碼：${chatRes.status}`
        } catch {
          errMsg = `HTTP 錯誤碼：${chatRes.status}`
        }
      }
      testResult.value = {
        status: 'error',
        message: `測試失敗：${errMsg}`
      }
    }
  } catch (e) {
    testResult.value = {
      status: 'error',
      message: e.message || '測試失敗'
    }
  } finally {
    isTesting.value = false
  }
}
</script>



<style scoped>
.settings-panel {
  animation: fadeIn 0.3s ease;
}

h3 {
  color: #a855f7;
  font-size: 1.5rem;
  margin-bottom: 0.25rem;
}

.desc {
  color: #94a3b8;
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
}

.card {
  background: rgba(20, 21, 33, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  backdrop-filter: blur(12px);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.form-group:last-child {
  margin-bottom: 0;
}

label {
  font-size: 0.9rem;
  font-weight: 600;
  color: #e2e8f0;
}

.hint {
  font-size: 0.75rem;
  font-weight: normal;
  color: #64748b;
  margin-left: 0.5rem;
}

.hint a {
  color: #6366f1;
  text-decoration: none;
}

.hint a:hover {
  text-decoration: underline;
}

select, input[type="text"], input[type="password"] {
  width: 100%;
  padding: 0.75rem 1rem;
  background: rgba(10, 11, 18, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  color: #f1f5f9;
  font-size: 0.95rem;
  outline: none;
  transition: all 0.2s;
}

select:focus, input:focus {
  border-color: #a855f7;
  box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.25);
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-wrapper input {
  padding-right: 3rem;
}

.toggle-btn {
  position: absolute;
  right: 0.75rem;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
}

.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.25rem;
}

.checkbox-wrapper input[type="checkbox"] {
  width: 1.2rem;
  height: 1.2rem;
  accent-color: #a855f7;
  cursor: pointer;
}

.checkbox-wrapper label {
  cursor: pointer;
  user-select: none;
  font-weight: normal;
  color: #cbd5e1;
}

.test-card h4 {
  margin-bottom: 0.75rem;
  color: #e2e8f0;
}

.test-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
}

.test-btn {
  padding: 0.6rem 1.25rem;
  background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
  border: none;
  border-radius: 20px;
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.test-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(168, 85, 247, 0.3);
}

.test-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.result-badge {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
}

.result-badge.success {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.25);
}

.result-badge.error {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.animate-slide-down {
  animation: slideDown 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
