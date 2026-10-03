#!/usr/bin/env node
/**
 * capture-transfer-evidence.mjs — agora-a34b (IDEA - Geometry Painter
 * deterministic surface marking; idea ref `idea:surface-directed-detail-painting`).
 *
 * WHAT THIS IS. `paint-surface-mask.mjs` proves the sidecar mask is
 * deterministic and its category legend is internally consistent, but it
 * only ever tessellates a hand-rolled capsule/sphere approximation of the
 * skeleton — never the REAL production mesh. This script is the transfer
 * check: it captures the actual entity-debugger render of the same canid-v2
 * stand-in (Beast quadruped, `?type=Beast`, no cues needed — see the
 * category-rule note in paint-surface-mask.mjs) through the shared Vite dev
 * server, using the shared headless-capture rig
 * (`tools/entities3d/capture/captureLib.mjs`) exactly as AGENTS.md rule 6
 * requires for any render. Reviewing this PNG beside `mask-preview.png`
 * (the side-view projection colored by category) is the "transfer evidence":
 * a human or a later pass can see the same body-region boundaries (legs,
 * toes, spine, neck, tail) land on the same real geometry the game actually
 * renders, not just on this script's own synthetic proxy mesh.
 *
 * This script does NOT modify the production entity debugger, does NOT read
 * back per-vertex data from the live scene, and does NOT attempt to make the
 * live render pixel-identical to mask-preview.png — the two are independent
 * views (synthetic tessellation vs. production skinned mesh) of the same
 * skeleton identity, compared by eye per the Idea Board experiment convention
 * (see docs/projects/idea-board/experiments/cascadeur-collision-penetration-cleaning.md's
 * "Cleanup"/"Run log" sections for the same before/after PNG pattern).
 *
 * USAGE (dev server must already be running at http://127.0.0.1:5174)
 *   node tools/geometry-painter/capture-transfer-evidence.mjs
 *
 * Output: .agent/scratch/agora-a34b/transfer-evidence-render.png (throwaway,
 * gitignored — confirm with `git check-ignore`).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  launchCaptureBrowser,
  newCapturePage,
  gotoScene,
  writePng,
} from '../entities3d/capture/captureLib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..');
const OUT_PATH = path.join(REPO, '.agent', 'scratch', 'agora-a34b', 'transfer-evidence-render.png');

// Same candidate identity as paint-surface-mask.mjs's RECIPE: CreatureType
// Beast with no bird/frog/spider cue falls through to beastPlan('Beast', ...)
// in creaturePlans.ts basePlanForCreature — the entity debugger's
// `?type=Beast` query param needs no cue param to land on the same quadruped
// template. `wire=0&bones=0` keep the render as a plain solid mesh (closest
// visual match to a "painted surface").
const URL = 'http://127.0.0.1:5174/Aralia/misc/design.html?step=entitydebug&mode=creature&type=Beast&size=Medium&seed=1&wire=0&bones=0&overlay=none';

/**
 * captureLib's grabCanvasPng/inkFraction destructure `{ gl, scene, camera }`
 * off the named window handle. window.__entitydebug (EntityDebugScene.tsx
 * line ~597) publishes the renderer under the key `renderer`, not `gl` — a
 * different shape than __partlab's. Rather than edit the shared, frequently
 * locked captureLib.mjs to special-case a second key name, this local copy
 * follows the same convention 2/3 rules (render on demand, read back in the
 * same task) against __entitydebug's actual field names.
 */
async function grabEntityDebugPng(page) {
  const dataUrl = await page.evaluate(() => {
    const state = window.__entitydebug;
    if (!state) throw new Error('window.__entitydebug is missing');
    const { renderer: gl, scene, camera } = state;
    if (!gl || !scene || !camera) throw new Error('__entitydebug is missing renderer/scene/camera');
    gl.render(scene, camera);
    const canvas = gl.domElement ?? document.querySelector('canvas');
    return canvas.toDataURL('image/png');
  });
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

async function entityDebugInkFraction(page) {
  return page.evaluate(() => {
    const state = window.__entitydebug;
    const gl = state?.renderer;
    if (gl && state.scene && state.camera) gl.render(state.scene, state.camera);
    const cv = gl?.domElement ?? document.querySelector('canvas');
    if (!cv) return 0;
    const off = document.createElement('canvas');
    off.width = cv.width; off.height = cv.height;
    const ctx = off.getContext('2d');
    ctx.drawImage(cv, 0, 0);
    const { data } = ctx.getImageData(0, 0, off.width, off.height);
    const bg = [data[0], data[1], data[2]];
    let ink = 0, n = 0;
    for (let y = 0; y < off.height; y += 2) {
      for (let x = 0; x < off.width; x += 2) {
        const i = (y * off.width + x) * 4;
        const d = Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]);
        n++;
        if (d > 24) ink++;
      }
    }
    return n ? ink / n : 0;
  });
}

async function main() {
  const { browser, context } = await launchCaptureBrowser({ width: 900, height: 700 });
  try {
    const { page, errors } = await newCapturePage(context);
    await gotoScene(page, URL, { hook: 'window.__entitydebug && window.__entitydebug.scene && window.__entitydebug.camera' });

    const ink = await entityDebugInkFraction(page);
    const png = await grabEntityDebugPng(page);
    const written = writePng(OUT_PATH, png);

    console.log('transfer-evidence render written:', path.relative(REPO, written));
    console.log('ink fraction (non-background pixels):', ink.toFixed(3));
    if (errors.length) {
      console.log('page errors observed:');
      for (const e of errors.slice(0, 10)) console.log('  -', e);
    }
    if (ink < 0.02) {
      console.error('WARNING: ink fraction is near zero — capture likely blank/black; do not treat as valid transfer evidence.');
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('capture-transfer-evidence failed:', err);
  process.exitCode = 1;
});
