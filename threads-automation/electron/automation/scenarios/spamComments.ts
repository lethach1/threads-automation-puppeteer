import type { Page } from 'puppeteer-core'
// @ts-ignore
import { 
  humanDelay, 
  humanTypeWithMistakes,
  humanClick,
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

export async function run(page: Page, input: Input = {}) {
  page.setDefaultTimeout(20000)
  try {
    console.log('Starting surfing threads and commenting...')

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
    // Preserve original keys so extractCommentTexts can read 'Comment(s) N' fields
    const items = baseItems.map((r) => ({ ...(r as any), ...normalizeRecord(r as any) }))

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

    // Step 4: Scroll feed per post and click Reply button within each post
    console.log('Step 4: Scroll per post and click reply')
    try {
      const POST_SELECTOR = 'div[data-pressable-container="true"]'
      const REPLY_SVG_SELECTOR = 'div[role="button"] svg[aria-label="Trả lời"]'

      const maxPostsToVisit = typeof normalizedInput.feedsComment === 'number' && !Number.isNaN(normalizedInput.feedsComment)
        ? Math.max(1, Math.min(60, normalizedInput.feedsComment))
        : 12
      const timeoutMs = 120_000
      const MAX_EMPTY_LOADS = 8

      let currentIndex = 0
      let visited = 0
      let emptyLoads = 0
      const startTime = Date.now()

      while (visited < maxPostsToVisit && (Date.now() - startTime < timeoutMs)) {
        let posts = await page.$$(POST_SELECTOR)
        console.log(`[feed] Queried posts: count=${posts.length}, currentIndex=${currentIndex}, visited=${visited}`)

        if (currentIndex >= posts.length) {
          const distance = Math.floor(Math.random() * (1200 - 600 + 1)) + 600
          console.log(`[feed] Need more posts. Scrolling distance=${distance}`)
          await humanScroll(page as any, distance, 'down')
          await humanDelay(500, 1200)

          posts = await page.$$(POST_SELECTOR)
          console.log(`[feed] Re-queried posts after scroll: count=${posts.length}, currentIndex=${currentIndex}`)
          if (currentIndex >= posts.length) {
            emptyLoads += 1
            if (emptyLoads >= MAX_EMPTY_LOADS) {
              console.log('No more posts loaded. Stopping.')
              break
            } else {
              console.log(`[feed] Empty load #${emptyLoads}. Will try again.`)
              continue
            }
          } else {
            emptyLoads = 0
          }
        }

        let post = posts[currentIndex]
        console.log(`[feed] Processing post index=${currentIndex} of ${posts.length}`)
        try {
          await post.evaluate((el) => {
            el.scrollIntoView({ block: 'center', inline: 'center' })
          })
        } catch {
          // Re-query once if detached
          posts = await page.$$(POST_SELECTOR)
          console.log(`[feed] Post handle detached. Re-queried posts: count=${posts.length}`)
          if (currentIndex < posts.length) {
            post = posts[currentIndex]
            try {
              await post.evaluate((el) => {
                el.scrollIntoView({ block: 'center', inline: 'center' })
              })
            } catch {}
          } else {
            console.log('[feed] currentIndex now out of range after re-query. Continuing...')
            continue
          }
        }

        await humanDelay(400, 900)

        // Find reply button inside this post
        let clicked = false
        try {
          const svg = await post.$(REPLY_SVG_SELECTOR)
          if (svg) {
            console.log(`[feed] Found reply SVG in post index=${currentIndex}. Resolving button...`)
            // @ts-ignore
            const replyBtnHandle = await svg.evaluateHandle((el: any) => el.closest('div[role="button"]'))
            if (replyBtnHandle) {
              console.log(`[feed] Clicking reply button for post index=${currentIndex}`)
              await humanClick(page as any, replyBtnHandle as any)
              clicked = true
            }
          }
        } catch {}

        if (!clicked) {
          try {
            // Fallback: full evaluate within the post scope
            // @ts-ignore
            const replyBtnHandle = await post.evaluateHandle((root: any) => {
              const svg = root.querySelector('div[role="button"] svg[aria-label="Trả lời"]')
              return svg ? svg.closest('div[role="button"]') : null
            })
            if (replyBtnHandle) {
              console.log(`[feed] Fallback found reply button in post index=${currentIndex}. Clicking...`)
              await humanClick(page as any, replyBtnHandle as any)
              clicked = true
            }
          } catch {}
        }

        console.log(`[feed] Post index=${currentIndex} clickResult=${clicked ? 'clicked' : 'not-found'}`)
        if (clicked) await humanDelay(600, 1500)

        visited += 1
        currentIndex += 1

        // Light scroll to encourage lazy-loading next items
        const nudge = Math.floor(Math.random() * (500 - 200 + 1)) + 200
        console.log(`[feed] Nudge scroll distance=${nudge}`)
        await humanScroll(page as any, nudge, 'down')
        await humanDelay(300, 900)
      }

      console.log(`✅ Processed ${visited} post(s)`)      
    } catch (error) {
      console.error('Failed while per-post scrolling/clicking:', error)
      throw error
    }

    // await page.close()
    // const browser = page.browser()
    // await browser.close()
    // return { success: true }

  } catch (error) {
    console.error('❌ Post and Comment automation failed:', error)
    // Rethrow so upstream IPC can catch and report properly
    throw error
  }
}





