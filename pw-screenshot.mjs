import { chromium } from "C:/Users/USER/AppData/Roaming/npm/node_modules/playwright/index.mjs";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 800 });

// Home page
await page.goto("http://localhost:3333/", { waitUntil: "networkidle", timeout: 20000 });
await page.screenshot({ path: "C:/Users/USER/studyhub/ss-home.png" });
console.log("Home:", page.url(), await page.title());

// Login page
await page.goto("http://localhost:3333/login", { waitUntil: "networkidle", timeout: 10000 });
await page.screenshot({ path: "C:/Users/USER/studyhub/ss-login.png" });
console.log("Login:", page.url());

await browser.close();
