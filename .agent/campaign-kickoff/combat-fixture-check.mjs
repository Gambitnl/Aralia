import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE = path.resolve(__dirname, '../3d-visual-quality/captures/storageState.json');
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, storageState: STATE });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 120)));
await page.goto('http://localhost:5174/Aralia/?dev_combat=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 3000));
const cont = page.getByRole('button', { name: /continue journey/i });
if (await cont.count()) await cont.first().click();
for (let i = 0; i < 20; i++) {
  await new Promise(r => setTimeout(r, 2000));
  const phase = await page.evaluate(() => new URLSearchParams(location.search).get('phase'));
  if (i % 3 === 0) console.log(`${i*2}s phase=`, phase);
  if (phase === 'combat') break;
}
await new Promise(r => setTimeout(r, 6000));
const final = await page.evaluate(() => ({
  phase: new URLSearchParams(location.search).get('phase'),
  text: document.body.innerText.slice(0, 200),
}));
console.log('final:', JSON.stringify(final));
console.log('errors:', JSON.stringify(errors.slice(0, 3)));
await page.screenshot({ path: 'combat-fixture.png' });
await browser.close();
