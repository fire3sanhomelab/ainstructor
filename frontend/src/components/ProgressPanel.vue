<template>
  <div class="progress-panel">
    <h3>📊 學習進度 / Progress</h3>
    <p class="desc">追蹤您嘅學習里數同已解鎖成就。</p>
    
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
        <span class="stat-icon">🔥</span>
        <span class="stat-value">{{ stats.streakDays }}</span>
        <span class="stat-label">連續天數</span>
      </div>
      <div class="stat-card">
        <span class="stat-icon">🏆</span>
        <span class="stat-value">{{ stats.avgScore }}</span>
        <span class="stat-label">平均發音分</span>
      </div>
    </div>
    
    <div class="recent-activity">
      <h4>🕐 最近活動 / Activities</h4>
      <div v-if="activities.length === 0" class="empty">
        暫無記錄，快啲開始您嘅第一堂對話啦！
      </div>
      <div v-else class="activity-list">
        <div 
          v-for="activity in activities" 
          :key="activity.id"
          class="activity-item"
        >
          <span class="activity-icon">{{ activity.icon }}</span>
          <div class="activity-info">
            <p class="activity-desc">{{ activity.description }}</p>
            <span class="activity-time">{{ formatTime(activity.timestamp) }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <div class="achievements">
      <h4>🏆 榮譽成就 / Achievements</h4>
      <div class="achievement-grid">
        <div 
          v-for="achievement in achievements" 
          :key="achievement.id"
          :class="['achievement-item', { unlocked: achievement.unlocked }]"
        >
          <span class="achievement-icon">{{ achievement.icon }}</span>
          <div class="ach-meta">
            <span class="achievement-name">{{ achievement.name }}</span>
            <span class="achievement-status">{{ achievement.unlocked ? '已解鎖' : '未解鎖' }}</span>
          </div>
          <span v-if="achievement.unlocked" class="achievement-badge">✓</span>
        </div>
      </div>
    </div>
    
    <button class="export-btn" @click="exportData">
      📥 匯出學習數據 (JSON)
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

      // Reset streak if inactive
      if (data.lastActivityDate) {
        const today = new Date().toISOString().split('T')[0]
        const last = new Date(data.lastActivityDate)
        const curr = new Date(today)
        const diffDays = Math.floor((curr - last) / (1000 * 60 * 60 * 24))
        if (diffDays > 1) {
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
  if (stats.value.totalChats >= 1) unlockAchievement('first-chat')
  if (stats.value.practiceCount >= 1) unlockAchievement('first-practice')
  if (stats.value.streakDays >= 3) unlockAchievement('streak-3')
  if (stats.value.streakDays >= 7) unlockAchievement('streak-7')
  if (stats.value.avgScore >= 80) unlockAchievement('score-80')
  if (stats.value.avgScore >= 95) unlockAchievement('score-95')
  if (stats.value.totalChats >= 50) unlockAchievement('chat-50')

  // Count scenarios from activities
  const localActs = JSON.parse(localStorage.getItem('learning-activities') || '[]')
  const scenarioCount = localActs.filter(a => a.type === 'scenario').length
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
  a.download = `ainstructor-record-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.progress-panel {
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

.desc {
  color: #94a3b8;
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 1.25rem 1rem;
  text-align: center;
  transition: transform 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.04);
}

.stat-icon {
  font-size: 1.6rem;
  display: block;
  margin-bottom: 0.25rem;
}

.stat-value {
  font-family: 'Outfit', sans-serif;
  font-size: 1.75rem;
  font-weight: 700;
  color: #a855f7;
  display: block;
  text-shadow: 0 0 10px rgba(168, 85, 247, 0.2);
}

.stat-label {
  font-size: 0.8rem;
  color: #64748b;
  font-weight: 500;
}

.recent-activity {
  margin-bottom: 1.5rem;
}

.recent-activity h4, .achievements h4 {
  color: #e2e8f0;
  margin-bottom: 0.75rem;
  font-weight: 700;
  font-family: 'Outfit', sans-serif;
}

.empty {
  color: #64748b;
  text-align: center;
  padding: 2rem;
  background: rgba(255, 255, 255, 0.01);
  border: 1px dashed rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  font-size: 0.9rem;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 200px;
  overflow-y: auto;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 8px;
}

.activity-icon {
  font-size: 1.2rem;
}

.activity-info {
  display: flex;
  flex: 1;
  justify-content: space-between;
  align-items: center;
}

.activity-desc {
  font-size: 0.9rem;
  color: #cbd5e1;
}

.activity-time {
  font-size: 0.75rem;
  color: #64748b;
}

.achievements {
  margin-bottom: 1.5rem;
}

.achievement-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 0.5rem;
}

.achievement-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.01);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  opacity: 0.35;
  transition: all 0.3s;
}

.achievement-item.unlocked {
  opacity: 1;
  border-color: rgba(251, 191, 36, 0.4);
  background: rgba(251, 191, 36, 0.06);
  box-shadow: 0 0 10px rgba(251, 191, 36, 0.05);
}

.achievement-icon {
  font-size: 1.25rem;
}

.ach-meta {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.achievement-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: #e2e8f0;
}

.achievement-status {
  font-size: 0.65rem;
  color: #64748b;
}

.achievement-item.unlocked .achievement-status {
  color: #fbbf24;
}

.achievement-badge {
  color: #34d399;
  font-weight: 900;
  font-size: 0.95rem;
}

.export-btn {
  width: 100%;
  padding: 0.85rem;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
  color: white;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
}

.export-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.35);
}
</style>
