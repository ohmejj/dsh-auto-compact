/** Profile-patch persistence for the native compaction provider row. */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'
import yaml from 'js-yaml'
import { writeFileAtomic, withFileLock } from '@deepseek-ai/dsh-atomic-write'
import { loadProfileDirectory, readProfilePatches, reconcileProfilePatches } from '@deepseek-ai/dsh-app-boot'
import type { AutoCompactConfig } from './config.js'

const SETTINGS_ENTRY_ID = 'auto-compact-settings'
const SETTINGS_ENTRY_NAME = '@ohmejj/dsh-auto-compact'
/** The shipped Web preset declaration rows use this stable id convention. */
function presetRowId(presetId: string): string {
  return `preset-${presetId}`
}

function presetOrder(presetId: string): number {
  return ({ standard: 1, ptc: 2, cordis: 3 } as Record<string, number>)[presetId]!
}

/** Persist one full provider configuration and reconcile the running profile. */
export async function writeConfigToProfile(
  rootCtx: any,
  presetId: string,
  config: AutoCompactConfig,
  loadDefaultPlugins: () => Promise<unknown[]>,
): Promise<void> {
  const profile = rootCtx.get?.('profileContext') ?? rootCtx.profileContext
  if (profile === undefined) throw new Error('auto-compact can only save from a DSH profile')
  const patchPath = profile.patchPath
  const write = async (): Promise<void> => {
    await withFileLock(join(profile.dir, 'package.json'), async () => {
      const beforePatches = readProfilePatches('dsh', profile)
      await reconcileProfilePatches(rootCtx, beforePatches, 'dsh')
      let before: string
      try {
        before = await readFile(patchPath, 'utf8')
      } catch (error: any) {
        if (error.code !== 'ENOENT') throw error
        before = '[]\n'
      }
      const document = yaml.load(before, { schema: entryListSchema })
      if (!Array.isArray(document)) throw new Error('Profile patch must be a YAML sequence')
      const entryId = presetRowId(presetId)
      const index = document.findLastIndex((item: any) => (
        item !== null
        && typeof item === 'object'
        && item.id === entryId
        && item.insert === undefined
      ))
      const existingConfig = index < 0 ? undefined : document[index].config
      const existingPlugins = existingConfig !== null
        && typeof existingConfig === 'object'
        && Array.isArray((existingConfig as { plugins?: unknown }).plugins)
        ? (existingConfig as { plugins: unknown[] }).plugins
        : undefined
      // After the first save we modify the already-persisted preset declaration
      // directly. This avoids depending on a registry definition while its
      // enclosing preset row is being reconciled.
      const plugins = setCompactionConfig(existingPlugins ?? await loadDefaultPlugins(), config)
      if (index < 0) {
        document.push({ id: entryId, config: { id: presetId, order: presetOrder(presetId), plugins } })
      } else {
        document[index].config = {
          id: presetId,
          order: presetOrder(presetId),
          ...(existingConfig as object),
          plugins,
        }
      }
      const settingsIndex = document.findLastIndex((item: any) => (
        item !== null
        && typeof item === 'object'
        && item.id === SETTINGS_ENTRY_ID
        && item.insert === undefined
      ))
      if (settingsIndex < 0) {
        document.push({ id: SETTINGS_ENTRY_ID, name: SETTINGS_ENTRY_NAME, config })
      } else {
        document[settingsIndex].name ??= SETTINGS_ENTRY_NAME
        document[settingsIndex].config = config
      }
      const next = yaml.dump(document, { schema: entryListSchema, noRefs: true, lineWidth: -1 })
      const patches = readProfilePatches('dsh', profile, {
        ...loadProfileDirectory('dsh', profile.dir, profile.installAnchor),
        patches: document as any,
      })
      await writeFileAtomic(patchPath, next, { mode: 384 })
      try {
        await reconcileProfilePatches(rootCtx, patches, 'dsh', [entryId, SETTINGS_ENTRY_ID])
      } catch (error) {
        await writeFileAtomic(patchPath, before, { mode: 384 })
        await reconcileProfilePatches(rootCtx, beforePatches, 'dsh')
        throw error
      }
    })
  }
  const hmr = rootCtx.get?.('hmr')
  await (hmr === undefined ? write() : hmr.runExclusive(write))
}

/** Replace just the nested native compaction row without affecting other plugins. */
function setCompactionConfig(plugins: unknown[], config: AutoCompactConfig): unknown[] {
  const next = structuredClone(plugins) as Array<{ id?: unknown; group?: unknown; config?: unknown }>
  const group = next.find((row) => row.id === 'compaction' && row.group === true)
  if (group === undefined || !Array.isArray(group.config)) {
    throw new Error('the current Agent preset has no native compaction group')
  }
  const row = (group.config as Array<{ id?: unknown; config?: unknown }>).find((item) => item.id === 'compaction-basic')
  if (row === undefined) throw new Error('the current Agent preset has no native compaction-basic plugin')
  row.config = config
  return next
}
