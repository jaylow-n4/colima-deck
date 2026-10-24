import type { StatusTone } from '../format'

export function StatusDot({ tone }: { tone: StatusTone }) {
  return <span className={`dot ${tone}`} aria-hidden="true" />
}

export function StatusBadge({ tone, label }: { tone: StatusTone; label: string }) {
  return (
    <span className={`badge ${tone}`}>
      <StatusDot tone={tone} />
      {label}
    </span>
  )
}
