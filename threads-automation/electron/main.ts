import { app, BrowserWindow, dialog, ipcMain } from 'electron'
// import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'fs'
import { promisify } from 'util'
import { spawn } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// IMPORTANT: Avoid importing modules that pull puppeteer/ws to prevent bufferutil issues
// type OpenProfileOptions = { windowWidth: number; windowHeight: number; scalePercent: number } // Không sử dụng

// Import sessionManager with error handling
let sessionManager: any = null

// Use require for external modules after env flags are set
// const require = createRequire(import.meta.url)

// Hint ws to skip optional native deps to avoid bundler resolution issues
process.env.WS_NO_BUFFER_UTIL = '1'
process.env.WS_NO_UTF_8_VALIDATE = '1'

// Enable Chromium/Electron logging to the console window (Windows debug builds)
// app?.commandLine?.appendSwitch?.('enable-logging')  // Tắt verbose logging

// Global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error)
  // Don't exit the process, just log the error
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
  // Don't exit the process, just log the error
})

// Enable debug mode if DEBUG environment variable is set
if (process.env.DEBUG === 'true') {
  app?.commandLine?.appendSwitch?.('remote-debugging-port', '9222')
  // app?.commandLine?.appendSwitch?.('enable-logging')  // Tắt verbose logging
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

// Console logging setup
let consoleSetup = false
let logFile = ''
let originalLog: any, originalError: any, originalWarn: any

// Auto-cleanup old log files (older than 3 days)
const cleanupOldLogs = () => {
  try {
    const logDir = path.join(process.env.TEMP || '', 'ThreadsAutomation')
    if (!fs.existsSync(logDir)) return
    
    const files = fs.readdirSync(logDir)
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000) // 3 days in milliseconds
    let cleanedCount = 0
    
    for (const file of files) {
      const filePath = path.join(logDir, file)
      
      try {
        const stats = fs.statSync(filePath)
        
        // Xóa file cũ hơn 3 ngày
        if (stats.mtime.getTime() < threeDaysAgo) {
          fs.unlinkSync(filePath)
          cleanedCount++
          console.log(`🗑️ Cleaned up old log: ${file}`)
        }
      } catch (fileError) {
        console.warn(`Failed to process file ${file}:`, fileError)
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`✅ Cleanup completed: removed ${cleanedCount} old log files`)
    }
  } catch (error) {
    console.warn('Failed to cleanup old logs:', error)
  }
}

const setupConsoleLogging = () => {
  if (consoleSetup) return
  
  try {
    // Cleanup old logs first
    cleanupOldLogs()
    
    // Create log file path
    const logDir = path.join(process.env.TEMP || '', 'ThreadsAutomation')
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }
    
    logFile = path.join(logDir, `threads-automation-${Date.now()}.log`)
    
    // Override console.log to write to file as well
    originalLog = console.log
    originalError = console.error
    originalWarn = console.warn
    
    const writeToFile = (level: string, ...args: any[]) => {
      const now = new Date()
      const timestamp = now.toISOString().replace('T', ' ').replace('Z', '').slice(0, 23)
      const message = `[${timestamp}] [${level}] ${args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')}\n`
      
      try {
        fs.appendFileSync(logFile, message, 'utf8')
      } catch (err) {
        // Ignore file write errors
      }
      
      // Also call original console method
      if (level === 'ERROR') originalError(...args)
      else if (level === 'WARN') originalWarn(...args)
      else originalLog(...args)
    }
    
    console.log = (...args: any[]) => writeToFile('LOG', ...args)
    console.error = (...args: any[]) => writeToFile('ERROR', ...args)
    console.warn = (...args: any[]) => writeToFile('WARN', ...args)
    
    consoleSetup = true
    console.log('✅ Console logging setup completed')
  } catch (consoleError) {
    console.warn('Failed to setup console logging:', consoleError)
  }
}

// Function to open console window when automation starts
const openConsoleWindow = () => {
  if (!logFile) {
    setupConsoleLogging()
  }
  
  if (!VITE_DEV_SERVER_URL || process.env.SHOW_CONSOLE === 'true') {
    try {
      // Create a batch script that auto-refreshes logs every 2 seconds
      // This is the most reliable method that works on all Windows systems
      const batchContent = `@echo off
title Threads Automation - Console Logs
color 0A
echo ========================================
echo   Threads Automation - Console Logs
echo ========================================
echo.
echo Log file: ${logFile}
echo.
echo Auto-refreshing every 2 seconds...
echo Press Ctrl+C to stop
echo ========================================
echo.
:loop
cls
echo ======================================== Threads Automation Logs ========================================
echo Log file: ${logFile} ^| Auto-refresh every 2s ^| Press Ctrl+C to stop
echo =====================================================================================================
echo.
type "${logFile}" 2>nul
if errorlevel 1 (
  echo [Waiting for logs...]
)
timeout /t 2 /nobreak >nul
goto loop
`
      
      const tempBatchFile = path.join(process.env.TEMP || '', 'threads-automation-console.bat')
      fs.writeFileSync(tempBatchFile, batchContent, 'utf8')
      
      // Open in a new CMD window with /k to keep it open
      const consoleProcess = spawn('cmd.exe', ['/c', 'start', '"Threads Automation Logs"', 'cmd.exe', '/k', `"${tempBatchFile}"`], {
        detached: true,
        stdio: 'ignore',
        shell: true
      })
      
      consoleProcess.on('error', (error) => {
        console.warn('Console process error:', error)
      })
      
      consoleProcess.unref()
      console.log('✅ Console window opened for automation logs')
      console.log(`📝 Log file: ${logFile}`)
      console.log(`📝 Batch file: ${tempBatchFile}`)
    } catch (consoleError) {
      console.warn('Failed to open console window:', consoleError)
    }
  }
}

// Lazy load sessionManager
const loadSessionManager = async () => {
  if (!sessionManager) {
    try {
      sessionManager = await import('./sessionManager')
      console.log('✅ SessionManager loaded successfully')
    } catch (error) {
      console.error('❌ Failed to load sessionManager:', error)
      throw error
    }
  }
  return sessionManager
}

function createWindow() {
  try {
    win = new BrowserWindow({
      width: 1200,
      height: 900,
      minWidth: 1000,
      minHeight: 700,
      icon: path.join(process.env.APP_ROOT, 'src/assets/icon.png'),
      webPreferences: {
        preload: path.join(__dirname, 'preload.mjs'),
        nodeIntegration: false,
        contextIsolation: true,
      },
    })
  } catch (error) {
    console.error('Failed to create BrowserWindow:', error)
    // Try minimal window as fallback
    try {
      win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      })
    } catch (fallbackError) {
      console.error('Failed to create fallback window:', fallbackError)
      return
    }
  }

  // Setup console logging for production builds or when SHOW_CONSOLE=true
  if (!VITE_DEV_SERVER_URL || process.env.SHOW_CONSOLE === 'true') {
    setupConsoleLogging()
  }

  // Redirect console logs to main process console
  win.webContents.on('console-message', (_event, level, message, _line, _sourceId) => {
    const levelMap: Record<number, string> = { 0: 'INFO', 1: 'WARN', 2: 'ERROR', 3: 'DEBUG' }
    console.log(`[Renderer ${levelMap[level] || 'LOG'}] ${message}`)
  })

  // Optional: Uncomment to open DevTools (for debugging)
  // win.webContents.openDevTools()

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

app.whenReady().then(() => {
  try {
    createWindow()
    console.log('✅ App window created successfully')
  } catch (error) {
    console.error('❌ Failed to create app window:', error)
    // App will still run but without window
  }
})

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
    const { profileIds } = payload

    if (!Array.isArray(profileIds) || profileIds.length === 0) {
      return {
        success: false,
        error: 'profileIds is required and must be a non-empty array'
      }
    }

    // const options: OpenProfileOptions = {
    //   windowWidth: 800,    // Sử dụng default values
    //   windowHeight: 600,   // Sử dụng default values
    //   scalePercent: 100    // Sử dụng default values
    // }
    
    // Không cần concurrency limit vì đã xử lý ở frontend
    const sm = await loadSessionManager()
    const opened = await sm.openProfilesWithConcurrency(profileIds, profileIds.length)
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
    const sm = await loadSessionManager()
    const ok = await sm.closeProfile(profileId)
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
    
    // Open console window when automation starts
    openConsoleWindow()
    const { runAutomationOnPage } = await import('./automation/ThreadsAutomationController.js')
    console.log('[ipc] scenario:', scenario, 'input keys:', input ? Object.keys(input) : [])
    const sm = await loadSessionManager()
    await sm.withPage(profileId, async (page: any) => {
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

    // Open console window when batch automation starts
    openConsoleWindow()
    
    const { runAutomationOnPage } = await import('./automation/ThreadsAutomationController.js')
    const results: Array<{ profileId: string; success: boolean; error?: string }> = []
    let cursor = 0
    const workers = Array.from({ length: Math.min(concurrency, profileIds.length) }, async () => {
      while (cursor < profileIds.length) {
        const index = cursor++
        const id = profileIds[index]
        const input = (inputs && (id in inputs)) ? inputs[id] : (inputs?.default ?? {})
        try {
          const sm = await loadSessionManager()
          await sm.withPage(id, async (page: any) => {
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
// Initialize with safe fallback - don't create directories at startup
let CUSTOM_SCRIPTS_DIR: string = ''

// Lazy initialization function
const getCustomScriptsDir = (): string => {
  if (CUSTOM_SCRIPTS_DIR) {
    return CUSTOM_SCRIPTS_DIR
  }

  // Priority order for directory selection (all guaranteed to exist on Windows)
  const possibleDirs = [
    // 1. User's Documents folder (most reliable)
    path.join(process.env.USERPROFILE || '', 'Documents', 'ThreadsAutomation', 'custom-scripts'),
    
    // 2. User's Downloads folder (also very reliable)
    path.join(process.env.USERPROFILE || '', 'Downloads', 'ThreadsAutomation', 'custom-scripts'),
    
    // 3. Temp directory (always exists)
    path.join(process.env.TEMP || process.env.TMP || '', 'ThreadsAutomation', 'custom-scripts'),
    
    // 4. AppData Local (always exists)
    path.join(process.env.LOCALAPPDATA || '', 'ThreadsAutomation', 'custom-scripts')
  ]

  // Try each directory in order until one works
  for (const dirPath of possibleDirs) {
    try {
      if (!fs.existsSync(dirPath)) {
        // Ensure parent directories exist first
        const parentDir = path.dirname(dirPath)
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true })
        }
        fs.mkdirSync(dirPath, { recursive: true })
      }
      
      // Test write access
      const testFile = path.join(dirPath, 'test-write.tmp')
      fs.writeFileSync(testFile, 'test')
      fs.unlinkSync(testFile)
      
      // If we get here, this directory works
      CUSTOM_SCRIPTS_DIR = dirPath
      console.log(`[scripts] Using custom scripts directory: ${CUSTOM_SCRIPTS_DIR}`)
      return CUSTOM_SCRIPTS_DIR
    } catch (error) {
      console.warn(`[scripts] Failed to use directory ${dirPath}:`, error)
      continue
    }
  }

  // If all attempts failed, use temp as fallback
  const fallbackDir = path.join(process.env.TEMP || '', 'threads-automation-scripts')
  try {
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir, { recursive: true })
    }
    CUSTOM_SCRIPTS_DIR = fallbackDir
    console.log(`[scripts] Using fallback directory: ${CUSTOM_SCRIPTS_DIR}`)
    return CUSTOM_SCRIPTS_DIR
  } catch (error) {
    console.error('[scripts] All directory creation attempts failed:', error)
    throw new Error('Unable to create custom scripts directory')
  }
}

// Upload and save custom script
ipcMain.handle('upload-custom-script', async (_event, { fileName, content }) => {
  try {
    // Use lazy initialization
    const scriptsDir = getCustomScriptsDir()

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
    const scriptPath = path.join(scriptsDir, `${scenarioId}.cjs`)

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
    // Use lazy initialization
    const scriptsDir = getCustomScriptsDir()
    const files = await promisify(fs.readdir)(scriptsDir)
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

// Setup periodic cleanup every 6 hours
setInterval(() => {
  cleanupOldLogs()
}, 6 * 60 * 60 * 1000) // 6 hours in milliseconds

console.log('🕒 Log cleanup scheduled every 6 hours')
