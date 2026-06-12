// Resume-journey end-to-end audit (tracker task 1).
// Loads the app with the real autosave (storageState), reads the saved payload,
// clicks "Continue Journey", then diffs the restored live state (via the dev
// probe window.__araliaState) against what the save contains. Writes evidence
// JSON + console transcript + before/after screenshots into ./evidence/.
//
// Usage: node .agent/resume-journey/audit.mjs [label]
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const label = process.argv[2] || 'audit';
const BASE = 'http://localhost:5174/Aralia/';
const STATE = path.join(__dirname, '..', '3d-visual-quality', 'captures', 'storageState.json');
const EVIDENCE = path.join(__dirname, 'evidence');
fs.mkdirSync(EVIDENCE, { recursive: true });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({
  headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const ctxOpts = { viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 };
if (fs.existsSync(STATE)) ctxOpts.storageState = STATE;
else console.warn('WARNING: no storageState.json — running without a saved session');
const ctx = await browser.newContext(ctxOpts);
const page = await ctx.newPage();

const consoleLog = [];
page.on('console', m => consoleLog.push({ t: Date.now(), type: m.type(), text: m.text().slice(0, 400) }));
page.on('pageerror', e => consoleLog.push({ t: Date.now(), type: 'pageerror', text: String(e).slice(0, 400) }));

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await sleep(3000);

// ── 1. Read the saved payload (localStorage first, IndexedDB fallback) ──────
const savedSummary = await page.evaluate(async () => {
  const summarize = (raw, source, key) => {
    try {
      const parsed = JSON.parse(raw);
      const s = parsed.state || parsed;
      return {
        source, key,
        slotName: parsed.slotName ?? null,
        saveVersion: s.saveVersion ?? null,
        saveTimestamp: s.saveTimestamp ?? null,
        phase: s.phase,
        worldViewMode: s.worldViewMode ?? null,
        currentLocationId: s.currentLocationId,
        subMapCoordinates: s.subMapCoordinates,
        playerWorldPos: s.playerWorldPos ?? null,
        partySize: (s.party || []).length,
        partyNames: (s.party || []).map(p => p.name),
        gold: s.gold,
        inventoryCount: (s.inventory || []).length,
        gameTime: s.gameTime,
        isSubmapVisible: s.isSubmapVisible,
        isMapVisible: s.isMapVisible,
        isThreeDVisible: s.isThreeDVisible ?? false,
        hasMapData: !!s.mapData,
        worldSeed: s.worldSeed ?? null,
      };
    } catch (e) { return { source, key, parseError: String(e) }; }
  };

  // Slot index (localStorage, synchronous)
  let slotIndex = null;
  try { slotIndex = JSON.parse(localStorage.getItem('aralia_rpg_save_slots_index') || 'null'); } catch { /* ignore */ }
  const latest = (slotIndex || []).slice().sort((a, b) => b.lastSaved - a.lastSaved)[0] ?? null;

  // Candidate payload keys, newest-indexed first.
  const keys = [
    ...(latest ? [latest.slotId] : []),
    'aralia_rpg_autosave',
    'aralia_rpg_default_save',
  ];
  for (const key of [...new Set(keys)]) {
    const raw = localStorage.getItem(key);
    if (raw) return { slotIndex, picked: summarize(raw, 'localStorage', key) };
  }
  // IndexedDB fallback
  const idbRead = (key) => new Promise((resolve) => {
    const req = indexedDB.open('aralia_rpg_saves');
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('saves')) return resolve(null);
      const get = db.transaction('saves', 'readonly').objectStore('saves').get(key);
      get.onsuccess = () => resolve(get.result?.data ?? null);
      get.onerror = () => resolve(null);
    };
  });
  for (const key of [...new Set(keys)]) {
    const raw = await idbRead(key);
    if (raw) return { slotIndex, picked: summarize(raw, 'IndexedDB', key) };
  }
  return { slotIndex, picked: null };
});

console.log('saved payload:', JSON.stringify(savedSummary.picked, null, 2));
await page.screenshot({ path: path.join(EVIDENCE, `${label}-menu.png`) });

// ── 2. Click Continue Journey ────────────────────────────────────────────────
const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(x => /Continue Journey/i.test((x.innerText || '').replace(/\s+/g, ' ')));
  if (b) { b.click(); return (b.innerText || '').replace(/\s+/g, ' ').trim(); }
  return null;
});
console.log('clicked:', JSON.stringify(clicked));
const clickAt = Date.now();

// ── 3. Poll the dev state probe through LOAD_TRANSITION → PLAYING ──────────
const phaseTrail = [];
let live = null;
for (let i = 0; i < 30; i++) {
  await sleep(1000);
  live = await page.evaluate(() => window.__araliaState ?? null);
  const phase = live?.phase ?? 'no-probe';
  if (phaseTrail[phaseTrail.length - 1]?.phase !== phase) {
    phaseTrail.push({ atMs: Date.now() - clickAt, phase });
    console.log(`  +${Date.now() - clickAt}ms phase=${phase}`);
  }
  if (phase === 'PLAYING' && !live.isLoading) break;
}
await sleep(2500); // let the surface settle
live = await page.evaluate(() => window.__araliaState ?? null);
const surfaceText = await page.evaluate(() => (document.body.innerText || '').slice(0, 600));
await page.screenshot({ path: path.join(EVIDENCE, `${label}-resumed.png`) });

// ── 4. Diff saved vs live ────────────────────────────────────────────────────
const saved = savedSummary.picked ?? {};
const diffs = [];
const cmp = (field, savedVal, liveVal, note) => {
  const eq = JSON.stringify(savedVal) === JSON.stringify(liveVal);
  if (!eq) diffs.push({ field, saved: savedVal, live: liveVal, ...(note ? { note } : {}) });
  return eq;
};
if (live) {
  cmp('currentLocationId', saved.currentLocationId, live.currentLocationId);
  cmp('subMapCoordinates', saved.subMapCoordinates, live.subMapCoordinates);
  cmp('worldViewMode', saved.worldViewMode, live.worldViewMode);
  cmp('playerWorldPos', saved.playerWorldPos, live.playerWorldPos);
  cmp('partyNames', saved.partyNames, live.partyNames);
  cmp('gold', saved.gold, live.gold);
  cmp('inventoryCount', saved.inventoryCount, live.inventoryCount);
  cmp('gameTime', saved.gameTime, live.gameTime, 'live clock starts ticking after resume — small drift expected');
  cmp('isSubmapVisible', saved.isSubmapVisible, live.isSubmapVisible, 'forced false on save AND load by design');
}

const errors = consoleLog.filter(c => c.type === 'error' || c.type === 'pageerror');
const result = {
  label,
  ranAt: new Date().toISOString(),
  savedPayload: savedSummary.picked,
  slotIndex: savedSummary.slotIndex,
  clickedButton: clicked,
  phaseTrail,
  liveStateAfterResume: live,
  surfaceTextSnippet: surfaceText,
  diffs,
  consoleErrorCount: errors.length,
  consoleErrors: errors.slice(0, 40),
};
fs.writeFileSync(path.join(EVIDENCE, `${label}-result.json`), JSON.stringify(result, null, 2));
fs.writeFileSync(path.join(EVIDENCE, `${label}-console.json`), JSON.stringify(consoleLog, null, 2));

console.log('\n=== DIFFS (saved vs live) ===');
console.log(JSON.stringify(diffs, null, 2));
console.log(`\nconsole errors during resume: ${errors.length}`);
errors.slice(0, 12).forEach(e => console.log('  [err]', e.text.slice(0, 200)));
console.log('\nevidence written to', EVIDENCE);
await browser.close();
