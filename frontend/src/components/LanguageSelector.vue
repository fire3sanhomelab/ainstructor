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
  { code: 'cantonese', name: '廣東話', flag: '🇭🇰' },
  { code: 'mandarin', name: '普通話', flag: '🇨🇳' }
]
</script>

<style scoped>
.language-selector {
  display: flex;
  gap: 0.5rem;
  padding: 1rem;
  background: white;
  border-radius: 12px;
  margin-bottom: 1rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.lang-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

.lang-btn.active {
  border-color: #4F46E5;
  background: #eef2ff;
}

.flag {
  font-size: 1.2rem;
}

.name {
  font-weight: 500;
}
</style>
