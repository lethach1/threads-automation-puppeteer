// Simple debug test script
console.log('🚀 Debug test starting...')

// Test debugger statement
debugger; // This will pause execution

console.log('✅ Debug test completed!')

// Test with Puppeteer
const puppeteer = require('puppeteer-core')

async function testDebug() {
  console.log('🔧 Starting Puppeteer debug test...')
  
  debugger; // Breakpoint here
  
  // Note: This is just a test - actual browser automation would go here
  console.log('✅ Puppeteer debug test completed!')
}

testDebug().catch(console.error)
