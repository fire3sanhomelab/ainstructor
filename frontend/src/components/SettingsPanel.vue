<template>
  <div class="settings-panel">
    <h3>⚙️ 設定 / 设置</h3>
    <p class="desc">管理您嘅學習偏好同測試連線狀態。</p>

    <div class="card">
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
  showJyutping: true
})

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

    // 2. Test chat route (backend will secretly handle the call via OpenCode)
    const chatRes = await fetch(getApiUrl('api/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'hi' }]
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
  animation: fadeIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

h3 {
  color: #7dd3fc;
  font-size: 1.35rem;
  margin-bottom: 0.2rem;
}

.desc {
  color: #64748b;
  font-size: 0.825rem;
  margin-bottom: 1.25rem;
}

.card {
  background: rgba(15, 16, 26, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 1.25rem;
  margin-bottom: 1.25rem;
  backdrop-filter: blur(16px);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.form-group:last-child {
  margin-bottom: 0;
}

label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #cbd5e1;
}

.hint {
  font-size: 0.7rem;
  font-weight: normal;
  color: #475569;
  margin-left: 0.5rem;
}

.hint a {
  color: #38bdf8;
  text-decoration: none;
}

.hint a:hover {
  text-decoration: underline;
}

select, input[type="text"], input[type="password"] {
  width: 100%;
  padding: 0.65rem 0.875rem;
  background: rgba(10, 11, 18, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  color: #e2e8f0;
  font-size: 0.875rem;
  font-family: inherit;
  outline: none;
  transition: all 0.2s;
}

select:focus, input:focus {
  border-color: rgba(56, 189, 248, 0.4);
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.06);
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
  font-size: 1rem;
}

.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-top: 0.2rem;
}

.checkbox-wrapper input[type="checkbox"] {
  width: 1.1rem;
  height: 1.1rem;
  accent-color: #0ea5e9;
  cursor: pointer;
}

.checkbox-wrapper label {
  cursor: pointer;
  user-select: none;
  font-weight: normal;
  color: #94a3b8;
  font-size: 0.85rem;
}

.test-card h4 {
  margin-bottom: 0.65rem;
  color: #cbd5e1;
  font-size: 0.95rem;
}

.test-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.875rem;
}

.test-btn {
  padding: 0.55rem 1.1rem;
  background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%);
  border: none;
  border-radius: 16px;
  color: white;
  font-weight: 600;
  font-size: 0.825rem;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.test-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(14, 165, 233, 0.25);
}

.test-btn:active:not(:disabled) {
  transform: translateY(0) scale(0.96);
}

.test-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.result-badge {
  padding: 0.45rem 0.875rem;
  border-radius: 6px;
  font-size: 0.775rem;
  font-weight: 500;
}

.result-badge.success {
  background: rgba(16, 185, 129, 0.1);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.result-badge.error {
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.animate-slide-down {
  animation: slideDown 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
