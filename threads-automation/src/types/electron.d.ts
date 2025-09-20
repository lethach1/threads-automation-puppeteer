declare global {
  interface Window {
    api: {
      selectDirectory(): Promise<string>
      selectFile(): Promise<string>
      parseCsv(filePath: string): Promise<{ headers: string[], rows: Record<string, string>[], totalRows: number }>
    }
    automationApi: {
      runOpenProfiles(payload: {
        profileIds: string[]
        windowWidth?: number
        windowHeight?: number
        scalePercent?: number
        concurrency?: number
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
  }
}

export {}
