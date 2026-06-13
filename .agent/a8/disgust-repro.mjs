import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
const ev = async (fn, arg) => { try { return await page.evaluate(fn, arg); } catch { return null; } };
const click = (txt) => ev((s) => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim().includes(s) || x.getAttribute('aria-label') === s); if (b) { b.click(); return true; } return false; }, txt);
await page.goto('http://localhost:5176/Aralia/?wf_ground=1&wf_seed=42&wf_town=1', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 5000));
// boot to PLAYING 3D
for (let i = 0; i < 50; i++) {
  const state = await ev(() => {
    const t = document.body.innerText;
    if (t.includes('3D World View')) return '3d';
    if (t.includes('Generating party')) return 'wait';
    if (t.includes('Current Position')) return 'playing';
    if (t.includes('Continue Journey')) return 'menu-save';
    if (t.includes('Begin Legend')) return 'menu';
    return 'wait';
  });
  if (state === '3d') break;
  if (state === 'menu-save') await click('Continue Journey');
  else if (state === 'menu') { await click('Dev Menu'); await new Promise(r => setTimeout(r, 1500)); await click('Quick Start'); }
  else if (state === 'playing') await click('Enter 3D World');
  await new Promise(r => setTimeout(r, 4000));
}
console.log('step 0: in 3D');
// 1. go to world map (Atlas)
await click('Atlas') || await click('Open Map');
await new Promise(r => setTimeout(r, 5000));
console.log('step 1 (atlas):', await ev(() => document.body.innerText.slice(0, 120).replace(/\n/g, ' | ')));
await page.screenshot({ path: 'disgust-1-atlas.png', timeout: 15000 }).catch(() => console.log('shot1 failed'));
// 2. enable Enter 3D mode in the map pane
const e3 = await click('Enter 3D');
console.log('step 2: Enter 3D toggle clicked =', e3);
await new Promise(r => setTimeout(r, 2000));
// 3. click the player tile — find the player marker; fallback: click map center where marker usually is
const clicked = await ev(() => {
  // try a player marker element
  const marker = document.querySelector('[data-testid*="player"], [aria-label*="player" i], [class*="player-marker"]');
  if (marker) { const r = marker.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2); el?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + r.width/2, clientY: r.top + r.height/2 })); return 'marker'; }
  return 'no-marker';
});
console.log('step 3 marker:', clicked);
await page.screenshot({ path: 'disgust-2-map.png', timeout: 15000 }).catch(() => console.log('shot2 failed'));
await browser.close();
