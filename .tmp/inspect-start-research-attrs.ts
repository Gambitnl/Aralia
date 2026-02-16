import { chromium } from "playwright";

async function main() {
  const browser = await chromium.connectOverCDP("http://localhost:9222");
  const context = browser.contexts()[0];
  let page = context.pages().find((p) => p.url().includes("gemini.google.com")) || context.pages()[0];
  if (!page) page = await context.newPage();
  if (!page.url().includes("gemini.google.com")) {
    await page.goto("https://gemini.google.com/app", { waitUntil: "domcontentloaded" });
  }
  await page.waitForTimeout(700);

  const rows = await page.evaluate(
    `(() => {
      const isVisible = (el) => {
        const s = window.getComputedStyle(el);
        if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const out = [];
      const nodes = Array.from(document.querySelectorAll("button,[role='button']"));
      for (const node of nodes) {
        if (!isVisible(node)) continue;
        const text = (node.textContent || "").trim().replace(/\\s+/g, " ");
        const aria = node.getAttribute("aria-label") || "";
        const probe = (text + " " + aria).toLowerCase();
        if (!/start\\s*research|create\\s*report|deep\\s*research|tools/.test(probe)) continue;
        out.push({
          text,
          aria,
          disabledAttr: node.getAttribute("disabled") || "",
          ariaDisabled: node.getAttribute("aria-disabled") || "",
          dataState: node.getAttribute("data-state") || "",
          className: String(node.className || "").slice(0, 160),
        });
      }
      return out;
    })()`,
  );

  console.log(JSON.stringify(rows, null, 2));
  await browser.close();
}

void main();
