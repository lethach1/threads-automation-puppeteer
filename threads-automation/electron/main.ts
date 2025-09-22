import { app, BrowserWindow, dialog, ipcMain } from 'electron'
// import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
// IMPORTANT: Avoid importing modules that pull puppeteer/ws to prevent bufferutil issues
type OpenProfileOptions = { windowWidth: number; windowHeight: number; scalePercent: number }
import { openProfilesWithConcurrency, closeProfile, withPage } from './sessionManager'

// Use require for external modules after env flags are set
// const require = createRequire(import.meta.url)

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

// IPC: Open file picker and return selected file path
ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select a CSV file',
    properties: ['openFile'],
    filters: [
      { name: 'CSV Files', extensions: ['csv'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })

  if (result.canceled || result.filePaths.length === 0) {
    return ''
  }

  return result.filePaths[0]
})

// IPC: Parse CSV file and return data
ipcMain.handle('parse-csv', async (_event, filePath: string) => {
  try {
    const fs = await import('fs')
    
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const lines = fileContent.split('\n').filter(line => line.trim())
    
    if (lines.length === 0) {
      return { headers: [], rows: [], totalRows: 0 }
    }
    
    // Better CSV parsing that handles commas in values
    const parseCsvLine = (line: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    }
    
    const headers = parseCsvLine(lines[0])
    
    const rows = lines.slice(1).map((line) => {
      const values = parseCsvLine(line)
      const row: Record<string, string> = {}
      headers.forEach((header, i) => {
        row[header] = values[i] || ''
      })
      return row
    })
    return { headers, rows, totalRows: rows.length }
  } catch (error) {
    console.error('❌ Failed to parse CSV:', error)
    throw error
  }
})

// Session opening/management is handled in sessionManager.ts

// IPC: Run open profiles with concurrency and connect via puppeteer
ipcMain.handle('run-open-profiles', async (_event, payload) => {
  try {
    console.log('[ipc] run-open-profiles called with', payload)
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
    const opened = await openProfilesWithConcurrency(profileIds, options, concurrencyLimit)
    console.log('[ipc] run-open-profiles opened:', opened)
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
    const ok = await closeProfile(profileId)
    if (!ok) return { success: false, error: 'session not found' }
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Unknown error' }
  }
})

// Run a simple automation step on an existing session (example stub)
ipcMain.handle('run-automation-for-profile', async (_event, payload: { profileId: string; scenario?: string; input?: any }) => {
  try {
    const { profileId, scenario, input } = payload || ({} as any)
    console.log('[ipc] run-automation-for-profile for', profileId)
    if (!profileId) return { success: false, error: 'profileId is required' }
    const { runAutomationOnPage } = await import('./automation/ThreadsAutomationController.js')
    console.log('[ipc] scenario:', scenario, 'input keys:', input ? Object.keys(input) : [])
    await withPage(profileId, async (page) => {
      const result = await runAutomationOnPage(page, { scenario, input })
      if (!result?.success) throw new Error(result?.error || 'Scenario failed')
    })
    console.log('[ipc] automation finished for', profileId)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Unknown error' }
  }
})
