#!/usr/bin/env node
/**
 * export-canid-pose-review-strip.mjs — agora-d32a (IDEA - Build one undoable
 * canid pose-review strip).
 *
 * WHAT THIS IS. The runnable half of `PoseReviewSessionV1`
 * (`src/systems/entities3d/studio/poseReviewSession.ts`). It:
 *   1. derives the subject's EXACT lineage in plain Node, off the same
 *      profile -> plan -> compile pipeline the browser uses;
 *   2. opens the existing entity debugger on the shared dev server and shoots
 *      the strip — three semantic poses x three neutral review cameras, nine
 *      frozen frames;
 *   3. drives a real `PoseReviewSessionV1` through the capture: one atomic
 *      `batch` gesture per shot (verdict + note + evidence), then proves the
 *      undo/redo round trip on the live session;
 *   4. writes the deterministic receipt + its sha256 beside the PNGs under
 *      `.agent/scratch/agora-d32a/` (gitignored throwaway proof).
 *
 * PREMISE (from the dispatch prompt, established by sibling agora-63e3 and NOT
 * re-proven here): no Idea Board record matches `idea:cozyclay-pose-review-workspace`
 * and no literal `canid-v2` identifier exists under `src/systems/entities3d`.
 * The canid-v2 stand-in is therefore Aralia's own deterministic quadruped:
 * `creaturePlans.ts` `beastPlan()`, reached by `planForCreature()` for
 * `creatureType: 'Beast'`, compiled by `textPlan/compilePlan.ts`. Nothing from
 * CozyClay / Kimodo / ARDY is installed, copied, or referenced.
 *
 * WHY THE LINEAGE IS COMPUTED IN NODE AND THE PIXELS IN THE BROWSER. The
 * debugger builds its creature recipe itself (`PreviewEntityDebug.tsx`:
 * `{ kind: 'creature', creatureType, size, seed: 'debug-<n36>', cues: [] }`),
 * so the only way to record the lineage of the body ACTUALLY SHOT is to
 * reproduce that exact recipe here and re-derive the blueprint from it. Note
 * `cues: []` below is not a shortcut: the debugger cannot pass cues, and for
 * `Beast` the cue-free path already lands on `beastPlan()`. Recording invented
 * cues would make the receipt describe a body nobody rendered.
 *
 * WHY NOT `generateEntityBlueprint.ts`. Same reason as the two sibling scripts
 * in this folder: its static `import { ALL_RACES_DATA } from '../../data/races'`
 * pulls a Vite-only `import.meta.glob()` that throws under plain Node. The
 * creature branch of that module is re-derived here instead (see `buildBlueprint`).
 *
 * WHY `captureLib` IS USED BUT `grabCanvasPng` IS NOT. The shared helper's
 * render-then-read expects a handle shaped `{ gl, scene, camera }` (the Part
 * Lab's `window.__partlab`). The entity debugger publishes
 * `window.__entitydebug = { scene, camera, renderer, handle, contactSheet }` —
 * `renderer`, not `gl`. Rather than edit a shared, frequently-locked scene
 * component to rename a field, this rig re-implements convention 3 locally
 * against `renderer` (see `grabEntityDebugPng`). Every other convention —
 * headless Chrome with the GPU args stripped, the preserveDrawingBuffer init
 * script, `waitUntil: 'commit'` navigation, and the HMR liveness nonce — comes
 * from `captureLib.mjs` unchanged.
 *
 * USAGE (a dev server must already be running on :5174)
 *   npx tsx scripts/idea-board/experiments/export-canid-pose-review-strip.mjs
 *
 * HOW DETERMINISTIC THE RECEIPT ACTUALLY IS (measured, 2026-09-09, not
 * assumed). The receipt carries no timestamp, no host name and no absolute
 * path, and `buildPoseReviewReceipt` sorts keys and rounds floats, so
 * everything the reviewer decides is stable. Two full runs of this rig on this
 * host produced receipts differing in EXACTLY 18 lines — the two hex digests
 * of each of the nine PNGs — and in nothing else: same lineage, same samples,
 * same cameras, same verdicts, same notes, same ink fractions, same summary.
 *
 * Within ONE run the renderer is bit-stable: the control frame (see
 * `noiseFloor`) re-shoots a sample with identical settings and measures a
 * pixel delta of exactly 0. Across browser launches the PNG encoder is not.
 * So per-shot PNG digests are RECORDED AS OBSERVATIONS — they identify the
 * exact bytes a reviewer looked at — and are not a cross-run equality claim.
 * The stable identity of a review is the receipt minus those digests.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  baseUrl,
  launchCaptureBrowser,
  newCapturePage,
  gotoScene,
  assertLive,
  writePng,
  sleep,
} from '../../../tools/entities3d/capture/captureLib.mjs';

import { rngFromPath, streamPath, makeSeedPath, fnv1a } from '../../../src/systems/worldforge/seedPath.ts';
import { profileForCreature } from '../../../src/systems/entities3d/creatureProfiles.ts';
import { planForCreature, bellyToneFor } from '../../../src/systems/entities3d/creaturePlans.ts';
import { compilePlan } from '../../../src/systems/entities3d/textPlan/compilePlan.ts';
import {
  POSE_SAMPLES,
  REVIEW_CAMERAS,
  applyAll,
  buildPoseReviewReceipt,
  canRedo,
  canUndo,
  createPoseReviewSession,
  poseReviewReducer,
  shotId,
} from '../../../src/systems/entities3d/studio/poseReviewSession.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..', '..');
const OUT_DIR = path.join(REPO, '.agent', 'scratch', 'agora-d32a');
const SESSION_ID = 'agora-d32a';

/** Mirrors the debugger's own recipe for the URL params this rig passes. */
const DEBUG_SEED_N = 1;
const RECIPE = Object.freeze({
  kind: 'creature',
  creatureType: 'Beast',
  size: 'Medium',
  seed: `debug-${DEBUG_SEED_N.toString(36)}`,
  cues: [],
});

const STRIP_URL = `${baseUrl()}?step=entitydebug&mode=creature&type=Beast&size=Medium&seed=${DEBUG_SEED_N}&wire=0&bones=0`;

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const uniform = (rng, lo, hi) => lo + rng.next() * (hi - lo);

/**
 * Fraction of thumbnail pixels whose luminance differs by more than `tol`.
 * This is the number that makes "three DISTINCT semantic poses" checkable:
 * two shots from the same camera at different gait phases must move real
 * pixels, or the phase control silently did nothing and the strip is three
 * copies of one pose wearing three labels.
 */
function poseDelta(a, b, tol = 8) {
  let moved = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > tol) moved++;
  return moved / a.length;
}

/** Probe resolution for both the ink guard and the pose-delta thumbnail. */
const PROBE_PX = 384;

/**
 * How the pose-delta threshold is set, and why it is not a hand-picked number.
 *
 * MEASURED 2026-09-09. A leg swing at the 3/4 camera moves ~0.43% of frame
 * pixels. Raising the probe from 160 px to 384 px did NOT change that figure
 * (0.004258 -> 0.004252), which rules out downscale blur and identifies the
 * real cause: the subject occupies a small share of a wide frame, so even a
 * large limb movement is a small share of the picture. A fixed "0.5% or it
 * did not move" threshold would therefore have failed a genuinely different
 * pose — and any threshold picked to make that pass would be picked to pass.
 *
 * So the rig measures its own noise floor instead: after the strip it
 * re-shoots one sample with identical settings and takes that delta as zero
 * motion. Every pose pair must beat both an absolute floor and a large
 * multiple of the observed floor. On this host the control frame is
 * bit-identical (floor 0), so the multiple is inert and the absolute floor
 * carries the check; on a noisier GPU the multiple takes over.
 */
const MIN_POSE_DELTA = 0.002;
const NOISE_FLOOR_MULTIPLE = 10;

/** The creature branch of generateEntityBlueprint.ts, re-derived (header note). */
function buildBlueprint(recipe) {
  const base = makeSeedPath(fnv1a(recipe.seed), `entity:${fnv1a(`salt:${recipe.seed}`)}`);
  const frameRng = rngFromPath(streamPath(base, 'frame'));
  const anatomyRng = rngFromPath(streamPath(base, 'anatomy'));

  const resolved = profileForCreature(recipe.creatureType, recipe.size, recipe.cues ?? []);
  const heightFt = resolved.frame.heightFt * uniform(frameRng, 0.92, 1.08);
  const bulk = resolved.frame.bulk * uniform(frameRng, 0.9, 1.1);
  const template = planForCreature(recipe.creatureType, recipe.size, recipe.cues ?? [], heightFt, bulk, anatomyRng);
  if (!template) {
    throw new Error(
      `entities3d: recipe ${JSON.stringify(recipe)} has no plan template (planForCreature returned null). ` +
        'The Beast -> beastPlan() default may have moved; re-check creaturePlans.ts basePlanForCreature().',
    );
  }
  const skinHex = '#8a7a63';
  return compilePlan({
    ...template,
    palette: {
      bodyHex: skinHex,
      accentHex: resolved.palette.accentHex,
      bellyHex: bellyToneFor(skinHex),
      eyeHex: resolved.palette.eyeHex,
    },
  });
}

// ---------------------------------------------------------------------------
// Page driving. Every control below already exists in the debugger's toolbar;
// this rig clicks the reviewer's own buttons rather than reaching into React.
// ---------------------------------------------------------------------------

/** Click a toolbar button by its exact visible text. */
async function clickButton(page, text) {
  const ok = await page.evaluate((label) => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === label);
    if (!btn) return false;
    btn.click();
    return true;
  }, text);
  if (!ok) throw new Error(`entity debugger toolbar has no button labelled "${text}" — the toolbar moved`);
}

/** Set a checkbox whose enclosing <label> contains `labelText`. */
async function setCheckbox(page, labelText, on) {
  const ok = await page.evaluate(([needle, want]) => {
    const label = [...document.querySelectorAll('label')].find((l) => (l.textContent || '').includes(needle));
    const box = label?.querySelector('input[type=checkbox]');
    if (!box) return false;
    if (box.checked !== want) box.click();
    return true;
  }, [labelText, on]);
  if (!ok) throw new Error(`entity debugger has no "${labelText}" checkbox — the toolbar moved`);
}

/**
 * Drive the phase slider. A React-controlled <input type=range> ignores a
 * plain `value =` assignment (React's own value tracker suppresses the change
 * event), so the native setter is called first and `input` dispatched after —
 * the standard escape hatch, kept here rather than in the component.
 */
async function setPhase(page, phase) {
  const applied = await page.evaluate((value) => {
    const slider = [...document.querySelectorAll('input[type=range]')].find((el) => el.max === '1' && el.step === '0.01');
    if (!slider) return null;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(slider, String(value));
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    return slider.value;
  }, phase);
  if (applied === null) throw new Error('entity debugger has no gait-phase slider — the toolbar moved');
  if (Number(applied) !== phase) throw new Error(`phase slider refused ${phase} (reads ${applied})`);
}

/**
 * Aim one review camera.
 *
 * NOT the `cam:<label>` toolbar buttons, and the reason matters. The
 * debugger's `threequarter` preset sits at azimuth 45 degrees while
 * `EntityDebugScene.tsx` also yaws every entity by `ENTITY_YAW = PI * 0.25`;
 * the two cancel and that button renders a dead-on front view, duplicating the
 * `front` button. `REVIEW_CAMERAS` corrects the azimuth (see the module), so
 * the rig has to apply ITS numbers, not the toolbar's.
 *
 * The scene's `<OrbitControls makeDefault>` re-aims the camera at
 * `controls.target` every frame, so setting `camera.position` alone is
 * silently reverted (captureLib convention 7). Both are set together and
 * `controls.update()` called, reached through the R3F store on the published
 * THREE scene (captureLib convention 6) rather than by editing the component.
 */
async function applyCamera(page, cam) {
  const ok = await page.evaluate(([position, target]) => {
    const state = window.__entitydebug?.scene?.__r3f?.root?.getState?.();
    const camera = window.__entitydebug?.camera;
    const controls = state?.controls;
    if (!camera || !controls) return false;
    camera.position.set(position[0], position[1], position[2]);
    controls.target.set(target[0], target[1], target[2]);
    controls.update();
    camera.lookAt(controls.target);
    camera.updateMatrixWorld(true);
    return true;
  }, [cam.position, cam.target]);
  if (!ok) throw new Error(`could not reach OrbitControls through __entitydebug for camera "${cam.id}"`);
}

/**
 * captureLib convention 3, re-implemented for `__entitydebug` (see header).
 * Render on demand through the page's own renderer, then read the canvas back
 * in the SAME task, before the next rAF swaps the buffer away.
 */
async function grabEntityDebugPng(page) {
  const shot = await page.evaluate((probePx) => {
    const state = window.__entitydebug;
    if (!state) throw new Error('window.__entitydebug is gone (HMR reload?)');
    const { renderer, scene, camera } = state;
    if (!renderer || !scene || !camera) throw new Error('__entitydebug is missing renderer/scene/camera');
    renderer.render(scene, camera);
    const canvas = renderer.domElement ?? document.querySelector('canvas');

    // Ink coverage in the same task as the render: a black-frame regression
    // must be caught by a NUMBER, not by somebody opening the PNG later.
    const probe = document.createElement('canvas');
    const w = (probe.width = probePx);
    const h = (probe.height = probePx);
    const ctx = probe.getContext('2d');
    ctx.drawImage(canvas, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    const bg = [data[0], data[1], data[2]];
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 18) ink++;
    }
    // Luminance thumbnail, returned so Node can measure how far apart two
    // poses actually are (see `poseDelta`). Ink alone cannot do that job here:
    // sky + ground dominate this scene, so ink barely moves when the legs do.
    const luma = new Array(w * h);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      luma[p] = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
    }

    return {
      dataUrl: canvas.toDataURL('image/png'),
      inkFraction: ink / (w * h),
      luma,
      probeSize: w,
      widthPx: canvas.width,
      heightPx: canvas.height,
    };
  }, PROBE_PX);
  return { ...shot, buffer: Buffer.from(shot.dataUrl.split(',')[1], 'base64') };
}

async function main() {
  const blueprint = buildBlueprint(RECIPE);
  if (blueprint.gait !== 'plan' || !blueprint.planSpec) {
    throw new Error(
      `entities3d: recipe ${JSON.stringify(RECIPE)} did not resolve to a compiled 'plan' quadruped ` +
        `(got gait="${blueprint.gait}"). Re-check creaturePlans.ts before trusting this strip.`,
    );
  }

  const lineage = {
    subjectId: 'canid-v2',
    standInFor:
      "Aralia's deterministic quadruped 'beast' plan (wolf/hound archetype). No literal canid-v2 " +
      'identifier exists under src/systems/entities3d; see the protocol doc.',
    recipe: RECIPE,
    pipeline: [
      'src/systems/entities3d/creatureProfiles.ts profileForCreature()',
      'src/systems/entities3d/creaturePlans.ts planForCreature() -> beastPlan()',
      'src/systems/entities3d/textPlan/compilePlan.ts compilePlan()',
      'src/systems/entities3d/three/gaits.ts createGaitDriver("plan")',
      'src/components/DesignPreview/steps/EntityDebugScene.tsx (renderer + neutral cameras)',
    ],
    compiled: {
      label: blueprint.label,
      gait: blueprint.gait,
      heightM: blueprint.frame.heightM,
      stance: blueprint.planSpec.stance,
      bodyLenM: blueprint.planSpec.bodyLenM,
      spineSegments: blueprint.planSpec.spine.segments,
      chainCount: blueprint.planSpec.chains.length,
      headCount: blueprint.planSpec.heads.length,
      surface: STRIP_URL.slice(STRIP_URL.indexOf('?')),
    },
  };

  let session = createPoseReviewSession({ sessionId: SESSION_ID, lineage });
  mkdirSync(OUT_DIR, { recursive: true });

  const { browser, context } = await launchCaptureBrowser({ width: 1100, height: 900 });
  const shots = [];
  let noiseFloor = 0;
  try {
    const { page, errors } = await newCapturePage(context);
    const nonce = await gotoScene(page, STRIP_URL, {
      hook: 'window.__entitydebug && window.__entitydebug.renderer',
      settleMs: 3000,
    });

    // Freeze first: every sample below is a frozen, phase-pinned pose, which
    // is the whole reason two runs a week apart shoot the same body.
    await setCheckbox(page, 'turntable', false);
    await setCheckbox(page, 'freeze', true);

    for (const sample of POSE_SAMPLES) {
      await clickButton(page, sample.action === 'idle' ? 'idle' : 'walk');
      await setPhase(page, sample.gaitPhase);
      await sleep(400); // let the driver settle onto the new phase

      for (const camera of REVIEW_CAMERAS) {
        await applyCamera(page, camera);
        await sleep(250); // one rAF for OrbitControls to settle on the new target
        await assertLive(page, nonce); // convention 5: an HMR reload invalidates the shot

        const grab = await grabEntityDebugPng(page);
        const file = `${sample.id}-${camera.id}.png`;
        writePng(path.join(OUT_DIR, file), grab.buffer);
        const rel = path.posix.join('.agent/scratch/agora-d32a', file);
        shots.push({
          sampleId: sample.id,
          cameraId: camera.id,
          file: rel,
          ink: grab.inkFraction,
          sha256: sha256(grab.buffer),
          luma: grab.luma,
        });

        // ONE atomic reviewer gesture per shot: verdict + note + evidence
        // land as a single undo step (that is what `batch` buys).
        session = poseReviewReducer(session, {
          type: 'batch',
          label: `capture ${sample.id}@${camera.id}`,
          actions: [
            { type: 'setVerdict', shotId: shotId(sample.id, camera.id), verdict: grab.inkFraction > 0.02 ? 'accept' : 'redo' },
            {
              type: 'setNote',
              shotId: shotId(sample.id, camera.id),
              note:
                grab.inkFraction > 0.02
                  ? `${sample.label} from ${camera.label}; ink ${grab.inkFraction.toFixed(4)}`
                  : `BLANK FRAME: ink ${grab.inkFraction.toFixed(4)} — nothing rendered`,
            },
            {
              type: 'attachEvidence',
              shotId: shotId(sample.id, camera.id),
              evidence: {
                file: rel,
                sha256: sha256(grab.buffer),
                inkFraction: Number(grab.inkFraction.toFixed(6)),
                widthPx: grab.widthPx,
                heightPx: grab.heightPx,
              },
            },
          ],
        });
      }
    }
    // Control frame: re-shoot the FIRST sample with identical settings. Its
    // delta against the original is what "no pose change" measures on this
    // host, and it is what the pose-distinctness threshold is scaled against.
    const control = POSE_SAMPLES[0];
    const controlCam = REVIEW_CAMERAS[0];
    await clickButton(page, control.action === 'idle' ? 'idle' : 'walk');
    await setPhase(page, control.gaitPhase);
    await sleep(400);
    await applyCamera(page, controlCam);
    await sleep(250);
    await assertLive(page, nonce);
    const repeat = await grabEntityDebugPng(page);
    const original = shots.find((s) => s.sampleId === control.id && s.cameraId === controlCam.id);
    noiseFloor = poseDelta(original.luma, repeat.luma);

    if (errors.length) console.warn(`page errors during capture (${errors.length}):\n  ${errors.slice(0, 5).join('\n  ')}`);
  } finally {
    await browser.close();
  }

  // ---- prove the three samples are three DIFFERENT poses ------------------
  // Every pair of samples is compared at the SAME camera, so any pixel motion
  // is the body moving and not the camera. A pair that fails this is the
  // failure mode this whole rig exists to catch: a phase control that silently
  // did nothing, producing three identically-posed shots with three labels.
  const distinctThreshold = Math.max(MIN_POSE_DELTA, noiseFloor * NOISE_FLOOR_MULTIPLE);
  const poseDeltas = [];
  for (const camera of REVIEW_CAMERAS) {
    const perCamera = shots.filter((s) => s.cameraId === camera.id);
    for (let i = 0; i < perCamera.length; i++) {
      for (let j = i + 1; j < perCamera.length; j++) {
        const delta = poseDelta(perCamera[i].luma, perCamera[j].luma);
        poseDeltas.push({
          cameraId: camera.id,
          pair: `${perCamera[i].sampleId} vs ${perCamera[j].sampleId}`,
          movedPixelFraction: Number(delta.toFixed(6)),
          distinct: delta >= distinctThreshold,
        });
      }
    }
  }
  const uniquePngHashes = new Set(shots.map((s) => s.sha256)).size;
  const notDistinct = poseDeltas.filter((d) => !d.distinct);
  if (notDistinct.length || uniquePngHashes !== shots.length) {
    throw new Error(
      `pose samples are not distinct: ${uniquePngHashes}/${shots.length} unique frames; ` +
        `threshold ${distinctThreshold} (noise floor ${noiseFloor}); ` +
        `failing pairs ${JSON.stringify(notDistinct)}`,
    );
  }

  // ---- prove the undo/redo round trip on the LIVE session -----------------
  // Nine shots were captured by nine atomic gestures, so history must be nine
  // deep, one undo must erase a whole shot, and undo+redo must land on the
  // identical receipt hash. Anything else and "undoable" is a claim, not a fact.
  const captured = buildPoseReviewReceipt(session, { hash: (s) => sha256(s) });
  if (session.past.length !== shots.length) {
    throw new Error(`atomicity broken: ${shots.length} shots produced ${session.past.length} undo steps`);
  }
  const undone = poseReviewReducer(session, { type: 'undo' });
  const lastId = shotId(POSE_SAMPLES.at(-1).id, REVIEW_CAMERAS.at(-1).id);
  const lastShot = undone.present.shots.find((s) => s.id === lastId);
  const undoAtomic = lastShot.verdict === 'unreviewed' && lastShot.note === '' && lastShot.evidence === null;
  const redone = poseReviewReducer(undone, { type: 'redo' });
  const roundTrip = buildPoseReviewReceipt(redone, { hash: (s) => sha256(s) });
  const hashStable = roundTrip.canonicalJson === captured.canonicalJson;

  // A second independent build of the same state must be byte-identical too.
  const rebuilt = buildPoseReviewReceipt(session, { hash: (s) => sha256(s) });

  const undoProof = {
    uniquePngHashes,
    poseDeltas,
    controlFrameNoiseFloor: Number(noiseFloor.toFixed(6)),
    poseDistinctThreshold: Number(distinctThreshold.toFixed(6)),
    undoStepsRecorded: session.past.length,
    shotsCaptured: shots.length,
    undoIsAtomic: undoAtomic,
    canUndoAfterCapture: canUndo(session),
    canRedoAfterUndo: canRedo(undone),
    receiptHashSurvivesUndoRedo: hashStable,
    receiptRebuildIsByteIdentical: rebuilt.canonicalJson === captured.canonicalJson,
  };
  if (!undoAtomic || !hashStable || !undoProof.receiptRebuildIsByteIdentical) {
    throw new Error(`pose-review invariants failed: ${JSON.stringify(undoProof)}`);
  }

  writeFileSync(path.join(OUT_DIR, 'receipt.json'), captured.canonicalJson, 'utf8');
  writeFileSync(
    path.join(OUT_DIR, 'receipt.sha256'),
    `${captured.receipt.contentHash}  receipt.json\n`,
    'utf8',
  );
  // The undo proof is written beside the receipt but NOT inside it: the receipt
  // describes the state reached, never the route taken (see buildPoseReviewReceipt).
  writeFileSync(path.join(OUT_DIR, 'undo-proof.json'), `${JSON.stringify(undoProof, null, 2)}\n`, 'utf8');

  console.log(`strip: ${shots.length} PNGs under ${path.relative(REPO, OUT_DIR).replace(/\\/g, '/')}`);
  for (const s of shots) console.log(`  ${s.sampleId}@${s.cameraId}  ink=${s.ink.toFixed(4)}  ${s.file}`);
  console.log(`receipt: receipt.json  sha256=${captured.receipt.contentHash}`);
  console.log(`summary: ${JSON.stringify(captured.receipt.summary)}`);
  console.log(
    `unique frames: ${uniquePngHashes}/${shots.length}  control-frame noise floor: ${noiseFloor.toFixed(6)}  ` +
      `distinct threshold: ${distinctThreshold.toFixed(6)}`,
  );
  for (const d of poseDeltas) console.log(`  pose delta ${d.cameraId}: ${d.pair} = ${d.movedPixelFraction}`);
  console.log(
    'undo proof: ' +
      JSON.stringify({
        undoStepsRecorded: undoProof.undoStepsRecorded,
        shotsCaptured: undoProof.shotsCaptured,
        undoIsAtomic: undoProof.undoIsAtomic,
        receiptHashSurvivesUndoRedo: undoProof.receiptHashSurvivesUndoRedo,
        receiptRebuildIsByteIdentical: undoProof.receiptRebuildIsByteIdentical,
      }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
