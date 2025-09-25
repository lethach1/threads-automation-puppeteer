// Custom Post and Comment Automation Script
// All functions (humanDelay, humanClick, etc.) and modules (fs, path) are available globally

async function run(page, input = {}) {
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
    
    // Build list of comments from dynamic fields: Comment1..N, Comments, commentText
    const extractCommentTexts = (raw: Record<string, any>): string[] => {
      try {
        const entries = Object.entries(raw || {})
        // Collect keys matching Comment / Comment1..N (case-insensitive)
        const numbered: Array<{ order: number; value: string }> = []
        let singleCommentsCell = ''
        let legacySingle = ''

        for (const [key, val] of entries) {
          if (val == null) continue
          const str = String(val).trim()
          if (!str) continue
          const lower = key.toLowerCase()
          if (lower === 'comments') {
            singleCommentsCell = str
            continue
          }
          if (lower === 'commenttext') {
            legacySingle = str
            continue
          }
          const match = /^comment(\d+)?$/i.exec(key)
          if (match) {
            const order = match[1] ? parseInt(match[1], 10) : 0
            numbered.push({ order, value: str })
          }
        }

        // Sort numbered comments by order (Comment, Comment1, Comment2, ...)
        numbered.sort((a, b) => a.order - b.order)
        const fromNumbered = numbered.map((n) => n.value)

        // Fallback: split Comments cell by | or newline
        let fromSingleCell: string[] = []
        if (!fromNumbered.length && singleCommentsCell) {
          fromSingleCell = singleCommentsCell
            .split(/\||\r\n|\n/)
            .map((s) => s.trim())
            .filter(Boolean)
        }

        // Legacy fallback: single commentText
        let fromLegacy: string[] = []
        if (!fromNumbered.length && !fromSingleCell.length && legacySingle) {
          fromLegacy = [legacySingle]
        }

        const combined = [...fromNumbered, ...fromSingleCell, ...fromLegacy]
          .map((s) => s.trim())
          .filter(Boolean)

        return combined
      } catch (e) {
        console.log('🟨 extractCommentTexts error:', (e as any)?.message || e)
        return []
      }
    }

    //start script
    // Step 1: Navigate to Threads
    console.log('📍 Step 1: Start script')
    await page.goto('https://threads.com/', { waitUntil: 'networkidle2' })
    await humanDelay(2000, 4000)

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
      if (mediaPathStr && fs.existsSync(mediaPathStr)) {
        try {
          const stat = fs.statSync(mediaPathStr)
          // Build list of file paths to upload
          const imagePaths = stat.isDirectory()
            ? fs.readdirSync(mediaPathStr)
                .filter((f) => /\.(jpe?g|png|gif|webp|bmp|tiff?)$/i.test(f))
                .map((f) => path.join(mediaPathStr, f))
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

        const commentTexts = extractCommentTexts(item as any)
        console.log(`🗨️ Comments to post: ${commentTexts.length}`)

        for (let j = 0; j < commentTexts.length; j++) {
          const comment = commentTexts[j]
          const attemptPost = async () => {
            await waitForElements(page,'.xzsf02u > .xdj266r')
            await humanClick(page,'.xzsf02u > .xdj266r')
            console.log(`⌨️ Typing comment ${j + 1}/${commentTexts.length}:`, comment.slice(0, 80))
            await humanTypeWithMistakes(page, '.xzsf02u > .xdj266r', comment)
            await waitForElements(page,'.x2lah0s:nth-child(1) > .x1i10hfl > .xc26acl')
            await humanClick(page,'.x2lah0s:nth-child(1) > .x1i10hfl > .xc26acl')
          }

          await attemptPost()
          await humanDelay(2000, 3000)
          console.log(`✅ Comment ${j + 1} posted`)

          // Human-like delay between comments
          if (j < commentTexts.length - 1) {
            await humanDelay(2000, 5000)
          }
        }

        await page.reload({ waitUntil: 'networkidle2' })
        await humanDelay(3000, 5000)

      await humanClick(page,'.x1ypdohk > path')
    }
    }

    

    console.log('🎉 All automation steps completed successfully!')
    return { success: true }

  } catch (error) {
    console.error('❌ Post and Comment automation failed:', error)
    return { success: false, error: error.message }
  }
}

// Export the run function
module.exports = { run }





