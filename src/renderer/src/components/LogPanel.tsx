import { useEffect, useRef, useState } from 'react'
import { ACTION_LABELS } from '../format'
import type { Operation } from '../useOperations'

interface Props {
  operations: Operation[]
  onCancel(opId: string): void
  onClear(): void
}

export function LogPanel({ operations, onCancel, onClear }: Props) {
  const latest = operations.at(-1)
  const [open, setOpen] = useState(false)
  const bodyRef = useRef<HTMLPreElement>(null)

  // 新しい操作が始まったら自動で開く
  useEffect(() => {
    if (latest?.state === 'running') setOpen(true)
  }, [latest?.opId, latest?.state])

  // 末尾付近を見ているときだけ自動スクロールする
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) el.scrollTop = el.scrollHeight
  }, [latest?.lines.length, open])

  if (!latest) return null

  const summary =
    latest.state === 'running'
      ? `${ACTION_LABELS[latest.action]}中…`
      : latest.state === 'success'
        ? `${ACTION_LABELS[latest.action]}が完了しました`
        : `${ACTION_LABELS[latest.action]}に失敗しました（${latest.error}）`

  return (
    <section className={`log-panel ${open ? 'open' : ''}`}>
      <header className="log-header">
        <button className="log-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="chevron">{open ? '▾' : '▸'}</span>
          ログ
          <span className={`log-summary ${latest.state}`}>{summary}</span>
        </button>
        <div className="log-actions">
          {latest.state === 'running' ? (
            <button className="link-btn" onClick={() => onCancel(latest.opId)}>
              中断
            </button>
          ) : (
            <button className="link-btn" onClick={onClear}>
              クリア
            </button>
          )}
        </div>
      </header>
      {open && (
        <pre className="log-body" ref={bodyRef}>
          {operations.map((op) => (
            <div key={op.opId} className="log-op">
              {op.lines.join('\n')}
            </div>
          ))}
        </pre>
      )}
    </section>
  )
}
