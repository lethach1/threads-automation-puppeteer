import type { Page } from 'puppeteer-core'
// @ts-ignore
import { 
  humanDelay, 
  humanTypeWithMistakes
} from '../human-behavior.js'

type Input = {
  postText?: string
  commentText?: string
  mediaPath?: string
}

export async function run(page: Page, input: Input = {}) {
  // Improve debuggability: surface errors and page logs
  page.setDefaultTimeout(20000)
  page.on('pageerror', (e) => console.error('[pageerror]', e))
  page.on('error', (e) => console.error('[targeterror]', e))
  page.on('console', (m) => console.log('[console]', m.type?.(), m.text?.()))
  try {
    console.log('🚀 Starting Post and Comment automation...')
    console.log('📝 Input:', input)
    console.log('[input] postText:', input.postText)
    console.log('[input] commentText:', input.commentText)
    console.log('[input] mediaPath:', input.mediaPath)
    
    // Step 1: Navigate to Threads
    console.log('📍 Step 1: Navigating to Threads...')
    await page.goto('https://threads.com/', { waitUntil: 'networkidle2' })
    await humanDelay(2000, 4000)
    console.log('✅ Step 1 completed: Navigation successful')

    // Step 2: Click to open post composer
    console.log('📍 Step 2: Opening post composer...')
    await page.waitForSelector('.x1i10hfl > .xc26acl', { timeout: 10000 })
    await humanDelay(1000, 2000)
    await page.click('.x1i10hfl > .xc26acl')
    await humanDelay(2000, 3000)
    console.log('✅ Step 2 completed: Post composer opened')

    // Step 3: Write status with human-like typing
    if (input.postText) {
      console.log('📍 Step 3: Writing post text...')
      await page.waitForSelector('.xzsf02u > .xdj266r', { timeout: 10000 })
      await humanDelay(1000, 2000)
      
      // Clear any existing text first
      await page.click('.xzsf02u > .xdj266r')
      await humanDelay(500, 1000)
      await page.keyboard.down('Control')
      await page.keyboard.press('KeyA')
      await page.keyboard.up('Control')
      await humanDelay(200, 500)
      
      // Type with human-like behavior
      console.log('⌨️ Typing post text:', input.postText)
      await humanTypeWithMistakes(page, '.xzsf02u > .xdj266r', input.postText)
      await humanDelay(1000, 2000)
      console.log('✅ Step 3 completed: Post text written')
    }

    // Step 4: Click to select image if mediaPath provided
    if (input.mediaPath) {
      console.log('📍 Step 4: Uploading image...')
      await page.waitForSelector('.x1uvtmcs > .__fb-dark-mode', { timeout: 10000 })
      await humanDelay(1000, 2000)
      await page.click('.x1uvtmcs > .__fb-dark-mode')
      await humanDelay(1000, 2000)
      
      // Upload image
      const fileInput = await page.$('input[type="file"]')
      if (fileInput) {
        console.log('📷 Uploading image:', input.mediaPath)
        await fileInput.uploadFile(input.mediaPath)
        await humanDelay(2000, 4000) // Wait for image to load
        console.log('✅ Step 4 completed: Image uploaded')
      }
    }

    // Step 5: Click "Add to Threads"
    console.log('📍 Step 5: Adding to Threads...')
    await page.waitForSelector('.x78zum5 > .x6s0dn4 > .x1i10hfl > .x1lliihq', { timeout: 10000 })
    await humanDelay(1000, 2000)
    await page.click('.x78zum5 > .x6s0dn4 > .x1i10hfl > .x1lliihq')
    await humanDelay(2000, 3000)
    console.log('✅ Step 5 completed: Added to Threads')

    // Step 6: Write second status if provided
    if (input.postText) {
      console.log('📍 Step 6: Writing second status...')
      await page.waitForSelector('.x1uvtmcs > .__fb-dark-mode', { timeout: 10000 })
      await humanDelay(1000, 2000)
      
      await page.click('.x1uvtmcs > .__fb-dark-mode')
      await humanDelay(500, 1000)
      await page.keyboard.down('Control')
      await page.keyboard.press('KeyA')
      await page.keyboard.up('Control')
      await humanDelay(200, 500)
      
      console.log('⌨️ Typing second status:', input.postText)
      await humanTypeWithMistakes(page, '.x1uvtmcs > .__fb-dark-mode', input.postText)
      await humanDelay(1000, 2000)
      console.log('✅ Step 6 completed: Second status written')
    }

    // Step 7: Click "Add Topic"
    await page.waitForSelector('input.xwhw2v2', { timeout: 10000 })
    await humanDelay(1000, 2000)
    await page.click('input.xwhw2v2')
    await humanDelay(1000, 2000)

    // Step 8: Click "Posting"
    console.log('📍 Step 8: Posting content...')
    await page.waitForSelector('.x2lah0s:nth-child(1) > .x1i10hfl > .xc26acl', { timeout: 10000 })
    await humanDelay(1000, 2000)
    await page.click('.x2lah0s:nth-child(1) > .x1i10hfl > .xc26acl')
    await humanDelay(3000, 5000) // Wait for post to be published
    console.log('✅ Step 8 completed: Content posted successfully')

    // Step 9: Click into profile
    await page.waitForSelector('.x78zum5 > .x1i10hfl > .x90nhty > .xl1xv1r', { timeout: 10000 })
    await humanDelay(2000, 3000)
    await page.click('.x78zum5 > .x1i10hfl > .x90nhty > .xl1xv1r')
    await humanDelay(3000, 5000)

    // Step 10: Click to write comment on latest post
    await page.waitForSelector('.x1c1b4dv:nth-child(7) .x78zum5:nth-child(1) > .x9f619:nth-child(1) .x1xdureb:nth-child(3) .x6s0dn4:nth-child(2) .x1lliihq:nth-child(1)', { timeout: 10000 })
    await humanDelay(1000, 2000)
    await page.click('.x1c1b4dv:nth-child(7) .x78zum5:nth-child(1) > .x9f619:nth-child(1) .x1xdureb:nth-child(3) .x6s0dn4:nth-child(2) .x1lliihq:nth-child(1)')
    await humanDelay(2000, 3000)

    // Step 11: Write comment with human-like typing
    if (input.commentText) {
      console.log('📍 Step 11: Writing comment...')
      await page.waitForSelector('.xzsf02u > .xdj266r', { timeout: 10000 })
      await humanDelay(1000, 2000)
      
      await page.click('.xzsf02u > .xdj266r')
      await humanDelay(500, 1000)
      await page.keyboard.down('Control')
      await page.keyboard.press('KeyA')
      await page.keyboard.up('Control')
      await humanDelay(200, 500)
      
      console.log('⌨️ Typing comment:', input.commentText)
      await humanTypeWithMistakes(page, '.xzsf02u > .xdj266r', input.commentText)
      await humanDelay(1000, 2000)
      console.log('✅ Step 11 completed: Comment written')
    }

    // Step 12: Click "Posting" for comment
    await page.waitForSelector('.x2lah0s:nth-child(1) > .x1i10hfl > .xc26acl', { timeout: 10000 })
    await humanDelay(1000, 2000)
    await page.click('.x2lah0s:nth-child(1) > .x1i10hfl > .xc26acl')
    await humanDelay(3000, 5000)

    // Step 13: Click into first post details
    await page.waitForSelector('.x1c1b4dv:nth-child(7) .x78zum5:nth-child(1) > .x9f619 .x1ypdohk > .xrvj5dj', { timeout: 10000 })
    await humanDelay(2000, 3000)
    await page.click('.x1c1b4dv:nth-child(7) .x78zum5:nth-child(1) > .x9f619 .x1ypdohk > .xrvj5dj')
    await humanDelay(3000, 5000)

    // Step 14: Reload page
    await page.reload({ waitUntil: 'networkidle2' })
    await humanDelay(3000, 5000)

    // Step 15: Click to pin comment
    console.log('📍 Step 15: Pinning comment...')
    await page.waitForSelector('.xqcrz7y .xkqq1k2 .x1lliihq', { timeout: 10000 })
    await humanDelay(1000, 2000)
    await page.click('.xqcrz7y .xkqq1k2 .x1lliihq')
    await humanDelay(1000, 2000)

    await page.waitForSelector('.x1i10hfl:nth-child(2) > .x6s0dn4', { timeout: 10000 })
    await humanDelay(1000, 2000)
    await page.click('.x1i10hfl:nth-child(2) > .x6s0dn4')
    await humanDelay(2000, 3000)
    console.log('✅ Step 15 completed: Comment pinned')

    console.log('🎉 All automation steps completed successfully!')
    return { success: true }

  } catch (error) {
    console.error('❌ Post and Comment automation failed:', error)
    // Rethrow so upstream IPC can catch and report properly
    throw error
  }
}


