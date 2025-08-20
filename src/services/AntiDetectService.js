import { DEFAULT_ACCEPT_LANGUAGE, DEFAULT_TIMEZONE } from '../config/constants.js';

/**
 * Anti-detect Service - Quản lý fingerprinting
 */
export class AntiDetectService {
  /**
   * Áp dụng anti-detect settings cho page
   * @param {import('puppeteer').Page} page
   * @param {import('../models/Profile.js').Profile} profile
   */
  static async applySettings(page, profile) {
    try {
      const lang = profile.getLanguage() || DEFAULT_ACCEPT_LANGUAGE;
      const languagesList = lang.split(',').map(l => l.split(';')[0]).filter(Boolean);
      const timezone = profile.getTimezone() || DEFAULT_TIMEZONE;

      // Accept-Language header
      await page.setExtraHTTPHeaders({ 'Accept-Language': lang });

      // navigator.languages
      await page.evaluateOnNewDocument((languagesArg) => {
        try {
          Object.defineProperty(navigator, 'languages', {
            get: () => languagesArg
          });
        } catch {}
      }, languagesList);

      // Timezone
      try {
        await page.emulateTimezone(timezone);
      } catch {}

      // Geolocation
      await this.setGeolocation(page, profile);

    } catch (error) {
      // Silent fail
    }
  }

  /**
   * Set geolocation cho page
   * @param {import('puppeteer').Page} page
   * @param {import('../models/Profile.js').Profile} profile
   */
  static async setGeolocation(page, profile) {
    const geolocation = profile.getGeolocation();
    if (!geolocation) return;

    try {
      const context = page.browser().defaultBrowserContext();
      await context.overridePermissions('https://www.threads.net', ['geolocation']);
      await page.setGeolocation(geolocation);
    } catch (error) {
      // Silent fail
    }
  }

  /**
   * Tạo launch options với anti-detect
   * @param {import('../models/Profile.js').Profile} profile
   * @param {object} options
   * @returns {Promise<object>}
   */
  static async createLaunchOptions(profile, options = {}) {
    const { findChromeExecutable, getUserDataDir } = await import('../utils/browserUtils.js');
    const { BROWSER_ARGS, WEBRTC_FLAGS } = await import('../config/constants.js');

    const chromePath = await findChromeExecutable();
    const userDataDir = getUserDataDir(profile);

    const args = [...BROWSER_ARGS];

    // Thêm proxy nếu có
    if (profile.hasValidProxy()) {
      args.push(`--proxy-server=${profile.getProxyServer()}`);
      args.push(...WEBRTC_FLAGS);
    }

    return {
      headless: false,
      defaultViewport: null,
      executablePath: chromePath || undefined,
      userDataDir,
      args,
      ...options
    };
  }

  /**
   * Cấu hình page với anti-detect
   * @param {import('puppeteer').Browser} browser
   * @param {import('../models/Profile.js').Profile} profile
   * @returns {Promise<import('puppeteer').Page>}
   */
  static async createConfiguredPage(browser, profile) {
    const page = await browser.newPage();
    
    // Áp dụng anti-detect settings
    await this.applySettings(page, profile);

    // Set proxy authentication nếu có
    const proxyAuth = profile.getProxyAuth();
    if (proxyAuth) {
      await page.authenticate(proxyAuth);
    }

    return page;
  }
}
