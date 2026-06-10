// Headless capture of the 3D battle map demo across biomes.
// Usage: node shoot.mjs <label> <biome1,biome2,...>
// Writes <label>-<biome>.png into this folder.
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const label = process.argv[2] || 'shot';
const biomes = (process.argv[3] || 'forest').split(',').map(s => s.trim()).filter(Boolean);
const BASE = 'http://localhost:5174/Aralia/';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({
  headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const STATE = path.join(__dirname, 'storageState.json');
const ctxOpts = { viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 };
if (fs.existsSync(STATE)) { ctxOpts.storageState = STATE; }
const ctx = await browser.newContext(ctxOpts);
// LINEUP=1 → spawn the dev-only race lineup (one fighter per race) instead of the
// normal party, so race-driven character visuals can be judged side by side.
if (process.env.LINEUP) {
  await ctx.addInitScript(() => { window.__BM3D_RACE_LINEUP = true; });
}
// CREATURELINEUP=1 → enemy creature lineup (goblin/skeleton/beast/orc/ogre) for
// verifying creature-form + size visuals.
if (process.env.CREATURELINEUP) {
  await ctx.addInitScript(() => { window.__BM3D_CREATURE_LINEUP = true; });
}
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await sleep(2500);

const pollPhase = async (label, secs) => {
  for (let i = 0; i < secs/2; i++) {
    await sleep(2000);
    const st = await page.evaluate(() => ({ phase: new URLSearchParams(location.search).get('phase') }));
    if (i % 3 === 0) console.log(`  ${label}`, i*2+'s', JSON.stringify(st));
    if (st.phase && st.phase !== 'main_menu') { console.log('party ready at', i*2+'s, phase', st.phase); return true; }
  }
  return false;
};

// Injected storageState carries the real autosave → click "Continue Journey" to
// load it (real party, fully offline, no AI). Fall back to Quick Start if absent.
const clickedContinue = await page.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>/Continue Journey/i.test((x.innerText||'').replace(/\s+/g,' '))); if (b){ b.click(); return true;} return false; });
console.log('clicked Continue Journey:', clickedContinue);
let started = await pollPhase('waiting save load...', 30);

if (!started) {
  console.log('continue failed; falling back to Dev Menu -> Quick Start (AI)');
  await page.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>/^Dev Menu/i.test((x.innerText||'').replace(/\s+/g,' '))); if (b) b.click(); });
  await sleep(800);
  await page.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>/Quick Start/i.test((x.innerText||'').replace(/\s+/g,' '))); if (b) b.click(); });
  started = await pollPhase('waiting quick-start party...', 150);
}
if (!started) { console.log('party never started'); console.log('errors:', errors.slice(0,10)); await browser.close(); process.exit(1); }
await sleep(2000);

// 3) Jump to battle map demo (party now exists, so history-sync accepts it)
async function gotoBattleDemo() {
  return await page.evaluate(() => {
    history.pushState({}, '', location.pathname + '?phase=battle_map_demo');
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    return new Promise(r => setTimeout(() => {
      const txt = (document.body.innerText || '');
      r({ hasBattleMap: /Battle Map/.test(txt) && /Select Biome/.test(txt), err: /without a party/.test(txt), phase: new URLSearchParams(location.search).get('phase') });
    }, 900));
  });
}

let ok = false;
for (let i = 0; i < 10; i++) {
  const res = await gotoBattleDemo();
  console.log('attempt', i, JSON.stringify(res));
  if (res.hasBattleMap && !res.err) { ok = true; break; }
  await sleep(1800);
}
if (!ok) { console.log('FAILED to reach battle map demo'); console.log('errors:', errors.slice(0,10)); await browser.close(); process.exit(1); }

// Toggle to 3D
await page.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>/3D View/i.test(x.innerText)); if (b) b.click(); });
await sleep(1200);
await page.evaluate(() => window.dispatchEvent(new Event('resize')));
await sleep(500);

async function waitCanvasSized() {
  for (let i=0;i<20;i++){
    const w = await page.evaluate(() => { const c=document.querySelector('canvas'); return c ? c.width : 0; });
    if (w > 500) return w;
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await sleep(400);
  }
  return 0;
}

async function selectBiome(biome) {
  await page.evaluate((b) => {
    const sel = document.querySelector('#biomeSelect');
    if (sel) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
      setter.call(sel, b);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, biome);
  await sleep(2500);
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await sleep(800);
}

// Optional: override the R3F camera to a high tactical-overview pose so the whole
// battlefield (and spawn spread) is visible, instead of the snap-to-active close cam.
async function applyOverview() {
  // Drive OrbitControls the supported way: dispatch wheel-zoom-out on the canvas
  // to pull back to ~maxDistance for a wide tactical overview.
  return await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return 'no-canvas';
    const r = c.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (let i = 0; i < 24; i++) {
      c.dispatchEvent(new WheelEvent('wheel', { deltaY: 260, clientX: cx, clientY: cy, bubbles: true, cancelable: true }));
    }
    return 'wheeled-out';
  });
}

async function shoot(name) {
  const w = await waitCanvasSized();
  if (process.env.OVERVIEW) { console.log('overview:', JSON.stringify(await applyOverview())); await sleep(1500); }
  await sleep(2500); // let scene settle / render frames
  // Deterministic camera pose via the dev hook (window.__bm3dCam). Format:
  // POSE="distance,polarDeg,azimuthDeg" e.g. POSE="33,75,40" for a low
  // horizon-facing tactical shot. Needs the CameraController dev hook.
  if (process.env.POSE) {
    const args = process.env.POSE.split(',').map(Number);
    const r = await page.evaluate((a) => {
      const c = window.__bm3dCam;
      return c && c.pose ? c.pose(a[0], a[1], a[2]) : 'no-hook';
    }, args);
    console.log('pose:', JSON.stringify(r));
    await sleep(1500);
  }
  // POSETEAM="team,distance,polarDeg,azimuthDeg" → frame a team's centroid
  // (e.g. POSETEAM="player,16,72,30" for the race lineup).
  if (process.env.POSETEAM) {
    const parts = process.env.POSETEAM.split(',');
    const team = parts[0];
    const nums = parts.slice(1).map(Number);
    const r = await page.evaluate(([t, a]) => {
      const c = window.__bm3dCam;
      return c && c.poseTeam ? c.poseTeam(t, a[0], a[1], a[2]) : 'no-hook';
    }, [team, nums]);
    console.log('poseTeam:', JSON.stringify(r));
    await sleep(1500);
  }
  const box = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const el = c ? (c.closest('div.relative') || c.parentElement) : null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.max(0, Math.floor(r.x)), y: Math.max(0, Math.floor(r.y)), width: Math.floor(r.width), height: Math.floor(r.height) };
  });
  const out = path.join(__dirname, name + '.png');
  const opts = (box && box.width > 50 && box.height > 50)
    ? { path: out, clip: box, animations: 'disabled', timeout: 60000 }
    : { path: out, animations: 'disabled', timeout: 60000 };
  let ok = false;
  for (let attempt = 0; attempt < 3 && !ok; attempt++) {
    try { await page.screenshot(opts); ok = true; }
    catch (e) { console.log('  screenshot retry', attempt, String(e).split('\n')[0]); await sleep(1500); }
  }
  console.log(ok ? 'shot' : 'SHOT FAILED', out, 'canvasW', w, 'box', JSON.stringify(box));
}

const first = biomes[0] || 'forest';
if (first !== 'forest') await selectBiome(first);
await shoot(`${label}-${first}`);
for (const b of biomes.slice(1)) {
  await selectBiome(b);
  await shoot(`${label}-${b}`);
}

console.log('done. errors:', errors.slice(0, 8));
await browser.close();
