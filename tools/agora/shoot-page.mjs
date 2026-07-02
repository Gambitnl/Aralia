// tools/agora/shoot-page.mjs
// Dependable page capture via headless Playwright — the fallback when the
// preview MCP's screenshot flakes (see WORKFLOW_GAPS.md WF-G9). Same rig the
// 3D capture scripts use; works on any URL.
//
//   node tools/agora/shoot-page.mjs <url> <out.png> [--full] [--eval "<js>"] [--wait ms]
//
//   --eval runs a JS snippet after load (e.g. click a toggle) before capture.
//   --full captures the full page height instead of the viewport.
import { chromium } from 'playwright';

const [url, out] = process.argv.slice(2);
if (!url || !out) {
  console.error('Usage: node tools/agora/shoot-page.mjs <url> <out.png> [--full] [--eval "<js>"] [--wait ms]');
  process.exit(1);
}
const full = process.argv.includes('--full');
const evalIdx = process.argv.indexOf('--eval');
const snippet = evalIdx >= 0 ? process.argv[evalIdx + 1] : null;
const waitIdx = process.argv.indexOf('--wait');
const waitMs = waitIdx >= 0 ? Number(process.argv[waitIdx + 1]) : 800;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(waitMs);
if (snippet) {
  await page.evaluate(snippet);
  await page.waitForTimeout(400);
}
await page.screenshot({ path: out, fullPage: full });
console.log(`shot ${out}`);
await browser.close();
