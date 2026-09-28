/**
 * aim-shot.mjs — bone-targeted close-up of the Part Lab specimen.
 *
 * This is the rig that turns "the hand looks wrong" into a picture of the hand.
 * The lab's default camera frames the whole body, at which point a hand is
 * about forty pixels wide and every hand regression of the campaign was
 * invisible in the default capture.
 *
 * USAGE
 *   node tools/entities3d/capture/aim-shot.mjs                    # default hand close-up
 *   node tools/entities3d/capture/aim-shot.mjs <out.png>
 *   node tools/entities3d/capture/aim-shot.mjs <out.png> <bone> <dx> <dy> <dz> [url]
 *   node tools/entities3d/capture/aim-shot.mjs <out.png> <tx> <ty> <tz> <dx> <dy> <dz> [url]
 *
 * <bone> is a name from tools/entities3d/bipedBoneSpec.json ('handR', 'handL',
 * 'head', 'footL', ...). <dx dy dz> is the camera offset FROM the target, in
 * meters, so `0.25 0.12 0.35` is a three-quarter view from about half a meter.
 *
 * CONVENTIONS (all of them documented in ./captureLib.mjs):
 *   - the URL must carry `&turn=1`, which is what publishes __partlab.controls;
 *     drei re-aims the camera at controls.target every frame, so setting the
 *     TARGET is the only aim that survives
 *   - 127.0.0.1, never localhost
 *   - headless system Chrome with the GPU default-args removed
 *   - pixels come from renderer.render() + canvas.toDataURL(), never from
 *     page.screenshot() on this animating R3F scene
 *   - the shot is rejected if the page hot-reloaded during the settle
 *
 * Writes PNG only where you point it; keep that under .agent/scratch/.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  baseUrl, launchCaptureBrowser, newCapturePage, gotoScene, assertLive,
  grabCanvasPng, inkFraction, aimPartLab, writePng, sleep,
} from './captureLib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..', '..');

const argv = process.argv.slice(2);
const out = path.resolve(REPO, argv[0] ?? '.agent/scratch/entities3d-capture/aim-hand.png');

// Two arities: <bone dx dy dz> or <tx ty tz dx dy dz>. A non-numeric first
// coordinate means it is a bone name.
let target, offset, urlArg;
if (argv.length >= 7 && !Number.isNaN(Number(argv[1]))) {
  target = [argv[1], argv[2], argv[3]];
  offset = [argv[4], argv[5], argv[6]];
  urlArg = argv[7];
} else if (argv.length >= 5) {
  target = [argv[1], NaN, NaN];
  offset = [argv[2], argv[3], argv[4]];
  urlArg = argv[5];
} else {
  // The default IS the acceptance shot for this rig: a right-hand close-up on
  // the default humanoid, three-quarter, roughly 0.45 m out.
  target = ['handR', NaN, NaN];
  offset = ['0.22', '0.10', '0.34'];
  urlArg = argv[1];
}

const url = urlArg
  ?? `${baseUrl()}?step=partlab&race=human&class=fighter&seed=1&turn=1`;

const { browser, context } = await launchCaptureBrowser({ width: 1100, height: 900 });
try {
  const { page, errors } = await newCapturePage(context);
  // __partlab.gl is required, not just __partlab: three different components
  // write that key, and only the LabCaptureHook one carries the renderer.
  const nonce = await gotoScene(page, url, { hook: 'window.__partlab && window.__partlab.gl && window.__partlab.controls', settleMs: 3000 });
  const aim = await aimPartLab(page, target, offset);
  await sleep(700);
  await assertLive(page, nonce);
  const ink = await inkFraction(page);
  const png = await grabCanvasPng(page);
  writePng(out, png);
  console.log(`shot ${out}  aim=${aim.resolved} target=(${aim.target.x.toFixed(3)}, ${aim.target.y.toFixed(3)}, ${aim.target.z.toFixed(3)}) bytes=${png.length} ink=${(ink * 100).toFixed(1)}%`);
  if (ink < 0.01) console.log('WARNING: almost no ink — the scene probably rendered nothing.');
  if (errors.length) console.log('page errors:\n  ' + [...new Set(errors)].slice(0, 8).join('\n  '));
} finally {
  await browser.close();
}
