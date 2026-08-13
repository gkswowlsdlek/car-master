import { chromium } from "playwright-core";
import path from "node:path";

const BASE = "https://car-master-nine.vercel.app";
const SHOT_DIR = path.resolve("screenshots/phase1-final");
const log = (...args) => console.log(new Date().toISOString().slice(11, 19), ...args);

function futureDate(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

async function shot(page, name) {
  const file = path.join(SHOT_DIR, name);
  await page.screenshot({ path: file, fullPage: false });
  log("screenshot:", file);
}

async function waitStageText(page, expected, timeout = 20000) {
  await page.waitForFunction((text) => {
    const el = document.querySelector(".dealer-stage-current b");
    return el && el.textContent === text;
  }, expected, { timeout });
}

const result = { steps: {}, issues: [] };

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("console", (msg) => { if (msg.type() === "error") log("console error:", msg.text()); });
  page.on("pageerror", (err) => log("pageerror:", err.message));

  // 1. Login
  log("STEP 1: login as Demo Dealer (1/1)");
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#login-email", "1");
  await page.fill('input[type="password"]', "1");
  await page.click('button.primary.full');
  await page.waitForSelector("text=DEALER WORKSPACE", { timeout: 20000 });
  result.steps.login = "PASS";
  log("login OK");

  // 2. Find shop
  log("STEP 2: navigate to 시공점 찾기");
  await page.click('nav >> text=시공점 찾기');
  await page.waitForSelector(".installer-card, .installer-card-body", { timeout: 20000 });
  result.steps.findShop = "PASS";

  // 3. Select shop -> request
  log("STEP 3: select first shop, click 시공 요청");
  await page.locator(".installer-card-actions button.button-primary").first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(2000); // let map/list re-renders settle before interacting
  let clicked = false;
  for (let attempt = 0; attempt < 5 && !clicked; attempt++) {
    try {
      await page.locator(".installer-card-actions button.button-primary").first().click({ timeout: 8000 });
      clicked = true;
    } catch (e) {
      log(`  click attempt ${attempt + 1} failed, retrying:`, e.message.split("\n")[0]);
      await page.waitForTimeout(1000);
    }
  }
  if (!clicked) throw new Error("Could not click 시공 요청 after 5 attempts — list kept re-rendering");
  await page.waitForSelector(".service-request-form", { timeout: 20000 });
  result.steps.selectShop = "PASS";

  // 4. Fill request form
  log("STEP 4: fill request form (차종/작업내용/입고예정일/출고희망일)");
  await page.fill('input[placeholder="예: 제네시스 GV80"]', "아반떼 CN7");
  await page.fill('textarea[placeholder^="예: 버텍스 900 썬팅"]', "버텍스 900 썬팅 — Phase 1 최종검증");
  const inbound = futureDate(3);
  const release = futureDate(6);
  const dateInputs = page.locator('input[type="date"]');
  await dateInputs.nth(0).fill(inbound);
  await dateInputs.nth(1).fill(release);
  await shot(page, "01-request-form.png");

  const submitButton = page.locator("button.request-submit-button");
  await submitButton.waitFor({ timeout: 10000 });
  const disabled = await submitButton.isDisabled();
  if (disabled) { result.issues.push("request-submit-button is disabled after filling all required fields"); }
  await submitButton.click();
  await page.waitForSelector(".summary-card", { timeout: 20000 });
  result.steps.fillForm = disabled ? "FAIL (submit disabled)" : "PASS";

  // 5. Verify summary shows both dates, submit
  log("STEP 5: verify summary rows, submit final request");
  const summaryText = await page.locator(".summary-card").innerText();
  const hasInbound = summaryText.includes(inbound);
  const hasRelease = summaryText.includes(release);
  result.steps.summaryDates = { hasInbound, hasRelease, raw: summaryText };
  if (!hasInbound || !hasRelease) result.issues.push("Summary screen missing inbound/release date value");

  await page.click(".summary-actions button.button-primary");
  await page.waitForSelector('[data-testid^="transaction-card-"], [data-testid^="deal-card-"], .dealer-active-deals, .deal-list', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  result.steps.createTransaction = "PASS (submitted)";

  // 6. Open the newly created transaction (most recent)
  log("STEP 6: open newly created transaction room");
  let opened = false;
  const cardSelectors = ['[data-testid^="transaction-card-"]', '[data-testid^="deal-card-"]', ".deal-list button", ".dealer-deal-list button"];
  for (const sel of cardSelectors) {
    const loc = page.locator(sel);
    if (await loc.count() > 0) { await loc.first().click(); opened = true; break; }
  }
  if (!opened) {
    result.issues.push("Could not find a transaction card to click after creation — trying nav fallback");
    await page.click('nav >> text=메시지').catch(() => {});
    await page.waitForTimeout(1000);
    const roomButtons = page.locator(".conversation-list button, .inbox-list button");
    if (await roomButtons.count() > 0) { await roomButtons.first().click(); opened = true; }
  }
  await page.waitForSelector(".messenger-workspace", { timeout: 20000 });
  result.steps.openRoom = opened ? "PASS" : "FAIL";

  // 7. Verify phone-confirm banner
  log("STEP 7: verify 전화 확인 필요 banner");
  const bannerVisible = await page.locator(".phone-confirm-banner").first().isVisible().catch(() => false);
  result.steps.phoneConfirmBanner = bannerVisible ? "PASS" : "FAIL (banner not visible)";
  if (!bannerVisible) result.issues.push("phone-confirm-banner not visible on a fresh 견적-stage transaction");

  await shot(page, "02-transaction-room.png");

  // 8. Open contact (전화번호 확인)
  log("STEP 8: click 전화하기 header button to reveal contact");
  await page.click('button[aria-label="전화하기"]').catch((e) => result.issues.push("전화하기 button click failed: " + e.message));
  await page.waitForTimeout(1000);
  const contactSheetVisible = await page.locator(".contact-sheet-overlay").isVisible().catch(() => false);
  result.steps.contactReveal = contactSheetVisible ? "PASS" : "FAIL (contact sheet not shown)";
  if (contactSheetVisible) {
    const contactText = await page.locator(".contact-sheet-overlay").innerText().catch(() => "");
    result.steps.contactText = contactText;
    await page.click(".contact-sheet-close").catch((e) => result.issues.push("contact-sheet-close click failed: " + e.message));
    await page.waitForSelector(".contact-sheet-overlay", { state: "hidden", timeout: 5000 }).catch((e) => result.issues.push("contact-sheet-overlay did not close: " + e.message));
  }

  // 9. Stage: 입고 전 (before) screenshot
  log("STEP 9: screenshot before-status (입고 전)");
  await waitStageText(page, "입고 전", 10000).catch((e) => result.issues.push("stage label 입고 전 not found: " + e.message));
  await shot(page, "03-before-status.png");

  // 10. Advance to 작업 중 (chains 견적->시공예약->입고 client side)
  log("STEP 10: click dealer-stage-advance-button -> 작업 중");
  await page.click('[data-testid="dealer-stage-advance-button"]');
  await waitStageText(page, "작업 중", 25000).then(
    () => { result.steps.stage1to2 = "PASS"; },
    (e) => { result.steps.stage1to2 = "FAIL"; result.issues.push("입고 전 -> 작업 중 failed: " + e.message); }
  );
  await shot(page, "04-in-progress-status.png");

  // 11. Advance to 작업 완료 (goes through confirm modal)
  log("STEP 11: click dealer-stage-advance-button -> 작업 완료 (confirm modal expected)");
  await page.click('[data-testid="dealer-stage-advance-button"]');
  await page.waitForSelector(".stage-confirm-card", { timeout: 8000 }).then(async () => {
    await page.click(".stage-confirm-card button.button-primary");
  }).catch((e) => result.issues.push("작업완료 confirm modal not shown: " + e.message));
  await waitStageText(page, "작업 완료", 25000).then(
    () => { result.steps.stage2to3 = "PASS"; },
    (e) => { result.steps.stage2to3 = "FAIL"; result.issues.push("작업 중 -> 작업 완료 failed: " + e.message); }
  );
  await shot(page, "05-completed-status.png");

  // 12. Advance to 출고 (goes through final-price confirm modal, choose 나중에 입력)
  log("STEP 12: click dealer-stage-advance-button -> 출고 (final price modal expected)");
  await page.click('[data-testid="dealer-stage-advance-button"]');
  await page.waitForSelector(".stage-confirm-card", { timeout: 8000 }).then(async () => {
    await page.click(".stage-confirm-card button.button-secondary");
  }).catch((e) => result.issues.push("출고 final-price confirm modal not shown: " + e.message));
  await waitStageText(page, "출고", 25000).then(
    () => { result.steps.stage3to4 = "PASS"; },
    (e) => { result.steps.stage3to4 = "FAIL"; result.issues.push("작업 완료 -> 출고 failed: " + e.message); }
  );
  await shot(page, "06-released-status.png");

  // 13. Refresh and verify persistence. This is a client-state SPA (no
  // per-screen URL routing), so a hard reload is expected to land back on
  // the dashboard, not the same room — re-navigate to the transaction and
  // check its stage there, which is what actually proves server persistence.
  log("STEP 13: reload page, re-open the same transaction, verify 출고 status persists");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("text=DEALER WORKSPACE", { timeout: 20000 }).catch((e) => result.issues.push("dashboard not shown after reload: " + e.message));
  if (await page.locator(".messenger-workspace").isVisible().catch(() => false)) {
    result.steps.landedInRoomAfterReload = true;
  } else {
    result.steps.landedInRoomAfterReload = false;
    await page.click('nav >> text=거래 관리').catch(() => {});
    await page.waitForTimeout(1500);
    const dealCard = page.locator('[data-testid^="transaction-card-"], [data-testid^="deal-card-"], .deal-list button, .dealer-deal-list button').first();
    if (await dealCard.count() > 0) { await dealCard.click().catch(() => {}); }
    await page.waitForSelector(".messenger-workspace", { timeout: 15000 }).catch((e) => result.issues.push("could not reopen transaction after reload: " + e.message));
  }
  await waitStageText(page, "출고", 15000).then(
    () => { result.steps.persistAfterRefresh = "PASS"; },
    (e) => { result.steps.persistAfterRefresh = "FAIL"; result.issues.push("stage did not persist as 출고 after refresh: " + e.message); }
  );

  log("RESULT:", JSON.stringify(result, null, 2));
} catch (err) {
  result.fatalError = err.stack || String(err);
  log("FATAL:", err);
} finally {
  await browser.close();
}

console.log("===FINAL_RESULT_JSON===");
console.log(JSON.stringify(result, null, 2));
