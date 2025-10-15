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
  // Optional: number of posts to process
  quantity?: number
}

type NormalizedInput = {
  forumName?: string
  linkDirectory?: string
  targetUrl?: string
  quantity?: number
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
      const quantityRaw = getByBase('Quantity')

      return { 
        linkDirectory,
        targetUrl: undefined,
        forumName,
        quantity: quantityRaw != null ? Number(quantityRaw) : undefined
      }
    } catch {
      return { 
        forumName: undefined, 
        linkDirectory: undefined,
        quantity: undefined,
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
    
    // Check if path contains invalid characters
    const normalizedPath = path.resolve(dirPath)
    
    // Allow paths in common drives (C:, D:, etc.)
    const allowedDrives = ['C:', 'D:', 'E:', 'F:']
    const isAllowedDrive = allowedDrives.some(d => normalizedPath.toUpperCase().startsWith(d))
    
    if (!isAllowedDrive) {
      console.warn(`[fs] Path ${dirPath} is not on an allowed drive, using fallback`)
      throw new Error(`Path ${dirPath} is not accessible`)
    }
    
    await fs.mkdir(dirPath, { recursive: true })
  } catch (error) {
    console.error(`[fs] Failed to create directory ${dirPath}:`, error)
    throw error
  }
}

const formatTsToYYMMDD = (ts: number | undefined) => {
  if (typeof ts !== 'number' || Number.isNaN(ts)) return ''
  const d = new Date(ts)
  const yy = String(d.getUTCFullYear()).slice(2)
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yy}/${mm}/${dd}`
}

const sanitizeFolderName = (name: string) => {
  // replace slashes and invalid characters with underscore; limit length
  return name.replace(/[\\/]/g, '_').replace(/[^a-z0-9-_]/gi, '_').slice(0, 80)
}

const getFileExtensionFromUrl = (mediaUrl: string, fallback: string) => {
  try {
    const pathname = new URL(mediaUrl).pathname
    const ext = path.extname(pathname)
    if (ext) return ext.split('?')[0] || ext
  } catch {}
  return fallback
}

// removed unused sanitize helper

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


// CSV helpers for Reddit meta rows
const ensureRedditMetaCsvHeader = async (csvPath: string) => {
  try {
    const stat = await fs.stat(csvPath).catch(() => null as any)
    if (!stat || stat.size === 0) {
      // Prepend UTF-8 BOM so Excel renders Vietnamese correctly; use CRLF line endings on Windows
      await fs.writeFile(csvPath, '\uFEFFindex,title,text,label,ts\r\n', { encoding: 'utf-8' })
    }
  } catch (e) {
    console.error('[csv] Failed to ensure reddit meta CSV header:', e instanceof Error ? e.message : String(e))
  }
}

const appendRedditMetaRow = async (csvPath: string, index: number, title: string, text: string, label: string, tsStr: string) => {
  try {
    const esc = (s: string) => '"' + (s || '').replace(/"/g, '""') + '"'
    await fs.appendFile(csvPath, `${index},${esc(title)},${esc(text)},${esc(label)},${esc(tsStr)}\r\n`, { encoding: 'utf-8' })
  } catch (e) {
    console.error('[csv] Failed to append reddit meta row:', e instanceof Error ? e.message : String(e))
  }
}

const downloadFile = async (mediaUrl: string, filePath: string) => {
  try {
    const res = await fetch(mediaUrl)
    if (!res.ok || !res.body) throw new Error(`Failed to download ${mediaUrl}: ${res.status}`)
    await pipeline(res.body as any, createWriteStream(filePath))
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

  // Nếu không có media nào, bỏ qua post này
  if (imgUrls.length === 0 && videoUrls.length === 0) {
    return
  }

  // Chỉ cần đảm bảo base directory tồn tại, không tạo folder riêng cho post
  await ensureDir(baseOutputDir)

  const postNum = String(postIndex + 1).padStart(3, '0')

  // Save only the first image as image_{postIndex}
  if (imgUrls.length > 0) {
    const url = imgUrls[0]
    const ext = getFileExtensionFromUrl(url, '.jpg')
    const filename = `image_${postNum}${ext}`
    const fp = path.join(baseOutputDir, filename)
    try {
      await downloadFile(url, fp)
      console.log(`[media] Saved: ${filename}`)
    } catch (e) {
      console.warn(`[media] Failed to download image:`, e instanceof Error ? e.message : String(e))
    }
  }

  // Save only the first video as video_{postIndex}
  if (videoUrls.length > 0) {
    const url = videoUrls[0]
    const ext = getFileExtensionFromUrl(url, '.mp4')
    const filename = `video_${postNum}${ext}`
    const fp = path.join(baseOutputDir, filename)
    try {
      await downloadFile(url, fp)
      console.log(`[media] Saved: ${filename}`)
    } catch (e) {
      console.warn(`[media] Failed to download video:`, e instanceof Error ? e.message : String(e))
    }
  }
}

// Extract Reddit post metadata from a post element
const getRedditPostMeta = async (postHandle: any) => {
  try {
    const { titleAttr, titleText, iso, ts, text, label } = await postHandle.evaluate((el: Element) => {
      const post = el as HTMLElement
      const timeEl = post.querySelector('faceplate-timeago time') as HTMLTimeElement | null
      const iso = timeEl?.getAttribute('datetime') || ''
      const ts = iso ? Date.parse(iso) : NaN
      const label = (timeEl?.textContent || '').trim()
      const titleAttr = post.getAttribute('post-title') || ''
      const titleAnchor = post.querySelector('a[slot="title"]') as HTMLAnchorElement | null
      const titleText = (titleAnchor?.textContent || '').trim()
      const textEl = post.querySelector('shreddit-post-text-body div[property="schema:articleBody"]') as HTMLElement | null
      const text = (textEl?.innerText || '').trim()
      return { titleAttr, titleText, iso, ts, text, label }
    })
    const title = (titleAttr && titleAttr.trim()) || (titleText && titleText.trim()) || ''
    return { title, iso, ts: Number.isFinite(ts) ? ts : (iso ? Date.parse(iso) : NaN), text, label }
  } catch {
    return { title: '', iso: '', ts: NaN, text: '', label: '' }
  }
}

// Reddit-specific download flow
const downloadRedditPosts = async (
  page: Page,
  linkDirectory: string | undefined,
  scopeSelector: string,
  postSelector: string,
  quantity?: number
) => {
  try {
    console.log(`[download] Starting download to: ${linkDirectory}`)
    
    // Scope: contain all loaded posts inside this container (strict)
    const SCOPE_SELECTOR = scopeSelector
    const POST_SELECTOR = postSelector
    
    const scope = await page.waitForSelector(SCOPE_SELECTOR, { timeout: 30000 })
    if (!scope) {
      throw new Error(`Scope not found for selector: ${SCOPE_SELECTOR}`)
    }

    // Find all posts within scope
    const posts = await scope.$$(POST_SELECTOR)
    console.log(`[feed] Found ${posts.length} posts`)

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
    
    try {
      await ensureDir(baseOutputDir)
    } catch (dirError) {
      console.error(`[download] Failed to create directory:`, dirError)
      // Fallback to user's Downloads folder
      const userDownloads = path.join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads', 'RedditDownloads')
      await ensureDir(userDownloads)
      baseOutputDir = userDownloads
    }

    // Prepare CSV path and header (write-as-you-go)
    const csvPath = path.join(baseOutputDir, 'reddit_posts.csv')
    await ensureRedditMetaCsvHeader(csvPath)

    while (true) {
      const hasUnprocessedPost = currentIndex < posts.length

      if (hasUnprocessedPost) {
        const currentPost = posts[currentIndex]
        if (!currentPost) {
          currentIndex++
        } else {
          try {
            // Scroll post into view for natural behavior and lazy loading
            await humanScrollToElement(page, currentPost)

            // Extract meta and text
            const meta = await getRedditPostMeta(currentPost)
            const postText = meta.text || ''
            const tsStr = formatTsToYYMMDD(meta.ts)
            console.log(`[${currentIndex + 1}] ${(meta.title || '').slice(0, 50)}...`)
            await appendRedditMetaRow(csvPath, currentIndex + 1, meta.title, postText, meta.label || '', tsStr)

            // Save media for this post
            await savePostMediaFromHandle(currentPost, baseOutputDir, currentIndex)
          } catch (postError) {
            console.error(`[feed] Failed to process post ${currentIndex}:`, postError instanceof Error ? postError.message : String(postError))
            // Tiếp tục với post tiếp theo thay vì dừng
          }
          currentIndex++

          // Stop when reached desired quantity
          const maxCount = Math.max(0, Number(quantity) || 0)
          if (maxCount > 0 && currentIndex >= maxCount) {
            console.log(`[feed] Reached quantity limit: ${maxCount}, stopping`)
            break
          }
        }
      } else {
        // No unprocessed posts left; try to scroll further to trigger lazy loading
        await humanScroll(page, 800)
      }

      // Re-query posts after potential lazy load
      const updatedPosts = await scope.$$(POST_SELECTOR)
      if (updatedPosts.length > posts.length) {
        const newlyLoadedCount = updatedPosts.length - posts.length
        console.log(`[feed] Loaded ${newlyLoadedCount} more posts`)
        posts.push(...updatedPosts.slice(posts.length))
        noNewPostsStreak = 0
      } else {
        noNewPostsStreak++
      }

      // Exit if we've processed everything and no more posts are loading
      const processedAllLoaded = currentIndex >= posts.length
      const giveUpLoadingMore = noNewPostsStreak >= MAX_NO_NEW_POSTS_STREAK
      const maxCount = Math.max(0, Number(quantity) || 0)
      const reachedQty = maxCount > 0 && currentIndex >= maxCount
      if (processedAllLoaded && (giveUpLoadingMore || reachedQty)) {
        console.log('[feed] Completed processing')
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
  if (!forumName) {
    return undefined
  }
  const trimmed = String(forumName).trim()
  if (!trimmed || !/^r\//.test(trimmed)) {
    return undefined
  }
  const pathPart = trimmed.replace(/\/+$/,'') + '/'
  const url = `https://www.reddit.com/${pathPart}`
  console.log(`[forum] Parsed: '${trimmed}' -> '${url}'`)
  return url
}


export async function run(page: Page, input: Input = {}) {
  page.setDefaultTimeout(60000)
  try {
    console.log('Starting Reddit download...')
    console.log('📝 Raw Input:', input)

    const { normalizedInput, items } = buildNormalizedInput(input)

    // Process each row from items; fallback to single normalized object if needed
    const rows = Array.isArray(items) && items.length > 0 ? items : [
      {
        forumName: normalizedInput.forumName ?? (input as any)?.forumName,
        linkDirectory: normalizedInput.linkDirectory ?? (input as any)?.linkDirectory,
        targetUrl: normalizedInput.targetUrl ?? (input as any)?.targetUrl,
        quantity: normalizedInput.quantity ?? (input as any)?.quantity
      }
    ]

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as any
      const candidateForum = row?.forumName

      const builtFromForum = buildRedditProfileUrl(candidateForum)
      const targetUrl = row?.targetUrl || builtFromForum

      if (!targetUrl) {
        console.warn(`[forum][row ${i + 1}] Missing forumName/targetUrl. Skipping this row.`)
        continue
      }

      console.log(`[navigate][row ${i + 1}] Processing: ${targetUrl}`)
      await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      })

      await humanDelay(2000, 3500)

      const outputDir = row?.linkDirectory
      const forum = row?.forumName
      const forumSub = forum ? sanitizeFolderName(forum) : undefined
      const finalOutputDir = forumSub && outputDir ? path.join(outputDir, forumSub) : (outputDir || undefined)
      if (finalOutputDir) {
        await ensureDir(finalOutputDir)
      }
      const quantity = row?.quantity
      await downloadRedditPosts(
        page,
        finalOutputDir,
        'main#main-content',
        'article > shreddit-post',
        quantity
      )
    }

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





