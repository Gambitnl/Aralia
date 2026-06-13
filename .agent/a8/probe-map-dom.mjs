import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
const ev = async (fn, arg) => { try { return await page.evaluate(fn, arg); } catch { return null; } };
const click = (txt) => ev((s) => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim().includes(s) || x.getAttribute('aria-label') === s); if (b) { b.click(); return true; } return false; }, txt);
await page.goto('http://localhost:5176/Aralia/', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 5000));
for (let i = 0; i < 50; i++) {
  const s = await ev(() => { const t = document.body.innerText; if (t.includes('Current Position')) return 'playing'; if (t.includes('Generating party')) return 'wait'; if (t.includes('Continue Journey')) return 'menu-save'; if (t.includes('Begin Legend')) return 'menu'; return 'wait'; });
  if (s === 'playing') break;
  if (s === 'menu-save') await click('Continue Journey');
  else if (s === 'menu') { await click('Dev Menu'); await new Promise(r => setTimeout(r, 1500)); await click('Quick Start'); }
  await new Promise(r => setTimeout(r, 4000));
}
await click('Toggle World Map');
await new Promise(r => setTimeout(r, 6000));
console.log(await ev(() => {
  const reds = [...document.querySelectorAll('div')].filter(d => d.className && String(d.className).includes('bg-red-500')).length;
  const canvases = [...document.querySelectorAll('canvas')].map(c => { const r = c.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; });
  const imgs = [...document.querySelectorAll('img')].map(i => { const r = i.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; }).filter(s => !s.startsWith('0'));
  return JSON.stringify({ reds, canvases, imgs });
}));
await browser.close();
