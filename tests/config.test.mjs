import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_CONFIG, resolveConfig, validateConfig } from '../dist/index.js'

test('defaults enable native automatic compaction with a retained recent tail', () => {
  assert.equal(DEFAULT_CONFIG.auto, true)
  assert.equal(DEFAULT_CONFIG.thresholdRatio, 0.8)
  assert.equal(DEFAULT_CONFIG.headroomTokens, 65536)
  assert.equal(DEFAULT_CONFIG.retainRatio, 0.16)
  assert.doesNotThrow(() => validateConfig(DEFAULT_CONFIG))
})

test('partial configuration merges with stable defaults', () => {
  const config = resolveConfig({ auto: false, thresholdRatio: 0.7, headroomTokens: 4096 })
  assert.equal(config.auto, false)
  assert.equal(config.thresholdRatio, 0.7)
  assert.equal(config.headroomTokens, 4096)
  assert.equal(config.retainRatio, DEFAULT_CONFIG.retainRatio)
})

test('invalid retention and incomplete summary target are rejected before profile write', () => {
  assert.throws(() => validateConfig({ ...DEFAULT_CONFIG, retainRatio: 0.8 }))
  assert.throws(() => validateConfig({ ...DEFAULT_CONFIG, summarizationProvider: 'deepseek' }))
  assert.throws(() => validateConfig({ ...DEFAULT_CONFIG, maxTokens: 0 }))
  assert.throws(() => validateConfig({ ...DEFAULT_CONFIG, headroomTokens: -1 }))
})
