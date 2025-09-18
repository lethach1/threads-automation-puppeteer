"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args) {
    const [channel, listener] = args;
    return electron.ipcRenderer.on(channel, (event, ...args2) => listener(event, ...args2));
  },
  off(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.off(channel, ...omit);
  },
  send(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.send(channel, ...omit);
  },
  invoke(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.invoke(channel, ...omit);
  }
  // You can expose other APTs you need here.
  // ...
});
electron.contextBridge.exposeInMainWorld("api", {
  selectDirectory: async () => {
    try {
      const dir = await electron.ipcRenderer.invoke("select-directory");
      return typeof dir === "string" ? dir : "";
    } catch {
      return "";
    }
  }
});
electron.contextBridge.exposeInMainWorld("automationApi", {
  runOpenProfiles: async (payload) => {
    try {
      return await electron.ipcRenderer.invoke("run-open-profiles", payload);
    } catch (error) {
      return {
        success: false,
        error: (error == null ? void 0 : error.message) || "Unknown error"
      };
    }
  },
  runAutomationForProfile: async (payload) => {
    try {
      return await electron.ipcRenderer.invoke("run-automation-for-profile", payload);
    } catch (error) {
      return { success: false, error: (error == null ? void 0 : error.message) || "Unknown error" };
    }
  },
  closeProfile: async (profileId) => {
    try {
      return await electron.ipcRenderer.invoke("close-profile", profileId);
    } catch (error) {
      return { success: false, error: (error == null ? void 0 : error.message) || "Unknown error" };
    }
  }
});
