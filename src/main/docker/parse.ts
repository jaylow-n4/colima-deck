import type {
  ComposeProject,
  ComposeService,
  ContainerSummary,
  ImageSummary,
  NetworkSubnet,
  NetworkSummary,
  VolumeSummary
} from '@shared/types'

type Json = Record<string, unknown>

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** compose のラベルのうち、ps の出力に含めるもの */
const LABEL_PROJECT = 'com.docker.compose.project'
const LABEL_SERVICE = 'com.docker.compose.service'
const LABEL_WORKING_DIR = 'com.docker.compose.project.working_dir'
const LABEL_CONFIG_FILES = 'com.docker.compose.project.config_files'

/**
 * `docker ps -a` に渡す `--format`。
 * Labels 全体は devcontainer などで巨大になるため、必要なラベルだけを取り出す。
 */
export const PS_FORMAT = `{"id":{{json .ID}},"name":{{json .Names}},"image":{{json .Image}},"state":{{json .State}},"status":{{json .Status}},"ports":{{json .Ports}},"networks":{{json .Networks}},"project":{{json (.Label "${LABEL_PROJECT}")}},"service":{{json (.Label "${LABEL_SERVICE}")}},"workingDir":{{json (.Label "${LABEL_WORKING_DIR}")}},"configFiles":{{json (.Label "${LABEL_CONFIG_FILES}")}}}`

/** 1 行 1 JSON の出力を行ごとにパースする。JSON 以外の行や壊れた行は無視する。 */
function parseJsonLines(stdout: string): Json[] {
  const rows: Json[] = []
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('{')) continue
    try {
      rows.push(JSON.parse(trimmed) as Json)
    } catch {
      continue
    }
  }
  return rows
}

/** `docker ps -a --format PS_FORMAT` の出力から、コンテナ一覧と compose プロジェクトを作る */
export function parseContainers(stdout: string): {
  containers: ContainerSummary[]
  projects: ComposeProject[]
} {
  const containers: ContainerSummary[] = []
  const projects = new Map<string, ComposeProject>()

  for (const obj of parseJsonLines(stdout)) {
    const container: ContainerSummary = {
      id: str(obj.id).slice(0, 12),
      name: str(obj.name),
      image: str(obj.image),
      state: str(obj.state) || 'unknown',
      status: str(obj.status),
      ports: str(obj.ports),
      networks: str(obj.networks).split(',').filter(Boolean),
      project: str(obj.project),
      service: str(obj.service)
    }
    containers.push(container)
    if (!container.project) continue

    let project = projects.get(container.project)
    if (!project) {
      project = {
        name: container.project,
        workingDir: str(obj.workingDir),
        configFiles: str(obj.configFiles).split(',').filter(Boolean),
        services: [],
        running: 0,
        total: 0
      }
      projects.set(container.project, project)
    }
    let service: ComposeService | undefined = project.services.find(
      (s) => s.service === container.service
    )
    if (!service) {
      service = { service: container.service, containers: [] }
      project.services.push(service)
    }
    service.containers.push(container)
    project.total += 1
    if (container.state === 'running') project.running += 1
  }

  const sorted = [...projects.values()].sort((a, b) => a.name.localeCompare(b.name))
  for (const project of sorted) {
    project.services.sort((a, b) => a.service.localeCompare(b.service))
  }
  return { containers, projects: sorted }
}

/** `docker images --format '{{json .}}'` の出力をパースする */
export function parseImages(stdout: string): ImageSummary[] {
  return parseJsonLines(stdout).map((obj) => {
    const count = Number.parseInt(str(obj.Containers), 10)
    const id = str(obj.ID)
      .replace(/^sha256:/, '')
      .slice(0, 12)
    const repository = str(obj.Repository)
    const tag = str(obj.Tag)
    // タグ付きなら参照で消す（同じイメージの他のタグを巻き込まない）。タグがなければ ID で消す。
    const tagged = !['', '<none>'].includes(repository) && !['', '<none>'].includes(tag)
    return {
      id,
      reference: tagged ? `${repository}:${tag}` : id,
      repository,
      tag,
      size: str(obj.Size),
      created: str(obj.CreatedSince),
      containers: Number.isNaN(count) ? null : count
    }
  })
}

/** `docker volume ls` に渡す `--format` */
export const VOLUME_FORMAT = `{"name":{{json .Name}},"driver":{{json .Driver}},"project":{{json (.Label "${LABEL_PROJECT}")}}}`

/** `docker network ls` に渡す `--format` */
export const NETWORK_FORMAT = `{"id":{{json .ID}},"name":{{json .Name}},"driver":{{json .Driver}},"scope":{{json .Scope}},"internal":{{json .Internal}},"project":{{json (.Label "${LABEL_PROJECT}")}}}`

/**
 * ボリューム一覧をパースする。
 * @param unusedStdout `docker volume ls --filter dangling=true -q`（どのコンテナからも参照されていないもの）
 */
export function parseVolumes(stdout: string, unusedStdout: string): VolumeSummary[] {
  const unused = new Set(unusedStdout.split(/\s+/).filter(Boolean))
  return parseJsonLines(stdout).map((obj) => ({
    name: str(obj.name),
    driver: str(obj.driver),
    project: str(obj.project),
    inUse: !unused.has(str(obj.name))
  }))
}

/** `docker network inspect --format NETWORK_INSPECT_FORMAT` の出力から、ID ごとのサブネットを読む */
export const NETWORK_INSPECT_FORMAT = '{"id":{{json .ID}},"ipam":{{json .IPAM.Config}}}'

export function parseNetworkSubnets(stdout: string): Map<string, NetworkSubnet[]> {
  const subnets = new Map<string, NetworkSubnet[]>()
  for (const obj of parseJsonLines(stdout)) {
    const configs = Array.isArray(obj.ipam) ? (obj.ipam as Json[]) : []
    subnets.set(
      str(obj.id),
      configs.map((c) => ({ cidr: str(c.Subnet), gateway: str(c.Gateway) })).filter((s) => s.cidr)
    )
  }
  return subnets
}

const BUILTIN_NETWORKS = ['bridge', 'host', 'none']

/** ネットワーク一覧をパースする。接続数はコンテナの `networks` から数える。 */
export function parseNetworks(
  stdout: string,
  containers: ContainerSummary[],
  subnets: Map<string, NetworkSubnet[]> = new Map()
): NetworkSummary[] {
  return parseJsonLines(stdout).map((obj) => {
    const name = str(obj.name)
    return {
      id: str(obj.id),
      name,
      driver: str(obj.driver),
      scope: str(obj.scope),
      subnets: subnets.get(str(obj.id)) ?? [],
      internal: str(obj.internal) === 'true',
      project: str(obj.project),
      builtin: BUILTIN_NETWORKS.includes(name),
      containers: containers.filter((c) => c.networks.includes(name)).length
    }
  })
}
