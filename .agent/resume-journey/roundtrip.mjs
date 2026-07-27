// Resume-journey round-trip gate (tracker task 1, leg 2).
// resume → mutate surface (3D → Atlas) → wait for autosave → reload →
// Continue Journey → assert the surface change survived the round trip.
//
// Usage: node .agent/resume-journey/roundtrip.mjs [label]
//        HEADED=1 node .agent/resume-journey/roundtrip.mjs [label]  ← watch it run
//        BASE_URL=http://localhost:5174/Aralia/ ...                 ← another port
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { BASE, seededContextOptions, hasSeedState, launchOptions } from './rigContext.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const label = process.argv[2] || 'roundtrip';
const EVIDENCE = path.join(__dirname, 'evidence');
fs.mkdirSync(EVIDENCE, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch(launchOptions());
if (!hasSeedState()) console.warn('WARNING: no storageState.json — running without a saved session');
console.log('target:', BASE);
const ctx = await browser.newContext(
  seededContextOptions({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 }),
);
const page = await ctx.newPage();
const consoleLog = [];
page.on('console', m => consoleLog.push({ t: Date.now(), type: m.type(), text: m.text().slice(0, 300) }));
page.on('pageerror', e => consoleLog.push({ t: Date.now(), type: 'pageerror', text: String(e).slice(0, 300) }));

const probe = () => page.evaluate(() => window.__araliaState ?? null);
const clickButton = (re) => page.evaluate((src) => {
  const rx = new RegExp(src, 'i');
  const b = [...document.querySelectorAll('button')].find(x => rx.test((x.innerText || '').replace(/\s+/g, ' ').trim()));
  if (b) { b.click(); return (b.innerText || '').trim().slice(0, 60); }
  return null;
}, re.source);

const continueJourney = async (tag) => {
  const clicked = await clickButton(/Continue Journey/);
  console.log(`[${tag}] clicked:`, JSON.stringify(clicked));
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const s = await probe();
    if (s?.phase === 'PLAYING' && !s.isLoading) return s;
  }
  return await probe();
};

// ── Leg A: boot + resume (3D surface) ───────────────────────────────────────
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await sleep(3000);
let live = await continueJourney('resume1');
console.log('[resume1] worldViewMode:', live?.worldViewMode, 'phase:', live?.phase);
await sleep(2000);

// ── Leg B: switch surface 3D → Atlas ────────────────────────────────────────
const atlasClick = await clickButton(/^Atlas$/);
console.log('[switch] clicked:', JSON.stringify(atlasClick));
await sleep(2500);
live = await probe();
console.log('[switch] worldViewMode now:', live?.worldViewMode);
await page.screenshot({ path: path.join(EVIDENCE, `${label}-atlas.png`) });
const switchedMode = live?.worldViewMode;

// ── Leg C: wait for the autosave to capture the change ─────────────────────
// Watch for the slot index to move PAST the timestamp it held before the
// mutation, rather than testing wall-clock freshness — the seeded session's
// own lastSaved is months old, and the rolling autosave's latency is variable
// (the 1-second clock tick keeps resetting its debounce; see GAPS #4). A
// fixed-freshness test against a short window reported "NOT OBSERVED" for
// saves that had simply not landed yet.
const readAutoSlot = () => page.evaluate(() => {
  try {
    const idx = JSON.parse(localStorage.getItem('aralia_rpg_save_slots_index') || '[]');
    return idx.find((s) => s.slotId === 'aralia_rpg_autosave')?.lastSaved ?? null;
  } catch { return null; }
});
const baselineSavedAt = await readAutoSlot();
const saveDeadline = Date.now() + 60000;
let savedAt = null;
while (Date.now() < saveDeadline) {
  await sleep(1500);
  const lastSaved = await readAutoSlot();
  if (lastSaved && lastSaved !== baselineSavedAt) { savedAt = lastSaved; break; }
}
console.log('[autosave] baseline slot timestamp:', baselineSavedAt ? new Date(baselineSavedAt).toISOString() : 'none');
console.log('[autosave] captured:', savedAt ? new Date(savedAt).toISOString() : 'NOT OBSERVED');

// ── Leg D: reload → Continue Journey → verify the surface survived ─────────
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await sleep(3000);
live = await continueJourney('resume2');
await sleep(2500);
live = await probe();
console.log('[resume2] worldViewMode:', live?.worldViewMode, 'phase:', live?.phase,
  'location:', live?.currentLocationId, 'party:', JSON.stringify(live?.partyNames));
await page.screenshot({ path: path.join(EVIDENCE, `${label}-resume2.png`) });

const errors = consoleLog.filter(c => c.type === 'error' || c.type === 'pageerror');
const verdict = {
  label,
  ranAt: new Date().toISOString(),
  switchedModeAfterClick: switchedMode,
  autosaveObserved: !!savedAt,
  resumedWorldViewMode: live?.worldViewMode ?? null,
  roundTripPreservedSurface: switchedMode === 'atlas' && live?.worldViewMode === 'atlas',
  finalState: live,
  consoleErrorCount: errors.length,
  consoleErrors: errors.slice(0, 30),
};
fs.writeFileSync(path.join(EVIDENCE, `${label}-result.json`), JSON.stringify(verdict, null, 2));
console.log('\n=== VERDICT ===');
console.log(JSON.stringify({ ...verdict, finalState: undefined, consoleErrors: errors.slice(0, 8) }, null, 2));
await browser.close();
