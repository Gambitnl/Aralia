#!/usr/bin/env npx tsx
import { chromium } from "playwright";

async function main() {
  const cdpUrl = process.env.IMAGE_GEN_CDP_URL || "http://localhost:9222";
  const browser = await chromium.connectOverCDP(cdpUrl, { timeout: 5000 });
  const context = browser.contexts()[0];
  if (!context) throw new Error("No browser context found via CDP.");

  let page = context.pages().find((p) => p.url().includes("gemini.google.com")) || context.pages()[0];
  if (!page) page = await context.newPage();
  if (!page.url().includes("gemini.google.com")) {
    await page.goto("https://gemini.google.com/app", { waitUntil: "domcontentloaded" });
  }
  await page.waitForTimeout(900);

  const buttons = page.locator('button[aria-label*="Start research" i], button:has-text("Start research"), [role="button"]:has-text("Start research")');
  const count = await buttons.count();
  if (count === 0) {
    console.log("start_research_buttons=0");
    await browser.close();
    return;
  }

  const target = buttons.nth(count - 1);
  await target.scrollIntoViewIfNeeded().catch(() => undefined);
  await page.waitForTimeout(200);
  await target.click({ timeout: 5000 }).catch(async () => {
    await target.click({ timeout: 5000, force: true });
  });

  await page.waitForTimeout(1200);
  const countAfter = await buttons.count();
  console.log(`start_research_buttons_before=${count}`);
  console.log(`start_research_buttons_after=${countAfter}`);
  await browser.close();
}

void main();
