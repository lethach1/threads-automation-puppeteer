import path from 'path';
// import { fileURLToPath } from 'node:url' // Unused import
// import { app } from 'electron' // Unused import
import fs from 'fs';
import { createRequire } from 'module';
// const __dirname = path.dirname(fileURLToPath(import.meta.url)) // Unused variable
const require = createRequire(import.meta.url);
const CUSTOM_SCRIPTS_DIR = path.join(process.cwd(), 'dist-electron', 'custom-scripts');
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
export const runAutomationOnPage = async (page, opts) => {
    const scenario = ((opts === null || opts === void 0 ? void 0 : opts.scenario) || 'openHomepage').trim();
    try {
        switch (scenario) {
            case 'openHomepage': {
                await page.goto('https://threads.com/', { waitUntil: 'networkidle2' });
                return { success: true };
            }
            default: {
                // Try to load from custom scripts first, then built-in scenarios
                console.log('[router] resolving scenario:', scenario);
                // First try custom scripts (template format)
                try {
                    const customScriptPath = path.join(CUSTOM_SCRIPTS_DIR, `${scenario}.cjs`);
                    console.log('[router] trying custom script path:', customScriptPath);
                    if (fs.existsSync(customScriptPath)) {
                        console.log('[router] custom script file exists, loading...');
                        // Simple require - scripts use relative imports
                        const customMod = require(customScriptPath);
                        if (customMod && customMod.run) {
                            console.log('[router] custom script loaded:', scenario);
                            const result = await customMod.run(page, opts === null || opts === void 0 ? void 0 : opts.input);
                            return result !== null && result !== void 0 ? result : { success: true };
                        }
                        else {
                            console.log('[router] custom script does not export run function');
                        }
                    }
                    else {
                        console.log('[router] custom script file does not exist:', customScriptPath);
                    }
                }
                catch (customError) {
                    console.log('[router] custom script not found, trying built-in scenarios:', customError);
                }
                // Fallback to built-in scenarios
                const tsModules = import.meta.glob('./scenarios/*.ts', { eager: true });
                const jsModules = import.meta.glob('./scenarios/*.js', { eager: true });
                const tsKey = `./scenarios/${scenario}.ts`;
                const jsKey = `./scenarios/${scenario}.js`;
                const mod = tsModules[tsKey] || jsModules[jsKey];
                if (!mod)
                    throw new Error(`Scenario module not found: ${scenario}`);
                if (!mod.run)
                    throw new Error(`Scenario '${scenario}' has no exported 'run'`);
                console.log('[router] built-in scenario module loaded');
                const result = await mod.run(page, opts === null || opts === void 0 ? void 0 : opts.input);
                return result !== null && result !== void 0 ? result : { success: true };
            }
        }
    }
    catch (error) {
        console.error('[router] scenario error:', error);
        return { success: false, error: (error === null || error === void 0 ? void 0 : error.message) || 'Scenario error' };
    }
};
