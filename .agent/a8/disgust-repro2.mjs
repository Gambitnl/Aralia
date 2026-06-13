import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
const ev = async (fn, arg) => { try { return await page.evaluate(fn, arg); } catch { return null; } };
const click = (txt) => ev((s) => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim().includes(s) || x.getAttribute('aria-label') === s); if (b) { b.click(); return true; } return false; }, txt);
await page.goto('http://localhost:5176/Aralia/?wf_ground=1&wf_seed=42&wf_town=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 5000));
for (let i = 0; i < 50; i++) {
  const state = await ev(() => {
    const t = document.body.innerText;
    if (t.includes('Current Position')) return 'playing';
    if (t.includes('Generating party')) return 'wait';
    if (t.includes('Continue Journey')) return 'menu-save';
    if (t.includes('Begin Legend')) return 'menu';
    return 'wait';
  });
  if (state === 'playing') break;
  if (state === 'menu-save') await click('Continue Journey');
  else if (state === 'menu') { await click('Dev Menu'); await new Promise(r => setTimeout(r, 1500)); await click('Quick Start'); }
  await new Promise(r => setTimeout(r, 4000));
}
console.log('in PLAYING');
// 1. world map
await click('Toggle World Map');
await new Promise(r => setTimeout(r, 4000));
await page.screenshot({ path: 'disgust-1-worldmap.png', timeout: 15000 }).catch(() => {});
console.log('world map open; buttons:', await ev(() => [...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(t => t && t.length < 20).slice(0, 20)));
// 2. Enter 3D mode toggle
console.log('enter3d toggle:', await click('Enter 3D'));
await new Promise(r => setTimeout(r, 2000));
// 3. click the player tile: find the marker or compute from grid (15,10 of 30x20) on the map canvas
const res = await ev(() => {
  const marker = document.querySelector('.bg-red-500.rounded-full') ?? document.querySelector('[data-testid*="player" i]');
  let x, y;
  if (marker) { const r = marker.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
  else {
    const canvases = [...document.querySelectorAll('canvas')].map(c => ({ c, r: c.getBoundingClientRect() })).filter(o => o.r.width > 400);
    if (!canvases.length) return 'no big canvas';
    const { r } = canvases.sort((a, b) => b.r.width - a.r.width)[0];
    x = r.left + ((15 + 0.5) / 30) * r.width; y = r.top + ((10 + 0.5) / 20) * r.height;
  }
  const el = document.elementFromPoint(x, y);
  for (const t of ['pointerdown', 'pointerup', 'click']) el?.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: x, clientY: y, pointerId: 1, isPrimary: true, button: 0 }));
  return `clicked at ${Math.round(x)},${Math.round(y)} on ${el?.tagName}`;
});
console.log('tile click:', res);
await new Promise(r => setTimeout(r, 15000));
console.log('after:', await ev(() => document.body.innerText.slice(0, 80).replace(/\n/g, ' | ')));
await page.screenshot({ path: 'disgust-3-result.png', timeout: 15000 }).catch(() => console.log('shot3 failed'));
await browser.close();
