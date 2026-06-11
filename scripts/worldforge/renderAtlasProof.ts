/**
 * Headless proof script that renders the procedural FMG atlas.
 *
 * It generates an atlas using the FMG engine with a fixed seed ('world-42'),
 * renders the canvas using drawAtlas in a Playwright browser page,
 * and writes two PNG proofs: one default view, and one zoomed-in (3x) centered on land.
 *
 * Usage: npx tsx scripts/worldforge/renderAtlasProof.ts
 */

import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { generateFmgAtlas } from "../../src/systems/worldforge/fmg/generateAtlas";
import { drawAtlas } from "../../src/components/Worldforge/atlasDraw";

// ============================================================================
// Section: Configuration & Constants
// ============================================================================

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const W = 960;
const H = 540;

// ============================================================================
// Section: Main Execution
// ============================================================================

async function main() {
  const seed = "world-42";
  const template = "continents";

  console.log(`Generating atlas for seed '${seed}' and template '${template}'...`);
  const atlas = generateFmgAtlas(seed, {
    width: W,
    height: H,
    cellsDesired: 10000,
    template,
  });

  const pack = atlas.pack;
  const cellsN = pack.cells.h.length;
  console.log(`Atlas generated: ${cellsN} cells, ${pack.rivers?.length ?? 0} rivers.`);

  // --------------------------------------------------------------------------
  // Compute Zoom Center
  // --------------------------------------------------------------------------
  // We locate all land cells (height >= 20) and calculate their centroid
  // to ensure our 3x zoom view centers cleanly on the main land mass.
  // --------------------------------------------------------------------------
  let sumX = 0;
  let sumY = 0;
  let landCellCount = 0;
  for (let i = 0; i < cellsN; i++) {
    if (pack.cells.h[i] >= 20) {
      const p = pack.cells.p[i];
      if (p) {
        sumX += p[0];
        sumY += p[1];
        landCellCount++;
      }
    }
  }

  const centerX = landCellCount > 0 ? sumX / landCellCount : W / 2;
  const centerY = landCellCount > 0 ? sumY / landCellCount : H / 2;
  console.log(`Land centroid computed at: (${Math.round(centerX)}, ${Math.round(centerY)})`);

  // Ensure output directory exists
  const proofDir = path.join(__dirname, "../../docs/projects/worldforge/orchestration/proof");
  fs.mkdirSync(proofDir, { recursive: true });

  // --------------------------------------------------------------------------
  // Playwright Headless Rendering
  // --------------------------------------------------------------------------
  // We launch a headless Chromium browser, set up a canvas, inject the
  // drawAtlas function source code, and render both views.
  // --------------------------------------------------------------------------
  console.log("Launching headless browser for rendering...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: W, height: H } });

  // 1. Render Default View (scale: 1, offset: 0,0)
  await page.setContent(`<canvas id="c" width="${W}" height="${H}" style="display:block"></canvas>`);

  // Inject drawAtlas function into browser context
  await page.evaluate((drawAtlasStr) => {
    (window as any).drawAtlas = new Function("return " + drawAtlasStr)();
  }, drawAtlas.toString());

  console.log("Drawing default view...");
  const defaultView = { offsetX: 0, offsetY: 0, scale: 1 };
  await page.evaluate(
    ({ atlas, view }) => {
      const canvas = document.getElementById("c") as HTMLCanvasElement;
      const ctx = canvas.getContext("2d")!;
      (window as any).drawAtlas(ctx, atlas, view);
    },
    { atlas, view: defaultView }
  );

  const defaultOutPath = path.join(proofDir, "laneA-atlas-default.png");
  await page.locator("#c").screenshot({ path: defaultOutPath });
  console.log(`Saved default view to: ${defaultOutPath}`);

  // 2. Render Zoomed View (scale: 3, centered on land mass)
  const zoomScale = 3;
  const zoomView = {
    scale: zoomScale,
    offsetX: W / 2 - centerX * zoomScale,
    offsetY: H / 2 - centerY * zoomScale,
  };

  console.log("Drawing zoomed view...");
  // Clear canvas for fresh draw
  await page.evaluate(() => {
    const canvas = document.getElementById("c") as HTMLCanvasElement;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  await page.evaluate(
    ({ atlas, view }) => {
      const canvas = document.getElementById("c") as HTMLCanvasElement;
      const ctx = canvas.getContext("2d")!;
      (window as any).drawAtlas(ctx, atlas, view);
    },
    { atlas, view: zoomView }
  );

  const zoomOutPath = path.join(proofDir, "laneA-atlas-zoom3.png");
  await page.locator("#c").screenshot({ path: zoomOutPath });
  console.log(`Saved zoomed view to: ${zoomOutPath}`);

  await browser.close();
  console.log("Rendering completed successfully.");
}

main().catch((err) => {
  console.error("Error running proof script:", err);
  process.exit(1);
});
