import { useCallback, useEffect, useRef, useState } from 'react'
import type { ColimaAction, OperationEvent, StartOptions } from '@shared/types'

export type OperationState = 'running' | 'success' | 'failed'

export interface Operation {
  opId: string
  profile: string
  action: ColimaAction
  lines: string[]
  state: OperationState
  error?: string
  startedAt: number
}

const MAX_LINES = 2000

/** colima の長時間コマンドの実行と、ストリーミングされる出力を管理する */
export function useOperations(onFinished: (op: Operation) => void) {
  const [operations, setOperations] = useState<Operation[]>([])
  // run() の応答より先に出力イベントが届くことがあるため、一時的に保持しておく
  const pending = useRef(new Map<string, OperationEvent[]>())
  const known = useRef(new Set<string>())
  const finishedRef = useRef(onFinished)
  finishedRef.current = onFinished
  const notified = useRef(new Set<string>())

  useEffect(() => {
    for (const op of operations) {
      if (op.state === 'running' || notified.current.has(op.opId)) continue
      notified.current.add(op.opId)
      finishedRef.current(op)
    }
  }, [operations])

  const apply = useCallback((op: Operation, event: OperationEvent): Operation => {
    if (event.type === 'output') {
      const lines = [...op.lines, event.line]
      return { ...op, lines: lines.length > MAX_LINES ? lines.slice(-MAX_LINES) : lines }
    }
    const success = event.code === 0
    const lines = event.error ? [...op.lines, event.error] : op.lines
    return {
      ...op,
      lines,
      state: success ? 'success' : 'failed',
      error: success ? undefined : (event.error ?? `終了コード ${event.code ?? '(シグナル)'}`)
    }
  }, [])

  useEffect(() => {
    return window.colimaDeck.onOperationEvent((event) => {
      if (!known.current.has(event.opId)) {
        const queue = pending.current.get(event.opId) ?? []
        queue.push(event)
        pending.current.set(event.opId, queue)
        return
      }
      setOperations((ops) => ops.map((op) => (op.opId === event.opId ? apply(op, event) : op)))
    })
  }, [apply])

  const run = useCallback(
    async (
      action: ColimaAction,
      profile: string,
      options?: StartOptions
    ): Promise<string | null> => {
      const result = await window.colimaDeck.run(action, profile, options)
      if (!result.ok) return result.error
      const { opId } = result.data
      known.current.add(opId)
      let op: Operation = {
        opId,
        profile,
        action,
        lines: [],
        state: 'running',
        startedAt: Date.now()
      }
      for (const event of pending.current.get(opId) ?? []) op = apply(op, event)
      pending.current.delete(opId)
      const created = op
      setOperations((ops) => [...ops, created])
      return null
    },
    [apply]
  )

  const cancel = useCallback(async (opId: string) => {
    await window.colimaDeck.cancel(opId)
  }, [])

  const clear = useCallback((profile: string) => {
    setOperations((ops) => ops.filter((op) => op.profile !== profile || op.state === 'running'))
  }, [])

  return { operations, run, cancel, clear }
}
