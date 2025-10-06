import type { Page } from 'puppeteer-core'
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

import path from 'path'
import { promises as fs } from 'fs'
import { pipeline } from 'stream/promises'
import { createWriteStream } from 'fs'


type Input = {
  accountName?: string
  linkDirectory?: string
}

type NormalizedInput = {
    accountName?: string
    linkDirectory?: string
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
      const accountName = getByBase('Account Name')
      const linkDirectory = getByBase('Link Directory')
      
      return { 
        accountName, 
        linkDirectory
      }
    } catch {
      return { 
        accountName: undefined, 
        linkDirectory: undefined
      }
    }
  }

  const normalizedInput = normalizeRecord(input as any)

  return { normalizedInput }
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
const CommentFeedsAndSearch = async (
  page: Page,
  normalizedInput: NormalizedInput,
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

    const baseOutputDir = normalizedInput.linkDirectory || path.join(process.cwd(), 'downloads')
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

type AccountItem = {
  accountName: string
  linkDirectory?: string
}

const normalizeAccountsFromInput = (input: any): AccountItem[] => {
  const rows: AccountItem[] = []
  const candidates = Array.isArray(input?.accounts)
    ? input.accounts
    : Array.isArray(input?.items)
      ? input.items
      : []
  for (const row of candidates) {
    if (!row) continue
    const lower: Record<string, any> = {}
    for (const [k, v] of Object.entries(row)) lower[String(k).toLowerCase()] = v
    const accountName = String(lower['account name'] ?? lower['accountname'] ?? lower['username'] ?? lower['handle'] ?? '').trim()
    const linkDirectoryRaw = lower['folder directory'] ?? lower['link directory'] ?? lower['folder'] ?? lower['directory']
    const linkDirectory = linkDirectoryRaw != null ? String(linkDirectoryRaw).trim() : undefined
    if (accountName) rows.push({ accountName, linkDirectory })
  }
  return rows
}

const processOneProfile = async (
  page: Page,
  accountName: string,
  linkDirectory?: string
) => {
  const profileUrl = buildThreadsProfileUrl(accountName)
  const targetUrl = profileUrl ?? 'https://threads.com/'
  console.log(`[profile] Navigate: ${targetUrl}`)
  await page.goto(targetUrl, { waitUntil: 'networkidle2' })
  await humanDelay(1500, 2500)

  const posts = await page.$$('div[data-pressable-container="true"]')
  console.log(`[feed] Found ${posts.length} posts initially`)

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
        currentIndex++
      } else {
        await humanScrollToElement(page, currentPost)
        await savePostMediaFromHandle(currentPost, baseOutputDir, currentIndex)
        currentIndex++
      }
    } else {
      await humanScroll(page, 800)
    }

    const updatedPosts = await page.$$('div[data-pressable-container="true"]')
    if (updatedPosts.length > posts.length) {
      posts.push(...updatedPosts.slice(posts.length))
      noNewPostsStreak = 0
    } else {
      noNewPostsStreak++
    }

    const processedAllLoaded = currentIndex >= posts.length
    const giveUpLoadingMore = noNewPostsStreak >= MAX_NO_NEW_POSTS_STREAK
    if (processedAllLoaded && giveUpLoadingMore) break
  }
}

export async function run(page: Page, input: Input = {}) {
  page.setDefaultTimeout(20000)
  try {
    console.log('Starting surfing threads and commenting...')
    
    const { normalizedInput } = buildNormalizedInput(input)
    
    console.log('📝 Raw Input:', input)
    console.log('[input] normalized:', normalizedInput)
 
    // Build accounts list from provided object (no CSV/Excel reading here)
    const accounts: AccountItem[] = normalizeAccountsFromInput(input)
    if (normalizedInput.accountName && accounts.length === 0) {
      accounts.push({ accountName: normalizedInput.accountName, linkDirectory: normalizedInput.linkDirectory })
    }

    if (accounts.length === 0) {
      console.warn('[run] No accounts provided in object input')
      return { success: false, message: 'No accounts provided' }
    }

    for (let i = 0; i < accounts.length; i++) {
      const row = accounts[i]
      console.log(`[run] Processing account ${i + 1}/${accounts.length}: ${row.accountName}`)
      await processOneProfile(page, row.accountName, row.linkDirectory)
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





