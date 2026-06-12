import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1700, height: 950 } });
await page.goto('http://localhost:5174/Aralia/?phase=worldforge', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 15000)); // full world gen now
await page.evaluate(() => {
  const c = document.querySelector('canvas');
  const s = Math.min(c.width / 960, c.height / 540);
  const ox = (c.width - 960 * s) / 2; const oy = (c.height - 540 * s) / 2;
  const rect = c.getBoundingClientRect();
  const cx = rect.left + (403.7 * s + ox) * (rect.width / c.width);
  const cy = rect.top + (336.22 * s + oy) * (rect.height / c.height);
  for (const t of ['pointerdown', 'pointerup', 'click']) c.dispatchEvent(new PointerEvent(t, { clientX: cx, clientY: cy, bubbles: true, pointerId: 1, isPrimary: true, button: 0 }));
});
await page.waitForFunction(() => document.body.innerText.includes('REGION VIEW'), { timeout: 30000 });
await new Promise(r => setTimeout(r, 1800));
await page.screenshot({ path: 'region-town.png' });
console.log('saved region-town.png');
await browser.close();
