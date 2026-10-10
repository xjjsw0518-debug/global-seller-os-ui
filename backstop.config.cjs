const { chromium } = require("@playwright/test");

module.exports = {
  id: "global_seller_os_ui",
  viewports: [
    {
      label: "desktop",
      width: 1440,
      height: 900,
    },
  ],
  onReadyScript: "playwright/onReady.cjs",
  scenarios: [
    {
      label: "Global Seller OS home",
      url: process.env.BACKSTOP_BASE_URL || "http://127.0.0.1:4173/",
      readySelector: "#root h1",
      delay: 500,
      selectors: ["document"],
      misMatchThreshold: 0.1,
      requireSameDimensions: true,
    },
  ],
  paths: {
    bitmaps_reference: "backstop_data/bitmaps_reference",
    bitmaps_test: "backstop_data/bitmaps_test",
    engine_scripts: "backstop_data/engine_scripts",
    html_report: "backstop_data/html_report",
    ci_report: "backstop_data/ci_report",
  },
  report: ["browser", "CI"],
  openReport: false,
  engine: "playwright",
  engineOptions: {
    browser: "chromium",
    executablePath: chromium.executablePath(),
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  },
  asyncCaptureLimit: 1,
  asyncCompareLimit: 1,
  debug: false,
  debugWindow: false,
};
