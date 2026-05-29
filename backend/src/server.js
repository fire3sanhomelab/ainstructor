import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import { v4 as uuidv4 } from 'uuid'
import fetch from 'node-fetch'
import { createServer } from 'http'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { errorHandler } from './middleware/errorHandler.js'
import { validate } from './middleware/validate.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.join(__dirname, '..')

// ===== CONFIG =====
const PORT = process.env.PORT || 3456
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434'
const LLM_STUDIO_URL = process.env.LLM_STUDIO_URL || 'http://192.168.1.100:1234'
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''

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

// ===== FETCH WITH TIMEOUT =====
/**
 * Wraps node-fetch with a configurable timeout so hanging AI endpoints
 * don't block the request indefinitely (default 30s).
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    return res
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Escape user input before interpolation into AI prompts.
 * Prevents prompt injection from raw speech/text input.
 */
function sanitize(str) {
  if (typeof str !== 'string') return ''
  // Remove any attempt to close JSON / inject system prompts
  return str.replace(/[\n\r]+/g, ' ').replace(/["\{\}]/g, '').slice(0, 500)
}

// ===== GEMINI API INTEGRATION =====
async function callGemini(messages, systemInstruction, key) {
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
  
  const payload = {
    contents,
    ...(systemInstruction && {
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      }
    }),
    generationConfig: {
      temperature: 0.7
    }
  };

  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API returned ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini API returned empty response');
  }
  return text;
}

// ===== CONTEXT-AWARE MOCK RESPONSES =====
function getMockResponse(messages, language, scenarioId = null) {
  const lastUserMessage = messages[messages.length - 1]?.content || '';
  const langCantonese = language === 'cantonese';

  if (scenarioId) {
    const scenarioMocks = {
      cantonese: {
        restaurant: "收到！侍應：『好呀，你想飲凍檸茶定係熱奶茶？今日嘅菠蘿油啱啱出爐！』",
        shopping: "檔主：『呢批菜心好甜呀，十蚊一斤，買兩斤送多兩條蔥畀你！』",
        taxi: "的士司機：『去旺角邊度？行公主道唔塞車，我行嗰邊得唔得？』",
        hospital: "醫生：『聽下你個肺部，好彩冇雜音。你有冇發燒或者咳？』",
        friends: "朋友：『好啊，就去飲茶啦！下個星期六下晝兩點，喺旺角地鐵站等？』"
      },
      mandarin: {
        restaurant: "服务员：『好的，请问您喝冰红茶还是热咖啡？今天的特色小笼包非常新鲜。』",
        shopping: "摊主：『这些苹果很甜，五块钱一斤，买三斤算你十块钱吧！』",
        taxi: "出租车司机：『去火车站是吗？走高速比较快，走那条路可以吗？』",
        hospital: "医生：『我量一下您的体温，有点低烧。喉咙痛不痛？』",
        hotel: "前台：『您的房间在大楼的八层，这是房卡。早餐在二层，祝您入住愉快！』",
        interview: "面试官：『非常感谢你的介绍。能谈谈你为什么对我们这个职位感兴趣吗？』"
      }
    };
    return scenarioMocks[language]?.[scenarioId] || (langCantonese ? "我哋繼續練習啦！" : "我们继续练习吧！");
  }

  // General chat mock responses based on keywords
  const text = lastUserMessage.toLowerCase();
  if (text.includes('你好') || text.includes('hello') || text.includes('hi')) {
    return langCantonese 
      ? "你好！好高興同你傾偈。今日過得點呀？（提示：您正使用離線模擬模式。要解鎖完整AI，請在設定中填寫 Gemini API Key）" 
      : "你好！很高兴和你聊天。今天过得怎么样？（提示：您正使用离线模拟模式。要解锁完整AI，请在设置中填写 Gemini API Key）";
  }
  if (text.includes('多謝') || text.includes('謝謝') || text.includes('thank')) {
    return langCantonese 
      ? "唔使客氣！學習語言最重要係多練習。仲有咩想傾？" 
      : "不客气！学习语言最重要的是多练习。还有什么想聊的？";
  }
  if (text.includes('再見') || text.includes('bye')) {
    return langCantonese 
      ? "拜拜！下次再一齊練習廣東話啦，加油！" 
      : "再见！下次再一起练习普通话吧，加油！";
  }

  // Default mock responses
  const fallbacks = langCantonese ? [
    "聽落好有趣喎！你可以同我講多啲詳情嗎？",
    "原來係咁！咁你平時鍾意做啲咩？",
    "好棒嘅分享！你可以試下用廣東話講下你今日去咗邊？",
    "我明白啦。多啲用廣東話口語交流，發音就會越來越自然！"
  ] : [
    "听起来很有趣呢！能和我多说说细节吗？",
    "原来是这样！那你平时喜欢做些什么？",
    "很棒的分享！你可以试着用普通话描述一下你的爱好吗？",
    "我明白了。多用普通话交流，口语表达就会越来越流利！"
  ];
  const randIdx = Math.floor(Math.random() * fallbacks.length);
  return fallbacks[randIdx] + (langCantonese 
    ? "\n\n💡 提示：如果想進行真正的 AI 對話，請在設定中填寫 Gemini API Key 啟用雲端 AI！" 
    : "\n\n💡 提示：如果想进行真正的 AI 对话，请在设置中填写 Gemini API Key 启用云端 AI！");
}

// ===== HEALTH =====
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'ainstructor', version: '1.0.0', time: new Date().toISOString() })
})

async function saveChatHistory(language, messages, response) {
  const history = await readData('chat-history.json')
  history.push({ id: uuidv4(), language, messages, response, timestamp: Date.now() })
  if (history.length > 500) history.shift()
  await writeData('chat-history.json', history)
}

// ===== CHAT =====
app.post('/api/chat', validate(['messages']), async (req, res) => {
  const { messages, language = 'cantonese', model = 'opencode-go/kimi-k2.6', geminiApiKey = '', activeEngine = '', scenarioId = null } = req.body

  const systemPrompts = {
    cantonese: '你係一位專業嘅廣東話導師。請用純正廣東話（口語化）回應。當學生講錯時，請溫柔地糾正發音同語法。保持耐心，鼓勵學生多講。',
    mandarin: '你是一位专业的普通话导师。请用标准普通话回应。当学生讲错时，请温柔地纠正发音和语法。保持耐心，鼓励学生多说。'
  }
  const systemPrompt = systemPrompts[language] || systemPrompts.cantonese;
  const activeKey = geminiApiKey || GEMINI_API_KEY;

  // 1. If user explicitly chose Gemini
  if (activeEngine === 'gemini' && activeKey) {
    try {
      const content = await callGemini(messages, systemPrompt, activeKey);
      await saveChatHistory(language, messages, content);
      return res.json({ success: true, content, endpoint: 'gemini' });
    } catch (e) {
      console.error('Gemini call failed:', e.message);
    }
  }

  // 2. If user explicitly chose local (or default)
  if (activeEngine !== 'demo') {
    const endpoints = [];
    if (activeEngine === 'ollama' || !activeEngine) {
      endpoints.push({ url: `${OLLAMA_URL}/v1/chat/completions`, name: 'ollama' });
    }
    if (activeEngine === 'llm-studio' || !activeEngine) {
      endpoints.push({ url: `${LLM_STUDIO_URL}/v1/chat/completions`, name: 'llm-studio' });
    }

    for (const ep of endpoints) {
      try {
        const response = await fetchWithTimeout(ep.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages
            ],
            stream: false,
            temperature: 0.7
          })
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || data.response;
          await saveChatHistory(language, messages, content);
          return res.json({ success: true, content, endpoint: ep.name });
        }
      } catch (e) {
        console.warn(`${ep.name} failed:`, e.message);
      }
    }
  }

  // 3. Fallback to Gemini if API key is present but local failed
  if (activeEngine !== 'demo' && activeKey) {
    try {
      const content = await callGemini(messages, systemPrompt, activeKey);
      await saveChatHistory(language, messages, content);
      return res.json({ success: true, content, endpoint: 'gemini-fallback' });
    } catch (e) {
      console.error('Fallback Gemini call failed:', e.message);
    }
  }

  // 4. Ultimate fallback to mock response
  const content = getMockResponse(messages, language, scenarioId);
  await saveChatHistory(language, messages, content);
  return res.json({ success: true, content, endpoint: 'demo-mock' });
})

// ===== PRONUNCIATION FEEDBACK =====
app.post('/api/pronunciation', validate(['spoken', 'target']), async (req, res) => {
  const { spoken, target, language = 'cantonese', geminiApiKey = '', activeEngine = '' } = req.body

  const safeSpoken = sanitize(spoken)
  const safeTarget = sanitize(target)
  const prompt = language === 'cantonese'
    ? `請評估以下廣東話發音。目標句子：「${safeTarget}」。學生讀出：「${safeSpoken}」。
請提供：1. 整體評分（0-100） 2. 錯誤嘅字詞 3. 改善建議（用廣東話）。回應格式：JSON {score, errors[], suggestions[]}`
    : `请评估以下普通话发音。目标句子：「${safeTarget}」。学生读出：「${safeSpoken}」。
请提供：1. 整体评分（0-100） 2. 错误的字词 3. 改善建议。回应格式：JSON {score, errors[], suggestions[]}`

  const activeKey = geminiApiKey || GEMINI_API_KEY;

  // 1. If user explicitly chose Gemini
  if (activeEngine === 'gemini' && activeKey) {
    try {
      const content = await callGemini([{ role: 'user', content: prompt }], null, activeKey);
      const feedback = parseJsonFeedback(content);
      return res.json({ success: true, feedback });
    } catch (e) {
      console.error('Gemini pronunciation eval failed:', e.message);
    }
  }

  // 2. Try Local if not demo/mock
  if (activeEngine !== 'demo') {
    try {
      const response = await fetchWithTimeout(`${OLLAMA_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'opencode-go/kimi-k2.6',
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          temperature: 0.3
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || data.response;
        const feedback = parseJsonFeedback(content);
        return res.json({ success: true, feedback });
      }
    } catch (e) {
      console.error('Local pronunciation eval failed:', e.message);
    }
  }

  // 3. Fallback to Gemini if key is present
  if (activeEngine !== 'demo' && activeKey) {
    try {
      const content = await callGemini([{ role: 'user', content: prompt }], null, activeKey);
      const feedback = parseJsonFeedback(content);
      return res.json({ success: true, feedback });
    } catch (e) {
      console.error('Fallback Gemini pronunciation eval failed:', e.message);
    }
  }

  // 4. Default fallback using similarity algorithm
  const similarity = calculateSimilarity(spoken, target);
  res.json({
    success: true,
    fallback: true,
    feedback: {
      score: Math.round(similarity * 100),
      errors: [],
      suggestions: similarity > 0.8 ? ['發音很好！'] : ['請再練習多幾次']
    }
  });
})

function parseJsonFeedback(content) {
  try {
    const match = content.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { score: 70, errors: [], suggestions: ['繼續練習'] };
  } catch {
    return { score: 70, errors: [], suggestions: [content.slice(0, 200)] };
  }
}

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

app.post('/api/scenario-start', validate(['scenarioId']), async (req, res) => {
  const { scenarioId, language = 'cantonese', geminiApiKey = '', activeEngine = '' } = req.body

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
  const activeKey = geminiApiKey || GEMINI_API_KEY;

  // 1. Gemini
  if (activeEngine === 'gemini' && activeKey) {
    try {
      const content = await callGemini([{ role: 'user', content: '開始對話。' }], prompt, activeKey);
      return res.json({ success: true, message: content });
    } catch (e) {
      console.error('Gemini scenario start failed:', e.message);
    }
  }

  // 2. Local
  if (activeEngine !== 'demo') {
    try {
      const response = await fetchWithTimeout(`${OLLAMA_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'opencode-go/kimi-k2.6',
          messages: [{ role: 'system', content: prompt }],
          stream: false,
          temperature: 0.8
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || data.response;
        return res.json({ success: true, message: content });
      }
    } catch (e) {
      console.error('Local scenario start failed:', e.message);
    }
  }

  // 3. Fallback to Gemini
  if (activeEngine !== 'demo' && activeKey) {
    try {
      const content = await callGemini([{ role: 'user', content: '開始對話。' }], prompt, activeKey);
      return res.json({ success: true, message: content });
    } catch (e) {
      console.error('Fallback Gemini scenario start failed:', e.message);
    }
  }

  // 4. Default fallback mock
  const fallbackMessages = {
    cantonese: {
      restaurant: "侍應：『早晨！幾位呀？想飲啲咩茶？今日有新鮮蛋撻同菠蘿油。』",
      shopping: "檔主：『靚仔/靚女！今日啲菜好靚喎，要唔要整兩斤？好甜㗎！』",
      taxi: "的士司機：『你好，去邊度呀？行紅隧定行東隧快啲？』",
      hospital: "醫生：『你好，請坐。今日覺得邊度唔舒服？有咩病徵？』",
      friends: "朋友：『喂！好耐無見！我哋今次去邊度飲茶呀？』"
    },
    mandarin: {
      restaurant: "服务员：『您好！请问几位？今天有刚出笼的小笼包，要不要尝尝？』",
      shopping: "摊主：『买菜啊，苹果很甜很新鲜，买点吧！』",
      taxi: "出租车司机：『你好，去哪里？走哪条路比较合适？』",
      hotel: "前台：『您好，欢迎光临。请出示您的证件，我为您办理入住。』",
      interview: "面试官：『你好，请坐。请先做一下自我介绍，谢谢。』"
    }
  }
  const defaultMsg = fallbackMessages[language]?.[scenarioId] || (language === 'cantonese' ? '你好！有咩可以幫到你？' : '你好！有什么可以帮你的？');
  res.json({ success: true, message: defaultMsg });
})

// ===== EXPLAIN SENTENCE =====
app.post('/api/explain', validate(['text']), async (req, res) => {
  const { text, language = 'cantonese', geminiApiKey = '', activeEngine = '' } = req.body

  const prompt = language === 'cantonese'
    ? `請分析以下廣東話句子：「${sanitize(text)}」。
請提供：1. 英文翻譯 2. 粵語拼音（Jyutping） 3. 重點詞彙拆解（包括漢字、拼音、英文解釋）。
請以 JSON 格式回應，格式必須為：{"translation": "...", "pronunciation": "...", "vocabulary": [{"word": "...", "pinyin": "...", "meaning": "..."}]}`
    : `请分析以下普通话句子：「${sanitize(text)}」。
请提供：1. 英文翻译 2. 汉语拼音（Pinyin） 3. 重点词汇拆解（包括汉字、拼音、英文解释）。
请以 JSON 格式回应，格式必须为：{"translation": "...", "pronunciation": "...", "vocabulary": [{"word": "...", "pinyin": "...", "meaning": "..."}]}`

  const activeKey = geminiApiKey || GEMINI_API_KEY;

  // Try Gemini
  if (activeEngine === 'gemini' && activeKey) {
    try {
      const content = await callGemini([{ role: 'user', content: prompt }], null, activeKey);
      const data = parseJsonExplanation(content);
      return res.json({ success: true, explanation: data });
    } catch (e) {
      console.error('Gemini explanation failed:', e.message);
    }
  }

  // Try Local
  if (activeEngine !== 'demo') {
    try {
      const response = await fetchWithTimeout(`${OLLAMA_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'opencode-go/kimi-k2.6',
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          temperature: 0.3
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || data.response;
        const explanation = parseJsonExplanation(content);
        return res.json({ success: true, explanation });
      }
    } catch (e) {
      console.error('Local explanation failed:', e.message);
    }
  }

  // Fallback Gemini
  if (activeEngine !== 'demo' && activeKey) {
    try {
      const content = await callGemini([{ role: 'user', content: prompt }], null, activeKey);
      const explanation = parseJsonExplanation(content);
      return res.json({ success: true, explanation });
    } catch (e) {
      console.error('Fallback Gemini explanation failed:', e.message);
    }
  }

  // Ultimate Mock explanation
  const mockExplanation = getMockExplanation(text, language);
  return res.json({ success: true, explanation: mockExplanation });
})

function parseJsonExplanation(content) {
  try {
    const match = content.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { translation: 'N/A', pronunciation: 'N/A', vocabulary: [] };
  } catch {
    return { translation: 'Failed to parse', pronunciation: 'N/A', vocabulary: [] };
  }
}

function getMockExplanation(text, language) {
  const langCantonese = language === 'cantonese';
  return {
    translation: langCantonese ? "This is a sentence for practicing Cantonese." : "This is a sentence for practicing Mandarin.",
    pronunciation: langCantonese ? "Practice Jyutping reading" : "Practice Pinyin reading",
    vocabulary: [
      { word: text.slice(0, 2), pinyin: langCantonese ? "Word Jyutping" : "Word Pinyin", meaning: "Vocabulary meaning" }
    ],
    isMock: true
  };
}

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
        try {
          const response = await fetchWithTimeout(`${OLLAMA_URL}/v1/chat/completions`, {
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
          } else {
            ws.send(JSON.stringify({ type: 'error', error: `AI returned ${response.status}`, id: msg.id }))
          }
        } catch (err) {
          ws.send(JSON.stringify({ type: 'error', error: err.message, id: msg.id }))
        }
      }
    } catch (e) {
      console.error('WS error:', e.message)
    }
  })

  ws.on('close', () => clients.delete(ws))
})

// ===== ERROR HANDLER (must be last) =====
app.use(errorHandler)

// ===== START =====
server.listen(PORT, () => {
  console.log(`🚀 ainstructor backend running on port ${PORT}`)
  console.log(`📡 WebSocket: ws://localhost:${PORT}/ws`)
  console.log(`🤖 Ollama: ${OLLAMA_URL}`)
  console.log(`🖥️  LLM Studio: ${LLM_STUDIO_URL}`)
})
