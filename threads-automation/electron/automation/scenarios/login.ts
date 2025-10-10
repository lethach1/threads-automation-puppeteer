import type { Page } from 'puppeteer-core'
// @ts-ignore
// (removed unused imports)

// @ts-ignore
import { 
  humanDelay, 
  humanTypeWithMistakes,
} from '../human-behavior.js'



type Input = {
    profile?: string
    username?: string
    password?: string
    
    items?: Array<{ 
      profile?: string
      username?: string
      password?: string  
    }>
  }
  
  type NormalizedInput = {
    profile?: string
    username?: string
    password?: string
  }
  
  // Pure helper function to normalize input data
  const buildNormalizedInput = (input: Input) => {
    // Normalize input keys with only case-insensitive and singular/plural variants
    const normalizeRecord = (raw: Record<string, any> = {}): NormalizedInput => {
      try {
        const lowerMap: Record<string, any> = {}
        for (const [k, v] of Object.entries(raw)) {
          lowerMap[String(k).toLowerCase()] = v
        }
        const getByBase = (base: string) => {
          const singular = base.toLowerCase()
          const plural = `${singular}s`
          const val = lowerMap[singular] ?? lowerMap[plural]
          if (val == null) return undefined
          const str = String(val).trim()
          return str ? str : undefined
        }
        const profile = getByBase('Profile')
        const username = getByBase('Username')
        const password = getByBase('Password')
        
        return { 
          profile, 
          username, 
          password,
        }
      } catch {
        return { 
          profile: undefined, 
          username: undefined, 
          password: undefined, 
        }
      }
    }
  
    const normalizedInput = normalizeRecord(input as any)
    const baseItems = Array.isArray(input.items) && input.items.length > 0 ? input.items as any[] : [input as any]
    const items = baseItems.map((r) => ({ ...(r as any), ...normalizeRecord(r as any) }))
  
    return { normalizedInput, items }
  }


export async function run(page: Page, input: Input = {}) {
    page.setDefaultTimeout(60000)
    page.setDefaultNavigationTimeout(90000)
    try {
      console.log('Starting login...')
      
      const { normalizedInput, items } = buildNormalizedInput(input)
      
      console.log('📝 Raw Input:', input)
      console.log('[input] profile:', normalizedInput.profile)
      console.log('[input] username:', normalizedInput.username)
      // (do not log passwords)
      console.log('[input] items count:', items.length)   
  
      //start script (single attempt per session/profile)
      const username = (normalizedInput.username || '').toString()
      const password = (normalizedInput.password || '').toString()

      if (!username) {
        console.warn('[login] No username provided')
        return { success: false, message: 'No username provided' }
      }

      // Navigate to login (robust with retry + longer timeout)
      const navigateWithRetry = async (targetUrl: string, maxAttempts: number = 3) => {
        let lastError: unknown
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 90000 })
            return
          } catch (err) {
            lastError = err
            const backoffMs = 2000 * attempt
            console.warn(`[login.nav] attempt ${attempt}/${maxAttempts} failed. Retrying in ${backoffMs}ms...`)
            await humanDelay(backoffMs, backoffMs + 500)
          }
        }
        throw lastError
      }
      await navigateWithRetry('https://www.threads.com/login')
      await humanDelay(2000, 4000)

      // Clear inputs then type credentials
      await page.click('input[autocomplete="username"]', { clickCount: 3 })
      await page.keyboard.press('Backspace')
      await humanTypeWithMistakes(page, 'input[autocomplete="username"]', username)

      await page.click('input[autocomplete="current-password"]', { clickCount: 3 })
      await page.keyboard.press('Backspace')
      await humanTypeWithMistakes(page, 'input[autocomplete="current-password"]', password)
      await humanDelay(800, 1200)

      await page.keyboard.press('Enter')
      await humanDelay(5000, 7000)
      
      return { success: true }
  
    } catch (error) {
      console.error('Login automation failed:', error)
      // Rethrow so upstream IPC can catch and report properly
      throw error
    } finally {
      await page.close()
      const browser = page.browser()
      await browser.close()
    }
  }
  
  