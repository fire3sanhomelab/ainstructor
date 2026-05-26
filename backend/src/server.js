import express from 'express'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import { v4 as uuidv4 } from 'uuid'
import fetch from 'node-fetch'
import { createServer } from 'http'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.join(__dirname, '..')

// ===== CONFIG =====
const PORT = process.env.PORT || 3456
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'
const LLM_STUDIO_URL = process.env.LLM_STUDIO_URL || 'http://192.168.1.100:1234'

// ===== APP SETUP =====
const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

app.use(cors())
app.use(express.json({ limit: '50mb' }))

// Ensure dirs exist
await fs.mkdir(path.join(ROOT, 'data'), { recursive: true })

// ===== DATA HELPERS =====
async function readData(file) {
  try {
    const raw = await fs.readFile(path.join(ROOT, 'data', file), 'utf8')
    return JSON.parse(raw)
  } catch { return [] }
}

async function writeData(file, data) {
  await fs.writeFile(path.join(ROOT, 'data', file), JSON.stringify(data, null, 2))
}

// ===== HEALTH =====
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'ainstructor', version: '1.0.0', time: new Date().toISOString() })
})

// ===== CHAT =====
app.post('/api/chat', async (req, res) => {
  const { messages, language = 'cantonese', model = 'opencode-go/kimi-k2.6' } = req.body

  const systemPrompts = {
    cantonese: '你係一位專業嘅廣東話導師。請用純正廣東話（口語化）回應。當學生講錯時，請溫柔地糾正發音同語法。保持耐心，鼓勵學生多講。',
    mandarin: '你是一位专业的普通话导师。请用标准普通话回应。当学生讲错时，请温柔地纠正发音和语法。保持耐心，鼓励学生多说。'
  }

  const endpoints = [
    { url: `${OLLAMA_URL}/v1/chat/completions`, name: 'ollama' },
    { url: `${LLM_STUDIO_URL}/v1/chat/completions`, name: 'llm-studio' }
  ]

  for (const ep of endpoints) {
    try {
      const response = await fetch(ep.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompts[language] || systemPrompts.cantonese },
            ...messages
          ],
          stream: false,
          temperature: 0.7
        })
      })

      if (response.ok) {
        const data = await response.json()
        const content = data.choices?.[0]?.message?.content || data.response

        // Save conversation
        const history = await readData('chat-history.json')
        history.push({ id: uuidv4(), language, messages, response: content, timestamp: Date.now() })
        if (history.length > 500) history.shift()
        await writeData('chat-history.json', history)

        return res.json({ success: true, content, endpoint: ep.name })
      }
    } catch (e) {
      console.warn(`${ep.name} failed:`, e.message)
    }
  }

  res.status(503).json({ error: 'All AI endpoints unavailable' })
})

// ===== PRONUNCIATION FEEDBACK =====
app.post('/api/pronunciation', async (req, res) => {
  const { spoken, target, language = 'cantonese' } = req.body

  const prompt = language === 'cantonese'
    ? `請評估以下廣東話發音。目標句子：「${target}」。學生讀出：「${spoken}」。
請提供：1. 整體評分（0-100） 2. 錯誤嘅字詞 3. 改善建議（用廣東話）。回應格式：JSON {score, errors[], suggestions[]}`
    : `请评估以下普通话发音。目标句子：「${target}」。学生读出：「${spoken}」。
请提供：1. 整体评分（0-100） 2. 错误的字词 3. 改善建议。回应格式：JSON {score, errors[], suggestions[]}`

  try {
    const response = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'opencode-go/kimi-k2.6',
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        temperature: 0.3
      })
    })

    if (response.ok) {
      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || data.response

      let feedback
      try {
        const match = content.match(/\{[\s\S]*\}/)
        feedback = match ? JSON.parse(match[0]) : { score: 70, errors: [], suggestions: ['繼續練習'] }
      } catch {
        feedback = { score: 70, errors: [], suggestions: [content.slice(0, 200)] }
      }

      return res.json({ success: true, feedback })
    }
  } catch (e) {
    console.error('Pronunciation eval failed:', e.message)
  }

  const similarity = calculateSimilarity(spoken, target)
  res.json({
    success: true,
    fallback: true,
    feedback: {
      score: Math.round(similarity * 100),
      errors: [],
      suggestions: similarity > 0.8 ? ['發音很好！'] : ['請再練習多幾次']
    }
  })
})

function calculateSimilarity(a, b) {
  const matrix = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i-1] === a[j-1]
        ? matrix[i-1][j-1]
        : Math.min(matrix[i-1][j-1], matrix[i][j-1], matrix[i-1][j]) + 1
    }
  }
  return 1 - matrix[b.length][a.length] / Math.max(a.length, b.length)
}

// ===== SCENARIOS =====
app.get('/api/scenarios', (req, res) => {
  const { language = 'cantonese' } = req.query

  const scenarios = {
    cantonese: [
      { id: 'restaurant', name: '🍜 茶餐廳點餐', description: '練習喺茶餐廳點餐、問價錢' },
      { id: 'shopping', name: '🛍️ 街市買餸', description: '去街市買餸、講價' },
      { id: 'taxi', name: '🚕 搭的士', description: '截的士、講目的地' },
      { id: 'hospital', name: '🏥 睇醫生', description: '描述病徵、約時間' },
      { id: 'friends', name: '☕ 同朋友傾偈', description: '閒聊、約食飯' }
    ],
    mandarin: [
      { id: 'restaurant', name: '🍜 餐厅点餐', description: '练习在餐厅点餐、询问价格' },
      { id: 'shopping', name: '🛍️ 超市购物', description: '超市购物、询价' },
      { id: 'taxi', name: '🚕 打出租车', description: '叫出租车、说目的地' },
      { id: 'hotel', name: '🏨 酒店入住', description: '办理入住、询问服务' },
      { id: 'interview', name: '💼 工作面试', description: '自我介绍、回答问题' }
    ]
  }

  res.json({ scenarios: scenarios[language] || scenarios.cantonese })
})

app.post('/api/scenario-start', async (req, res) => {
  const { scenarioId, language = 'cantonese' } = req.body

  const scenarioPrompts = {
    cantonese: {
      restaurant: '你而家係茶餐廳侍應。我係顧客，我想點餐。請用廣東話開始對話，問我想食咩。',
      shopping: '你而家係街市檔主。我係顧客，想買餸。請用廣東話開始對話。',
      taxi: '你而家係的士司機。我已經上咗車。請用廣東話問我去邊。',
      hospital: '你而家係醫生。我係病人。請用廣東話問我有咩病徵。',
      friends: '你係我嘅朋友。我哋約咗飲茶。請用廣東話傾偈。'
    },
    mandarin: {
      restaurant: '你现在是餐厅服务员。我是顾客，想点餐。请用普通话开始对话。',
      shopping: '你现在是超市店员。我是顾客。请用普通话开始对话。',
      taxi: '你现在是出租车司机。我已经上车。请用普通话问我去哪里。',
      hotel: '你现在是酒店前台。我要办理入住。请用普通话开始对话。',
      interview: '你现在是面试官。我是应聘者。请用普通话开始面试。'
    }
  }

  const prompt = scenarioPrompts[language]?.[scenarioId] || scenarioPrompts.cantonese.restaurant

  try {
    const response = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'opencode-go/kimi-k2.6',
        messages: [{ role: 'system', content: prompt }],
        stream: false,
        temperature: 0.8
      })
    })

    if (response.ok) {
      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || data.response
      return res.json({ success: true, message: content })
    }
  } catch (e) {
    console.error('Scenario start failed:', e.message)
  }

  res.json({ success: true, message: language === 'cantonese' ? '你好！有咩可以幫到你？' : '你好！有什么可以帮你的？' })
})

// ===== PROGRESS =====
app.get('/api/progress', async (req, res) => {
  const history = await readData('chat-history.json')
  const stats = {
    totalChats: history.length,
    lastActive: history.length > 0 ? history[history.length - 1].timestamp : null
  }
  res.json({ stats })
})

// ===== WEBSOCKET =====
const clients = new Set()

wss.on('connection', (ws) => {
  clients.add(ws)
  ws.send(JSON.stringify({ type: 'connected', time: Date.now() }))

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString())

      if (msg.type === 'chat') {
        const response = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: msg.model || 'opencode-go/kimi-k2.6',
            messages: msg.messages,
            stream: false
          })
        })

        if (response.ok) {
          const data = await response.json()
          ws.send(JSON.stringify({
            type: 'chat-response',
            content: data.choices?.[0]?.message?.content,
            id: msg.id
          }))
        }
      }
    } catch (e) {
      console.error('WS error:', e.message)
    }
  })

  ws.on('close', () => clients.delete(ws))
})

// ===== START =====
server.listen(PORT, () => {
  console.log(`🚀 ainstructor backend running on port ${PORT}`)
  console.log(`📡 WebSocket: ws://localhost:${PORT}/ws`)
  console.log(`🤖 Ollama: ${OLLAMA_URL}`)
  console.log(`🖥️  LLM Studio: ${LLM_STUDIO_URL}`)
})
