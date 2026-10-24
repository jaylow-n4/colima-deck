import { randomUUID } from 'node:crypto'
import type { ChildProcess } from 'node:child_process'
import type {
  ColimaAction,
  ColimaInfo,
  OperationEvent,
  OperationInfo,
  ProfileStatus,
  ProfileSummary,
  StartOptions,
  VmUsage
} from '@shared/types'
import { runColima, streamColima } from './exec'
import { VM_USAGE_SCRIPT, parseList, parseStatus, parseVersion, parseVmUsage } from './parse'

export async function getInfo(): Promise<ColimaInfo> {
  try {
    const { stdout } = await runColima(['version'], 10_000)
    return { installed: true, version: parseVersion(stdout) }
  } catch (err) {
    if ((err as { code?: unknown }).code === 'ENOENT') return { installed: false, version: '' }
    throw err
  }
}

export async function listProfiles(): Promise<ProfileSummary[]> {
  const { stdout } = await runColima(['list', '--json'])
  return parseList(stdout)
}

export async function getStatus(profile: string): Promise<ProfileStatus> {
  const { stdout } = await runColima(['status', `--profile=${profile}`, '--json'])
  return parseStatus(stdout)
}

/** VM に入って CPU 負荷・メモリ・ディスクの使用状況を取得する。VM が動作中であること。 */
export async function getVmUsage(profile: string): Promise<VmUsage> {
  const { stdout } = await runColima(
    ['ssh', `--profile=${profile}`, '--', 'sh', '-c', VM_USAGE_SCRIPT],
    20_000
  )
  return parseVmUsage(stdout)
}

/** 操作ごとの colima 引数を組み立てる。プロファイル名は検証済みであること。 */
export function buildArgs(
  action: ColimaAction,
  profile: string,
  options: StartOptions = {}
): string[] {
  const args: string[] = [action, `--profile=${profile}`]
  if (action === 'start') {
    if (options.cpu !== undefined) args.push(`--cpu=${options.cpu}`)
    if (options.memory !== undefined) args.push(`--memory=${options.memory}`)
    if (options.disk !== undefined) args.push(`--disk=${options.disk}`)
    if (options.runtime !== undefined) args.push(`--runtime=${options.runtime}`)
    if (options.vmType !== undefined) args.push(`--vm-type=${options.vmType}`)
    if (options.kubernetes) args.push('--kubernetes')
  }
  if (action === 'delete') args.push('--force')
  return args
}

interface RunningOperation extends OperationInfo {
  child: ChildProcess
}

/** 実行中の操作を管理する。同一プロファイルへの操作は同時に 1 つまで。 */
export class OperationManager {
  private readonly running = new Map<string, RunningOperation>()

  constructor(private readonly emit: (event: OperationEvent) => void) {}

  start(action: ColimaAction, profile: string, options?: StartOptions): OperationInfo {
    for (const op of this.running.values()) {
      if (op.profile === profile) {
        throw new Error(`プロファイル「${profile}」では別の操作（${op.action}）を実行中です`)
      }
    }
    const opId = randomUUID()
    const args = buildArgs(action, profile, options)
    this.emit({ opId, type: 'output', line: `$ colima ${args.join(' ')}` })
    const child = streamColima(args, {
      onLine: (line) => this.emit({ opId, type: 'output', line }),
      onExit: (code, error) => {
        this.running.delete(opId)
        this.emit({ opId, type: 'exit', code, error })
      }
    })
    const info: OperationInfo = { opId, profile, action }
    this.running.set(opId, { ...info, child })
    return info
  }

  cancel(opId: string): void {
    const op = this.running.get(opId)
    if (!op) throw new Error('指定された操作は実行中ではありません')
    op.child.kill('SIGINT')
  }

  killAll(): void {
    for (const op of this.running.values()) op.child.kill('SIGINT')
  }
}
