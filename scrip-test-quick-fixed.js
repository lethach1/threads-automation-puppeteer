// Custom script for testing multiple website navigation
async function run(page, input = {}) {
  page.setDefaultTimeout(60000)
  page.setDefaultNavigationTimeout(90000)
  
  try {
    console.log('🚀 Starting custom navigation test...')
    console.log('📝 Input:', input)
    
    // Load helpers dynamically (CJS-safe)
    const { humanDelay } = await import('../automation/human-behavior.js')

    // Robust navigation helper with retry + backoff
    const navigateWithRetry = async (targetUrl, maxAttempts = 3) => {
      let lastError
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 90000 })
          return
        } catch (err) {
          lastError = err
          const backoffMs = 2000 * attempt
          console.warn(`[custom.nav] attempt ${attempt}/${maxAttempts} failed. Retrying in ${backoffMs}ms...`)
          await humanDelay(backoffMs, backoffMs + 500)
        }
      }
      throw lastError
    }
    
    // Navigate to multiple websites for testing
    console.log('🌐 Navigating to YouTube...')
    await navigateWithRetry('https://www.youtube.com/@13k_ichimansanzen')
    await humanDelay(2000, 4000)

    console.log('📧 Navigating to Gmail...')
    await navigateWithRetry('https://workspace.google.com/intl/vi/gmail/')
    await humanDelay(2000, 4000)
    
    console.log('🎵 Navigating to SoundCloud...')
    await navigateWithRetry('https://soundcloud.com/discover')
    await humanDelay(2000, 4000)
    
    console.log('👥 Navigating to Facebook...')
    await navigateWithRetry('https://www.facebook.com/')
    await humanDelay(2000, 4000)

    console.log('✅ Custom navigation test completed successfully!')
    return { success: true, message: 'Navigation test completed' }

  } catch (error) {
    console.error('❌ Custom navigation test failed:', error)
    return { success: false, error: error.message }
  } finally {
    await page.close()
    const browser = page.browser()
    await browser.close()
  }
}

module.exports = { run }
