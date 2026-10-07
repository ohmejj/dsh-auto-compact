/** Host entry that exposes the native compaction policy to the web Settings UI. */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'
import yaml from 'js-yaml'
import { DEFAULT_CONFIG, resolveConfig, validateConfig, type AutoCompactConfig } from './config.js'
import { writeConfigToProfile } from './patch.js'

export const name = '@ohmejj/dsh-auto-compact'
export const description = '在 DSH 中自动压缩长会话上下文'
export const inject = ['webServer', 'agentPresets']

export const CONFIG_ROUTE = '/api/plugins/auto-compact/config'
export const ENTRY_ID = 'auto-compact-settings'
export const ENTRY_NAME = '@ohmejj/dsh-auto-compact'

type WebServer = {
  register(route: {
    kind: 'exact'
    path: string
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  }): () => void
}

type AgentPresets = {
  readonly defaultId: string
  readDocument(presetId: string): Promise<{ content: string }>
}

/** Register the same-origin JSON endpoint used by the browser settings section. */
export function apply(ctx: Context, userConfig?: Partial<AutoCompactConfig>): void {
  const currentConfig = resolveConfig(userConfig)
  validateConfig(currentConfig)
  const rootCtx = (ctx as { root?: Context }).root ?? ctx
  const webServer = (ctx as unknown as { webServer: WebServer }).webServer
  const disposer = webServer.register({
    kind: 'exact',
    path: CONFIG_ROUTE,
    handler: (req, res) => {
      void handleConfig(req, res, rootCtx, ctx, currentConfig)
    },
  })
  ctx.effect(() => disposer, 'auto-compact: configuration route disposal')
}

async function handleConfig(
  req: IncomingMessage,
  res: ServerResponse,
  rootCtx: Context,
  ctx: Context,
  currentConfig: AutoCompactConfig,
): Promise<void> {
  const method = req.method ?? 'GET'
  try {
    if (method === 'GET') {
      sendJson(res, 200, currentConfig)
      return
    }
    if (method !== 'POST') {
      sendJson(res, 405, { error: `method ${method} not allowed` })
      return
    }
    const body = await readJsonBody(req)
    if (body === undefined || typeof body !== 'object' || Array.isArray(body)) {
      sendJson(res, 400, { error: 'expected a JSON configuration object' })
      return
    }
    const next = resolveConfig(body as Partial<AutoCompactConfig>)
    validateConfig(next)
    const presetId = readActivePresetId(ctx)
    await writeConfigToProfile(rootCtx, presetId, next, async () => (await readActivePreset(ctx)).plugins)
    sendJson(res, 200, { ok: true, config: next })
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
  }
}

type PluginRow = { id?: unknown; config?: unknown; group?: unknown }

async function readActivePreset(ctx: Context): Promise<{ id: string; plugins: PluginRow[] }> {
  const presets = (ctx as unknown as { agentPresets: AgentPresets }).agentPresets
  const id = readActivePresetId(ctx)
  const source = await presets.readDocument(id)
  // Agent presets use Cordis' entry-list YAML dialect. In particular, their
  // platform gates are `!!js` scalar expressions, which must stay as the
  // loader's expression objects so a later save can serialize them unchanged.
  const plugins = yaml.load(source.content, { schema: entryListSchema })
  if (!Array.isArray(plugins)) throw new Error(`Agent preset ${JSON.stringify(id)} has an invalid plugin list`)
  return { id, plugins: plugins as PluginRow[] }
}

function readActivePresetId(ctx: Context): string {
  const id = (ctx as unknown as { agentPresets: AgentPresets }).agentPresets.defaultId
  if (!['standard', 'ptc', 'cordis'].includes(id)) {
    throw new Error(`auto-compact supports the shipped standard, ptc, and cordis presets; current default is ${JSON.stringify(id)}`)
  }
  return id
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk: Buffer) => {
      data += chunk.toString('utf8')
      if (data.length > 1_000_000) {
        req.destroy(new Error('payload too large'))
      }
    })
    req.once('end', () => {
      try {
        resolve(data.length === 0 ? undefined : JSON.parse(data))
      } catch (error) {
        reject(error)
      }
    })
    req.once('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

export { DEFAULT_CONFIG, resolveConfig, validateConfig, type AutoCompactConfig } from './config.js'
