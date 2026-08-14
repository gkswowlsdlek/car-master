import { pathToFileURL } from "node:url";
const { default: pw } = await import(pathToFileURL(process.env.PWPKG).href);
const browser = await pw.chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const login = await context.request.post("http://localhost:3100/api/demo-login", { data: { username: "2", password: "2" } });
const cookie = login.headers()["set-cookie"]?.split(";")[0];
if (cookie) { const [name, value] = cookie.split("="); await context.addCookies([{ name, value, url: "http://localhost:3100" }]); }
const page = await context.newPage();
await page.goto("http://localhost:3100/shop", { waitUntil: "networkidle" });
await page.screenshot({ path: "screenshots/phase-d2/01-shop-dashboard.png", fullPage: true });
await page.getByRole("button", { name: "시공점 관리" }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: "screenshots/phase-d2/02-shop-management-full.png", fullPage: true });
await page.screenshot({ path: "screenshots/phase-d2/03-shop-management-viewport.png" });
await browser.close();
