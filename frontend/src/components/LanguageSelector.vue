<template>
  <div class="language-selector">
    <button 
      v-for="lang in languages" 
      :key="lang.code"
      :class="['lang-btn', { active: modelValue === lang.code }]"
      @click="$emit('update:modelValue', lang.code)"
    >
      <span class="flag">{{ lang.flag }}</span>
      <span class="name">{{ lang.name }}</span>
    </button>
  </div>
</template>

<script setup>
defineProps(['modelValue'])
defineEmits(['update:modelValue'])

const languages = [
  { code: 'cantonese', name: '廣東話 (Cantonese)', flag: '🇭🇰' },
  { code: 'mandarin', name: '普通話 (Mandarin)', flag: '🇨🇳' }
]
</script>

<style scoped>
.language-selector {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  background: rgba(20, 21, 33, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  margin-bottom: 1.25rem;
  backdrop-filter: blur(10px);
}

.lang-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(10, 11, 18, 0.5);
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.95rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.lang-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #e2e8f0;
}

.lang-btn.active {
  border-color: #a855f7;
  background: rgba(168, 85, 247, 0.15);
  color: #ffffff;
  box-shadow: 0 0 10px rgba(168, 85, 247, 0.1);
}

.flag {
  font-size: 1.2rem;
}

.name {
  font-weight: 600;
}
</style>
