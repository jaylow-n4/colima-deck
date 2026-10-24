import { useState, type FormEvent } from 'react'
import type { ConfigValues, StartOptions } from '@shared/types'
import { Modal } from './ConfirmDialog'
import { ResourceFields, validateValues } from './ResourceFields'

interface Props {
  existing: string[]
  onCancel(): void
  onSubmit(name: string, options: StartOptions): Promise<string | null>
}

const PROFILE_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

// colima の既定値に合わせる
const DEFAULTS: ConfigValues = {
  cpu: 2,
  memory: 2,
  disk: 100,
  runtime: 'docker',
  vmType: 'vz',
  kubernetes: false
}

export function NewProfileDialog({ existing, onCancel, onSubmit }: Props) {
  const [name, setName] = useState(existing.includes('default') ? '' : 'default')
  const [values, setValues] = useState<ConfigValues>(DEFAULTS)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!PROFILE_NAME.test(name)) {
      return setError('プロファイル名は英数字で始め、英数字・-・_ のみで指定してください')
    }
    if (existing.includes(name)) return setError(`プロファイル「${name}」は既に存在します`)
    const invalid = validateValues(values)
    if (invalid) return setError(invalid)

    setSubmitting(true)
    const err = await onSubmit(name, values)
    setSubmitting(false)
    if (err) setError(err)
  }

  return (
    <Modal title="新規プロファイル" onClose={onCancel}>
      <form onSubmit={submit}>
        <div className="fields">
          <label className="wide">
            <span>プロファイル名</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: dev"
              autoFocus
              disabled={submitting}
            />
          </label>
        </div>
        <ResourceFields values={values} onChange={setValues} disabled={submitting} />
        <p className="muted small">
          作成すると VM が起動します。初回はイメージのダウンロードに数分かかります。
        </p>
        {error && <div className="alert error">{error}</div>}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onCancel} disabled={submitting}>
            キャンセル
          </button>
          <button type="submit" className="btn primary" disabled={submitting}>
            作成して起動
          </button>
        </div>
      </form>
    </Modal>
  )
}
