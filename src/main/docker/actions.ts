import type { ContainerAction, ResourceTarget } from '@shared/types'

/** compose プロジェクトのコンテナを絞り込む `docker ps` の引数 */
export function projectFilterArgs(project: string): string[] {
  return ['--filter', `label=com.docker.compose.project=${project}`]
}

/** コンテナ ID は検証済みであること。削除は実行中でも行えるよう強制削除にする。 */
export function buildActionArgs(action: ContainerAction, ids: string[]): string[] {
  switch (action) {
    case 'start':
    case 'stop':
    case 'restart':
      return [action, ...ids]
    case 'remove':
      return ['rm', '-f', ...ids]
  }
}

/** 対象は検証済みであること */
export function buildRemoveArgs(target: ResourceTarget): string[] {
  switch (target.type) {
    case 'volume':
      return ['volume', 'rm', target.name]
    case 'network':
      return ['network', 'rm', target.id]
    case 'image':
      return ['image', 'rm', target.reference]
  }
}
