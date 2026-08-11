/**
 * Entity quality campaign — contact-sheet capture rig.
 *
 * Usage: node tools/entityQuality/capture.mjs <piece> [--round N] [--note "..."]
 * Pieces: humanoid-anatomy | humanoid-motion | creature-anatomy | surface-materials | all
 *
 * Captures the debugger's contactSheet() per subject, plus 6-frame walk strips
 * for motion subjects, into public/entity-quality/sheets/<piece>/. Then appends
 * a round record to public/entity-quality/status.json (the live progress page
 * reads it). Needs Remy's dev server on 127.0.0.1:3000.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:3000/Aralia/misc/design.html?step=entitydebug';
const OUT_ROOT = 'public/entity-quality';

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
  ],
  'surface-materials': [
    { id: 'human-fighter', query: 'race=human&class=fighter' },
    { id: 'dragon', query: 'fixture=dragon' },
  ],
};

const piece = process.argv[2];
const roundArg = process.argv.indexOf('--round');
const round = roundArg > -1 ? Number(process.argv[roundArg + 1]) : 0;
const noteArg = process.argv.indexOf('--note');
const note = noteArg > -1 ? process.argv[noteArg + 1] : '';
if (!piece || (piece !== 'all' && !SUBJECTS[piece])) {
  console.error(`usage: capture.mjs <${Object.keys(SUBJECTS).join('|')}|all> [--round N] [--note ...]`);
  process.exit(1);
}
const pieces = piece === 'all' ? Object.keys(SUBJECTS) : [piece];

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
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
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
  if (pieceId === 'humanoid-anatomy' || pieceId === 'creature-anatomy') {
    const idleBtn = await page.$('text=idle');
    if (!idleBtn) throw new Error(`idle action button not found for ${subj.id}`);
    await idleBtn.click();
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
    try {
      await captureSubject(p, subj);
      captured.push(`${p}/${subj.id}`);
    } catch (err) {
      console.error(`FAIL ${p}/${subj.id}: ${err.message}`);
    }
  }
}
await browser.close();

// status.json append (create if absent)
const statusFile = path.join(OUT_ROOT, 'status.json');
const status = existsSync(statusFile)
  ? JSON.parse(readFileSync(statusFile, 'utf8').replace(/^\uFEFF/, ''))
  : { rounds: [] };
status.rounds.push({ at: new Date().toISOString(), piece, round, note, captured });
writeFileSync(statusFile, JSON.stringify(status, null, 2) + '\n');
console.log(`status.json += round ${round} (${captured.length} captures)`);
