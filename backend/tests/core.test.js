/**
 * ainstructor backend tests — run with: node --test backend/tests/
 */
import { describe, it } from './runner.js'
import assert from 'node:assert'

// ----- Test validate middleware logic -----
import { validate } from '../src/middleware/validate.js'

describe('validate middleware', () => {
  it('should call next() when all required fields present', () => {
    const mw = validate(['messages'])
    const req = { body: { messages: [{ role: 'user', content: 'hi' }] } }
    mw(req, {}, (err) => {
      assert.strictEqual(err, undefined)
    })
  })

  it('should return 400 when field missing', () => {
    const mw = validate(['messages'])
    const req = { body: {} }
    mw(req, {}, (err) => {
      assert.ok(err)
      assert.strictEqual(err.status, 400)
      assert.match(err.message, /messages/)
    })
  })

  it('should return 400 when body is not an object', () => {
    const mw = validate(['messages'])
    const req = { body: 'not-object' }
    mw(req, {}, (err) => {
      assert.ok(err)
      assert.strictEqual(err.status, 400)
    })
  })

  it('should return 400 when body is null', () => {
    const mw = validate(['messages'])
    const req = {}
    mw(req, {}, (err) => {
      assert.ok(err)
      assert.strictEqual(err.status, 400)
    })
  })

  it('should pass when no required fields specified', () => {
    const mw = validate([])
    const req = { body: { anything: 'goes' } }
    mw(req, {}, (err) => {
      assert.strictEqual(err, undefined)
    })
  })
})

// ----- Test sanitize logic -----
// Replicate the sanitize function from server.js for isolated testing
function sanitize(str) {
  if (typeof str !== 'string') return ''
  return str.replace(/[\n\r]+/g, ' ').replace(/["\{\}]/g, '').slice(0, 500)
}

describe('sanitize', () => {
  it('should strip newlines and special chars', () => {
    const result = sanitize('hello\nworld{test}"quote"')
    assert.strictEqual(result, 'hello worldtestquote')
  })

  it('should truncate to 500 chars', () => {
    const long = 'a'.repeat(1000)
    assert.strictEqual(sanitize(long).length, 500)
  })

  it('should return empty string for non-string input', () => {
    assert.strictEqual(sanitize(null), '')
    assert.strictEqual(sanitize(123), '')
  })
})

// ----- Test data helpers -----
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function readData(file) {
  try {
    const raw = await fs.readFile(path.join(__dirname, '..', 'data', file), 'utf8')
    return JSON.parse(raw)
  } catch { return [] }
}

async function writeData(file, data) {
  await fs.writeFile(path.join(__dirname, '..', 'data', file), JSON.stringify(data, null, 2))
}

describe('data helpers', () => {
  it('should return [] for non-existent file', async () => {
    const result = await readData('nonexistent-test.json')
    assert.deepStrictEqual(result, [])
  })

  it('should write and read back', async () => {
    const testData = [{ id: '1', text: 'hello' }]
    await writeData('test-write.json', testData)
    const result = await readData('test-write.json')
    assert.deepStrictEqual(result, testData)
    // cleanup
    await fs.unlink(path.join(__dirname, '..', 'data', 'test-write.json'))
  })
})

// ----- Test errorHandler -----
import { errorHandler } from '../src/middleware/errorHandler.js'

describe('errorHandler', () => {
  it('should return 500 for unexposed errors', () => {
    const err = new Error('secret')
    const res = {
      statusCode: null,
      status(code) { this.statusCode = code; return this },
      json(body) { this.body = body }
    }
    errorHandler(err, { method: 'GET', path: '/test' }, res, () => {})
    assert.strictEqual(res.statusCode, 500)
    assert.strictEqual(res.body.error, 'Internal Server Error')
  })

  it('should return exposed errors with status', () => {
    const err = new Error('Bad input')
    err.status = 400
    err.expose = true
    const res = {
      statusCode: null,
      status(code) { this.statusCode = code; return this },
      json(body) { this.body = body }
    }
    errorHandler(err, { method: 'POST', path: '/api/chat' }, res, () => {})
    assert.strictEqual(res.statusCode, 400)
    assert.strictEqual(res.body.error, 'Bad input')
  })
})
