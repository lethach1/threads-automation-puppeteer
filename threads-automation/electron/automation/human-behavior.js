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
export const humanType = async (page, selector, text, minDelay = 100, maxDelay = 300) => {
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
 * @param {Object} elementHandle - ElementHandle của element cần click
 */
export const humanClick = async (page, selectorOrElement) => {
  let handle = selectorOrElement
  if (typeof selectorOrElement === 'string') {
    const selector = selectorOrElement
    await page.waitForSelector(selector, { visible: true, timeout: 10000 })
    handle = await page.$(selector)
  }
  if (!handle) {
    throw new Error('Element handle is required for humanClick')
  }
  try {
    await handle.evaluate((el) => {
      el.scrollIntoView({ block: 'center', inline: 'center' })
    })
  } catch {}
  // Use ghost-cursor for natural movement and click
  const cursor = createGhostCursor(page)
  try {
    await cursor.move(handle)
  } catch {}
  await humanDelay(120, 280)
  await cursor.click(handle)
  await humanDelay(1000, 2000)
};


/**
 * Mô phỏng scroll tự nhiên
 * @param {Object} page - Puppeteer page object
 * @param {number} distance - Khoảng cách scroll (px)
 * @param {string} direction - Hướng scroll ('up' hoặc 'down')
 */
export const humanScroll = async (page, distance = 500, direction = 'down') => {
  // Số bước và easing để mô phỏng tăng/giảm tốc (ease-in-out)
  const steps = Math.floor(Math.random() * 20) + 12;
  const baseStep = distance / steps;
  let remaining = distance;

  for (let i = 0; i < steps; i++) {
    const t = steps <= 1 ? 1 : i / (steps - 1);
    // Easing S-curve: nhanh ở giữa, chậm ở đầu/cuối
    const ease = 0.5 - 0.5 * Math.cos(Math.PI * t); // easeInOutSine [0..1]

    // Lượng scroll cho bước này: nền + điều chỉnh theo tốc độ + nhiễu nhỏ
    const factor = 0.7 + 0.8 * ease; // ~0.7..1.5
    let scrollAmount = baseStep * factor + (Math.random() - 0.5) * 15;

    // Không vượt quá phần còn lại, và giữ > 1px
    scrollAmount = Math.max(1, Math.min(scrollAmount, remaining));
    remaining -= scrollAmount;

    const signedAmount = direction === 'down' ? scrollAmount : -scrollAmount;
    await page.evaluate((amount) => window.scrollBy(0, amount), signedAmount);

    // Delay lớn hơn ở đầu/cuối, nhỏ hơn ở giữa (ngược với ease)
    const baseDelayMs = 80 + (1 - ease) * 220; // ~80..300ms
    const jitterMs = Math.random() * 80;
    await humanDelay(baseDelayMs, baseDelayMs + jitterMs);

    // Thỉnh thoảng dừng lâu hơn (mô phỏng dừng đọc ngắn)
    if (Math.random() < 0.18) {
      await humanDelay(500, 1500);
    }
  }
};

/**
 * Lướt newsfeed tự nhiên (auto scroll) với hành vi giống người thật
 * - Scroll theo quãng ngẫu nhiên, có tạm dừng và thi thoảng kéo ngược lại
 * - Có thể dừng theo điều kiện selector hoặc hết thời gian
 * @param {Object} page - Puppeteer page object
 * @param {Object} options - Tùy chọn hành vi
 * @param {number} options.maxScrolls - Số lần scroll tối đa
 * @param {number} options.minDistance - Quãng scroll tối thiểu mỗi lượt (px)
 * @param {number} options.maxDistance - Quãng scroll tối đa mỗi lượt (px)
 * @param {number} options.pauseChance - Xác suất tạm dừng lâu giữa các lượt (0-1)
 * @param {number} options.minPauseMs - Thời gian tạm dừng tối thiểu (ms)
 * @param {number} options.maxPauseMs - Thời gian tạm dừng tối đa (ms)
 * @param {number} options.occasionalUpChance - Xác suất kéo ngược lên nhẹ (0-1)
 * @param {string} options.stopOnSelector - Selector để dừng khi thấy (tùy chọn)
 * @param {number} options.timeoutMs - Tổng thời gian tối đa cho toàn bộ quá trình (tùy chọn)
 */
const humanAutoScrollFeed = async (page, options = {}) => {
  const {
    maxScrolls = 30,
    minDistance = 600,
    maxDistance = 1600,
    pauseChance = 0.25,
    minPauseMs = 1200,
    maxPauseMs = 4000,
    occasionalUpChance = 0.1,
    stopOnSelector,
    timeoutMs
  } = options;

  const startTime = Date.now();

  for (let i = 0; i < maxScrolls; i++) {
    if (timeoutMs && Date.now() - startTime > timeoutMs) break;

    if (stopOnSelector) {
      const found = await page.$(stopOnSelector);
      if (found) break;
    }

    const distance = Math.floor(Math.random() * (maxDistance - minDistance + 1)) + minDistance;
    await humanScroll(page, distance, 'down');

    // Thi thoảng kéo ngược lại một đoạn ngắn (như xem lại nội dung phía trên)
    if (Math.random() < occasionalUpChance) {
      const upDistance = Math.floor(distance * (0.2 + Math.random() * 0.3));
      await humanScroll(page, upDistance, 'up');
    }

    // Tạm dừng tự nhiên giữa các lần kéo
    if (Math.random() < pauseChance) {
      await humanDelay(minPauseMs, maxPauseMs);
    } else {
      await humanDelay(200, 800);
    }
  }
};

/**
 * Lướt newsfeed cho đến khi thấy element mong muốn rồi click
 * - Tự động kéo xuống theo quãng ngẫu nhiên và tạm dừng tự nhiên
 * - Khi thấy selector: scroll vào giữa viewport rồi click (hoặc click child selector)
 * @param {Object} page - Puppeteer page object
 * @param {string} targetSelector - Selector của phần tử cần tìm
 * @param {Object} options - Tùy chọn hành vi
 * @param {number} options.maxScrolls - Số lần scroll tối đa trước khi bỏ cuộc
 * @param {number} options.minDistance - Quãng scroll tối thiểu mỗi lượt (px)
 * @param {number} options.maxDistance - Quãng scroll tối đa mỗi lượt (px)
 * @param {number} options.pauseChance - Xác suất tạm dừng lâu giữa các lượt (0-1)
 * @param {number} options.minPauseMs - Thời gian tạm dừng tối thiểu (ms)
 * @param {number} options.maxPauseMs - Thời gian tạm dừng tối đa (ms)
 * @param {number} options.occasionalUpChance - Xác suất kéo ngược lên nhẹ (0-1)
 * @param {string} options.clickSelectorWithin - Selector con để click bên trong phần tử tìm thấy (VD: nút comment)
 * @param {number} options.timeoutMs - Tổng thời gian tối đa cho toàn bộ quá trình
 * @returns {Promise<boolean>} true nếu đã click thành công, false nếu không tìm thấy
 */
const humanScrollFeedUntilAndClick = async (page, targetSelector, options = {}) => {
  const {
    maxScrolls = 40,
    minDistance = 600,
    maxDistance = 1600,
    pauseChance = 0.25,
    minPauseMs = 1200,
    maxPauseMs = 4000,
    occasionalUpChance = 0.1,
    clickSelectorWithin,
    timeoutMs
  } = options;

  const startTime = Date.now();
  const cursor = createGhostCursor(page);

  const tryFocusAndClick = async () => {
    const handle = await page.$(targetSelector);
    if (!handle) return false;
    try {
      await handle.evaluate((el) => {
        el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' });
      });
    } catch {}
    await humanDelay(300, 700);

    if (clickSelectorWithin) {
      const inner = await handle.$(clickSelectorWithin);
      if (inner) {
        await cursor.move(inner);
        await humanDelay(120, 280);
        await cursor.click(inner);
        return true;
      }
    }

    await cursor.move(handle);
    await humanDelay(120, 280);
    await cursor.click(handle);
    return true;
  };

  // Thử ngay lần đầu nếu đã có sẵn trong viewport/DOM
  if (await tryFocusAndClick()) return true;

  for (let i = 0; i < maxScrolls; i++) {
    if (timeoutMs && Date.now() - startTime > timeoutMs) break;

    const distance = Math.floor(Math.random() * (maxDistance - minDistance + 1)) + minDistance;
    await humanScroll(page, distance, 'down');

    if (await tryFocusAndClick()) return true;

    if (Math.random() < occasionalUpChance) {
      const upDistance = Math.floor(distance * (0.2 + Math.random() * 0.3));
      await humanScroll(page, upDistance, 'up');
      if (await tryFocusAndClick()) return true;
    }

    if (Math.random() < pauseChance) {
      await humanDelay(minPauseMs, maxPauseMs);
    } else {
      await humanDelay(200, 800);
    }
  }

  return false;
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
 * @param {string|Object} selectorOrElement - CSS selector hoặc ElementHandle
 * @param {Object} options - Options cho scroll
 */
export const humanScrollToElement = async (page, selectorOrElement, options = {}) => {
  let element;
  
  // Handle both selector string and ElementHandle
  if (typeof selectorOrElement === 'string') {
    element = await page.$(selectorOrElement);
  } else {
    element = selectorOrElement; // Assume it's already an ElementHandle
  }
  
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
 * Mô phỏng type với mistakes và corrections (dùng ElementHandle)
 * @param {Object} page - Puppeteer page object
 * @param {Object} elementHandle - ElementHandle của input/textarea cần type
 * @param {string} text - Text cần type
 * @param {number} mistakeRate - Tỷ lệ gõ sai (0-1)
 */
const humanTypeWithMistakes = async (page, selectorOrElement, text, mistakeRate = 0.05) => {
  let elementHandle = selectorOrElement
  if (typeof selectorOrElement === 'string') {
    const selector = selectorOrElement
    await page.waitForSelector(selector, { visible: true, timeout: 10000 })
    elementHandle = await page.$(selector)
  }
  if (!elementHandle) {
    throw new Error('Element handle is required for humanTypeWithMistakes')
  }

  // Scroll element into view and focus it, then click via helper
  try {
    await elementHandle.evaluate((el) => {
      el.scrollIntoView({ block: 'center', inline: 'center' })
    })
  } catch {}

  // Move cursor away from any hover areas first
  try {
    await page.mouse.move(100, 100)
    await humanDelay(100, 200)
  } catch {}

  await humanClick(page, elementHandle)
  await humanDelay(150, 300)

  // Ensure element is focused and ready for typing
  await elementHandle.focus()
  await humanDelay(120, 240)

  // Iterate by code units but group surrogate pairs (emojis) as one token
  for (let i = 0; i < text.length; i++) {
    let token = text[i]
    const code = token.charCodeAt(0)
    const isHighSurrogate = code >= 0xD800 && code <= 0xDBFF
    const next = text[i + 1]
    const nextCode = next ? next.charCodeAt(0) : 0
    const isLowSurrogate = nextCode >= 0xDC00 && nextCode <= 0xDFFF
    if (isHighSurrogate && isLowSurrogate) {
      token = token + next
      i += 1 // consume the pair as one unit
    }

    // Thỉnh thoảng gõ sai (tạo lỗi thực tế hơn)
    if (Math.random() < mistakeRate) {
      // Tạo lỗi gõ thực tế hơn: gõ ký tự gần đó trên bàn phím
      const wrongChars = getNearbyKeys(token)
      let wrongChar = wrongChars[Math.floor(Math.random() * wrongChars.length)]
      // Ensure wrongChar differs from intended char (handles diacritics, punctuation, space)
      if (wrongChar === token) {
        const fallbackLetters = 'qwertyuiopasdfghjklzxcvbnm'
        const pick = fallbackLetters[Math.floor(Math.random() * fallbackLetters.length)]
        const isUpper = /[A-Z]/.test(token)
        wrongChar = isUpper ? pick.toUpperCase() : pick
      }
      
      await page.keyboard.type(wrongChar)
      await humanDelay(1200, 2000)

      // Xóa ký tự sai
      await page.keyboard.press('Backspace')
      await humanDelay(1200, 2000)
    }

    // Gõ ký tự đúng với delay tự nhiên
    await page.keyboard.type(token)
    await humanDelay(70, 120)

    // Thỉnh thoảng dừng lâu hơn (như người suy nghĩ)
    if (Math.random() < 0.03) {
      await humanDelay(1500, 3000)
    }
  }
  
  // Final delay to ensure all typing is complete
  await humanDelay(2000, 3500)
};

// Helper function để tạo lỗi gõ thực tế hơn
const getNearbyKeys = (char) => {
  const keyMap = {
    'a': ['s', 'q', 'w'], 'b': ['v', 'g', 'n'], 'c': ['x', 'd', 'v'], 'd': ['s', 'e', 'f', 'c'],
    'e': ['w', 'r', 'd'], 'f': ['d', 'r', 'g', 'v'], 'g': ['f', 't', 'h', 'b'], 'h': ['g', 'y', 'j', 'n'],
    'i': ['u', 'o', 'k'], 'j': ['h', 'u', 'k'], 'k': ['j', 'i', 'l'], 'l': ['k', 'o', 'p'],
    'm': ['n', 'j', 'k'], 'n': ['b', 'h', 'j', 'm'], 'o': ['i', 'p', 'l'], 'p': ['o', 'l'],
    'q': ['w', 'a'], 'r': ['e', 't', 'f'], 's': ['a', 'd', 'w', 'x'], 't': ['r', 'y', 'g'],
    'u': ['y', 'i', 'j'], 'v': ['c', 'f', 'b'], 'w': ['q', 'e', 's'], 'x': ['z', 's', 'c'],
    'y': ['t', 'u', 'h'], 'z': ['x', 'a'], ' ': [' ']
  }
  
  const lowerChar = char.toLowerCase()
  return keyMap[lowerChar] || [char]
}

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
  humanTypeWithMistakes,
  humanAutoScrollFeed,
  humanScrollFeedUntilAndClick
};
