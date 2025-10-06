import type { Page } from 'puppeteer-core'
// @ts-ignore
import * as HB from '../human-behavior.js'
// @ts-ignore
import { humanScroll } from '../human-behavior.js'

// @ts-ignore
import { 
  humanDelay, 
  humanScrollToElement
} from '../human-behavior.js'

import path from 'path'
import { promises as fs } from 'fs'
import { pipeline } from 'stream/promises'
import { createWriteStream } from 'fs'


type Input = {
  accountName?: string
  linkDirectory?: string
  items?: any[]
}

type AccountItem = {
  accountName: string
  linkDirectory?: string
}

const normalizeAccountsFromInput = (input: any): AccountItem[] => {
  const rows: AccountItem[] = []
  const baseItems = Array.isArray(input?.items) && input.items.length > 0 ? input.items : [input]
  for (const row of baseItems) {
    if (!row) continue
    const lower: Record<string, any> = {}
    for (const [k, v] of Object.entries(row)) lower[String(k).toLowerCase()] = v
    const accountNameRaw = lower['account name'] ?? lower['username'] ?? lower['handle']
    const linkDirRaw = lower['link directory'] ?? lower['folder directory']
    const accountName = accountNameRaw != null ? String(accountNameRaw).trim() : ''
    const linkDirectory = linkDirRaw != null ? String(linkDirRaw).trim() : undefined
    if (accountName) rows.push({ accountName, linkDirectory })
  }
  return rows
}

// Helpers: filesystem and downloads
const ensureDir = async (dirPath: string) => {
  try {
    await fs.mkdir(dirPath, { recursive: true })
  } catch {}
}

const getFileExtensionFromUrl = (mediaUrl: string, fallback: string) => {
  try {
    const pathname = new URL(mediaUrl).pathname
    const ext = path.extname(pathname)
    if (ext) return ext.split('?')[0] || ext
  } catch {}
  return fallback
}

const sanitize = (name: string) => name.replace(/[^a-z0-9-_]/gi, '_').slice(0, 80)

const extractMediaUrlsFromPost = async (postHandle: any) => {
  return await postHandle.evaluate((el: Element) => {
    const imgUrls = Array.from(el.querySelectorAll('img'))
      .map((img) => (img as HTMLImageElement).src)
      .filter(Boolean)
    const videoEls = Array.from(el.querySelectorAll('video')) as HTMLVideoElement[]
    const videoUrls: string[] = []
    for (const v of videoEls) {
      if (v.src) videoUrls.push(v.src)
      const sources = Array.from(v.querySelectorAll('source')) as HTMLSourceElement[]
      for (const s of sources) if (s.src) videoUrls.push(s.src)
    }
    return { imgUrls, videoUrls }
  })
}

const downloadFile = async (mediaUrl: string, filePath: string) => {
  const res = await fetch(mediaUrl)
  if (!res.ok || !res.body) throw new Error(`Failed to download ${mediaUrl}: ${res.status}`)
  await pipeline(res.body as any, createWriteStream(filePath))
}

const savePostMediaFromHandle = async (
  postHandle: any,
  baseOutputDir: string,
  postIndex: number
) => {
  const { imgUrls, videoUrls } = await extractMediaUrlsFromPost(postHandle)
  console.log(`[media] Found images=${imgUrls.length}, videos=${videoUrls.length} at index=${postIndex}`)

  const folderName = `post_${String(postIndex).padStart(4, '0')}`
  const postDir = path.join(baseOutputDir, sanitize(folderName))
  await ensureDir(postDir)

  let mediaIndex = 0
  for (const url of imgUrls) {
    const ext = getFileExtensionFromUrl(url, '.jpg')
    const filename = `image_${String(mediaIndex++).padStart(3, '0')}${ext}`
    const fp = path.join(postDir, filename)
    try {
      await downloadFile(url, fp)
      console.log(`[download] Saved ${fp}`)
    } catch (e) {
      console.warn(`[download] Failed image ${url}:`, e)
    }
  }

  mediaIndex = 0
  for (const url of videoUrls) {
    const ext = getFileExtensionFromUrl(url, '.mp4')
    const filename = `video_${String(mediaIndex++).padStart(3, '0')}${ext}`
    const fp = path.join(postDir, filename)
    try {
      await downloadFile(url, fp)
      console.log(`[download] Saved ${fp}`)
    } catch (e) {
      console.warn(`[download] Failed video ${url}:`, e)
    }
  }
}

// Handle commenting flow for search keyword results
const dowloadContentAndImages = async (
  page: Page,
  linkDirectory: string | undefined,
  scopeSelector: string
) => {
  try {
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

    // Keep processing and re-querying until no new posts load after several attempts
    let currentIndex = 0
    let noNewPostsStreak = 0
    const MAX_NO_NEW_POSTS_STREAK = 3

    const baseOutputDir = linkDirectory || path.join(process.cwd(), 'downloads')
    await ensureDir(baseOutputDir)

    while (true) {
      const hasUnprocessedPost = currentIndex < posts.length

      if (hasUnprocessedPost) {
        console.log(`[feed] Processing post at index=${currentIndex}`)
        const currentPost = posts[currentIndex]
        if (!currentPost) {
          console.log(`[feed] No post at index ${currentIndex}, skipping`)
          currentIndex++
        } else {
          // Scroll post into view for natural behavior and lazy loading
          await humanScrollToElement(page, currentPost)

          // Save media for this post
          await savePostMediaFromHandle(currentPost, baseOutputDir, currentIndex)
          currentIndex++
        }
      } else {
        // No unprocessed posts left; try to scroll further to trigger lazy loading
        await humanScroll(page, 800)
      }

      // Re-query posts after potential lazy load
      const updatedPosts = await scope.$$('div[data-pressable-container="true"]')
      if (updatedPosts.length > posts.length) {
        const newlyLoadedCount = updatedPosts.length - posts.length
        console.log(`[feed] Lazy loading triggered: ${newlyLoadedCount} new posts loaded`)
        posts.push(...updatedPosts.slice(posts.length))
        noNewPostsStreak = 0
      } else {
        noNewPostsStreak++
      }

      // Exit if we've processed everything and no more posts are loading
      const processedAllLoaded = currentIndex >= posts.length
      const giveUpLoadingMore = noNewPostsStreak >= MAX_NO_NEW_POSTS_STREAK
      if (processedAllLoaded && giveUpLoadingMore) {
        console.log('[feed] No more new posts detected; stopping processing')
        break
      }
    }

  } catch (error) {
    console.error('Failed while per-post scrolling/clicking:', error)
    throw error
  }
}

const buildThreadsProfileUrl = (accountName?: string) => {
  if (!accountName) return undefined
  const trimmed = String(accountName).trim()
  if (!trimmed) return undefined
  const handle = trimmed.startsWith('@') ? trimmed : `@${trimmed}`
  return `https://www.threads.com/${handle}`
}

// Removed duplicate per-profile processing; using dowloadContentAndImages instead

export async function run(page: Page, input: Input = {}) {
  page.setDefaultTimeout(20000)
  try {
    console.log('Starting surfing threads and commenting...')
    
    console.log('📝 Raw Input:', input)
 
    // Build accounts list from provided object (no CSV/Excel reading here)
    const accounts: AccountItem[] = normalizeAccountsFromInput(input)
    const preview = accounts[0] ? { accountName: accounts[0].accountName, linkDirectory: accounts[0].linkDirectory } : { accountName: undefined, linkDirectory: undefined }
    console.log('[input] normalized:', preview)

    if (accounts.length === 0) {
      console.warn('[run] No accounts provided in object input')
      return { success: false, message: 'No accounts provided' }
    }

    for (let i = 0; i < accounts.length; i++) {
      const row = accounts[i]
      const profileUrl = buildThreadsProfileUrl(row.accountName)
      const targetUrl = profileUrl ?? 'https://threads.com/'
      console.log(`[profile] Navigate: ${targetUrl}`)
      await page.goto(targetUrl, { waitUntil: 'networkidle2' })
      await humanDelay(1500, 2500)
      await dowloadContentAndImages(page, row.linkDirectory, 'div.x1iorvi4:nth-child(2)')
      await humanDelay(800, 1500)
    }

    return { success: true, processed: accounts.length }

  } catch (error) {
    console.error('Post and Comment automation failed:', error)
    // Rethrow so upstream IPC can catch and report properly
    throw error
  } finally {
    await page.close()
    const browser = page.browser()
    await browser.close()
  }
}





