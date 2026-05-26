const PLAY_PATH = process.env.PLAY_PATH;
const { chromium } = require(PLAY_PATH);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.goto("http://localhost:3333/", { waitUntil: "networkidle", timeout: 20000 });
  await page.screenshot({ path: "ss-home.png" });
  console.log("Home:", page.url(), "|", await page.title());

  await page.goto("http://localhost:3333/login", { waitUntil: "networkidle", timeout: 10000 });
  await page.screenshot({ path: "ss-login.png" });
  console.log("Login:", page.url());

  await browser.close();
})().catch(e => { console.error("ERR:", e.message); process.exit(1); });
