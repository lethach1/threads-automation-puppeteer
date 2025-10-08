// Custom script for testing multiple website navigation
async function run(page, input = {}) {
  page.setDefaultTimeout(20000)
  
  try {
    console.log('🚀 Starting custom navigation test...')
    console.log('📝 Input:', input)
    
    // Load helpers dynamically (CJS-safe)
    const { humanDelay } = await import('../automation/human-behavior.js')
    
    // Navigate to multiple websites for testing
    console.log('🌐 Navigating to YouTube...')
    await page.goto('https://www.youtube.com/@13k_ichimansanzen', { waitUntil: 'networkidle2' })
    await humanDelay(2000, 4000)

    console.log('📧 Navigating to Gmail...')
    await page.goto('https://workspace.google.com/intl/vi/gmail/', { waitUntil: 'networkidle2' })
    await humanDelay(2000, 4000)
    
    console.log('🎵 Navigating to SoundCloud...')
    await page.goto('https://soundcloud.com/discover', { waitUntil: 'networkidle2' })
    await humanDelay(2000, 4000)
    
    console.log('👥 Navigating to Facebook...')
    await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2' })
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
