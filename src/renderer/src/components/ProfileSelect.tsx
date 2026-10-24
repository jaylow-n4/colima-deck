import type { ColimaInfo, ProfileSummary } from '@shared/types'
import { formatGiB, statusTone } from '../format'
import { StatusDot } from './StatusBadge'

interface Props {
  info: ColimaInfo
  profiles: ProfileSummary[]
  /** 現在開いているプロファイル */
  selected: string | null
  busyProfiles: Set<string>
  error: string | null
  onSelect(name: string): void
  onRefresh(): void
  onCreate(): void
  /** 開いているプロファイルの画面へ戻る（開いているものがなければ undefined） */
  onBack?: () => void
}

/** プロファイルの選択画面 */
export function ProfileSelect({
  info,
  profiles,
  selected,
  busyProfiles,
  error,
  onSelect,
  onRefresh,
  onCreate,
  onBack
}: Props) {
  return (
    <div className="profile-select">
      <header className="select-header">
        <h1>プロファイル</h1>
        <div className="actions">
          {onBack && (
            <button className="btn" onClick={onBack}>
              戻る
            </button>
          )}
          <button
            className="icon-btn"
            title="一覧を更新"
            aria-label="一覧を更新"
            onClick={onRefresh}
          >
            ↻
          </button>
          <button className="btn primary" onClick={onCreate}>
            ＋ 新規プロファイル
          </button>
        </div>
      </header>

      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}

      {profiles.length === 0 ? (
        <p className="muted select-empty">プロファイルがありません。</p>
      ) : (
        <ul className="profile-cards">
          {profiles.map((p) => {
            const busy = busyProfiles.has(p.name)
            return (
              <li key={p.name}>
                <button
                  className={`profile-card${p.name === selected ? ' selected' : ''}`}
                  onClick={() => onSelect(p.name)}
                >
                  <div className="card-title">
                    <StatusDot tone={busy ? 'busy' : statusTone(p.status)} />
                    <span className="profile-name">{p.name}</span>
                    <span className="profile-status">{busy ? '実行中…' : p.status}</span>
                  </div>
                  <div className="card-meta muted small">
                    {[
                      p.runtime,
                      p.cpus ? `${p.cpus} コア` : '',
                      formatGiB(p.memory) !== '—' ? formatGiB(p.memory) : ''
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <footer className="select-footer muted small">colima {info.version}</footer>
    </div>
  )
}
