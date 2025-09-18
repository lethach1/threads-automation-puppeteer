import { createRequire } from 'node:module'

type OpenProfileOptions = { windowWidth: number; windowHeight: number; scalePercent: number }
type SessionInfo = { wsUrl: string; browser: import('puppeteer-core').Browser }

const require = createRequire(import.meta.url)
const puppeteer = require('puppeteer-core') as typeof import('puppeteer-core')

// Hint ws to skip optional native deps to avoid bundler resolution issues
process.env.WS_NO_BUFFER_UTIL = '1'
process.env.WS_NO_UTF_8_VALIDATE = '1'

const OPEN_PROFILE_API = 'http://127.0.0.1:5424/api/open-profile'
const sessions = new Map<string, SessionInfo>()

export async function openOneProfileAndConnect(profileId: string, options: OpenProfileOptions) {
  const res = await fetch(OPEN_PROFILE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId, options })
  })
  if (!res.ok) throw new Error(`bad status ${res.status}`)
  const data = await res.json() as any
  if (!data || data.success !== true || !('wsUrl' in data) || !data.wsUrl) {
    throw new Error(data?.error || 'open failed / missing wsUrl')
  }

  const browser = await puppeteer.connect({ browserWSEndpoint: data.wsUrl, defaultViewport: null })
  sessions.set(profileId, { wsUrl: data.wsUrl, browser })
  console.log('[sessionManager] connected puppeteer for', profileId, data.wsUrl)
  return { profileId }
}

export async function openProfilesWithConcurrency(profileIds: string[], options: OpenProfileOptions, concurrency: number) {
  const limit = Math.max(1, Math.min(concurrency, profileIds.length))
  const results: { profileId: string }[] = []
  let cursor = 0
  const workers = Array.from({ length: limit }, async () => {
    while (cursor < profileIds.length) {
      const index = cursor++
      const id = profileIds[index]
      try {
        const r = await openOneProfileAndConnect(id, options)
        results.push(r)
      } catch (e) {
        console.error('open/connect failed', id, e)
      }
    }
  })
  await Promise.all(workers)
  return results
}

export function getSession(profileId: string) {
  return sessions.get(profileId) || null
}

export async function closeProfile(profileId: string) {
  const s = sessions.get(profileId)
  if (!s) return false
  await s.browser.close().catch(() => {})
  sessions.delete(profileId)
  return true
}

export async function withPage<T>(profileId: string, fn: (page: import('puppeteer-core').Page) => Promise<T>) {
  const s = sessions.get(profileId)
  if (!s) throw new Error('session not found')
  console.log('[sessionManager] creating new page for', profileId)
  const page = await s.browser.newPage()
  try {
    console.log('[sessionManager] running page task for', profileId)
    return await fn(page)
  } finally {
    console.log('[sessionManager] closing page for', profileId)
    await page.close().catch(() => {})
  }
}


