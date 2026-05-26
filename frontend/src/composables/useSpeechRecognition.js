import { ref } from 'vue'

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
const isSupported = !!SpeechRecognition

export function useSpeechRecognition(options = {}) {
  const isRecording = ref(false)
  const error = ref(null)
  let recognition = null

  function start({
    lang = 'zh-HK',
    onResult = () => {},
    onError = () => {},
    continuous = false,
    interimResults = false
  } = {}) {
    error.value = null

    if (!isSupported) {
      const err = new Error('瀏覽器唔支持語音輸入 / 浏览器不支持语音输入')
      error.value = err
      onError(err)
      return false
    }

    try {
      recognition = new SpeechRecognition()
      recognition.lang = lang
      recognition.continuous = continuous
      recognition.interimResults = interimResults

      recognition.onstart = () => {
        isRecording.value = true
      }

      recognition.onend = () => {
        isRecording.value = false
        recognition = null
      }

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        onResult(transcript)
      }

      recognition.onerror = (event) => {
        isRecording.value = false
        const err = new Error(`Speech recognition error: ${event.error}`)
        error.value = err
        onError(err)
      }

      recognition.start()
      return true
    } catch (err) {
      error.value = err
      onError(err)
      return false
    }
  }

  function stop() {
    if (recognition) {
      try {
        recognition.stop()
      } catch {
        // Ignore stop errors
      }
      recognition = null
    }
    isRecording.value = false
  }

  function toggle(params) {
    if (isRecording.value) {
      stop()
      return false
    }
    return start({ ...options, ...params })
  }

  return {
    isSupported,
    isRecording,
    error,
    start,
    stop,
    toggle
  }
}
