// Debug script for Electron app
const { spawn } = require('child_process')
const path = require('path')

console.log('🚀 Starting Electron app in debug mode...')

// Set debug environment
process.env.DEBUG = 'true'
process.env.NODE_ENV = 'development'

// Path to the built Electron app
const electronPath = path.join(__dirname, 'node_modules', '.bin', 'electron')
const appPath = path.join(__dirname, 'dist-electron', 'main.js')

console.log('📁 Electron path:', electronPath)
console.log('📁 App path:', appPath)
console.log('🐛 Debug mode enabled')

// Start Electron with debug flags
const electron = spawn('npx', ['electron', 'dist-electron/main.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    DEBUG: 'true',
    NODE_ENV: 'development'
  }
})

electron.on('close', (code) => {
  console.log(`Electron app exited with code ${code}`)
})

electron.on('error', (err) => {
  console.error('Failed to start Electron:', err)
})
