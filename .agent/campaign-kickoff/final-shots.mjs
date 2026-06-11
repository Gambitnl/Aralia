import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE = path.resolve(__dirname, '../3d-visual-quality/captures/storageState.json');
const browser = await chromium.launch({ headless: true, args: ['--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, storageState: STATE });
const page = await ctx.newPage();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const domClick = (re) => page.evaluate((s) => {
  const rx = new RegExp(s, 'i');
  const b = [...document.querySelectorAll('button')].find(x => rx.test((x.getAttribute('aria-label')||'') + (x.textContent||'')));
  if (b) { b.click(); return true; } return false;
}, re);
await page.goto('http://localhost:5174/Aralia/', { waitUntil: 'domcontentloaded' });
await sleep(3000);
const c = page.getByRole('button', { name: /continue journey/i });
if (await c.count()) await c.first().click();
await sleep(8000);
console.log('atlas:', await domClick('^Atlas'));
await sleep(2500);

// World map (Azgaar iframe) — default zoom
console.log('worldmap:', await domClick('Toggle World Map'));
await sleep(12000); // iframe boot + generation
await page.screenshot({ path: path.join(__dirname, 'kick-worldmap-default.png') });
console.log('iframe:', await page.evaluate(() => !!document.querySelector('iframe')));

// Max zoom-in: wheel over map center several times
for (let i = 0; i < 10; i++) { await page.mouse.move(800, 480); await page.mouse.wheel(0, -400); await sleep(250); }
await sleep(1500);
await page.screenshot({ path: path.join(__dirname, 'kick-worldmap-maxzoom.png') });

// Close world map, open full submap
console.log('worldmap off:', await domClick('Toggle World Map'));
await sleep(1500);
console.log('submap:', await domClick('Toggle Submap'));
await sleep(3000);
await page.screenshot({ path: path.join(__dirname, 'kick-submap.png') });
console.log('done');
await browser.close();
