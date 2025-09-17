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

// Convenience API for directory selection in renderer
contextBridge.exposeInMainWorld('api', {
  selectDirectory: async (): Promise<string> => {
    try {
      const dir = await ipcRenderer.invoke('select-directory')
      return typeof dir === 'string' ? dir : ''
    } catch {
      return ''
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
  }
})