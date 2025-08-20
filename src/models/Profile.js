/**
 * Profile Model
 */
export class Profile {
  constructor(data) {
    this.name = data.name;
    this.cookiesPath = data.cookiesPath;
    this.proxy = data.proxy || null;
    this.credentials = data.credentials || null;
    this.dir = data.dir;
  }

  /**
   * Kiểm tra có proxy hợp lệ không
   */
  hasValidProxy() {
    return this.proxy && typeof this.proxy === 'object' && this.proxy.server;
  }

  /**
   * Kiểm tra có credentials không
   */
  hasCredentials() {
    return this.credentials && this.credentials.username && this.credentials.password;
  }

  /**
   * Lấy proxy server
   */
  getProxyServer() {
    return this.hasValidProxy() ? this.proxy.server : null;
  }

  /**
   * Lấy proxy authentication
   */
  getProxyAuth() {
    if (!this.hasValidProxy()) return null;
    if (!this.proxy.username || !this.proxy.password) return null;
    
    return {
      username: this.proxy.username,
      password: this.proxy.password
    };
  }

  /**
   * Lấy geolocation settings
   */
  getGeolocation() {
    if (!this.hasValidProxy()) return null;
    if (typeof this.proxy.latitude !== 'number' || typeof this.proxy.longitude !== 'number') {
      return null;
    }

    return {
      latitude: this.proxy.latitude,
      longitude: this.proxy.longitude,
      accuracy: typeof this.proxy.accuracy === 'number' ? this.proxy.accuracy : 15
    };
  }

  /**
   * Lấy language settings
   */
  getLanguage() {
    if (this.hasValidProxy() && this.proxy.lang) {
      return this.proxy.lang;
    }
    return null;
  }

  /**
   * Lấy timezone settings
   */
  getTimezone() {
    if (this.hasValidProxy() && this.proxy.timezone) {
      return this.proxy.timezone;
    }
    return null;
  }

  /**
   * Tạo từ raw data
   */
  static fromRawData(rawData) {
    return new Profile(rawData);
  }
}
