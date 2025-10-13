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
  forumName?: string
  linkDirectory?: string
  // Optional list of items (kept for compatibility with caller shape)
  items?: any[]
  // Optional URL to scrape (defaults to Reddit home)
  targetUrl?: string
  // Optional filter: only process posts within N recent days
  recentDays?: number
}

type NormalizedInput = {
  forumName?: string
  linkDirectory?: string
  targetUrl?: string
  recentDays?: number
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
      const forumName = getByBase('Forum Name')
      const linkDirectory = getByBase('Folder Directory')
      const recentDaysRaw = getByBase('Recent Days')

      return { 
        linkDirectory,
        targetUrl: undefined,
        forumName,
        recentDays: recentDaysRaw != null ? Number(recentDaysRaw) : undefined
      }
    } catch {
      return { 
        forumName: undefined, 
        linkDirectory: undefined,
        recentDays: undefined,
        targetUrl: undefined
      }
    }
  }

  const normalizedInput = normalizeRecord(input as any)
  // Handle both direct array input and object with items property
  const baseItems = Array.isArray(input) ? input as any[] : 
                   (Array.isArray(input.items) && input.items.length > 0 ? input.items as any[] : [input as any])
  const items = baseItems.map((r) => ({ ...(r as any), ...normalizeRecord(r as any) }))

  return { normalizedInput, items }
}


// Helpers: filesystem and downloads
const ensureDir = async (dirPath: string) => {
  try {
    // Validate path before creating
    if (!dirPath || dirPath.trim() === '') {
      throw new Error('Directory path is empty')
    }
    
    // Check if path contains invalid characters or is outside allowed directories
    const normalizedPath = path.resolve(dirPath)
    const cwd = process.cwd()
    
    // Ensure path is within allowed directories (Documents, Desktop, Downloads)
    const userHome = process.env.USERPROFILE || process.env.HOME || ''
    const allowedPaths = [
      path.join(userHome, 'Documents'),
      path.join(userHome, 'Desktop'), 
      path.join(userHome, 'Downloads'),
      cwd // Current working directory as fallback
    ]
    
    const isAllowed = allowedPaths.some(allowedPath => normalizedPath.startsWith(allowedPath))
    if (!isAllowed) {
      console.warn(`[fs] Path ${dirPath} is not in allowed directories, using fallback`)
      throw new Error(`Path ${dirPath} is not accessible`)
    }
    
    await fs.mkdir(dirPath, { recursive: true })
    console.log(`[fs] Created directory: ${dirPath}`)
  } catch (error) {
    console.error(`[fs] Failed to create directory ${dirPath}:`, error)
    throw error
  }
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
    // Chỉ lấy ảnh từ post content, bỏ qua avatar và các ảnh khác
    // Tìm tất cả ảnh nhưng loại bỏ avatar (thường ở đầu post)
    const allImgs = Array.from(el.querySelectorAll('img')) as HTMLImageElement[]
    
    // Bỏ qua ảnh avatar (thường là ảnh đầu tiên, nhỏ, và có class/attribute đặc biệt)
    const contentImgs = allImgs.filter(img => {
      const src = img.src
      if (!src) return false
      
      // Bỏ qua ảnh có kích thước quá nhỏ (avatar thường < 100px)
      if (img.width < 100 || img.height < 100) return false
      
      // Bỏ qua ảnh có URL chứa từ khóa avatar/profile
      if (src.includes('profile') || src.includes('avatar') || src.includes('user') || src.includes('headshot')) {
        return false
      }
      
      // Bỏ qua ảnh có class/attribute đặc biệt của avatar
      const parent = img.closest('div')
      if (parent && (
        parent.className.includes('avatar') || 
        parent.className.includes('profile') ||
        parent.getAttribute('data-testid')?.includes('avatar')
      )) {
        return false
      }
      
      return true
    })
    
    const imgUrls = contentImgs.map(img => img.src).filter(Boolean)
    
    // Lấy video từ post content
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

// Extract cleaned status text from a post element
const getStatusTextFromPost = async (postHandle: any): Promise<string> => {
  try {
    // Selector targeting post text container; keep minimal to avoid avatars/metadata
    const statusSelector = 'div.x1a6qonq'
    const statusElement = await postHandle.$(statusSelector)
    if (!statusElement) return ''
    const rawText: string = await statusElement.evaluate((el: Element) => (el.textContent || ''))
    // Strip trailing "Translate" helper and trim
    return rawText.replace(/\s*Translate\s*$/i, '').trim()
  } catch {
    return ''
  }
}

// CSV helpers for statuses
const ensureStatusesCsvHeader = async (csvPath: string) => {
  try {
    const stat = await fs.stat(csvPath).catch(() => null as any)
    if (!stat || stat.size === 0) {
      // Prepend UTF-8 BOM so Excel renders Vietnamese correctly; use CRLF line endings on Windows
      await fs.writeFile(csvPath, '\uFEFFindex,status\r\n', { encoding: 'utf-8' })
      console.log(`[csv] Initialized statuses CSV with header: ${csvPath}`)
    }
  } catch (e) {
    console.error('[csv] Failed to ensure CSV header:', e instanceof Error ? e.message : String(e))
  }
}

const appendStatusRow = async (csvPath: string, index: number, status: string) => {
  try {
    const escaped = '"' + status.replace(/"/g, '""') + '"'
    await fs.appendFile(csvPath, `${index},${escaped}\r\n`, { encoding: 'utf-8' })
  } catch (e) {
    console.error('[csv] Failed to append status row:', e instanceof Error ? e.message : String(e))
  }
}

const downloadFile = async (mediaUrl: string, filePath: string) => {
  try {
    console.log(`[download] Starting download:`)
    const res = await fetch(mediaUrl)
    if (!res.ok || !res.body) throw new Error(`Failed to download ${mediaUrl}: ${res.status}`)
    await pipeline(res.body as any, createWriteStream(filePath))
    console.log(`[download] Successfully downloaded: ${filePath}`)
  } catch (error) {
    console.error(`[download] Failed to download ${mediaUrl}:`, error)
    throw error
  }
}

const savePostMediaFromHandle = async (
  postHandle: any,
  baseOutputDir: string,
  postIndex: number
) => {
  const { imgUrls, videoUrls } = await extractMediaUrlsFromPost(postHandle)
  console.log(`[media] Found images=${imgUrls.length}, videos=${videoUrls.length} at index=${postIndex}`)

  // Nếu không có media nào, bỏ qua post này
  if (imgUrls.length === 0 && videoUrls.length === 0) {
    console.log(`[media] No media found for post ${postIndex}, skipping...`)
    return
  }

  // Chỉ cần đảm bảo base directory tồn tại, không tạo folder riêng cho post
  await ensureDir(baseOutputDir)

  let mediaIndex = 0
  for (const url of imgUrls) {
    const ext = getFileExtensionFromUrl(url, '.jpg')
    const filename = `post_${String(postIndex + 1).padStart(3, '0')}_image_${String(mediaIndex + 1).padStart(2, '0')}${ext}`
    const fp = path.join(baseOutputDir, filename)
    try {
      await downloadFile(url, fp)
      console.log(`[download] Saved image: ${fp}`)
    } catch (e) {
      console.warn(`[download] Failed to download image ${url}:`, e instanceof Error ? e.message : String(e))
    }
    mediaIndex++
  }

  mediaIndex = 0
  for (const url of videoUrls) {
    const ext = getFileExtensionFromUrl(url, '.mp4')
    const filename = `post_${String(postIndex + 1).padStart(3, '0')}_video_${String(mediaIndex + 1).padStart(2, '0')}${ext}`
    const fp = path.join(baseOutputDir, filename)
    try {
      await downloadFile(url, fp)
      console.log(`[download] Saved video: ${fp}`)
    } catch (e) {
      console.warn(`[download] Failed to download video ${url}:`, e instanceof Error ? e.message : String(e))
    }
    mediaIndex++
  }
}

// Extract Reddit post metadata from a post element
const getRedditPostMeta = async (postHandle: any) => {
  try {
    const { titleAttr, titleText, iso, ts, text } = await postHandle.evaluate((el: Element) => {
      const post = el as HTMLElement
      const timeEl = post.querySelector('faceplate-timeago time') as HTMLTimeElement | null
      const iso = timeEl?.getAttribute('datetime') || ''
      const ts = iso ? Date.parse(iso) : NaN
      const titleAttr = post.getAttribute('post-title') || ''
      const titleAnchor = post.querySelector('a[slot="title"]') as HTMLAnchorElement | null
      const titleText = (titleAnchor?.textContent || '').trim()
      const textEl = post.querySelector('shreddit-post-text-body div[property="schema:articleBody"]') as HTMLElement | null
      const text = (textEl?.innerText || '').trim()
      return { titleAttr, titleText, iso, ts, text }
    })
    const title = (titleAttr && titleAttr.trim()) || (titleText && titleText.trim()) || ''
    return { title, iso, ts: Number.isFinite(ts) ? ts : (iso ? Date.parse(iso) : NaN), text }
  } catch {
    return { title: '', iso: '', ts: NaN, text: '' }
  }
}

// Reddit-specific download flow
const downloadRedditPosts = async (
  page: Page,
  linkDirectory: string | undefined,
  scopeSelector: string,
  postSelector: string,
  recentDays?: number
) => {
  try {
    console.log(`[download] Starting Reddit content download for directory: ${linkDirectory}`)
    
    // Scope: contain all loaded posts inside this container (strict)
    const SCOPE_SELECTOR = scopeSelector
    const POST_SELECTOR = postSelector
    console.log(`[download] Waiting for scope selector: ${SCOPE_SELECTOR}`)
    
    const scope = await page.waitForSelector(SCOPE_SELECTOR, { timeout: 30000 })
    if (!scope) {
      throw new Error(`Scope not found for selector: ${SCOPE_SELECTOR}`)
    }
    console.log(`[download] Scope found, querying posts with: ${POST_SELECTOR}`)

    // Find all posts within scope
    const posts = await scope.$$(POST_SELECTOR)
    console.log(`[feed] Found ${posts.length} posts in scope`)

    if (posts.length === 0) {
      throw new Error('No posts found in scope')
    }

    // Keep processing and re-querying until no new posts load after several attempts
    let currentIndex = 0
    let noNewPostsStreak = 0
    const MAX_NO_NEW_POSTS_STREAK = 3

    // Default output directory under Downloads/RedditDownloads
    const defaultDir = path.join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads', 'RedditDownloads')
    let baseOutputDir = linkDirectory || defaultDir
    console.log(`[download] Using output directory: ${baseOutputDir}`)
    
    try {
      await ensureDir(baseOutputDir)
    } catch (dirError) {
      console.error(`[download] Failed to create base directory ${baseOutputDir}:`, dirError)
      // Fallback to user's Downloads folder
      const userDownloads = path.join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads', 'RedditDownloads')
      console.log(`[download] Falling back to: ${userDownloads}`)
      await ensureDir(userDownloads)
      baseOutputDir = userDownloads
    }

    // Prepare CSV path and header (write-as-you-go)
    const csvPath = path.join(baseOutputDir, 'reddit_posts.csv')
    await ensureStatusesCsvHeader(csvPath)

    while (true) {
      const hasUnprocessedPost = currentIndex < posts.length

      if (hasUnprocessedPost) {
        console.log(`[feed] Processing post at index=${currentIndex}`)
        const currentPost = posts[currentIndex]
        if (!currentPost) {
          console.log(`[feed] No post at index ${currentIndex}, skipping`)
          currentIndex++
        } else {
          try {
            // Scroll post into view for natural behavior and lazy loading
            await humanScrollToElement(page, currentPost)
            // Filter by recentDays if provided
            let withinRange = true
            if (recentDays && recentDays > 0) {
              const meta = await getRedditPostMeta(currentPost)
              if (meta.iso) {
                const threshold = Date.now() - recentDays * 24 * 60 * 60 * 1000
                withinRange = typeof meta.ts === 'number' && !Number.isNaN(meta.ts) ? meta.ts >= threshold : true
              }
            }

            if (!withinRange) {
              console.log(`[feed] Skip post at index=${currentIndex} due to date filter (recentDays=${recentDays})`)
              currentIndex++
              continue
            }

            const statusText = await getStatusTextFromPost(currentPost)
            if (statusText) {
              console.log(`[feed] Status text: "${statusText.slice(0, 100)}..." (len=${statusText.length})`)
              await appendStatusRow(csvPath, currentIndex + 1, statusText)
            } else {
              console.log('[feed] No status text extracted for this post')
            }

            // Save media for this post
            await savePostMediaFromHandle(currentPost, baseOutputDir, currentIndex)
            console.log(`[feed] Successfully processed post ${currentIndex}`)
          } catch (postError) {
            console.error(`[feed] Failed to process post ${currentIndex}:`, postError instanceof Error ? postError.message : String(postError))
            // Tiếp tục với post tiếp theo thay vì dừng
          }
          currentIndex++
        }
      } else {
        // No unprocessed posts left; try to scroll further to trigger lazy loading
        console.log(`[feed] No more posts to process, trying to load more...`)
        await humanScroll(page, 800)
      }

      // Re-query posts after potential lazy load
      const updatedPosts = await scope.$$(POST_SELECTOR)
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

    // No batch write; rows already appended incrementally

  } catch (error) {
    console.error('Failed while per-post scrolling/clicking:', error)
    throw error
  }
}

const buildRedditProfileUrl = (forumName?: string) => {
  if (!forumName) return undefined
  const trimmed = String(forumName).trim()
  if (!/^r\//.test(trimmed)) return undefined
  const pathPart = trimmed.replace(/\/+$/,'') + '/'
  return `https://www.reddit.com/${pathPart}`
}


export async function run(page: Page, input: Input = {}) {
  page.setDefaultTimeout(60000)
  try {
    console.log('Starting Reddit download...')
    console.log('📝 Raw Input:', input)

    const { normalizedInput } = buildNormalizedInput(input)
    const targetUrl = normalizedInput.targetUrl || input.targetUrl || buildRedditProfileUrl(normalizedInput.forumName || input.forumName) || 'https://www.reddit.com/'
    console.log(`[navigate] Navigate: ${targetUrl}`)

    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    })
    console.log(`[navigate] Successfully navigated to: ${targetUrl}`)

    await humanDelay(2000, 3500)

    const outputDir = normalizedInput.linkDirectory || input.linkDirectory
    const recentDays = normalizedInput.recentDays ?? input.recentDays
    await downloadRedditPosts(
      page,
      outputDir,
      'main#main-content',
      'article > shreddit-post',
      recentDays
    )

    return { success: true }

  } catch (error) {
    console.error('Reddit download failed:', error)
    throw error
  } finally {
    await page.close()
    const browser = page.browser()
    await browser.close()
  }
}





