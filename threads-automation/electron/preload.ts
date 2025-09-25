import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // You can expose other APTs you need here.
  // ...
})

// Convenience API for file/directory selection in renderer
contextBridge.exposeInMainWorld('api', {
  selectDirectory: async (): Promise<string> => {
    try {
      const dir = await ipcRenderer.invoke('select-directory')
      return typeof dir === 'string' ? dir : ''
    } catch {
      return ''
    }
  },
  selectFile: async (): Promise<string> => {
    try {
      const file = await ipcRenderer.invoke('select-file')
      return typeof file === 'string' ? file : ''
    } catch {
      return ''
    }
  },
  parseCsv: async (filePath: string): Promise<{ headers: string[], rows: Record<string, string>[], totalRows: number }> => {
    try {
      return await ipcRenderer.invoke('parse-csv', filePath)
    } catch (error) {
      console.error('Failed to parse CSV:', error)
      throw error
    }
  },
  readFile: async (filePath: string): Promise<string> => {
    try {
      return await ipcRenderer.invoke('read-file', filePath)
    } catch (error) {
      console.error('Failed to read file:', error)
      throw error
    }
  },
  selectScriptFile: async (): Promise<string> => {
    try {
      return await ipcRenderer.invoke('select-script-file')
    } catch (error) {
      console.error('Failed to select script file:', error)
      throw error
    }
  }
})

// Automation API for running profiles
contextBridge.exposeInMainWorld('automationApi', {
  runOpenProfiles: async (payload: {
    profileIds: string[]
    windowWidth?: number
    windowHeight?: number
    scalePercent?: number
    concurrency?: number
  }) => {
    try {
      return await ipcRenderer.invoke('run-open-profiles', payload)
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Unknown error'
      }
    }
  },
  runAutomationForProfile: async (payload: { profileId: string; scenario?: string; input?: any }) => {
    try {
      return await ipcRenderer.invoke('run-automation-for-profile', payload)
    } catch (error: any) {
      return { success: false, error: error?.message || 'Unknown error' }
    }
  },
  closeProfile: async (profileId: string) => {
    try {
      return await ipcRenderer.invoke('close-profile', profileId)
    } catch (error: any) {
      return { success: false, error: error?.message || 'Unknown error' }
    }
  }
})

// Custom Script Management API
contextBridge.exposeInMainWorld('customScriptApi', {
  uploadScript: async (fileName: string, content: string) => {
    try {
      return await ipcRenderer.invoke('upload-custom-script', { fileName, content })
    } catch (error: any) {
      return { success: false, error: error?.message || 'Unknown error' }
    }
  },
  getCustomScripts: async () => {
    try {
      return await ipcRenderer.invoke('get-custom-scripts')
    } catch (error: any) {
      return { success: false, error: error?.message || 'Unknown error' }
    }
  },
  deleteCustomScript: async (scriptId: string) => {
    try {
      return await ipcRenderer.invoke('delete-custom-script', scriptId)
    } catch (error: any) {
      return { success: false, error: error?.message || 'Unknown error' }
    }
  }
})