/**
 * partlab-shots.mjs — the Part Lab contact sheet.
 *
 * One capture per part/body/material variant, in one browser session. This is
 * the sweep that catches a change which fixes one variant and breaks four: the
 * part swaps, the rig variants, the compare split, and the skin/ink modes all
 * share code, and only a per-variant sheet shows which of them moved.
 *
 * USAGE
 *   node tools/entities3d/capture/partlab-shots.mjs [outDir] [labelPrefix]
 *   node tools/entities3d/capture/partlab-shots.mjs --list
 *
 * `labelPrefix` runs only the views whose label starts with it ('1' → 10..17).
 * Default outDir is .agent/scratch/entities3d-capture/partlab (gitignored);
 * every capture reports its ink coverage so a black frame is a NUMBER in the
 * log rather than something you have to open 28 PNGs to notice.
 *
 * CONVENTIONS: see ./captureLib.mjs. Briefly — 127.0.0.1 not localhost;
 * headless system Chrome with the GPU default-args removed; pixels via
 * renderer.render() + canvas.toDataURL(), never page.screenshot() on an
 * animating R3F scene; `waitUntil: 'commit'` plus a selector wait and a 180 s
 * nav timeout; every shot is rejected and retried if the shared dev server
 * hot-reloaded the page during the settle. `&turn=1` is on every view so the
 * sheet and the aim rigs read the same __partlab.controls handle.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  baseUrl, launchCaptureBrowser, newCapturePage, gotoScene, assertLive,
  grabCanvasPng, inkFraction, writePng,
} from './captureLib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..', '..');

/** label → extra query string. The label is also the PNG file name. */
const VIEWS = [
  ['01-default', ''],
  ['02-hand-lofted', '&hand=lofted'],
  ['03-hand-none', '&hand=none'],
  ['04-head-beast', '&head=beast'],
  ['05-head-none', '&head=none'],
  ['06-foot-none', '&foot=none'],
  ['07-body-lowpoly-male', '&body=lowpoly-male'],
  ['08-body-stylized-a', '&body=stylized-figure-a'],
  ['09-body-head-kit', '&body=stylized-head-kit'],
  ['10-solo-hand', '&solo=hand'],
  ['11-bones', '&bones=1'],
  ['12-gear-on', '&gear=1'],
  ['13-solo-head-beast', '&solo=head&head=beast'],
  ['14-rig-male-bones', '&body=lowpoly-male&bones=1'],
  ['15-rig-female', '&body=lowpoly-female'],
  ['16-rig-stylized-b', '&body=stylized-figure-b'],
  ['17-rig-nogender-bones', '&body=lowpoly-nogender&bones=1'],
  ['18-rest-stylized-a', '&body=stylized-figure-a&pose=rest&bones=1'],
  ['20-cmp-lowpoly-male', '&body=lowpoly-male&compare=1&bones=1'],
  ['21-cmp-lowpoly-female', '&body=lowpoly-female&compare=1&bones=1'],
  ['22-cmp-lowpoly-nogender', '&body=lowpoly-nogender&compare=1&bones=1'],
  ['23-cmp-stylized-a', '&body=stylized-figure-a&compare=1&bones=1'],
  ['24-cmp-stylized-b', '&body=stylized-figure-b&compare=1&bones=1'],
  ['30-skin-clay-cmp', '&body=lowpoly-male&compare=1&skin=clay'],
  ['31-skin-normals-proc', '&skin=normals'],
  ['32-skins-left-toon-right-clay', '&body=lowpoly-female&compare=1&skinL=toon&skin=clay'],
  ['33-ink-off-proc', '&ink=0'],
  ['34-ink-off-cmp', '&body=stylized-figure-b&compare=1&skinL=clay&ink=0'],
];

if (process.argv.includes('--list')) {
  for (const [label, extra] of VIEWS) console.log(label.padEnd(32), extra || '(default)');
  process.exit(0);
}

const outDir = path.resolve(REPO, process.argv[2] ?? '.agent/scratch/entities3d-capture/partlab');
const only = process.argv[3];
const BASE = `${baseUrl()}?step=partlab&race=hill_dwarf&class=fighter&seed=1&turn=1`;
const HOOK = 'window.__partlab && window.__partlab.gl';

const { browser, context } = await launchCaptureBrowser({ width: 1100, height: 900 });
const results = [];
try {
  const { page, errors } = await newCapturePage(context);
  for (const [label, extra] of VIEWS.filter(([l]) => !only || l.startsWith(only))) {
    let saved = false;
    // One retry: an HMR reload during the settle is the expected failure on the
    // shared dev server, and it is transient by definition.
    for (let attempt = 0; attempt < 2 && !saved; attempt++) {
      try {
        const nonce = await gotoScene(page, BASE + extra, { hook: HOOK, settleMs: 4000 });
        await assertLive(page, nonce);
        const ink = await inkFraction(page);
        const png = await grabCanvasPng(page);
        const file = writePng(path.join(outDir, `${label}.png`), png);
        results.push({ label, ink, bytes: png.length });
        console.log(`shot ${label.padEnd(32)} ink=${(ink * 100).toFixed(1)}% bytes=${png.length} -> ${file}`);
        saved = true;
      } catch (e) {
        const why = String(e).slice(0, 160);
        if (attempt === 0) console.log(`retry ${label}: ${why}`);
        else { results.push({ label, error: why }); console.log(`SHOT-FAIL ${label}: ${why}`); }
      }
    }
  }
  const blank = results.filter((r) => !r.error && r.ink < 0.01);
  console.log(`\n${results.filter((r) => !r.error).length} shot, ${results.filter((r) => r.error).length} failed, ${blank.length} blank`);
  if (blank.length) console.log('BLANK (rendered nothing): ' + blank.map((r) => r.label).join(', '));
  if (errors.length) console.log('page errors:\n  ' + [...new Set(errors)].slice(0, 10).join('\n  '));
} finally {
  await browser.close();
}
