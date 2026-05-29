// Pre-fetch voices to trigger loading in some browsers
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.getVoices()
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices()
    }
  }
}

/**
 * Robust utility to play TTS in Cantonese or Mandarin with voice selection overrides.
 * @param {string} text Text to read
 * @param {string} language 'cantonese' or 'mandarin'
 * @param {number} rate Speed rate (default 0.85)
 */
export function speakText(text, language, rate = 0.85, onEnd = null) {
  if (!window.speechSynthesis) return
  
  // Stop any ongoing speech
  speechSynthesis.cancel()
  
  const utterance = new SpeechSynthesisUtterance(text)
  const langCode = language === 'cantonese' ? 'zh-HK' : 'zh-CN'
  utterance.lang = langCode
  utterance.rate = rate

  if (onEnd) {
    utterance.onend = onEnd
    utterance.onerror = onEnd
  }

  const voices = speechSynthesis.getVoices()
  
  // Normalize comparison helper
  const normalize = (str) => (str || '').replace(/['_]/g, '-').toLowerCase()

  // Strict Cantonese voice detector
  const isCantoneseVoice = (v) => {
    const name = normalize(v.name)
    const lang = normalize(v.lang)
    return lang.includes('hk') || 
           name.includes('cantonese') || 
           name.includes('hong-kong') || 
           name.includes('sin-ji') || 
           name.includes('sinji') || 
           name.includes('macao') || 
           name.includes('mo') ||
           name.includes('yue') ||
           lang.includes('yue')
  }

  // Strict Mandarin voice detector
  const isMandarinVoice = (v) => {
    const name = normalize(v.name)
    const lang = normalize(v.lang)
    // Must NOT be Cantonese, and must be a Chinese/PRC/Taiwan/Singapore voice
    return !isCantoneseVoice(v) && (
      lang.startsWith('zh') || 
      lang.includes('cn') || 
      lang.includes('tw') || 
      lang.includes('sg') || 
      name.includes('mandarin') || 
      name.includes('putonghua') || 
      name.includes('mainland') || 
      name.includes('simplified') ||
      name.includes('prc') ||
      name.includes('huihui') ||
      name.includes('yaoyao') ||
      name.includes('kangkang') ||
      name.includes('xiaoxiao')
    )
  }

  let voice
  if (language === 'cantonese') {
    // 1. Try exact matches first
    voice = voices.find(v => normalize(v.lang) === 'zh-hk' || normalize(v.lang) === 'zh-hant-hk')
    // 2. Fall back to any detected Cantonese voice
    if (!voice) {
      voice = voices.find(isCantoneseVoice)
    }
  } else {
    // Mandarin
    // 1. Try exact matches first
    voice = voices.find(v => normalize(v.lang) === 'zh-cn' || normalize(v.lang) === 'zh-hans-cn')
    // 2. Fall back to any detected Mandarin voice
    if (!voice) {
      voice = voices.find(isMandarinVoice)
    }
  }

  if (voice) {
    utterance.voice = voice
  }

  speechSynthesis.speak(utterance)
}
