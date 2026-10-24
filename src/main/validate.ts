import {
  CONTAINER_ACTIONS,
  RUNTIMES,
  VM_TYPES,
  type ColimaAction,
  type ConfigValues,
  type ContainerAction,
  type ContainerTarget,
  type ResourceTarget,
  type StartOptions
} from '@shared/types'

const PROFILE_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/
const ACTIONS: readonly ColimaAction[] = ['start', 'stop', 'restart', 'delete']

export function assertProfileName(value: unknown): string {
  if (typeof value !== 'string' || !PROFILE_NAME.test(value)) {
    throw new Error(
      'プロファイル名は英数字で始め、英数字・-・_ のみで指定してください（1〜64 文字）'
    )
  }
  return value
}

export function assertAction(value: unknown): ColimaAction {
  if (typeof value !== 'string' || !ACTIONS.includes(value as ColimaAction)) {
    throw new Error(`不正な操作です: ${String(value)}`)
  }
  return value as ColimaAction
}

function assertInt(value: unknown, name: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} は ${min}〜${max} の整数で指定してください`)
  }
  return value
}

function assertOneOf(value: unknown, name: string, allowed: readonly string[]): string {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new Error(`${name} は ${allowed.join(' / ')} のいずれかを指定してください`)
  }
  return value
}

export function assertStartOptions(value: unknown): StartOptions {
  if (value === undefined || value === null) return {}
  if (typeof value !== 'object') throw new Error('起動オプションが不正です')
  const v = value as Record<string, unknown>
  const options: StartOptions = {}
  if (v.cpu !== undefined) options.cpu = assertInt(v.cpu, 'CPU', 1, 256)
  if (v.memory !== undefined) options.memory = assertInt(v.memory, 'メモリ', 1, 1024)
  if (v.disk !== undefined) options.disk = assertInt(v.disk, 'ディスク', 1, 16384)
  if (v.runtime !== undefined) options.runtime = assertOneOf(v.runtime, 'runtime', RUNTIMES)
  if (v.vmType !== undefined) options.vmType = assertOneOf(v.vmType, 'VM タイプ', VM_TYPES)
  if (v.kubernetes !== undefined) {
    if (typeof v.kubernetes !== 'boolean')
      throw new Error('kubernetes は true / false で指定してください')
    options.kubernetes = v.kubernetes
  }
  return options
}

export function assertConfigValues(value: unknown): ConfigValues {
  if (typeof value !== 'object' || value === null) throw new Error('設定値が不正です')
  const v = value as Record<string, unknown>
  if (typeof v.kubernetes !== 'boolean')
    throw new Error('kubernetes は true / false で指定してください')
  return {
    cpu: assertInt(v.cpu, 'CPU', 1, 256),
    memory: assertInt(v.memory, 'メモリ', 1, 1024),
    disk: assertInt(v.disk, 'ディスク', 1, 16384),
    runtime: assertOneOf(v.runtime, 'runtime', RUNTIMES),
    vmType: assertOneOf(v.vmType, 'VM タイプ', VM_TYPES),
    kubernetes: v.kubernetes
  }
}

export function assertString(value: unknown, name: string, maxLength = 1_000_000): string {
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new Error(`${name} が不正です`)
  }
  return value
}

const CONTAINER_ID = /^[a-f0-9]{12,64}$/
// compose のプロジェクト名（先頭が - だとオプションと解釈されるため英数字で始める）
const PROJECT_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/

export function assertContainerAction(value: unknown): ContainerAction {
  if (typeof value !== 'string' || !CONTAINER_ACTIONS.includes(value as ContainerAction)) {
    throw new Error(`不正な操作です: ${String(value)}`)
  }
  return value as ContainerAction
}

export function assertContainerTarget(value: unknown): ContainerTarget {
  if (typeof value !== 'object' || value === null) throw new Error('操作対象が不正です')
  const v = value as Record<string, unknown>
  if (v.type === 'container') {
    if (typeof v.id !== 'string' || !CONTAINER_ID.test(v.id)) {
      throw new Error('コンテナ ID が不正です')
    }
    return { type: 'container', id: v.id }
  }
  if (v.type === 'project') {
    if (typeof v.name !== 'string' || !PROJECT_NAME.test(v.name)) {
      throw new Error('compose プロジェクト名が不正です')
    }
    return { type: 'project', name: v.name }
  }
  throw new Error('操作対象が不正です')
}

const VOLUME_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,254}$/

// イメージ参照（registry:port/repo:tag や repo@sha256:... を含む）。先頭が - だとオプションと解釈される。
const IMAGE_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9_.\-/:@]{0,254}$/

export function assertResourceTarget(value: unknown): ResourceTarget {
  if (typeof value !== 'object' || value === null) throw new Error('操作対象が不正です')
  const v = value as Record<string, unknown>
  if (v.type === 'volume') {
    if (typeof v.name !== 'string' || !VOLUME_NAME.test(v.name)) {
      throw new Error('ボリューム名が不正です')
    }
    return { type: 'volume', name: v.name }
  }
  if (v.type === 'network') {
    if (typeof v.id !== 'string' || !CONTAINER_ID.test(v.id)) {
      throw new Error('ネットワーク ID が不正です')
    }
    return { type: 'network', id: v.id }
  }
  if (v.type === 'image') {
    if (typeof v.reference !== 'string' || !IMAGE_REFERENCE.test(v.reference)) {
      throw new Error('イメージの指定が不正です')
    }
    return { type: 'image', reference: v.reference }
  }
  throw new Error('操作対象が不正です')
}
