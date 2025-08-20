import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { humanDelay, humanScroll, humanHover, humanClick } from '../human-behavior.js';
import { THREADS_URL, TIMEOUTS, SELECTORS } from '../config/constants.js';
import { ProfileService } from '../services/ProfileService.js';
import { AntiDetectService } from '../services/AntiDetectService.js';
import { AuthenticationService } from '../services/AuthenticationService.js';

// Thêm stealth plugin
puppeteer.use(StealthPlugin());

/**
 * Automation Controller - Điều khiển chính automation
 */
export class AutomationController {
  constructor() {
    this.profileService = new ProfileService();
    this.profiles = [];
  }

  /**
   * Chạy automation cho một profile
   * @param {import('../models/Profile.js').Profile} profile
   * @param {number} index
   */
  async runProfileAutomation(profile, index) {
    console.log(`👤 Starting automation for profile: ${profile.name} (${index + 1}/${this.profiles.length})`);
    let browser = null;
    let page = null;

    try {
      // Tạo launch options
      const launchOptions = await AntiDetectService.createLaunchOptions(profile);
      
      // Launch browser
      browser = await puppeteer.launch(launchOptions);
      page = await AntiDetectService.createConfiguredPage(browser, profile);

      // Load cookies
      await AuthenticationService.loadCookiesToPage(page, profile.cookiesPath);

      // Điều hướng đến Threads
      await page.goto(THREADS_URL, {
        waitUntil: 'networkidle2',
        timeout: TIMEOUTS.NAVIGATION
      });

      // Đợi trang load
      await humanDelay(3000, 5000);

      // Đảm bảo login
      const loggedIn = await AuthenticationService.ensureLoggedIn(page, profile);
      if (!loggedIn) {
        console.error(`❌ Login failed for profile: ${profile.name}`);
        throw new Error('Login failed or timeout');
      }
      console.log(`✅ Successfully logged in for profile: ${profile.name}`);

      // Thực hiện hành động chính
      const userInfo = await this.getUserInfo(page);
      
      // Thực hiện các hành động giống người dùng thật
      await this.performHumanActions(page, profile.name);

      // Chụp screenshot
      const screenshotPath = `./screenshot_${profile.name}_${Date.now()}.png`;
      await page.screenshot({
        path: screenshotPath,
        fullPage: false
      });

      // Đợi một chút trước khi đóng
      await humanDelay(2000, 4000);

      // Refresh cookies nếu còn đăng nhập
      await AuthenticationService.refreshCookiesIfAuthenticated(page, profile.cookiesPath);

    } catch (error) {
      // Handle error silently
    } finally {
      // Đóng browser
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Lấy thông tin user từ trang
   * @param {import('puppeteer').Page} page
   * @returns {Promise<string>}
   */
  async getUserInfo(page) {
    try {
      // Scroll một chút để load content
      await humanScroll(page, 300, 'down');
      await humanDelay(1000, 2000);

      // Thử tìm username trong Threads
      const username = await page.evaluate(() => {
        const selectors = [
          '[data-testid="primaryColumn"] h1',
          '[role="main"] h1',
          'h1',
          '[data-testid="userDisplayName"]',
          '.x1lliihq .x193iq5w',
          '[data-testid="UserName"]',
          'span[dir="auto"]'
        ];

        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            return element.textContent.trim();
          }
        }

        return null;
      });

      return username || 'User info not found';
    } catch (error) {
      return 'Error getting user info';
    }
  }

  /**
   * Thực hiện các hành động giống người dùng thật
   * @param {import('puppeteer').Page} page
   * @param {string} profileName
   */
  async performHumanActions(page, profileName) {
    try {
      // Scroll xuống để xem feed
      await humanScroll(page, 800, 'down');
      await humanDelay(2000, 4000);

      // Hover vào một số elements
      const hoverSelectors = [
        SELECTORS.THREADS.POST,
        SELECTORS.THREADS.ARTICLE,
        'article',
        '.x1lliihq'
      ];

      for (const selector of hoverSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            await humanHover(page, selector, 1000);
            await humanDelay(500, 1500);
            break;
          }
        } catch (error) {
          // Ignore nếu không tìm thấy element
        }
      }

      // Scroll lên một chút
      await humanScroll(page, 400, 'up');
      await humanDelay(1000, 2000);

      // Click vào profile icon nếu có
      try {
        const profileSelectors = [
          SELECTORS.THREADS.PROFILE,
          '[aria-label*="profile"]',
          '[aria-label*="Profile"]',
          'a[href*="/profile"]'
        ];

        for (const selector of profileSelectors) {
          const element = await page.$(selector);
          if (element) {
            await humanClick(page, selector);
            await humanDelay(2000, 4000);
            break;
          }
        }
      } catch (error) {
        // Ignore
      }
    } catch (error) {
      // Ignore
    }
  }

  /**
   * Chạy automation cho tất cả profiles
   */
  async runMultiAccountAutomation() {
    // Load cấu hình profiles
    this.profiles = await this.profileService.loadProfiles();
    console.log(`📊 Loaded ${this.profiles.length} profiles for automation`);

    if (this.profiles.length === 0) {
      console.log('⚠️ No profiles found. Please check your profiles directory.');
      return;
    }

    for (let i = 0; i < this.profiles.length; i++) {
      const profile = this.profiles[i];
      console.log(`🔄 Processing profile ${i + 1}/${this.profiles.length}: ${profile.name}`);

      try {
        await this.runProfileAutomation(profile, i);
        console.log(`✅ Completed profile: ${profile.name}`);

        // Nghỉ giữa các profile để tránh bị detect
        if (i < this.profiles.length - 1) {
          console.log('⏳ Waiting between profiles...');
          await humanDelay(10000, 15000);
        }
      } catch (error) {
        console.error(`❌ Error processing profile ${profile.name}:`, error.message);
        continue; // Tiếp tục với profile tiếp theo
      }
    }
    
    console.log('🎉 All profiles processed!');
  }
}
