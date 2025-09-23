import type { Page } from 'puppeteer-core'
import { existsSync, statSync, readdirSync } from 'fs'
import { join as pathJoin } from 'path'
// @ts-ignore
import { 
  humanDelay, 
  humanTypeWithMistakes,
  waitForElements,
  humanClick
} from '../human-behavior.js'

type Input = {
  postText?: string
  commentText?: string
  mediaPath?: string
  tag?: string
  schedule?: string
  items?: Array<{ postText?: string; commentText?: string; mediaPath?: string; tag?: string; schedule?: string }>
}

export async function run(page: Page, input: Input = {}) {
  // Improve debuggability: surface errors and page logs
  page.setDefaultTimeout(20000)
  page.on('pageerror', (e) => console.error('[pageerror]', e))
  page.on('error', (e) => console.error('[targeterror]', e))
  // Removed verbose console relay from page to keep logs clean
  try {
    console.log('🚀 Starting Post and Comment automation...')
    console.log('📝 Input:', input)
    console.log('[input] postText:', input.postText)
    console.log('[input] commentText:', input.commentText)
    console.log('[input] mediaPath:', input.mediaPath)
    if (input.schedule) console.log('[input] schedule:', input.schedule)
    const items = Array.isArray(input.items) && input.items.length > 0
      ? input.items
      : [{ postText: input.postText, commentText: input.commentText, mediaPath: input.mediaPath, tag: input.tag, schedule: input.schedule }]
    console.log('[input] items count:', items.length)
    
    // Step 1: Navigate to Threads
    console.log('📍 Step 1: Navigating to Threads...')
    await page.goto('https://threads.com/', { waitUntil: 'networkidle2' })
    await humanDelay(2000, 4000)
    console.log('✅ Step 1 completed: Navigation successful')

    // Unified loop: first item runs full flow; subsequent items run lightweight post-only flow
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const isFirst = i === 0

      // Step 2: Open composer
      console.log(`📍 ${isFirst ? 'Step 2' : 'Extra'}: Opening post composer...`)
      await waitForElements(page,'.x1i10hfl > .xc26acl')
      await humanClick(page,'.x1i10hfl > .xc26acl')

      // Step 3: Type post
      if (item.postText) {
        if (isFirst) console.log('📍 Step 3: Writing post text...')
        await waitForElements(page,'.xzsf02u > .xdj266r')
        await humanClick(page,'.xzsf02u > .xdj266r')
        console.log('⌨️ Typing post text:', item.postText)
        await humanTypeWithMistakes(page, '.xzsf02u > .xdj266r', item.postText)
      }

      // Step 4: Upload media (file or all images in a folder). Skip gracefully if invalid.
      const mediaPathStr = (item.mediaPath || '').trim()
      if (mediaPathStr && existsSync(mediaPathStr)) {
        try {
          const stat = statSync(mediaPathStr)
          // Build list of file paths to upload
          const imagePaths: string[] = stat.isDirectory()
            ? readdirSync(mediaPathStr)
                .filter((f) => /\.(jpe?g|png|gif|webp|bmp|tiff?)$/i.test(f))
                .map((f) => pathJoin(mediaPathStr, f))
            : stat.isFile() ? [mediaPathStr] : []

            if (imagePaths.length > 0) {
            if (isFirst) console.log(`📍 Step 4: Uploading ${imagePaths.length} image(s)...`)
            for (const [idx, filePath] of imagePaths.entries()) {
              try {
                // Try to find an existing file input first
                let fileInput = await page.$('input[type="file"]')
                if (fileInput) {
                  console.log('🔎 Using existing file input (no button click)')
                }
                if (!fileInput) {
                  const candidateSelectors = [
                    '.x6s0dn4 > .x1i10hfl:nth-child(1) > .x1n2onr6 > .x1lliihq'
                  ]
                  let clicked = false
                  for (const sel of candidateSelectors) {
                    const btn = await page.$(sel)
                    if (btn) {
                      await humanDelay(300, 700)
                      await humanClick(page,sel)
                      console.log('🖱️ Clicked add-media button with selector:', sel)
                      clicked = true
                      break
                    }
                  }
                  if (clicked) {
                    await humanDelay(500, 1000)
                    fileInput = await page.$('input[type="file"]')
                    if (fileInput) {
                      console.log('✅ Found file input after clicking button')
                    } else {
                      console.log('⚠️ Still no file input after button click')
                    }
                  }
                }
                if (fileInput) {
                  console.log(`📷 Uploading image ${idx + 1}/${imagePaths.length}:`, filePath)
                  await fileInput.uploadFile(filePath)
                  await humanDelay(1500, 2500)
                } else {
                  console.log('🟨 File input not found; skipping this image')
                }
              } catch (err) {
                console.log('🟨 Upload single image failed:', (err as any)?.message || err)
              }
            }
          } else {
            console.log('🟨 No images found to upload in path:', mediaPathStr)
          }
        } catch (e) {
          console.log('🟨 Media upload skipped due to error:', (e as any)?.message || e)
        }
      } else if (mediaPathStr) {
        console.log('🟨 Invalid media path, skipping upload:', mediaPathStr)
      }

      // Step 5/7: Add Topic (tags)
      if (item.tag) {
        if (isFirst) console.log('📍 Step 7: Adding topic/tag...')
        await waitForElements(page,'input.xwhw2v2')
        await humanClick(page,'input.xwhw2v2')
        await humanTypeWithMistakes(page, 'input.xwhw2v2', item.tag)
      }

      // Step 8: Post
      if (isFirst) console.log('📍 Step 8: Posting content...')
      await waitForElements(page,'.x2lah0s:nth-child(1) > .x1i10hfl > .xc26acl')
      await humanClick(page,'.x2lah0s:nth-child(1) > .x1i10hfl > .xc26acl')
      await humanDelay(2000, 4000)

      if (isFirst) {
        console.log('✅ Step 8 completed: Content posted successfully')

        // Step 9-15: Profile navigation, comment, pin (only for first item)
        await waitForElements(page,'.x78zum5 > .x1i10hfl > .x90nhty > .xl1xv1r')
        await humanClick(page,'.x78zum5 > .x1i10hfl > .x90nhty > .xl1xv1r')
        await humanDelay(1000, 2000)

        await waitForElements(page,'.x1c1b4dv:nth-child(7) .x78zum5:nth-child(1) > .x9f619:nth-child(1) .x1xdureb:nth-child(3) .x6s0dn4:nth-child(2) .x1lliihq:nth-child(1)')
        await humanClick(page,'.x1c1b4dv:nth-child(7) .x78zum5:nth-child(1) > .x9f619:nth-child(1) .x1xdureb:nth-child(3) .x6s0dn4:nth-child(2) .x1lliihq:nth-child(1)')
        await humanDelay(1000, 2000)

        if (item.commentText) {
          // mở comment và viết comment
          await waitForElements(page,'.xzsf02u > .xdj266r')
          await humanClick(page,'.xzsf02u > .xdj266r')
          console.log('⌨️ Typing comment:', item.commentText)
          await humanTypeWithMistakes(page, '.xzsf02u > .xdj266r', item.commentText)
        }
  
        // click đăng comment
        await waitForElements(page,'.x2lah0s:nth-child(1) > .x1i10hfl > .xc26acl')
        await humanClick(page,'.x2lah0s:nth-child(1) > .x1i10hfl > .xc26acl')
        await humanDelay(2000, 3000)
        console.log('Step 9 completed: comment posted successfully')

        await page.reload({ waitUntil: 'networkidle2' })
        await humanDelay(3000, 5000)

        //  click mở trang comment  
        await waitForElements(page,'.x78zum5:nth-child(1) > .x9f619 > .x1a2a7pz .x4vbgl9 > .x78zum5')
        await humanClick(page,'.x78zum5:nth-child(1) > .x9f619 > .x1a2a7pz .x4vbgl9 > .x78zum5')
        console.log('Step 10 completed: comment page opened')

        // reload page để load lại dom
        await page.reload({ waitUntil: 'networkidle2' })
        await humanDelay(3000, 5000)
        console.log('Step 11 completed: page reloaded')

        // mở tuỳ chọn pin comment
        await waitForElements(page,'.xqcrz7y .xkqq1k2 .x1lliihq')
        await humanClick(page,'.xqcrz7y .xkqq1k2 .x1lliihq')
        console.log('📍 Step 15: Pinning comment...')


        // click pin comment
        await waitForElements(page,'.x1i10hfl:nth-child(2) > .x6s0dn4')
        await humanClick(page,'.x1i10hfl:nth-child(2) > .x6s0dn4')
        console.log('✅ Step 15 completed: Comment pinned')
      }
      await humanClick(page,'.x1ypdohk > path')
    }

    

    console.log('🎉 All automation steps completed successfully!')
    return { success: true }

  } catch (error) {
    console.error('❌ Post and Comment automation failed:', error)
    // Rethrow so upstream IPC can catch and report properly
    throw error
  }
}





