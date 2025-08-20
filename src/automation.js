const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs').promises;
const path = require('path');

// Import human behavior functions
const {
  humanDelay,
  humanType,
  humanClick,
  humanScroll,
  humanHover,
  humanScrollToElement,
  humanMouseMove
} = require('./human-behavior');

// Thêm stealth plugin
puppeteer.use(StealthPlugin());

// Danh sách profiles sẽ được load động từ thư mục `profiles/acc*`
let profiles = [];

/**
 * Đọc JSON an toàn (trả về null nếu file không tồn tại/invalid)
 * @param {string} targetPath
 * @returns {Promise<object|null>}
 */
const readJsonFileSafe = async (targetPath) => {
  try {
    const raw = await fs.readFile(targetPath, 'utf8');
    if (!raw || !raw.trim()) return null;
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
};

/**
 * Load cấu hình profiles lần lượt từ thư mục `profiles/`
 * Mỗi profile directory (vd: acc1, acc2) cần có `cookies.json` và optional `proxy.json`
 * @param {string} baseDir
 * @returns {Promise<Array<{name:string, cookiesPath:string, proxy:object|null}>>}
 */
const loadProfilesConfig = async (baseDir = path.resolve(__dirname, '..', 'profiles')) => {
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true }); // đọc thư mục profiles
    const profileDirs = entries.filter((e) => e.isDirectory()); // lọc ra các thư mục

    const loaded = [];
    for (const dirent of profileDirs) {
      const profileName = dirent.name; // tên acc1, acc2, ...
      const profileDir = path.join(baseDir, profileName); // path đến thư mục /project/profiles/acc1
      const cookiesPath = path.join(profileDir, 'cookies.json');
      const proxyPath = path.join(profileDir, 'proxy.json');

      const proxyJson = await readJsonFileSafe(proxyPath);
      const hasValidProxy = proxyJson && typeof proxyJson === 'object' && proxyJson.server;

      loaded.push({
        name: profileName,
        cookiesPath,
        proxy: hasValidProxy ? proxyJson : null
      });
    }
    // Sắp xếp tên (acc1, acc2, ...) để chạy lần lượt
    loaded.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    return loaded;
  } catch (error) {
    console.error('Failed to load profiles directory:', error.message);
    return [];
  }
};

/**
 * Load cookies từ file
 * @param {string} cookiesPath - Đường dẫn đến file cookies
 * @returns {Array} Mảng cookies hoặc array rỗng nếu file không tồn tại
 */
const loadCookies = async (cookiesPath) => {
  try {
    const cookiesString = await fs.readFile(cookiesPath, 'utf8');
    const cookies = JSON.parse(cookiesString);
    console.log(`✅ Loaded ${cookies.length} cookies from ${cookiesPath}`);
    return cookies;
  } catch (error) {
    console.log(`⚠️  Cookies file not found: ${cookiesPath}`);
    return [];
  }
};

/**
 * Lưu cookies vào file
 * @param {Array} cookies - Mảng cookies cần lưu
 * @param {string} cookiesPath - Đường dẫn file để lưu
 */
const saveCookies = async (cookies, cookiesPath) => {
  try {
    await fs.writeFile(cookiesPath, JSON.stringify(cookies, null, 2));
    console.log(`💾 Saved ${cookies.length} cookies to ${cookiesPath}`);
  } catch (error) {
    console.error(`❌ Error saving cookies to ${cookiesPath}:`, error.message);
  }
};

/**
 * Chờ user login thủ công với human behavior
 * @param {Object} page - Puppeteer page object
 * @param {number} timeout - Thời gian chờ tối đa (ms)
 */
const waitForManualLogin = async (page, timeout = 300000) => {
  console.log('🔑 Please login manually in the browser...');
  console.log('⏳ Waiting for login completion (checking URL change or specific elements)...');
  
  try {
    // Chờ URL thay đổi hoặc element đặc trưng xuất hiện sau khi login
    await Promise.race([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout }),
      page.waitForSelector('[data-testid="primaryColumn"]', { timeout }), // Threads main feed
      page.waitForFunction(() => window.location.href !== 'https://www.threads.net/', { timeout })
    ]);
    
    console.log('✅ Login detected!');
    return true;
  } catch (error) {
    console.log('⚠️  Login timeout or failed');
    return false;
  }
};

/**
 * Lấy thông tin user từ trang với human behavior
 * @param {Object} page - Puppeteer page object
 * @returns {string} Username hoặc thông báo lỗi
 */
const getUserInfo = async (page) => {
  try {
    // Scroll một chút để load content
    await humanScroll(page, 300, 'down');
    await humanDelay(1000, 2000);
    
    // Thử tìm username trong Threads
    const username = await page.evaluate(() => {
      // Tìm trong các selector có thể chứa username
      const selectors = [
        '[data-testid="primaryColumn"] h1',
        '[role="main"] h1',
        'h1',
        '[data-testid="userDisplayName"]',
        '.x1lliihq .x193iq5w', // Threads specific selectors
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
    console.error('Error getting user info:', error.message);
    return 'Error getting user info';
  }
};

/**
 * Thực hiện các hành động giống người dùng thật
 * @param {Object} page - Puppeteer page object
 * @param {string} profileName - Tên profile
 */
const performHumanActions = async (page, profileName) => {
  console.log('🤖 Performing human-like actions...');
  
  try {
    // Scroll xuống để xem feed
    await humanScroll(page, 800, 'down');
    await humanDelay(2000, 4000);
    
    // Hover vào một số elements
    const hoverSelectors = [
      '[data-testid="post"]',
      '[role="article"]',
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
        '[data-testid="SideNav_AccountSwitcher_Button"]',
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
      console.log('Profile button not found, continuing...');
    }
    
    console.log('✅ Human actions completed');
    
  } catch (error) {
    console.error('Error performing human actions:', error.message);
  }
};

/**
 * Chạy automation cho một profile với human behavior
 * @param {Object} profile - Thông tin profile
 * @param {number} index - Index của profile
 */
const runProfileAutomation = async (profile, index) => {
  console.log(`\n🚀 Starting automation for ${profile.name} (${index + 1}/${profiles.length})`);
  
  let browser = null;
  let page = null;
  
  try {
    // Cấu hình browser launch options
    const launchOptions = {
      headless: false,
      defaultViewport: null,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    };
    
    // Thêm proxy nếu có
    if (profile.proxy) {
      launchOptions.args.push(`--proxy-server=${profile.proxy.server}`);
      console.log(`🔗 Using proxy: ${profile.proxy.server}`);
    }
    
    // Launch browser
    browser = await puppeteer.launch(launchOptions);
    page = await browser.newPage();
    
    // Set user agent giống người thật
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set proxy authentication nếu có
    if (profile.proxy && profile.proxy.username && profile.proxy.password) {
      await page.authenticate({
        username: profile.proxy.username,
        password: profile.proxy.password
      });
    }
    
    // Load cookies
    const cookies = await loadCookies(profile.cookiesPath);
    if (cookies.length > 0) {
      await page.setCookie(...cookies);
      console.log('🍪 Cookies loaded successfully');
    }
    
    // Điều hướng đến Threads với human behavior
    console.log('🌐 Navigating to https://www.threads.net/');
    await page.goto('https://www.threads.net/', { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    // Đợi trang load với delay tự nhiên
    await humanDelay(3000, 5000);
    
    // Kiểm tra xem đã login chưa
    const currentUrl = page.url();
    const isLoggedIn = !currentUrl.includes('/login') && 
                      !currentUrl.includes('/accounts/login') &&
                      currentUrl !== 'https://www.threads.net/';
    
    if (!isLoggedIn) {
      console.log('🔐 Not logged in, waiting for manual login...');
      
      // Tìm và click nút login với human behavior
      try {
        const loginSelectors = [
          'a[href*="login"]',
          'button:contains("Log in")',
          'a:contains("Log in")',
          '[data-testid="login-button"]',
          'button[type="submit"]'
        ];
        
        for (const selector of loginSelectors) {
          try {
            const element = await page.$(selector);
            if (element) {
              await humanClick(page, selector);
              await humanDelay(2000, 4000);
              break;
            }
          } catch (error) {
            // Continue to next selector
          }
        }
      } catch (error) {
        console.log('Login button not found, continuing...');
      }
      
      // Chờ user login thủ công
      const loginSuccess = await waitForManualLogin(page);
      
      if (loginSuccess) {
        // Lưu cookies sau khi login thành công
        const newCookies = await page.cookies();
        await saveCookies(newCookies, profile.cookiesPath);
      } else {
        throw new Error('Login failed or timeout');
      }
    } else {
      console.log('✅ Already logged in');
    }
    
    // Thực hiện hành động chính - lấy thông tin user
    console.log('📊 Getting user information...');
    const userInfo = await getUserInfo(page);
    console.log(`👤 User: ${userInfo}`);
    
    // Thực hiện các hành động giống người dùng thật
    await performHumanActions(page, profile.name);
    
    // Chụp screenshot
    const screenshotPath = `./screenshot_${profile.name}_${Date.now()}.png`;
    await page.screenshot({ 
      path: screenshotPath,
      fullPage: false 
    });
    console.log(`📸 Screenshot saved: ${screenshotPath}`);
    
    // Đợi một chút trước khi đóng
    await humanDelay(2000, 4000);
    
    // Trước khi đóng browser, cập nhật cookies nếu còn đăng nhập
    try {
      const endUrl = page.url();
      const stillLoggedIn = !endUrl.includes('/login') && !endUrl.includes('/accounts/login');
      if (stillLoggedIn) {
        const latestCookies = await page.cookies();
        if (latestCookies && latestCookies.length > 0) {
          // Optional: lưu backup
          const backupPath = `${profile.cookiesPath}.bak`;
          try {
            const current = await fs.readFile(profile.cookiesPath, 'utf8').catch(() => null);
            if (current) await fs.writeFile(backupPath, current);
          } catch {}

          await saveCookies(latestCookies, profile.cookiesPath);
          console.log('🍪 Cookies refreshed on disk');
        }
      } else {
        console.log('ℹ️ Skip saving cookies because session is not authenticated.');
      }
    } catch (e) {
      console.log('Skip cookie refresh due to error:', e.message);
    }
    
    console.log(`✅ Completed automation for ${profile.name}`);
    
  } catch (error) {
    console.error(`❌ Error in ${profile.name}:`, error.message);
  } finally {
    // Đóng browser
    if (browser) {
      await browser.close();
      console.log(`🔒 Browser closed for ${profile.name}`);
    }
  }
};

/**
 * Hàm chính - chạy automation cho tất cả profiles
 */
const runMultiAccountAutomation = async () => {
  console.log('🎯 Starting Multi-Account Threads Automation with Human Behavior');
  // Load cấu hình profiles mỗi lần chạy để đảm bảo cập nhật mới nhất
  profiles = await loadProfilesConfig();
  console.log(`📋 Total profiles: ${profiles.length}`);
  
  for (let i = 0; i < profiles.length; i++) {
    const profile = profiles[i];
    
    try {
      await runProfileAutomation(profile, i);
      
      // Nghỉ giữa các profile để tránh bị detect
      if (i < profiles.length - 1) {
        console.log('⏱️  Waiting 10 seconds before next profile...');
        await humanDelay(10000, 15000);
      }
      
    } catch (error) {
      console.error(`❌ Failed to process ${profile.name}:`, error.message);
      continue; // Tiếp tục với profile tiếp theo
    }
  }
  
  console.log('\n🎉 Multi-account automation completed!');
};

// Chạy automation
if (require.main === module) {
  runMultiAccountAutomation().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  runMultiAccountAutomation,
  runProfileAutomation,
  loadCookies,
  saveCookies,
  profiles,
  loadProfilesConfig
};
