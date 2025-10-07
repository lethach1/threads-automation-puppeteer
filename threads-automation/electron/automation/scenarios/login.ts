

export async function run(page: Page, input: Input = {}) {
    page.setDefaultTimeout(20000)
    try {
      console.log('Starting surfing threads and commenting...')
      
      const { normalizedInput, items } = buildNormalizedInput(input)
      
      console.log('📝 Raw Input:', input)
      console.log('[input] profile:', normalizedInput.profile)
      console.log('[input] feedsComment:', normalizedInput.feedsComment)
      console.log('[input] searchKeyword:', normalizedInput.searchKeyword)
      console.log('[input] topTabComment:', normalizedInput.topTabComment)
      console.log('[input] recentTabComment:', normalizedInput.recentTabComment)
      console.log('[input] commentPool count:', normalizedInput.commentPool?.length || 0)
      console.log('[input] linkShopee:', normalizedInput.linkShopee)
      console.log('[input] prompt:', normalizedInput.prompt)
      console.log('[input] gptKey:', normalizedInput.gptKey)
      console.log('[input] items count:', items.length)   
  
      //start script
      // Step 1: Navigate to Threads
      console.log('Step 1: Navigate to Threads')
      await page.goto('https://threads.com/', { waitUntil: 'networkidle2' })
      await humanDelay(2000, 4000)
  
     
      
      return { success: true }
  
    } catch (error) {
      console.error('Post and Comment automation failed:', error)
      // Rethrow so upstream IPC can catch and report properly
      throw error
    } finally {
      await page.close()
      const browser = page.browser()
      await browser.close()
    }
  }
  
  