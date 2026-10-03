/**
 * url-shot.mjs — one URL in, one canvas PNG out.
 *
 * The smallest rig in this directory and the one to reach for first: it takes
 * any 3D surface URL and photographs the canvas, with the page's console errors
 * printed beside the ink coverage. That pairing is the point — a black PNG plus
 * a shader compile error is a diagnosis, while a black PNG alone is a mystery.
 *
 * USAGE
 *   node tools/entities3d/capture/url-shot.mjs <url> <out.png> [hookExpr]
 *
 * `hookExpr` is a JS expression that must become truthy before the shot is
 * taken; it defaults to `window.__partlab`. Pass `window.__wf3dScene` for the
 * world surface, or `-` to wait only for a canvas.
 *
 * CONVENTIONS: see ./captureLib.mjs. Briefly — 127.0.0.1 not localhost;
 * headless system Chrome with the GPU default-args removed; pixels via
 * renderer.render() + canvas.toDataURL(), never page.screenshot() on an
 * animating R3F scene; `waitUntil: 'commit'` plus a selector wait and a 180 s
 * timeout; the shot is rejected if the page hot-reloaded mid-capture. Add
 * `&turn=1` to Part Lab URLs when anything downstream needs __partlab.controls.
 *
 * Keep <out.png> under .agent/scratch/ (gitignored).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  launchCaptureBrowser, newCapturePage, gotoScene, assertLive,
  grabCanvasPng, inkFraction, writePng,
} from './captureLib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..', '..');

const [url, outArg, hookArg] = process.argv.slice(2);
if (!url || !outArg) {
  console.error('usage: node tools/entities3d/capture/url-shot.mjs <url> <out.png> [hookExpr|-]');
  process.exit(2);
}
const out = path.resolve(REPO, outArg);
// The world surface publishes a bare THREE scene; captureLib reaches its
// renderer through `__r3f` (R3F 9 still keeps that on THREE objects).
const hook = hookArg === '-' ? null : (hookArg ?? 'window.__partlab');
const grab = hook && hook.includes('__wf3dScene')
  ? { handle: null, r3fFrom: 'window.__wf3dScene' }
  : { handle: '__partlab' };

const { browser, context } = await launchCaptureBrowser({ width: 1100, height: 900 });
try {
  const { page, errors } = await newCapturePage(context);
  const nonce = await gotoScene(page, url, { hook, settleMs: 4000 });
  await assertLive(page, nonce);
  const ink = await inkFraction(page, grab);
  const png = await grabCanvasPng(page, grab);
  writePng(out, png);
  console.log(`shot ${out} bytes=${png.length} ink=${(ink * 100).toFixed(1)}%`);
  if (ink < 0.01) console.log('WARNING: almost no ink — the scene probably rendered nothing.');
  if (errors.length) console.log('page errors:\n  ' + [...new Set(errors)].slice(0, 8).join('\n  '));
} finally {
  await browser.close();
}
