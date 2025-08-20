import { humanType, humanClick, humanDelay } from '../human-behavior.js';
import { SELECTORS, TIMEOUTS, THREADS_URL, LOGIN_PATH_HINTS } from '../config/constants.js';
import { isAuthenticatedUrl } from '../utils/browserUtils.js';
import { CookieService } from './CookieService.js';

/**
 * Authentication Service - Quản lý đăng nhập
 */
export class AuthenticationService {
  /**
   * Thực hiện auto login
   * @param {import('puppeteer').Page} page
   * @param {import('../models/Profile.js').Profile} profile
   * @returns {Promise<boolean>}
   */
  static async performAutoLogin(page, profile) {
    if (!profile.hasCredentials()) {
      console.log(`⚠️ No credentials found for profile: ${profile.name}`);
      return false;
    }
    console.log(`🔐 Attempting auto login for profile: ${profile.name}`);

    try {
      // Tìm và nhập username
      await humanType(page, SELECTORS.LOGIN.USERNAME, profile.credentials.username);
      await humanDelay(1000, 2000);
      
      // Tìm và nhập password  
      await humanType(page, SELECTORS.LOGIN.PASSWORD, profile.credentials.password);
      await humanDelay(1000, 2000);
      
      // Click nút login
      await humanClick(page, SELECTORS.LOGIN.SUBMIT);
      
      // Chờ redirect hoặc element xuất hiện
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: TIMEOUTS.LOGIN }),
        page.waitForSelector(SELECTORS.THREADS.PRIMARY_COLUMN, { timeout: TIMEOUTS.ELEMENT_WAIT })
      ]);
      
      return isAuthenticatedUrl(page.url(), LOGIN_PATH_HINTS, THREADS_URL);
    } catch (error) {
      return false;
    }
  }

  /**
   * Đảm bảo đã đăng nhập
   * @param {import('puppeteer').Page} page
   * @param {import('../models/Profile.js').Profile} profile
   * @returns {Promise<boolean>}
   */
  static async ensureLoggedIn(page, profile) {
    const currentUrl = page.url();
    if (isAuthenticatedUrl(currentUrl, LOGIN_PATH_HINTS, THREADS_URL)) {
      return true;
    }

    // Thử auto login
    const loginSuccess = await this.performAutoLogin(page, profile);
    if (loginSuccess) {
      const newCookies = await page.cookies();
      await CookieService.saveCookies(newCookies, profile.cookiesPath);
      return true;
    }
    
    return false;
  }

  /**
   * Refresh cookies nếu vẫn đăng nhập
   * @param {import('puppeteer').Page} page
   * @param {string} cookiesPath
   * @returns {Promise<boolean>}
   */
  static async refreshCookiesIfAuthenticated(page, cookiesPath) {
    const endUrl = page.url();
    const stillLoggedIn = !LOGIN_PATH_HINTS.some((p) => endUrl.includes(p));
    
    if (!stillLoggedIn) {
      return false;
    }

    const latestCookies = await page.cookies();
    if (!CookieService.isValidCookies(latestCookies)) {
      return false;
    }

    return await CookieService.refreshCookies(latestCookies, cookiesPath);
  }

  /**
   * Load cookies vào page
   * @param {import('puppeteer').Page} page
   * @param {string} cookiesPath
   * @returns {Promise<boolean>}
   */
  static async loadCookiesToPage(page, cookiesPath) {
    try {
      const cookies = await CookieService.loadCookies(cookiesPath);
      if (CookieService.isValidCookies(cookies)) {
        await page.setCookie(...cookies);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }
}
