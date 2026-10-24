import { useEffect, useState } from 'react'
import type { ProfileStatus, ProfileSummary } from '@shared/types'
import { formatBytes, formatGiB } from '../format'
import { useVmUsage } from '../useVmUsage'

interface Props {
  profile: string
  summary: ProfileSummary | null
  running: boolean
}

export function Overview({ profile, summary, running }: Props) {
  const [status, setStatus] = useState<ProfileStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const vm = useVmUsage(profile, running)

  useEffect(() => {
    setStatus(null)
    setError(null)
    if (!running) return
    let cancelled = false
    void window.colimaDeck.status(profile).then((result) => {
      if (cancelled) return
      if (result.ok) setStatus(result.data)
      else setError(result.error)
    })
    return () => {
      cancelled = true
    }
  }, [profile, running])

  if (!summary) {
    return <p className="muted">プロファイルを作成しています。進捗は下のログに表示されます。</p>
  }

  return (
    <div className="overview">
      <div className="stats">
        <Stat label="CPU" value={summary.cpus ? `${summary.cpus} コア` : '—'} />
        <Stat label="メモリ" value={formatGiB(summary.memory)} />
        <Stat label="ディスク" value={formatGiB(summary.disk)} />
        <Stat label="ランタイム" value={summary.runtime || '—'} />
      </div>

      {running && (
        <section className="usage">
          <h2>使用状況</h2>
          {vm.usage ? (
            <>
              <Meter
                label="メモリ"
                ratio={vm.usage.memUsed / vm.usage.memTotal}
                text={`${formatBytes(vm.usage.memUsed)} / ${formatBytes(vm.usage.memTotal)}`}
              />
              <Meter
                label="ディスク"
                ratio={vm.usage.diskUsed / vm.usage.diskTotal}
                text={`${formatBytes(vm.usage.diskUsed)} / ${formatBytes(vm.usage.diskTotal)}`}
              />
              <Meter
                label="CPU 負荷"
                ratio={summary.cpus ? vm.usage.load1 / summary.cpus : 0}
                text={`${vm.usage.load1.toFixed(2)} / ${vm.usage.load5.toFixed(2)} / ${vm.usage.load15.toFixed(2)}（1・5・15 分平均）`}
              />
            </>
          ) : (
            !vm.error && <p className="muted">取得しています…</p>
          )}
          {vm.error && <p className="muted">使用状況を取得できませんでした: {vm.error}</p>}
        </section>
      )}

      <dl className="details">
        <Row label="アーキテクチャ" value={summary.arch} />
        <Row label="アドレス" value={summary.address || status?.ipAddress} />
        {status && (
          <>
            <Row label="ドライバー" value={status.driver} />
            <Row label="マウント方式" value={status.mountType} />
            <Row label="Kubernetes" value={status.kubernetes ? '有効' : '無効'} />
            <Row label="Docker ソケット" value={status.dockerSocket} copyable />
            <Row label="containerd ソケット" value={status.containerdSocket} copyable />
          </>
        )}
      </dl>

      {!running && <p className="muted">VM は停止しています。起動すると詳細が表示されます。</p>}
      {error && <p className="muted">詳細を取得できませんでした: {error}</p>}
    </div>
  )
}

/** 使用率のメーター。8 割を超えると警告色、9 割を超えると危険色にする。 */
function Meter({ label, ratio, text }: { label: string; ratio: number; text: string }) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0))
  const level = clamped >= 0.9 ? 'high' : clamped >= 0.8 ? 'warn' : ''
  return (
    <div className="meter-row">
      <span className="meter-label">{label}</span>
      <div
        className="meter"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped * 100)}
      >
        <div className={`meter-fill ${level}`} style={{ width: `${clamped * 100}%` }} />
      </div>
      <span className="meter-text small">
        <strong>{Math.round(clamped * 100)}%</strong>
        <span className="muted"> {text}</span>
      </span>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  )
}

function Row({ label, value, copyable }: { label: string; value?: string; copyable?: boolean }) {
  const [copied, setCopied] = useState(false)
  if (!value) return null
  const copy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }
  return (
    <>
      <dt>{label}</dt>
      <dd>
        <code>{value}</code>
        {copyable && (
          <button className="link-btn" onClick={copy}>
            {copied ? 'コピーしました' : 'コピー'}
          </button>
        )}
      </dd>
    </>
  )
}
