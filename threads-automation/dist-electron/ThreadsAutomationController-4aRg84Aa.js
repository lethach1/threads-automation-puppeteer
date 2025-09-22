const __variableDynamicImportRuntimeHelper = (glob, path, segs) => {
  const v = glob[path];
  if (v) {
    return typeof v === "function" ? v() : Promise.resolve(v);
  }
  return new Promise((_, reject) => {
    (typeof queueMicrotask === "function" ? queueMicrotask : setTimeout)(
      reject.bind(
        null,
        new Error(
          "Unknown variable dynamic import: " + path + (path.split("/").length !== segs ? ". Note that variables only represent file names one level deep." : "")
        )
      )
    );
  });
};
const runAutomationOnPage = async (page, opts) => {
  const scenario = ((opts == null ? void 0 : opts.scenario) || "openHomepage").trim();
  try {
    switch (scenario) {
      case "openHomepage": {
        await page.goto("https://threads.com/", { waitUntil: "networkidle2" });
        return { success: true };
      }
      default: {
        console.log("[router] loading scenario module:", `./scenarios/${scenario}.js`);
        const mod = await __variableDynamicImportRuntimeHelper(/* @__PURE__ */ Object.assign({}), `./scenarios/${scenario}.js`, 3);
        console.log("[router] scenario module loaded:", Object.keys(mod));
        if (!(mod == null ? void 0 : mod.run)) throw new Error(`Scenario '${scenario}' not found`);
        const result = await mod.run(page, opts == null ? void 0 : opts.input);
        return result ?? { success: true };
      }
    }
  } catch (error) {
    console.error("[router] scenario error:", error);
    return { success: false, error: (error == null ? void 0 : error.message) || "Scenario error" };
  }
};
export {
  runAutomationOnPage
};
