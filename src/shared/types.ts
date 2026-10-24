// main / preload / renderer で共有する型定義

/** `colima list --json` の 1 行分 */
export interface ProfileSummary {
  name: string
  status: string
  arch: string
  cpus: number
  /** バイト */
  memory: number
  /** バイト */
  disk: number
  runtime: string
  address: string
}

/** `colima status --json` の結果（必要な項目のみ） */
export interface ProfileStatus {
  displayName: string
  driver: string
  arch: string
  runtime: string
  mountType: string
  ipAddress: string
  dockerSocket: string
  containerdSocket: string
  kubernetes: boolean
  cpu: number
  /** バイト */
  memory: number
  /** バイト */
  disk: number
}

/** `docker ps -a` の 1 行分 */
export interface ContainerSummary {
  id: string
  name: string
  image: string
  /** running / exited / paused / restarting / created / dead など */
  state: string
  /** 例: "Up 3 minutes (healthy)" */
  status: string
  ports: string
  /** 接続しているネットワーク名 */
  networks: string[]
  /** compose プロジェクト名（compose 管理でなければ空） */
  project: string
  service: string
}

/** `docker images` の 1 行分 */
export interface ImageSummary {
  /** 短縮 ID */
  id: string
  /** 削除時に指定する値。タグ付きなら `repository:tag`、タグがなければ ID */
  reference: string
  repository: string
  tag: string
  /** 例: "3.47GB" */
  size: string
  /** 例: "6 minutes ago" */
  created: string
  /** このイメージを使うコンテナ数（不明なら null） */
  containers: number | null
}

export interface VolumeSummary {
  name: string
  driver: string
  /** compose プロジェクト名（compose 管理でなければ空） */
  project: string
  /** コンテナから参照されているか */
  inUse: boolean
}

export interface NetworkSubnet {
  /** CIDR 表記（例: 172.18.0.0/16） */
  cidr: string
  gateway: string
}

export interface NetworkSummary {
  /** 完全な ID */
  id: string
  name: string
  driver: string
  scope: string
  /** IPAM に設定されたサブネット（host / none などは空） */
  subnets: NetworkSubnet[]
  internal: boolean
  project: string
  /** bridge / host / none（削除できない） */
  builtin: boolean
  /** 接続しているコンテナ数 */
  containers: number
}

export interface ComposeService {
  service: string
  containers: ContainerSummary[]
}

/** コンテナのラベルから組み立てた compose プロジェクト */
export interface ComposeProject {
  name: string
  workingDir: string
  configFiles: string[]
  services: ComposeService[]
  running: number
  total: number
}

export interface DockerOverview {
  containers: ContainerSummary[]
  images: ImageSummary[]
  projects: ComposeProject[]
  volumes: VolumeSummary[]
  networks: NetworkSummary[]
}

export const CONTAINER_ACTIONS = ['start', 'stop', 'restart', 'remove'] as const
export type ContainerAction = (typeof CONTAINER_ACTIONS)[number]

/** 操作の対象: 1 つのコンテナ、または compose プロジェクト内のすべてのコンテナ */
export type ContainerTarget = { type: 'container'; id: string } | { type: 'project'; name: string }

/** 削除できるリソース */
export type ResourceTarget =
  | { type: 'volume'; name: string }
  | { type: 'network'; id: string }
  | { type: 'image'; reference: string }

/** VM（Linux ゲスト）内の使用状況 */
export interface VmUsage {
  /** バイト */
  memTotal: number
  /** バイト（キャッシュを除く。memTotal - available） */
  memUsed: number
  /** バイト（ルートファイルシステム） */
  diskTotal: number
  /** バイト */
  diskUsed: number
  load1: number
  load5: number
  load15: number
}

export type ColimaAction = 'start' | 'stop' | 'restart' | 'delete'

export const RUNTIMES = ['docker', 'containerd', 'incus'] as const
export const VM_TYPES = ['vz', 'qemu', 'krunkit'] as const

/** 新規プロファイル作成時に `colima start` へ渡すオプション */
export interface StartOptions {
  cpu?: number
  /** GiB */
  memory?: number
  /** GiB */
  disk?: number
  runtime?: string
  vmType?: string
  kubernetes?: boolean
}

/** colima.yaml のうちフォームで編集する項目 */
export interface ConfigValues {
  cpu: number
  /** GiB */
  memory: number
  /** GiB */
  disk: number
  runtime: string
  vmType: string
  kubernetes: boolean
}

export interface ConfigFile {
  path: string
  exists: boolean
  raw: string
  values: ConfigValues | null
}

export interface ColimaInfo {
  installed: boolean
  version: string
}

/** 実行中のコマンドから renderer に送られるイベント */
export type OperationEvent =
  | { opId: string; type: 'output'; line: string }
  | { opId: string; type: 'exit'; code: number | null; error?: string }

export interface OperationInfo {
  opId: string
  profile: string
  action: ColimaAction
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

/** preload で公開する API */
export interface ColimaDeckApi {
  info(): Promise<Result<ColimaInfo>>
  listProfiles(): Promise<Result<ProfileSummary[]>>
  status(profile: string): Promise<Result<ProfileStatus>>
  vmUsage(profile: string): Promise<Result<VmUsage>>
  run(action: ColimaAction, profile: string, options?: StartOptions): Promise<Result<OperationInfo>>
  cancel(opId: string): Promise<Result<void>>
  dockerOverview(profile: string): Promise<Result<DockerOverview>>
  containerAction(
    profile: string,
    action: ContainerAction,
    target: ContainerTarget
  ): Promise<Result<void>>
  removeResource(profile: string, target: ResourceTarget): Promise<Result<void>>
  readConfig(profile: string): Promise<Result<ConfigFile>>
  writeConfig(profile: string, values: ConfigValues): Promise<Result<ConfigFile>>
  writeRawConfig(profile: string, raw: string): Promise<Result<ConfigFile>>
  onOperationEvent(listener: (event: OperationEvent) => void): () => void
}

export const IPC = {
  info: 'colima:info',
  listProfiles: 'colima:list',
  status: 'colima:status',
  vmUsage: 'colima:vm-usage',
  run: 'colima:run',
  cancel: 'colima:cancel',
  dockerOverview: 'docker:overview',
  containerAction: 'docker:container-action',
  removeResource: 'docker:remove-resource',
  readConfig: 'config:read',
  writeConfig: 'config:write',
  writeRawConfig: 'config:write-raw',
  operationEvent: 'colima:operation-event'
} as const
