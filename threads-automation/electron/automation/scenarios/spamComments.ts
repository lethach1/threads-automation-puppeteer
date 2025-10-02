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
    console.log('Step 1: Start script')
    await page.goto('https://threads.com/', { waitUntil: 'networkidle2' })
    await humanDelay(2000, 4000)

 

    console.log('🎉 All automation steps completed successfully!')
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





