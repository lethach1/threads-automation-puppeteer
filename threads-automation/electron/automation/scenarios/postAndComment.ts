import type { Page } from 'puppeteer-core'
import { existsSync, statSync, readdirSync } from 'fs'
import { join as pathJoin } from 'path'
// @ts-ignore
import { 
  humanDelay, 
  humanTypeWithMistakes,
  humanClick
} from '../human-behavior.js'

type Input = {
  postText?: string
  commentText?: string
  mediaPath?: string
  tag?: string
  schedule?: string
  subPost?: string
  items?: Array<{ postText?: string; commentText?: string; mediaPath?: string; tag?: string; schedule?: string; subPost?: string; remainingPostChunks?: string[] }>
}

export async function run(page: Page, input: Input = {}) {
  // Improve debuggability: surface errors and page logs
  page.setDefaultTimeout(20000)
  page.on('pageerror', (e) => console.error('[pageerror]', e))
  page.on('error', (e) => console.error('[targeterror]', e))
  // Removed verbose console relay from page to keep logs clean
  try {
    console.log('🚀 Starting Post and Comment automation...')

    // Normalize input keys with only case-insensitive and singular/plural variants
    const normalizeRecord = (raw: Record<string, any> = {}) => {
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
        const postText = getByBase('post')
        const commentText = getByBase('comment')
        const mediaPath = getByBase('image')
        const tag = getByBase('tag')
        const schedule = getByBase('schedule')
        const subPost = getByBase('subpost')
        return { postText, commentText, mediaPath, tag, schedule, subPost }
      } catch {
        return { postText: undefined, commentText: undefined, mediaPath: undefined, tag: undefined, schedule: undefined, subPost: undefined }
      }
    }

    const normalizedInput = { ...normalizeRecord(input as any) }
    const baseItems = Array.isArray(input.items) && input.items.length > 0 ? input.items as any[] : [input as any]
    // Preserve original keys so extractCommentTexts can read 'Comment(s) N' fields
    const items = baseItems.map((r) => ({ ...(r as any), ...normalizeRecord(r as any) }))

    console.log('📝 Raw Input:', input)
    console.log('[input] postText:', normalizedInput.postText)
    console.log('[input] commentText:', normalizedInput.commentText)
    console.log('[input] mediaPath:', normalizedInput.mediaPath)
    console.log('[input] subPost:', normalizedInput.subPost)
    if (normalizedInput.schedule) console.log('[input] schedule:', normalizedInput.schedule)
    console.log('[input] items count:', items.length)
    
    // Build list of comments from dynamic fields: Comment1..N, Comments, commentText
    const extractCommentTexts = (raw: Record<string, any>): string[] => {
      try {
        const entries = Object.entries(raw || {})
        // Collect keys matching Comment / Comment1..N (case-insensitive)
        const numbered: Array<{ order: number; value: string }> = []

        for (const [key, val] of entries) {
          if (val == null) continue
          const str = String(val).trim()
          if (!str) continue
          // Match keys like Comment, Comment1, Comments, Comments 2 (case-insensitive, optional 's' and space)
          const match = /^comments?\s*(\d+)?$/i.exec(key)
          if (match) {
            const order = match[1] ? parseInt(match[1], 10) : 0
            numbered.push({ order, value: str })
          }
        }

        // Sort numbered comments by order (Comment, Comment1, Comment2, ...)
        numbered.sort((a, b) => a.order - b.order)
        const fromNumbered = numbered.map((n) => n.value)

        // Only use numbered comments; if none present, return empty list
        const fromNumberedTrimmed = fromNumbered
          .map((s) => s.trim())
          .filter(Boolean)

        return fromNumberedTrimmed
      } catch (e) {
        console.log('extractCommentTexts error:', (e as any)?.message || e)
        return []
      }
    }

    // Click Add Subpost, then target the last textbox and type text
    const addAndTypeSubPost = async (page: Page, text: string) => {
      // Click add subpost button
      const addSubpostButton = await page.$('.x6s0dn4:nth-child(2) > .x1i10hfl > .x1lliihq');
      if (!addSubpostButton) throw new Error('Add subpost button not found')
      await humanClick(page,addSubpostButton)
      console.log(`Clicked add subpost button`)
      // Brief wait for DOM to render the new editor
      await humanDelay(300, 700)
      const boxes = await page.$$('div[role="textbox"]')
      console.log(`🔍 Found ${boxes.length} textbox elements after adding subpost`)
      if (!boxes.length) throw new Error('No textbox found after adding subpost')
      const last = boxes[boxes.length - 1]
      await humanClick(page, last)
      await humanTypeWithMistakes(page, last, text)
    }

    // Handle remaining chunks from split main post (each chunk becomes a sub-post)
    const handleRemainingPostChunks = async (page: Page, chunks: string[], startIndex: number = 1) => {
      let subPostIndex = startIndex
      if (!Array.isArray(chunks) || chunks.length === 0) return subPostIndex
      console.log(`Step 3.5a: Creating sub-posts from split postText (${chunks.length} chunks)...`)
      for (let k = 0; k < chunks.length; k++) {
        const chunk = (chunks[k] || '').trim()
        if (!chunk) continue
        console.log(`📝 Creating sub-post ${subPostIndex} (from postText chunk ${k + 2}):`, chunk.slice(0, 80))
        try {
          await addAndTypeSubPost(page, chunk)
          console.log(`Step 3.5a: Sub-post ${subPostIndex} finished writing`)
          if (k < chunks.length - 1) await humanDelay(2000, 4000)
        } catch (error) {
          console.log(`🟨 Failed to post sub-post ${subPostIndex}:`, (error as any)?.message || error)
        }
        subPostIndex++
      }
      return subPostIndex
    }

    // Handle subPost fields; split items >500 chars and post in order
    const handleSubPostTexts = async (page: Page, texts: string[], startIndex: number = 1) => {
      let subPostIndex = startIndex
      if (!Array.isArray(texts) || texts.length === 0) return subPostIndex
      console.log(`Step 3.5b: Creating sub-posts from extracted subPost fields (${texts.length} items)...`)
      for (let m = 0; m < texts.length; m++) {
        const subPostText = (texts[m] || '').trim()
        if (!subPostText) continue
        console.log(`Step 3.5b: Processing subPost ${m + 1}/${texts.length} (${subPostText.length} chars):`, subPostText.slice(0, 80))
        if (subPostText.length > 500) {
          const subPostChunks = splitTextIntoChunks(subPostText, 500)
          console.log(`Step 3.5b: SubPost ${m + 1} split into ${subPostChunks.length} chunks`)
          for (let chunkIndex = 0; chunkIndex < subPostChunks.length; chunkIndex++) {
            const chunk = subPostChunks[chunkIndex]
            console.log(`Step 3.5b: Creating sub-post ${subPostIndex} (subPost ${m + 1}, chunk ${chunkIndex + 1}/${subPostChunks.length}):`, chunk.slice(0, 80))
            try {
              await addAndTypeSubPost(page, chunk)
              console.log(`Step 3.5b: Sub-post ${subPostIndex} finished writing`)
              if (chunkIndex < subPostChunks.length - 1) await humanDelay(2000, 4000)
            } catch (error) {
              console.log(`🟨 Failed to post sub-post ${subPostIndex}:`, (error as any)?.message || error)
            }
            subPostIndex++
          }
        } else {
          try {
            await addAndTypeSubPost(page, subPostText)
            console.log(`✅ Sub-post ${subPostIndex} finished writing`)
          } catch (error) {
            console.log(`🟨 Failed to post sub-post ${subPostIndex}:`, (error as any)?.message || error)
          }
          subPostIndex++
        }
        if (m < texts.length - 1) await humanDelay(2000, 4000)
      }
      return subPostIndex
    }

    // Function to split text into chunks of max 500 characters (strict limit)
    const splitTextIntoChunks = (text: string, maxLength: number = 500): string[] => {
      if (!text || text.length <= maxLength) {
        return text ? [text] : []
      }

      const chunks: string[] = []
      let currentIndex = 0

      while (currentIndex < text.length) {
        let endIndex = currentIndex + maxLength
        
        // If we're not at the end of the text, try to break at a word boundary
        if (endIndex < text.length) {
          // Look for the last space, period, or newline within the chunk
          const lastSpace = text.lastIndexOf(' ', endIndex)
          const lastPeriod = text.lastIndexOf('.', endIndex)
          const lastNewline = text.lastIndexOf('\n', endIndex)
          
          // Use the closest break point
          const breakPoint = Math.max(lastSpace, lastPeriod, lastNewline)
          
          // If we found a good break point within reasonable distance, use it
          if (breakPoint > currentIndex + maxLength * 0.7) {
            endIndex = breakPoint
          }
        }
        
        // Ensure we don't exceed maxLength
        endIndex = Math.min(endIndex, currentIndex + maxLength)
        
        const chunk = text.slice(currentIndex, endIndex).trim()
        if (chunk) {
          chunks.push(chunk)
        }
        currentIndex = endIndex
      }

      return chunks
    }

    // Build list of sub-posts from dynamic fields: subPost1..N, subPosts, subPost
    const extractSubPostTexts = (raw: Record<string, any>): string[] => {
      try {
        const entries = Object.entries(raw || {})
        const numbered: Array<{ order: number; value: string }> = []
        for (const [key, val] of entries) {
          if (val == null) continue
          const str = String(val).trim()
          if (!str) continue
          const match = /^subposts?\s*(\d+)?$/i.exec(key)
          if (match) {
            const order = match[1] ? parseInt(match[1], 10) : 0
            numbered.push({ order, value: str })
          }
        }
        numbered.sort((a, b) => a.order - b.order)
        return numbered.map((n) => n.value).map((s) => s.trim()).filter(Boolean)
      } catch (e) {
        console.log('extractSubPostTexts error:', (e as any)?.message || e)
        return []
      }
    }

    // Extract and log subPost texts from all items
    for (let i = 0; i < items.length; i++) {
      const subPostTexts: string[] = extractSubPostTexts(items[i] as any)
      if (subPostTexts.length > 0) {
        console.log(`[input] item ${i + 1} subPost texts (${subPostTexts.length}):`, subPostTexts.map((text: string, idx: number) => `subPost${idx + 1}: ${text.slice(0, 50)}...`))
        subPostTexts.forEach((text: string, idx: number) => {
          const chunks = splitTextIntoChunks(text, 500)
          console.log(`[analysis] subPost${idx + 1}: ${text.length} chars → ${chunks.length} posts`)
        })
      }
    }    

    //start script
    // Step 1: Navigate to Threads
    console.log('Step 1: Start script')
    await page.goto('https://threads.com/', { waitUntil: 'networkidle2' })
    await humanDelay(2000, 4000)

    // Unified loop: first item runs full flow; subsequent items run lightweight post-only flow
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const isFirst = i === 0

      // Step 2: Open composer
      console.log(` ${isFirst ? 'Step 2' : 'Extra'}: Opening post composer...`)
      await humanClick(page,'.x1i10hfl > .xc26acl')

      // Step 3: Type post (with auto-splitting if >500 chars)
      if (item.postText) {
        if (isFirst) console.log(' Step 3: Writing post text...')
        
        const postText = item.postText.trim()
        console.log(`📝 Post content length: ${postText.length} characters`)
        
        // Check if post text exceeds 500 characters
        if (postText.length > 500) {
          console.log('📝 Post text too long, will split into multiple posts')
          const postChunks = splitTextIntoChunks(postText, 500)
          console.log(`📝 Post split into ${postChunks.length} chunks`)
          
          // Type and post the first chunk as main post
          const firstChunk = postChunks[0]
          console.log('⌨️ Typing main post (chunk 1):', firstChunk.slice(0, 80))
          await humanClick(page, 'div[role="textbox"]')
          await humanTypeWithMistakes(page, 'div[role="textbox"]', firstChunk)
          
          // Store remaining chunks for sub-posts
          item.remainingPostChunks = postChunks.slice(1)
        } else {
          // Normal post (≤500 chars)
          console.log('⌨️ Typing post text:', postText.slice(0, 80))
          await humanClick(page, 'div[role="textbox"]')
          await humanTypeWithMistakes(page, 'div[role="textbox"]', postText)
        }
      }

      // Step 4: Upload media (file or all images in a folder). Skip gracefully if invalid. (optional)
      const mediaPathStr = (item.mediaPath || '').trim()
      if (!mediaPathStr) {
        // no media provided
      } else if (!existsSync(mediaPathStr)) {
        console.log(' Invalid media path, skipping upload:', mediaPathStr)
      } else {
        try {
          const stat = statSync(mediaPathStr)
          const imagePaths: string[] = stat.isDirectory()
            ? readdirSync(mediaPathStr)
                .filter((f) => /\.(jpe?g|png|gif|webp|bmp|tiff?)$/i.test(f))
                .map((f) => pathJoin(mediaPathStr, f))
            : stat.isFile() ? [mediaPathStr] : []

          if (imagePaths.length === 0) {
            console.log('🟨 No images found to upload in path:', mediaPathStr)
          } else {
            if (isFirst) console.log(`📍 Step 4: Uploading ${imagePaths.length} image(s)...`)

            // Try to find an existing file input; if missing, click candidate button once
            let fileInput = await page.$('input[type="file"]')
            if (!fileInput) {
              const candidateSelectors = [
                '.x6s0dn4 > .x1i10hfl:nth-child(1) > .x1n2onr6 > .x1lliihq'
              ]
              for (const sel of candidateSelectors) {
                const btn = await page.$(sel)
                if (!btn) continue
                await humanDelay(300, 700)
                await humanClick(page, sel)
                console.log('🖱️ Clicked add-media button with selector:', sel)
                await humanDelay(500, 1000)
                fileInput = await page.$('input[type="file"]')
                if (fileInput) break
              }
              if (!fileInput) console.log('⚠️ File input not found after button click')
            }

            if (!fileInput) {
              console.log('🟨 File input not found; skipping all images')
            } else {
              for (let idx = 0; idx < imagePaths.length; idx++) {
                const filePath = imagePaths[idx]
                try {
                  console.log(`📷 Uploading image ${idx + 1}/${imagePaths.length}:`, filePath)
                  await fileInput.uploadFile(filePath)
                  await humanDelay(1500, 2500)
                } catch (err) {
                  console.log('🟨 Upload single image failed:', (err as any)?.message || err)
                }
              }
            }
          }
        } catch (e) {
          console.log('🟨 Media upload skipped due to error:', (e as any)?.message || e)
        }
      }

      // Step 3.5: Handle sub-posts (after media upload)
      let subPostIndex = 1
      subPostIndex = await handleRemainingPostChunks(page, item.remainingPostChunks || [], subPostIndex)
      subPostIndex = await handleSubPostTexts(page, extractSubPostTexts(item as any), subPostIndex)
      console.log(`✅ Step 3.5 completed for item ${i + 1}: Created ${subPostIndex - 1} sub-posts total`)

      // Step 5: Add Topic - tags (optional)
      if (item.tag) {
        if (isFirst) console.log('📍 Step 7: Adding topic/tag...')
        await humanClick(page,'input.xwhw2v2')
        await humanTypeWithMistakes(page, 'input.xwhw2v2', item.tag)
      }

      // Step 6: Schedule (optional)
      if ((item as any)?.schedule) {
        try {
          const parseSchedule = (raw: string) => {
            const s = String(raw || '').trim()
            // Expect 24h formats like: "09:30 21/06/2025" or "9:30 21/6/2025"
            const m = /^\s*(\d{1,2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/i.exec(s)
            if (!m) return null
            const hour24 = parseInt(m[1], 10)
            const minute = parseInt(m[2], 10)
            const day = parseInt(m[3], 10)
            const month = parseInt(m[4], 10)
            const year = parseInt(m[5], 10)
            if (isNaN(hour24) || hour24 < 0 || hour24 > 23) return null
            if (isNaN(minute) || minute < 0 || minute > 59) return null
            return { hour24, minute, day, month, year }
          }
          const normalizeHeader = (s: string) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim()
          const toMonthHeaders = (month: number, year: number): string[] => {
            const m = Math.max(1, Math.min(12, month))
            const en = ['January','February','March','April','May','June','July','August','September','October','November','December'][m - 1]
            // Vietnamese format: "Tháng {m} năm {year}" (e.g., "Tháng 9 năm 2025")
            const viNumeric = `Tháng ${m} năm ${year}`
            return [
              `${en} ${year}`,
              viNumeric
            ]
          }

          const parsed = parseSchedule((item as any).schedule)
          if (!parsed) {
            console.log('🟨 Invalid schedule format, skipping schedule:', (item as any).schedule)
          } else {
            if (isFirst) console.log('📍 Step 7.5: Scheduling post...')
            // Open expanded options
            await humanClick(page,'.xx6bhzk > .x1lliihq > .xbh8q5q')
            await humanDelay(400, 800)
            // Open schedule settings
            await humanClick(page,'.x1q05qs2:nth-child(2) .x1i10hfl')
            await humanDelay(500, 900)

            // Navigate months until header matches target
            const targetHeaders = toMonthHeaders(parsed.month, parsed.year).map(normalizeHeader)
            const maxJumps = 18
            for (let tries = 0; tries < maxJumps; tries++) {
              const headerText = await page.$eval('h2 span span span', (el) => (el?.textContent || '').trim())
              if (targetHeaders.includes(normalizeHeader(headerText))) break
              await humanClick(page,'div.x10w6t97:nth-child(2)')
              await humanDelay(300, 700)
            }

            // Click day using calendar cells selector for locale-agnostic matching
            const dateText = String(parsed.day)
            const clicked = await page.evaluate((needle) => {
              try {
                const spans = Array.from(document.querySelectorAll('div[role="gridcell"] > div[aria-hidden="true"] > span')) as HTMLElement[]
                for (const span of spans) {
                  const txt = (span.textContent || '').trim()
                  if (txt === needle) {
                    span.click()
                    return true
                  }
                }
                return false
              } catch { return false }
            }, dateText)
            if (!clicked) {
              console.log('🟨 Could not find day element for:', dateText)
            } else {
              await humanDelay(300, 700)
            }

            // Fill time hh:mm in 12h inputs (derive from 24h)
            const hh12 = ((parsed.hour24 + 11) % 12) + 1
            const mm = parsed.minute.toString().padStart(2, '0')
            await humanClick(page,'input[placeholder="hh"]')
            await humanTypeWithMistakes(page, 'input[placeholder="hh"]', String(hh12))
            await humanDelay(200, 400)
            await humanClick(page,'input[placeholder="mm"]')
            await humanTypeWithMistakes(page, 'input[placeholder="mm"]', mm)
            await humanDelay(200, 400)

            // Some UIs require AM/PM toggling; try to click meridiem if exists
            try {
              const meridiem = parsed.hour24 < 12 ? 'AM' : 'PM'
              const meridiemSel = meridiem === 'AM' ? 'button:has-text("AM")' : 'button:has-text("PM")'
              const merBtn = await page.$(meridiemSel)
              if (merBtn) {
                await merBtn.click()
                await humanDelay(150, 300)
              }
            } catch {}

            // Click Done
            await humanClick(page,'div[class="xmzvs34"] [role="button"]')
            await humanDelay(500, 900)
          }
        } catch (e) {
          console.log('🟨 Schedule step skipped due to error:', (e as any)?.message || e)
        }
      }

      // Step 8: Post
      if (isFirst) console.log('📍 Step 8: Posting content...')
      await humanClick(page,'.x2lah0s:nth-child(1) > .x1i10hfl > .xc26acl')
      await humanDelay(2000, 4000)
      console.log('✅ Step 8 completed: Content posted successfully')

  

      if (isFirst) {
        // Step 9-15: Profile navigation, comment
        await humanClick(page,'.x78zum5 > .x1i10hfl > .x90nhty > .xl1xv1r')
        await humanDelay(1000, 2000)

        const commentTexts = extractCommentTexts(item as any)
        console.log(`🗨️ Comments to post: ${commentTexts.length}`)

        for (let j = 0; j < commentTexts.length; j++) {
          const comment = commentTexts[j]
          const attemptPost = async () => {
            // click comment button
            await humanClick(page,'.x1c1b4dv:nth-child(7) .x78zum5:nth-child(1) > .x9f619:nth-child(1) .x1xdureb:nth-child(3) .x6s0dn4:nth-child(2) .x1lliihq:nth-child(1)')
            // click comment input
            await humanClick(page,'.xzsf02u > .xdj266r')
            await humanTypeWithMistakes(page, '.xzsf02u > .xdj266r', comment)
            console.log(`⌨️ Typing comment ${j + 1}/${commentTexts.length}:`, comment.slice(0, 80))
            // click post comment button
            await humanClick(page,'.x2lah0s:nth-child(1) > .x1i10hfl > .xc26acl')
            console.log(`✅ Comment ${j + 1} posted`)
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
    // Rethrow so upstream IPC can catch and report properly
    throw error
  }
}





