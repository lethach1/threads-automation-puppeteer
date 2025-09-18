const runAutomationOnPage = async (page) => {
  await page.goto("https://threads.com/", { waitUntil: "networkidle2" });
};
export {
  runAutomationOnPage
};
