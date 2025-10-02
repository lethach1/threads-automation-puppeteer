import type { Page, ElementHandle } from 'puppeteer-core'
import { existsSync, statSync, readdirSync } from 'fs'
import { join as pathJoin } from 'path'
// @ts-ignore
import { 
  humanDelay, 
  humanTypeWithMistakes,
  humanClick
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

    // Step 4: Infinite scroll and comment on posts
    console.log('Step 4: Start infinite scroll and commenting')
    let totalPostsProcessed = 0
    const maxPosts = normalizedInput.feedsComment || 10
    const commentPool: string[] = (normalizedInput.commentPool && normalizedInput.commentPool.length > 0)
      ? normalizedInput.commentPool
      : ['Nice post!', 'Great content!', 'Love this!']

    while (totalPostsProcessed < maxPosts) {
      console.log(`Processing batch ${Math.floor(totalPostsProcessed / 10) + 1}...`)
      
      // Get current posts
      const posts = await page.$$('div[data-pressable-container="true"]')
      console.log(`Found ${posts.length} posts in current view`)
      
      // Process each post in current batch
      for (let i = 0; i < posts.length && totalPostsProcessed < maxPosts; i++) {
        try {
          console.log(`Processing post ${totalPostsProcessed + 1}/${maxPosts}`)
          
          // Step 5: Click reply button - get ElementHandle and use humanClick
          const btnHandle = await posts[i].evaluateHandle((post) => {
            const svg = post.querySelector(
              'div[role="button"] svg[aria-label="Reply"], div[role="button"] svg[aria-label="Trả lời"], div[role="button"] svg[title="Reply"], div[role="button"] svg[title="Trả lời"]'
            ) as SVGElement | null
            return svg ? svg.closest('div[role="button"]') : null
          })
          const replyBtn = btnHandle && btnHandle.asElement ? btnHandle.asElement() : null
          const clicked = !!replyBtn
          if (replyBtn) {
            await humanClick(page, replyBtn)
          }

          if (clicked) {
            await humanDelay(600, 1000)

            // Step 6: Type random comment
            const commentText = commentPool[Math.floor(Math.random() * commentPool.length)]
            console.log(`Commenting: "${commentText}"`)

            // Prefer dialog as composer; otherwise the current post region
            const composerRoot = (await page.$('div[role="dialog"]')) || posts[i]

            // Wait for a visible contenteditable textbox to appear inside composer
            await page.waitForFunction((root: HTMLElement) => {
              const isVisible = (el: Element) => {
                const rect = (el as HTMLElement).getBoundingClientRect()
                const style = window.getComputedStyle(el as HTMLElement)
                return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
              }
              const candidates: Element[] = Array.from(
                root.querySelectorAll('[contenteditable="true"][role="textbox"], [contenteditable="true"], div[role="textbox"], div[aria-multiline="true"]')
              )
              return candidates.some(isVisible)
            }, { timeout: 8000 }, await composerRoot.evaluateHandle(el => el as HTMLElement))

            // Get the input handle (first visible)
            const commentInput = await (async () => {
              const h = await composerRoot.evaluateHandle((root: HTMLElement) => {
                const isVisible = (el: Element) => {
                  const rect = (el as HTMLElement).getBoundingClientRect()
                  const style = window.getComputedStyle(el as HTMLElement)
                  return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
                }
                const selectors = '[contenteditable="true"][role="textbox"], [contenteditable="true"], div[role="textbox"], div[aria-multiline="true"]'
                const nodes = Array.from(root.querySelectorAll(selectors))
                return (nodes.find(isVisible) as HTMLElement | null) || null
              })
              // @ts-ignore
              return h.asElement ? h.asElement() : null
            })()

            if (!commentInput) throw new Error('Composer input not found')

            await humanClick(page, commentInput)
            await humanTypeWithMistakes(page, commentInput, commentText)
            await humanDelay(300, 600)

            // Try to click Post/Đăng button inside the same composer
            const postButton = await (async () => {
              const buttons = await composerRoot.$$('div[role="button"]')
              for (const b of buttons) {
                const t = (await b.evaluate((el: HTMLElement) => (el.innerText || '').trim().toLowerCase()))
                if (t === 'post' || t === 'đăng' || t === 'reply' || t === 'trả lời') return b
              }
              return null
            })()

            if (postButton) {
              await humanClick(page, postButton)
            } else {
              // Fallback: press Enter to submit
              await page.keyboard.press('Enter')
            }

            await humanDelay(800, 1300)
            console.log(`✅ Commented on post ${totalPostsProcessed + 1}`)
          }
          
          totalPostsProcessed++
          
          // Random delay between posts
          await humanDelay(2000, 4000)
          
        } catch (error) {
          console.error(`Failed to comment on post ${totalPostsProcessed + 1}:`, error)
          // Continue with next post
          totalPostsProcessed++
        }
      }
      
      // Scroll to load more posts
      if (totalPostsProcessed < maxPosts) {
        console.log('Scrolling to load more posts...')
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight)
        })
        await humanDelay(3000, 5000)
        
        // Wait for new posts to load
        await page.waitForFunction(() => {
          const posts = document.querySelectorAll('div[data-pressable-container="true"]')
          return posts.length > 0
        }, { timeout: 10000 })
      }
    }

    console.log(`🎉 Completed commenting on ${totalPostsProcessed} posts!`)
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





