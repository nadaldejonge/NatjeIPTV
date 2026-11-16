import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { installFixture } from "./fixtures/tv-platform.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "C:/Users/nadal/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(installFixture, { rememberLogin: false });
  await page.goto("http://127.0.0.1:5173");
  await page.locator(".tv-start-screen").waitFor();
  await page.waitForFunction(() => document.querySelector(".brand-mark img")?.naturalWidth > 0);
  assert((await page.locator(".brand-mark img").getAttribute("src")).includes("natje-joint-icon"));
  await page.screenshot({ path: path.resolve("artifacts/android-tv/verification/login-new-branding-960.png") });
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page.locator(".tv-hub").waitFor();
  await page.waitForFunction(() => document.querySelector(".brand-wordmark img")?.naturalWidth > 0);
  assert((await page.locator(".brand-wordmark img").getAttribute("src")).includes("natje-iptv-logo"));
  assert.equal(await page.locator(".hub-card").count(), 2);
  assert.deepEqual(errors, []);
  console.log("PASS new badge on login, supplied wordmark on hub, both loaded without errors");
} finally { await browser.close(); }
