import type { Page } from 'puppeteer-core'
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { existsSync, statSync, readdirSync, unlinkSync, readFileSync } from 'fs'
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
  gptKey?: string
  geminiKey?: string
  postPrompt?: string
  commentNumber?: number
  commentPrompt?: string
  linkShopee?: string[]
  items?: Array<{ postText?: string; commentText?: string; mediaPath?: string; tag?: string; schedule?: string; subPost?: string; remainingPostChunks?: string[] }>
}


  /**
 * Generate comment using ChatGPT API
 * @param searchKeyword - The search keyword for context
 * @param prompt - Custom prompt for ChatGPT
 * @param gptKey - ChatGPT API key
 * @returns Generated comment text or null if failed
 */
const generateChatGPTComment = async (
    prompt: string,
    gptKey?: string
  ): Promise<string | null> => {
    try {
      console.log(`[ChatGPT] Using prompt: "${prompt}"`)
      
      // Initialize OpenAI client
      const openai = new OpenAI({
        apiKey: gptKey
      });
  
      // Call OpenAI API
      const response = await openai.responses.create({
        model: "gpt-5-nano",
        input: prompt,
        store: true,
      });
  
      const result = await response;
      const generatedText = result.output_text || null
      if (!generatedText) return null
      console.log(`[ChatGPT] Generated comment: "${generatedText}"`)
      return generatedText
      
    } catch (error) {
      console.error('[ChatGPT] Generation failed:', error)
      return null
    }
  }
  
  /**
   * Generate comment using Google Gemini AI
   * @param searchKeyword - The search keyword for context
   * @param prompt - Custom prompt for Gemini
   * @param linkShopee - Optional Shopee link to append
   * @param geminiKey - Gemini API key
   * @returns Generated comment text or null if failed
   */
  const generateGeminiComment = async (
    prompt: string,
    geminiKey?: string
  ): Promise<string | null> => {
    try {
      console.log(`[Gemini] Using prompt: "${prompt}"`)
      
      // Initialize Gemini client
      const ai = new GoogleGenAI({
        apiKey: geminiKey
      });
  
      // Call Gemini API
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: prompt
      });
  
      const generatedText = response.text || null
      if (!generatedText) return null
      console.log(`[Gemini] Generated comment: "${generatedText}"`)
      return generatedText
      
    } catch (error) {
      console.error('[Gemini] Generation failed:', error)
      return null
    }
  }
  

  
/**
 * Handle comment generation based on input
 * @param normalizedInput - Normalized input data including postText
 * @returns Generated comment text
 */
const handleComment = async (
    normalizedInput: {
      prompt?: string;
      gptKey?: string;
      geminiKey?: string;
      linkShopee?: string[];
      postText?: string;
    }
  ): Promise<string> => {
    let commentText = ''
    
    const postText = normalizedInput.postText || ''
    const prompt = normalizedInput.prompt
      ? `${normalizedInput.prompt} ${postText}`
      : `Viết cho tôi comment ngắn gọn bằng tiếng việt cho bài post có nội dung sau để gắn link shopee affiliate sao cho ngôn từ giới trẻ tự nhiên như trên mạng xã hội threads, comment ngắn gọn thôi cho giống ngôn từ giới trẻ, ko cần lịch sự. Chỉ trả về một comment duy nhất, ko cần gắn link hay hướng dẫn, tôi tự gắn.: ${postText}`
  
    // Priority 1: Try Gemini if available
    if(normalizedInput.geminiKey) {
      const geminiComment = await generateGeminiComment(
        prompt,
        normalizedInput.geminiKey
      )
      if (geminiComment) {
        commentText = geminiComment
      }
    }
    
    // Priority 2: Try ChatGPT if Gemini failed or not available
    if (!commentText && normalizedInput.gptKey) {
      const chatGPTComment = await generateChatGPTComment(
        prompt,
        normalizedInput.gptKey
      )
      if (chatGPTComment) {
        commentText = chatGPTComment
      }
    }
    
    // Fallback if both AI failed
    if (!commentText) {
      commentText = `Mua ngay nèo`
      console.log(`[AI] Fallback to default comment: "${commentText}"`)
    }
    
    // Append random Shopee link if provided
    let finalComment = commentText
    if (normalizedInput.linkShopee && normalizedInput.linkShopee.length > 0) {
      const randomLink = normalizedInput.linkShopee[Math.floor(Math.random() * normalizedInput.linkShopee.length)]
      finalComment = commentText + `\n${randomLink}`
    }
    return finalComment
  }



export async function run(page: Page, input: Input = {}) {
  // Improve debuggability: surface errors and page logs
  page.setDefaultTimeout(60000)
  page.setDefaultNavigationTimeout(90000)
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
        const commentText = getByBase('comment')
        const mediaPath = getByBase('image')
        const tag = getByBase('tag')
        const schedule = getByBase('schedule')
        const subPost = getByBase('subpost')
        return { commentText, mediaPath, tag, schedule, subPost }
      } catch {
        return { commentText: undefined, mediaPath: undefined, tag: undefined, schedule: undefined, subPost: undefined }
      }
    }

    const normalizedInput = { ...normalizeRecord(input as any) }
    const baseItems = Array.isArray(input.items) && input.items.length > 0 ? input.items as any[] : [input as any]
    // Preserve original keys so extractCommentTexts can read 'Comment(s) N' fields
    const items = baseItems.map((r) => ({ ...(r as any), ...normalizeRecord(r as any) }))

    console.log('📝 Raw Input:', input)
    console.log('[input] commentText:', normalizedInput.commentText)
    console.log('[input] mediaPath:', normalizedInput.mediaPath)
    console.log('[input] subPost:', normalizedInput.subPost)
    if (normalizedInput.schedule) console.log('[input] schedule:', normalizedInput.schedule)
    console.log('[input] items count:', items.length)
    
    // Debug: Log AI configuration from first item
    if (items.length > 0) {
      const firstItem = items[0]
      console.log('[AI Config Debug] First item keys:', Object.keys(firstItem))
      console.log('[AI Config Debug] GPT key available:', !!firstItem['GPT key'])
      console.log('[AI Config Debug] Gemini key available:', !!firstItem['Gemini key'])
      console.log('[AI Config Debug] Post Prompt available:', !!firstItem['Post Prompt'])
      console.log('[AI Config Debug] Comment Prompt available:', !!firstItem['Comment Promt'])
      console.log('[AI Config Debug] Comment Number:', firstItem['Comment Number'])
    }
    

    // Click Add Subpost, then target the last textbox and type text
    const addAndTypeSubPost = async (page: Page, text: string) => {
      // Click add subpost button (robust: search inside composer dialog, tolerant text match)
      const findAddSubpostButton = async () => {
        // Wait up to 5s for the button to appear inside an open dialog
        await page.waitForFunction(() => {
          const dialog = document.querySelector('div[role="dialog"]') as HTMLElement | null
          if (!dialog) return false
          const buttons = Array.from(dialog.querySelectorAll('div[role="button"]')) as HTMLElement[]
          const isVisible = (el: HTMLElement) => {
            const rect = el.getBoundingClientRect()
            return !!(el.offsetParent || (rect.width > 0 && rect.height > 0))
          }
          return buttons.some((el) => {
            const txt = (el.innerText || '').trim().toLowerCase()
            const re = /(add\s+to\s+thread|thêm\s+vào\s+thread|thêm.+thread)/i
            return isVisible(el) && (re.test(txt) || txt.includes('add to thread'))
          })
        }, { timeout: 5000 }).catch(() => {})

        // Prefer the last visible match within the dialog (closest to composer footer)
        const handle = await page.evaluateHandle(() => {
          const dialog = document.querySelector('div[role="dialog"]') as HTMLElement | null
          const root: ParentNode = dialog || document
          const buttons = Array.from(root.querySelectorAll('div[role="button"]')) as HTMLElement[]
          const isVisible = (el: HTMLElement) => {
            const rect = el.getBoundingClientRect()
            return !!(el.offsetParent || (rect.width > 0 && rect.height > 0))
          }
          const candidates = buttons.filter((el) => {
            const txt = (el.innerText || '').trim().toLowerCase()
            const re = /(add\s+to\s+thread|thêm\s+vào\s+thread|thêm.+thread)/i
            return isVisible(el) && (re.test(txt) || txt.includes('add to thread'))
          })
          return candidates.length ? candidates[candidates.length - 1] : null
        })
        return handle.asElement() as any
      }

      const beforeEditors = await page.$$('div[role="textbox"]')
      const addSubpostButton = await findAddSubpostButton()
      if (!addSubpostButton) throw new Error('Add subpost button not found')

      // Ensure in view, then click
      await addSubpostButton.evaluate((el: any) => (el as HTMLElement).scrollIntoView({ block: 'center' }))
      await humanDelay(150, 300)
      await humanClick(page, addSubpostButton as any)
      console.log(`Clicked add subpost button`)

      // Wait for a new editor to appear
      await page.waitForFunction(
        (prevCount) => document.querySelectorAll('div[role="textbox"]').length > (prevCount as number),
        {},
        beforeEditors.length
      ).catch(() => {})

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
    // Step 1: Navigate to Threads (robust with retry)
    console.log('Step 1: Start script')
    const navigateWithRetry = async (targetUrl: string, maxAttempts: number = 3) => {
      let lastError: unknown
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 90000 })
          return
        } catch (err) {
          lastError = err
          const backoffMs = 2000 * attempt
          console.warn(`[nav] attempt ${attempt}/${maxAttempts} failed. Retrying in ${backoffMs}ms...`)
          await humanDelay(backoffMs, backoffMs + 500)
        }
      }
      throw lastError
    }
    await navigateWithRetry('https://threads.com/')
    await humanDelay(2000, 4000)

    // Unified loop: first item runs full flow; subsequent items run lightweight post-only flow
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const isFirst = i === 0

      // Step 1: Generate post text using AI (if needed)
      const mediaPathStr = (item.mediaPath || '').trim()
      let imagePath: string | null = null
      
      if (mediaPathStr && existsSync(mediaPathStr)) {
        const stat = statSync(mediaPathStr)
        if (stat.isDirectory()) {
          const imageFiles = readdirSync(mediaPathStr)
            .filter((f) => /\.(jpe?g|png|gif|webp|bmp|tiff?)$/i.test(f))
          if (imageFiles.length > 0) {
            imagePath = pathJoin(mediaPathStr, imageFiles[0])
          }
        } else if (stat.isFile()) {
          imagePath = mediaPathStr
        }
      }
      
      // Generate post text using AI (with or without image)
      await handlePostText(imagePath, {
        ...input,
        gptKey: item['GPT key'] || input.gptKey,
        geminiKey: item['Gemini key'] || input.geminiKey,
        postPrompt: item['Post Prompt'] || input.postPrompt
      }, item)

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
      if (imagePath && existsSync(imagePath)) {
        if (isFirst) console.log(`📍 Step 4: Uploading 1 image...`)

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
          console.log('🟨 File input not found; skipping image upload')
        } else {
          try {
            console.log(`📷 Uploading image:`, imagePath)
            await fileInput.uploadFile(imagePath)
            await humanDelay(1500, 2500)
            
            // Xóa ảnh sau khi upload thành công
            try {
              unlinkSync(imagePath)
              console.log(`🗑️ Deleted image after upload:`, imagePath)
            } catch (deleteErr) {
              console.log('⚠️ Failed to delete image after upload:', (deleteErr as any)?.message || deleteErr)
            }
          } catch (err) {
            console.log('Upload single image failed:', (err as any)?.message || err)
          }
        }
      } else if (mediaPathStr && !existsSync(mediaPathStr)) {
        console.log(' Invalid media path, skipping upload:', mediaPathStr)
      } else {
        console.log(' No media to upload')
      }

      // Step 5: Handle sub-posts (after media upload)
      let subPostIndex = 1
      subPostIndex = await handleRemainingPostChunks(page, item.remainingPostChunks || [], subPostIndex)
      subPostIndex = await handleSubPostTexts(page, extractSubPostTexts(item as any), subPostIndex)
      console.log(`✅ Step 3.5 completed for item ${i + 1}: Created ${subPostIndex - 1} sub-posts total`)

      // Step 5: Add Topic - tags (optional)
      if (item.tag) {
        if (isFirst) console.log('Step 5: Adding topic/tag...')
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
            console.log('Invalid schedule format, skipping schedule:', (item as any).schedule)
          } else {
            if (isFirst) console.log('Step 7.5: Scheduling post...')
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
              console.log('Could not find day element for:', dateText)
            } else {
              await humanDelay(300, 700)
            }

            // Debug: log parsed schedule components
            console.log(`[schedule] parsed -> hour24=${parsed.hour24}, minute=${parsed.minute}, day=${parsed.day}, month=${parsed.month}, year=${parsed.year}`)

            // Fill time hh:mm in 24h inputs directly
            const hh24 = parsed.hour24.toString().padStart(2, '0')
            const mm = parsed.minute.toString().padStart(2, '0')
            console.log(`[schedule] computed -> hh24='${hh24}', mm='${mm}'`)


            // Focus → caret at end → select all → type full chunk at once (no per-char delay)
            const hhSelector = 'input[placeholder="hh"]'
            const mmSelector = 'input[placeholder="mm"]'
            await page.waitForSelector(hhSelector, { visible: true })
            await page.waitForSelector(mmSelector, { visible: true })

            // Hour
            await humanDelay(120, 280)
            await page.focus(hhSelector)
            await humanDelay(120, 240)
            await page.evaluate((sel) => {
              const el = document.querySelector(sel) as HTMLInputElement | null
              if (el) {
                const len = el.value.length
                el.setSelectionRange(len, len)
              }
            }, hhSelector)
            await humanDelay(100, 220)
            await page.keyboard.down('Control')
            await page.keyboard.press('KeyA')
            await page.keyboard.up('Control')
            await humanDelay(140, 260)
            await page.keyboard.type(hh24, { delay: 0 })
            await humanDelay(160, 320)

            // Minute
            await humanDelay(140, 300)
            await page.focus(mmSelector)
            await humanDelay(120, 240)
            await page.evaluate((sel) => {
              const el = document.querySelector(sel) as HTMLInputElement | null
              if (el) {
                const len = el.value.length
                el.setSelectionRange(len, len)
              }
            }, mmSelector)
            await humanDelay(100, 220)
            await page.keyboard.down('Control')
            await page.keyboard.press('KeyA')
            await page.keyboard.up('Control')
            await humanDelay(140, 260)
            await page.keyboard.type(mm, { delay: 0 })
            await humanDelay(160, 320)

            // Click Done
            await humanClick(page,'div[class="xmzvs34"] [role="button"]')
            await humanDelay(500, 900)
          }
        } catch (e) {
          console.log('Schedule step skipped due to error:', (e as any)?.message || e)
        }
      }

      // Step 8: Post
      if (isFirst) console.log('Step 8: Posting content...')
      await humanClick(page,'.x2lah0s:nth-child(1) > .x1i10hfl > .xc26acl')
      await humanDelay(3000, 4000)
      console.log('Step 8 completed: Content posted successfully')

      if ((item as any)?.schedule) {
        console.log('Skipping comment step because of schedule')
        continue;
      }
      if (isFirst) {
        // Step 9-15: Profile navigation, comment
        await humanClick(page,'.x78zum5 > .x1i10hfl > .x90nhty > .xl1xv1r')
        await humanDelay(1000, 2000)

        // Generate and post comments using AI
        const numberOfComments = parseInt(String(item['Comment Number'] || input.commentNumber || 1), 10)
        console.log(`🗨️ Generating and posting ${numberOfComments} comment(s) using AI...`)

        for (let j = 0; j < numberOfComments; j++) {
          // Generate comment using AI
          const generatedComment = await handleComment({
            prompt: item['Comment Promt'] || input.commentPrompt,
            gptKey: item['GPT key'] || input.gptKey,
            geminiKey: item['Gemini key'] || input.geminiKey,
            linkShopee: item['Link Shopee'] ? item['Link Shopee'].split('\r\n').filter(link => link.trim()) : input.linkShopee,
            postText: item.postText || ''
          })
          
          if (generatedComment) {
            console.log(`✅ Generated comment ${j + 1}/${numberOfComments}: "${generatedComment.slice(0, 80)}..."`)
            
            // Post comment immediately
            try {
              // click comment button
              await humanClick(page,'.x1c1b4dv:nth-child(7) .x78zum5:nth-child(1) > .x9f619:nth-child(1) .x1xdureb:nth-child(3) .x6s0dn4:nth-child(2) .x1lliihq:nth-child(1)')
              // click comment input
              await humanClick(page,'.xzsf02u > .xdj266r')
              await humanTypeWithMistakes(page, '.xzsf02u > .xdj266r', generatedComment)
              console.log(`⌨️ Typing comment ${j + 1}/${numberOfComments}:`, generatedComment.slice(0, 80))
              // click post comment button
              try {
                await humanClick(page, '.x2lah0s:nth-child(1) > .x1i10hfl > .xc26acl')
              } catch {
                await humanClick(page, 'div.x1s688f:nth-child(2)')
              }
              await humanDelay(1000, 2000)
              console.log(`✅ Comment ${j + 1} posted`)
              
              // Human-like delay between comments
              if (j < numberOfComments - 1) {
                await humanDelay(2000, 5000)
              }
            } catch (postError) {
              console.error(`❌ Failed to post comment ${j + 1}:`, postError)
            }
          } else {
            console.log(`⚠️ Failed to generate comment ${j + 1}, skipping...`)
          }
        }

        await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
        await humanDelay(3000, 5000)

      await humanClick(page,'.x1ypdohk > path')
    }
    }

    

    console.log('🎉 All automation steps completed successfully!')
    await page.close()
    const browser = page.browser()
    await browser.close()
    return { success: true }

  } catch (error) {
    console.error('❌ Post and Comment automation failed:', error)
    // Rethrow so upstream IPC can catch and report properly
    throw error
  }
}

/**
 * Generate post text from image using ChatGPT Vision API
 * @param imagePath - Path to the image file
 * @param gptKey - ChatGPT API key
 * @param prompt - Optional custom prompt
 * @returns Generated post text or null if failed
 */
const generatePostTextFromImageChatGPT = async (
  imagePath: string,
  gptKey?: string,
  prompt?: string
): Promise<string | null> => {
  try {
    console.log(`[ChatGPT Vision] Processing image: ${imagePath}`)
    
    // Read image file as base64
    const imageBuffer = readFileSync(imagePath)
    const base64Image = imageBuffer.toString('base64')
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: gptKey
    });

    const defaultPrompt = "Hãy tạo một caption/status ngắn gọn bằng tiếng Việt cho hình ảnh này, phù hợp với mạng xã hội Threads. Caption nên tự nhiên, hấp dẫn và có thể kích thích tương tác từ người dùng. Chỉ trả về caption, không cần giải thích thêm."
    
    // Call OpenAI Vision API
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt || defaultPrompt
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 300
    });

    const generatedText = response.choices[0]?.message?.content || null
    if (!generatedText) return null
    
    console.log(`[ChatGPT Vision] Generated post text: "${generatedText}"`)
    return generatedText.trim()
    
  } catch (error) {
    console.error('[ChatGPT Vision] Generation failed:', error)
    return null
  }
}

/**
 * Generate post text from image using Google Gemini Vision API
 * @param imagePath - Path to the image file
 * @param geminiKey - Gemini API key
 * @param prompt - Optional custom prompt
 * @returns Generated post text or null if failed
 */
const generatePostTextFromImageGemini = async (
  imagePath: string,
  geminiKey?: string,
  prompt?: string
): Promise<string | null> => {
  try {
    console.log(`[Gemini Vision] Processing image: ${imagePath}`)
    
    // Read image file as base64
    const imageBuffer = readFileSync(imagePath)
    const base64Image = imageBuffer.toString('base64')
    
    // Initialize Gemini client
    const ai = new GoogleGenAI({
      apiKey: geminiKey
    });

    const defaultPrompt = "Hãy tạo một caption/status ngắn gọn bằng tiếng Việt cho hình ảnh này, phù hợp với mạng xã hội Threads. Caption nên tự nhiên, hấp dẫn và có thể kích thích tương tác từ người dùng. Chỉ trả về caption, không cần giải thích thêm."

    // Call Gemini Vision API
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        prompt || defaultPrompt,
        {
          inlineData: {
            data: base64Image,
            mimeType: "image/jpeg"
          }
        }
      ]
    });

    const generatedText = result.text || null
    if (!generatedText) return null
    
    console.log(`[Gemini Vision] Generated post text: "${generatedText}"`)
    return generatedText.trim()
    
  } catch (error) {
    console.error('[Gemini Vision] Generation failed:', error)
    return null
  }
}


/**
 * Handle post text generation using AI (with or without image)
 * @param imagePath - Path to the image file (optional)
 * @param input - Input configuration with API keys and prompts
 * @param item - Current item being processed
 * @returns Generated post text or existing postText
 */
const handlePostText = async (
     imagePath: string | null,
     input: Input,
     item: any
   ): Promise<string> => {
     // Generate status using AI if API keys are provided
     let generatedStatus = ''
     if (input.gptKey || input.geminiKey) {
       if (imagePath && existsSync(imagePath)) {
         // Case 1: Generate from image
         console.log(`🤖 Generating post text from image using AI...`)
         
         if (input.gptKey) {
           const gptPostText = await generatePostTextFromImageChatGPT(imagePath, input.gptKey, input.postPrompt)
           if (gptPostText) {
             generatedStatus = gptPostText
             console.log(`✅ ChatGPT generated post text from image: "${generatedStatus}"`)
           }
         }
         
         if (!generatedStatus && input.geminiKey) {
           const geminiPostText = await generatePostTextFromImageGemini(imagePath, input.geminiKey, input.postPrompt)
           if (geminiPostText) {
             generatedStatus = geminiPostText
             console.log(`✅ Gemini generated post text from image: "${generatedStatus}"`)
           }
         }
       } else if (input.postPrompt) {
         // Case 2: Generate from text prompt only (no image)
         console.log(`🤖 Generating post text from prompt using AI...`)
         
         if (input.gptKey) {
           // Use ChatGPT for text-only generation
           try {
             const openai = new OpenAI({ apiKey: input.gptKey })
             const response = await openai.chat.completions.create({
               model: "gpt-4o-mini",
               messages: [{ role: "user", content: input.postPrompt }],
               max_tokens: 300
             })
             const gptPostText = response.choices[0]?.message?.content?.trim()
             if (gptPostText) {
               generatedStatus = gptPostText
               console.log(`✅ ChatGPT generated post text from prompt: "${generatedStatus}"`)
             }
           } catch (error) {
             console.error('[ChatGPT Text] Generation failed:', error)
           }
         }
         
         if (!generatedStatus && input.geminiKey) {
           // Use Gemini for text-only generation
           try {
             const ai = new GoogleGenAI({ apiKey: input.geminiKey })
             const result = await ai.models.generateContent({
               model: "gemini-2.0-flash",
               contents: [input.postPrompt]
             })
             const geminiPostText = result.text?.trim()
             if (geminiPostText) {
               generatedStatus = geminiPostText
               console.log(`✅ Gemini generated post text from prompt: "${generatedStatus}"`)
             }
           } catch (error) {
             console.error('[Gemini Text] Generation failed:', error)
           }
         }
       }
       
       if (generatedStatus) {
         // Gán trực tiếp generatedStatus làm postText
         item.postText = generatedStatus
         console.log(`📝 Using AI-generated post text: "${generatedStatus}"`)
       }
     }
     
     // Trả về postText (có thể là generated hoặc existing)
     return item.postText || ''
   }

// Export functions for external use
export { 
  generatePostTextFromImageChatGPT, 
  generatePostTextFromImageGemini, 
  handlePostText 
}


