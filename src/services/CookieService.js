import { readJsonFileSafe, saveJsonFileSafe, createBackup } from '../utils/fileUtils.js';

/**
 * Cookie Service - Quản lý cookies
 */
export class CookieService {
  /**
   * Load cookies từ file
   * @param {string} cookiesPath
   * @returns {Promise<Array>}
   */
  static async loadCookies(cookiesPath) {
    try {
      const cookies = await readJsonFileSafe(cookiesPath);
      return cookies || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Lưu cookies vào file
   * @param {Array} cookies
   * @param {string} cookiesPath
   * @returns {Promise<boolean>}
   */
  static async saveCookies(cookies, cookiesPath) {
    try {
      return await saveJsonFileSafe(cookiesPath, cookies);
    } catch (error) {
      return false;
    }
  }

  /**
   * Refresh cookies với backup
   * @param {Array} cookies
   * @param {string} cookiesPath
   * @returns {Promise<boolean>}
   */
  static async refreshCookies(cookies, cookiesPath) {
    try {
      // Tạo backup trước
      await createBackup(cookiesPath);
      
      // Lưu cookies mới
      return await this.saveCookies(cookies, cookiesPath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Kiểm tra cookies có hợp lệ không
   * @param {Array} cookies
   * @returns {boolean}
   */
  static isValidCookies(cookies) {
    return Array.isArray(cookies) && cookies.length > 0;
  }

  /**
   * Lọc cookies theo domain
   * @param {Array} cookies
   * @param {string} domain
   * @returns {Array}
   */
  static filterCookiesByDomain(cookies, domain) {
    if (!this.isValidCookies(cookies)) return [];
    
    return cookies.filter(cookie => {
      return cookie.domain && cookie.domain.includes(domain);
    });
  }

  /**
   * Lọc cookies theo name
   * @param {Array} cookies
   * @param {string} name
   * @returns {Array}
   */
  static filterCookiesByName(cookies, name) {
    if (!this.isValidCookies(cookies)) return [];
    
    return cookies.filter(cookie => {
      return cookie.name && cookie.name === name;
    });
  }
}
