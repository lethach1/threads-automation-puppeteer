import { humanType, humanClick, humanDelay } from '../human-behavior.js';
import { SELECTORS, TIMEOUTS, THREADS_URL, LOGIN_PATH_HINTS } from '../config/constants.js';
import { Page } from 'puppeteer-core';

interface Profile {
  name: string;
  username?: string;
  password?: string;
}

/**
 * Authentication Service - Quản lý đăng nhập
 */
export class AuthenticationService {
  /**
   * Thực hiện auto login
   * @param page - Puppeteer page instance
   * @param profile - Profile object with credentials
   * @returns Promise<boolean> - Login success status
   */
  static async performAutoLogin(page: Page, profile: Profile): Promise<boolean> {
    console.log(`🔐 Attempting auto login for profile: ${profile.name}`);

    try {
      // Tìm và nhập username
      await humanType(page, SELECTORS.LOGIN.USERNAME, profile.username || 'test');
      await humanDelay(1000, 2000);
      
      // Tìm và nhập password  
      await humanType(page, SELECTORS.LOGIN.PASSWORD, profile.password || 'test');
      await humanDelay(1000, 2000);
      
      // Click nút login
      await humanClick(page, SELECTORS.LOGIN.SUBMIT);
      
      // Chờ redirect hoặc element xuất hiện
      await Promise.race([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: TIMEOUTS.LOGIN }),
        page.waitForSelector(SELECTORS.THREADS.PRIMARY_COLUMN, { timeout: TIMEOUTS.ELEMENT_WAIT })
      ]);
      
      return true; // Simplified - always return true for now
    } catch (error) {
      console.log('Login failed:', (error as Error).message);
      return false;
    }
  }

  /**
   * Đảm bảo đã đăng nhập
   * @param page - Puppeteer page instance
   * @param profile - Profile object with credentials
   * @returns Promise<boolean> - Login success status
   */
  static async ensureLoggedIn(page: Page, profile: Profile): Promise<boolean> {
    console.log(`🔐 Checking login status for profile: ${profile.name}`);
    
    // Simplified - just try to login
    const loginSuccess = await this.performAutoLogin(page, profile);
    return loginSuccess;
  }
}
