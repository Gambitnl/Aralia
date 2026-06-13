// Headless capture of the Agent Matrix cockpit (preview_screenshot hangs on
// backgrounded canvas tabs — same workaround as .agent/3d-visual-quality/captures/shoot.mjs).
// Usage: node .agent/orchestration/shoot-cockpit.mjs [out.png] [--drawer]
import { chromium } from 'playwright';

const out = process.argv[2] || '.agent/orchestration/cockpit.png';
const openDrawer = process.argv.includes('--drawer');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1720, height: 980 } });
await page.goto('http://localhost:5174/Aralia/misc/agent_matrix.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500); // xterm tiles attach + feed poll
if (openDrawer) {
  await page.click('.quota-chip'); // first chip = claude
  await page.waitForTimeout(600);
}
await page.screenshot({ path: out });
await browser.close();
console.log('wrote ' + out);
