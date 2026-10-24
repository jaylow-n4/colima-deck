// 開発時（npm run dev）に Dock やメニューバーへ出る名前とアイコンを、Electron から Colima Deck に差し替える。
//
// macOS は Dock のラベルを、起動した .app の Info.plist（CFBundleName）から決める。
// 開発中は node_modules の Electron.app をそのまま起動するため、app.setName() では変わらない。
// そこで Electron.app の Info.plist とアイコンを書き換える。node_modules を再インストールすると
// 元に戻るが、`npm run dev` のたびに実行されるので問題ない。梱包したアプリには関係しない。
const { execFileSync } = require('node:child_process')
const { copyFileSync, existsSync, readFileSync } = require('node:fs')
const { join, resolve } = require('node:path')

const NAME = 'Colima Deck'
// macOS は .app の名前・アイコンをキャッシュするため、書き換えたら再登録して反映させる
const LSREGISTER =
  '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'

function main() {
  if (process.platform !== 'darwin') return
  const root = resolve(__dirname, '..')
  const contents = join(root, 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents')
  const plist = join(contents, 'Info.plist')
  if (!existsSync(plist)) return

  let changed = false
  const read = (key) => {
    try {
      return execFileSync('plutil', ['-extract', key, 'raw', '-o', '-', plist], {
        encoding: 'utf8'
      }).trim()
    } catch {
      return ''
    }
  }
  for (const key of ['CFBundleName', 'CFBundleDisplayName']) {
    if (read(key) !== NAME) {
      execFileSync('plutil', ['-replace', key, '-string', NAME, plist])
      changed = true
    }
  }

  const icon = join(root, 'resources', 'icon.icns')
  const target = join(contents, 'Resources', 'electron.icns')
  if (existsSync(icon) && existsSync(target)) {
    const same = readFileSync(icon).equals(readFileSync(target))
    if (!same) {
      copyFileSync(icon, target)
      changed = true
    }
  }

  if (changed && existsSync(LSREGISTER)) {
    execFileSync(LSREGISTER, ['-f', join(contents, '..')])
  }
}

try {
  main()
} catch (err) {
  // 見た目だけの調整なので、失敗しても開発自体は止めない
  console.warn(`[patch-dev-electron] 名前とアイコンの差し替えに失敗しました: ${err.message}`)
}
