const GIB = 1024 ** 3

/** バイト数を GiB 表記にする */
export function formatGiB(bytes: number): string {
  if (!bytes) return '—'
  const gib = bytes / GIB
  return `${Number.isInteger(gib) ? gib : gib.toFixed(1)} GiB`
}

/** バイト数を GB / MB などの読みやすい単位にする（ディスク・メモリの使用量用） */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`
}

export type StatusTone = 'running' | 'stopped' | 'busy' | 'error'

export function statusTone(status: string): StatusTone {
  const s = status.toLowerCase()
  if (s === 'running') return 'running'
  if (s === 'stopped') return 'stopped'
  if (s === 'broken' || s === 'unknown') return 'error'
  return 'busy'
}

export const ACTION_LABELS = {
  start: '起動',
  stop: '停止',
  restart: '再起動',
  delete: '削除'
} as const

/** docker のコンテナ状態（running / exited など）を表示用の色に対応づける */
export function containerTone(state: string): StatusTone {
  switch (state.toLowerCase()) {
    case 'running':
      return 'running'
    case 'paused':
    case 'restarting':
    case 'created':
      return 'busy'
    case 'dead':
      return 'error'
    default:
      return 'stopped'
  }
}

/** compose プロジェクト全体の状態: 全部動作中 / 一部動作中 / 停止 */
export function projectTone(running: number, total: number): StatusTone {
  if (total > 0 && running === total) return 'running'
  return running > 0 ? 'busy' : 'stopped'
}
