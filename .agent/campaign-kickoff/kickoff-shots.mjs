// Campaign-kickoff capture: world atlas (Azgaar), submap, World3D, village view.
// One-off visual-reference rig for the 2026-06 proc-gen pipeline spec session.
// Based on .agent/3d-visual-quality/captures/shoot.mjs (storageState autosave load).
// Usage: node kickoff-shots.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE = path.resolve(__dirname, '../3d-visual-quality/captures/storageState.json');
const BASE = 'http://localhost:5174/Aralia/';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({
  headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const ctxOpts = { viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 };
if (fs.existsSync(STATE)) ctxOpts.storageState = STATE;
const ctx = await browser.newContext(ctxOpts);
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });

const shot = async (name) => {
  const p = path.join(__dirname, `${name}.png`);
  await page.screenshot({ path: p });
  const phase = await page.evaluate(() => new URLSearchParams(location.search).get('phase'));
  console.log('shot', name, 'phase=', phase);
};

// --- 1. Landing: load autosave via Continue Journey -------------------------
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await sleep(3000);
const cont = page.getByRole('button', { name: /continue journey/i });
if (await cont.count()) { await cont.first().click(); console.log('clicked Continue Journey'); }
await sleep(9000); // allow load transition + first paint (3D chunks if landing in 3D)
await shot('kick-landing');

// Dump visible button labels to find the map/3D toggles for later steps.
const labels = await page.evaluate(() =>
  Array.from(document.querySelectorAll('button'))
    .map(b => (b.getAttribute('aria-label') || b.title || b.textContent || '').trim().slice(0, 40))
    .filter(Boolean).slice(0, 80)
);
console.log('buttons:', JSON.stringify(labels));

// --- 2. Toggle to the Atlas (Azgaar world map) view --------------------------
// The 3D/Atlas toggles live in the collapsed "Controls" menu on the World3D
// surface; expand it first, then force-click Atlas (toggle may sit offscreen).
try {
  const controls = page.getByRole('button', { name: /controls/i });
  if (await controls.count()) { await controls.first().click(); await sleep(800); }
  await shot('kick-controls-open');
  // The Atlas toggle lives in an offscreen-positioned container, so Playwright
  // actionability fails even with force — dispatch the DOM click directly.
  const clicked = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button'))
      .find(b => /atlas/i.test(b.textContent || ''));
    if (btn) { btn.click(); return true; }
    return false;
  });
  console.log('atlas DOM click:', clicked);
  await sleep(9000); // Azgaar iframe generation takes a few seconds
  await shot('kick-atlas');
  const hasIframe = await page.evaluate(() => !!document.querySelector('iframe'));
  console.log('azgaar iframe present:', hasIframe);
} catch (e) {
  console.log('atlas step failed:', String(e).slice(0, 200));
}

// --- 2b. Village view via in-session pushState (cold ?phase=village_view bounces) ---
try {
  await page.evaluate(() => {
    history.pushState({}, '', location.pathname + '?phase=village_view');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await sleep(7000);
  await shot('kick-village-insession');
} catch (e) {
  console.log('village pushState failed:', String(e).slice(0, 200));
}

// --- 3. World3D via URL phase ------------------------------------------------
await page.goto(BASE + '?phase=world3d', { waitUntil: 'domcontentloaded' });
await sleep(14000); // chunk streaming first paint
await shot('kick-world3d');

// --- 4. Village view via URL phase -------------------------------------------
await page.goto(BASE + '?phase=village_view', { waitUntil: 'domcontentloaded' });
await sleep(7000);
await shot('kick-village');

console.log('done. errors:', JSON.stringify(errors.slice(0, 10)));
await browser.close();
