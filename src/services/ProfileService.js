import fs from 'fs/promises';
import path from 'path';
import { readJsonFileSafe } from '../utils/fileUtils.js';
import { Profile } from '../models/Profile.js';

/**
 * Profile Service - Quản lý profiles
 */
export class ProfileService {
  constructor(baseDir) {
    this.baseDir = baseDir || path.resolve(process.cwd(), 'profiles');
  }

  /**
   * Load tất cả profiles từ thư mục
   * @returns {Promise<Profile[]>}
   */
  async loadProfiles() {
    try {
      const entries = await fs.readdir(this.baseDir, { withFileTypes: true });
      const profileDirs = entries.filter((e) => e.isDirectory());

      const profiles = [];
      for (const dirent of profileDirs) {
        const profile = await this.loadProfile(dirent.name);
        if (profile) {
          profiles.push(profile);
        }
      }

      // Sắp xếp theo tên
      profiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      return profiles;
    } catch (error) {
      return [];
    }
  }

  /**
   * Load một profile cụ thể
   * @param {string} profileName
   * @returns {Promise<Profile|null>}
   */
  async loadProfile(profileName) {
    try {
      const profileDir = path.join(this.baseDir, profileName);
      const cookiesPath = path.join(profileDir, 'cookies.json');
      const proxyPath = path.join(profileDir, 'proxy.json');

      const proxyJson = await readJsonFileSafe(proxyPath);
      const hasValidProxy = proxyJson && typeof proxyJson === 'object' && proxyJson.server;
      const hasCredentials = proxyJson && proxyJson.threads_username && proxyJson.threads_password;

      const profileData = {
        name: profileName,
        cookiesPath,
        proxy: hasValidProxy ? proxyJson : null,
        credentials: hasCredentials ? {
          username: proxyJson.threads_username,
          password: proxyJson.threads_password
        } : null,
        dir: profileDir
      };

      return Profile.fromRawData(profileData);
    } catch (error) {
      return null;
    }
  }

  /**
   * Kiểm tra profile có tồn tại không
   * @param {string} profileName
   * @returns {Promise<boolean>}
   */
  async profileExists(profileName) {
    try {
      const profileDir = path.join(this.baseDir, profileName);
      await fs.access(profileDir);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Tạo profile mới
   * @param {string} profileName
   * @param {object} config
   * @returns {Promise<boolean>}
   */
  async createProfile(profileName, config = {}) {
    try {
      const profileDir = path.join(this.baseDir, profileName);
      await fs.mkdir(profileDir, { recursive: true });

      if (config.proxy) {
        const proxyPath = path.join(profileDir, 'proxy.json');
        await fs.writeFile(proxyPath, JSON.stringify(config.proxy, null, 2));
      }

      return true;
    } catch (error) {
      return false;
    }
  }
}
