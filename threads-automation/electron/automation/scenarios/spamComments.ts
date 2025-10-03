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
      const FOOTER_SELECTOR = '.x4vbgl9.x1qfufaz.x1k70j0n'

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

        // Click footer of this post instead of reply button
        let clicked = false
        try {
          const footer = await post.$(FOOTER_SELECTOR)
          if (footer) {
            console.log(`[feed] Found footer in post index=${currentIndex}. Preparing to click footer...`)
            try { await footer.evaluate((el: any) => el.scrollIntoView({ block: 'center', inline: 'center' })) } catch {}
            await humanDelay(150, 350)
            // Prefer DOM click then humanClick fallback
            try {
              console.log(`[feed] Trying DOM click on footer for post index=${currentIndex}`)
              await footer.evaluate((el: any) => el.click())
              console.log(`[feed] DOM click on footer reported success for post index=${currentIndex}`)
              clicked = true
            } catch (e) {
              console.log(`[feed] DOM click on footer failed for post index=${currentIndex}:`, e)
            }
            if (!clicked) {
              try {
                console.log(`[feed] Trying humanClick on footer for post index=${currentIndex}`)
                await humanClick(page as any, footer as any)
                console.log(`[feed] humanClick on footer reported success for post index=${currentIndex}`)
                clicked = true
              } catch (e2) {
                console.log(`[feed] humanClick on footer failed for post index=${currentIndex}:`, e2)
              }
            }
          } else {
            console.log(`[feed] Footer not found for post index=${currentIndex}`)
          }
        } catch {}

        console.log(`[feed] Post index=${currentIndex} clickResult=${clicked ? 'clicked' : 'not-found'}`)
        if (clicked) {
          await humanDelay(600, 1200)

          // Step A: Click comment action inside opened post (if required by UI layout)
          try {
            const commentActionSel = '.xqti54a .x6s0dn4:nth-child(2) > .x1i10hfl > .x6s0dn4'
            const commentAction = await page.$(commentActionSel)
            if (commentAction) {
              console.log(`[post] Clicking comment action button (open composer)`) 
              try { await humanClick(page as any, commentAction as any) } catch {}
              await humanDelay(300, 800)
            } else {
              console.log(`[post] Comment action button not found; continuing to composer`)
            }
          } catch (e) {
            console.log('[post] Error while clicking comment action:', e)
          }

          // Step B: Focus composer textbox and type comment with mistakes
          try {
            const composerSel = '[contenteditable="true"][role="textbox"]'
            const composer = await page.waitForSelector(composerSel, { timeout: 5000 })
            if (composer) {
              // Pick a comment
              const pool = normalizedInput.commentPool && normalizedInput.commentPool.length > 0
                ? normalizedInput.commentPool
                : ['Nice!', 'Great post!', 'Love this!', 'Awesome']
              const commentText = pool[Math.floor(Math.random() * pool.length)]
              console.log(`[post] Typing comment: "${commentText}"`)
              try { await humanClick(page as any, composer as any) } catch {}
              await humanDelay(200, 400)
              await humanTypeWithMistakes(page as any, composer as any, commentText)
              await humanDelay(300, 700)
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

          // Step D: Click back to feed
          try {
            const backSel = '.x1nhvcw1 .x1i10hfl'
            const backBtn = await page.$(backSel)
            if (backBtn) {
              console.log('[post] Clicking back to feed')
              try { await humanClick(page as any, backBtn as any) } catch { await backBtn.evaluate((el: any) => el.click()) }
              await humanDelay(500, 1000)
            } else {
              console.log('[post] Back button not found; attempting browser back')
              try { await page.goBack({ waitUntil: 'networkidle2' }) } catch {}
              await humanDelay(500, 1000)
            }
          } catch (e) {
            console.log('[post] Error while clicking back:', e)
          }
        }

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





