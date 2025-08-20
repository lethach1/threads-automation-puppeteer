import fs from 'fs/promises';
import path from 'path';

/**
 * Đọc JSON an toàn (trả về null nếu file không tồn tại/invalid)
 * @param {string} targetPath
 * @returns {Promise<object|null>}
 */
export const readJsonFileSafe = async (targetPath) => {
  try {
    const raw = await fs.readFile(targetPath, 'utf8');
    if (!raw || !raw.trim()) return null;
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
};

/**
 * Lưu JSON an toàn
 * @param {string} filePath
 * @param {object} data
 * @returns {Promise<boolean>}
 */
export const saveJsonFileSafe = async (filePath, data) => {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Tạo backup file
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
export const createBackup = async (filePath) => {
  try {
    const current = await fs.readFile(filePath, 'utf8').catch(() => null);
    if (current) {
      const backupPath = `${filePath}.bak`;
      await fs.writeFile(backupPath, current);
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
};

/**
 * Kiểm tra file tồn tại
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
export const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

/**
 * Tạo thư mục nếu chưa tồn tại
 * @param {string} dirPath
 * @returns {Promise<void>}
 */
export const ensureDirectoryExists = async (dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
};
