declare global {
  interface Window {
    api: {
      selectDirectory(): Promise<string>
      selectFile(): Promise<string>
      parseCsv(filePath: string): Promise<{ headers: string[], rows: Record<string, string>[], totalRows: number }>
      readFile(filePath: string): Promise<string>
      selectScriptFile(): Promise<string>
    }
    automationApi: {
      runOpenProfiles(payload: {
        profileIds: string[]
        // windowWidth?: number  // Không cần sử dụng
        // windowHeight?: number // Không cần sử dụng
        // scalePercent?: number // Không cần sử dụng
      }): Promise<{
        success: boolean
        opened?: { profileId: string }[]
        error?: string
      }>
      runAutomationForProfile(payload: { profileId: string; scenario?: string; input?: any }): Promise<{
        success: boolean
        error?: string
      }>
      closeProfile(profileId: string): Promise<{
        success: boolean
        error?: string
      }>
    }
    customScriptApi: {
      uploadScript(fileName: string, content: string): Promise<{
        success: boolean
        scriptName?: string
        scriptPath?: string
        message?: string
        error?: string
      }>
      getCustomScripts(): Promise<{
        success: boolean
        scripts?: Array<{id: string, name: string, fileName: string, path: string}>
        error?: string
      }>
      deleteCustomScript(scriptId: string): Promise<{
        success: boolean
        message?: string
        error?: string
      }>
    }
  }
}

export {}
