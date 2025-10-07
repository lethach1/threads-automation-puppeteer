import { app, BrowserWindow, dialog, ipcMain } from 'electron'
// import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'fs'
import { promisify } from 'util'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// IMPORTANT: Avoid importing modules that pull puppeteer/ws to prevent bufferutil issues
type OpenProfileOptions = { windowWidth: number; windowHeight: number; scalePercent: number }
import { openProfilesWithConcurrency, closeProfile, withPage } from './sessionManager'

// Use require for external modules after env flags are set
// const require = createRequire(import.meta.url)

// Hint ws to skip optional native deps to avoid bundler resolution issues
process.env.WS_NO_BUFFER_UTIL = '1'
process.env.WS_NO_UTF_8_VALIDATE = '1'

// Enable Chromium/Electron logging to the console window (Windows debug builds)
app?.commandLine?.appendSwitch?.('enable-logging')

// Enable debug mode if DEBUG environment variable is set
if (process.env.DEBUG === 'true') {
  app?.commandLine?.appendSwitch?.('remote-debugging-port', '9222')
  app?.commandLine?.appendSwitch?.('enable-logging')
  console.log('🐛 Debug mode enabled - DevTools available at http://localhost:9222')
}

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
    title: 'Select a file',
    properties: ['openFile'],
    filters: [
      { name: 'Data Files', extensions: ['csv', 'xlsx', 'xls', 'xlsm'] },
      { name: 'CSV Files', extensions: ['csv'] },
      { name: 'Excel Files', extensions: ['xlsx', 'xls', 'xlsm'] },
      { name: 'TypeScript Files', extensions: ['ts'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })

  if (result.canceled || result.filePaths.length === 0) {
    return ''
  }

  return result.filePaths[0]
})

// Read file content API
ipcMain.handle('read-file', async (_event, filePath: string) => {
  try {
    const content = await promisify(fs.readFile)(filePath, 'utf8')
    return content
  } catch (error: any) {
    throw new Error(`Failed to read file: ${error?.message}`)
  }
})

// Script file picker API (only TypeScript and JavaScript)
ipcMain.handle('select-script-file', async () => {
  const result = await dialog.showOpenDialog(win!, {
    title: 'Select a TypeScript or JavaScript file',
    properties: ['openFile'],
    filters: [
      { name: 'Script Files', extensions: ['ts', 'js'] }
    ],
    buttonLabel: 'Select Script',
    message: 'Please select a TypeScript (.ts) or JavaScript (.js) file'
  })

  if (result.canceled || result.filePaths.length === 0) {
    return ''
  }

  // Double-check file extension
  const filePath = result.filePaths[0]
  const fileExtension = filePath.toLowerCase().split('.').pop()
  if (!['ts', 'js'].includes(fileExtension || '')) {
    throw new Error('Only TypeScript (.ts) and JavaScript (.js) files are allowed')
  }

  return filePath
})

// IPC: Parse CSV/Excel file and return data using SheetJS
ipcMain.handle('parse-csv', async (_event, filePath: string) => {
  try {
    const fs = await import('fs')
    const XLSX = await import('xlsx')
    
    // Get file extension to determine file type
    const fileExtension = filePath.toLowerCase().split('.').pop()
    
    let workbook: any
    if (fileExtension === 'csv') {
      // For CSV files, read as UTF-8 text
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      workbook = XLSX.read(fileContent, { type: 'string' })
    } else if (['xlsx', 'xls', 'xlsm'].includes(fileExtension || '')) {
      // For Excel files, read as buffer
      const fileBuffer = fs.readFileSync(filePath)
      workbook = XLSX.read(fileBuffer, { type: 'buffer' })
    } else {
      throw new Error(`Unsupported file format: ${fileExtension}`)
    }
    
    // Get the first worksheet
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) {
      return { headers: [], rows: [], totalRows: 0 }
    }
    
    const worksheet = workbook.Sheets[sheetName]
    
    // Convert worksheet to JSON array
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,
      defval: '',
      raw: false // Convert all values to strings
    }) as any[][]
    
    if (jsonData.length === 0) {
      return { headers: [], rows: [], totalRows: 0 }
    }
    
    // First row is headers
    const headers = jsonData[0].map((h: any) => String(h || '').trim())
    
    // Remaining rows are data
    const rows = jsonData.slice(1).map((row: any[]) => {
      const rowData: Record<string, string> = {}
      headers.forEach((header, index) => {
        const value = row[index]
        rowData[header] = String(value || '').trim()
      })
      return rowData
    })
    
    return { headers, rows, totalRows: rows.length }
  } catch (error) {
    console.error('❌ Failed to parse file:', error)
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

// Run automation concurrently for multiple profiles with a concurrency limit
ipcMain.handle('run-automation-batch', async (_event, payload: { profileIds: string[]; scenario?: string; inputs?: Record<string, any> & { default?: any }; concurrency?: number }) => {
  try {
    const profileIds = Array.isArray(payload?.profileIds) ? payload.profileIds : []
    const scenario = payload?.scenario
    const inputs = payload?.inputs || {}
    const concurrency = Math.max(1, Math.floor(Number(payload?.concurrency) || 1))

    if (profileIds.length === 0) {
      return { success: false, error: 'profileIds is required and must be a non-empty array' }
    }

    console.log('[ipc] run-automation-batch', { count: profileIds.length, concurrency, scenario })

    const { runAutomationOnPage } = await import('./automation/ThreadsAutomationController.js')
    const results: Array<{ profileId: string; success: boolean; error?: string }> = []
    let cursor = 0
    const workers = Array.from({ length: Math.min(concurrency, profileIds.length) }, async () => {
      while (cursor < profileIds.length) {
        const index = cursor++
        const id = profileIds[index]
        const input = (inputs && (id in inputs)) ? inputs[id] : (inputs?.default ?? {})
        try {
          await withPage(id, async (page) => {
            const result = await runAutomationOnPage(page, { scenario, input })
            if (!result?.success) throw new Error(result?.error || 'Scenario failed')
          })
          results.push({ profileId: id, success: true })
          console.log('[ipc] automation finished for', id)
        } catch (e: any) {
          const message = e?.message || String(e)
          console.error('[ipc] automation failed for', id, message)
          results.push({ profileId: id, success: false, error: message })
        }
      }
    })

    await Promise.all(workers)
    return { success: true, results }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Unknown error' }
  }
})

// Custom Script Management APIs
const CUSTOM_SCRIPTS_DIR = path.join(__dirname, 'custom-scripts')

// Ensure custom scripts directory exists
if (!fs.existsSync(CUSTOM_SCRIPTS_DIR)) {
  fs.mkdirSync(CUSTOM_SCRIPTS_DIR, { recursive: true })
  console.log(`[scripts] Created custom scripts directory: ${CUSTOM_SCRIPTS_DIR}`)
}

// Upload and save custom script
ipcMain.handle('upload-custom-script', async (_event, { fileName, content }) => {
  try {
    // Ensure custom scripts directory exists before saving
    if (!fs.existsSync(CUSTOM_SCRIPTS_DIR)) {
      fs.mkdirSync(CUSTOM_SCRIPTS_DIR, { recursive: true })
      console.log(`[scripts] Created custom scripts directory: ${CUSTOM_SCRIPTS_DIR}`)
    }

    // Validate script content
    if (!content || typeof content !== 'string') {
      return { success: false, error: 'Invalid script content' }
    }

    // Desktop app - minimal validation since user owns the machine
    // Check if user provided automation logic
    if (!content.trim()) {
      return { success: false, error: 'Script content cannot be empty' }
    }

    // Normalize scenario id and output path
    const rawName = path.basename(String(fileName || 'custom-script'))
    const scenarioId = rawName.replace(/\.(ts|js|cjs)$/i, '').replace(/\s+/g, '-').toLowerCase()
    const scriptPath = path.join(CUSTOM_SCRIPTS_DIR, `${scenarioId}.cjs`)

    let code = String(content).trim()
    if (!code) return { success: false, error: 'Script content cannot be empty' }

    // Try to transpile to CJS regardless of extension (handles TS/ESM syntax in uploads)
    try {
      // Prefer TypeScript transpilation if available
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ts = require('typescript')
      const res = ts.transpileModule(code, {
        compilerOptions: {
          module: (ts as any).ModuleKind?.CommonJS ?? 1,
          target: (ts as any).ScriptTarget?.ES2020 ?? 7,
          removeComments: true,
        }
      })
      code = String(res.outputText || code).trim()
    } catch (e1) {
      try {
        // Fallback to esbuild if available
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const esbuild = require('esbuild')
        // Try TS loader first; if it fails, try JS loader to strip ESM
        let transformed = esbuild.transformSync(code, {
          loader: 'ts',
          format: 'cjs',
          platform: 'node',
          target: 'es2020',
        })
        code = String(transformed.code || code).trim()
      } catch (e2) {
        // If neither transpiler is available, keep code as-is (assume user provided CJS)
      }
    }

    // Ensure CJS export if user used ESM export
    if (!/module\.exports\s*=\s*\{\s*run\s*:?\s*run?\s*\}/.test(code)) {
      if (/export\s+async\s+function\s+run|export\s+\{\s*run\s*\}/.test(code)) {
        code += "\n\nmodule.exports = { run }\n"
      }
    }

    await promisify(fs.writeFile)(scriptPath, code, 'utf8')
    console.log(`[scripts] Script saved: ${scriptPath}`)
    return { success: true, id: scenarioId, scriptPath }
  } catch (error: any) {
    console.error('[scripts] Error uploading script:', error)
    console.error('[scripts] Error details:', {
      message: error?.message,
      code: error?.code,
      path: error?.path,
      stack: error?.stack
    })
    return { success: false, error: error?.message || 'Failed to upload script' }
  }
})

// Get list of custom scripts
ipcMain.handle('get-custom-scripts', async () => {
  try {
    const files = await promisify(fs.readdir)(CUSTOM_SCRIPTS_DIR)
    const scripts = files
      .filter(file => file.endsWith('.cjs')) // Only CommonJS files (template approach)
      .map(file => ({
        id: file.replace('.cjs', ''),
        name: file.replace('.cjs', '').replace(/_/g, ' '),
        fileName: file,
        path: path.join(CUSTOM_SCRIPTS_DIR, file)
      }))
    return { success: true, scripts }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to get custom scripts' }
  }
})

// Delete custom script
ipcMain.handle('delete-custom-script', async (_event, scriptId) => {
  try {
    const scriptPath = path.join(CUSTOM_SCRIPTS_DIR, `${scriptId}.cjs`)
    if (fs.existsSync(scriptPath)) {
      await promisify(fs.unlink)(scriptPath)
      return { success: true, message: 'Script deleted successfully' }
    }
    return { success: false, error: 'Script not found' }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to delete script' }
  }
})
