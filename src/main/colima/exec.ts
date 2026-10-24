import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { delimiter } from 'node:path'

// Finder などから起動した GUI アプリはログインシェルの PATH を引き継がないため、
// Homebrew の標準的なインストール先を補う。
const EXTRA_PATHS = [
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin'
]

export function commandEnv(): NodeJS.ProcessEnv {
  const current = (process.env.PATH ?? '').split(delimiter).filter(Boolean)
  const merged = [...current, ...EXTRA_PATHS.filter((p) => !current.includes(p))]
  // 色付きの出力（ANSI エスケープ）を抑止する
  return { ...process.env, PATH: merged.join(delimiter), NO_COLOR: '1', TERM: 'dumb' }
}

export interface ExecResult {
  stdout: string
  stderr: string
}

/** 完了まで待って出力をまとめて返す。シェルは経由しない。 */
export function runColima(args: string[], timeoutMs = 30_000): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    execFile(
      'colima',
      args,
      { env: commandEnv(), timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const detail = stderr.trim() || stdout.trim() || error.message
          const err = new Error(detail) as Error & { code?: unknown }
          err.code = (error as NodeJS.ErrnoException).code
          reject(err)
          return
        }
        resolve({ stdout, stderr })
      }
    )
  })
}

export interface StreamHandlers {
  onLine(line: string): void
  onExit(code: number | null, error?: string): void
}

/** 長時間かかるコマンドを実行し、stdout / stderr を行単位で通知する */
export function streamColima(args: string[], handlers: StreamHandlers): ChildProcess {
  const child = spawn('colima', args, { env: commandEnv(), stdio: ['ignore', 'pipe', 'pipe'] })
  const flushers = [child.stdout, child.stderr].map((stream) => {
    let buffer = ''
    stream.setEncoding('utf8')
    stream.on('data', (chunk: string) => {
      buffer += chunk
      const lines = buffer.split(/\r?\n|\r/)
      buffer = lines.pop() ?? ''
      for (const line of lines) if (line.trim()) handlers.onLine(stripAnsi(line))
    })
    return () => {
      if (buffer.trim()) handlers.onLine(stripAnsi(buffer))
      buffer = ''
    }
  })

  let finished = false
  const finish = (code: number | null, error?: string): void => {
    if (finished) return
    finished = true
    flushers.forEach((flush) => flush())
    handlers.onExit(code, error)
  }
  child.on('error', (err: NodeJS.ErrnoException) => {
    finish(null, err.code === 'ENOENT' ? 'colima コマンドが見つかりません' : err.message)
  })
  child.on('close', (code) => finish(code))
  return child
}

export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
}
