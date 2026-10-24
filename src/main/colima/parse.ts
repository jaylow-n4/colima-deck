import type { ProfileStatus, ProfileSummary, VmUsage } from '@shared/types'

type Json = Record<string, unknown>

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/**
 * `colima list --json` の出力をパースする。
 * colima は 1 プロファイルにつき 1 行の JSON を出力する（JSON 配列ではない）。
 */
export function parseList(stdout: string): ProfileSummary[] {
  const profiles: ProfileSummary[] = []
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('{')) continue
    let obj: Json
    try {
      obj = JSON.parse(trimmed) as Json
    } catch {
      continue
    }
    const name = str(obj.name)
    if (!name) continue
    profiles.push({
      name,
      status: str(obj.status) || 'Unknown',
      arch: str(obj.arch),
      cpus: num(obj.cpus),
      memory: num(obj.memory),
      disk: num(obj.disk),
      runtime: str(obj.runtime),
      address: str(obj.address)
    })
  }
  return profiles
}

/** `colima status --json` の出力をパースする */
export function parseStatus(stdout: string): ProfileStatus {
  const start = stdout.indexOf('{')
  if (start < 0) throw new Error('colima status の出力を解釈できませんでした')
  const obj = JSON.parse(stdout.slice(start)) as Json
  return {
    displayName: str(obj.display_name),
    driver: str(obj.driver),
    arch: str(obj.arch),
    runtime: str(obj.runtime),
    mountType: str(obj.mount_type),
    ipAddress: str(obj.ip_address),
    dockerSocket: str(obj.docker_socket),
    containerdSocket: str(obj.containerd_socket),
    kubernetes: obj.kubernetes === true,
    cpu: num(obj.cpu),
    memory: num(obj.memory),
    disk: num(obj.disk)
  }
}

/** `colima version` の出力から 1 行目のバージョン表記を取り出す */
export function parseVersion(stdout: string): string {
  const match = stdout.match(/colima version\s+(\S+)/i)
  return match ? match[1] : (stdout.split(/\r?\n/)[0]?.trim() ?? '')
}

/** VM 内で使用状況を出力するスクリプト。セクション見出しで区切る。 */
export const VM_USAGE_SCRIPT =
  'echo "## mem"; free -b; echo "## disk"; df -B1 /; echo "## load"; cat /proc/loadavg'

/** `VM_USAGE_SCRIPT` の出力をパースする */
export function parseVmUsage(stdout: string): VmUsage {
  const sections = new Map<string, string[]>()
  let current: string[] | null = null
  for (const line of stdout.split(/\r?\n/)) {
    const heading = line.match(/^## (\w+)$/)
    if (heading) {
      current = []
      sections.set(heading[1], current)
    } else if (current && line.trim()) {
      current.push(line.trim())
    }
  }

  // free -b: "Mem: total used free shared buff/cache available"
  const mem = sections
    .get('mem')
    ?.find((l) => l.startsWith('Mem:'))
    ?.split(/\s+/)
    .slice(1)
    .map(Number)
  // df -B1 /: "Filesystem 1B-blocks Used Available Use% Mounted"。ヘッダーの次の行を読む
  const disk = sections.get('disk')?.[1]?.split(/\s+/)
  const load = sections.get('load')?.[0]?.split(/\s+/).map(Number)
  if (!mem || mem.length < 6 || !disk || disk.length < 3 || !load || load.length < 3) {
    throw new Error('VM の使用状況を解釈できませんでした')
  }
  const [memTotal, , , , , available] = mem
  return {
    memTotal,
    memUsed: Math.max(0, memTotal - available),
    diskTotal: Number(disk[1]),
    diskUsed: Number(disk[2]),
    load1: load[0],
    load5: load[1],
    load15: load[2]
  }
}
