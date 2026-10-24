import { useCallback, useEffect, useState } from 'react'
import type { ConfigFile, ConfigValues } from '@shared/types'
import { ResourceFields, validateValues } from './ResourceFields'

interface Props {
  profile: string
  vmRunning: boolean
  busy: boolean
  onRestart(): void
}

type Mode = 'form' | 'raw'

export function ConfigEditor({ profile, vmRunning, busy, onRestart }: Props) {
  const [file, setFile] = useState<ConfigFile | null>(null)
  const [values, setValues] = useState<ConfigValues | null>(null)
  const [raw, setRaw] = useState('')
  const [mode, setMode] = useState<Mode>('form')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback((next: ConfigFile) => {
    setFile(next)
    setValues(next.values)
    setRaw(next.raw)
    if (!next.values && next.exists) setMode('raw')
  }, [])

  useEffect(() => {
    void window.colimaDeck.readConfig(profile).then((result) => {
      if (result.ok) load(result.data)
      else setError(result.error)
    })
  }, [profile, load])

  if (!file)
    return error ? <div className="alert error">{error}</div> : <p className="muted">読み込み中…</p>
  if (!file.exists) {
    return (
      <p className="muted">
        設定ファイルがまだありません（<code>{file.path}</code>）。一度起動すると作成されます。
      </p>
    )
  }

  const dirty =
    mode === 'raw'
      ? raw !== file.raw
      : values !== null && JSON.stringify(values) !== JSON.stringify(file.values)

  const save = async () => {
    setError(null)
    setSaved(false)
    if (mode === 'form' && values) {
      const invalid = validateValues(values)
      if (invalid) return setError(invalid)
    }
    setSaving(true)
    const result =
      mode === 'form' && values
        ? await window.colimaDeck.writeConfig(profile, values)
        : await window.colimaDeck.writeRawConfig(profile, raw)
    setSaving(false)
    if (!result.ok) return setError(result.error)
    load(result.data)
    setSaved(true)
  }

  const revert = () => {
    setValues(file.values)
    setRaw(file.raw)
    setError(null)
  }

  // 未保存の変更があるときは切り替えさせない（片方の編集内容が失われるため）
  const switchMode = (next: Mode) => {
    setSaved(false)
    setMode(next)
  }
  const switchBlocked = dirty ? '保存するか元に戻してから切り替えてください' : ''

  return (
    <div className="config-editor">
      <div className="config-toolbar">
        <div className="segmented">
          <button
            className={mode === 'form' ? 'active' : ''}
            onClick={() => switchMode('form')}
            disabled={!file.values || dirty}
            title={file.values ? switchBlocked : 'YAML を解析できないため、フォームは使えません'}
          >
            フォーム
          </button>
          <button
            className={mode === 'raw' ? 'active' : ''}
            onClick={() => switchMode('raw')}
            disabled={dirty}
            title={switchBlocked}
          >
            YAML
          </button>
        </div>
        <code className="path" title={file.path}>
          {file.path}
        </code>
      </div>

      {mode === 'form' && values ? (
        <>
          <ResourceFields values={values} onChange={setValues} disabled={saving} />
          <ul className="hints">
            <li>ディスクは拡張のみ可能です（縮小はできません）。</li>
            <li>ランタイムや VM タイプの変更には、VM の削除と再作成が必要な場合があります。</li>
          </ul>
        </>
      ) : (
        <textarea
          className="yaml"
          spellCheck={false}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          disabled={saving}
        />
      )}

      {error && <div className="alert error">{error}</div>}
      {saved && !dirty && (
        <div className="alert info">
          保存しました。
          {vmRunning ? '変更は VM の再起動後に反映されます。' : '次回の起動時に反映されます。'}
          {vmRunning && (
            <button className="link-btn" onClick={onRestart} disabled={busy}>
              今すぐ再起動
            </button>
          )}
        </div>
      )}

      <div className="form-actions">
        <button className="btn" onClick={revert} disabled={!dirty || saving}>
          元に戻す
        </button>
        <button className="btn primary" onClick={save} disabled={!dirty || saving}>
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
    </div>
  )
}
