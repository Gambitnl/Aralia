/**
 * @file scripts/capture-market-views.mjs
 * Automated headless capture rig for the Procedural 3D Medieval Market Square.
 *
 * Renders the 4 evaluation views required by the Art Director Critic:
 * 1. Overview (3/4 angle) - overall composition, spatial balance, silhouette
 * 2. Close-up (macro) - surface details, wares, timber joints, barrel hoops
 * 3. Low angle - ground contact, object seating, contact shadows, cobblestones
 * 4. Wireframe - edge loops, geometry density, mesh collision verification
 *
 * Saves images exclusively to `.agent/scratch/` (gitignored).
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
function getArg(flag, fallback) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const round = getArg('--round', '1');
const seed = getArg('--seed', '42');
const style = getArg('--style', 'grand_square');
const port = getArg('--port', '3001');

const outDir = path.resolve(process.cwd(), '.agent/scratch');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const VIEWS = [
  { id: '1-overview', view: 'overview', wireframe: false, desc: '3/4 Overview composition' },
  { id: '2-closeup', view: 'closeup', wireframe: false, desc: 'Macro close-up on stall and wares' },
  { id: '3-lowangle', view: 'lowangle', wireframe: false, desc: 'Low-angle ground contact check' },
  { id: '4-wireframe', view: 'wireframe', wireframe: true, desc: 'Wireframe edge flow & collision check' },
];

async function capture() {
  console.log(`[CaptureRig] Starting Market Square capture for Round ${round} (Seed: ${seed}, Style: ${style}, Port: ${port})`);
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu-sandbox', '--enable-webgl'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });

  const capturedFiles = [];

  for (const v of VIEWS) {
    const page = await context.newPage();
    const url = `http://127.0.0.1:${port}/Aralia/misc/design.html?step=marketsquare&seed=${seed}&style=${style}&view=${v.view}${v.wireframe ? '&wireframe=1' : ''}`;
    console.log(`[CaptureRig] Navigating to ${v.desc}: ${url}`);

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForSelector('canvas', { timeout: 15000 });

      // Give WebGL frames time to stabilize and render shadows
      await page.waitForTimeout(2500);

      const filename = `market-r${round}-${v.id}.png`;
      const outPath = path.join(outDir, filename);

      // Screenshot the canvas or full page
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`[CaptureRig] Successfully captured: ${outPath} (${fs.statSync(outPath).size} bytes)`);
      capturedFiles.push({ ...v, path: outPath });
    } catch (err) {
      console.error(`[CaptureRig] Error capturing ${v.id}:`, err);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log(`[CaptureRig] Finished capturing ${capturedFiles.length}/${VIEWS.length} views for Round ${round}.`);
}

capture().catch((err) => {
  console.error('[CaptureRig] Fatal error:', err);
  process.exit(1);
});
