import { useEffect, useState } from 'react'
import type { VmUsage } from '@shared/types'

// `colima ssh` で VM に入るため、docker の一覧より間隔を長くする
const POLL_INTERVAL_MS = 15_000

/** VM が動作中の間、VM 内のメモリ・ディスク・負荷を定期的に取得する */
export function useVmUsage(profile: string, enabled: boolean) {
  const [usage, setUsage] = useState<VmUsage | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setUsage(null)
    setError(null)
    if (!enabled) return
    let cancelled = false
    const load = async (): Promise<void> => {
      const result = await window.colimaDeck.vmUsage(profile)
      if (cancelled) return
      if (result.ok) {
        setUsage(result.data)
        setError(null)
      } else {
        // 直前の値は残し、エラーだけ知らせる
        setError(result.error)
      }
    }
    void load()
    const timer = setInterval(() => void load(), POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [profile, enabled])

  return { usage, error }
}
