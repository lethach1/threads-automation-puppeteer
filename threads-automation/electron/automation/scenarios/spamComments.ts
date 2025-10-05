import type { Page } from 'puppeteer-core'
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
// @ts-ignore
import * as HB from '../human-behavior.js'
// @ts-ignore
import { humanScroll } from '../human-behavior.js'

// @ts-ignore
import { 
  humanDelay, 
  humanTypeWithMistakes,
  humanClick,
  humanScrollToElement
} from '../human-behavior.js'



type Input = {
  profile?: string
  feedsComment?: number
  searchKeyword?: string
  topTabComment?: number
  recentTabComment?: number
  commentPool?: string[]
  linkShopee?: string
  prompt?: string
  gptKey?: string
  geminiKey?: string
  items?: Array<{ 
    profile?: string
    feedsComment?: number
    searchKeyword?: string
    topTabComment?: number
    recentTabComment?: number
    commentPool?: string[]
    linkShopee?: string
    prompt?: string
    gptKey?: string
    geminiKey?: string
  }>
}

type NormalizedInput = {
  profile?: string
  feedsComment?: number
  searchKeyword?: string
  topTabComment?: number
  recentTabComment?: number
  commentPool?: string[]
  linkShopee?: string[]
  prompt?: string
  gptKey?: string
  geminiKey?: string
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
      const feedsComment = getByBase('Feeds comment')
      const searchKeyword = getByBase('Search keyword')
      const topTabComment = getByBase('Top tab comment')
      const recentTabComment = getByBase('Recent tab comment')
      const commentPool = getByBase('Comment pool')
      const linkShopee = getByBase('Link Shopee')
      const prompt = getByBase('Prompt')
      const gptKey = getByBase('GPT key')
      const geminiKey = getByBase('Gemini key')
      
      return { 
        profile, 
        feedsComment: feedsComment ? parseInt(feedsComment) : undefined,
        searchKeyword, 
        topTabComment: topTabComment ? parseInt(topTabComment) : undefined,
        recentTabComment: recentTabComment ? parseInt(recentTabComment) : undefined,
        commentPool: commentPool ? parseCommentPool(commentPool) : undefined,
        linkShopee: parseShopeeLinks(linkShopee),
        prompt, 
        gptKey,
        geminiKey
      }
    } catch {
      return { 
        profile: undefined, 
        feedsComment: undefined, 
        searchKeyword: undefined, 
        topTabComment: undefined, 
        recentTabComment: undefined, 
        commentPool: undefined, 
        linkShopee: undefined,
        prompt: undefined, 
        gptKey: undefined,
        geminiKey: undefined
      }
    }
  }

  const normalizedInput = normalizeRecord(input as any)
  const baseItems = Array.isArray(input.items) && input.items.length > 0 ? input.items as any[] : [input as any]
  const items = baseItems.map((r) => ({ ...(r as any), ...normalizeRecord(r as any) }))

  return { normalizedInput, items }
}

/**
 * Parse comment pool string into array of individual comments
 * @param commentPool - String containing comments separated by newlines
 * @returns Array of individual comments
 */
const parseCommentPool = (commentPool: string): string[] => {
  if (!commentPool || typeof commentPool !== 'string') {
    return []
  }
  
  return commentPool
    .split('\n')
    .map(comment => comment.trim())
    .filter(comment => comment.length > 0)
}

/**
 * Parse links string into array of individual links
 * @param linkShopee - String containing links separated by newlines
 * @returns Array of individual links
 */
const parseShopeeLinks = (linkShopee: string | undefined): string[] | undefined => {
  if (!linkShopee || typeof linkShopee !== 'string') {
    return undefined
  }
  
  return linkShopee
    .split('\n')
    .map(link => link.trim())
    .filter(link => link.length > 0)
}

/**
 * Handle comment generation based on input
 * @param normalizedInput - Normalized input data
 * @param statusText - Optional status text from post
 * @returns Generated comment text
 */
const handleComment = async (
  normalizedInput: {
    prompt?: string;
    commentPool?: string[];
    gptKey?: string;
    geminiKey?: string;
    linkShopee?: string[];
    searchKeyword?: string;
  },
  statusText: string = ''
): Promise<string> => {
  let commentText = ''
  
  const prompt = normalizedInput.prompt
    ? `${normalizedInput.prompt} ${statusText}`
    : `Viết cho tôi comment ngắn gọn bằng tiếng việt cho bài post có nội dung sau để gắn link shopee affiliate sao cho ngôn từ giới trẻ tự nhiên như trên mạng xã hội threads, comment ngắn gọn thôi cho giống ngôn từ giới trẻ, ko cần lịch sự. Chỉ trả về một comment duy nhất, ko cần gắn link hay hướng dẫn, tôi tự gắn.: ${statusText}`

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
  
  // Fallback to commentPool if both AI failed
  if (!commentText) {
    if (normalizedInput.commentPool && normalizedInput.commentPool.length > 0) {
      commentText = normalizedInput.commentPool[Math.floor(Math.random() * normalizedInput.commentPool.length)]
      console.log(`[AI] Fallback to pool comment: "${commentText}"`)
    } else {
      commentText = `Interesting post about ${normalizedInput.searchKeyword}!`
      console.log(`[AI] Fallback to default comment: "${commentText}"`)
    }
  }
  
  // Append random Shopee link if provided
  let finalComment = commentText
  if (normalizedInput.linkShopee && normalizedInput.linkShopee.length > 0) {
    const randomLink = normalizedInput.linkShopee[Math.floor(Math.random() * normalizedInput.linkShopee.length)]
    finalComment = commentText + `\n${randomLink}`
  }
  return finalComment
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
      model: "gemini-2.5-flash",
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


// Handle commenting flow for search keyword results
const CommentFeedsAndSearch = async (
  page: Page,
  normalizedInput: NormalizedInput,
  mode: 'topTabComment' | 'recentTabComment' | 'feedsComment',
  scopeSelector: string
) => {
  try {
    // Determine comment count based on mode
    let commentCount: number
    if (mode === 'topTabComment' && normalizedInput.topTabComment) {
      commentCount = normalizedInput.topTabComment
    } else if (mode === 'feedsComment' && normalizedInput.feedsComment) {
      commentCount = normalizedInput.feedsComment
    } else if (mode === 'recentTabComment' && normalizedInput.recentTabComment) {
      commentCount = normalizedInput.recentTabComment
    } else {
      throw new Error(`Invalid mode or missing count for mode=${mode}`)
    }

    console.log(`[CommentSearchKeyWord] Mode: ${mode}, Comment count: ${commentCount}`)

    // Scope: contain all loaded posts inside this container (strict, no fallback)
    const SCOPE_SELECTOR = scopeSelector
    const scope = await page.waitForSelector(SCOPE_SELECTOR, { timeout: 15000 })
    if (!scope) {
      throw new Error(`Scope not found for selector: ${SCOPE_SELECTOR}`)
    }

    // Find all posts within scope
    const posts = await scope.$$('div[data-pressable-container="true"]')
    console.log(`[feed] Found ${posts.length} posts in scope`)

    if (posts.length === 0) {
      throw new Error('No posts found in scope')
    }

    // Loop for comment count (each iteration comments on 1 post)
    for (let commentIteration = 0; commentIteration < commentCount; commentIteration++) {
      console.log(`[CommentSearchKeyWord] Starting comment iteration ${commentIteration + 1}/${commentCount}`)
      
      // Use current index to get the post element
      const currentPost = posts[commentIteration]
      if (!currentPost) {
        console.log(`[feed] No post at index ${commentIteration}, skipping`)
        continue
      }

      console.log(`[feed] Processing post at index=${commentIteration}`)
      
      // Scroll post into view for natural behavior and lazy loading
      await humanScrollToElement(page, currentPost)
      
      // Check if more posts loaded after scroll (update posts array)
      const updatedPosts = await scope.$$('div[data-pressable-container="true"]')
      if (updatedPosts.length > posts.length) {
        console.log(`[feed] Lazy loading triggered: ${updatedPosts.length - posts.length} new posts loaded`)
        // Update posts array for next iterations
        posts.push(...updatedPosts.slice(posts.length))
      }
      
      // Click reply button within this post (click the container button, not the SVG)
      const replyIconSelector = 'div[role="button"] svg[aria-label="Reply"], div[role="button"] svg[aria-label="Trả lời"]'
      const replyIcon = await currentPost.$(replyIconSelector)
      
      if (replyIcon) {
        // Resolve container div[role="button"] that wraps the SVG
        const replyButtonContainer = await replyIcon.evaluateHandle((el) => {
          const svg = el as Element
          const container = svg.closest('div[role="button"]') as Element | null
          return container ?? svg.parentElement
        })
        console.log(`[feed] Found reply button, clicking container...`)
        // Re-query icon just before click to avoid stale handles after scroll/lazyload
        const recheckIcon = await currentPost.$(replyIconSelector)
        if (!recheckIcon) {
          console.log('[feed] Reply icon became stale, skipping this post')
          continue
        }
        await humanClick(page, replyButtonContainer as any)
        await humanDelay(600, 1200)

        // Move cursor away from any potential hover areas to prevent profile popup
        try {
          // Try multiple methods to ensure cursor moves
          // Method 1: Direct mouse move
          await page.mouse.move(50, 50)
          await humanDelay(200, 300)
          
          // Method 2: Move to a specific element (like top navigation)
          try {
            const topNav = await page.$('header, nav, [role="banner"]')
            if (topNav) {
              await topNav.hover()
              await humanDelay(200, 300)
            }
          } catch (e) {
            console.log('[feed] Could not hover top nav:', e instanceof Error ? e.message : String(e))
          }
          
          // Method 3: Move to viewport corner
          await page.evaluate(() => {
            window.scrollTo(0, 0) // Scroll to top
          })
          await page.mouse.move(10, 10) // Move to top-left corner
          
          await humanDelay(500, 800) // Wait longer to ensure cursor moved
          console.log('[feed] Cursor moved to safe area using multiple methods')
        } catch (e) {
          console.log('[feed] Could not move cursor:', e instanceof Error ? e.message : String(e))
        }

        // Step B: Focus composer textbox and type comment with mistakes
        try {
          // Wait for composer to appear within current post after clicking reply button
          const composer = await page.waitForSelector('div.x1wxtd61 [contenteditable="true"][role="textbox"]', { timeout: 5000 })          
          // Just focus on composer without any hover/click to avoid errors
          if (composer) {
            console.log(`[feed] Found composer textbox, typing comment...`)
            // Focus directly without hovering or clicking
            await composer.focus()
            await humanDelay(200, 300)
          }
          if (composer) {
            // Get status text from current post  
            let statusText = ''
            try {
              const statusSelector = 'div.x1wxtd61 .x1xdureb:nth-child(4) .x1a6qonq'
              const statusElement = await page.$(statusSelector)
              if (statusElement) {
                const rawText = await statusElement.evaluate(el => el.textContent || '')
                // Strip trailing Translate helper if present and normalize
                statusText = rawText.replace(/\s*Translate\s*$/i, '').trim()
                console.log(`[feed] Status text: "${statusText.slice(0, 100)}..." (len=${statusText.length})`)
                if (!statusText) {
                  console.log('[feed] Warning: statusText is empty after cleaning')
                }
              } else {
                console.log(`[feed] Status text element not found for selector: ${statusSelector}`)
              }
            } catch (e) {
              console.log('[feed] Error getting status text:', e instanceof Error ? e.message : String(e))
            }
            
            // Use handleComment function to generate comment
            const commentText = await handleComment(normalizedInput, statusText)
            
            if (commentText) {
              console.log(`[post] Typing comment: "${commentText}"`)
              //click vào viết comment
              await humanClick(page, composer)
              await humanDelay(600, 1200)
              await humanTypeWithMistakes(page, composer, commentText)
            } else {
              console.log('[post] No comment generated, skipping')
              continue
            }
          } else {
            console.log('[post] Composer textbox not found')
          }
        } catch (e) {
          console.log('[post] Error while typing comment:', e)
        }

        // Step C: Click post comment (submit)   
        await humanClick(page, '.x2lah0s:nth-child(1) > .x9dqhi0')        
          console.log(`[CommentSearchKeyWord] Successfully commented on post index=${commentIteration}`)
        } else {
          console.log(`[feed] Reply button not found for post index=${commentIteration}, skipping`)
        }
      
      console.log(`Comment iteration ${commentIteration + 1}/${commentCount} completed.`)
      
      // Add delay between comment iterations
        await humanDelay(2000, 4000)
    }

    console.log(`✅ All comment iterations completed. Total: ${commentCount} iteration(s)`)      
  } catch (error) {
    console.error('Failed while per-post scrolling/clicking:', error)
    throw error
  }
}

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

    // Handle feeds comments first, before any search navigation
    if (normalizedInput.feedsComment && normalizedInput.feedsComment > 0) {
      console.log('Step 1b: Using comment pool for feeds comments (before search)')
      await CommentFeedsAndSearch(page, normalizedInput, 'feedsComment', 'div.x1l7klhg')
    }

    // Step 2: Click search button
    console.log('Step 2: Click search button')
    try {
      const searchButton = await page.waitForSelector('a[role="link"][href="/search"]', { timeout: 10000 })
      if (!searchButton) throw new Error('Search button not found')
      await humanClick(page, searchButton)
      await humanDelay(1000, 2000)
    } catch (error) {
      console.error('Failed to click search button:', error)
      throw error
    }

    // Step 3: Type search keyword
    console.log('Step 3: Type search keyword')
    try {
      const searchInput = await page.waitForSelector('input[type="search"]', { timeout: 10000 })
      if (!searchInput) throw new Error('Search input not found')
      await humanTypeWithMistakes(page, searchInput, normalizedInput.searchKeyword || 'nails')
      await humanDelay(500, 1000)
      
      // Press Enter
      await page.keyboard.press('Enter')
      await humanDelay(7000, 10000)
    } catch (error) {
      console.error('Failed to type search keyword:', error)
      throw error
    }

    // Step 4: Handle different comment scenarios
    if(normalizedInput.searchKeyword && normalizedInput.topTabComment && normalizedInput.topTabComment > 0) {
      console.log('Step 4: Using comment pool for top tab comments')
      await CommentFeedsAndSearch(page, normalizedInput, 'topTabComment', '.xamitd3 > .x78zum5')
    } else if(normalizedInput.searchKeyword && normalizedInput.recentTabComment && normalizedInput.recentTabComment > 0) {
      console.log('Step 4: Using comment pool for recent tab comments')
      // Click recent tab first
      const recentTab = await page.$('.x1iyjqo2:nth-child(2) > .x1i10hfl')
      if (recentTab) {
        await humanClick(page, recentTab)
        await humanDelay(1000, 2000)
        await CommentFeedsAndSearch(page, normalizedInput, 'recentTabComment', '.xamitd3 > .x78zum5')
      } else {
        console.log('Step 4: Recent tab not found')
      }
    } else {
      console.log('Step 4: No valid comment configuration found')
    }
    
    return { success: true }

  } catch (error) {
    console.error('❌ Post and Comment automation failed:', error)
    // Rethrow so upstream IPC can catch and report properly
    throw error
  } finally {
    await page.close()
    const browser = page.browser()
    await browser.close()
  }
}





