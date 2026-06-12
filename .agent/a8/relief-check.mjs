import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1700, height: 950 } });
await page.goto('http://localhost:5174/Aralia/?phase=worldforge', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 12000));
const anchors = [
  { name: 'desert', px: 227.44, py: 232.09 },
  { name: 'forest', px: 241.26, py: 142.6 },
  { name: 'tundra', px: 178.58, py: 101.85 },
];
for (const a of anchors) {
  // ensure atlas view
  const ascend = page.getByRole('button', { name: /ascend to world map/i });
  if (await ascend.count()) { await ascend.click(); await new Promise(r => setTimeout(r, 1500)); }
  await page.evaluate(({ px, py }) => {
    const c = document.querySelector('canvas');
    const s = Math.min(c.width / 960, c.height / 540);
    const ox = (c.width - 960 * s) / 2; const oy = (c.height - 540 * s) / 2;
    const rect = c.getBoundingClientRect();
    const cx = rect.left + (px * s + ox) * (rect.width / c.width);
    const cy = rect.top + (py * s + oy) * (rect.height / c.height);
    for (const t of ['pointerdown', 'pointerup', 'click']) c.dispatchEvent(new PointerEvent(t, { clientX: cx, clientY: cy, bubbles: true, pointerId: 1, isPrimary: true, button: 0 }));
  }, a);
  await page.waitForFunction(() => document.body.innerText.includes('REGION VIEW'), { timeout: 25000 });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: `relief-${a.name}.png` });
  console.log('saved relief-' + a.name + '.png');
}
await browser.close();

