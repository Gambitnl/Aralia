// NC2 integration check: CombatView 3D mount + pop-out lifecycle / render-mode restore.
// Guards gap G3 (docs/projects/3d-combat-map) and resolves the stale 3d-visual-quality
// task-24 claim ("CombatView 3D mode broken — R3F Canvas silently fails in ErrorBoundary").
//
// Flow: load offline party with ?dev_combat=1 -> COMBAT (CombatView) -> toggle 3D ->
// check canvas vs ErrorBoundary fallback -> pop out -> verify 3D persists -> return ->
// verify renderMode still 3d. The dev_combat hook replaced the older System Menu route
// because the saved fixture can land in World3D, where that menu is intentionally absent.
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:5174/Aralia/?dev_combat=1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FALLBACK = 'An error occurred in the Battle Map.';
const FORBIDDEN = [/GL_INVALID_OPERATION/i, /glBlitFramebuffer/i, /SSAO/i, /NormalPass/i];

const browser = await chromium.launch({ headless: true, args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
const STATE = path.join(__dirname, 'storageState.json');
const ctxOpts = { viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 };
if (fs.existsSync(STATE)) ctxOpts.storageState = STATE;
const ctx = await browser.newContext(ctxOpts);
const page = await ctx.newPage();
const errs = [];
let capturing = false;
page.on('console', (m) => { if (m.type() === 'error' && capturing) errs.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => { if (capturing) errs.push('pageerror: ' + (e.message || e)); });

const clickByText = (re) => page.evaluate((src) => { const re = new RegExp(src, 'i'); const els = [...document.querySelectorAll('button, [role="menuitem"], [role="button"]')]; const b = els.find((x) => re.test((x.innerText || '').replace(/\s+/g, ' ').trim())); if (b) { b.click(); return true; } return false; }, re.source);
const hasText = (re) => page.evaluate((src) => { const re = new RegExp(src, 'i'); return [...document.querySelectorAll('button, [role="menuitem"], [role="button"]')].some((x) => re.test((x.innerText || '').replace(/\s+/g, ' ').trim())); }, re.source);
const clickBySel = (sel) => page.evaluate((s) => { const b = document.querySelector(s); if (b) { b.click(); return true; } return false; }, sel);
const bodyHas = (s) => page.evaluate((t) => (document.body.innerText || '').includes(t), s);
const bigCanvas = () => page.evaluate(() => { const cs = [...document.querySelectorAll('canvas')]; return cs.some((c) => c.width > 300 && c.height > 200); });
const turnOrderLabels = () => page.evaluate(() => [...document.querySelectorAll('button[aria-label*=", turn "]')]
  .map((b) => b.getAttribute('aria-label') || '')
  .filter(Boolean));
const inspectFirstToken = () => page.evaluate(() => {
  const button = document.querySelector('button[aria-label^="Inspect "]');
  if (!button) return null;
  button.click();
  return button.getAttribute('aria-label')?.replace(/^Inspect\s+/, '') || null;
});
const inspectorTitle = () => page.evaluate(() => document.querySelector('#window-combat-inspector-window h2')?.textContent?.trim() || null);

function fail(msg) { console.log('RESULT: BLOCKED', msg); console.log('errs:', errs.slice(0, 8)); browser.close(); process.exit(2); }

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await sleep(2500);

// 1) Load offline party, wait for the dev hook to move the save into CombatView.
// The hook is gated by dev tools and fires only after the saved journey reaches PLAYING.
await clickByText(/Continue Journey/);
const TRANSIENT = new Set(['main_menu', 'load_transition', '']);
const getPhase = () => page.evaluate(() => new URLSearchParams(location.search).get('phase') || '').catch(() => null);
let stablePhase = null, last = null;
for (let i = 0; i < 30; i++) {
  await sleep(2000);
  const p = await getPhase();
  if (p === 'combat') { stablePhase = p; break; }
  if (p && !TRANSIENT.has(p)) { if (p === last) stablePhase = p; last = p; } else last = p;
}
if (!stablePhase) fail('party never reached a stable phase');
console.log('stable phase:', stablePhase);
let inCombat = false;
for (let i = 0; i < 15; i++) { await sleep(1000); if ((await bodyHas('Combat Encounter')) && (await bodyHas('Debug: Auto-Win'))) { inCombat = true; break; } }
if (!inCombat) fail('CombatView (Combat Encounter) never rendered after Simulate Battle');
console.log('CombatView reached.');
await sleep(1500);

// 2) Toggle to 3D inline. title="Switch to 3D view" when currently 2d.
const toggled = await clickBySel('button[title="Switch to 3D view"]');
console.log('clicked inline 3D toggle:', toggled);
capturing = true;
await sleep(1500);
await page.evaluate(() => window.dispatchEvent(new Event('resize')));

// 3) Critical fact: did BattleMap3D mount (canvas) or hit the ErrorBoundary fallback?
let canvas3d = false;
for (let i = 0; i < 18; i++) { canvas3d = await bigCanvas(); if (canvas3d) break; await page.evaluate(() => window.dispatchEvent(new Event('resize'))); await sleep(400); }
const fallbackInline = await bodyHas(FALLBACK);
const modeAfterToggle = await page.evaluate(() => { const b = document.querySelector('button[title="Switch to 2D view"]'); return b ? '3d' : '2d'; });
console.log('inline 3D mount: canvasMounted=' + canvas3d + ' errorBoundaryFallback=' + fallbackInline + ' renderMode=' + modeAfterToggle);

// 4) Capture combat lifecycle state before the map leaves the embedded pane.
// The initiative labels prove the visible turn order, and the inspector window
// gives us a durable visible selected-token proxy because the internal selected
// character id is intentionally not exported to the browser.
const turnBeforePopout = await turnOrderLabels();
const selectedTokenName = await inspectFirstToken();
await sleep(800);
const inspectedBeforePopout = await inspectorTitle();
console.log('state before pop-out: turnOrder=' + JSON.stringify(turnBeforePopout) + ' inspected=' + inspectedBeforePopout);

// brief camera-motion render window for console health
for (let i = 0; i < 10; i++) {
  try { await page.evaluate(() => { const c = [...document.querySelectorAll('canvas')].find((x) => x.width > 300); if (!c) return; const r = c.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2; c.dispatchEvent(new WheelEvent('wheel', { deltaY: 160, clientX: cx, clientY: cy, bubbles: true, cancelable: true })); }); } catch { break; }
  await sleep(250);
}

// settle + screenshot of CombatView 3D
await sleep(1500);
const shot = path.join(__dirname, 'nc2-combatview-3d.png');
try { await page.screenshot({ path: shot, animations: 'disabled', timeout: 60000 }); console.log('screenshot:', shot); } catch (e) { console.log('screenshot failed:', String(e).split('\n')[0]); }

// 5) Pop-out lifecycle (best-effort; only meaningful if 3D mounted inline).
let popoutTitle3d = null, popoutCanvas = null, modeAfterReturn = null, toggleWorksAfter = null, turnOrderPersisted = null, inspectedTokenPersisted = null;
if (canvas3d && !fallbackInline) {
  if (await clickBySel('button[title="Pop out battle map into resizable window"]')) {
    await sleep(1800);
    popoutTitle3d = await bodyHas('Battle Map (3D)');
    let pc = false; for (let i = 0; i < 12; i++) { pc = await bigCanvas(); if (pc) break; await page.evaluate(() => window.dispatchEvent(new Event('resize'))); await sleep(400); }
    popoutCanvas = pc;
    console.log('pop-out: title shows 3D=' + popoutTitle3d + ' canvasMounted=' + popoutCanvas);
    // interact: advance/select via End Turn if present (non-fatal)
    await clickByText(/End Turn/).catch(() => {});
    await sleep(800);
    const turnAfterInteraction = await turnOrderLabels();
    // return: close the pop-out window
    if (await clickBySel('#window-battle-map-window button[aria-label="Close"]')) {
      await sleep(1500);
      modeAfterReturn = await page.evaluate(() => { const b = document.querySelector('button[title="Switch to 2D view"]'); return b ? '3d' : '2d'; });
      const canvasBack = await bigCanvas();
      const turnAfterReturn = await turnOrderLabels();
      const inspectedAfterReturn = await inspectorTitle();
      turnOrderPersisted = JSON.stringify(turnAfterReturn) === JSON.stringify(turnAfterInteraction);
      inspectedTokenPersisted = !!selectedTokenName && inspectedAfterReturn === selectedTokenName;
      // toggle still works: flip to 2d then back to 3d
      const t1 = await clickBySel('button[title="Switch to 2D view"]'); await sleep(800);
      const t2 = await clickBySel('button[title="Switch to 3D view"]'); await sleep(800);
      toggleWorksAfter = t1 && t2;
      console.log('after return: renderMode=' + modeAfterReturn + ' canvasMounted=' + canvasBack + ' toggleWorks=' + toggleWorksAfter);
      console.log('state after return: turnOrder=' + JSON.stringify(turnAfterReturn) + ' turnOrderPersisted=' + turnOrderPersisted + ' inspected=' + inspectedAfterReturn + ' inspectedTokenPersisted=' + inspectedTokenPersisted);
    } else { console.log('could not find pop-out Close button'); }
  } else { console.log('could not find pop-out button'); }
}
capturing = false;

// ---- Report ----
const forbiddenHits = errs.filter((t) => FORBIDDEN.some((re) => re.test(t)));
console.log('\n=== NC2 REPORT ===');
console.log('combatReached: true');
console.log('inline3dMount:', canvas3d, '| errorBoundaryFallback:', fallbackInline, '| renderMode:', modeAfterToggle);
console.log('popout: title3d=' + popoutTitle3d + ' canvas=' + popoutCanvas + ' | afterReturn renderMode=' + modeAfterReturn + ' toggleWorks=' + toggleWorksAfter);
console.log('state persistence: turnOrder=' + turnOrderPersisted + ' inspectedToken=' + inspectedTokenPersisted + ' selectedToken=' + selectedTokenName);
console.log('forbidden console hits during 3D:', forbiddenHits.length, forbiddenHits.slice(0, 4));
console.log('total captured errors during 3D window:', errs.length);
const uniq = new Map(); for (const e of errs) { const k = e.slice(0, 100); uniq.set(k, (uniq.get(k) || 0) + 1); }
for (const [k, n] of [...uniq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log('   [' + n + 'x] ' + k);

const pass = canvas3d && !fallbackInline && forbiddenHits.length === 0 && popoutTitle3d === true && popoutCanvas === true && modeAfterReturn === '3d' && turnOrderPersisted === true && inspectedTokenPersisted === true;
console.log('\nRESULT:', pass ? 'PASS' : (canvas3d && !fallbackInline ? 'PARTIAL' : 'FAIL'));
await browser.close();
process.exit(pass ? 0 : 1);
