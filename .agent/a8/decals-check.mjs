import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, storageState: '../3d-visual-quality/captures/storageState.json' });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') console.log('[err]', m.text().slice(0, 160)); });
await page.goto('http://localhost:5174/Aralia/?dev_combat=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 4000));
const cont = page.getByRole('button', { name: /continue journey/i });
if (await cont.count()) { await cont.click(); console.log('clicked Continue Journey'); }
await new Promise(r => setTimeout(r, 12000));
await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button')).find(x => (x.textContent || '').trim() === '3D'); b?.click(); });
await new Promise(r => setTimeout(r, 10000));
const skip = page.getByRole('button', { name: /satum.*turn/i }).first();
try { await skip.click({ timeout: 3000 }); console.log('skipped to Satum'); await new Promise(r => setTimeout(r, 2000)); } catch { console.log('Satum already active'); }
for (let i = 0; i < 25; i++) {
  const can = await page.getByRole('button', { name: /acid splash/i }).count();
  if (can) { console.log('Satum turn at', i, 's'); break; }
  await new Promise(r => setTimeout(r, 1000));
}
const shot = async (p) => { for (let a = 0; a < 4; a++) { try { await page.screenshot({ path: p, timeout: 20000 }); return console.log('shot', p); } catch { console.log('retry', p, a); await new Promise(r => setTimeout(r, 1500)); } } };
await shot('decals-before.png');
const btn = page.getByRole('button', { name: /acid splash/i }).first();
const hint = await page.evaluate(() => document.body.innerText.slice(0, 400));
console.log('page state:', hint.replace(/\n+/g, ' | ').slice(0, 200));
if (await btn.count()) {
  await btn.click();
  await new Promise(r => setTimeout(r, 2500));
  await shot('decals-after.png');
  console.log('captured before/after');
} else {
  console.log('NEVER reached Satum turn — before only');
}
await browser.close();





