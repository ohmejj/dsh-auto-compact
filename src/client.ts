/** Browser settings section for @ohmejj/dsh-auto-compact. */
declare const window: any
declare const document: any
declare const fetch: (input: string, init?: unknown) => Promise<any>

interface CompactConfig {
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

const DEFAULT_CONFIG: CompactConfig = {
  auto: true,
  thresholdRatio: 0.8,
  headroomTokens: 65536,
  retainRatio: 0.16,
  summarizationProvider: '',
  summarizationModel: '',
  maxTokens: 8192,
  compactionRetries: 1,
  maxOverflowRetries: 1,
}

function factory(requireFn: (id: string) => any): Record<string, unknown> {
  const React = requireFn('react')
  const module = { exports: {} as Record<string, unknown> }
  const route = '/api/plugins/auto-compact/config'
  const url = (): string => (window?.location?.origin ?? '') + route

  const css = [
    '.dsacompact{max-width:680px;padding-bottom:28px;color:var(--dsw-alias-label-primary)}',
    '.dsacompact h2{font-size:16px;line-height:24px;margin:0 0 6px}',
    '.dsacompact p{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5;margin:0 0 14px}',
    '.dsacompact-card{background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:4px 16px 14px}',
    '.dsacompact-field{border-top:1px solid var(--dsw-alias-border-l2);display:flex;flex-direction:column;gap:6px;padding:12px 0}',
    '.dsacompact-field:first-child{border-top:0}',
    '.dsacompact-label{font-size:13px;font-weight:500}',
    '.dsacompact-hint{font-size:12px!important;margin:0!important}',
    '.dsacompact-input{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);font:inherit;height:34px;padding:0 10px}',
    '.dsacompact-row{display:flex;gap:10px}.dsacompact-row>*{flex:1;min-width:0}',
    '.dsacompact-actions{display:flex;justify-content:flex-end;align-items:center;gap:8px;padding-top:12px}',
    '.dsacompact-button{border:1px solid var(--dsw-alias-border-l2);background:transparent;border-radius:8px;color:var(--dsw-alias-label-primary);cursor:pointer;font:inherit;padding:5px 14px}',
    '.dsacompact-primary{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}',
    '.dsacompact-button:disabled{cursor:default;opacity:.45}',
    '.dsacompact-status{flex:1;margin:0!important}.dsacompact-error{color:var(--dsw-alias-label-error)!important}',
  ].join('')
  if (document.querySelector('style[data-auto-compact]') === null) {
    const style = document.createElement('style')
    style.dataset.autoCompact = 'true'
    style.textContent = css
    document.head.appendChild(style)
  }

  function number(value: string): number | undefined {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  function toDraft(config: CompactConfig): Record<string, string> {
    return {
      thresholdPercent: String(config.thresholdRatio * 100),
      headroomTokens: String(config.headroomTokens),
      retainPercent: String(config.retainRatio * 100),
      summarizationProvider: config.summarizationProvider,
      summarizationModel: config.summarizationModel,
      maxTokens: String(config.maxTokens),
      compactionRetries: String(config.compactionRetries),
      maxOverflowRetries: String(config.maxOverflowRetries),
    }
  }

  function fromDraft(auto: boolean, draft: Record<string, string>): CompactConfig | undefined {
    const threshold = number(draft.thresholdPercent)
    const retain = number(draft.retainPercent)
    const headroomTokens = number(draft.headroomTokens)
    const maxTokens = number(draft.maxTokens)
    const retries = number(draft.compactionRetries)
    const overflowRetries = number(draft.maxOverflowRetries)
    if (threshold === undefined || retain === undefined || headroomTokens === undefined || maxTokens === undefined || retries === undefined || overflowRetries === undefined) return undefined
    const provider = draft.summarizationProvider.trim()
    const model = draft.summarizationModel.trim()
    if (threshold <= 0 || threshold > 100 || retain <= 0 || retain >= threshold || !Number.isInteger(headroomTokens) || headroomTokens < 0 || !Number.isInteger(maxTokens) || maxTokens < 1 || !Number.isInteger(retries) || retries < 0 || !Number.isInteger(overflowRetries) || overflowRetries < 0 || (provider.length === 0) !== (model.length === 0)) return undefined
    return { auto, thresholdRatio: threshold / 100, headroomTokens, retainRatio: retain / 100, summarizationProvider: provider, summarizationModel: model, maxTokens, compactionRetries: retries, maxOverflowRetries: overflowRetries }
  }

  function Field(props: { label: string; hint: string; value: string; onChange: (value: string) => void; disabled: boolean; type?: string }) {
    return React.createElement('label', { className: 'dsacompact-field' },
      React.createElement('span', { className: 'dsacompact-label' }, props.label),
      React.createElement('input', { className: 'dsacompact-input', type: props.type ?? 'text', value: props.value, disabled: props.disabled, onChange: (event: { target: { value: string } }) => props.onChange(event.target.value) }),
      React.createElement('span', { className: 'dsacompact-hint' }, props.hint),
    )
  }

  function AutoCompactSection() {
    const [config, setConfig] = React.useState(DEFAULT_CONFIG as CompactConfig)
    const [draft, setDraft] = React.useState(toDraft(DEFAULT_CONFIG))
    const [loading, setLoading] = React.useState(true)
    const [saving, setSaving] = React.useState(false)
    const [message, setMessage] = React.useState(null as string | null)
    React.useEffect(() => {
      void fetch(url(), { headers: { Accept: 'application/json' } }).then(async (response: any) => {
        if (!response.ok) throw new Error('load failed')
        const next = await response.json() as CompactConfig
        setConfig(next)
        setDraft(toDraft(next))
      }).catch(() => setMessage('无法读取压缩配置。请确认插件已在 Host 端加载。')).finally(() => setLoading(false))
    }, [])
    const next = fromDraft(config.auto, draft)
    const update = (field: string, value: string): void => setDraft({ ...draft, [field]: value })
    const save = (): void => {
      if (next === undefined || saving) return
      setSaving(true)
      setMessage(null)
      void fetch(url(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) }).then(async (response: any) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error ?? 'save failed')
        setConfig(next)
        setDraft(toDraft(next))
        setMessage('已保存。新建会话会在下一次 Agent 步骤检查时使用此策略；已有会话保留创建时的 preset。')
      }).catch((error: Error) => setMessage(`保存失败：${error.message}`)).finally(() => setSaving(false))
    }
    const disabled = loading || saving
    return React.createElement('div', { className: 'dsacompact' },
      React.createElement('h2', null, '自动上下文压缩'),
      React.createElement('p', null, '调用 DSH 内置压缩引擎：当上下文接近窗口上限时，将较早的对话压缩为可回放摘要，并保留最近上下文。'),
      React.createElement('div', { className: 'dsacompact-card' },
        React.createElement('label', { className: 'dsacompact-field' },
          React.createElement('span', { className: 'dsacompact-label' }, '启用自动压缩'),
          React.createElement('input', { type: 'checkbox', checked: config.auto, disabled, onChange: (event: { target: { checked: boolean } }) => setConfig({ ...config, auto: event.target.checked }) }),
          React.createElement('span', { className: 'dsacompact-hint' }, '关闭后不再在 Agent 步骤间自动压缩；DSH 原生 /compact 命令仍可独立使用。'),
        ),
        React.createElement('div', { className: 'dsacompact-field' },
          React.createElement('span', { className: 'dsacompact-label' }, '上下文预算'),
          React.createElement('div', { className: 'dsacompact-row' },
            React.createElement(Field, { label: '触发阈值（%）', hint: '达到模型上下文窗口的该比例时开始压缩。', value: draft.thresholdPercent, disabled, onChange: (value: string) => update('thresholdPercent', value), type: 'number' }),
            React.createElement(Field, { label: '保留近期（%）', hint: '压缩后仍原样保留的近期上下文比例。', value: draft.retainPercent, disabled, onChange: (value: string) => update('retainPercent', value), type: 'number' }),
            React.createElement(Field, { label: '额外安全余量（Token）', hint: '为模型输出与压缩本身预留的额外空间。', value: draft.headroomTokens, disabled, onChange: (value: string) => update('headroomTokens', value), type: 'number' }),
          ),
        ),
        React.createElement('div', { className: 'dsacompact-row' },
          React.createElement(Field, { label: '摘要 Provider（可选）', hint: '留空时复用当前对话模型。', value: draft.summarizationProvider, disabled, onChange: (value: string) => update('summarizationProvider', value) }),
          React.createElement(Field, { label: '摘要模型（可选）', hint: 'Provider 与模型须同时填写或同时留空。', value: draft.summarizationModel, disabled, onChange: (value: string) => update('summarizationModel', value) }),
        ),
        React.createElement('div', { className: 'dsacompact-row' },
          React.createElement(Field, { label: '摘要最大输出 Token', hint: '默认 8192。', value: draft.maxTokens, disabled, onChange: (value: string) => update('maxTokens', value), type: 'number' }),
          React.createElement(Field, { label: '普通重试次数', hint: '压缩后仍超阈值时的额外尝试。', value: draft.compactionRetries, disabled, onChange: (value: string) => update('compactionRetries', value), type: 'number' }),
          React.createElement(Field, { label: '溢出恢复次数', hint: '模型报告上下文溢出后的恢复尝试。', value: draft.maxOverflowRetries, disabled, onChange: (value: string) => update('maxOverflowRetries', value), type: 'number' }),
        ),
        React.createElement('div', { className: 'dsacompact-actions' },
          message !== null ? React.createElement('p', { className: message.startsWith('保存失败') || message.startsWith('无法') ? 'dsacompact-status dsacompact-error' : 'dsacompact-status', role: 'status' }, message) : null,
          React.createElement('button', { className: 'dsacompact-button', disabled, onClick: () => { setDraft(toDraft(config)); setMessage(null) } }, '放弃'),
          React.createElement('button', { className: 'dsacompact-button dsacompact-primary', disabled: disabled || next === undefined, onClick: save }, saving ? '保存中…' : '保存'),
        ),
      ),
    )
  }

  const inject = ['slots']
  function apply(ctx: { slots: any }): void {
    ctx.slots.inject('settings.section', () => ctx.slots.register({
      name: 'settings.section',
      id: 'auto-compact',
      order: 31,
      label: () => '自动上下文压缩',
      inject: () => ({}),
    }, AutoCompactSection))
  }
  module.exports.apply = apply
  module.exports.inject = inject
  return module.exports
}

window.__ModuleLoader__.load({ id: '@ohmejj/dsh-auto-compact', factory })
