/** Configuration accepted by the auto-compaction Settings page. */
export interface AutoCompactConfig {
  auto: boolean
  thresholdRatio: number
  headroomTokens: number
  retainRatio: number
  summarizationProvider: string
  summarizationModel: string
  maxTokens: number
  compactionRetries: number
  maxOverflowRetries: number
}

/** Conservative defaults for the native compaction provider. */
export const DEFAULT_CONFIG: Readonly<AutoCompactConfig> = Object.freeze({
  auto: true,
  thresholdRatio: 0.8,
  headroomTokens: 65536,
  retainRatio: 0.16,
  summarizationProvider: '',
  summarizationModel: '',
  maxTokens: 8192,
  compactionRetries: 1,
  maxOverflowRetries: 1,
})

/** Merge a partial runtime configuration with the stable UI defaults. */
export function resolveConfig(config: Partial<AutoCompactConfig> | undefined): AutoCompactConfig {
  return {
    auto: config?.auto ?? DEFAULT_CONFIG.auto,
    thresholdRatio: config?.thresholdRatio ?? DEFAULT_CONFIG.thresholdRatio,
    headroomTokens: config?.headroomTokens ?? DEFAULT_CONFIG.headroomTokens,
    retainRatio: config?.retainRatio ?? DEFAULT_CONFIG.retainRatio,
    summarizationProvider: config?.summarizationProvider ?? DEFAULT_CONFIG.summarizationProvider,
    summarizationModel: config?.summarizationModel ?? DEFAULT_CONFIG.summarizationModel,
    maxTokens: config?.maxTokens ?? DEFAULT_CONFIG.maxTokens,
    compactionRetries: config?.compactionRetries ?? DEFAULT_CONFIG.compactionRetries,
    maxOverflowRetries: config?.maxOverflowRetries ?? DEFAULT_CONFIG.maxOverflowRetries,
  }
}

/** Validate inputs before they are committed to the DSH profile patch. */
export function validateConfig(config: AutoCompactConfig): void {
  if (typeof config.auto !== 'boolean') throw new Error('auto must be a boolean')
  assertRatio('thresholdRatio', config.thresholdRatio)
  assertNonNegativeInteger('headroomTokens', config.headroomTokens)
  assertRatio('retainRatio', config.retainRatio)
  if (config.retainRatio >= config.thresholdRatio) {
    throw new Error('retainRatio must be lower than thresholdRatio')
  }
  assertPositiveInteger('maxTokens', config.maxTokens)
  assertNonNegativeInteger('compactionRetries', config.compactionRetries)
  assertNonNegativeInteger('maxOverflowRetries', config.maxOverflowRetries)
  if (typeof config.summarizationProvider !== 'string' || typeof config.summarizationModel !== 'string') {
    throw new Error('summarizationProvider and summarizationModel must be strings')
  }
  if ((config.summarizationProvider.length === 0) !== (config.summarizationModel.length === 0)) {
    throw new Error('summarizationProvider and summarizationModel must both be blank or both be set')
  }
}

function assertRatio(name: string, value: unknown): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1) {
    throw new Error(`${name} must be a number in (0, 1]`)
  }
}

function assertPositiveInteger(name: string, value: unknown): void {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }
}

function assertNonNegativeInteger(name: string, value: unknown): void {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`${name} must be a non-negative integer`)
  }
}
