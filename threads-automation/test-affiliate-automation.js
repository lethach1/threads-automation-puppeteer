// Test script for affiliate automation with FlexSearch and AI
const testData = {
  // Sample postText for testing
  postText: "Hôm nay mình review son lip tint mới, màu đẹp lắm các bạn ơi! Màu sắc rất tự nhiên và bền màu.",
  
  // Sample affiliate link pool data (parsed from CSV)
  affiliateLinkPoolData: [
    {
      "Mã sản phẩm": "21387075951",
      "Tên sản phẩm": "Inga GLASSY Water Glow Lip Tint (SNOWY / GLASSY _ 13 màu)",
      "Giá": "250,0k",
      "Doanh thu": "100k+",
      "Tên cửa hàng": "INGA VN Official Store",
      "Tỉ lệ hoa hồng": "25,5%",
      "Hoa hồng": "₫62.500",
      "Link sản phẩm": "https://shopee.vn/product/826944227/21387075951",
      "Link ưu đãi": "https://s.shopee.vn/5fgOHyTFCb"
    },
    {
      "Mã sản phẩm": "6194112672",
      "Tên sản phẩm": "Nước Hoa Tóc & Cơ Thể - Hair & Body Mist SKINLAX 100ml",
      "Giá": "261,0k",
      "Doanh thu": "30k+",
      "Tên cửa hàng": "Skinlax - Gian Hàng Chính Hãng",
      "Tỉ lệ hoa hồng": "22,5%",
      "Hoa hồng": "₫57.420",
      "Link sản phẩm": "https://shopee.vn/product/179893523/6194112672",
      "Link ưu đãi": "https://s.shopee.vn/5VMy5fTsXa"
    },
    {
      "Mã sản phẩm": "23318918089",
      "Tên sản phẩm": "Dầu Tắm ÔLIV 3X Dưỡng Ẩm/Dưỡng Sáng Da/Dành Cho Làn Da Nhạy Cảm 250ML/650ML/1L",
      "Giá": "74,0k",
      "Doanh thu": "50k+",
      "Tên cửa hàng": "LASHE SUPERFOOD | PURITÉ",
      "Tỉ lệ hoa hồng": "22,5%",
      "Hoa hồng": "₫16.280",
      "Link sản phẩm": "https://shopee.vn/product/779659055/23318918089",
      "Link ưu đãi": "https://s.shopee.vn/5L3XtMUVsZ"
    },
    {
      "Mã sản phẩm": "29060062205",
      "Tên sản phẩm": "Usams Wireless Power bank 5000 / 10000mAh Sạc từ tính không dây Sạc nhanh USB-C Đầu vào / Ra cho iP16 15 14 13 12 Series",
      "Giá": "383,9k",
      "Doanh thu": "9k+",
      "Tên cửa hàng": "USAMS Official Shop",
      "Tỉ lệ hoa hồng": "20,5%",
      "Hoa hồng": "₫76.780",
      "Link sản phẩm": "https://shopee.vn/product/408923716/29060062205",
      "Link ưu đãi": "https://s.shopee.vn/6VFVHVQ4Vo"
    }
  ],
  
  // AI configuration (optional)
  gptKey: "your-openai-key-here",
  geminiKey: "your-gemini-key-here",
  prompt: "Custom prompt for AI keyword extraction"
}

console.log('🧪 Test Case for Affiliate Automation:')
console.log('📝 Post Text:', testData.postText)
console.log('📦 Affiliate Products:', testData.affiliateLinkPoolData.length)
console.log('🤖 AI Keys:', {
  gpt: testData.gptKey ? '✅ Provided' : '❌ Missing',
  gemini: testData.geminiKey ? '✅ Provided' : '❌ Missing'
})

// Expected flow:
console.log('\n🔄 Expected Automation Flow:')
console.log('1. AI analyzes postText → extracts keywords: "lip, tint, beauty, makeup"')
console.log('2. FlexSearch finds matching products using keywords')
console.log('3. Selects random product from matches')
console.log('4. Adds affiliate link to postText')
console.log('5. Posts enhanced content to social media')

// Expected result:
const expectedResult = {
  originalPost: testData.postText,
  enhancedPost: testData.postText + '\n\n🔗 Link mua: https://s.shopee.vn/5fgOHyTFCb',
  selectedProduct: {
    name: "Inga GLASSY Water Glow Lip Tint (SNOWY / GLASSY _ 13 màu)",
    price: "250,0k",
    discountLink: "https://s.shopee.vn/5fgOHyTFCb"
  }
}

console.log('\n✅ Expected Result:')
console.log('Enhanced Post:', expectedResult.enhancedPost)
console.log('Selected Product:', expectedResult.selectedProduct.name)
console.log('Affiliate Link:', expectedResult.selectedProduct.discountLink)
