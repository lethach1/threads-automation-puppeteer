import type { Page } from 'puppeteer-core'
import { existsSync, statSync, readdirSync } from 'fs'
import { join as pathJoin } from 'path'
import FlexSearch from 'flexsearch'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
// @ts-ignore
import { 
  humanDelay, 
  humanTypeWithMistakes,
  humanClick
} from '../human-behavior.js'

// Interface cho sản phẩm affiliate
interface Product {
  id: string
  name: string
  price: string
  revenue: string
  store: string
  commissionRate: string
  commission: string
  productLink: string
  discountLink: string
}

type Input = {
  postText?: string
  commentText?: string
  mediaPath?: string
  tag?: string
  schedule?: string
  subPost?: string
  items?: Array<{ postText?: string; commentText?: string; mediaPath?: string; tag?: string; schedule?: string; subPost?: string; remainingPostChunks?: string[] }>
  affiliateLinkPoolData?: Array<Record<string, string>>
  gptKey?: string
  geminiKey?: string
  prompt?: string
}

// Khởi tạo FlexSearch indexes
const productNameIndex = new FlexSearch.Index({
  tokenize: "forward",
  resolution: 3
})

const fullTextIndex = new FlexSearch.Index({
  tokenize: "forward",
  resolution: 3
})


// Build search indexes
function buildSearchIndexes(products: Product[]): void {
  console.log(`🔍 Building search indexes for ${products.length} products...`)
  
  // Clear existing indexes before rebuilding
  productNameIndex.clear()
  fullTextIndex.clear()
  
  products.forEach((product, index) => {
    // Index theo tên sản phẩm
    productNameIndex.add(index, product.name.toLowerCase())
    
    // Index theo toàn bộ thông tin
    const searchableText = `${product.name} ${product.store} ${product.price}`.toLowerCase()
    fullTextIndex.add(index, searchableText)
  })
  
  console.log('✅ Search indexes built successfully')
}

// Tìm kiếm sản phẩm với FlexSearch
function searchProducts(keyword: string, products: Product[]): Product[] {
  if (!keyword.trim()) return products
  
  const results = productNameIndex.search(keyword.toLowerCase())
  return results.map((index: any) => products[Number(index)]).filter(Boolean)
}


// Tìm kiếm với fallback strategies
function searchProductsWithFallback(keyword: string, products: Product[]): Product[] {
  // Bước 1: Tìm kiếm chính xác
  let results = searchProducts(keyword, products)
  
  if (results.length > 0) {
    console.log(`✅ Found ${results.length} products for "${keyword}"`)
    return results
  }
  
  console.log(`⚠️ No products found for "${keyword}", trying fallback strategies...`)
  
  // Bước 2: Tìm kiếm với từ khóa ngắn hơn
  const shortKeywords = keyword.split(' ').filter(w => w.length > 2)
  for (const shortKeyword of shortKeywords) {
    results = searchProducts(shortKeyword, products)
    if (results.length > 0) {
      console.log(`✅ Found ${results.length} products with shorter keyword "${shortKeyword}"`)
      return results
    }
  }
  
  // Bước 3: Tìm kiếm fuzzy
  results = searchProductsFuzzy(keyword, products)
  if (results.length > 0) {
    console.log(`✅ Found ${results.length} products with fuzzy search`)
    return results
  }
  
  // Bước 4: Trả về tất cả sản phẩm
  console.log(`❌ No products found, returning all products for random selection`)
  return products
}

// Tìm kiếm fuzzy
function searchProductsFuzzy(keyword: string, products: Product[]): Product[] {
  return products.filter(product => {
    const productName = product.name.toLowerCase()
    const keywordLower = keyword.toLowerCase()
    
    let matchCount = 0
    for (let i = 0; i < keywordLower.length; i++) {
      if (productName.includes(keywordLower[i])) {
        matchCount++
      }
    }
    
    return matchCount >= keywordLower.length * 0.5
  })
}

// Lấy sản phẩm ngẫu nhiên
function getRandomProduct(products: Product[]): Product | null {
  if (products.length === 0) return null
  const randomIndex = Math.floor(Math.random() * products.length)
  return products[randomIndex]
}

// Normalize affiliate data keys to handle different CSV formats
function normalizeAffiliateKeys(raw: Record<string, string>): Record<string, string> {
  const lowerMap: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    lowerMap[String(k).toLowerCase().trim()] = v
  }
  
  // Map various possible keys to standard keys
  const getValue = (possibleKeys: string[]): string => {
    for (const key of possibleKeys) {
      const normalizedKey = key.toLowerCase().trim()
      if (lowerMap[normalizedKey]) {
        return lowerMap[normalizedKey]
      }
    }
    return ''
  }
  
  return {
    id: getValue(['Mã sản phẩm', 'Product ID', 'ID', 'Ma san pham', 'Product_ID']),
    name: getValue(['Tên sản phẩm', 'Product Name', 'Name', 'Ten san pham', 'Product_Name']),
    price: getValue(['Giá', 'Price', 'Gia', 'Product Price']),
    revenue: getValue(['Doanh thu', 'Revenue', 'Doanh thue', 'Sales']),
    store: getValue(['Tên cửa hàng', 'Store', 'Ten cua hang', 'Shop', 'Store Name']),
    commissionRate: getValue(['Tỉ lệ hoa hồng', 'Commission Rate', 'Ti le hoa hong', 'Commission_Rate']),
    commission: getValue(['Hoa hồng', 'Commission', 'Hoa hong', 'Commission Amount']),
    productLink: getValue(['Link sản phẩm', 'Product Link', 'Link san pham', 'Product_Link', 'URL']),
    discountLink: getValue(['Link ưu đãi', 'Discount Link', 'Link uu dai', 'Discount_Link', 'Affiliate Link'])
  }
}

// Parse affiliate data to Product format
function parseAffiliateData(affiliateLinkPoolData: Array<Record<string, string>>): Product[] {
  return affiliateLinkPoolData.map((row, index) => {
    const normalizedRow = normalizeAffiliateKeys(row)
    return {
      id: normalizedRow.id || index.toString(),
      name: normalizedRow.name || '',
      price: normalizedRow.price || '',
      revenue: normalizedRow.revenue || '',
      store: normalizedRow.store || '',
      commissionRate: normalizedRow.commissionRate || '',
      commission: normalizedRow.commission || '',
      productLink: normalizedRow.productLink || '',
      discountLink: normalizedRow.discountLink || ''
    }
  })
}

// Normalize input keys with only case-insensitive and singular/plural variants
function normalizeRecord(raw: Record<string, any> = {}) {
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
  const postText = getByBase('post')
  const commentText = getByBase('comment')
  const mediaPath = getByBase('image')
  const tag = getByBase('tag')
  const schedule = getByBase('schedule')
  const subPost = getByBase('subpost')
  const gptKey = lowerMap['gpt key']
  const geminiKey = lowerMap['gemini key']
  return { postText, commentText, mediaPath, tag, schedule, subPost, gptKey, geminiKey }
}


 /**
 * Generate comment using ChatGPT API
 * @param searchKeyword - The search keyword for context
 * @param prompt - Custom prompt for ChatGPT
 * @param gptKey - ChatGPT API key
 * @returns Generated comment text or null if failed
 */
 const generateChatGPTComment = async (
  prompt: string,
  gptKey?: string
): Promise<string | null> => {
  try {
    console.log(`[ChatGPT] Using prompt: "${prompt}"`)
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: gptKey
    });

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-5-nano",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 150
    });

    const generatedText = response.choices[0]?.message?.content || null
    if (!generatedText) return null
    console.log(`[ChatGPT] Generated comment: "${generatedText}"`)
    return generatedText
    
  } catch (error) {
    console.error('[ChatGPT] Generation failed:', error)
    return null
  }
}

/**
 * Generate comment using Google Gemini AI
 * @param searchKeyword - The search keyword for context
 * @param prompt - Custom prompt for Gemini
 * @param linkShopee - Optional Shopee link to append
 * @param geminiKey - Gemini API key
 * @returns Generated comment text or null if failed
 */
const generateGeminiComment = async (
  prompt: string,
  geminiKey?: string
): Promise<string | null> => {
  try {
    console.log(`[Gemini] Using prompt: "${prompt}"`)
    
    // Initialize Gemini client
    const ai = new GoogleGenerativeAI(geminiKey || '');

    // Call Gemini API
    const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });
    const response = await model.generateContent(prompt);

    const generatedText = response.response.text() || null
    if (!generatedText) return null
    console.log(`[Gemini] Generated comment: "${generatedText}"`)
    return generatedText
    
  } catch (error) {
    console.error('[Gemini] Generation failed:', error)
    return null
  }
}



/**
* Handle AI keyword extraction from postText
* @param normalizedInput - Normalized input data including postText
* @returns Generated search keywords for product matching
*/
const handleSearchKeyWord = async (
  normalizedInput: {
    prompt?: string;
    gptKey?: string;
    geminiKey?: string;
    postText?: string;
  }
): Promise<string> => {
  let searchKeywords = ''
  
  const postText = normalizedInput.postText || ''
  const prompt = normalizedInput.prompt
    ? `${normalizedInput.prompt} ${postText}`
    : `Phân tích nội dung bài post sau và trích xuất 3-5 từ khóa chính để tìm kiếm sản phẩm liên quan. Chỉ trả về các từ khóa ngắn gọn, cách nhau bằng dấu phẩy, không cần giải thích. Ví dụ: "lip, tint, glow, beauty, makeup". Nội dung bài post: ${postText}`

  // Priority 1: Try Gemini if available
  if(normalizedInput.geminiKey) {
    const geminiKeywords = await generateGeminiComment(
      prompt,
      normalizedInput.geminiKey
    )
    if (geminiKeywords) {
      searchKeywords = geminiKeywords
    }
  }
  
  // Priority 2: Try ChatGPT if Gemini failed or not available
  if (!searchKeywords && normalizedInput.gptKey) {
    const chatGPTKeywords = await generateChatGPTComment(
      prompt,
      normalizedInput.gptKey
    )
    if (chatGPTKeywords) {
      searchKeywords = chatGPTKeywords
    }
  }
  
  // No fallback - rely on AI only
  if (!searchKeywords) {
    console.log(`[AI] No keywords generated from AI`)
  }
  
  return searchKeywords
}

// Extract comments from dynamic fields: Comment1..N, Comments, commentText
function extractCommentTexts(raw: Record<string, any>): string[] {
  const entries = Object.entries(raw || {})
  const numbered: Array<{ order: number; value: string }> = []

  for (const [key, val] of entries) {
    if (val == null) continue
    const str = String(val).trim()
    if (!str) continue
    const match = /^comments?\s*(\d+)?$/i.exec(key)
    if (match) {
      const order = match[1] ? parseInt(match[1], 10) : 0
      numbered.push({ order, value: str })
    }
  }

  numbered.sort((a, b) => a.order - b.order)
  return numbered.map((n) => n.value).map((s) => s.trim()).filter(Boolean)
}

// Extract sub-posts from dynamic fields: subPost1..N, subPosts, subPost
function extractSubPostTexts(raw: Record<string, any>): string[] {
  const entries = Object.entries(raw || {})
  const numbered: Array<{ order: number; value: string }> = []
  for (const [key, val] of entries) {
    if (val == null) continue
    const str = String(val).trim()
    if (!str) continue
    const match = /^subposts?\s*(\d+)?$/i.exec(key)
    if (match) {
      const order = match[1] ? parseInt(match[1], 10) : 0
      numbered.push({ order, value: str })
    }
  }
  numbered.sort((a, b) => a.order - b.order)
  return numbered.map((n) => n.value).map((s) => s.trim()).filter(Boolean)
}

// Split text into chunks of max length (word boundary aware)
function splitTextIntoChunks(text: string, maxLength: number = 500): string[] {
  if (!text || text.length <= maxLength) {
    return text ? [text] : []
  }

  const chunks: string[] = []
  let currentIndex = 0

  while (currentIndex < text.length) {
    let endIndex = currentIndex + maxLength
    
    if (endIndex < text.length) {
      const lastSpace = text.lastIndexOf(' ', endIndex)
      const lastPeriod = text.lastIndexOf('.', endIndex)
      const lastNewline = text.lastIndexOf('\n', endIndex)
      const breakPoint = Math.max(lastSpace, lastPeriod, lastNewline)
      
      if (breakPoint > currentIndex + maxLength * 0.7) {
        endIndex = breakPoint
      }
    }
    
    endIndex = Math.min(endIndex, currentIndex + maxLength)
    const chunk = text.slice(currentIndex, endIndex).trim()
    if (chunk) {
      chunks.push(chunk)
    }
    currentIndex = endIndex
  }

  return chunks
}

// Click Add Subpost, then target the last textbox and type text
async function addAndTypeSubPost(page: Page, text: string) {
  const findAddSubpostButton = async () => {
    await page.waitForFunction(() => {
      const dialog = document.querySelector('div[role="dialog"]') as HTMLElement | null
      if (!dialog) return false
      const buttons = Array.from(dialog.querySelectorAll('div[role="button"]')) as HTMLElement[]
      const isVisible = (el: HTMLElement) => {
        const rect = el.getBoundingClientRect()
        return !!(el.offsetParent || (rect.width > 0 && rect.height > 0))
      }
      return buttons.some((el) => {
        const txt = (el.innerText || '').trim().toLowerCase()
        const re = /(add\s+to\s+thread|thêm\s+vào\s+thread|thêm.+thread)/i
        return isVisible(el) && (re.test(txt) || txt.includes('add to thread'))
      })
    }, { timeout: 5000 })

    const handle = await page.evaluateHandle(() => {
      const dialog = document.querySelector('div[role="dialog"]') as HTMLElement | null
      const root: ParentNode = dialog || document
      const buttons = Array.from(root.querySelectorAll('div[role="button"]')) as HTMLElement[]
      const isVisible = (el: HTMLElement) => {
        const rect = el.getBoundingClientRect()
        return !!(el.offsetParent || (rect.width > 0 && rect.height > 0))
      }
      const candidates = buttons.filter((el) => {
        const txt = (el.innerText || '').trim().toLowerCase()
        const re = /(add\s+to\s+thread|thêm\s+vào\s+thread|thêm.+thread)/i
        return isVisible(el) && (re.test(txt) || txt.includes('add to thread'))
      })
      return candidates.length ? candidates[candidates.length - 1] : null
    })
    return handle.asElement() as any
  }

  const beforeEditors = await page.$$('div[role="textbox"]')
  const addSubpostButton = await findAddSubpostButton()
  if (!addSubpostButton) throw new Error('Add subpost button not found')

  await addSubpostButton.evaluate((el: any) => (el as HTMLElement).scrollIntoView({ block: 'center' }))
  await humanDelay(150, 300)
  await humanClick(page, addSubpostButton as any)
  console.log(`Clicked add subpost button`)

  await page.waitForFunction(
    (prevCount) => document.querySelectorAll('div[role="textbox"]').length > (prevCount as number),
    {},
    beforeEditors.length
  )

  await humanDelay(300, 700)
  const boxes = await page.$$('div[role="textbox"]')
  console.log(`🔍 Found ${boxes.length} textbox elements after adding subpost`)
  if (!boxes.length) throw new Error('No textbox found after adding subpost')
  const last = boxes[boxes.length - 1]
  await humanClick(page, last)
  await humanTypeWithMistakes(page, last, text)
}

// Handle remaining chunks from split main post
async function handleRemainingPostChunks(page: Page, chunks: string[], startIndex: number = 1): Promise<number> {
  let subPostIndex = startIndex
  if (!Array.isArray(chunks) || chunks.length === 0) return subPostIndex
  console.log(`Step 3.5a: Creating sub-posts from split postText (${chunks.length} chunks)...`)
  for (let k = 0; k < chunks.length; k++) {
    const chunk = (chunks[k] || '').trim()
    if (!chunk) continue
    console.log(`📝 Creating sub-post ${subPostIndex} (from postText chunk ${k + 2}):`, chunk.slice(0, 80))
    try {
      await addAndTypeSubPost(page, chunk)
      console.log(`Step 3.5a: Sub-post ${subPostIndex} finished writing`)
      if (k < chunks.length - 1) await humanDelay(2000, 4000)
    } catch (error) {
      console.error(`❌ Failed to post sub-post ${subPostIndex}:`, error)
      throw error
    }
    subPostIndex++
  }
  return subPostIndex
}

// Handle subPost fields; split items >500 chars and post in order
async function handleSubPostTexts(page: Page, texts: string[], startIndex: number = 1): Promise<number> {
  let subPostIndex = startIndex
  if (!Array.isArray(texts) || texts.length === 0) return subPostIndex
  console.log(`Step 3.5b: Creating sub-posts from extracted subPost fields (${texts.length} items)...`)
  for (let m = 0; m < texts.length; m++) {
    const subPostText = (texts[m] || '').trim()
    if (!subPostText) continue
    console.log(`Step 3.5b: Processing subPost ${m + 1}/${texts.length} (${subPostText.length} chars):`, subPostText.slice(0, 80))
    if (subPostText.length > 500) {
      const subPostChunks = splitTextIntoChunks(subPostText, 500)
      console.log(`Step 3.5b: SubPost ${m + 1} split into ${subPostChunks.length} chunks`)
      for (let chunkIndex = 0; chunkIndex < subPostChunks.length; chunkIndex++) {
        const chunk = subPostChunks[chunkIndex]
        console.log(`Step 3.5b: Creating sub-post ${subPostIndex} (subPost ${m + 1}, chunk ${chunkIndex + 1}/${subPostChunks.length}):`, chunk.slice(0, 80))
        try {
          await addAndTypeSubPost(page, chunk)
          console.log(`Step 3.5b: Sub-post ${subPostIndex} finished writing`)
          if (chunkIndex < subPostChunks.length - 1) await humanDelay(2000, 4000)
        } catch (error) {
          console.error(`❌ Failed to post sub-post ${subPostIndex}:`, error)
          throw error
        }
        subPostIndex++
      }
    } else {
      try {
        await addAndTypeSubPost(page, subPostText)
        console.log(`✅ Sub-post ${subPostIndex} finished writing`)
      } catch (error) {
        console.error(`❌ Failed to post sub-post ${subPostIndex}:`, error)
        throw error
      }
      subPostIndex++
    }
    if (m < texts.length - 1) await humanDelay(2000, 4000)
  }
  return subPostIndex
}

// Process affiliate links for items using AI and product matching
async function processAffiliateLinks(
  items: any[],
  products: Product[],
  input: Input
): Promise<void> {
  // Build search indexes
  buildSearchIndexes(products)
  
  // AI-powered product search for each item
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const postText = item.postText || ''
    
    if (!postText) continue
    
    console.log(`\n🔍 Processing item ${i + 1}: "${postText.substring(0, 50)}..."`)
    
    try {
      // Step 1: Send postText to AI to get search keywords
      const aiKeywords = await handleSearchKeyWord({
        postText,
        gptKey: item.gptKey || input.gptKey,
        geminiKey: item.geminiKey || input.geminiKey,
        prompt: input.prompt
      })
      
      console.log(`🤖 AI generated keywords: "${aiKeywords}"`)
      
      // Step 2: Use keywords to search products
      const keywordList = aiKeywords.split(',').map(k => k.trim()).filter(k => k.length > 0)
      let matchingProduct: Product | null = null
      
      // Try each keyword to find matching product
      for (const keyword of keywordList) {
        const searchResults = searchProductsWithFallback(keyword, products)
        if (searchResults.length > 0) {
          matchingProduct = getRandomProduct(searchResults)
          console.log(`✅ Found product with keyword "${keyword}": ${matchingProduct?.name}`)
          break
        }
      }
      
      // Step 3: Enhance postText with affiliate link
      if (matchingProduct?.discountLink) {
        console.log(`🎯 Selected product: ${matchingProduct.name}`)
        console.log(`💰 Price: ${matchingProduct.price}`)
        console.log(`🔗 Discount link: ${matchingProduct.discountLink}`)
        
        const enhancedPostText = `${postText}\n\n🔗 Link mua: ${matchingProduct.discountLink}`
        item.postText = enhancedPostText
        console.log(`✅ Enhanced post with affiliate link`)
      } else {
        console.log(`⚠️ No matching product found for keywords: ${keywordList.join(', ')}`)
        // Fallback to random product
        const randomProduct = getRandomProduct(products)
        if (randomProduct?.discountLink) {
          const enhancedPostText = `${postText}\n\n🔗 Link mua: ${randomProduct.discountLink}`
          item.postText = enhancedPostText
          console.log(`🎲 Fallback random product: ${randomProduct.name}`)
        }
      }
    } catch (error) {
      console.error(`❌ AI processing failed for item ${i + 1}:`, error)
      throw error
    }
  }
}


export async function run(page: Page, input: Input = {}) {
  // Improve debuggability: surface errors and page logs
  page.setDefaultTimeout(60000)
  page.setDefaultNavigationTimeout(90000)
  page.on('pageerror', (e) => console.error('[pageerror]', e))
  page.on('error', (e) => console.error('[targeterror]', e))
  // Removed verbose console relay from page to keep logs clean
  try {
    console.log('🚀 Starting Post and Comment automation...')

    const normalizedInput = { ...normalizeRecord(input as any) }
    const baseItems = Array.isArray(input.items) && input.items.length > 0 ? input.items as any[] : [input as any]
    // Preserve original keys so extractCommentTexts can read 'Comment(s) N' fields
    const items = baseItems.map((r) => ({ ...(r as any), ...normalizeRecord(r as any) }))

    console.log(' Raw Input:', input)
    console.log('[input] postText:', normalizedInput.postText)
    console.log('[input] commentText:', normalizedInput.commentText)
    console.log('[input] mediaPath:', normalizedInput.mediaPath)
    console.log('[input] subPost:', normalizedInput.subPost)
    if (normalizedInput.schedule) console.log('[input] schedule:', normalizedInput.schedule)
    console.log('[input] items count:', items.length)
    
    // FlexSearch and AI-powered product search
    console.log(' AI-powered product search with FlexSearch:')
    
    if (input.affiliateLinkPoolData && input.affiliateLinkPoolData.length > 0) {
      // Parse affiliate data to Product format
      const products: Product[] = parseAffiliateData(input.affiliateLinkPoolData)
      console.log(`📦 Loaded ${products.length} products from affiliate pool`)
      
      if (products.length > 0) {
        // Process affiliate links for items
        await processAffiliateLinks(items, products, input)
      } else {
        console.warn('⚠️ No products found in affiliate pool')
      }
    } else {
      console.log('ℹ️ No affiliate link pool data provided, skipping product search')
    }
    
    //start script
    // Step 1: Navigate to Threads (robust with retry)
    console.log('Step 1: Start script')
    const navigateWithRetry = async (targetUrl: string, maxAttempts: number = 3) => {
      let lastError: unknown
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 90000 })
          return
        } catch (err) {
          lastError = err
          const backoffMs = 2000 * attempt
          console.warn(`[nav] attempt ${attempt}/${maxAttempts} failed. Retrying in ${backoffMs}ms...`)
          await humanDelay(backoffMs, backoffMs + 500)
        }
      }
      throw lastError
    }
    await navigateWithRetry('https://threads.com/')
    await humanDelay(2000, 4000)

    // Unified loop: first item runs full flow; subsequent items run lightweight post-only flow
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const isFirst = i === 0

      // Step 2: Open composer
      console.log(` ${isFirst ? 'Step 2' : 'Extra'}: Opening post composer...`)
      await humanClick(page,'.x1i10hfl > .xc26acl')

      // Step 3: Type post (with auto-splitting if >500 chars)
      if (item.postText) {
        if (isFirst) console.log(' Step 3: Writing post text...')
        
        const postText = item.postText.trim()
        console.log(`📝 Post content length: ${postText.length} characters`)
        
        // Check if post text exceeds 500 characters
        if (postText.length > 500) {
          console.log('📝 Post text too long, will split into multiple posts')
          const postChunks = splitTextIntoChunks(postText, 500)
          console.log(`📝 Post split into ${postChunks.length} chunks`)
          
          // Type and post the first chunk as main post
          const firstChunk = postChunks[0]
          console.log('⌨️ Typing main post (chunk 1):', firstChunk.slice(0, 80))
          await humanClick(page, 'div[role="textbox"]')
          await humanTypeWithMistakes(page, 'div[role="textbox"]', firstChunk)
          
          // Store remaining chunks for sub-posts
          item.remainingPostChunks = postChunks.slice(1)
        } else {
          // Normal post (≤500 chars)
          console.log('⌨️ Typing post text:', postText.slice(0, 80))
          await humanClick(page, 'div[role="textbox"]')
          await humanTypeWithMistakes(page, 'div[role="textbox"]', postText)
        }
      }

      // Step 4: Upload media (file or all images in a folder). Skip gracefully if invalid. (optional)
      const mediaPathStr = (item.mediaPath || '').trim()
      if (!mediaPathStr) {
        // no media provided
      } else if (!existsSync(mediaPathStr)) {
        console.log(' Invalid media path, skipping upload:', mediaPathStr)
      } else {
        const stat = statSync(mediaPathStr)
        const imagePaths: string[] = stat.isDirectory()
          ? readdirSync(mediaPathStr)
              .filter((f) => /\.(jpe?g|png|gif|webp|bmp|tiff?)$/i.test(f))
              .map((f) => pathJoin(mediaPathStr, f))
          : stat.isFile() ? [mediaPathStr] : []

        if (imagePaths.length === 0) {
          console.log('🟨 No images found to upload in path:', mediaPathStr)
        } else {
          if (isFirst) console.log(`📍 Step 4: Uploading ${imagePaths.length} image(s)...`)

          // Try to find an existing file input; if missing, click candidate button once
          let fileInput = await page.$('input[type="file"]')
          if (!fileInput) {
            const candidateSelectors = [
              '.x6s0dn4 > .x1i10hfl:nth-child(1) > .x1n2onr6 > .x1lliihq'
            ]
            for (const sel of candidateSelectors) {
              const btn = await page.$(sel)
              if (!btn) continue
              await humanDelay(300, 700)
              await humanClick(page, sel)
              console.log('🖱️ Clicked add-media button with selector:', sel)
              await humanDelay(500, 1000)
              fileInput = await page.$('input[type="file"]')
              if (fileInput) break
            }
            if (!fileInput) console.log('⚠️ File input not found after button click')
          }

          if (!fileInput) {
            console.log('🟨 File input not found; skipping all images')
          } else {
            for (let idx = 0; idx < imagePaths.length; idx++) {
              const filePath = imagePaths[idx]
              console.log(`📷 Uploading image ${idx + 1}/${imagePaths.length}:`, filePath)
              await fileInput.uploadFile(filePath)
              await humanDelay(1500, 2500)
            }
          }
        }
      }

      // Step 5: Handle sub-posts (after media upload)
      let subPostIndex = 1
      subPostIndex = await handleRemainingPostChunks(page, item.remainingPostChunks || [], subPostIndex)
      subPostIndex = await handleSubPostTexts(page, extractSubPostTexts(item as any), subPostIndex)
      console.log(`✅ Step 3.5 completed for item ${i + 1}: Created ${subPostIndex - 1} sub-posts total`)

      // Step 5: Add Topic - tags (optional)
      if (item.tag) {
        if (isFirst) console.log('Step 5: Adding topic/tag...')
        await humanClick(page,'input.xwhw2v2')
        await humanTypeWithMistakes(page, 'input.xwhw2v2', item.tag)
      }

      // Step 6: Schedule (optional)
      if ((item as any)?.schedule) {
        const parseSchedule = (raw: string) => {
          const s = String(raw || '').trim()
          // Expect 24h formats like: "09:30 21/06/2025" or "9:30 21/6/2025"
          const m = /^\s*(\d{1,2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/i.exec(s)
          if (!m) return null
          const hour24 = parseInt(m[1], 10)
          const minute = parseInt(m[2], 10)
          const day = parseInt(m[3], 10)
          const month = parseInt(m[4], 10)
          const year = parseInt(m[5], 10)
          if (isNaN(hour24) || hour24 < 0 || hour24 > 23) return null
          if (isNaN(minute) || minute < 0 || minute > 59) return null
          return { hour24, minute, day, month, year }
        }
        const normalizeHeader = (s: string) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim()
        const toMonthHeaders = (month: number, year: number): string[] => {
          const m = Math.max(1, Math.min(12, month))
          const en = ['January','February','March','April','May','June','July','August','September','October','November','December'][m - 1]
          // Vietnamese format: "Tháng {m} năm {year}" (e.g., "Tháng 9 năm 2025")
          const viNumeric = `Tháng ${m} năm ${year}`
          return [
            `${en} ${year}`,
            viNumeric
          ]
        }

        const parsed = parseSchedule((item as any).schedule)
        if (!parsed) {
          console.log('Invalid schedule format, skipping schedule:', (item as any).schedule)
        } else {
          if (isFirst) console.log('Step 7.5: Scheduling post...')
          // Open expanded options
          await humanClick(page,'.xx6bhzk > .x1lliihq > .xbh8q5q')
          await humanDelay(400, 800)
          // Open schedule settings
          await humanClick(page,'.x1q05qs2:nth-child(2) .x1i10hfl')
          await humanDelay(500, 900)

          // Navigate months until header matches target
          const targetHeaders = toMonthHeaders(parsed.month, parsed.year).map(normalizeHeader)
          const maxJumps = 18
          for (let tries = 0; tries < maxJumps; tries++) {
            const headerText = await page.$eval('h2 span span span', (el) => (el?.textContent || '').trim())
            if (targetHeaders.includes(normalizeHeader(headerText))) break
            await humanClick(page,'div.x10w6t97:nth-child(2)')
            await humanDelay(300, 700)
          }

          // Click day using calendar cells selector for locale-agnostic matching
          const dateText = String(parsed.day)
          const clicked = await page.evaluate((needle) => {
            try {
              const spans = Array.from(document.querySelectorAll('div[role="gridcell"] > div[aria-hidden="true"] > span')) as HTMLElement[]
              for (const span of spans) {
                const txt = (span.textContent || '').trim()
                if (txt === needle) {
                  span.click()
                  return true
                }
              }
              return false
            } catch { return false }
          }, dateText)
          if (!clicked) {
            console.log('Could not find day element for:', dateText)
          } else {
            await humanDelay(300, 700)
          }

          // Debug: log parsed schedule components
          console.log(`[schedule] parsed -> hour24=${parsed.hour24}, minute=${parsed.minute}, day=${parsed.day}, month=${parsed.month}, year=${parsed.year}`)

          // Fill time hh:mm in 24h inputs directly
          const hh24 = parsed.hour24.toString().padStart(2, '0')
          const mm = parsed.minute.toString().padStart(2, '0')
          console.log(`[schedule] computed -> hh24='${hh24}', mm='${mm}'`)


          // Focus → caret at end → select all → type full chunk at once (no per-char delay)
          const hhSelector = 'input[placeholder="hh"]'
          const mmSelector = 'input[placeholder="mm"]'
          await page.waitForSelector(hhSelector, { visible: true })
          await page.waitForSelector(mmSelector, { visible: true })

          // Hour
          await humanDelay(120, 280)
          await page.focus(hhSelector)
          await humanDelay(120, 240)
          await page.evaluate((sel) => {
            const el = document.querySelector(sel) as HTMLInputElement | null
            if (el) {
              const len = el.value.length
              el.setSelectionRange(len, len)
            }
          }, hhSelector)
          await humanDelay(100, 220)
          await page.keyboard.down('Control')
          await page.keyboard.press('KeyA')
          await page.keyboard.up('Control')
          await humanDelay(140, 260)
          await page.keyboard.type(hh24, { delay: 0 })
          await humanDelay(160, 320)

          // Minute
          await humanDelay(140, 300)
          await page.focus(mmSelector)
          await humanDelay(120, 240)
          await page.evaluate((sel) => {
            const el = document.querySelector(sel) as HTMLInputElement | null
            if (el) {
              const len = el.value.length
              el.setSelectionRange(len, len)
            }
          }, mmSelector)
          await humanDelay(100, 220)
          await page.keyboard.down('Control')
          await page.keyboard.press('KeyA')
          await page.keyboard.up('Control')
          await humanDelay(140, 260)
          await page.keyboard.type(mm, { delay: 0 })
          await humanDelay(160, 320)

          // Click Done
          await humanClick(page,'div[class="xmzvs34"] [role="button"]')
          await humanDelay(500, 900)
        }
      }

      // Step 8: Post
      if (isFirst) console.log('Step 8: Posting content...')
      await humanClick(page,'.x2lah0s:nth-child(1) > .x1i10hfl > .xc26acl')
      await humanDelay(5000, 8000)
      console.log('Step 8 completed: Content posted successfully')

      if ((item as any)?.schedule) {
        console.log('Skipping comment step because of schedule')
        continue;
      }
      if (isFirst) {
        // Step 9-15: Profile navigation, comment
        await humanClick(page,'.x78zum5 > .x1i10hfl > .x90nhty > .xl1xv1r')
        await humanDelay(1000, 2000)

        const commentTexts = extractCommentTexts(item as any)
        console.log(`🗨️ Comments to post: ${commentTexts.length}`)

        for (let j = 0; j < commentTexts.length; j++) {
          const comment = commentTexts[j]
          const attemptPost = async () => {
            // click comment button
            await humanClick(page,'.x1c1b4dv:nth-child(7) .x78zum5:nth-child(1) > .x9f619:nth-child(1) .x1xdureb:nth-child(3) .x6s0dn4:nth-child(2) .x1lliihq:nth-child(1)')
            // click comment input
            await humanClick(page,'.xzsf02u > .xdj266r')
            await humanTypeWithMistakes(page, '.xzsf02u > .xdj266r', comment)
            console.log(`⌨️ Typing comment ${j + 1}/${commentTexts.length}:`, comment.slice(0, 80))
            // click post comment button
            try {
              await humanClick(page, '.x2lah0s:nth-child(1) > .x1i10hfl > .xc26acl')
            } catch {
              await humanClick(page, 'div.x1s688f:nth-child(2)')
            }
            await humanDelay(1000, 2000)
            console.log(`✅ Comment ${j + 1} posted`)
          }

          await attemptPost()
          await humanDelay(2000, 3000)
          console.log(`✅ Comment ${j + 1} posted`)

          // Human-like delay between comments
          if (j < commentTexts.length - 1) {
            await humanDelay(2000, 5000)
          }
        }

        await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
        await humanDelay(3000, 5000)

      await humanClick(page,'.x1ypdohk > path')
    }
    }

    

    console.log('🎉 All automation steps completed successfully!')
    await page.close()
    const browser = page.browser()
    await browser.close()
    return { success: true }

  } catch (error) {
    console.error('❌ Post and Comment automation failed:', error)
    // Rethrow so upstream IPC can catch and report properly
    throw error
  }
}





