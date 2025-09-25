import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'copy-automation',
      buildStart() {
        // Copy automation folder to dist-electron during build
        const sourceDir = path.join(__dirname, 'electron', 'automation')
        const destDir = path.join(__dirname, 'dist-electron', 'automation')
        
        if (fs.existsSync(sourceDir)) {
          // Ensure destination directory exists
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true })
          }
          
          // Copy files
          const copyRecursive = (src: string, dest: string) => {
            const entries = fs.readdirSync(src, { withFileTypes: true })
            for (const entry of entries) {
              const srcPath = path.join(src, entry.name)
              const destPath = path.join(dest, entry.name)
              
              if (entry.isDirectory()) {
                if (!fs.existsSync(destPath)) {
                  fs.mkdirSync(destPath, { recursive: true })
                }
                copyRecursive(srcPath, destPath)
              } else {
                fs.copyFileSync(srcPath, destPath)
              }
            }
          }
          
          copyRecursive(sourceDir, destDir)
          console.log('✅ Copied automation folder to dist-electron')
        }
      }
    },
    electron({
      main: {
        // Shortcut of `build.lib.entry`.
        entry: 'electron/main.ts',
        // Ensure optional native deps from ws (bufferutil, utf-8-validate) are not bundled
        rollupOptions: {
          external: [
            'ws', 
            'bufferutil', 
            'utf-8-validate',
            'puppeteer-core',
            'node-fetch',
            'url',
            'fs/promises',
            'path'
          ]
        }
      },
      preload: {
        // Shortcut of `build.rollupOptions.input`.
        // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
        input: path.join(__dirname, 'electron/preload.ts'),
      },
      // Ployfill the Electron and Node.js API for Renderer process.
      // If you want use Node.js in Renderer process, the `nodeIntegration` needs to be enabled in the Main process.
      // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
      renderer: process.env.NODE_ENV === 'test'
        // https://github.com/electron-vite/vite-plugin-electron-renderer/issues/78#issuecomment-2053600808
        ? undefined
        : {},
    }),
  ],
})
