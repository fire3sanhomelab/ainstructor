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
export function speakText(text, language, rate = 0.85) {
  if (!window.speechSynthesis) return
  
  // Stop any ongoing speech
  speechSynthesis.cancel()
  
  const utterance = new SpeechSynthesisUtterance(text)
  const langCode = language === 'cantonese' ? 'zh-HK' : 'zh-CN'
  utterance.lang = langCode
  utterance.rate = rate

  const voices = speechSynthesis.getVoices()
  
  // Normalize comparison helper
  const normalize = (str) => (str || '').replace(/['_]/g, '-').toLowerCase()
  const targetLang = normalize(langCode)
  
  // 1. Try exact normalized lang match (e.g. 'zh-hk' or 'zh-cn')
  let voice = voices.find(v => normalize(v.lang) === targetLang)
  
  // 2. Try match in name or description
  if (!voice) {
    voice = voices.find(v => {
      const name = normalize(v.name)
      const lang = normalize(v.lang)
      if (language === 'cantonese') {
        return name.includes('cantonese') || name.includes('hong-kong') || lang.includes('hk')
      } else {
        return (name.includes('mandarin') || name.includes('putonghua') || name.includes('mainland') || lang.includes('cn') || lang.includes('zh')) 
               && !name.includes('cantonese') && !lang.includes('hk')
      }
    })
  }

  // 3. Fallback to broad language prefix ONLY if it's dialect-appropriate
  if (!voice) {
    voice = voices.find(v => {
      const lang = normalize(v.lang)
      if (language === 'cantonese') {
        return lang === 'zh-hk'
      } else {
        return lang.startsWith('zh') && lang !== 'zh-hk'
      }
    })
  }

  if (voice) {
    utterance.voice = voice
  }

  speechSynthesis.speak(utterance)
}
