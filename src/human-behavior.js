/**
 * Human Behavior Simulation Functions
 * Sử dụng thư viện ghost-cursor để mô phỏng hành vi người dùng thật
 */

import { createCursor } from 'ghost-cursor';

/**
 * Tạo delay ngẫu nhiên giống con người
 * @param {number} min - Thời gian tối thiểu (ms)
 * @param {number} max - Thời gian tối đa (ms)
 * @returns {Promise} Promise với delay
 */
export const humanDelay = async (min = 1000, max = 3000) => {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise(resolve => setTimeout(resolve, delay));
};

/**
 * Tạo ghost cursor instance cho page
 * @param {Object} page - Puppeteer page object
 * @returns {Object} Ghost cursor instance
 */
export const createGhostCursor = (page) => {
  return createCursor(page, {
    // Cấu hình để tạo hành vi tự nhiên hơn
    defaultTweenConfig: {
      durationFn: () => Math.random() * 1000 + 500,
      ease: 'easeOutCubic'
    }
  });
};

/**
 * Mô phỏng typing speed của con người với ghost-cursor
 * @param {Object} page - Puppeteer page object
 * @param {string} selector - CSS selector của input field
 * @param {string} text - Text cần type
 * @param {number} minDelay - Delay tối thiểu giữa các ký tự (ms)
 * @param {number} maxDelay - Delay tối đa giữa các ký tự (ms)
 */
export const humanType = async (page, selector, text, minDelay = 50, maxDelay = 150) => {
  const cursor = createGhostCursor(page);
  
  // Click vào element với ghost cursor
  await cursor.click(selector);
  await humanDelay(200, 500);
  
  // Type text với tốc độ người thật
  await cursor.type(text, {
    delay: Math.random() * (maxDelay - minDelay) + minDelay
  });
  
  // Thỉnh thoảng dừng lâu hơn (như người suy nghĩ)
  if (Math.random() < 0.1) {
    await humanDelay(500, 1500);
  }
};

/**
 * Mô phỏng mouse movement tự nhiên với ghost-cursor
 * @param {Object} page - Puppeteer page object
 * @param {string} selector - CSS selector của element
 * @param {Object} options - Options cho movement
 */
export const humanMouseMove = async (page, selector, options = {}) => {
  const cursor = createGhostCursor(page);
  await cursor.move(selector, options);
};

/**
 * Mô phỏng click tự nhiên với ghost-cursor
 * @param {Object} page - Puppeteer page object
 * @param {string} selector - CSS selector của element
 * @param {Object} options - Options cho click
 */
export const humanClick = async (page, selector, options = {}) => {
  const cursor = createGhostCursor(page);
  await cursor.click(selector, options);
  
  // Delay sau khi click
  await humanDelay(200, 800);
};

/**
 * Mô phỏng scroll tự nhiên
 * @param {Object} page - Puppeteer page object
 * @param {number} distance - Khoảng cách scroll (px)
 * @param {string} direction - Hướng scroll ('up' hoặc 'down')
 */
export const humanScroll = async (page, distance = 500, direction = 'down') => {
  const steps = Math.floor(Math.random() * 20) + 10;
  const stepDistance = distance / steps;
  
  for (let i = 0; i < steps; i++) {
    const scrollAmount = stepDistance + (Math.random() - 0.5) * 20;
    
    if (direction === 'down') {
      await page.evaluate((amount) => window.scrollBy(0, amount), scrollAmount);
    } else {
      await page.evaluate((amount) => window.scrollBy(0, -amount), scrollAmount);
    }
    
    // Delay ngẫu nhiên giữa các bước scroll
    await humanDelay(50, 200);
    
    // Thỉnh thoảng dừng lâu hơn
    if (Math.random() < 0.2) {
      await humanDelay(500, 1500);
    }
  }
};

/**
 * Mô phỏng hover tự nhiên với ghost-cursor
 * @param {Object} page - Puppeteer page object
 * @param {string} selector - CSS selector của element
 * @param {number} duration - Thời gian hover (ms)
 */
export const humanHover = async (page, selector, duration = 2000) => {
  const cursor = createGhostCursor(page);
  await cursor.move(selector);
  await humanDelay(duration * 0.8, duration * 1.2);
};

/**
 * Mô phỏng scroll đến element
 * @param {Object} page - Puppeteer page object
 * @param {string} selector - CSS selector của element
 * @param {Object} options - Options cho scroll
 */
export const humanScrollToElement = async (page, selector, options = {}) => {
  const element = await page.$(selector);
  if (!element) return;
  
  await element.scrollIntoView();
  
  // Thêm offset ngẫu nhiên
  const offset = Math.floor(Math.random() * 100) + 50;
  await page.evaluate((offset) => window.scrollBy(0, -offset), offset);
  
  await humanDelay(500, 1500);
};

/**
 * Mô phỏng swipe gesture với ghost-cursor
 * @param {Object} page - Puppeteer page object
 * @param {string} direction - Hướng swipe ('left', 'right', 'up', 'down')
 * @param {number} distance - Khoảng cách swipe (px)
 */
const humanSwipe = async (page, direction = 'left', distance = 200) => {
  const cursor = createGhostCursor(page);
  const viewport = await page.viewport();
  const centerX = viewport.width / 2;
  const centerY = viewport.height / 2;
  
  let startX, startY, endX, endY;
  
  switch (direction) {
    case 'left':
      startX = centerX + distance / 2;
      startY = centerY;
      endX = centerX - distance / 2;
      endY = centerY;
      break;
    case 'right':
      startX = centerX - distance / 2;
      startY = centerY;
      endX = centerX + distance / 2;
      endY = centerY;
      break;
    case 'up':
      startX = centerX;
      startY = centerY + distance / 2;
      endX = centerX;
      endY = centerY - distance / 2;
      break;
    case 'down':
      startX = centerX;
      startY = centerY - distance / 2;
      endX = centerX;
      endY = centerY + distance / 2;
      break;
  }
  
  // Thêm độ lệch ngẫu nhiên
  startX += (Math.random() - 0.5) * 50;
  startY += (Math.random() - 0.5) * 50;
  endX += (Math.random() - 0.5) * 50;
  endY += (Math.random() - 0.5) * 50;
  
  // Sử dụng ghost cursor để swipe
  await cursor.move({ x: startX, y: startY });
  await humanDelay(100, 300);
  await cursor.move({ x: endX, y: endY });
  await humanDelay(200, 500);
};

/**
 * Mô phỏng double click với ghost-cursor
 * @param {Object} page - Puppeteer page object
 * @param {string} selector - CSS selector của element
 */
const humanDoubleClick = async (page, selector) => {
  const cursor = createGhostCursor(page);
  await cursor.click(selector);
  await humanDelay(50, 150);
  await cursor.click(selector);
  await humanDelay(300, 800);
};

/**
 * Mô phỏng right click với ghost-cursor
 * @param {Object} page - Puppeteer page object
 * @param {string} selector - CSS selector của element
 */
const humanRightClick = async (page, selector) => {
  const cursor = createGhostCursor(page);
  await cursor.click(selector, { button: 'right' });
  await humanDelay(200, 500);
};

/**
 * Mô phỏng drag and drop với ghost-cursor
 * @param {Object} page - Puppeteer page object
 * @param {string} sourceSelector - CSS selector của element nguồn
 * @param {string} targetSelector - CSS selector của element đích
 */
const humanDragAndDrop = async (page, sourceSelector, targetSelector) => {
  const cursor = createGhostCursor(page);
  
  // Sử dụng ghost cursor để drag and drop
  await cursor.drag(sourceSelector, targetSelector);
  await humanDelay(300, 800);
};

/**
 * Mô phỏng zoom in/out
 * @param {Object} page - Puppeteer page object
 * @param {string} direction - Hướng zoom ('in' hoặc 'out')
 * @param {number} steps - Số bước zoom
 */
const humanZoom = async (page, direction = 'in', steps = 3) => {
  const viewport = await page.viewport();
  const centerX = viewport.width / 2;
  const centerY = viewport.height / 2;
  
  for (let i = 0; i < steps; i++) {
    if (direction === 'in') {
      await page.mouse.wheel({ deltaY: -100 });
    } else {
      await page.mouse.wheel({ deltaY: 100 });
    }
    
    await humanDelay(200, 500);
  }
};

/**
 * Mô phỏng refresh page tự nhiên
 * @param {Object} page - Puppeteer page object
 */
const humanRefresh = async (page) => {
  // Sử dụng F5 thay vì Ctrl+R để tự nhiên hơn
  await page.keyboard.press('F5');
  await humanDelay(2000, 4000);
};

/**
 * Mô phỏng navigation tự nhiên với ghost-cursor
 * @param {Object} page - Puppeteer page object
 * @param {string} url - URL cần navigate
 */
const humanNavigate = async (page, url) => {
  const cursor = createGhostCursor(page);
  
  // Click vào address bar
  await page.keyboard.down('Control');
  await page.keyboard.press('L');
  await page.keyboard.up('Control');
  await humanDelay(200, 500);
  
  // Type URL với ghost cursor
  await cursor.type(url, {
    delay: Math.random() * 70 + 30
  });
  await humanDelay(300, 800);
  
  // Press Enter
  await page.keyboard.press('Enter');
  await humanDelay(2000, 4000);
};

/**
 * Mô phỏng tab switching
 * @param {Object} page - Puppeteer page object
 * @param {number} tabIndex - Index của tab (0-based)
 */
const humanSwitchTab = async (page, tabIndex) => {
  const pages = await page.browser().pages();
  if (tabIndex < pages.length) {
    await pages[tabIndex].bringToFront();
    await humanDelay(500, 1500);
  }
};

/**
 * Mô phỏng copy/paste
 * @param {Object} page - Puppeteer page object
 * @param {string} selector - CSS selector của element
 * @param {string} text - Text cần paste
 */
const humanCopyPaste = async (page, selector, text) => {
  const cursor = createGhostCursor(page);
  
  // Click vào element
  await cursor.click(selector);
  await humanDelay(200, 500);
  
  // Select all
  await page.keyboard.down('Control');
  await page.keyboard.press('A');
  await page.keyboard.up('Control');
  await humanDelay(100, 300);
  
  // Paste
  await page.keyboard.down('Control');
  await page.keyboard.press('V');
  await page.keyboard.up('Control');
  await humanDelay(200, 500);
};

/**
 * Mô phỏng undo/redo
 * @param {Object} page - Puppeteer page object
 * @param {string} action - 'undo' hoặc 'redo'
 */
const humanUndoRedo = async (page, action = 'undo') => {
  await page.keyboard.down('Control');
  if (action === 'undo') {
    await page.keyboard.press('Z');
  } else {
    await page.keyboard.press('Y');
  }
  await page.keyboard.up('Control');
  await humanDelay(200, 500);
};

/**
 * Mô phỏng random mouse movement (để tạo hành vi tự nhiên hơn)
 * @param {Object} page - Puppeteer page object
 * @param {number} duration - Thời gian di chuyển (ms)
 */
const humanRandomMouseMovement = async (page, duration = 3000) => {
  const cursor = createGhostCursor(page);
  const viewport = await page.viewport();
  
  const startTime = Date.now();
  const endTime = startTime + duration;
  
  while (Date.now() < endTime) {
    const x = Math.random() * viewport.width;
    const y = Math.random() * viewport.height;
    
    await cursor.move({ x, y });
    await humanDelay(100, 300);
  }
};

/**
 * Mô phỏng click với random offset
 * @param {Object} page - Puppeteer page object
 * @param {string} selector - CSS selector của element
 * @param {Object} options - Options cho click
 */
const humanClickWithOffset = async (page, selector, options = {}) => {
  const cursor = createGhostCursor(page);
  const element = await page.$(selector);
  
  if (!element) return;
  
  const box = await element.boundingBox();
  if (!box) return;
  
  // Tạo offset ngẫu nhiên
  const offsetX = (Math.random() - 0.5) * 20;
  const offsetY = (Math.random() - 0.5) * 20;
  
  const clickX = box.x + box.width / 2 + offsetX;
  const clickY = box.y + box.height / 2 + offsetY;
  
  await cursor.click({ x: clickX, y: clickY }, options);
  await humanDelay(200, 800);
};

/**
 * Mô phỏng type với mistakes và corrections
 * @param {Object} page - Puppeteer page object
 * @param {string} xpath - XPath của input field
 * @param {string} text - Text cần type
 * @param {number} mistakeRate - Tỷ lệ gõ sai (0-1)
 */
const humanTypeWithMistakes = async (page, xpath, text, mistakeRate = 0.08) => {
  const cursor = createGhostCursor(page);
  
  // Tìm element theo XPath và click trực tiếp
  const [element] = await page.$x(xpath);
  await cursor.click(element);
  await humanDelay(200, 500);
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    // Thỉnh thoảng gõ sai
    if (Math.random() < mistakeRate) {
      const wrongChar = String.fromCharCode(char.charCodeAt(0) + 1);
      await cursor.type(wrongChar);
      await humanDelay(100, 300);
      
      // Xóa ký tự sai
      await page.keyboard.press('Backspace');
      await humanDelay(200, 500);
    }
    
    // Gõ ký tự đúng
    await cursor.type(char);
    await humanDelay(50, 150);
    
    // Thỉnh thoảng dừng lâu hơn
    if (Math.random() < 0.1) {
      await humanDelay(500, 1500);
    }
  }
};

// Export tất cả functions đã được export ở trên
export {
  humanSwipe,
  humanDoubleClick,
  humanRightClick,
  humanDragAndDrop,
  humanZoom,
  humanRefresh,
  humanNavigate,
  humanSwitchTab,
  humanCopyPaste,
  humanUndoRedo,
  humanRandomMouseMovement,
  humanClickWithOffset,
  humanTypeWithMistakes
};
