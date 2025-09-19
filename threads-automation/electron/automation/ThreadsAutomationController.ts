import type { Page } from 'puppeteer-core'

export type ScenarioResult = { success: boolean; data?: any; error?: string }

export const runAutomationOnPage = async (
  page: Page,
  opts?: { scenario?: string; input?: any }
): Promise<ScenarioResult> => {
  const scenario = (opts?.scenario || 'openHomepage').trim()

  try {
    switch (scenario) {
      case 'openHomepage': {
        await page.goto('https://threads.com/', { waitUntil: 'networkidle2' })
        return { success: true }
      }
      default: {
        // Dynamic import of scenario module by name
        const mod = await import(`./scenarios/${scenario}.js`)
        if (!mod?.run) throw new Error(`Scenario '${scenario}' not found`)
        const result: ScenarioResult = await mod.run(page, opts?.input)
        return result ?? { success: true }
      }
    }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Scenario error' }
  }
}


