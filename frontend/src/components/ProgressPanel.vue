<template>
  <div class="progress-panel">
    <h3>📊 學習進度</h3>
    
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-icon">💬</span>
        <span class="stat-value">{{ stats.totalChats }}</span>
        <span class="stat-label">對話次數</span>
      </div>
      <div class="stat-card">
        <span class="stat-icon">🎯</span>
        <span class="stat-value">{{ stats.practiceCount }}</span>
        <span class="stat-label">發音練習</span>
      </div>
      <div class="stat-card">
        <span class="stat-icon">⏱️</span>
        <span class="stat-value">{{ stats.streakDays }}</span>
        <span class="stat-label">連續天數</span>
      </div>
      <div class="stat-card">
        <span class="stat-icon">📈</span>
        <span class="stat-value">{{ stats.avgScore }}</span>
        <span class="stat-label">平均發音分</span>
      </div>
    </div>
    
    <div class="recent-activity">
      <h4>🕐 最近活動</h4>
      <div v-if="activities.length === 0" class="empty">
        暫無記錄，開始學習吧！
      </div>
      <div v-else class="activity-list">
        <div 
          v-for="activity in activities" 
          :key="activity.id"
          class="activity-item"
        >
          <span class="activity-icon">{{ activity.icon }}</span>
          <div class="activity-info">
            <p>{{ activity.description }}</p>
            <span class="activity-time">{{ formatTime(activity.timestamp) }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <div class="achievements">
      <h4>🏆 成就</h4>
      <div class="achievement-grid">
        <div 
          v-for="achievement in achievements" 
          :key="achievement.id"
          :class="['achievement-item', { unlocked: achievement.unlocked }]"
        >
          <span class="achievement-icon">{{ achievement.icon }}</span>
          <span class="achievement-name">{{ achievement.name }}</span>
          <span v-if="achievement.unlocked" class="achievement-badge">✓</span>
        </div>
      </div>
    </div>
    
    <button class="export-btn" @click="exportData">
      📥 導出學習記錄
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const stats = ref({
  totalChats: 0,
  practiceCount: 0,
  streakDays: 0,
  avgScore: 0
})

const activities = ref([])

const achievements = ref([
  { id: 'first-chat', name: '初次對話', icon: '💬', unlocked: false },
  { id: 'first-practice', name: '初次練習', icon: '🎯', unlocked: false },
  { id: 'streak-3', name: '三日堅持', icon: '🔥', unlocked: false },
  { id: 'streak-7', name: '一週達人', icon: '📅', unlocked: false },
  { id: 'score-80', name: '發音達人', icon: '🏅', unlocked: false },
  { id: 'score-95', name: '語言大師', icon: '👑', unlocked: false },
  { id: 'scenarios-5', name: '場景通', icon: '🎭', unlocked: false },
  { id: 'chat-50', name: '社交達人', icon: '🤝', unlocked: false }
])

onMounted(() => {
  loadStats()
  loadActivities()
  checkAchievements()
})

function loadStats() {
  try {
    const saved = localStorage.getItem('learning-stats')
    if (saved) {
      const data = JSON.parse(saved)
      stats.value = {
        totalChats: typeof data.totalChats === 'number' ? data.totalChats : 0,
        practiceCount: typeof data.practiceCount === 'number' ? data.practiceCount : 0,
        streakDays: typeof data.streakDays === 'number' ? data.streakDays : 0,
        avgScore: typeof data.avgScore === 'number' ? data.avgScore : 0
      }

      // Auto-detect streak from lastActivityDate
      if (data.lastActivityDate) {
        const today = new Date().toISOString().split('T')[0]
        const last = new Date(data.lastActivityDate)
        const curr = new Date(today)
        const diffDays = Math.floor((curr - last) / (1000 * 60 * 60 * 24))
        if (diffDays >= 1) {
          stats.value.streakDays = 0
        }
      }
    }
  } catch (e) {
    console.error('Failed to load stats:', e)
  }
}

function loadActivities() {
  try {
    const saved = localStorage.getItem('learning-activities')
    if (saved) {
      activities.value = JSON.parse(saved).slice(-20).reverse()
    }
  } catch (e) {
    console.error('Failed to load activities:', e)
  }
}

function checkAchievements() {
  // Simple checks based on stats
  if (stats.value.totalChats >= 1) unlockAchievement('first-chat')
  if (stats.value.practiceCount >= 1) unlockAchievement('first-practice')
  if (stats.value.streakDays >= 3) unlockAchievement('streak-3')
  if (stats.value.streakDays >= 7) unlockAchievement('streak-7')
  if (stats.value.avgScore >= 80) unlockAchievement('score-80')
  if (stats.value.avgScore >= 95) unlockAchievement('score-95')
  if (stats.value.totalChats >= 50) unlockAchievement('chat-50')

  // Count scenarios from activities
  const activities = JSON.parse(localStorage.getItem('learning-activities') || '[]')
  const scenarioCount = activities.filter(a => a.type === 'scenario').length
  if (scenarioCount >= 5) unlockAchievement('scenarios-5')
}

function unlockAchievement(id) {
  const ach = achievements.value.find(a => a.id === id)
  if (ach && !ach.unlocked) {
    ach.unlocked = true
    saveAchievements()
  }
}

function saveAchievements() {
  localStorage.setItem('achievements', JSON.stringify(achievements.value))
}

function formatTime(ts) {
  const date = new Date(ts)
  const now = new Date()
  const diff = now - date
  
  if (diff < 60000) return '剛剛'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分鐘前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小時前`
  return `${Math.floor(diff / 86400000)} 天前`
}

function exportData() {
  const data = {
    stats: stats.value,
    activities: activities.value,
    achievements: achievements.value,
    exportedAt: new Date().toISOString()
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `learning-record-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.progress-panel {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.progress-panel h3 {
  margin-bottom: 1rem;
  color: #4F46E5;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  background: #f9fafb;
  border-radius: 12px;
  padding: 1rem;
  text-align: center;
}

.stat-icon {
  font-size: 1.5rem;
  display: block;
  margin-bottom: 0.25rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #4F46E5;
}

.stat-label {
  font-size: 0.85rem;
  color: #6b7280;
}

.recent-activity {
  margin-bottom: 1.5rem;
}

.recent-activity h4 {
  margin-bottom: 0.75rem;
}

.empty {
  color: #9ca3af;
  text-align: center;
  padding: 1rem;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 8px;
}

.activity-icon {
  font-size: 1.2rem;
}

.activity-info p {
  font-size: 0.9rem;
}

.activity-time {
  font-size: 0.75rem;
  color: #9ca3af;
}

.achievements {
  margin-bottom: 1.5rem;
}

.achievements h4 {
  margin-bottom: 0.75rem;
}

.achievement-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.achievement-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  opacity: 0.5;
}

.achievement-item.unlocked {
  opacity: 1;
  border-color: #fbbf24;
  background: #fef3c7;
}

.achievement-icon {
  font-size: 1.2rem;
}

.achievement-name {
  font-size: 0.85rem;
  flex: 1;
}

.achievement-badge {
  color: #22c55e;
  font-weight: bold;
}

.export-btn {
  width: 100%;
  padding: 1rem;
  border: none;
  border-radius: 8px;
  background: #4F46E5;
  color: white;
  font-size: 1rem;
  cursor: pointer;
}

.export-btn:focus-visible {
  outline: 2px solid #4F46E5;
  outline-offset: 2px;
}
</style>
