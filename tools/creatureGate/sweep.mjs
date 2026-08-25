// tools/creatureGate/sweep.mjs — silhouette capture for the creature gate.
//
// For each library plan id: load the Entity Forge in silhouette mode
// (?sil=1 — flat black body on a white page, no ground, no shadow), let
// AutoFrame fit the subject, then shoot four views (3/4, front, side, top)
// by orbiting the camera at the fitted radius. OrbitControls keeps the
// subject centered, so only the camera position moves.
//
//   node tools/creatureGate/sweep.mjs <outDir> <planId> [planId ...]
//
// Output: <outDir>/<planId>/{q34,front,side,top}.png
// Next stage: vendor/anyCreature/harness/maskmetrics.py measures each view
// (run by gate.mjs). Playwright drives the SYSTEM Chrome — the managed
// browsers cannot install on this box (playwright-browsers-eloop).
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { captureCanvas } from './captureCanvas.mjs';

const [outDir, ...ids] = process.argv.slice(2);
if (!outDir || ids.length === 0) {
  console.error('usage: node tools/creatureGate/sweep.mjs <outDir> <planId> [planId ...]');
  process.exit(1);
}

const VIEWS = [
  { name: 'q34', az: [0.707, 0.707], elev: 0.35 },
  { name: 'front', az: [0, 1], elev: 0.18 },
  { name: 'side', az: [1, 0], elev: 0.18 },
  { name: 'top', az: [0.05, 0.05], elev: 3.2 },
];

let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  for (const id of ids) {
    const dir = `${outDir}/${id}`;
    mkdirSync(dir, { recursive: true });
    const url = `http://localhost:3000/Aralia/misc/design.html?step=entityforge&mode=library&planId=${id}&pose=idle&sil=1`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // AutoFrame needs the soft-body build plus a few fit frames.
    await page.waitForTimeout(7000);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.startsWith('Library ('));
      if (b) b.click();
      // The fps chip and the window resize handles overlap the canvas and
      // pollute the mask — hide every DOM element except the canvas itself.
      const style = document.createElement('style');
      style.textContent = '*{visibility:hidden!important} canvas{visibility:visible!important}';
      document.head.appendChild(style);
    });
    await page.waitForTimeout(400);
    for (const view of VIEWS) {
      await page.evaluate(([ax, az, elev]) => {
        const c = window.__entityforge?.camera;
        if (!c) return;
        const r = Math.hypot(c.position.x, c.position.z) || 4;
        c.position.set(ax * r, Math.min(r * elev, r * 3.2), az * r);
      }, [view.az[0], view.az[1], view.elev]);
      await page.waitForTimeout(350);
      // Clip INSIDE the canvas: the page toolbar AND the canvas container's
      // own dark rounded border both read as mask pixels (see captureCanvas.mjs).
      await captureCanvas(page, `${dir}/${view.name}.png`);
    }
    console.log(`swept ${id}`);
  }
} finally {
  try { await browser?.close(); } catch { /* gone */ }
}
