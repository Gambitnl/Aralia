/**
 * shoot.mjs — capture one screenshot per water mode for the water catalog.
 *
 * The catalog page (src/components/DesignPreview/steps/water/) shows a card per
 * water mode, and each card wants a picture of that water actually running. A
 * card with no picture says so rather than showing a stand-in, so a missing
 * capture is honest but useless. This fills them in.
 *
 * WHY A SCRIPT AND NOT A BROWSER SESSION. Most modes need the page DRIVEN: a
 * Start click, a theme picked so the scene even contains water, a view tab
 * switched, a wait while a worker builds terrain, a settle while water piles
 * up. Done by hand once, that produces images nobody can reproduce. This is
 * re-runnable, so a mode that changes can be re-shot.
 *
 * USAGE
 *   node tools/waterShots/shoot.mjs                 # every recipe
 *   node tools/waterShots/shoot.mjs land-sheet      # only the named ones
 *   node tools/waterShots/shoot.mjs --list          # recipe ids
 *
 * Writes public/water-modes/<id>.png. The dev server must already be running;
 * this never starts one. Override the host with BASE_URL.
 *
 * THREE TRAPS THIS FILE EXISTS TO AVOID, all of which produced a convincing
 * WRONG picture rather than an error:
 *
 *   1. The design page keeps other steps' windows MOUNTED. "The biggest canvas
 *      on the page" photographed a stale world atlas while the water step sat
 *      behind it. Everything here is scoped to the step's own window.
 *   2. A loose button match for "Start" hit the "Start Point" button in the top
 *      navigation, which opened that step ON TOP of the water pane. Labels are
 *      matched exactly AND scoped to the step window.
 *   3. A scene can simply contain no water. A walled town with no river and a
 *      crypt with no sump both photograph fine and show nothing. Recipes pick a
 *      subject that HAS water, and `verify` rejects the shot when it does not.
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.join(REPO, 'public', 'water-modes');
const BASE = process.env.BASE_URL || 'http://localhost:3000/Aralia/misc/design.html';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * One capture.
 *   id       file name, and the `shot` value the catalog carries
 *   query    the design-page query string
 *   ready    runs in the page; true when the scene is worth driving
 *   drive    button labels to click, in order, inside the step's own window
 *   prepare  async (page, scope) for anything a label list cannot express
 *   settle   milliseconds to let water accumulate, after ready and drive
 *   pose     runs in the page; aim the camera at the water
 *   prefer   element selector to clip to (default 'canvas, svg')
 *   verify   runs in the page after settle; return a string to REJECT the shot
 */
/* WHY READINESS IS STRUCTURAL AND NOT TEXT.
 *
 * These three land recipes used to test for the phrase "N wet cells" in the
 * page text. The ledger was rebuilt as a LIST on 2026-08-26, which put the
 * number and its label in separate elements, so the phrase stopped existing and
 * all three recipes waited six minutes and gave up. A capture rig that reads a
 * label is hostage to every wording change. `__waterDebug` is a handle the page
 * exports on purpose, so it moves only when someone means it to. */
const landWet = () => {
  const w = window.__waterDebug && window.__waterDebug();
  return !!w && w.wetVerts > 0;
};

const RECIPES = [
  {
    id: 'land-sheet',
    query: 'step=land',
    ready: landWet,
    settle: 70000,
    /* Frame the water instead of the patch. `__waterDebug` reports the deepest
     * drawn column; the grid is 240 cells at 1 m and centred, so the cell index
     * minus half the grid IS the scene coordinate. */
    pose: () => {
      const w = window.__waterDebug && window.__waterDebug();
      const cam = window.__volCam;
      if (!w || !w.deepProbe || !cam) return 'no probe';
      const p = w.deepProbe;
      const sx = p.cellX - 120;
      const sz = p.cellZ - 120;
      const sy = p.waterSurfaceY;
      cam.set(sx + 52, sy + 34, sz + 52, sx, sy, sz);
      return 'framed cell ' + p.cellX + ',' + p.cellZ + ' at ' + p.depthM.toFixed(1) + ' m deep';
    },
  },
  {
    id: 'land-droplets',
    query: 'step=land',
    ready: landWet,
    /* OPEN THE DECK, SWITCH THE MODEL, CLOSE THE DECK AGAIN.
     *
     * All three steps belong together, and the close matters as much as the
     * open: the deck is a floating overlay across the top of the window, the
     * clip below takes the window, and so the first two captures of this mode
     * were forty percent controls panel. Toggling it from inside page script
     * did not work; driving the same cog through the browser does. */
    prepare: async (page, scope) => {
      const cog = page
        .locator(scope + ' button[title="Terrain, tools, and water controls"]')
        .first();
      await cog.click({ timeout: 8000 }).catch(() => {});
      await sleep(1800);
      const hit = await page.evaluate(() => {
        for (const el of document.querySelectorAll('button')) {
          if (el.textContent.trim() === 'droplets') { el.click(); return true; }
        }
        return false;
      });
      process.stdout.write('  model -> droplets: ' + (hit ? 'ok' : 'MISSED') + String.fromCharCode(10));
      await sleep(2500);
      await cog.click({ timeout: 8000 }).catch(() => {});
      await sleep(1500);
    },
    settle: 95000,
    pose: () => {
      /* HIDE THE DECK, do not try to toggle it.
       *
       * The deck is a floating overlay ACROSS the canvas, so a clip to the
       * canvas always contains it - two captures of this mode came back forty
       * percent controls panel. Clicking the cog a second time did not close
       * it. Hiding the element is what works, and it changes nothing about the
       * scene being photographed. */
      for (const el of document.querySelectorAll('div')) {
        if (el.textContent.includes('LIGHT AND TIME')
          && el.textContent.includes('WATER AND SIMULATION')
          && el.textContent.length < 1200) {
          let node = el;
          for (let i = 0; i < 6 && node; i += 1) {
            const pos = getComputedStyle(node).position;
            if (pos === 'absolute' || pos === 'fixed') { node.style.display = 'none'; break; }
            node = node.parentElement;
          }
          break;
        }
      }
      const cam = window.__volCam;
      const w = window.__waterDebug && window.__waterDebug();
      if (!cam) return 'no camera';
      if (!w || !w.deepProbe) return 'no probe';
      const p = w.deepProbe;
      cam.set(
        p.cellX - 120 + 46, p.waterSurfaceY + 30, p.cellZ - 120 + 46,
        p.cellX - 120, p.waterSurfaceY, p.cellZ - 120,
      );
      return 'framed the pour at cell ' + p.cellX + ',' + p.cellZ;
    },
    clipBelowText: 'WATER AND SIMULATION',
  },
  {
    id: 'water-sheet',
    query: 'step=water&water=sheet',
    ready: () => /Thin layer/.test(document.body.innerText),
    drive: ['Start'],
    settle: 20000,
  },
  {
    id: 'water-droplets',
    query: 'step=water&water=droplets',
    ready: () => /Droplets/.test(document.body.innerText),
    drive: ['Start', 'Drop the dam'],
    settle: 7000,
    prefer: 'canvas',
    verify: () => (/needs WebGPU|WebGPU is missing|no WebGPU|requires WebGPU/i.test(
      document.body.innerText,
    ) ? 'the pane reports WebGPU missing' : null),
  },
  {
    id: 'water-grid',
    query: 'step=water&water=grid',
    ready: () => /cell grid/i.test(document.body.innerText),
    drive: ['Start'],
    settle: 20000,
    prefer: 'canvas',
    verify: () => (/needs WebGPU|WebGPU is missing|no WebGPU|requires WebGPU/i.test(
      document.body.innerText,
    ) ? 'the pane reports WebGPU missing' : null),
  },
  {
    id: 'ocean-fft',
    query: 'step=water&ocean=1',
    ready: () => /ocean/i.test(document.body.innerText),
    settle: 16000,
    prefer: 'canvas',
    /* CHECK FOR A DRAWN SURFACE, not for the words "needs WebGPU".
     *
     * The first version matched the page's own EXPLANATORY PARAGRAPH, which
     * contains the sentence "It needs WebGPU, and it says so if WebGPU is
     * missing" whether or not anything is wrong. That rejected a perfectly
     * good capture. A rendered ocean has a large canvas; a refused one does
     * not. */
    verify: () => {
      const w = document.getElementById('window-design-preview-window-water');
      if (!w) return 'no water window';
      for (const c of w.querySelectorAll('canvas')) {
        const r = c.getBoundingClientRect();
        if (r.width > 400 && r.height > 300) return null;
      }
      return 'the ocean drew no canvas - WebGPU is probably refused here';
    },
  },
  {
    id: 'dungeon-3d',
    query: 'step=dungeon',
    ready: () => /DUNGEON/.test(document.body.innerText),
    /* SEWER, deliberately. The default crypt generated no liquid cells at all,
     * so the first capture was a dark room plan with nothing to see in it. */
    drive: [{ select: 'sewer' }, '3D Expedition'],
    settle: 16000,
    prefer: 'canvas',
  },
  {
    id: 'dungeon-2d',
    query: 'step=dungeon',
    ready: () => /DUNGEON/.test(document.body.innerText),
    drive: [{ select: 'sewer' }, 'Parchment'],
    settle: 12000,
  },
  {
    id: 'biome-water',
    query: 'step=biome',
    ready: () => /PRESETS/.test(document.body.innerText),
    // The shader water lives in the VOXEL scene; the step opens on Heightmap.
    drive: ['Voxel'],
    settle: 16000,
    prefer: 'canvas',
  },
  {
    id: 'battlemap',
    query: 'step=battlemap',
    // It prints "Loading battle map demo..." for a long time on a cold server.
    ready: () => !/Loading battle map demo/.test(document.body.innerText)
      && document.querySelectorAll('canvas').length > 0,
    settle: 14000,
    prefer: 'canvas',
  },
  {
    /* THE SPLASH DOMAIN ARMS AT A TALL FALL, so the scene has to have one. The
     * "Deep shafts" preset is a flat proving ground with two bored wells over a
     * hundred metres deep - the only stock scene on this page that guarantees a
     * drop big enough. The status line prints the live particle count, so
     * `verify` can tell an armed domain from a parked one. */
    id: 'land-splash',
    query: 'step=land',
    ready: landWet,
    prepare: async (page, scope) => {
      await page.evaluate(() => {
        const w = document.getElementById('window-design-preview-window-land');
        for (const el of w.querySelectorAll('button')) {
          if (el.textContent.trim() === 'Deep shafts') { el.click(); return; }
        }
      });
      await sleep(20000);
      const cog = page
        .locator(scope + ' button[title="Terrain, tools, and water controls"]')
        .first();
      await cog.click({ timeout: 8000 }).catch(() => {});
      await sleep(1800);
      const hit = await page.evaluate(() => {
        for (const el of document.querySelectorAll('button')) {
          if (el.textContent.trim() === 'Splash parked') { el.click(); return true; }
        }
        return false;
      });
      process.stdout.write('  arm splash: ' + (hit ? 'ok' : 'MISSED') + String.fromCharCode(10));
      await sleep(2000);
      await cog.click({ timeout: 8000 }).catch(() => {});
      await sleep(1500);
    },
    settle: 60000,
    clipBelowText: 'WATER AND SIMULATION',
    pose: () => {
      const cam = window.__volCam;
      const j = window.__volJoin && window.__volJoin();
      if (!cam) return 'no camera';
      if (j && j.armed && j.center) {
        cam.set(j.center[0] + 26, j.center[1] + 16, j.center[2] + 26,
          j.center[0], j.center[1], j.center[2]);
        return 'framed the splash box, ' + j.live + ' live particles';
      }
      return 'splash not armed' + (j ? '' : ' (no __volJoin)');
    },
    verify: () => (/splash parked/i.test(document.body.innerText)
      ? 'the splash domain never armed - the status line still reads parked' : null),
  },
  {
    /* THE TOWN STEP NOW HAS A WATER GATE (?water=1), so these two recipes can
     * reach a burg that actually has a river or a coast. Before it existed the
     * step picked purely on population and all five of its burgs were dry,
     * which is why the whole world-water family went unphotographed. */
    id: 'town-real-3d',
    query: 'step=town3d&water=1',
    ready: () => /Water burgs only/.test(document.body.innerText),
    prepare: async (page) => {
      await sleep(6000);
      // Band labels carry the burg name, so match by prefix, not exactly.
      const said = await page.evaluate(() => {
        const w = document.getElementById('window-design-preview-window-town3d');
        for (const el of w.querySelectorAll('button')) {
          if (el.textContent.trim().startsWith('Capital')) { el.click(); return el.textContent.trim(); }
        }
        return 'no Capital button';
      });
      process.stdout.write('  burg: ' + said + String.fromCharCode(10));
      /* The band click triggers a fresh bake. Toggling the view too soon lands
       * on the PREVIOUS burg - a run aimed at the capital came back showing the
       * walled town, and nothing in the output said so. */
      await sleep(15000);
      await page.evaluate(() => {
        const w = document.getElementById('window-design-preview-window-town3d');
        for (const el of w.querySelectorAll('button')) {
          if (el.textContent.trim() === 'Real 3D') { el.click(); return; }
        }
      });
      await sleep(3000);
    },
    settle: 55000,
    prefer: 'canvas',
  },
  {
    id: 'town-plan-water',
    query: 'step=town3d&water=1',
    ready: () => /Water burgs only/.test(document.body.innerText),
    prepare: async (page) => {
      await sleep(6000);
      const said = await page.evaluate(() => {
        const w = document.getElementById('window-design-preview-window-town3d');
        for (const el of w.querySelectorAll('button')) {
          if (el.textContent.trim().startsWith('Capital')) { el.click(); return el.textContent.trim(); }
        }
        return 'no Capital button';
      });
      process.stdout.write('  burg: ' + said + String.fromCharCode(10));
      /* The band click triggers a fresh bake. Toggling the view too soon lands
       * on the PREVIOUS burg - a run aimed at the capital came back showing the
       * walled town, and nothing in the output said so. */
      await sleep(15000);
      await page.evaluate(() => {
        const w = document.getElementById('window-design-preview-window-town3d');
        for (const el of w.querySelectorAll('button')) {
          if (el.textContent.trim() === '2D map') { el.click(); return; }
        }
      });
      await sleep(3000);
    },
    settle: 20000,
    prefer: 'svg',
    /* The plan must actually DRAW water, or the shot is the same dry town the
     * old picker gave. Rivers and coasts carry different test ids. */
    verify: () => {
      const w = document.getElementById('window-design-preview-window-town3d');
      if (!w) return 'no town window';
      const n = w.querySelectorAll('[data-testid="town-water"]').length
        + w.querySelectorAll('[data-testid="town-coast"]').length;
      return n > 0 ? null : 'the plan drew no river and no coast';
    },
  },
  {
    id: 'worldforge',
    query: 'step=worldforge',
    ready: () => document.querySelectorAll('canvas,svg').length > 0,
    settle: 20000,
  },
];

const args = process.argv.slice(2);
if (args.includes('--list')) {
  for (const r of RECIPES) console.log(r.id);
  process.exit(0);
}
const todo = args.length ? RECIPES.filter((r) => args.includes(r.id)) : RECIPES;
if (!todo.length) {
  console.error('no recipe matched: ' + args.join(', '));
  console.error('known: ' + RECIPES.map((r) => r.id).join(', '));
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
    '--enable-webgpu-developer-features',
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
  const url = BASE + '?' + r.query;
  const step = new URLSearchParams(r.query).get('step');
  const scope = '#window-design-preview-window-' + step;
  process.stdout.write('\n[' + r.id + '] ' + url + '\n');
  try {
    await page.goto(url, { waitUntil: 'commit', timeout: 180000 });
    await sleep(4000);

    // Close every OTHER step window, then maximize this one.
    const closed = await page
      .evaluate((keep) => {
        let n = 0;
        for (const w of document.querySelectorAll('[id^="window-design-preview-window-"]')) {
          if (w.id === 'window-design-preview-window-' + keep) continue;
          const x = w.querySelector('button[title="Close"], button[aria-label="Close"]');
          if (x) {
            x.click();
            n += 1;
          }
        }
        return n;
      }, step)
      .catch(() => 0);
    if (closed) process.stdout.write('  closed ' + closed + ' other window(s)\n');
    await sleep(1200);
    await page
      .locator(scope + ' button[title="Maximize window"]')
      .first()
      .click({ timeout: 8000 })
      .catch(() => {});
    await sleep(1500);

    let ok = false;
    for (let i = 0; i < 180; i++) {
      ok = await page.evaluate(r.ready).catch(() => false);
      if (ok) break;
      await sleep(2000);
    }
    if (!ok) {
      process.stdout.write('  not ready after 6 min - skipped\n');
      results.push({ id: r.id, ok: false, why: 'never became ready' });
      await page.close();
      continue;
    }
    process.stdout.write('  ready\n');

    if (r.prepare) {
      await r.prepare(page, scope);
      process.stdout.write('  prepared\n');
    }

    /* DRIVE IN THE PAGE, by exact trimmed text.
     *
     * Playwright's `getByRole('button', { name })` missed real, visible,
     * enabled buttons here — and missed silently, so the recipe carried on and
     * photographed the wrong view. Two causes, both worth writing down:
     * accessible-name whitespace differs from `textContent`, and several of
     * these controls are not buttons at all. The dungeon's theme picker is a
     * `<select>`, so clicking its text could never have worked.
     *
     * A drive entry is either a label to click, or { select: value }. */
    for (const item of r.drive || []) {
      const spec = typeof item === 'string' ? { click: item } : item;
      const hit = await page
        .evaluate((a) => {
          const root = document.getElementById('window-design-preview-window-' + a.stepId);
          if (!root) return 'no window';
          if (a.spec.select !== undefined) {
            for (const sel of root.querySelectorAll('select')) {
              if ([...sel.options].some((o) => o.value === a.spec.select)) {
                sel.value = a.spec.select;
                sel.dispatchEvent(new Event('change', { bubbles: true }));
                return 'ok';
              }
            }
            return 'no select carries "' + a.spec.select + '"';
          }
          for (const el of root.querySelectorAll('button, [role="button"], a')) {
            if (el.textContent.trim() === a.spec.click) {
              el.click();
              return 'ok';
            }
          }
          /* FALL BACK TO THE WHOLE DOCUMENT, but only on an EXACT text match.
           *
           * The land page's controls deck opens as its own floating overlay, so
           * it is not inside the step's window element and the scoped search
           * above can never see it. An exact match is what keeps this safe: the
           * trap this file exists to avoid was a LOOSE match for "Start" that
           * hit "Start Point" in the navigation. The caller logs the fallback,
           * so a shot taken this way is never taken quietly. */
          for (const el of document.querySelectorAll('button, [role="button"], a')) {
            if (el.textContent.trim() === a.spec.click) {
              el.click();
              return 'ok (outside the step window)';
            }
          }
          return 'no control reads "' + a.spec.click + '"';
        }, { stepId: step, spec })
        .catch((e) => String(e).slice(0, 80));
      const what = spec.select !== undefined ? 'select ' + spec.select : 'click "' + spec.click + '"';
      process.stdout.write('  ' + what + ': ' + hit + '\n');
      await sleep(2200);
    }

    process.stdout.write('  settling ' + r.settle + ' ms\n');
    await sleep(r.settle);

    if (r.pose) {
      const said = await page.evaluate(r.pose).catch((e) => 'pose failed: ' + e);
      process.stdout.write('  pose: ' + said + '\n');
      await sleep(2500);
    }

    if (r.verify) {
      const bad = await page.evaluate(r.verify).catch(() => null);
      if (bad) {
        process.stdout.write('  REJECTED: ' + bad + '\n');
        results.push({ id: r.id, ok: false, why: bad });
        await page.close();
        continue;
      }
    }

    const box = await page
      .evaluate((a) => {
        const root = document.getElementById('window-design-preview-window-' + a.stepId);
        if (!root) return { err: 'no window for step "' + a.stepId + '"' };
        let best = null;
        let area = 0;
        for (const el of root.querySelectorAll(a.sel)) {
          const b2 = el.getBoundingClientRect();
          const s = b2.width * b2.height;
          if (s > area) {
            area = s;
            best = { x: b2.x, y: b2.y, width: b2.width, height: b2.height };
          }
        }
        if (!best) return { err: 'no drawing surface inside the window' };
        /* START THE CLIP BELOW A FLOATING PANEL, when the recipe names one.
         *
         * The land page's controls deck is an overlay ACROSS the canvas, not
         * beside it, so a clip to the canvas contains it however the camera is
         * posed. Three tries at closing or hiding the panel all failed; moving
         * the clip's top edge past it is what actually works, and it costs only
         * the strip the panel was covering anyway. */
        if (a.below) {
          /* FIND THE PANEL BY POINT TEST, not by text search.
           *
           * The land page's controls deck is an overlay ACROSS the canvas and
           * it lives OUTSIDE the step's window element, so both a scoped text
           * search and a document-wide one kept missing it. Asking the browser
           * what is actually painted at the top of the canvas cannot miss:
           * whatever answers there, if it is not the canvas, is covering it. */
          const cx = best.x + best.width / 2;
          let probeY = best.y + 4;
          for (let i = 0; i < 40; i += 1) {
            const el = document.elementFromPoint(cx, probeY);
            if (!el || el.tagName === 'CANVAS') break;
            const rr = el.getBoundingClientRect();
            const next = Math.max(rr.bottom + 2, probeY + 8);
            if (next > best.y + best.height * 0.7) break;
            probeY = next;
          }
          const cut = probeY - best.y;
          if (cut > 4) { best.y += cut; best.height -= cut; }
        }
        return best.height > 200 ? best : { err: 'clip collapsed below the panel' };
      }, { stepId: step, sel: r.prefer || 'canvas, svg', below: r.clipBelowText || null })
      .catch(() => null);
    if (box && box.err) process.stdout.write('  clip: ' + box.err + '\n');

    const file = path.join(OUT, r.id + '.png');
    if (box && box.width > 400 && box.height > 300) {
      await page.screenshot({
        path: file,
        clip: { x: box.x, y: box.y, width: box.width, height: box.height },
      });
    } else {
      await page.screenshot({ path: file });
    }
    const bytes = fs.statSync(file).size;
    process.stdout.write(
      '  wrote ' + path.relative(REPO, file) + ' (' + (bytes / 1024).toFixed(0) + ' kB)\n',
    );
    if (errors.length) process.stdout.write('  console errors: ' + errors.length + '\n');
    results.push({ id: r.id, ok: true, bytes });
  } catch (e) {
    process.stdout.write('  FAILED: ' + String(e).slice(0, 200) + '\n');
    results.push({ id: r.id, ok: false, why: String(e).slice(0, 120) });
  }
  await page.close();
}

await browser.close();

process.stdout.write('\n=== summary ===\n');
for (const x of results) {
  process.stdout.write(
    x.ok
      ? '  OK    ' + x.id + ' (' + (x.bytes / 1024).toFixed(0) + ' kB)\n'
      : '  MISS  ' + x.id + ' - ' + x.why + '\n',
  );
}
