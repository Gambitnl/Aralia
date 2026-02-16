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
  await page.waitForTimeout(800);

  const clicked = await page.evaluate(
    `(() => {
      const isVisible = (el) => {
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      const nodes = Array.from(document.querySelectorAll("button,[role='button'],[role='menuitem'],[role='option']"));
      for (const node of nodes) {
        if (!isVisible(node)) continue;
        const text = (node.textContent || "").trim().replace(/\\s+/g, " ");
        const aria = node.getAttribute("aria-label") || "";
        const probe = (text + " " + aria).toLowerCase();
        if (!/start\\s*research/.test(probe)) continue;
        node.click();
        return true;
      }
      return false;
    })()`,
  );

  console.log(clicked ? "clicked_start_research=true" : "clicked_start_research=false");
  await browser.close();
}

void main();
