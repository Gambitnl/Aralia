/**
 * tools/creatureGate/motionGate.mjs — the MOTION gate: a clip frame beside
 * every T-pose capture.
 *
 *   node tools/creatureGate/motionGate.mjs <outDir>
 *       [--bodies lowpoly-male,lowpoly-female] [--clip Walk] [--t 0.5]
 *
 * THE LESSON THIS ENFORCES (2026-08-24, GOAL-part-quality-campaign.md).
 * "A still T-pose proof alone ships nothing": two clean stills passed review in
 * one night while the rig under them had crossed finger chains and scissored
 * curls. Neither defect exists in the bind pose. So per body this rig captures
 * TWO frames — the bind pose (`pose=rest`, which for these bodies is the
 * T-pose) and a driven frame (`pose=pack:Walk&t=0.5`) — and measures both.
 *
 * Both frames go through the SAME floors, which is the whole point: the still
 * is no longer exempt from measurement and the clip frame is no longer absent.
 * The clip frame additionally has to prove it IS a clip frame — a body the lab
 * cannot drive renders its static mesh under a `pack:` pose and photographs
 * beautifully, so a driven frame with no bones is flagged as a still.
 *
 * CAVEAT worth knowing before reading the report: `pose=rest` drives our
 * 39-bone biped and `pose=pack:*` drives the pack author's armature, so the two
 * frames do NOT share a skeleton. Digit names are canonicalized across both
 * (motionMetrics.classifyDigitBone) and the crossing test needs no reference,
 * but `orderMatchesReference` stays null whenever the digit sets differ rather
 * than pretending a cross-skeleton comparison happened.
 *
 * SCOPE (2026-09-09, agora-7dc5). This is the smallest useful version: two
 * bodies, one clip, one phase, two metrics. The larger scope — every library
 * creature, several clips, a phase sweep instead of a single t, and the
 * whole-body pose metrics — is Remy's open choice (question sheet e00fca36 q4);
 * `--bodies`, `--clip` and `--t` exist so widening it is a call-site change
 * rather than a rewrite.
 *
 * CAPTURE CONVENTIONS come from tools/entities3d/capture/captureLib.mjs
 * (headless system Chrome with the GPU default-args removed, preserved drawing
 * buffer, render-on-demand + canvas.toDataURL, never page.screenshot on an
 * animating R3F scene, liveness nonce against a mid-capture HMR reload).
 *
 * Writes <outDir>/<body>-tpose.png, <body>-walk-t<NNN>.png and
 * <outDir>/motion-report.json. Exits non-zero when any floor fires, so the
 * nightly loop can treat a new flag as a regression.
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  baseUrl, launchCaptureBrowser, newCapturePage, gotoScene, assertLive,
  writePng, sleep,
} from '../entities3d/capture/captureLib.mjs';
import { fingerMetrics, silhouetteMetrics, motionFlags, FLOORS } from './motionMetrics.mjs';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
// positional args = everything that is neither a --flag nor a flag's value
const positional = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
const outDir = positional[0];
if (!outDir) {
  console.error('usage: node tools/creatureGate/motionGate.mjs <outDir> [--bodies a,b] [--clip Walk] [--t 0.5]');
  process.exit(1);
}

/**
 * The default roster is the two bodies that carry an AUTHOR rig
 * (`.authorrig.glb`, 2026-09-09) — the current lowpoly bodies, and the only
 * ones whose fingers a clip actually drives. A body with no digit bones is
 * reported as "unavailable", never as a pass.
 */
const bodies = String(flag('bodies', 'lowpoly-male,lowpoly-female')).split(',').map((s) => s.trim()).filter(Boolean);
const clip = flag('clip', 'Walk');
const t = Number(flag('t', '0.5'));
if (!Number.isFinite(t) || t < 0 || t > 1) throw new Error(`motionGate: --t must be 0..1, got ${flag('t', '')}`);
const tTag = `t${String(Math.round(t * 1000)).padStart(3, '0')}`;

mkdirSync(outDir, { recursive: true });

/**
 * Common query flags for every capture:
 *   stage=mask  white backdrop and NO studio ground — the ground plane would
 *               weld every capture into one island and make the silhouette
 *               break metric structurally unable to fire
 *   ink=0       the outline shells thicken the silhouette; the gate measures
 *               the body, not its ink
 *   speed=0     the procedural clock is frozen, so a live-playing pose cannot
 *               make the same body measure differently run to run (the same
 *               phase-luck trap the part gate hit on 2026-08-24)
 *   turn=1      publishes __partlab.controls (captureLib convention 7)
 *   rig=author  the author armature, the default drive body since 2026-09-09
 */
const COMMON = 'rig=author&turn=1&ink=0&stage=mask&speed=0';
const urlFor = (body, pose) =>
  `${baseUrl()}?step=partlab&body=${encodeURIComponent(body)}&${COMMON}`
  + `&pose=${encodeURIComponent(pose)}${pose.includes(':') ? `&t=${t.toFixed(3)}` : ''}`;

/**
 * One capture: the PNG, a downsampled binary mask for the silhouette metric,
 * and every bone's world position for the finger metric — all off ONE render,
 * so the picture and the numbers can never describe different moments.
 *
 * Subject = any pixel that differs from the top-left pixel (the backdrop), the
 * same rule captureLib's `inkFraction` uses, kept identical on purpose.
 */
async function readFrame(page) {
  return page.evaluate(() => {
    const lab = window.__partlab;
    if (!lab?.gl) throw new Error('__partlab.gl missing — not the Part Lab, or the scene has not mounted');
    // STAGE FURNITURE IS NOT THE CREATURE. `stage=mask` already drops the
    // studio ground, but the entity assembly carries its own `blobShadow`
    // ellipse under the feet. It is large enough to clear the island floor, so
    // the frame where a walking body lifts clear of its own shadow would read
    // as a torn limb — a silhouette-break FALSE POSITIVE, and the loudest kind,
    // because it fires on exactly the driven frames this gate exists to judge.
    const hidden = [];
    lab.scene.traverse((o) => {
      if ((o.isMesh || o.isSkinnedMesh) && o.visible && (o.name === 'blobShadow' || o.name === 'studioGround')) {
        o.visible = false;
        hidden.push(o);
      }
    });
    lab.gl.render(lab.scene, lab.camera);
    const cv = lab.gl.domElement;
    const STEP = Math.max(1, Math.round(cv.width / 240)); // ~240 px wide mask
    const w = Math.floor(cv.width / STEP), h = Math.floor(cv.height / STEP);
    const off = document.createElement('canvas');
    off.width = cv.width; off.height = cv.height;
    off.getContext('2d').drawImage(cv, 0, 0);
    const { data } = off.getContext('2d').getImageData(0, 0, cv.width, cv.height);
    const bg = [data[0], data[1], data[2]];
    const mask = new Array(w * h).fill(0);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = ((y * STEP) * cv.width + x * STEP) * 4;
        const d = Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]);
        if (d > 24) mask[y * w + x] = 1;
      }
    }
    const bones = {};
    lab.scene.traverse((o) => {
      if (!o.isBone) return;
      const v = new o.position.constructor();
      o.getWorldPosition(v);
      bones[o.name] = [v.x, v.y, v.z];
    });
    // The PNG is read from the SAME rendered frame as the mask, in the same
    // task, before the next rAF swaps the buffer (captureLib convention 3), so
    // the picture a human reviews is exactly the picture the floors measured —
    // furniture and all.
    const png = cv.toDataURL('image/png');
    for (const o of hidden) o.visible = true; // leave the page as we found it
    return { mask, w, h, bones, boneCount: Object.keys(bones).length, png, hiddenFurniture: hidden.map((o) => o.name) };
  });
}

/**
 * Capture one pose and measure it. `reference` is the T-pose result, or null;
 * `driven` marks the clip frame, which carries the extra "did the clip actually
 * drive anything" floor.
 */
async function capture(context, body, pose, file, reference, driven = false) {
  const { page, errors } = await newCapturePage(context);
  try {
    const url = urlFor(body, pose);
    // __partlab.gl, not just __partlab: three components write that key and
    // only LabCaptureHook carries the renderer (captureLib convention 4).
    // The settle is generous because a pack clip pulls a second large GLB.
    const nonce = await gotoScene(page, url, { hook: 'window.__partlab && window.__partlab.gl', settleMs: 6000 });
    await sleep(500);
    await assertLive(page, nonce);
    const frame = await readFrame(page);
    writePng(file, Buffer.from(frame.png.split(',')[1], 'base64'));
    const silhouette = silhouetteMetrics(frame.mask, frame.w, frame.h);
    const fingers = fingerMetrics(frame.bones, reference);
    const flags = motionFlags({ silhouette, fingers, driven, boneCount: frame.boneCount });
    return {
      pose, url, png: file, bones: frame.boneCount, hiddenFurniture: frame.hiddenFurniture,
      silhouette, fingers, flags,
      pageErrors: [...new Set(errors)].slice(0, 5),
    };
  } finally {
    await page.close();
  }
}

const report = { generated: new Date().toISOString(), clip, t, floors: FLOORS, bodies: {} };
const { browser, context } = await launchCaptureBrowser({ width: 1100, height: 900 });
try {
  for (const body of bodies) {
    // T-POSE FIRST, and not only for the picture: its digit order is the
    // reference the driven frame is scored against.
    const tpose = await capture(context, body, 'rest', join(outDir, `${body}-tpose.png`), null);
    console.log(`${body} tpose   ${tpose.flags.length ? 'FLAG  ' + tpose.flags.join(' | ') : 'clean'}`);
    const motion = await capture(context, body, `pack:${clip}`, join(outDir, `${body}-${clip.toLowerCase()}-${tTag}.png`), tpose.fingers, true);
    console.log(`${body} ${clip}@${t}  ${motion.flags.length ? 'FLAG  ' + motion.flags.join(' | ') : 'clean'}`);
    report.bodies[body] = { tpose, motion, flags: [...tpose.flags.map((f) => `tpose: ${f}`), ...motion.flags.map((f) => `${clip}@${t}: ${f}`)] };
  }
} finally {
  await browser.close();
}

const reportPath = join(outDir, 'motion-report.json');
writeFileSync(reportPath, JSON.stringify(report, null, 1));
const failed = Object.entries(report.bodies).filter(([, r]) => r.flags.length > 0);
console.log(`motionGate: ${bodies.length} bodies x 2 frames -> ${reportPath}`);
for (const [body, r] of failed) console.log(`MOTION GATE FAILED  ${body}: ${r.flags.join(' | ')}`);
if (!failed.length) console.log('MOTION GATE PASSED — every body clean at the bind pose AND under the clip');
process.exit(failed.length ? 1 : 0);
