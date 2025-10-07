// CommonJS-compatible custom script (no top-level ESM imports)

//mớiii

// Pure helper function to normalize input data
const buildNormalizedInput = (input) => {
    // Normalize input keys with only case-insensitive and singular/plural variants
    const normalizeRecord = (raw = {}) => {
      try {
        const lowerMap = {}
        for (const [k, v] of Object.entries(raw)) {
          lowerMap[String(k).toLowerCase()] = v
        }
        const getByBase = (base) => {
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
  
    const normalizedInput = normalizeRecord(input)
    const baseItems = Array.isArray(input?.items) && input.items.length > 0 ? input.items : [input]
    const items = baseItems.map((r) => ({ ...(r || {}), ...normalizeRecord(r || {}) }))
  
    return { normalizedInput, items }
}


async function run(page, input = {}) {
    page.setDefaultTimeout(20000)
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

      // Load helpers dynamically (CJS-safe)
      const { humanDelay, humanTypeWithMistakes } = await import('../automation/human-behavior.js')

      // Navigate to login
      await page.goto('https://www.threads.com/login', { waitUntil: 'networkidle2' })
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

module.exports = { run }