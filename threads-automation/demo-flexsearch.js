// Demo script to test FlexSearch logic with sample data
const FlexSearch = require('flexsearch')

// Sample data from CSV
const products = [
  {
    id: "21387075951",
    name: "Inga GLASSY Water Glow Lip Tint (SNOWY / GLASSY _ 13 màu)",
    price: "250,0k",
    store: "INGA VN Official Store",
    discountLink: "https://s.shopee.vn/5fgOHyTFCb"
  },
  {
    id: "6194112672", 
    name: "Nước Hoa Tóc & Cơ Thể - Hair & Body Mist SKINLAX 100ml",
    price: "261,0k",
    store: "Skinlax - Gian Hàng Chính Hãng",
    discountLink: "https://s.shopee.vn/5VMy5fTsXa"
  },
  {
    id: "23318918089",
    name: "Dầu Tắm ÔLIV 3X Dưỡng Ẩm/Dưỡng Sáng Da/Dành Cho Làn Da Nhạy Cảm 250ML/650ML/1L",
    price: "74,0k", 
    store: "LASHE SUPERFOOD | PURITÉ",
    discountLink: "https://s.shopee.vn/5L3XtMUVsZ"
  },
  {
    id: "29060062205",
    name: "Usams Wireless Power bank 5000 / 10000mAh Sạc từ tính không dây Sạc nhanh USB-C Đầu vào / Ra cho iP16 15 14 13 12 Series",
    price: "383,9k",
    store: "USAMS Official Shop", 
    discountLink: "https://s.shopee.vn/6VFVHVQ4Vo"
  }
]

// Initialize FlexSearch
const productIndex = new FlexSearch.Index({
  tokenize: "forward",
  resolution: 3
})

// Build index
console.log('🔍 Building FlexSearch index...')
products.forEach((product, index) => {
  productIndex.add(index, product.name.toLowerCase())
})
console.log('✅ Index built successfully')

// Test search functions
function searchProducts(keyword, products) {
  if (!keyword.trim()) return products
  
  const results = productIndex.search(keyword.toLowerCase())
  return results.map((index) => products[Number(index)]).filter(Boolean)
}

function searchProductsWithFallback(keyword, products) {
  // Step 1: Exact search
  let results = searchProducts(keyword, products)
  if (results.length > 0) {
    console.log(`✅ Found ${results.length} products for "${keyword}"`)
    return results
  }
  
  console.log(`⚠️ No products found for "${keyword}", trying fallback...`)
  
  // Step 2: Try shorter keywords
  const shortKeywords = keyword.split(' ').filter(w => w.length > 2)
  for (const shortKeyword of shortKeywords) {
    results = searchProducts(shortKeyword, products)
    if (results.length > 0) {
      console.log(`✅ Found ${results.length} products with shorter keyword "${shortKeyword}"`)
      return results
    }
  }
  
  // Step 3: Fuzzy search
  results = products.filter(product => {
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
  
  if (results.length > 0) {
    console.log(`✅ Found ${results.length} products with fuzzy search`)
    return results
  }
  
  // Step 4: Return all products
  console.log(`❌ No products found, returning all products`)
  return products
}

// Test cases
console.log('\n🧪 Testing FlexSearch with different keywords:')

const testCases = [
  'lip tint',
  'nước hoa',
  'dầu tắm', 
  'power bank',
  'beauty',
  'skincare',
  'tech'
]

testCases.forEach(keyword => {
  console.log(`\n🔍 Searching for: "${keyword}"`)
  const results = searchProductsWithFallback(keyword, products)
  results.forEach((product, index) => {
    console.log(`  ${index + 1}. ${product.name}`)
    console.log(`     Price: ${product.price}`)
    console.log(`     Link: ${product.discountLink}`)
  })
})

// Simulate AI keyword extraction
console.log('\n🤖 Simulating AI keyword extraction:')
const postText = "Hôm nay mình review son lip tint mới, màu đẹp lắm các bạn ơi!"
const aiKeywords = "lip, tint, beauty, makeup" // Simulated AI output
console.log(`Post: "${postText}"`)
console.log(`AI Keywords: "${aiKeywords}"`)

const keywordList = aiKeywords.split(',').map(k => k.trim()).filter(k => k.length > 0)
let matchingProducts = []

keywordList.forEach(keyword => {
  const results = searchProductsWithFallback(keyword, products)
  if (results.length > 0) {
    matchingProducts = [...matchingProducts, ...results]
    console.log(`✅ Found ${results.length} products for keyword: "${keyword}"`)
  }
})

// Remove duplicates
const uniqueProducts = matchingProducts.filter((product, index, self) => 
  index === self.findIndex(p => p.id === product.id)
)

console.log(`\n🎯 Final matching products: ${uniqueProducts.length}`)
uniqueProducts.forEach((product, index) => {
  console.log(`  ${index + 1}. ${product.name}`)
})

// Random selection
if (uniqueProducts.length > 0) {
  const randomIndex = Math.floor(Math.random() * uniqueProducts.length)
  const selectedProduct = uniqueProducts[randomIndex]
  console.log(`\n🎲 Randomly selected product:`)
  console.log(`   Name: ${selectedProduct.name}`)
  console.log(`   Price: ${selectedProduct.price}`)
  console.log(`   Affiliate Link: ${selectedProduct.discountLink}`)
  
  // Enhanced post
  const enhancedPost = `${postText}\n\n🔗 Link mua: ${selectedProduct.discountLink}`
  console.log(`\n📝 Enhanced Post:`)
  console.log(enhancedPost)
}
