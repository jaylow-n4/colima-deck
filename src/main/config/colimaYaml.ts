import { existsSync } from 'node:fs'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parseDocument, isMap, type Document } from 'yaml'
import type { ConfigFile, ConfigValues } from '@shared/types'

/** colima と同じ規則で設定ディレクトリを決める */
export function colimaHome(env: NodeJS.ProcessEnv = process.env, home = homedir()): string {
  if (env.COLIMA_HOME) return env.COLIMA_HOME
  const legacy = join(home, '.colima')
  if (existsSync(legacy)) return legacy
  if (env.XDG_CONFIG_HOME) return join(env.XDG_CONFIG_HOME, 'colima')
  return legacy
}

/** プロファイル名は検証済みであること */
export function configPath(profile: string): string {
  return join(colimaHome(), profile, 'colima.yaml')
}

function parse(raw: string): Document {
  const doc = parseDocument(raw)
  if (doc.errors.length > 0) {
    throw new Error(`YAML の構文エラー: ${doc.errors[0].message}`)
  }
  if (doc.contents !== null && !isMap(doc.contents)) {
    throw new Error('colima.yaml の最上位はマッピングである必要があります')
  }
  return doc
}

export function extractValues(raw: string): ConfigValues {
  const doc = parse(raw)
  const num = (key: string): number => {
    const v = doc.get(key)
    return typeof v === 'number' ? v : Number(v) || 0
  }
  const text = (key: string): string => {
    const v = doc.get(key)
    return typeof v === 'string' ? v : ''
  }
  return {
    cpu: num('cpu'),
    memory: num('memory'),
    disk: num('disk'),
    runtime: text('runtime'),
    vmType: text('vmType'),
    kubernetes: doc.getIn(['kubernetes', 'enabled']) === true
  }
}

/** コメントや他の項目を保ったまま、フォームの値だけを書き換える */
export function applyValues(raw: string, values: ConfigValues): string {
  const doc = parse(raw)
  doc.set('cpu', values.cpu)
  doc.set('memory', values.memory)
  doc.set('disk', values.disk)
  doc.set('runtime', values.runtime)
  doc.set('vmType', values.vmType)
  doc.setIn(['kubernetes', 'enabled'], values.kubernetes)
  return doc.toString()
}

export async function readConfig(profile: string): Promise<ConfigFile> {
  const path = configPath(profile)
  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { path, exists: false, raw: '', values: null }
    }
    throw err
  }
  let values: ConfigValues | null = null
  try {
    values = extractValues(raw)
  } catch {
    // 手で壊れた YAML でも、生テキストの編集はできるようにする
  }
  return { path, exists: true, raw, values }
}

async function writeAtomic(path: string, content: string): Promise<void> {
  const tmp = `${path}.colima-deck.tmp`
  await writeFile(tmp, content, 'utf8')
  await rename(tmp, path)
}

export async function writeConfig(profile: string, values: ConfigValues): Promise<ConfigFile> {
  const current = await readConfig(profile)
  if (!current.exists) throw new Error(`設定ファイルがありません: ${current.path}`)
  await writeAtomic(current.path, applyValues(current.raw, values))
  return readConfig(profile)
}

export async function writeRawConfig(profile: string, raw: string): Promise<ConfigFile> {
  const path = configPath(profile)
  if (!existsSync(path)) throw new Error(`設定ファイルがありません: ${path}`)
  parse(raw) // 構文エラーがあれば書き込まない
  await writeAtomic(path, raw)
  return readConfig(profile)
}
