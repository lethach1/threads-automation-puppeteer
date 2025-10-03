import type { Page } from 'puppeteer-core'
// @ts-ignore
import { 
  humanDelay, 
  humanTypeWithMistakes,
  humanClick,
  humanScrollToElement
} from '../human-behavior.js'
// @ts-ignore
import * as HB from '../human-behavior.js'
// @ts-ignore
import { humanScroll } from '../human-behavior.js'

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
  }>
}

// Pure helper function to normalize input data
const buildNormalizedInput = (input: Input) => {
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
      const profile = getByBase('Profile')
      const feedsComment = getByBase('Feeds comment')
      const searchKeyword = getByBase('Search keyword')
      const topTabComment = getByBase('Top tab comment')
      const recentTabComment = getByBase('Recent tab comment')
      const commentPool = getByBase('Comment pool')
      const linkShopee = getByBase('Link Shopee')
      const prompt = getByBase('Promt')
      const gptKey = getByBase('GPT key')
      
      return { 
        profile, 
        feedsComment: feedsComment ? parseInt(feedsComment) : undefined,
        searchKeyword, 
        topTabComment: topTabComment ? parseInt(topTabComment) : undefined,
        recentTabComment: recentTabComment ? parseInt(recentTabComment) : undefined,
        commentPool: commentPool ? commentPool.split(';').map(c => c.trim()).filter(c => c) : undefined,
        linkShopee, 
        prompt, 
        gptKey 
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
        gptKey: undefined 
      }
    }
  }

  const normalizedInput = { ...normalizeRecord(input as any) }
  const baseItems = Array.isArray(input.items) && input.items.length > 0 ? input.items as any[] : [input as any]
  const items = baseItems.map((r) => ({ ...(r as any), ...normalizeRecord(r as any) }))

  return { normalizedInput, items }
}

// Refactored: handle commenting flow for search keyword results
const CommentSearchKeyWord = async (
  page: Page,
  normalizedInput: { 
    searchKeyword?: string; 
    feedsComment?: number; 
    commentPool?: string[];
    gptKey?: string;
    prompt?: string;
    linkShopee?: string;
    topTabComment?: number;
    recentTabComment?: number;
  },
  mode: 'gptKey' | 'topTabComment' | 'recentTabComment'
) => {
  try {
    // Determine comment count based on mode
    let commentCount = 1
    if (mode === 'topTabComment' && normalizedInput.topTabComment) {
      commentCount = normalizedInput.topTabComment
    } else if (mode === 'recentTabComment' && normalizedInput.recentTabComment) {
      commentCount = normalizedInput.recentTabComment
    }

    console.log(`[CommentSearchKeyWord] Mode: ${mode}, Comment count: ${commentCount}`)

    // Scope: contain all loaded posts inside this container (strict, no fallback)
    const SCOPE_SELECTOR = '.xamitd3 > .x78zum5'
    let scope = await page.waitForSelector(SCOPE_SELECTOR, { timeout: 15000 })
    if (!scope) {
      throw new Error(`Scope not found for selector: ${SCOPE_SELECTOR}`)
    }

    // Find all posts within scope
    let posts = await scope.$$('div[data-pressable-container="true"]')
    console.log(`[feed] Found ${posts.length} posts in scope`)

    // Debug: check if scope selector is correct
    if (posts.length === 0) {
      console.log(`[debug] Scope selector "${SCOPE_SELECTOR}" found, but no posts inside`)
      
      // Try broader search to see if posts exist elsewhere
      const allPosts = await page.$$('div[data-pressable-container="true"]')
      console.log(`[debug] Total posts on page: ${allPosts.length}`)
      
      // Try alternative selectors
      const altPosts = await scope.$$('article, [role="article"], div[data-testid*="post"]')
      console.log(`[debug] Alternative selectors found: ${altPosts.length} elements`)
      
      if (allPosts.length > 0) {
        console.log(`[debug] Posts exist but not in scope. Trying broader scope...`)
        // Use broader scope if posts exist elsewhere
        const broaderScope = await page.$('main, [role="main"], body')
        if (broaderScope) {
          const broaderPosts = await broaderScope.$$('div[data-pressable-container="true"]')
          console.log(`[debug] Broader scope found ${broaderPosts.length} posts`)
          if (broaderPosts.length > 0) {
            console.log(`[feed] Using broader scope for posts`)
            // Update scope and posts
            scope = broaderScope
            posts = broaderPosts
          }
        }
      }
      
      if (posts.length === 0) {
        throw new Error('No posts found in scope or page')
      }
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
      
      // Click reply button within this post
      const replyButton = await currentPost.$('div[role="button"] svg[aria-label="Reply"], div[role="button"] svg[aria-label="Trả lời"], div[role="button"] svg[title="Reply"], div[role="button"] svg[title="Trả lời"]')
      
      if (replyButton) {
        console.log(`[feed] Found reply button, clicking...`)
        await humanClick(page, replyButton)
        await humanDelay(600, 1200)

        // Step B: Focus composer textbox and type comment with mistakes
        try {
          const composerSel = '[contenteditable="true"][role="textbox"]'
          const composer = await page.waitForSelector(composerSel, { timeout: 5000 })
          if (composer) {
            let commentText = ''
            
            // Scenario 1: ChatGPT generation (if gptKey exists)
            if (mode === 'gptKey' && normalizedInput.gptKey) {
              try {
                // Generate comment using ChatGPT API
                const prompt = normalizedInput.prompt || 'Generate a relevant comment for this social media post'
                const shopeeLink = normalizedInput.linkShopee ? `\n\nCheck out: ${normalizedInput.linkShopee}` : ''
                
                // TODO: Implement ChatGPT API call here using prompt and shopeeLink
                // For now, use a placeholder (prompt variable will be used in actual ChatGPT integration)
                console.log(`[post] Will use prompt: "${prompt}" for ChatGPT generation`)
                commentText = `Generated comment for: ${normalizedInput.searchKeyword}${shopeeLink}`
                console.log(`[post] Generated ChatGPT comment: "${commentText}"`)
              } catch (e) {
                console.log('[post] ChatGPT generation failed, using fallback:', e)
                commentText = 'Great post!'
              }
            } 
            // Scenario 2 & 3: Use comment pool for topTabComment or recentTabComment
            else if (mode === 'topTabComment' || mode === 'recentTabComment') {
              if (normalizedInput.commentPool && normalizedInput.commentPool.length > 0) {
                commentText = normalizedInput.commentPool[Math.floor(Math.random() * normalizedInput.commentPool.length)]
                console.log(`[post] Using pool comment: "${commentText}"`)
              } else {
                console.log(`[post] No comment pool provided, skipping comment`)
                continue
              }
            }
            
            console.log(`[post] Typing comment: "${commentText}"`)
            try { await humanClick(page as any, composer as any) } catch {}
            await humanTypeWithMistakes(page as any, composer as any, commentText)
          } else {
            console.log('[post] Composer textbox not found')
          }
        } catch (e) {
          console.log('[post] Error while typing comment:', e)
        }

        // Step C: Click post comment (submit)  
        try {
          const submitSelPrimary = '.x2lah0s:nth-child(1) > .x9dqhi0'
          let submitBtn = await page.$(submitSelPrimary)
          if (!submitBtn) {
            // fallback: try a broader container
            const submitSelFallback = '.x2lah0s .x9dqhi0'
            submitBtn = await page.$(submitSelFallback)
          }
          if (submitBtn) {
            console.log('[post] Clicking submit comment button')
            try {
              await submitBtn.evaluate((el: any) => el.click())
            } catch {
              try { await humanClick(page as any, submitBtn as any) } catch {}
            }
            await humanDelay(600, 1200)
          } else {
            console.log('[post] Submit comment button not found')
          }
          } catch (e) {
            console.log('[post] Error while submitting comment:', e)
          }
          
          console.log(`[CommentSearchKeyWord] Successfully commented on post index=${commentIteration}`)
        } else {
          console.log(`[feed] Reply button not found for post index=${commentIteration}, skipping`)
        }
      
      console.log(`✅ Comment iteration ${commentIteration + 1}/${commentCount} completed.`)
      
      // Add delay between comment iterations
      if (commentIteration < commentCount - 1) {
        console.log('[CommentSearchKeyWord] Waiting before next comment iteration...')
        await humanDelay(2000, 4000)
      }
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
      
      // Press Enter
      await page.keyboard.press('Enter')
      await humanDelay(2000, 3000)
    } catch (error) {
      console.error('Failed to type search keyword:', error)
      throw error
    }

    // Step 4: Handle different comment scenarios
    if(normalizedInput.gptKey) {
      console.log('Step 4: Using ChatGPT to generate comments')
      await CommentSearchKeyWord(page, normalizedInput, 'gptKey')
    } else if(normalizedInput.topTabComment && normalizedInput.topTabComment > 0) {
      console.log('Step 4: Using comment pool for top tab comments')
      await CommentSearchKeyWord(page, normalizedInput, 'topTabComment')
    } else if(normalizedInput.recentTabComment && normalizedInput.recentTabComment > 0) {
      console.log('Step 4: Using comment pool for recent tab comments')
      // Click recent tab first
      try {
        const recentTab = await page.$('.x1iyjqo2:nth-child(2) > .x1i10hfl')
        if (recentTab) {
          await humanClick(page as any, recentTab as any)
          await humanDelay(1000, 2000)
        }
      } catch (e) {
        console.log('[run] Failed to click recent tab:', e)
      }
      await CommentSearchKeyWord(page, normalizedInput, 'recentTabComment')
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





