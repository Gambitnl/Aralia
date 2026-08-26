/**
 * shoot.mjs — capture one screenshot per water mode for the water catalog.
 *
 * The catalog page (src/components/DesignPreview/steps/water/) shows a card per
 * water mode, and each card wants a picture of that water actually running. A
 * card with no picture says so rather than showing a stand-in, so a missing
 * capture is honest but useless. This fills them in.
 *
 * WHY A SCRIPT AND NOT A BROWSER SESSION. Several modes need the page driven —
 * a Start click, a wait for a worker to build terrain, a settle time while
 * water accumulates. Doing that by hand once produces images nobody can
 * reproduce. This is re-runnable, so a mode that changes can be re-shot.
 *
 * USAGE
 *   node tools/waterShots/shoot.mjs              # every recipe
 *   node tools/waterShots/shoot.mjs sheet land   # only the named ones
 *
 * Writes public/water-modes/<id>.png. The dev server must already be running;
 * this never starts one. Override the host with BASE_URL.
 *
 * WEBGPU MODES WILL PROBABLY FAIL HERE, and that is the correct outcome. The
 * droplet, brick-grid and FFT-ocean modes refuse to draw without WebGPU rather
 * than falling back to something that looks plausible. If the capture comes out
 * empty, the card keeps saying "no capture yet", which is true.
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.join(REPO, 'public', 'water-modes');
const BASE = process.env.BASE_URL || 'http://localhost:3000/Aralia/misc/design.html';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * One capture.
 *   id      — the file name, and the `shot` value the catalog will carry.
 *   query   — the design-page query string.
 *   ready   — runs in the page; true when the scene is worth photographing.
 *   drive   — optional: clicks to make, by visible button text, in order.
 *   settle  — milliseconds to let water accumulate after `ready` and `drive`.
 */
const RECIPES = [
  {
    id: 'land-sheet',
    query: 'step=land',
    ready: () => /\d+ wet cells/.test(document.body.innerText)
      && !/0 wet cells/.test(document.body.innerText),
    /* Long, because this spring fills a valley rather than a basin. At 20 s the
     * pool is a speck in a 240 m patch and the capture shows terrain, not
     * water. */
    settle: 70000,
    /* Frame the water instead of the patch. `__waterDebug` reports the deepest
     * drawn column; the grid is 240 cells at 1 m and centred, so the cell index
     * minus half the grid IS the scene coordinate. Same move a person makes by
     * scrolling, done repeatably. */
    pose: () => {
      const w = window.__waterDebug && window.__waterDebug();
      const cam = window.__volCam;
      if (!w || !w.deepProbe || !cam) return 'no probe';
      const p = w.deepProbe;
      const sx = p.cellX - 120;
      const sz = p.cellZ - 120;
      const sy = p.waterSurfaceY;
      cam.set(sx + 52, sy + 34, sz + 52, sx, sy, sz);
      return `framed cell ${p.cellX},${p.cellZ} at ${p.depthM.toFixed(1)} m deep`;
    },
  },
  {
    id: 'water-sheet',
    query: 'step=water&water=sheet',
    ready: () => /Thin layer/.test(document.body.innerText),
    drive: ['Start'],
    settle: 15000,
  },
  {
    id: 'water-droplets',
    query: 'step=water&water=droplets',
    ready: () => /Droplets/.test(document.body.innerText),
    drive: ['Start'],
    settle: 12000,
  },
  {
    id: 'water-grid',
    query: 'step=water&water=grid',
    ready: () => /cell grid/i.test(document.body.innerText),
    drive: ['Start'],
    settle: 12000,
  },
  {
    id: 'ocean-fft',
    query: 'step=water&ocean=1',
    ready: () => /ocean/i.test(document.body.innerText),
    settle: 9000,
  },
  {
    id: 'town3d',
    query: 'step=town3d',
    ready: () => document.querySelectorAll('canvas').length > 0,
    settle: 25000,
    /* CANVAS ONLY. This step shows the 2D town plan beside the 3D scene, and
     * the plan is an SVG that is usually the bigger of the two — so the default
     * selector photographs the map when the world water is the subject. */
    prefer: 'canvas',
  },
  {
    id: 'worldforge',
    query: 'step=worldforge',
    ready: () => document.querySelectorAll('canvas,svg').length > 0,
    settle: 20000,
  },
  {
    id: 'dungeon',
    query: 'step=dungeon',
    ready: () => document.querySelectorAll('canvas,svg').length > 0,
    settle: 15000,
  },
  {
    id: 'biome',
    query: 'step=biome',
    ready: () => document.querySelectorAll('canvas').length > 0,
    settle: 15000,
  },
  {
    id: 'battlemap',
    query: 'step=battlemap',
    ready: () => document.querySelectorAll('canvas').length > 0,
    settle: 15000,
  },
];

const want = process.argv.slice(2);
const todo = want.length ? RECIPES.filter((r) => want.includes(r.id)) : RECIPES;
if (!todo.length) {
  console.error(`no recipe matched: ${want.join(', ')}`);
  console.error(`known: ${RECIPES.map((r) => r.id).join(', ')}`);
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: CHROME,
  args: [
    '--ignore-gpu-blocklist',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--enable-features=Vulkan,UnsafeWebGPU',
  ],
});
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 1,
});

const results = [];

for (const r of todo) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 160));
  });
  const url = `${BASE}?${r.query}`;
  /* The step id is the scope for every later lookup: the window that holds
   * this step is `window-design-preview-window-<step>`, and the design page
   * keeps other steps' windows mounted around it. */
  const step = new URLSearchParams(r.query).get('step');
  const stepScope = `#window-design-preview-window-${step}`;
  process.stdout.write(`\n[${r.id}] ${url}\n`);
  try {
    await page.goto(url, { waitUntil: 'commit', timeout: 180000 });
    await sleep(4000);

    /* Close every OTHER step window first. The design page restores whatever
     * layout was last open, so a stale window can sit on top of the one being
     * photographed — which is how a run aimed at the water step came back with
     * a picture of the town picker. */
    const closed = await page
      .evaluate((keep) => {
        let n = 0;
        for (const w of document.querySelectorAll('[id^="window-design-preview-window-"]')) {
          if (w.id === `window-design-preview-window-${keep}`) continue;
          const x = w.querySelector('button[title="Close"], button[aria-label="Close"]');
          if (x) {
            x.click();
            n += 1;
          }
        }
        return n;
      }, step)
      .catch(() => 0);
    if (closed) process.stdout.write(`  closed ${closed} other window(s)\n`);
    await sleep(1200);

    // Maximize THIS step's window so the scene is not a thumbnail.
    await page
      .locator(`${stepScope} button[title="Maximize window"]`)
      .first()
      .click({ timeout: 8000 })
      .catch(() => {});
    await sleep(1500);

    let ok = false;
    for (let i = 0; i < 150; i++) {
      ok = await page.evaluate(r.ready).catch(() => false);
      if (ok) break;
      await sleep(2000);
    }
    if (!ok) {
      process.stdout.write(`  not ready after 5 min — skipped\n`);
      results.push({ id: r.id, ok: false, why: 'never became ready' });
      await page.close();
      continue;
    }
    process.stdout.write(`  ready\n`);

    /* CLICK INSIDE THE STEP'S WINDOW, AND MATCH THE LABEL EXACTLY.
     *
     * A loose page-wide match for "Start" hit the "Start Point" button in the
     * top navigation, which opened that step in a window ON TOP of the water
     * pane — and the capture then photographed a town picker while the water
     * status line still read "no water yet". Both halves of that fault were
     * silent: the click succeeded, and the screenshot was of a real page. */
    for (const label of r.drive || []) {
      const btn = page
        .locator(stepScope)
        .getByRole('button', { name: label, exact: true })
        .first();
      await btn.click({ timeout: 10000 }).catch(() => {
        process.stdout.write(`  could not click "${label}" inside ${stepScope}\n`);
      });
      await sleep(1200);
    }

    process.stdout.write(`  settling ${r.settle} ms\n`);
    await sleep(r.settle);

    if (r.pose) {
      const said = await page.evaluate(r.pose).catch((e) => `pose failed: ${e}`);
      process.stdout.write(`  pose: ${said}\n`);
      await sleep(2500);
    }

    const file = path.join(OUT, `${r.id}.png`);
    /* Clip INSIDE THE STEP'S OWN WINDOW, and to the largest drawing surface in
     * it — never to the first match in the document.
     *
     * Two faults made this necessary, and both produced a confident wrong
     * picture rather than an error. The design page keeps previously opened
     * step windows mounted, so "the biggest canvas on the page" captured a
     * stale world atlas while the water step sat behind it. And the first
     * canvas in document order is regularly a 16-pixel legend glyph, which slid
     * past the size guard below into a full-page screenshot.
     *
     * Windows are keyed `window-design-preview-window-<step>`, so the step id
     * in the query IS the scope. */
    const box = await page
      .evaluate(({ stepId, sel }) => {
        const root = document.getElementById(`window-design-preview-window-${stepId}`);
        if (!root) return { err: `no window for step "${stepId}"` };
        let best = null;
        let area = 0;
        for (const el of root.querySelectorAll(sel)) {
          const r2 = el.getBoundingClientRect();
          const a = r2.width * r2.height;
          if (a > area) {
            area = a;
            best = { x: r2.x, y: r2.y, width: r2.width, height: r2.height };
          }
        }
        return best ?? { err: 'no drawing surface inside the window' };
      }, { stepId: step, sel: r.prefer || 'canvas, svg' })
      .catch(() => null);
    if (box && box.err) process.stdout.write(`  clip: ${box.err}\n`);
    if (box && box.width > 400 && box.height > 300) {
      await page.screenshot({
        path: file,
        clip: { x: box.x, y: box.y, width: box.width, height: box.height },
      });
    } else {
      await page.screenshot({ path: file });
    }
    const bytes = fs.statSync(file).size;
    process.stdout.write(`  wrote ${path.relative(REPO, file)} (${(bytes / 1024).toFixed(0)} kB)\n`);
    if (errors.length) process.stdout.write(`  console errors: ${errors.length}\n`);
    results.push({ id: r.id, ok: true, bytes, errors: errors.length });
  } catch (e) {
    process.stdout.write(`  FAILED: ${String(e).slice(0, 200)}\n`);
    results.push({ id: r.id, ok: false, why: String(e).slice(0, 120) });
  }
  await page.close();
}

await browser.close();

process.stdout.write('\n=== summary ===\n');
for (const x of results) {
  process.stdout.write(
    x.ok ? `  OK    ${x.id} (${(x.bytes / 1024).toFixed(0)} kB)\n` : `  MISS  ${x.id} — ${x.why}\n`,
  );
}
