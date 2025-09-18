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
      runAutomationForProfile(payload: { profileId: string; profileData?: any }): Promise<{
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
