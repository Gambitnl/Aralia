// Deterministic check for the camera-proximity foliage fade (gap #16).
// One page load (one map seed): screenshot wheeled-OUT (foliage far → opaque)
// then wheeled-IN (foliage near → should be translucent). Same scene, only
// camera distance differs, so the opacity delta isolates the fade.
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:5174/Aralia/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true, args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, storageState: path.join(__dirname, 'storageState.json') });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await sleep(2500);
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Continue Journey/i.test(x.innerText || '')); if (b) b.click(); });
const TRANSIENT = new Set(['main_menu', 'load_transition', '']);
let last = null, stable = null;
for (let i = 0; i < 22; i++) { await sleep(2000); const p = await page.evaluate(() => new URLSearchParams(location.search).get('phase') || ''); if (p && !TRANSIENT.has(p)) { if (p === last) { stable = p; break; } last = p; } else last = p; }
console.log('stable phase:', stable);
await sleep(2000);
for (let i = 0; i < 10; i++) { const r = await page.evaluate(() => { history.pushState({}, '', location.pathname + '?phase=battle_map_demo'); window.dispatchEvent(new PopStateEvent('popstate', { state: {} })); return new Promise(res => setTimeout(() => res(/Select Biome/.test(document.body.innerText || '')), 900)); }); if (r) break; await sleep(1500); }
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /3D View/i.test(x.innerText)); if (b) b.click(); });
await sleep(1500);
await page.evaluate(() => window.dispatchEvent(new Event('resize')));
for (let i = 0; i < 20; i++) { const w = await page.evaluate(() => { const c = document.querySelector('canvas'); return c ? c.width : 0; }); if (w > 500) break; await page.evaluate(() => window.dispatchEvent(new Event('resize'))); await sleep(400); }

const wheel = (dir, n) => page.evaluate(({ dir, n }) => { const c = document.querySelector('canvas'); if (!c) return; const r = c.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2; for (let i = 0; i < n; i++) c.dispatchEvent(new WheelEvent('wheel', { deltaY: dir * 220, clientX: cx, clientY: cy, bubbles: true, cancelable: true })); }, { dir, n });
const shot = async (name) => { await sleep(2200); const box = await page.evaluate(() => { const c = document.querySelector('canvas'); const el = c ? c.closest('div.relative') || c.parentElement : null; if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.max(0, Math.floor(r.x)), y: Math.max(0, Math.floor(r.y)), width: Math.floor(r.width), height: Math.floor(r.height) }; }); const out = path.join(__dirname, name + '.png'); for (let a = 0; a < 3; a++) { try { await page.screenshot(box && box.width > 50 ? { path: out, clip: box, animations: 'disabled', timeout: 60000 } : { path: out, animations: 'disabled', timeout: 60000 }); break; } catch { await sleep(1200); } } console.log('shot', out); };

// FAR: wheel out to overview (all foliage beyond fade range → opaque)
await wheel(1, 24);
await shot('fade-far');
// NEAR: wheel back in hard (foliage within fade range → should fade out)
await wheel(-1, 40);
await shot('fade-near');
console.log('done');
await browser.close();
