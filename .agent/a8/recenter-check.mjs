import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1700, height: 950 } });
await page.goto('http://localhost:5174/Aralia/?phase=worldforge', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 12000));
// Drag the map far off-screen with a REAL mouse (4 long drags east)
for (let d = 0; d < 4; d++) {
  await page.mouse.move(850, 500);
  await page.mouse.down();
  await page.mouse.move(1680, 520, { steps: 8 });
  await page.mouse.up();
  await new Promise(r => setTimeout(r, 200));
}
await new Promise(r => setTimeout(r, 500));
const pill = await page.getByRole('button', { name: /recenter map/i }).count();
console.log('recenter pill visible after panning into the abyss:', pill === 1);
await page.screenshot({ path: 'recenter-lost.png' });
if (pill) {
  await page.getByRole('button', { name: /recenter map/i }).click();
  await new Promise(r => setTimeout(r, 800));
  console.log('pill gone after click:', (await page.getByRole('button', { name: /recenter map/i }).count()) === 0);
  await page.screenshot({ path: 'recenter-restored.png' });
}
await browser.close();
