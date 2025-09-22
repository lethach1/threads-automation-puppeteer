import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";
const require2 = createRequire(import.meta.url);
const puppeteer = require2("puppeteer-core");
process.env.WS_NO_BUFFER_UTIL = "1";
process.env.WS_NO_UTF_8_VALIDATE = "1";
const OPEN_PROFILE_API = "http://127.0.0.1:5424/api/open-profile";
const sessions = /* @__PURE__ */ new Map();
async function openOneProfileAndConnect(profileId, options) {
  const res = await fetch(OPEN_PROFILE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profileId, options })
  });
  if (!res.ok) throw new Error(`bad status ${res.status}`);
  const data = await res.json();
  if (!data || data.success !== true || !("wsUrl" in data) || !data.wsUrl) {
    throw new Error((data == null ? void 0 : data.error) || "open failed / missing wsUrl");
  }
  const browser = await puppeteer.connect({ browserWSEndpoint: data.wsUrl, defaultViewport: null });
  sessions.set(profileId, { wsUrl: data.wsUrl, browser });
  console.log("[sessionManager] connected puppeteer for", profileId, data.wsUrl);
  return { profileId };
}
async function openProfilesWithConcurrency(profileIds, options, concurrency) {
  const limit = Math.max(1, Math.min(concurrency, profileIds.length));
  const results = [];
  let cursor = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (cursor < profileIds.length) {
      const index = cursor++;
      const id = profileIds[index];
      try {
        const r = await openOneProfileAndConnect(id, options);
        results.push(r);
      } catch (e) {
        console.error("open/connect failed", id, e);
      }
    }
  });
  await Promise.all(workers);
  return results;
}
async function closeProfile(profileId) {
  const s = sessions.get(profileId);
  if (!s) return false;
  await s.browser.close().catch(() => {
  });
  sessions.delete(profileId);
  return true;
}
async function withPage(profileId, fn) {
  const s = sessions.get(profileId);
  if (!s) throw new Error("session not found");
  console.log("[sessionManager] creating new page for", profileId);
  const page = await s.browser.newPage();
  try {
    console.log("[sessionManager] running page task for", profileId);
    return await fn(page);
  } finally {
    console.log("[sessionManager] closing page for", profileId);
    await page.close().catch(() => {
    });
  }
}
process.env.WS_NO_BUFFER_UTIL = "1";
process.env.WS_NO_UTF_8_VALIDATE = "1";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 1e3,
    minHeight: 700,
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs")
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(createWindow);
ipcMain.handle("select-directory", async () => {
  const result = await dialog.showOpenDialog({
    title: "Select a directory",
    properties: ["openDirectory"]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return "";
  }
  return result.filePaths[0];
});
ipcMain.handle("select-file", async () => {
  const result = await dialog.showOpenDialog({
    title: "Select a CSV file",
    properties: ["openFile"],
    filters: [
      { name: "CSV Files", extensions: ["csv"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return "";
  }
  return result.filePaths[0];
});
ipcMain.handle("parse-csv", async (_event, filePath) => {
  try {
    const fs = await import("fs");
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const lines = fileContent.split("\n").filter((line) => line.trim());
    if (lines.length === 0) {
      return { headers: [], rows: [], totalRows: 0 };
    }
    const parseCsvLine = (line) => {
      const result = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };
    const headers = parseCsvLine(lines[0]);
    const rows = lines.slice(1).map((line) => {
      const values = parseCsvLine(line);
      const row = {};
      headers.forEach((header, i) => {
        row[header] = values[i] || "";
      });
      return row;
    });
    return { headers, rows, totalRows: rows.length };
  } catch (error) {
    console.error("❌ Failed to parse CSV:", error);
    throw error;
  }
});
ipcMain.handle("run-open-profiles", async (_event, payload) => {
  try {
    console.log("[ipc] run-open-profiles called with", payload);
    const { profileIds, windowWidth, windowHeight, scalePercent, concurrency } = payload;
    if (!Array.isArray(profileIds) || profileIds.length === 0) {
      return {
        success: false,
        error: "profileIds is required and must be a non-empty array"
      };
    }
    const options = {
      windowWidth: Number(windowWidth) || 800,
      windowHeight: Number(windowHeight) || 600,
      scalePercent: Number(scalePercent) || 100
    };
    const concurrencyLimit = Math.max(1, Math.floor(Number(concurrency) || 1));
    const opened = await openProfilesWithConcurrency(profileIds, options, concurrencyLimit);
    console.log("[ipc] run-open-profiles opened:", opened);
    return { success: true, opened };
  } catch (error) {
    console.error("Error in run-open-profiles:", error);
    return {
      success: false,
      error: (error == null ? void 0 : error.message) || "Unknown error"
    };
  }
});
ipcMain.handle("close-profile", async (_event, profileId) => {
  try {
    const ok = await closeProfile(profileId);
    if (!ok) return { success: false, error: "session not found" };
    return { success: true };
  } catch (error) {
    return { success: false, error: (error == null ? void 0 : error.message) || "Unknown error" };
  }
});
ipcMain.handle("run-automation-for-profile", async (_event, payload) => {
  try {
    const { profileId, scenario, input } = payload || {};
    console.log("[ipc] run-automation-for-profile for", profileId);
    if (!profileId) return { success: false, error: "profileId is required" };
    const { runAutomationOnPage } = await import("./ThreadsAutomationController-CmyjzCd5.js");
    console.log("[ipc] scenario:", scenario, "input keys:", input ? Object.keys(input) : []);
    await withPage(profileId, async (page) => {
      const result = await runAutomationOnPage(page, { scenario, input });
      if (!(result == null ? void 0 : result.success)) throw new Error((result == null ? void 0 : result.error) || "Scenario failed");
    });
    console.log("[ipc] automation finished for", profileId);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error == null ? void 0 : error.message) || "Unknown error" };
  }
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
