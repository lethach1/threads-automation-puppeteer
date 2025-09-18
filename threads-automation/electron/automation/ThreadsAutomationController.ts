import type { Page } from 'puppeteer-core'

// Minimal automation: navigate only
export const runAutomationOnPage = async (page: Page) => {
  await page.goto('https://threads.com/', { waitUntil: 'networkidle2' })
}


