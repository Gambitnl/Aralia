import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE = path.resolve(__dirname, '../3d-visual-quality/captures/storageState.json');
const browser = await chromium.launch({ headless: true, args: ['--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, storageState: STATE });
const page = await ctx.newPage();
const sleep = ms => new Promise(r => setTimeout(r, ms));
await page.goto('http://localhost:5174/Aralia/', { waitUntil: 'domcontentloaded' });
await sleep(3000);
const c = page.getByRole('button', { name: /continue journey/i });
if (await c.count()) await c.first().click();
await sleep(8000);
await page.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>/atlas/i.test(x.textContent||'')); b&&b.click(); });
await sleep(3000);
const info = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => ({
  t: (b.textContent||'').trim().slice(0,25), aria: b.getAttribute('aria-label'), title: b.title || null
})).filter(x => x.t || x.aria || x.title).slice(0, 60));
console.log(JSON.stringify(info, null, 0));
await browser.close();
