import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
// IMPORTANT: Avoid importing modules that pull puppeteer/ws to prevent bufferutil issues
type OpenProfileOptions = { windowWidth: number; windowHeight: number; scalePercent: number }
type SessionInfo = { wsUrl: string; browser: import('puppeteer-core').Browser }

// Use require for external modules after env flags are set
const require = createRequire(import.meta.url)
const puppeteer = require('puppeteer-core') as typeof import('puppeteer-core')

// Hint ws to skip optional native deps to avoid bundler resolution issues
process.env.WS_NO_BUFFER_UTIL = '1'
process.env.WS_NO_UTF_8_VALIDATE = '1'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
const sessions = new Map<string, SessionInfo>()

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)

// IPC: Open directory picker and return selected path
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select a directory',
    properties: ['openDirectory']
  })

  if (result.canceled || result.filePaths.length === 0) {
    return ''
  }

  return result.filePaths[0]
})

// Open profile via API, then connect Puppeteer and store session
const OPEN_PROFILE_API = 'http://127.0.0.1:5424/api/open-profile'

async function openOneProfileAndConnect(profileId: string, options: OpenProfileOptions) {
  const res = await fetch(OPEN_PROFILE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId, options })
  })
  if (!res.ok) throw new Error(`bad status ${res.status}`)
  const data = await res.json()
  if (!data || data.success !== true || !('wsUrl' in data) || !data.wsUrl) {
    throw new Error(data?.error || 'open failed / missing wsUrl')
  }

  // Connect puppeteer and store session
  const browser = await puppeteer.connect({ browserWSEndpoint: data.wsUrl, defaultViewport: null })
  sessions.set(profileId, { wsUrl: data.wsUrl, browser })
  return { profileId }
}

async function openProfilesWithPool(profileIds: string[], options: OpenProfileOptions, concurrency: number) {
  const limit = Math.max(1, Math.min(concurrency, profileIds.length))
  const results: { profileId: string }[] = []
  let cursor = 0
  const workers = Array.from({ length: limit }, async () => {
    while (cursor < profileIds.length) {
      const index = cursor++
      const id = profileIds[index]
      try {
        const r = await openOneProfileAndConnect(id, options)
        results.push(r)
      } catch (e) {
        console.error('open profile failed', id, e)
      }
    }
  })
  await Promise.all(workers)
  return results
}

// IPC: Run open profiles with concurrency and connect via puppeteer
ipcMain.handle('run-open-profiles', async (event, payload) => {
  try {
    const { profileIds, windowWidth, windowHeight, scalePercent, concurrency } = payload

    if (!Array.isArray(profileIds) || profileIds.length === 0) {
      return {
        success: false,
        error: 'profileIds is required and must be a non-empty array'
      }
    }

    const options: OpenProfileOptions = {
      windowWidth: Number(windowWidth) || 800,
      windowHeight: Number(windowHeight) || 600,
      scalePercent: Number(scalePercent) || 100
    }
    
    const concurrencyLimit = Math.max(1, Math.floor(Number(concurrency) || 1))
    const opened = await openProfilesWithPool(profileIds, options, concurrencyLimit)
    return { success: true, opened }
  } catch (error: any) {
    console.error('Error in run-open-profiles:', error)
    return {
      success: false,
      error: error?.message || 'Unknown error'
    }
  }
})

// Optional: IPC to close a single profile session
ipcMain.handle('close-profile', async (_event, profileId: string) => {
  try {
    const s = sessions.get(profileId)
    if (!s) return { success: false, error: 'session not found' }
    await s.browser.close()
    sessions.delete(profileId)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Unknown error' }
  }
})
