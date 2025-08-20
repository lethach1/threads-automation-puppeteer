import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Tìm đường dẫn Chrome thật trên hệ thống
 * @returns {Promise<string|null>}
 */
export const findChromeExecutable = async () => {
  const candidates = [];
  const platform = os.platform();

  if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    const programFiles = process.env['PROGRAMFILES'];
    const programFilesX86 = process.env['PROGRAMFILES(X86)'];

    if (programFiles) {
      candidates.push(
        path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe')
      );
    }
    if (programFilesX86) {
      candidates.push(
        path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe')
      );
    }
    if (localAppData) {
      candidates.push(
        path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe')
      );
    }
  } else if (platform === 'darwin') {
    candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  } else {
    candidates.push(
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium'
    );
  }

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }
  return null;
};

/**
 * Xây dựng đường dẫn user data dir cho profile
 * @param {object} profile
 * @returns {string|undefined}
 */
export const getUserDataDir = (profile) => {
  if (!profile || !profile.dir) return undefined;
  return path.join(profile.dir, 'chrome-profile');
};

/**
 * Kiểm tra URL đã ở trạng thái đăng nhập chưa
 * @param {string} url
 * @param {string[]} loginHints
 * @param {string} baseUrl
 * @returns {boolean}
 */
export const isAuthenticatedUrl = (url, loginHints, baseUrl) => {
  if (!url) return false;
  const isLoginPath = loginHints.some((p) => url.includes(p));
  if (isLoginPath) return false;
  if (url === baseUrl) return false;
  return true;
};
