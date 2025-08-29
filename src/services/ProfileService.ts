import puppeteer, { Browser } from "puppeteer-core";
import fetch from "node-fetch";
import { URLSearchParams } from "url";
import { readdir } from "fs/promises";
import { join } from "path";

export async function startProfile(profilePath: string) {

  // Encode giống như Python - sử dụng encodeURIComponent để encode space thành %20
  const encodedPath = encodeURIComponent(profilePath);
  const serverUrl = `http://localhost:36969/start?path=${encodedPath}&version=128&os=win`;

  try {
    console.log("Calling API:", serverUrl);
    
    // Gọi API start
    const response = await fetch(serverUrl);
    console.log("Response status:", response.status);
    
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }

    const jsonData = await response.json() as { status: string; debuggerAddress?: string };
    console.log("API Response:", jsonData);

    if (jsonData.status === "success") {
      const debuggerAddress = jsonData.debuggerAddress; // ví dụ: "127.0.0.1:9222"
      console.log("Debugger address:", debuggerAddress);

      // Kết nối puppeteer tới Chrome đang chạy
      const browser: Browser = await puppeteer.connect({
        browserURL: `http://${debuggerAddress}`,
        defaultViewport: null,
      });

      console.log("Connected to browser successfully");

      return browser;
    } else {
      console.error("API returned error status:", jsonData);
      return null;
    }
  } catch (err) {
    console.error("Error details:", err);
    return null;
  }
}

/**
 * Lấy danh sách địa chỉ của các profile trong folder profiles
 * @returns {Promise<string[]>} Mảng các đường dẫn profile
 */
export async function getProfilePaths(): Promise<string[]> {
  try {
    const profilesDir = join(process.cwd(), 'profiles');
    const items = await readdir(profilesDir, { withFileTypes: true });
    
    const profilePaths: string[] = [];
    
    for (const item of items) {
      if (item.isDirectory() && item.name.startsWith('profile ')) {
        const fullPath = join(profilesDir, item.name);
        profilePaths.push(fullPath);
      }
    }
    
    return profilePaths;
  } catch (error) {
    console.error('Error reading profiles directory:', error);
    return [];
  }
}

