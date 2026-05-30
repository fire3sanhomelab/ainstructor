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
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.lang-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.7rem 1rem;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
  color: #64748b;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 600;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.lang-btn:hover {
  background: rgba(255, 255, 255, 0.04);
  color: #cbd5e1;
  border-color: rgba(255, 255, 255, 0.1);
}

.lang-btn:active {
  transform: scale(0.97);
}

.lang-btn.active {
  border-color: rgba(56, 189, 248, 0.3);
  background: rgba(56, 189, 248, 0.08);
  color: #e2e8f0;
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.06);
}

.flag {
  font-size: 1.1rem;
}

.name {
  font-weight: 600;
}
</style>
