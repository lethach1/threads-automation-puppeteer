import type { Page } from 'puppeteer-core'
import path from 'path'
// import { fileURLToPath } from 'node:url' // Unused import
// import { app } from 'electron' // Unused import
import fs from 'fs'
import { createRequire } from 'module'

// const __dirname = path.dirname(fileURLToPath(import.meta.url)) // Unused variable
const require = createRequire(import.meta.url)

// Extend global type
declare global {
  var humanDelay: any
  var humanClick: any
  var humanTypeWithMistakes: any
  var waitForElements: any
  var fs: any
  var path: any
}

// No need for global injection - scripts use relative imports

export type ScenarioResult = { success: boolean; data?: any; error?: string }

// Function to get custom scripts directory, handling both dev and production paths
const getCustomScriptsDir = (): string => {
  // In production (asar), check asar.unpacked first
  const asarUnpackedPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'dist-electron', 'custom-scripts')
  if (fs.existsSync(asarUnpackedPath)) {
    console.log('[router] Using asar.unpacked custom scripts:', asarUnpackedPath)
    return asarUnpackedPath
  }
  
  // In development or non-asar builds
  const devPath = path.join(process.cwd(), 'dist-electron', 'custom-scripts')
  if (fs.existsSync(devPath)) {
    console.log('[router] Using dev custom scripts:', devPath)
    return devPath
  }
  
  // Fallback to __dirname relative path
  const dirnamePath = path.join(__dirname, '..', 'custom-scripts')
  console.log('[router] Using __dirname custom scripts fallback:', dirnamePath)
  return dirnamePath
}

// Template for custom scripts
/*
const SCRIPT_TEMPLATE = `const fs = require('fs')
const path = require('path')

async function run(page, input = {}) {
  try {
    console.log('🚀 Starting custom automation...')
    console.log('📝 Input:', input)
    const { humanDelay, humanClick, humanTypeWithMistakes, waitForElements } = await import('../automation/human-behavior.js')
    
    // USER_LOGIC_PLACEHOLDER
    
    console.log('✅ Custom automation completed successfully!')
    return { success: true }
    
  } catch (error) {
    console.error('❌ Custom automation failed:', error)
    return { success: false, error: error.message }
  }
}

module.exports = { run }`
*/

export const runAutomationOnPage = async (
  page: Page,
  opts?: { scenario?: string; input?: any }
): Promise<ScenarioResult> => {
  const scenario = String(opts?.scenario || '').trim()

  try {
    if (!scenario) {
      throw new Error('scenario is required')
    }
    // Try to load from custom scripts first, then built-in scenarios
    console.log('[router] resolving scenario:', scenario)
        
        // First try custom scripts (template format)
        try {
          const customScriptsDir = getCustomScriptsDir()
          const customScriptPath = path.join(customScriptsDir, `${scenario}.cjs`)
          console.log('[router] trying custom script path:', customScriptPath)
          
          if (fs.existsSync(customScriptPath)) {
            console.log('[router] custom script file exists, loading...')
            
            // Simple require - scripts use relative imports
            const customMod = require(customScriptPath)
            if (customMod && customMod.run) {
              console.log('[router] custom script loaded:', scenario)
              const result: ScenarioResult = await customMod.run(page, opts?.input)
              return result ?? { success: true }
            } else {
              console.log('[router] custom script does not export run function')
            }
          } else {
            console.log('[router] custom script file does not exist:', customScriptPath)
          }
        } catch (customError) {
          console.log('[router] custom script not found, trying built-in scenarios:', customError)
        }
        
        // Fallback to built-in scenarios
        const tsModules = import.meta.glob('./scenarios/*.ts', { eager: true }) as Record<string, any>
        const jsModules = import.meta.glob('./scenarios/*.js', { eager: true }) as Record<string, any>
        
        // Map scenario IDs to actual file names
        const scenarioMap: Record<string, string> = {
          'spamComments': 'spamComments',
          'postAndComment': 'postAndComment',
          'downloadStatusAndImages': 'downloadStatusAndImages'
        }
        
        const mappedScenario = scenarioMap[scenario] || scenario
        const tsKey = `./scenarios/${mappedScenario}.ts`
        const jsKey = `./scenarios/${mappedScenario}.js`
        const mod = tsModules[tsKey] || jsModules[jsKey]
        if (!mod) throw new Error(`Scenario module not found: ${scenario} (mapped to: ${mappedScenario})`)
        if (!mod.run) throw new Error(`Scenario '${scenario}' has no exported 'run'`)
        console.log('[router] built-in scenario module loaded:', mappedScenario)
        const result: ScenarioResult = await mod.run(page, opts?.input)
        return result ?? { success: true }
    
    // (rest of function unchanged)
  } catch (error: any) {
    console.error('[router] scenario error:', error)
    return { success: false, error: error?.message || 'Scenario error' }
  }
}


