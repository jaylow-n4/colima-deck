import { useCallback, useEffect, useState } from 'react'
import type {
  ContainerAction,
  ContainerTarget,
  DockerOverview,
  ResourceTarget
} from '@shared/types'

const POLL_INTERVAL_MS = 5000

/** 操作中の対象を識別するキー（コンテナ ID または `project:<名前>`） */
export function targetKey(target: ContainerTarget): string {
  return target.type === 'container' ? target.id : `project:${target.name}`
}

export function resourceKey(target: ResourceTarget): string {
  switch (target.type) {
    case 'volume':
      return `volume:${target.name}`
    case 'network':
      return `network:${target.id}`
    case 'image':
      return `image:${target.reference}`
  }
}

/** VM が動作中の間、コンテナ・イメージ・compose の状況を定期的に取得し、操作も受け付ける */
export function useDockerOverview(profile: string, enabled: boolean) {
  const [overview, setOverview] = useState<DockerOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())
  const [actionError, setActionError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const result = await window.colimaDeck.dockerOverview(profile)
    if (result.ok) {
      setOverview(result.data)
      setError(null)
    } else {
      setError(result.error)
    }
  }, [profile])

  /** 操作を実行し、失敗しても状態が部分的に変わっていることがあるため常に取得し直す */
  const track = useCallback(
    async (key: string, run: () => Promise<{ ok: boolean; error?: string }>) => {
      setActionError(null)
      setPending((current) => new Set(current).add(key))
      const result = await run()
      if (!result.ok) setActionError(result.error ?? '操作に失敗しました')
      await refresh()
      setPending((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
    },
    [refresh]
  )

  const act = useCallback(
    (action: ContainerAction, target: ContainerTarget) =>
      track(targetKey(target), () => window.colimaDeck.containerAction(profile, action, target)),
    [profile, track]
  )

  const remove = useCallback(
    (target: ResourceTarget) =>
      track(resourceKey(target), () => window.colimaDeck.removeResource(profile, target)),
    [profile, track]
  )

  useEffect(() => {
    if (!enabled) {
      setOverview(null)
      setError(null)
      setActionError(null)
      return
    }
    void refresh()
    const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [enabled, refresh])

  return { overview, error, refresh, pending, actionError, act, remove }
}
