import { humanDelay, humanScroll, humanHover, humanClick, humanTypeWithMistakes } from '../human-behavior.js';
import { THREADS_URL, TIMEOUTS, SELECTORS } from '../config/constants.js';
import { startProfile, getProfilePaths } from '../services/ProfileService.ts';
import { AuthenticationService } from '../services/AuthenticationService.js';
import { Browser, Page } from 'puppeteer-core';


/**
 * Automation Controller - Điều khiển chính automation
 */
export class AutomationController {
  private profiles: any[] = []; // Add this property
  
  async runProfileAutomation(profile, index) {
    console.log(`👤 Starting automation for profile: ${profile.name} (${index + 1}/${this.profiles.length})`);
    
    let browser: Browser | null = null

    try {
      // Start profile 
      const startedBrowser = await startProfile(profile.path);
      
      if (!startedBrowser) {
        throw new Error(`Failed to start profile: ${profile.name}`);
      }

      browser = startedBrowser;

      const page = await browser.newPage();

      await page.goto("https://iphey.com", { waitUntil: "networkidle2" });
      await new Promise(resolve => setTimeout(resolve, 6000));

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

      // Thực hiện đăng bài
      const postXpath = '/html/body/div[3]/div/div/div[2]/div[2]/div/div/div/div[1]/div[1]/div[1]/div/div/div[2]/div[1]/div[2]/div/div[1]/span';
      const contentPostXpath = '/html/body/div[3]/div/div/div[3]/div/div/div[1]/div/div[2]/div/div/div/div[2]/div/div/div/div/div/div[2]/div/div/div[1]/div[2]/div[2]/div[1]/p';

      const [postElement] = await (page as any).$x(postXpath);
            
      await postElement.click();
      await humanDelay(2000, 4000);
      await humanTypeWithMistakes(page, contentPostXpath, 'Hello, world!');



      // Thực hiện các hành động giống người dùng thật
      await this.performHumanActions(page, profile.name);

      // Đợi một chút trước khi đóng
      await humanDelay(2000, 4000);

 
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
   * Đăng nhập với username và password
   * @param {import('puppeteer').Page} page
   * @param {string} username
   * @param {string} password
   */
  async login(page, username, password) {
    const usernameXpath = '/html/body/div[3]/div/div/div[3]/div/div/div/div[1]/div[1]/div[3]/form/div/input';
    const passwordXpath = '/html/body/div[3]/div/div/div[3]/div/div/div/div[1]/div[1]/div[3]/form/div/div[1]/div[1]/input';
    const loginButtonXpath = '/html/body/div[3]/div/div/div[3]/div/div/div/div[1]/div[1]/div[3]/form/div/div[1]/div[2]/div[2]/div/div';
    
    // Đợi username input xuất hiện
    await page.waitForXPath(usernameXpath, { timeout: 10000 });
    
    // Tìm và nhập username
    const [usernameElement] = await page.$x(usernameXpath);
    if (!usernameElement) {
      return false;
    }
    
    // Click vào username input để focus
    await usernameElement.click();
    await humanDelay(500, 1000);
    
    // Clear nội dung cũ nếu có
    await usernameElement.evaluate(el => el.value = '');
    await humanDelay(300, 600);
    
    // Nhập username từng ký tự một
    await usernameElement.type(username, { delay: 100 });
    await humanDelay(1000, 2000);
    
    // Tìm và nhập password
    const [passwordElement] = await page.$x(passwordXpath);
    if (!passwordElement) {
      return false;
    }
    
    // Click vào password input để focus
    await passwordElement.click();
    await humanDelay(500, 1000);
    
    // Clear nội dung cũ nếu có
    await passwordElement.evaluate(el => el.value = '');
    await humanDelay(300, 600);
    
    // Nhập password từng ký tự một
    await passwordElement.type(password, { delay: 100 });
    await humanDelay(1000, 2000);
    
    // Tìm và click login button
    const [loginButton] = await page.$x(loginButtonXpath);
    if (!loginButton) {
      return false;
    }
    
    // Click vào login button
    await loginButton.click();
    await humanDelay(2000, 4000);
    
    return true;
  }

  
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

  
}
