import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 110)); });
await page.goto('http://localhost:5176/Aralia/', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 4000));
const clickText = async (t) => {
  const ok = await page.evaluate((txt) => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim().includes(txt) || x.getAttribute('aria-label') === txt);
    if (b) { b.click(); return true; } return false;
  }, t);
  console.log(ok ? `clicked: ${t}` : `NOT FOUND: ${t}`);
  await new Promise(r => setTimeout(r, 3000));
  return ok;
};
await clickText('Dev Menu');
await clickText('Quick Start');
let inPlay = false;
for (let i = 0; i < 40 && !inPlay; i++) {
  await new Promise(r => setTimeout(r, 3000));
  inPlay = await page.evaluate(() => document.body.innerText.includes('Current Position'));
}
console.log('inPlay:', inPlay);
console.log('aria-buttons:', await page.evaluate(() => [...document.querySelectorAll('button[aria-label]')].map(b => b.getAttribute('aria-label'))));
if (!await clickText('Enter 3D World')) {
  await clickText('Toggle Submap');
  console.log('submap buttons:', await page.evaluate(() => [...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(t => t && t.length < 25).slice(0, 30)));
  await clickText('Enter 3D');
}
await new Promise(r => setTimeout(r, 25000));
console.log('in3d:', await page.evaluate(() => document.body.innerText.includes('3D World View')));
for (let a = 0; a < 5; a++) {
  try { await page.screenshot({ path: 'ground-default-proof.png', timeout: 15000 }); console.log('saved'); break; }
  catch { console.log('retry shot', a); await new Promise(r => setTimeout(r, 3000)); }
}
console.log('errors:', errs.slice(0, 4));
await browser.close();
