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
const cx = canvas.x + canvas.width * 0.30, cy = canvas.y + canvas.height * 0.40;
await page.mouse.move(cx, cy);
for (let round = 0; round < 40; round++) {
  await page.mouse.wheel(0, -400);
  await new Promise(r => setTimeout(r, 250));
  const inRegion = await page.evaluate(() => /region|ascend/i.test(document.body.innerText));
  if (inRegion) { console.log('descended at round', round); break; }
}
await new Promise(r => setTimeout(r, 10000)); // region gen + render
console.log('state:', JSON.stringify(await page.evaluate(() => document.body.innerText.slice(0, 160))));
// Keep temporary proof under the ignored scratch boundary instead of rebuilding the
// absorbed Worldforge project folder inside tracked documentation.
await page.screenshot({ path: '../scratch/worldforge-laneA7-overlay-region.png' });
console.log('saved');
await browser.close();
