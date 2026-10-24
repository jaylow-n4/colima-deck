import type { ColimaAction } from '@shared/types'

interface Props {
  isRunning: boolean
  busy: boolean
  /** 作成済みのプロファイルか（作成中は削除できない） */
  exists: boolean
  onRun(action: ColimaAction): void
  onDelete(): void
}

/** VM の起動 / 停止 / 再起動 / 削除 */
export function VmActions({ isRunning, busy, exists, onRun, onDelete }: Props) {
  return (
    <section className="vm-actions">
      <h2>VM の操作</h2>
      <div className="actions">
        {isRunning ? (
          <>
            <button className="btn" disabled={busy} onClick={() => onRun('stop')}>
              ■ 停止
            </button>
            <button className="btn" disabled={busy} onClick={() => onRun('restart')}>
              ↻ 再起動
            </button>
          </>
        ) : (
          <button className="btn primary" disabled={busy} onClick={() => onRun('start')}>
            ▶ 起動
          </button>
        )}
        <button className="btn danger" disabled={busy || !exists} onClick={onDelete}>
          削除
        </button>
      </div>
    </section>
  )
}
