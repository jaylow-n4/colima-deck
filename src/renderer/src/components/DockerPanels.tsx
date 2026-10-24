import { useState } from 'react'
import { createPortal } from 'react-dom'
import type {
  ContainerAction,
  ContainerSummary,
  ContainerTarget,
  DockerOverview,
  ImageSummary,
  NetworkSummary,
  ResourceTarget,
  VolumeSummary
} from '@shared/types'
import { containerTone, projectTone, type StatusTone } from '../format'
import { resourceKey, targetKey } from '../useDockerOverview'
import { StatusBadge, StatusDot } from './StatusBadge'
import { ConfirmDialog } from './ConfirmDialog'

interface Props {
  overview: DockerOverview | null
  error: string | null
  /** コンテナ操作の失敗メッセージ */
  actionError: string | null
  /** 操作の実行中の対象（targetKey） */
  pending: ReadonlySet<string>
  onAction(action: ContainerAction, target: ContainerTarget): void
  onRemove(target: ResourceTarget): void
  /** VM が動作中で、docker を問い合わせられるか */
  available: boolean
  /** available でないときに表示する理由 */
  unavailableReason: string
}

interface PanelProps extends Props {
  onRefresh(): void
}

function Frame({
  available,
  unavailableReason,
  overview,
  error,
  actionError,
  onRefresh,
  children
}: PanelProps & { children: (overview: DockerOverview) => React.ReactNode }) {
  if (!available) return <p className="muted">{unavailableReason}</p>
  return (
    <>
      <div className="list-toolbar">
        {(actionError ?? error) && (
          <span className="alert error" role="alert">
            {actionError ?? error}
          </span>
        )}
        <button className="icon-btn" title="更新" aria-label="更新" onClick={onRefresh}>
          ↻
        </button>
      </div>
      {overview ? children(overview) : !error && <p className="muted">読み込んでいます…</p>}
    </>
  )
}

/** 行ごとの操作ボタンに渡す、パネル共通の設定 */
interface RowActions {
  pending: ReadonlySet<string>
  onAction(action: ContainerAction, target: ContainerTarget): void
}

const actions = ({ pending, onAction }: PanelProps): RowActions => ({ pending, onAction })

/** すべてのコンテナを平らに並べる。compose 管理のものは所属プロジェクトを表示する。 */
export function ContainersPanel(props: PanelProps) {
  return (
    <Frame {...props}>
      {({ containers }) =>
        containers.length === 0 ? (
          <p className="muted">コンテナはありません。</p>
        ) : (
          <ContainerTable containers={containers} actions={actions(props)} />
        )
      }
    </Frame>
  )
}

/** compose プロジェクトごとにコンテナをまとめて表示する */
export function ComposePanel(props: PanelProps) {
  return (
    <Frame {...props}>
      {({ projects }) =>
        projects.length === 0 ? (
          <p className="muted">compose で起動しているコンテナはありません。</p>
        ) : (
          <div className="groups">
            {projects.map((p) => (
              <Group
                key={p.name}
                title={p.name}
                subtitle={p.workingDir}
                tone={projectTone(p.running, p.total)}
                running={p.running}
                projectName={p.name}
                containers={p.services.flatMap((s) => s.containers)}
                actions={actions(props)}
              />
            ))}
          </div>
        )
      }
    </Frame>
  )
}

interface GroupProps {
  title: string
  subtitle?: string
  tone: StatusTone
  running: number
  containers: ContainerSummary[]
  projectName: string
  actions: RowActions
}

/** compose プロジェクトごとのコンテナ一覧。折りたたみ可能。 */
function Group({ title, tone, running, containers, projectName, actions }: GroupProps) {
  return (
    <details className="group" open>
      <summary>
        <span className="chevron" aria-hidden="true">
          ▸
        </span>
        <h3>{title}</h3>
        <StatusBadge tone={tone} label={`${running} / ${containers.length} 実行中`} />
        <span className="group-actions">
          <ActionButtons
            label={`compose プロジェクト「${projectName}」`}
            removeMessage={`プロジェクト内の ${containers.length} 個のコンテナをすべて削除します（実行中のものは強制終了します）。ボリュームとイメージは残ります。`}
            canStart={running < containers.length}
            canStop={running > 0}
            pending={actions.pending.has(targetKey({ type: 'project', name: projectName }))}
            onAction={(action) => actions.onAction(action, { type: 'project', name: projectName })}
          />
        </span>
      </summary>
      <ContainerTable containers={containers} grouped actions={actions} />
    </details>
  )
}

function ContainerTable({
  containers,
  grouped,
  actions
}: {
  containers: ContainerSummary[]
  /** compose プロジェクトの中で表示する（サービス名を主表示にし、所属列は出さない） */
  grouped?: boolean
  actions: RowActions
}) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>{grouped ? 'サービス' : '名前'}</th>
          <th>イメージ</th>
          <th>状態</th>
          <th>ポート</th>
          {!grouped && <th>compose</th>}
          <th aria-label="操作" />
        </tr>
      </thead>
      <tbody>
        {containers.map((c) => (
          <ContainerRow key={c.id} container={c} grouped={grouped} actions={actions} />
        ))}
      </tbody>
    </table>
  )
}

function ContainerRow({
  container: c,
  grouped,
  actions
}: {
  container: ContainerSummary
  grouped?: boolean
  actions: RowActions
}) {
  const running = c.state === 'running'
  const target: ContainerTarget = { type: 'container', id: c.id }
  return (
    <tr>
      <td>
        <div className="cell-main">
          <StatusDot tone={containerTone(c.state)} />
          <span className="mono">{grouped ? c.service : c.name}</span>
        </div>
        <span className="muted small mono">{grouped ? c.name : c.id}</span>
      </td>
      <td className="mono wrap">{c.image}</td>
      <td>{c.status || c.state}</td>
      <td className="mono wrap">{c.ports || '—'}</td>
      {!grouped && <td>{c.project ? `${c.project} / ${c.service}` : '—'}</td>}
      <td className="row-actions">
        <ActionButtons
          label={`コンテナ「${c.name}」`}
          removeMessage="コンテナを削除します（実行中の場合は強制終了します）。ボリュームとイメージは残ります。"
          canStart={!running}
          canStop={running}
          pending={actions.pending.has(targetKey(target))}
          onAction={(action) => actions.onAction(action, target)}
        />
      </td>
    </tr>
  )
}

interface ActionButtonsProps {
  /** 確認ダイアログとツールチップに使う対象の名前 */
  label: string
  removeMessage: string
  canStart: boolean
  canStop: boolean
  pending: boolean
  onAction(action: ContainerAction): void
}

function ActionButtons({
  label,
  removeMessage,
  canStart,
  canStop,
  pending,
  onAction
}: ActionButtonsProps) {
  // <summary> 内に置くため、クリックで折りたたみが切り替わらないようにする
  const click = (action: ContainerAction) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onAction(action)
  }
  const buttons: [ContainerAction, string, string, boolean][] = [
    ['start', '▶', '起動', canStart],
    ['stop', '■', '停止', canStop],
    ['restart', '↻', '再起動', canStop]
  ]

  return (
    <span className="action-buttons">
      {pending && <span className="muted small">実行中…</span>}
      {buttons
        .filter(([, , , visible]) => visible)
        .map(([action, icon, name]) => (
          <button
            key={action}
            className="icon-btn"
            title={`${label}を${name}`}
            aria-label={`${label}を${name}`}
            disabled={pending}
            onClick={click(action)}
          >
            {icon}
          </button>
        ))}
      <RemoveButton
        label={label}
        message={removeMessage}
        pending={pending}
        onConfirm={() => onAction('remove')}
      />
    </span>
  )
}

interface RemoveButtonProps {
  label: string
  message: string
  pending: boolean
  disabled?: boolean
  disabledReason?: string
  onConfirm(): void
}

/** 確認ダイアログ付きの削除ボタン */
function RemoveButton({
  label,
  message,
  pending,
  disabled,
  disabledReason,
  onConfirm
}: RemoveButtonProps) {
  const [confirming, setConfirming] = useState(false)
  return (
    <>
      <button
        className="icon-btn danger"
        title={disabled && disabledReason ? disabledReason : `${label}を削除`}
        aria-label={`${label}を削除`}
        disabled={pending || disabled}
        onClick={(e) => {
          // <summary> 内に置かれても、クリックで折りたたみが切り替わらないようにする
          e.preventDefault()
          e.stopPropagation()
          setConfirming(true)
        }}
      >
        🗑
      </button>
      {confirming &&
        // <summary> の外（body 直下）に描画し、ダイアログ内のクリックが折りたたみに伝わらないようにする
        createPortal(
          <ConfirmDialog
            title={`${label}を削除しますか？`}
            message={message}
            confirmLabel="削除する"
            danger
            onCancel={() => setConfirming(false)}
            onConfirm={() => {
              setConfirming(false)
              onConfirm()
            }}
          />,
          document.body
        )}
    </>
  )
}

export function ImagesPanel(props: PanelProps) {
  return (
    <Frame {...props}>
      {({ images }) =>
        images.length === 0 ? (
          <p className="muted">イメージはありません。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>リポジトリ</th>
                <th>タグ</th>
                <th>ID</th>
                <th>サイズ</th>
                <th>作成</th>
                <th>使用中のコンテナ</th>
                <th aria-label="操作" />
              </tr>
            </thead>
            <tbody>
              {images.map((img, i) => (
                <ImageRow
                  key={`${img.id}-${img.repository}-${img.tag}-${i}`}
                  image={img}
                  pending={props.pending}
                  onRemove={props.onRemove}
                />
              ))}
            </tbody>
          </table>
        )
      }
    </Frame>
  )
}

function ImageRow({
  image: img,
  pending,
  onRemove
}: { image: ImageSummary } & Pick<PanelProps, 'pending' | 'onRemove'>) {
  const target: ResourceTarget = { type: 'image', reference: img.reference }
  const tagged = img.reference !== img.id
  return (
    <tr>
      <td className="mono wrap">{img.repository}</td>
      <td className="mono">{img.tag}</td>
      <td className="mono">{img.id}</td>
      <td>{img.size}</td>
      <td>{img.created}</td>
      <td>{img.containers === null ? '—' : img.containers}</td>
      <td className="row-actions">
        <RemoveButton
          label={`イメージ「${tagged ? img.reference : img.id}」`}
          message={
            tagged
              ? 'このタグを削除します。他のタグが付いていなければイメージ本体も削除されます。コンテナが使用中の場合は削除できません。'
              : 'イメージを削除します。コンテナが使用中の場合は削除できません。'
          }
          pending={pending.has(resourceKey(target))}
          onConfirm={() => onRemove(target)}
        />
      </td>
    </tr>
  )
}

export function VolumesPanel(props: PanelProps) {
  return (
    <Frame {...props}>
      {({ volumes }) =>
        volumes.length === 0 ? (
          <p className="muted">ボリュームはありません。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>名前</th>
                <th>ドライバー</th>
                <th>compose</th>
                <th>状態</th>
                <th aria-label="操作" />
              </tr>
            </thead>
            <tbody>
              {volumes.map((v) => (
                <VolumeRow
                  key={v.name}
                  volume={v}
                  pending={props.pending}
                  onRemove={props.onRemove}
                />
              ))}
            </tbody>
          </table>
        )
      }
    </Frame>
  )
}

function VolumeRow({
  volume: v,
  pending,
  onRemove
}: { volume: VolumeSummary } & Pick<PanelProps, 'pending' | 'onRemove'>) {
  const target: ResourceTarget = { type: 'volume', name: v.name }
  return (
    <tr>
      <td className="mono wrap">{v.name}</td>
      <td>{v.driver}</td>
      <td>{v.project || '—'}</td>
      <td>{v.inUse ? '使用中' : <span className="muted">未使用</span>}</td>
      <td className="row-actions">
        <RemoveButton
          label={`ボリューム「${v.name}」`}
          message={
            v.inUse
              ? 'ボリュームを削除します。コンテナから使用中の場合は削除できません。中のデータは失われます。'
              : 'ボリュームを削除します。中のデータは失われます。'
          }
          pending={pending.has(resourceKey(target))}
          onConfirm={() => onRemove(target)}
        />
      </td>
    </tr>
  )
}

export function NetworksPanel(props: PanelProps) {
  return (
    <Frame {...props}>
      {({ networks }) =>
        networks.length === 0 ? (
          <p className="muted">ネットワークはありません。</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>名前</th>
                <th>ドライバー</th>
                <th>CIDR</th>
                <th>スコープ</th>
                <th>compose</th>
                <th>コンテナ</th>
                <th aria-label="操作" />
              </tr>
            </thead>
            <tbody>
              {networks.map((n) => (
                <NetworkRow
                  key={n.id}
                  network={n}
                  pending={props.pending}
                  onRemove={props.onRemove}
                />
              ))}
            </tbody>
          </table>
        )
      }
    </Frame>
  )
}

function NetworkRow({
  network: n,
  pending,
  onRemove
}: { network: NetworkSummary } & Pick<PanelProps, 'pending' | 'onRemove'>) {
  const target: ResourceTarget = { type: 'network', id: n.id }
  return (
    <tr>
      <td>
        <span className="mono">{n.name}</span>
        {n.internal && <span className="muted small"> （internal）</span>}
        <div className="muted small mono">{n.id.slice(0, 12)}</div>
      </td>
      <td>{n.driver}</td>
      <td className="mono">
        {n.subnets.length === 0
          ? '—'
          : n.subnets.map((s) => (
              <div key={s.cidr}>
                {s.cidr}
                {s.gateway && <span className="muted small"> gw {s.gateway}</span>}
              </div>
            ))}
      </td>
      <td>{n.scope}</td>
      <td>{n.project || '—'}</td>
      <td>{n.containers}</td>
      <td className="row-actions">
        <RemoveButton
          label={`ネットワーク「${n.name}」`}
          message="ネットワークを削除します。コンテナが接続中の場合は削除できません。"
          pending={pending.has(resourceKey(target))}
          disabled={n.builtin}
          disabledReason="組み込みのネットワークは削除できません"
          onConfirm={() => onRemove(target)}
        />
      </td>
    </tr>
  )
}
