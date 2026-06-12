import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1700, height: 950 } });
await page.goto('http://localhost:5174/Aralia/?phase=worldforge', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 12000));
// descend 1: atlas → region (cell #27, fit-transformed coords)
await page.evaluate(() => {
  const c = document.querySelector('canvas');
  const s = Math.min(c.width / 960, c.height / 540);
  const ox = (c.width - 960 * s) / 2; const oy = (c.height - 540 * s) / 2;
  const rect = c.getBoundingClientRect();
  const cx = rect.left + (285.9 * s + ox) * (rect.width / c.width);
  const cy = rect.top + (63.43 * s + oy) * (rect.height / c.height);
  for (const t of ['pointerdown', 'pointerup', 'click']) c.dispatchEvent(new PointerEvent(t, { clientX: cx, clientY: cy, bubbles: true, pointerId: 1, isPrimary: true, button: 0 }));
});
await page.waitForFunction(() => document.body.innerText.includes('REGION VIEW'), { timeout: 20000 });
await new Promise(r => setTimeout(r, 1500));
// descend 2: region → local (center click via real mouse for full fidelity)
const c = await page.locator('canvas').first().boundingBox();
await page.mouse.click(c.x + c.width / 2, c.y + c.height / 2);
await page.waitForFunction(() => document.body.innerText.includes('Local Area:'), { timeout: 30000 });
await new Promise(r => setTimeout(r, 1500));
await page.screenshot({ path: 'local-chain.png' });
console.log('saved local-chain.png');
// zoomed crop: wheel in a few steps at center
for (let i = 0; i < 8; i++) { await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2); await page.mouse.wheel(0, -120); await new Promise(r => setTimeout(r, 150)); }
await new Promise(r => setTimeout(r, 800));
await page.screenshot({ path: 'local-zoomed.png' });
console.log('saved local-zoomed.png');
await browser.close();
