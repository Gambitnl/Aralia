import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1700, height: 950 }, storageState: '../3d-visual-quality/captures/storageState.json' });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') console.log('[err]', m.text().slice(0, 140)); });
await page.goto('http://localhost:5174/Aralia/', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 4000));
const cont = page.getByRole('button', { name: /continue journey/i });
if (await cont.count()) { await cont.click(); console.log('continuing journey'); }
await new Promise(r => setTimeout(r, 12000));
// where did we land?
const state = await page.evaluate(() => ({
  submapGrid: !!document.querySelector('[aria-label="Submap viewport"]'),
  wfCanvas: !!document.querySelector('[aria-label="Submap viewport"] canvas'),
  bodyHead: document.body.innerText.slice(0, 120).replace(/\n+/g, ' | '),
}));
console.log(JSON.stringify(state));
await page.screenshot({ path: 'submap-wf.png' });
console.log('saved submap-wf.png');
await browser.close();
