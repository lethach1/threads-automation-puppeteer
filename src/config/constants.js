/**
 * Application Constants
 */

// URLs
export const THREADS_URL = 'https://www.threads.net/';
export const LOGIN_PATH_HINTS = ['/login', '/accounts/login'];

// Default Settings
export const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';
export const DEFAULT_ACCEPT_LANGUAGE = 'vi-VN,vi;q=0.9';

// Browser Settings
export const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--no-first-run',
  '--no-zygote',
  '--lang=vi-VN',
  '--start-maximized',
  '--window-size=1366,768'
];

export const WEBRTC_FLAGS = [
  '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
  '--disable-features=WebRtcHideLocalIpsWithMdns'
];

// Timeouts
export const TIMEOUTS = {
  LOGIN: 30000,
  NAVIGATION: 60000,
  ELEMENT_WAIT: 30000
};

// Delays
export const DELAYS = {
  MIN: 1000,
  MAX: 3000,
  TYPING_MIN: 50,
  TYPING_MAX: 150
};

// Selectors
export const SELECTORS = {
  LOGIN: {
    USERNAME: 'input[name="username"]',
    PASSWORD: 'input[name="password"]',
    SUBMIT: 'button[type="submit"]'
  },
  THREADS: {
    PRIMARY_COLUMN: '[data-testid="primaryColumn"]',
    POST: '[data-testid="post"]',
    ARTICLE: '[role="article"]',
    PROFILE: '[data-testid="SideNav_AccountSwitcher_Button"]'
  }
};
