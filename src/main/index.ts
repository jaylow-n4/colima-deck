import { join } from 'node:path'
import { app, BrowserWindow, nativeImage, shell } from 'electron'
import { registerIpc } from './ipc'
// ビルド時にパッケージ内の実パスへ解決される（electron-vite の ?asset）
import iconPath from '../../resources/icon.png?asset'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 760,
    minHeight: 520,
    title: 'Colima Deck',
    // macOS では Dock のアイコンが使われるため、Windows / Linux 向け
    icon: iconPath,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // 外部リンクはアプリ内で開かず、既定のブラウザに渡す
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) event.preventDefault()
  })

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.setName('Colima Deck')

app.whenReady().then(() => {
  // 開発時（Electron 本体として起動）は Dock に Electron のアイコンが出るため、明示的に差し替える
  if (process.platform === 'darwin') app.dock?.setIcon(nativeImage.createFromPath(iconPath))

  const operations = registerIpc(() => mainWindow?.webContents)
  app.on('before-quit', () => operations.killAll())

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
