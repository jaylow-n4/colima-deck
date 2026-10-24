// resources/icon.svg から、アプリアイコン用の PNG と icns を生成する。
//   npm run icons
// SVG のレンダリングには Electron（透過背景のまま PNG にできる）を、
// icns の作成には macOS 標準の sips / iconutil を使う。
const { app, BrowserWindow } = require('electron')
const { execFileSync } = require('node:child_process')
const { mkdirSync, rmSync, writeFileSync } = require('node:fs')
const { join, resolve } = require('node:path')
const { tmpdir } = require('node:os')

const root = resolve(__dirname, '..')
const svgPath = join(root, 'resources', 'icon.svg')
const pngPath = join(root, 'resources', 'icon.png')
const icnsPath = join(root, 'resources', 'icon.icns')
const SIZE = 1024

// macOS の iconset が要求するサイズ（ファイル名 → ピクセル）
const ICONSET = {
  'icon_16x16.png': 16,
  'icon_16x16@2x.png': 32,
  'icon_32x32.png': 32,
  'icon_32x32@2x.png': 64,
  'icon_128x128.png': 128,
  'icon_128x128@2x.png': 256,
  'icon_256x256.png': 256,
  'icon_256x256@2x.png': 512,
  'icon_512x512.png': 512,
  'icon_512x512@2x.png': 1024
}

async function renderPng() {
  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    frame: false,
    transparent: true,
    useContentSize: true,
    webPreferences: { offscreen: true }
  })
  const html = join(tmpdir(), 'colima-deck-icon.html')
  writeFileSync(
    html,
    `<!doctype html><body style="margin:0;background:transparent"><img src="file://${svgPath}" width="${SIZE}" height="${SIZE}" style="display:block">`
  )
  await win.loadFile(html)
  // 画像のデコードと描画が済むまで少し待つ
  await new Promise((r) => setTimeout(r, 500))
  let image = await win.webContents.capturePage()
  if (image.getSize().width !== SIZE)
    image = image.resize({ width: SIZE, height: SIZE, quality: 'best' })
  writeFileSync(pngPath, image.toPNG())
  win.destroy()
}

function buildIcns() {
  const dir = join(tmpdir(), 'colima-deck.iconset')
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  for (const [name, px] of Object.entries(ICONSET)) {
    execFileSync('sips', ['-z', String(px), String(px), pngPath, '--out', join(dir, name)], {
      stdio: 'ignore'
    })
  }
  execFileSync('iconutil', ['-c', 'icns', dir, '-o', icnsPath])
  rmSync(dir, { recursive: true, force: true })
}

app.whenReady().then(async () => {
  try {
    await renderPng()
    if (process.platform === 'darwin') buildIcns()
    console.log(`generated: ${pngPath}${process.platform === 'darwin' ? `, ${icnsPath}` : ''}`)
    app.exit(0)
  } catch (err) {
    console.error(err)
    app.exit(1)
  }
})
