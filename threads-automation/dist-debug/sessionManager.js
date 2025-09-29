import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
// Hint ws to skip optional native deps to avoid bundler resolution issues
process.env.WS_NO_BUFFER_UTIL = '1';
process.env.WS_NO_UTF_8_VALIDATE = '1';
const OPEN_PROFILE_API = 'http://127.0.0.1:5424/api/open-profile';
const sessions = new Map();
export async function openOneProfileAndConnect(profileId, options) {
    const res = await fetch(OPEN_PROFILE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, options })
    });
    if (!res.ok)
        throw new Error(`bad status ${res.status}`);
    const data = await res.json();
    if (!data || data.success !== true || !('wsUrl' in data) || !data.wsUrl) {
        throw new Error((data === null || data === void 0 ? void 0 : data.error) || 'open failed / missing wsUrl');
    }
    const browser = await puppeteer.connect({ browserWSEndpoint: data.wsUrl, defaultViewport: null });
    sessions.set(profileId, { wsUrl: data.wsUrl, browser });
    console.log('[sessionManager] connected puppeteer for', profileId, data.wsUrl);
    return { profileId };
}
export async function openProfilesWithConcurrency(profileIds, options, concurrency) {
    const limit = Math.max(1, Math.min(concurrency, profileIds.length));
    const results = [];
    let cursor = 0;
    const workers = Array.from({ length: limit }, async () => {
        while (cursor < profileIds.length) {
            const index = cursor++;
            const id = profileIds[index];
            try {
                const r = await openOneProfileAndConnect(id, options);
                results.push(r);
            }
            catch (e) {
                console.error('open/connect failed', id, e);
            }
        }
    });
    await Promise.all(workers);
    return results;
}
export function getSession(profileId) {
    return sessions.get(profileId) || null;
}
export async function closeProfile(profileId) {
    const s = sessions.get(profileId);
    if (!s)
        return false;
    await s.browser.close().catch(() => { });
    sessions.delete(profileId);
    return true;
}
export async function withPage(profileId, fn) {
    const s = sessions.get(profileId);
    if (!s)
        throw new Error('session not found');
    console.log('[sessionManager] creating new page for', profileId);
    const page = await s.browser.newPage();
    try {
        console.log('[sessionManager] running page task for', profileId);
        return await fn(page);
    }
    finally {
        console.log('[sessionManager] closing page for', profileId);
        await page.close().catch(() => { });
    }
}
