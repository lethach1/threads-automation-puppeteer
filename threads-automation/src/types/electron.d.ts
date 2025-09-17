declare global {
  interface Window {
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
    }
  }
}

export {}
