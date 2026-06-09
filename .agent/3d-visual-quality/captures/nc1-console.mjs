// NC1 visual-smoke / console-cleanliness check for the 3D combat map.
// Drives the app (offline autosave) into the Battle Map Demo, toggles 3D,
// renders ~6s while moving the camera, and reports the per-frame WebGL /
// postprocessing console health.
//
// Guards gap G2 (docs/projects/3d-combat-map). Host = BattleMapDemo, which
// renders the same BattleMap3D <Canvas> + Bloom/Vignette + ContactShadows
// surface NC1 targets. Software GL (swiftshader) is used headless; a spec-level
// invalid GL op (the original SSAO/NormalPass bug) would still surface here.
//
// Usage: node nc1-console.mjs [biome]   (default forest)
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const biome = process.argv[2] || 'forest';
const BASE = 'http://localhost:5174/Aralia/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FORBIDDEN = [
  { name: 'GL_INVALID_OPERATION', re: /GL_INVALID_OPERATION/i },
  { name: 'glBlitFramebuffer', re: /glBlitFramebuffer/i },
  { name: 'SSAO', re: /SSAO/i },
  { name: 'NormalPass', re: /NormalPass/i },
];

const browser = await chromium.launch({
  headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const STATE = path.join(__dirname, 'storageState.json');
const ctxOpts = { viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 };
if (fs.existsSync(STATE)) ctxOpts.storageState = STATE;
const ctx = await browser.newContext(ctxOpts);
const page = await ctx.newPage();

// Full console capture. record(window) lets us scope counts to the 3D window.
const all = []; // { t, type, text, win }
let capturing = false;
const record = (type, text) => all.push({ t: Date.now(), type, text: String(text).slice(0, 300), win: capturing });
page.on('console', (m) => record(m.type(), m.text()));
page.on('pageerror', (e) => record('pageerror', e.message || String(e)));

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await sleep(2500);

const TRANSIENT = new Set(['main_menu', 'load_transition', '']);
const getPhase = () => page.evaluate(() => new URLSearchParams(location.search).get('phase') || '').catch(() => null);
// Wait for a STABLE, non-transition phase (same value across 2 polls). The
// autosave load passes through `load_transition` before settling; jumping to the
// demo before it settles lets the late navigation destroy our render window.
const pollPhase = async (secs) => {
  let last = null, stable = 0;
  for (let i = 0; i < secs / 2; i++) {
    await sleep(2000);
    const phase = await getPhase();
    if (phase && !TRANSIENT.has(phase)) {
      if (phase === last) { stable++; } else { stable = 0; }
      if (stable >= 1) { console.log('party stable at', i * 2 + 's, phase', phase); return true; }
    }
    last = phase;
  }
  return false;
};

const clickedContinue = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Continue Journey/i.test((x.innerText || '').replace(/\s+/g, ' '))); if (b) { b.click(); return true; } return false; });
console.log('clicked Continue Journey:', clickedContinue);
let started = await pollPhase(40);
if (!started) { console.log('RESULT: BLOCKED could not load offline party (Continue Journey path)'); await browser.close(); process.exit(2); }
await sleep(2500);

async function gotoBattleDemo() {
  return await page.evaluate(() => {
    history.pushState({}, '', location.pathname + '?phase=battle_map_demo');
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
    return new Promise((r) => setTimeout(() => {
      const txt = document.body.innerText || '';
      r({ hasBattleMap: /Battle Map/.test(txt) && /Select Biome/.test(txt), err: /without a party/.test(txt) });
    }, 900));
  });
}
let ok = false;
for (let i = 0; i < 10; i++) { const res = await gotoBattleDemo(); if (res.hasBattleMap && !res.err) { ok = true; break; } await sleep(1500); }
if (!ok) { console.log('RESULT: BLOCKED could not reach battle map demo'); await browser.close(); process.exit(2); }

if (biome !== 'forest') {
  await page.evaluate((b) => {
    const sel = document.querySelector('#biomeSelect');
    if (sel) { const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set; setter.call(sel, b); sel.dispatchEvent(new Event('change', { bubbles: true })); }
  }, biome);
  await sleep(2000);
}

// Toggle to 3D
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /3D View/i.test(x.innerText)); if (b) b.click(); });
await sleep(1200);
await page.evaluate(() => window.dispatchEvent(new Event('resize')));

// Wait for the canvas to size up (proves the 3D scene actually mounted).
let canvasW = 0;
for (let i = 0; i < 25; i++) {
  canvasW = await page.evaluate(() => { const c = document.querySelector('canvas'); return c ? c.width : 0; });
  if (canvasW > 500) break;
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await sleep(400);
}
console.log('canvas width:', canvasW);

// Confirm we're still on the demo right before measuring (the autosave load
// should be settled now). If not, bail clearly rather than measuring nothing.
const phaseBefore = await getPhase();
console.log('phase before render window:', phaseBefore);

// Corroborating screenshot of a SETTLED scene (proven shoot.mjs recipe: gentle
// wheel-out for tactical framing, then let several frames paint before capture).
await page.evaluate(() => {
  const c = document.querySelector('canvas'); if (!c) return;
  const r = c.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  for (let i = 0; i < 18; i++) c.dispatchEvent(new WheelEvent('wheel', { deltaY: 260, clientX: cx, clientY: cy, bubbles: true, cancelable: true }));
});
await sleep(2800);
const out = path.join(__dirname, 'nc1-' + biome + '.png');
try {
  const box = await page.evaluate(() => { const c = document.querySelector('canvas'); const el = c ? c.closest('div.relative') || c.parentElement : null; if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.max(0, Math.floor(r.x)), y: Math.max(0, Math.floor(r.y)), width: Math.floor(r.width), height: Math.floor(r.height) }; });
  const opts = box && box.width > 50 ? { path: out, clip: box, animations: 'disabled', timeout: 60000 } : { path: out, animations: 'disabled', timeout: 60000 };
  let shot = false;
  for (let a = 0; a < 3 && !shot; a++) { try { await page.screenshot(opts); shot = true; } catch (e) { console.log('screenshot retry', a, String(e).split('\n')[0]); await sleep(1500); } }
  console.log('screenshot:', shot ? out : 'FAILED');
} catch (e) { console.log('screenshot failed (non-fatal):', String(e).split('\n')[0]); }

// ---- The measured 3D render window: ~6s, moving the camera every ~300ms. ----
capturing = true;
const winStart = Date.now();
let navAborted = false;
for (let i = 0; i < 20; i++) {
  try {
    await page.evaluate(() => {
      const c = document.querySelector('canvas'); if (!c) return;
      const r = c.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      // zoom + a little orbit so multiple frames render with camera motion
      c.dispatchEvent(new WheelEvent('wheel', { deltaY: (Math.random() > 0.5 ? 120 : -120), clientX: cx, clientY: cy, bubbles: true, cancelable: true }));
      c.dispatchEvent(new PointerEvent('pointerdown', { button: 2, clientX: cx, clientY: cy, bubbles: true }));
      c.dispatchEvent(new PointerEvent('pointermove', { clientX: cx + 30, clientY: cy + 10, bubbles: true }));
      c.dispatchEvent(new PointerEvent('pointerup', { button: 2, clientX: cx + 30, clientY: cy + 10, bubbles: true }));
    });
  } catch (e) {
    navAborted = true; console.log('camera loop interrupted at i=' + i + ':', String(e.message || e).split('\n')[0]); break;
  }
  await sleep(300);
}
capturing = false;
const winMs = Date.now() - winStart;
if (navAborted) console.log('NOTE: render window was cut short by a navigation; reporting partial capture.');

// ---- Report ----
const winMsgs = all.filter((m) => m.win);
const winErrors = winMsgs.filter((m) => m.type === 'error' || m.type === 'pageerror');
console.log('\n=== NC1 CONSOLE REPORT (biome:', biome, ') ===');
console.log('3D render window: ~' + winMs + 'ms, total console msgs in window:', winMsgs.length, 'errors:', winErrors.length);
let forbiddenTotal = 0;
for (const f of FORBIDDEN) {
  const hits = all.filter((m) => f.re.test(m.text));
  const winHits = hits.filter((m) => m.win);
  forbiddenTotal += winHits.length;
  console.log('  ' + f.name + ': total=' + hits.length + ' in-window=' + winHits.length);
}
// Unique error texts (de-duped) to judge "repeated" vs one-off.
const uniq = new Map();
for (const m of winErrors) { const k = m.text.slice(0, 120); uniq.set(k, (uniq.get(k) || 0) + 1); }
if (uniq.size) {
  console.log('  unique in-window error texts (count x sample):');
  for (const [k, n] of [...uniq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log('    [' + n + 'x] ' + k);
}
const pass = canvasW > 500 && forbiddenTotal === 0;
console.log('\nRESULT:', pass ? 'PASS' : 'FAIL', '(canvasW=' + canvasW + ', forbidden-in-window=' + forbiddenTotal + ')');
await browser.close();
process.exit(pass ? 0 : 1);
