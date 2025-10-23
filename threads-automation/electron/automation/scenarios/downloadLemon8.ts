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
  category?: string
  linkDirectory?: string
  // Optional list of items (kept for compatibility with caller shape)
  items?: any[]
  // Optional: number of posts to process
  quantity?: number
  // Optional: region parameter
  region?: string
}

type NormalizedInput = {
  category?: string
  linkDirectory?: string
  quantity?: number
  region?: string
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
      const category = getByBase('Category')
      const linkDirectory = getByBase('Folder Directory')
      const quantityRaw = getByBase('Quantity')
      const region = getByBase('Region')

      return { 
        category,
        linkDirectory,
        quantity: quantityRaw != null ? Number(quantityRaw) : undefined,
        region
      }
    } catch {
      return { 
        category: undefined,
        linkDirectory: undefined,
        quantity: undefined,
        region: undefined
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

const extractMediaUrlsFromLemon8Post = async (page: Page) => {
  return await page.evaluate(() => {
    // Lấy tất cả ảnh từ gallery-swiper-item
    const galleryItems = Array.from(document.querySelectorAll('.gallery-swiper-item img')) as HTMLImageElement[]
    const imgUrls = galleryItems.map(img => img.src).filter(Boolean)
    
    // Lấy video từ post content
    const videoEls = Array.from(document.querySelectorAll('video')) as HTMLVideoElement[]
    const videoUrls: string[] = []
    for (const v of videoEls) {
      if (v.src) videoUrls.push(v.src)
      const sources = Array.from(v.querySelectorAll('source')) as HTMLSourceElement[]
      for (const s of sources) if (s.src) videoUrls.push(s.src)
    }
    
    return { imgUrls, videoUrls }
  })
}


// CSV helpers for Lemon8 meta rows
const ensureLemon8MetaCsvHeader = async (csvPath: string) => {
  try {
    const stat = await fs.stat(csvPath).catch(() => null as any)
    if (!stat || stat.size === 0) {
      // Prepend UTF-8 BOM so Excel renders Vietnamese correctly; use CRLF line endings on Windows
      await fs.writeFile(csvPath, '\uFEFFindex,title,content\r\n', { encoding: 'utf-8' })
    }
  } catch (e) {
    console.error('[csv] Failed to ensure lemon8 meta CSV header:', e instanceof Error ? e.message : String(e))
  }
}

const appendLemon8MetaRow = async (csvPath: string, index: number, title: string, content: string) => {
  try {
    const esc = (s: string) => '"' + (s || '').replace(/"/g, '""') + '"'
    await fs.appendFile(csvPath, `${index},${esc(title)},${esc(content)}\r\n`, { encoding: 'utf-8' })
  } catch (e) {
    console.error('[csv] Failed to append lemon8 meta row:', e instanceof Error ? e.message : String(e))
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

const saveLemon8PostMedia = async (
  page: Page,
  baseOutputDir: string,
  postIndex: number
) => {
  const { imgUrls, videoUrls } = await extractMediaUrlsFromLemon8Post(page)

  // Nếu không có media nào, bỏ qua post này
  if (imgUrls.length === 0 && videoUrls.length === 0) {
    console.log(`[${postIndex + 1}] No media found for this post`)
    return
  }

  // Chỉ cần đảm bảo base directory tồn tại, không tạo folder riêng cho post
  await ensureDir(baseOutputDir)

  const postNum = String(postIndex + 1).padStart(3, '0')

  // Save all images from gallery
  if (imgUrls.length > 0) {
    console.log(`[${postIndex + 1}] Found ${imgUrls.length} images in gallery`)
    for (let i = 0; i < imgUrls.length; i++) {
      const url = imgUrls[i]
      const ext = getFileExtensionFromUrl(url, '.jpg')
      const filename = `image_${postNum}_${String(i + 1).padStart(2, '0')}${ext}`
      const fp = path.join(baseOutputDir, filename)
      try {
        await downloadFile(url, fp)
        console.log(`[media] Saved: ${filename}`)
      } catch (e) {
        console.warn(`[media] Failed to download image ${i + 1}:`, e instanceof Error ? e.message : String(e))
      }
    }
  }

  // Save all videos
  if (videoUrls.length > 0) {
    console.log(`[${postIndex + 1}] Found ${videoUrls.length} videos`)
    for (let i = 0; i < videoUrls.length; i++) {
      const url = videoUrls[i]
      const ext = getFileExtensionFromUrl(url, '.mp4')
      const filename = `video_${postNum}_${String(i + 1).padStart(2, '0')}${ext}`
      const fp = path.join(baseOutputDir, filename)
      try {
        await downloadFile(url, fp)
        console.log(`[media] Saved: ${filename}`)
      } catch (e) {
        console.warn(`[media] Failed to download video ${i + 1}:`, e instanceof Error ? e.message : String(e))
      }
    }
  }
}


// Extract Lemon8 post metadata from a post page
const getLemon8PostMeta = async (page: Page) => {
  try {
    const { title, text } = await page.evaluate(() => {
      // Get title from .wap-article-title
      const titleEl = document.querySelector('.wap-article-title') as HTMLElement
      const title = titleEl ? titleEl.textContent?.trim() || '' : ''
      
      // Get content from .article-content-v2
      const contentEl = document.querySelector('.article-content-v2') as HTMLElement
      const text = contentEl ? contentEl.textContent?.trim() || '' : ''
      
      return { title, text }
    })
    
    return { title, text }
  } catch {
    return { title: '', text: '' }
  }
}

// Lemon8-specific download flow
const downloadLemon8Posts = async (
  page: Page,
  linkDirectory: string | undefined,
  scopeSelector: string,
  postSelector: string,
  quantity?: number
) => {
  try {
    console.log(`[download] Starting Lemon8 download to: ${linkDirectory}`)
    
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

    // Default output directory under Downloads/Lemon8Downloads
    const defaultDir = path.join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads', 'Lemon8Downloads')
    let baseOutputDir = linkDirectory || defaultDir
    
    try {
      await ensureDir(baseOutputDir)
    } catch (dirError) {
      console.error(`[download] Failed to create directory:`, dirError)
      // Fallback to user's Downloads folder
      const userDownloads = path.join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads', 'Lemon8Downloads')
      try {
        await ensureDir(userDownloads)
        baseOutputDir = userDownloads
      } catch (fallbackError) {
        console.error(`[download] Fallback directory also failed:`, fallbackError)
        throw new Error('Cannot create any output directory')
      }
    }

    // Prepare CSV path and header (write-as-you-go)
    const csvPath = path.join(baseOutputDir, 'lemon8_posts.csv')
    await ensureLemon8MetaCsvHeader(csvPath)

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
            
            // Wait a bit for the post to be fully visible
            await humanDelay(1000, 2000)

            // Get the post URL and open new tab directly
            const postUrl = await currentPost.evaluate((el: Element) => {
              const anchor = el as HTMLAnchorElement
              return anchor.href || ''
            })
            
            if (postUrl) {
              console.log(`[${currentIndex + 1}] Opening new tab for post ${currentIndex + 1}...`)
              console.log(`[${currentIndex + 1}] Post URL: ${postUrl}`)
              
              // Open new tab directly using page.goto in a new context
              const newPage = await page.browser().newPage()
              
              try {
                await newPage.goto(postUrl, {
                  waitUntil: 'domcontentloaded',
                  timeout: 30000
                })
                
                console.log(`[${currentIndex + 1}] Switched to new tab`)
                
                // Wait for the new page to load
                await humanDelay(3000, 5000)
                
                // Extract title and content from the new tab
                const meta = await getLemon8PostMeta(newPage)
                const title = meta.title || ''
                const content = meta.text || ''
                console.log(`[${currentIndex + 1}] ${title.slice(0, 50)}...`)
                await appendLemon8MetaRow(csvPath, currentIndex + 1, title, content)

                // Save media for this post (all images from gallery)
                await saveLemon8PostMedia(newPage, baseOutputDir, currentIndex)
                
                // Close the new tab and switch back to main page
                await newPage.close()
                console.log(`[${currentIndex + 1}] Closed new tab, back to main feed`)
                
                // Wait a bit before processing next post
                await humanDelay(2000, 3000)
              } catch (newPageError) {
                console.error(`[${currentIndex + 1}] Failed to process new tab:`, newPageError instanceof Error ? newPageError.message : String(newPageError))
                await newPage.close()
              }
            } else {
              console.warn(`[${currentIndex + 1}] No URL found for post`)
            }
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

const buildLemon8FeedUrl = (category?: string, region?: string) => {
  if (!category) {
    return 'https://lemon8-app.com/feed'
  }
  
  const trimmed = String(category).trim().toLowerCase()
  const validCategories = ['food', 'beauty', 'fashion', 'travel', 'lifestyle']
  
  if (!validCategories.includes(trimmed)) {
    console.warn(`[lemon8] Invalid category: ${category}. Using default feed.`)
    return 'https://lemon8-app.com/feed'
  }
  
  const regionParam = region ? `?region=${region}` : '?region=vn'
  const url = `https://lemon8-app.com/feed/${trimmed}${regionParam}`
  console.log(`[lemon8] Built URL for category '${trimmed}' with region '${region || 'vn'}' -> '${url}'`)
  return url
}


export async function run(page: Page, input: Input = {}) {
  page.setDefaultTimeout(60000)
  try {
    console.log('Starting Lemon8 download...')
    console.log('📝 Raw Input:', input)

    const { normalizedInput, items } = buildNormalizedInput(input)

    // Process each row from items; fallback to single normalized object if needed
    const rows = Array.isArray(items) && items.length > 0 ? items : [
      {
        category: normalizedInput.category ?? (input as any)?.category,
        linkDirectory: normalizedInput.linkDirectory ?? (input as any)?.linkDirectory,
        quantity: normalizedInput.quantity ?? (input as any)?.quantity,
        region: normalizedInput.region ?? (input as any)?.region
      }
    ]

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as any
      const category = row?.category

      // Build Lemon8 URL based on category
      const targetUrl = buildLemon8FeedUrl(category, row?.region)

      console.log(`[navigate][row ${i + 1}] Processing: ${targetUrl}`)
      await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      })

      await humanDelay(2000, 3500)

      const outputDir = row?.linkDirectory
      const categorySub = category ? sanitizeFolderName(category) : undefined
      const finalOutputDir = categorySub && outputDir ? path.join(outputDir, categorySub) : (outputDir || undefined)
      if (finalOutputDir) {
        await ensureDir(finalOutputDir)
      }
      const quantity = row?.quantity
      await downloadLemon8Posts(
        page,
        finalOutputDir,
        '.feed-article-list',
        'a.article_card',
        quantity
      )
    }

    return { success: true }

  } catch (error) {
    console.error('Lemon8 download failed:', error)
    throw error
  } finally {
    await page.close()
    const browser = page.browser()
    await browser.close()
  }
}





