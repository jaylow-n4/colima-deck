import { useState } from 'react'
import type { ColimaAction, ProfileSummary } from '@shared/types'
import { ACTION_LABELS, statusTone } from '../format'
import type { Operation } from '../useOperations'
import { useDockerOverview } from '../useDockerOverview'
import { StatusBadge } from './StatusBadge'
import { Overview } from './Overview'
import {
  ComposePanel,
  ContainersPanel,
  ImagesPanel,
  NetworksPanel,
  VolumesPanel
} from './DockerPanels'
import { ConfigEditor } from './ConfigEditor'
import { VmActions } from './VmActions'
import { LogPanel } from './LogPanel'
import { ConfirmDialog } from './ConfirmDialog'

interface Props {
  profile: string
  summary: ProfileSummary | null
  operations: Operation[]
  onRun(action: ColimaAction): Promise<string | null>
  onCancel(opId: string): void
  onClearLog(): void
  /** プロファイル選択画面へ移る */
  onSwitch(): void
}

type Tab = 'overview' | 'containers' | 'images' | 'compose' | 'volumes' | 'networks' | 'config'

export function ProfileView({
  profile,
  summary,
  operations,
  onRun,
  onCancel,
  onClearLog,
  onSwitch
}: Props) {
  const [tab, setTab] = useState<Tab>('overview')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runningOp = operations.find((op) => op.state === 'running')
  const busy = runningOp !== undefined
  const status = summary?.status ?? 'Creating'
  const isRunning = status.toLowerCase() === 'running'

  // docker で問い合わせられるのは、VM が動作中で runtime が docker のときだけ
  const dockerReady = isRunning && !busy && summary?.runtime === 'docker'
  const docker = useDockerOverview(profile, dockerReady)
  const dockerProps = {
    overview: docker.overview,
    error: docker.error,
    actionError: docker.actionError,
    pending: docker.pending,
    onAction: docker.act,
    onRemove: docker.remove,
    onRefresh: () => void docker.refresh(),
    available: dockerReady,
    unavailableReason:
      isRunning && summary?.runtime !== 'docker'
        ? 'この一覧は runtime が docker のプロファイルでのみ表示できます。'
        : 'VM は停止しています。起動すると表示されます。'
  }

  const run = async (action: ColimaAction) => {
    setError(null)
    const err = await onRun(action)
    if (err) setError(err)
  }

  const badge = busy
    ? { tone: 'busy' as const, label: `${ACTION_LABELS[runningOp.action]}中…` }
    : { tone: statusTone(status), label: summary ? status : '未作成' }

  return (
    <div className="profile-view">
      <header className="profile-header">
        <div className="profile-title">
          <button
            className="profile-switch"
            title="プロファイルを切り替える"
            aria-label={`プロファイル「${profile}」。クリックで切り替え`}
            onClick={onSwitch}
          >
            <h1>{profile}</h1>
            <span className="chevron-down" aria-hidden="true">
              ▾
            </span>
          </button>
          <StatusBadge {...badge} />
        </div>
      </header>

      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}

      <nav className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'overview'}
          className={tab === 'overview' ? 'active' : ''}
          onClick={() => setTab('overview')}
        >
          概要
        </button>
        {(
          [
            ['images', 'イメージ', docker.overview?.images.length],
            ['containers', 'コンテナ', docker.overview?.containers.length],
            ['compose', 'Compose', docker.overview?.projects.length],
            ['volumes', 'ボリューム', docker.overview?.volumes.length],
            ['networks', 'ネットワーク', docker.overview?.networks.length]
          ] as const
        ).map(([id, label, count]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
          >
            {label}
            {count !== undefined && <span className="tab-count">{count}</span>}
          </button>
        ))}
        <button
          role="tab"
          aria-selected={tab === 'config'}
          className={tab === 'config' ? 'active' : ''}
          onClick={() => setTab('config')}
        >
          設定
        </button>
      </nav>

      <section className="tab-body">
        {tab === 'overview' ? (
          <Overview profile={profile} summary={summary} running={isRunning && !busy} />
        ) : tab === 'containers' ? (
          <ContainersPanel {...dockerProps} />
        ) : tab === 'images' ? (
          <ImagesPanel {...dockerProps} />
        ) : tab === 'compose' ? (
          <ComposePanel {...dockerProps} />
        ) : tab === 'volumes' ? (
          <VolumesPanel {...dockerProps} />
        ) : tab === 'networks' ? (
          <NetworksPanel {...dockerProps} />
        ) : (
          <>
            <VmActions
              isRunning={isRunning}
              busy={busy}
              exists={summary !== null}
              onRun={(action) => void run(action)}
              onDelete={() => setConfirmDelete(true)}
            />
            <ConfigEditor
              profile={profile}
              vmRunning={isRunning}
              busy={busy}
              onRestart={() => run('restart')}
            />
          </>
        )}
      </section>

      <LogPanel operations={operations} onCancel={onCancel} onClear={onClearLog} />

      {confirmDelete && (
        <ConfirmDialog
          title={`プロファイル「${profile}」を削除しますか？`}
          message="VM とその中のコンテナ・イメージ・ボリュームがすべて削除されます。この操作は取り消せません。"
          confirmLabel="削除する"
          danger
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false)
            void run('delete')
          }}
        />
      )}
    </div>
  )
}
