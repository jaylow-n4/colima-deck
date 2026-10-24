import { useCallback, useEffect, useRef, useState } from 'react'
import type { ColimaInfo, ProfileSummary, StartOptions } from '@shared/types'
import { ProfileSelect } from './components/ProfileSelect'
import { ProfileView } from './components/ProfileView'
import { NewProfileDialog } from './components/NewProfileDialog'
import { useOperations, type Operation } from './useOperations'

const POLL_INTERVAL_MS = 5000

export function App() {
  const [info, setInfo] = useState<ColimaInfo | null>(null)
  const [profiles, setProfiles] = useState<ProfileSummary[]>([])
  const [listError, setListError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  // true の間はプロファイル選択画面を表示する
  const [switching, setSwitching] = useState(false)

  const refresh = useCallback(async () => {
    const result = await window.colimaDeck.listProfiles()
    if (result.ok) {
      setProfiles(result.data)
      setListError(null)
    } else {
      setListError(result.error)
    }
  }, [])

  const onFinished = useCallback(
    (op: Operation) => {
      if (op.action === 'delete' && op.state === 'success') {
        setSelected((current) => (current === op.profile ? null : current))
        setSwitching(true)
      }
      void refresh()
    },
    [refresh]
  )
  const { operations, run, cancel, clear } = useOperations(onFinished)

  useEffect(() => {
    void window.colimaDeck.info().then((result) => {
      setInfo(result.ok ? result.data : { installed: false, version: '' })
    })
  }, [])

  useEffect(() => {
    if (!info?.installed) return
    void refresh()
    const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [info, refresh])

  // 起動直後だけ、最初のプロファイルを開く（以降は選択画面から選ぶ）
  const autoSelected = useRef(false)
  useEffect(() => {
    if (autoSelected.current || profiles.length === 0) return
    autoSelected.current = true
    setSelected((current) => current ?? profiles[0].name)
  }, [profiles])

  const busyProfiles = new Set(
    operations.filter((op) => op.state === 'running').map((op) => op.profile)
  )

  const createProfile = async (name: string, options: StartOptions): Promise<string | null> => {
    const error = await run('start', name, options)
    if (!error) {
      setCreating(false)
      setSelected(name)
      setSwitching(false)
    }
    return error
  }

  // 作成中でまだ一覧に現れないプロファイルも表示できるようにする
  const selectedSummary = profiles.find((p) => p.name === selected) ?? null
  const showSelected =
    selected !== null &&
    (selectedSummary !== null || operations.some((op) => op.profile === selected))

  const selectProfile = (name: string) => {
    setSelected(name)
    setSwitching(false)
  }

  const isMac = navigator.userAgent.includes('Macintosh')

  let content: React.ReactNode
  if (info === null) {
    content = <div className="placeholder">colima を確認しています…</div>
  } else if (!info.installed) {
    content = <NotInstalled />
  } else if (switching || !showSelected || !selected) {
    content = (
      <ProfileSelect
        info={info}
        profiles={profiles}
        selected={showSelected ? selected : null}
        busyProfiles={busyProfiles}
        error={listError}
        onSelect={selectProfile}
        onRefresh={refresh}
        onCreate={() => setCreating(true)}
        onBack={showSelected ? () => setSwitching(false) : undefined}
      />
    )
  } else {
    content = (
      <ProfileView
        key={selected}
        profile={selected}
        summary={selectedSummary}
        operations={operations.filter((op) => op.profile === selected)}
        onRun={(action) => run(action, selected)}
        onCancel={cancel}
        onClearLog={() => clear(selected)}
        onSwitch={() => setSwitching(true)}
      />
    )
  }

  return (
    <div className="app">
      {/* macOS ではタイトルバーを隠しているため、信号ボタンの分の余白とドラッグ領域を置く */}
      {isMac && <div className="titlebar" />}
      <main className="content">{content}</main>
      {creating && (
        <NewProfileDialog
          existing={profiles.map((p) => p.name)}
          onCancel={() => setCreating(false)}
          onSubmit={createProfile}
        />
      )}
    </div>
  )
}

function NotInstalled() {
  return (
    <div className="placeholder">
      <h2>colima が見つかりません</h2>
      <p>Homebrew などで colima をインストールしてから、アプリを再起動してください。</p>
      <pre className="code">brew install colima docker</pre>
    </div>
  )
}
