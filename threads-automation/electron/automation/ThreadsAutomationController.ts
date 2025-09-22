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
        // Robust module resolution with Vite: prefer TS glob (dev) then JS (build)
        console.log('[router] resolving scenario:', scenario)
        const tsModules = import.meta.glob('./scenarios/*.ts', { eager: true }) as Record<string, any>
        const jsModules = import.meta.glob('./scenarios/*.js', { eager: true }) as Record<string, any>
        const tsKey = `./scenarios/${scenario}.ts`
        const jsKey = `./scenarios/${scenario}.js`
        const mod = tsModules[tsKey] || jsModules[jsKey]
        if (!mod) throw new Error(`Scenario module not found: ${tsKey} | ${jsKey}`)
        if (!mod.run) throw new Error(`Scenario '${scenario}' has no exported 'run'`)
        console.log('[router] scenario module loaded')
        const result: ScenarioResult = await mod.run(page, opts?.input)
        return result ?? { success: true }
      }
    }
  } catch (error: any) {
    console.error('[router] scenario error:', error)
    return { success: false, error: error?.message || 'Scenario error' }
  }
}


