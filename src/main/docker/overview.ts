import { execFile } from 'node:child_process'
import { join } from 'node:path'
import type {
  ContainerAction,
  ContainerTarget,
  DockerOverview,
  ResourceTarget
} from '@shared/types'
import { colimaHome } from '../config/colimaYaml'
import { commandEnv } from '../colima/exec'
import { buildActionArgs, buildRemoveArgs, projectFilterArgs } from './actions'
import {
  NETWORK_FORMAT,
  NETWORK_INSPECT_FORMAT,
  PS_FORMAT,
  VOLUME_FORMAT,
  parseContainers,
  parseImages,
  parseNetworks,
  parseNetworkSubnets,
  parseVolumes
} from './parse'

/** プロファイルの Docker ソケット。`colima status` の docker_socket と同じ場所。 */
export function dockerHost(profile: string): string {
  return `unix://${join(colimaHome(), profile, 'docker.sock')}`
}

function runDocker(profile: string, args: string[], timeout = 15_000): Promise<string> {
  // ユーザーの DOCKER_HOST / DOCKER_CONTEXT に左右されず、常に対象プロファイルへ接続する
  const env = commandEnv()
  delete env.DOCKER_HOST
  delete env.DOCKER_CONTEXT
  return new Promise((resolve, reject) => {
    execFile(
      'docker',
      ['--host', dockerHost(profile), ...args],
      { env, timeout, maxBuffer: 20 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (!error) return resolve(stdout)
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return reject(new Error('docker コマンドが見つかりません（brew install docker）'))
        }
        reject(new Error(stderr.trim() || error.message))
      }
    )
  })
}

/** コンテナ・イメージ・ボリューム・ネットワークの状況をまとめて取得する。読み取り専用。 */
export async function getDockerOverview(profile: string): Promise<DockerOverview> {
  const [ps, images, volumes, unusedVolumes, networks] = await Promise.all([
    runDocker(profile, ['ps', '-a', '--no-trunc', '--format', PS_FORMAT]),
    runDocker(profile, ['images', '--format', '{{json .}}']),
    runDocker(profile, ['volume', 'ls', '--format', VOLUME_FORMAT]),
    runDocker(profile, ['volume', 'ls', '--filter', 'dangling=true', '-q']),
    runDocker(profile, ['network', 'ls', '--no-trunc', '--format', NETWORK_FORMAT])
  ])
  const { containers, projects } = parseContainers(ps)
  const networkIds = [...networks.matchAll(/"id":"([a-f0-9]+)"/g)].map((m) => m[1])
  // サブネットは ls では取れないため、一覧のあとで inspect する
  const inspected =
    networkIds.length > 0
      ? await runDocker(profile, [
          'network',
          'inspect',
          '--format',
          NETWORK_INSPECT_FORMAT,
          ...networkIds
        ])
      : ''
  return {
    containers,
    projects,
    images: parseImages(images),
    volumes: parseVolumes(volumes, unusedVolumes),
    networks: parseNetworks(networks, containers, parseNetworkSubnets(inspected))
  }
}

/** コンテナ、または compose プロジェクト内のすべてのコンテナに操作を行う */
export async function runContainerAction(
  profile: string,
  action: ContainerAction,
  target: ContainerTarget
): Promise<void> {
  let ids: string[]
  if (target.type === 'container') {
    ids = [target.id]
  } else {
    // 古い一覧に基づかないよう、実行時点のプロジェクトのコンテナを引き直す
    const out = await runDocker(profile, ['ps', '-a', '-q', ...projectFilterArgs(target.name)])
    ids = out.split(/\s+/).filter(Boolean)
    if (ids.length === 0) {
      throw new Error(`compose プロジェクト「${target.name}」のコンテナが見つかりません`)
    }
  }
  // 停止は 1 コンテナにつき最大 10 秒待つため、数に応じてタイムアウトを延ばす
  await runDocker(profile, buildActionArgs(action, ids), 30_000 + ids.length * 15_000)
}

/** ボリューム / ネットワークを削除する。使用中のものは docker が拒否する。 */
export async function removeResource(profile: string, target: ResourceTarget): Promise<void> {
  await runDocker(profile, buildRemoveArgs(target), 30_000)
}
