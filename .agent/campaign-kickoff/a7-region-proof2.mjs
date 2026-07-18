import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto('http://localhost:5174/Aralia/?phase=worldforge', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 12000));
await page.evaluate(() => {
  const el = Array.from(document.querySelectorAll('button, label')).find(e => /demo overlay/i.test(e.textContent || ''));
  el?.click();
});
await new Promise(r => setTimeout(r, 1500));
const canvas = await page.locator('canvas').first().boundingBox();
// Click on land (west continent interior) to trigger A4 click-descend
await page.mouse.click(canvas.x + canvas.width * 0.28, canvas.y + canvas.height * 0.38);
for (let i = 0; i < 25; i++) {
  await new Promise(r => setTimeout(r, 1000));
  const ascend = await page.getByRole('button', { name: /ascend/i }).count();
  if (ascend > 0) { console.log('region view confirmed at', i, 's'); break; }
  if (i === 24) console.log('NO region view after 25s');
}
await new Promise(r => setTimeout(r, 15000));
// Keep temporary proof under the ignored scratch boundary instead of rebuilding the
// absorbed Worldforge project folder inside tracked documentation.
await page.screenshot({ path: '../scratch/worldforge-laneA7-overlay-region.png' });
console.log('saved; ascend-present:', await page.getByRole('button', { name: /ascend/i }).count());
await browser.close();
