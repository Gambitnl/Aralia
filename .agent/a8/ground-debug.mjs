import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
for (const loc of [{ gx: 17, gy: 4, name: 'river' }, { gx: 16, gy: 4, name: 'town' }]) {
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  page.on('console', m => { if (m.type() === 'error') console.log(`[${loc.name} console]`, m.text().slice(0, 160)); });
  page.on('pageerror', e => console.log(`[${loc.name} pageerror]`, String(e).slice(0, 200)));
  await page.goto(`http://localhost:5174/Aralia/?phase=world3d&ground=1&gx=${loc.gx}&gy=${loc.gy}`, { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 24000));
  await page.screenshot({ path: `ground-dbg-${loc.name}.png`, timeout: 20000 }).catch(() => console.log(loc.name, 'shot failed'));
  console.log(loc.name, 'done');
  await page.close();
}
await browser.close();
