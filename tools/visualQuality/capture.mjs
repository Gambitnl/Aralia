/**
 * Visual quality campaign — sheet capture and registration rig.
 *
 * Two modes.
 *
 * 1. CAPTURE (entity pieces only — they have an automated rig):
 *      node tools/visualQuality/capture.mjs <piece|all> [--round N] [--note "..."]
 *    Captures the debugger's contactSheet() per subject, plus 6-frame walk strips
 *    for motion subjects, into public/visual-quality/sheets/<piece>/.
 *    Needs Remy's dev server on 127.0.0.1:3000.
 *
 * 2. REGISTER (world pieces — NO automated rig exists):
 *      node tools/visualQuality/capture.mjs register <piece> --round N --note "..." \
 *        --sheet <id>=<path/to.png> [--sheet <id>=<path.png> ...]
 *    Copies each PNG into the piece's sheet directory under the standard
 *    round-<N>-<id>.png name. It renders NOTHING. World-piece proof rigs are
 *    one-off scripts under .agent/scratch/ and are run by hand.
 *
 * Both modes append a round record to public/visual-quality/status.json, which
 * the judging portal reads. The piece list comes from public/visual-quality/pieces.json.
 */
// playwright is imported lazily, inside the capture mode only. `register` and the
// usage/failure paths must not pay for a browser they never launch.
import { mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync } from 'node:fs';
import path from 'node:path';

// round 21 (humanoid-anatomy): the shared :3000 server can be LISTENING but
// dead — it went unresponsive for >200 s at a stretch and three agents logged
// it in the same window. `--base http://127.0.0.1:<port>` (or ENTITYQ_BASE)
// points the rig at a private Vite instead of blocking the whole campaign.
const baseArg = process.argv.indexOf('--base');
const ORIGIN = (baseArg > -1 ? process.argv[baseArg + 1] : process.env.ENTITYQ_BASE) || 'http://127.0.0.1:3000';
const BASE = `${ORIGIN.replace(/\/$/, '')}/Aralia/misc/design.html?step=entitydebug`;
const OUT_ROOT = 'public/visual-quality';

/** subject -> { query, motion } ; motion subjects also get a frame strip */
const SUBJECTS = {
  'humanoid-anatomy': [
    { id: 'human-fighter', query: 'race=human&class=fighter' },
    { id: 'orc-barbarian', query: 'race=orc&class=barbarian' },
    { id: 'dwarf-fighter', query: 'race=hill_dwarf&class=fighter' },
  ],
  'humanoid-motion': [
    { id: 'human-walk-clip', query: 'race=human&class=fighter&clip=1', motion: true },
    { id: 'human-walk-proc', query: 'race=human&class=fighter', motion: true },
  ],
  'creature-anatomy': [
    { id: 'dragon', query: 'fixture=dragon' },
    { id: 'serpent', query: 'fixture=threeHeadedSerpent' },
    { id: 'ooze', query: 'fixture=tentacledOoze' },
    // Remy 2026-08-12: random archetype rolls are part of the judged set —
    // the generator's default plans must pass the same bar as the fixtures.
    { id: 'beast-large', query: 'mode=creature&type=Beast&size=Large&seed=1' },
    { id: 'celestial-large', query: 'mode=creature&type=Celestial&size=Large&seed=1' },
    // Remy 2026-08-12: the spread wing only shows in walk — judge it too.
    { id: 'dragon-walk', query: 'fixture=dragon', action: 'walk' },
    // Remy 2026-08-12: 14 elemental references set the archetype bar —
    // see .agent/critique-refs/elementals/DESIGN-LANGUAGE.md.
    { id: 'elemental-large', query: 'mode=creature&type=Elemental&size=Large&seed=1' },
  ],
  'surface-materials': [
    { id: 'human-fighter', query: 'race=human&class=fighter' },
    { id: 'dragon', query: 'fixture=dragon' },
  ],
};

const statusFile = path.join(OUT_ROOT, 'status.json');

/**
 * Read JSON, tolerating a leading BOM. status.json must stay BOM-free on write —
 * a BOM crashed this updater once — but a hand-edited file may still carry one.
 */
function readJson(file) {
  let text = readFileSync(file, 'utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return JSON.parse(text);
}

/** The piece registry drives both this rig and the portal. One source of truth. */
const piecesFile = path.join(OUT_ROOT, 'pieces.json');
if (!existsSync(piecesFile)) {
  console.error(`missing piece registry: ${piecesFile}`);
  process.exit(1);
}
const REGISTRY = readJson(piecesFile);
const PIECE_BY_ID = Object.fromEntries(REGISTRY.pieces.map((p) => [p.id, p]));

/** Append one round record. Shared by both modes. Keeps status.json BOM-free. */
function appendRound(pieceId, round, note, captured) {
  const status = existsSync(statusFile)
    ? readJson(statusFile)
    : { rounds: [] };
  status.rounds.push({ at: new Date().toISOString(), piece: pieceId, round, note, captured });
  writeFileSync(statusFile, JSON.stringify(status, null, 2) + '\n');
  console.log(`status.json += ${pieceId} round ${round} (${captured.length} sheets)`);
}

const roundArg = process.argv.indexOf('--round');
const round = roundArg > -1 ? Number(process.argv[roundArg + 1]) : 0;
const noteArg = process.argv.indexOf('--note');
const note = noteArg > -1 ? process.argv[noteArg + 1] : '';

// ---- mode 2: register hand-captured sheets (world pieces) --------------------
if (process.argv[2] === 'register') {
  const pieceId = process.argv[3];
  const entry = PIECE_BY_ID[pieceId];
  if (!entry) {
    console.error(`unknown piece "${pieceId}". Known: ${Object.keys(PIECE_BY_ID).join(', ')}`);
    process.exit(1);
  }
  if (roundArg < 0) {
    console.error('register requires --round N');
    process.exit(1);
  }
  const sheets = [];
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] !== '--sheet') continue;
    const spec = process.argv[i + 1] || '';
    const eq = spec.indexOf('=');
    if (eq < 1) {
      console.error(`bad --sheet "${spec}": expected <id>=<path.png>`);
      process.exit(1);
    }
    sheets.push({ id: spec.slice(0, eq), src: spec.slice(eq + 1) });
  }
  if (!sheets.length) {
    console.error('register requires at least one --sheet <id>=<path.png>');
    process.exit(1);
  }
  const dir = path.join(OUT_ROOT, 'sheets', pieceId);
  mkdirSync(dir, { recursive: true });
  const captured = [];
  for (const s of sheets) {
    if (!existsSync(s.src)) {
      console.error(`FAIL ${pieceId}/${s.id}: source not found: ${s.src}`);
      process.exit(1);
    }
    const dest = path.join(dir, `round-${round}-${s.id}.png`);
    copyFileSync(s.src, dest);
    console.log('sheet', dest, '<-', s.src);
    captured.push(`${pieceId}/${s.id}`);
  }
  appendRound(pieceId, round, note, captured);
  process.exit(0);
}

// ---- mode 1: automated capture (entity pieces) -------------------------------
const piece = process.argv[2];
// round 20: the shared :3000 server intermittently takes ~160 s to serve
// design.html (others see "504 Outdated Optimize Dep" in the same window), and
// a fixed 40 s goto turned that into a hard capture FAIL.
const gotoArg = process.argv.indexOf('--goto-timeout');
const gotoTimeout = gotoArg > -1 ? Number(process.argv[gotoArg + 1]) : 180000;
const retriesArg = process.argv.indexOf('--retries');
const retries = retriesArg > -1 ? Number(process.argv[retriesArg + 1]) : 2;
if (!piece) {
  console.error(`usage: capture.mjs <${Object.keys(SUBJECTS).join('|')}|all> [--round N] [--note ...]`);
  console.error(`       capture.mjs register <piece> --round N --sheet <id>=<path.png> [--sheet ...]`);
  process.exit(1);
}
// No-fallback rule: a piece without an automated rig FAILS here. It does not
// silently capture nothing, and it does not pretend a rig exists.
if (piece !== 'all' && !SUBJECTS[piece]) {
  const entry = PIECE_BY_ID[piece];
  if (entry && entry.rig === 'manual') {
    console.error(`"${piece}" has NO automated capture rig.`);
    console.error(`Its proof rigs are one-off scripts under .agent/scratch/. Run one by hand, then:`);
    console.error(`  node tools/visualQuality/capture.mjs register ${piece} --round N --note "..." --sheet <id>=<path.png>`);
  } else {
    console.error(`unknown piece "${piece}". Known: ${Object.keys(PIECE_BY_ID).join(', ')}`);
  }
  process.exit(1);
}
const pieces = piece === 'all' ? Object.keys(SUBJECTS) : [piece];

const { chromium } = await import('playwright');
const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitReady(needClips) {
  for (let i = 0; i < 60; i++) {
    const ok = await page.evaluate(
      (needClips2) =>
        !!(window.__entitydebug && window.__entitydebug.contactSheet && window.__entitydebug.handle) &&
        (!needClips2 || !!document.querySelector('canvas')),
      needClips,
    );
    if (ok) return true;
    await sleep(1000);
  }
  return false;
}

async function captureSubject(pieceId, subj) {
  const url = `${BASE}&wire=0&${subj.query}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: gotoTimeout });
  if (!(await waitReady(subj.query.includes('clip=1')))) {
    throw new Error(`debugger never became ready for ${subj.id} (${url})`);
  }
  // round 4 (humanoid-anatomy): the debugger's default action is WALK, so
  // anatomy sheets were freezing a mid-stride frame — one knee cocked inward,
  // silhouette off-balance. Anatomy is judged on the planted idle stance:
  // click the idle action before the settle wait.
  // round 5 (creature-anatomy): same rule for creatures — a walking dragon
  // spreads its wings (wingFold 0), so anatomy sheets never showed the rest
  // fold and the side profile grew two wing peaks. Anatomy = planted idle.
  // round 23+ (Remy): a subject may pin another action (e.g. walk for the
  // spread-wing state); the anatomy default stays the planted idle.
  if (pieceId === 'humanoid-anatomy' || pieceId === 'creature-anatomy') {
    const action = subj.action || 'idle';
    const btn = await page.$(`text=${action}`);
    if (!btn) throw new Error(`${action} action button not found for ${subj.id}`);
    await btn.click();
  }
  await sleep(subj.query.includes('clip=1') ? 4000 : 2500); // clip load + pose settle
  const dir = path.join(OUT_ROOT, 'sheets', pieceId);
  mkdirSync(dir, { recursive: true });

  const sheet = await page.evaluate(() => window.__entitydebug.contactSheet());
  const sheetFile = path.join(dir, `round-${round}-${subj.id}.png`);
  writeFileSync(sheetFile, Buffer.from(String(sheet).split(',')[1] || '', 'base64'));
  console.log('sheet', sheetFile);

  if (subj.motion) {
    // 6-frame walk strip: click walk, sample the live canvas over one stride
    const walkBtn = await page.$('text=walk');
    if (walkBtn) await walkBtn.click();
    await sleep(800);
    const frames = [];
    for (let f = 0; f < 6; f++) {
      const dataUrl = await page.evaluate(() => {
        const d = window.__entitydebug;
        d.renderer.render(d.scene, d.camera);
        return d.renderer.domElement.toDataURL('image/png');
      });
      frames.push(dataUrl);
      await sleep(180);
    }
    const strip = await page.evaluate((frames2) => {
      return new Promise((resolve) => {
        const imgs = [];
        let loaded = 0;
        for (const src of frames2) {
          const im = new Image();
          im.onload = () => {
            loaded++;
            if (loaded === frames2.length) {
              const w = imgs[0].width / 2;
              const h = imgs[0].height / 2;
              const c = document.createElement('canvas');
              c.width = w * frames2.length;
              c.height = h;
              const ctx = c.getContext('2d');
              imgs.forEach((img, i) => ctx.drawImage(img, i * w, 0, w, h));
              resolve(c.toDataURL('image/png'));
            }
          };
          im.src = src;
          imgs.push(im);
        }
      });
    }, frames);
    const stripFile = path.join(dir, `round-${round}-${subj.id}-strip.png`);
    writeFileSync(stripFile, Buffer.from(String(strip).split(',')[1] || '', 'base64'));
    console.log('strip', stripFile);
  }
}

const captured = [];
for (const p of pieces) {
  for (const subj of SUBJECTS[p]) {
    let done = false;
    for (let attempt = 0; attempt <= retries && !done; attempt++) {
      try {
        await captureSubject(p, subj);
        captured.push(`${p}/${subj.id}`);
        done = true;
      } catch (err) {
        const last = attempt === retries;
        console.error(`${last ? 'FAIL' : 'retry'} ${p}/${subj.id}: ${err.message}`);
        if (!last) await sleep(5000);
      }
    }
  }
}
await browser.close();

appendRound(piece, round, note, captured);
