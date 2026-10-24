import { RUNTIMES, VM_TYPES, type ConfigValues } from '@shared/types'

interface Props {
  values: ConfigValues
  onChange(values: ConfigValues): void
  disabled?: boolean
}

/** CPU / メモリ / ディスク / runtime / VM タイプ / Kubernetes の入力欄 */
export function ResourceFields({ values, onChange, disabled }: Props) {
  const set = <K extends keyof ConfigValues>(key: K, value: ConfigValues[K]) =>
    onChange({ ...values, [key]: value })
  const int = (v: string) => (v === '' ? 0 : Math.trunc(Number(v)))

  return (
    <div className="fields">
      <label>
        <span>CPU（コア）</span>
        <input
          type="number"
          min={1}
          value={values.cpu || ''}
          onChange={(e) => set('cpu', int(e.target.value))}
          disabled={disabled}
        />
      </label>
      <label>
        <span>メモリ（GiB）</span>
        <input
          type="number"
          min={1}
          value={values.memory || ''}
          onChange={(e) => set('memory', int(e.target.value))}
          disabled={disabled}
        />
      </label>
      <label>
        <span>ディスク（GiB）</span>
        <input
          type="number"
          min={1}
          value={values.disk || ''}
          onChange={(e) => set('disk', int(e.target.value))}
          disabled={disabled}
        />
      </label>
      <label>
        <span>ランタイム</span>
        <select
          value={values.runtime}
          onChange={(e) => set('runtime', e.target.value)}
          disabled={disabled}
        >
          {withCurrent(RUNTIMES, values.runtime).map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>VM タイプ</span>
        <select
          value={values.vmType}
          onChange={(e) => set('vmType', e.target.value)}
          disabled={disabled}
        >
          {withCurrent(VM_TYPES, values.vmType).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={values.kubernetes}
          onChange={(e) => set('kubernetes', e.target.checked)}
          disabled={disabled}
        />
        <span>Kubernetes を有効にする</span>
      </label>
    </div>
  )
}

/** 設定ファイルに未知の値が入っていても選択肢から消えないようにする */
function withCurrent(options: readonly string[], current: string): string[] {
  return current && !options.includes(current) ? [current, ...options] : [...options]
}

export function validateValues(values: ConfigValues): string | null {
  if (values.cpu < 1) return 'CPU は 1 以上を指定してください'
  if (values.memory < 1) return 'メモリは 1 GiB 以上を指定してください'
  if (values.disk < 1) return 'ディスクは 1 GiB 以上を指定してください'
  if (!(RUNTIMES as readonly string[]).includes(values.runtime))
    return 'ランタイムを選択してください'
  if (!(VM_TYPES as readonly string[]).includes(values.vmType)) return 'VM タイプを選択してください'
  return null
}
