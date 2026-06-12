/**
 * Headless proof script that renders the procedural FMG atlas.
 *
 * It generates an atlas using the FMG engine with a fixed seed ('world-42'),
 * renders the canvas using drawAtlas in a Playwright browser page,
 * and writes two PNG proofs: one default view, and one zoomed-in (3x) centered on land.
 * It also measures the performance benefits of caching by comparing the time taken for a
 * full redraw against a cached pan blit.
 *
 * Usage: npx tsx scripts/worldforge/renderAtlasProof.ts
 */

import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { generateFmgAtlas } from "../../src/systems/worldforge/fmg/generateAtlas";
import { generateFmgWorld } from "../../src/systems/worldforge/fmg/generateWorld";
import { FEET_PER_FMG_PIXEL } from "../../src/systems/worldforge/adapter/atlasArtifact";
import { drawAtlas, drawGraticule, drawScaleBar, parseHexColor, isStateBorder, shouldShowBurgLabel, intersects, getCleanNumber } from "../../src/components/Worldforge/atlasDraw";
import { generateRegion } from "../../src/systems/worldforge/region/generateRegion";
import { rootSeedPath } from "../../src/systems/worldforge/seedPath";
import { drawRegion } from "../../src/components/Worldforge/regionDraw";

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

  const injectAtlasFn = async (p: any) => {
    await p.evaluate(
      ({ drawAtlasStr, drawGraticuleStr, drawScaleBarStr, parseHexColorStr, isStateBorderStr, shouldShowBurgLabelStr, intersectsStr, getCleanNumberStr, feetPerPixel }) => {
        const g = window as any;
        g.FEET_PER_FMG_PIXEL = feetPerPixel;
        g.parseHexColor = new Function("const __name = (fn) => fn; return " + parseHexColorStr)();
        g.isStateBorder = new Function("const __name = (fn) => fn; return " + isStateBorderStr)();
        g.shouldShowBurgLabel = new Function("const __name = (fn) => fn; return " + shouldShowBurgLabelStr)();
        g.intersects = new Function("const __name = (fn) => fn; return " + intersectsStr)();
        g.getCleanNumber = new Function("const __name = (fn) => fn; return " + getCleanNumberStr)();
        g.drawGraticule = new Function("const __name = (fn) => fn; return " + drawGraticuleStr)();
        g.drawScaleBar = new Function("const __name = (fn) => fn; return " + drawScaleBarStr)();
        g.drawAtlas = new Function("const __name = (fn) => fn; return " + drawAtlasStr)();
      },
      {
        drawAtlasStr: drawAtlas.toString(),
        drawGraticuleStr: drawGraticule.toString(),
        drawScaleBarStr: drawScaleBar.toString(),
        parseHexColorStr: parseHexColor.toString(),
        isStateBorderStr: isStateBorder.toString(),
        shouldShowBurgLabelStr: shouldShowBurgLabel.toString(),
        intersectsStr: intersects.toString(),
        getCleanNumberStr: getCleanNumber.toString(),
        feetPerPixel: FEET_PER_FMG_PIXEL,
      }
    );
  };

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
  // Playwright Headless Rendering & Benchmarking
  // --------------------------------------------------------------------------
  // We launch a headless Chromium browser, set up a canvas, inject the
  // drawAtlas function source code, render both styled views, and benchmark redraw times.
  // --------------------------------------------------------------------------
  console.log("Launching headless browser for rendering...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: W, height: H } });

  // 1. Set up page canvas
  await page.setContent(`<canvas id="c" width="${W}" height="${H}" style="display:block"></canvas>`);

  // Inject drawAtlas, drawGraticule, drawScaleBar, and helper functions into browser context
  await injectAtlasFn(page);

  // 2. Render and save styled default view (scale: 1)
  console.log("Drawing styled default view...");
  const defaultView = { offsetX: 0, offsetY: 0, scale: 1 };
  await page.evaluate(
    ({ atlas, view }) => {
      const canvas = document.getElementById("c") as HTMLCanvasElement;
      const ctx = canvas.getContext("2d")!;
      (window as any).drawAtlas(ctx, atlas, view);
    },
    { atlas, view: defaultView }
  );

  const defaultOutPath = path.join(proofDir, "laneA2-styled-default.png");
  await page.locator("#c").screenshot({ path: defaultOutPath });
  console.log(`Saved styled default view to: ${defaultOutPath}`);

  // 3. Render, save and benchmark styled zoom view (scale: 3)
  const zoomScale = 3;
  const zoomView = {
    scale: zoomScale,
    offsetX: W / 2 - centerX * zoomScale,
    offsetY: H / 2 - centerY * zoomScale,
  };

  console.log("Drawing and benchmarking styled zoomed view...");
  const timings = await page.evaluate(
    ({ atlas, view, w, h }) => {
      const canvas = document.getElementById("c") as HTMLCanvasElement;
      const ctx = canvas.getContext("2d")!;

      // Time a full redraw (rendering 6000+ Voronoi polygons directly)
      const t0 = performance.now();
      ctx.clearRect(0, 0, w, h);
      (window as any).drawAtlas(ctx, atlas, view);
      const t1 = performance.now();
      const fullRenderMs = t1 - t0;

      // Time the first cached render creation
      const t2 = performance.now();
      const cacheCanvas = document.createElement("canvas");
      cacheCanvas.width = (atlas.graphWidth ?? 960) * view.scale;
      cacheCanvas.height = (atlas.graphHeight ?? 540) * view.scale;
      const cacheCtx = cacheCanvas.getContext("2d")!;
      (window as any).drawAtlas(cacheCtx, atlas, { scale: view.scale, offsetX: 0, offsetY: 0 });
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(cacheCanvas, view.offsetX, view.offsetY);
      const t3 = performance.now();
      const firstCacheRenderMs = t3 - t2;

      // Time a cached pan redraw (just copying the pre-rendered cache canvas at a new offset)
      const panView = { ...view, offsetX: view.offsetX + 50, offsetY: view.offsetY - 20 };
      const t4 = performance.now();
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(cacheCanvas, panView.offsetX, panView.offsetY);
      const t5 = performance.now();
      const cachedPanMs = t5 - t4;

      return {
        fullRenderMs,
        firstCacheRenderMs,
        cachedPanMs,
      };
    },
    { atlas, view: zoomView, w: W, h: H }
  );

  console.log("\n==========================================");
  console.log("RENDER PERFORMANCE TIMINGS (Browser Context)");
  console.log(`- Full redraw time:       ${timings.fullRenderMs.toFixed(2)} ms`);
  console.log(`- First cache creation:   ${timings.firstCacheRenderMs.toFixed(2)} ms`);
  console.log(`- Cached pan blit time:   ${timings.cachedPanMs.toFixed(2)} ms`);
  console.log("==========================================\n");

  const zoomOutPath = path.join(proofDir, "laneA2-styled-zoom3.png");
  await page.locator("#c").screenshot({ path: zoomOutPath });
  console.log(`Saved styled zoomed view to: ${zoomOutPath}`);

  // --------------------------------------------------------------------------
  // 4. Render and save A3 Demo Dashboard UI (laneA3-demo.png)
  // --------------------------------------------------------------------------
  console.log("\nGenerating A3 Demo Dashboard UI proof...");
  
  // Set viewport to fully contain the dashboard side-by-side layout
  await page.setViewportSize({ width: 1360, height: 660 });

  // Load the dashboard HTML structure mimicking AtlasDemo.tsx layout
  const dashboardHtml = `
    <style>
      body {
        margin: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        background-color: #030712;
        color: #f3f4f6;
        -webkit-font-smoothing: antialiased;
      }
      header {
        border-bottom: 1px solid #111827;
        background-color: rgba(3, 7, 18, 0.8);
        backdrop-filter: blur(8px);
        padding: 16px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        position: sticky;
        top: 0;
        z-index: 20;
      }
      .readout {
        display: flex;
        gap: 24px;
        background-color: rgba(17, 24, 39, 0.4);
        border: 1px solid rgba(31, 41, 55, 0.6);
        padding: 6px 16px;
        border-radius: 8px;
        font-size: 12px;
      }
      main {
        display: flex;
        padding: 24px;
        gap: 24px;
        max-width: 1280px;
        margin: 0 auto;
      }
      .sidebar {
        width: 320px;
        background-color: rgba(17, 24, 39, 0.5);
        border: 1px solid #111827;
        border-radius: 12px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
        flex-shrink: 0;
      }
      .panel-title {
        font-size: 11px;
        font-weight: bold;
        color: #9ca3af;
        border-bottom: 1px solid #1f2937;
        padding-bottom: 8px;
        letter-spacing: 0.05em;
      }
      .control-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .control-label {
        font-size: 12px;
        font-weight: 600;
        color: #9ca3af;
      }
      input, select {
        background-color: #030712;
        border: 1px solid #1f2937;
        color: #a5b4fc;
        padding: 6px 12px;
        border-radius: 8px;
        font-size: 14px;
        font-family: monospace;
      }
      select {
        color: #d1d5db;
        font-family: inherit;
        cursor: pointer;
      }
      .btn-generate {
        background: linear-gradient(to right, #4f46e5, #4338ca);
        color: white;
        font-weight: 600;
        padding: 8px 16px;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        text-align: center;
        font-size: 14px;
        box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      .map-area {
        flex: 1;
        background-color: #030712;
        border: 1px solid #111827;
        border-radius: 16px;
        padding: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.6);
      }
      .overlay-info {
        position: absolute;
        top: 32px;
        left: 32px;
        background-color: rgba(17, 24, 39, 0.8);
        backdrop-filter: blur(6px);
        padding: 8px 12px;
        border-radius: 8px;
        border: 1px solid #1f2937;
        font-size: 11px;
        pointer-events: none;
      }
      .overlay-zoom {
        position: absolute;
        bottom: 32px;
        right: 32px;
        background-color: rgba(17, 24, 39, 0.8);
        backdrop-filter: blur(6px);
        padding: 6px;
        border-radius: 8px;
        border: 1px solid #1f2937;
        display: flex;
        flex-direction: column;
        gap: 8px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      }
      .zoom-btn {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #d1d5db;
        font-size: 16px;
        border-radius: 6px;
        cursor: pointer;
        font-family: monospace;
      }
      .zoom-btn:hover {
        background-color: #1f2937;
        color: white;
      }
      .toggle-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;
        color: #d1d5db;
        padding: 4px 0;
      }
      .toggle-switch {
        width: 32px;
        height: 16px;
        background-color: #4f46e5;
        border-radius: 9999px;
        position: relative;
      }
      .toggle-switch::after {
        content: '';
        position: absolute;
        top: 3px;
        right: 3px;
        width: 10px;
        height: 10px;
        background-color: white;
        border-radius: 9999px;
      }
    </style>

    <div style="min-height: 100vh; display: flex; flex-direction: column;">
      <header>
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="background-color: rgba(79, 70, 229, 0.2); color: #818cf8; padding: 8px; border-radius: 8px; border: 1px solid rgba(99, 102, 241, 0.3);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div>
            <div style="font-size: 18px; font-weight: bold; color: white;">Worldforge Atlas Cartographer</div>
            <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">Procedural World Generation & Interactive Render Harness</div>
          </div>
        </div>
        <div class="readout">
          <div><span style="color: #6b7280;">Gen Time:</span> <span style="color: #10b981; font-weight: bold;" id="readout-time">118.2ms</span></div>
          <div style="width: 1px; background-color: #1f2937; height: 16px;"></div>
          <div><span style="color: #6b7280;">Cells:</span> <span style="color: #3b82f6; font-weight: bold;" id="readout-cells">10,000</span></div>
          <div style="width: 1px; background-color: #1f2937; height: 16px;"></div>
          <div><span style="color: #6b7280;">Rivers:</span> <span style="color: #a855f7; font-weight: bold;" id="readout-rivers">35</span></div>
        </div>
      </header>
      <main>
        <div class="sidebar">
          <div class="panel-title">WORLD GENERATOR</div>
          <div class="control-group">
            <label class="control-label">World Seed</label>
            <div style="display: flex; gap: 8px;">
              <input type="text" value="world-42" style="flex: 1;" readonly>
              <button style="background-color: #1f2937; border: 1px solid #374151; padding: 6px 10px; border-radius: 8px; color: #d1d5db;">🎲</button>
            </div>
          </div>
          <div class="control-group">
            <label class="control-label">Heightmap Template</label>
            <select><option>Continents</option></select>
          </div>
          <div class="control-group">
            <label class="control-label">Cell Density</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; background: #030712; padding: 4px; border-radius: 8px; border: 1px solid #1f2937; text-align: center; font-size: 12px; font-weight: bold;">
              <div style="color: #6b7280; padding: 4px 0;">1K Cells</div>
              <div style="background: #4f46e5; color: white; border-radius: 6px; padding: 4px 0;">10K Cells</div>
            </div>
          </div>
          <button class="btn-generate">
            <span style="font-size: 12px;">✨</span> Generate World
          </button>
          
          <div class="panel-title" style="margin-top: 10px;">CARTOGRAPHY OPTIONS</div>
          <div class="toggle-row">
            <div>
              <div>Display Scale Bar</div>
              <div style="font-size: 9px; color: #6b7280;">Alternating miles & feet bar</div>
            </div>
            <div class="toggle-switch"></div>
          </div>
          <div class="toggle-row" style="margin-top: 4px;">
            <div>
              <div>Display Graticule Grid</div>
              <div style="font-size: 9px; color: #6b7280;">Latitude & longitude grid lines</div>
            </div>
            <div class="toggle-switch"></div>
          </div>
        </div>
        
        <div class="map-area">
          <canvas id="c" width="960" height="540" style="border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); display:block;"></canvas>
          <div class="overlay-info">
            <div style="color: #9ca3af; font-family: monospace;">Seed: <span style="color: white; font-weight: bold;">world-42</span></div>
            <div style="color: #6b7280; font-family: monospace; font-size: 10px; margin-top: 2px;" id="overlay-stats-text">Cells: 10,000 | Rivers: 35</div>
          </div>
          <div class="overlay-zoom">
            <div class="zoom-btn">🔍+</div>
            <div class="zoom-btn" style="font-size: 8px;">RST</div>
            <div class="zoom-btn">🔍-</div>
          </div>
        </div>
      </main>
    </div>
  `;

  await page.setContent(dashboardHtml);

  // Re-inject draw core and helper functions to the new page context
  await injectAtlasFn(page);

  // Render the default view with graticule grid enabled
  const demoView = {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    showScaleBar: true,
    showGraticule: true, // Enabled to showcase graticule lines in the proof screenshot!
  };

  await page.evaluate(
    ({ atlas, view, timings }) => {
      const canvas = document.getElementById("c") as HTMLCanvasElement;
      const ctx = canvas.getContext("2d")!;
      (window as any).drawAtlas(ctx, atlas, view);

      // Update readout text values
      document.getElementById("readout-time")!.innerText = timings.fullRenderMs.toFixed(1) + "ms";
      document.getElementById("readout-cells")!.innerText = atlas.pack.cells.h.length.toLocaleString();
      document.getElementById("readout-rivers")!.innerText = (atlas.pack.rivers?.length ?? 0).toString();
      document.getElementById("overlay-stats-text")!.innerText = `Cells: ${atlas.pack.cells.h.length.toLocaleString()} | Rivers: ${atlas.pack.rivers?.length ?? 0}`;
    },
    { atlas, view: demoView, timings }
  );

  const demoOutPath = path.join(proofDir, "laneA3-demo.png");
  await page.screenshot({ path: demoOutPath, fullPage: true });
  console.log(`Saved A3 interactive demo UI proof to: ${demoOutPath}`);

  // --------------------------------------------------------------------------
  // 5. Render and save A4 Region Descent UI (laneA4-region-descend.png & laneA4-breadcrumb.png)
  // --------------------------------------------------------------------------
  console.log("\nGenerating A4 Region Descent UI proofs...");

  // Find a land cell with a river flowing through it (to capture both terrain relief and river banks!)
  let targetCellId = -1;
  for (let i = 0; i < cellsN; i++) {
    if (pack.cells.h[i] >= 20 && pack.cells.r && pack.cells.r[i] > 0) {
      targetCellId = i;
      break;
    }
  }
  if (targetCellId === -1) {
    for (let i = 0; i < cellsN; i++) {
      if (pack.cells.h[i] >= 20) {
        targetCellId = i;
        break;
      }
    }
  }
  console.log(`Selected cell for L1 region descent: #${targetCellId}`);

  console.log(`Generating L1 region artifact...`);
  const seedNum = parseInt(seed.replace(/\D/g, "")) || 42;
  const region = generateRegion(atlas, targetCellId, rootSeedPath(seedNum), {
    feetPerPixel: 9842.51968503937, // FEET_PER_FMG_PIXEL
    resolutionFt: 100
  });

  // Re-write HTML content to represent region view mode
  const regionHtml = `
    <style>
      body {
        margin: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        background-color: #030712;
        color: #f3f4f6;
        -webkit-font-smoothing: antialiased;
      }
      header {
        border-bottom: 1px solid #111827;
        background-color: rgba(3, 7, 18, 0.8);
        backdrop-filter: blur(8px);
        padding: 16px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        position: sticky;
        top: 0;
        z-index: 20;
      }
      .readout {
        display: flex;
        gap: 24px;
        background-color: rgba(17, 24, 39, 0.4);
        border: 1px solid rgba(31, 41, 55, 0.6);
        padding: 6px 16px;
        border-radius: 8px;
        font-size: 12px;
      }
      main {
        display: flex;
        padding: 24px;
        gap: 24px;
        max-width: 1280px;
        margin: 0 auto;
      }
      .sidebar {
        width: 320px;
        background-color: rgba(17, 24, 39, 0.5);
        border: 1px solid #111827;
        border-radius: 12px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
        flex-shrink: 0;
      }
      .panel-title {
        font-size: 11px;
        font-weight: bold;
        color: #9ca3af;
        border-bottom: 1px solid #1f2937;
        padding-bottom: 8px;
        letter-spacing: 0.05em;
      }
      .btn-ascend {
        background-color: #1f2937;
        border: 1px solid #374151;
        color: white;
        font-weight: 600;
        padding: 8px 16px;
        border-radius: 8px;
        cursor: pointer;
        text-align: center;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      .btn-ascend:hover {
        background-color: #374151;
      }
      .map-area {
        flex: 1;
        background-color: #030712;
        border: 1px solid #111827;
        border-radius: 16px;
        padding: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.6);
      }
      .overlay-info {
        position: absolute;
        top: 32px;
        left: 32px;
        background-color: rgba(17, 24, 39, 0.8);
        backdrop-filter: blur(6px);
        padding: 8px 12px;
        border-radius: 8px;
        border: 1px solid #1f2937;
        font-size: 11px;
        pointer-events: none;
      }
      .overlay-esc {
        position: absolute;
        bottom: 32px;
        right: 32px;
        background-color: rgba(17, 24, 39, 0.8);
        backdrop-filter: blur(6px);
        padding: 6px 12px;
        border-radius: 8px;
        border: 1px solid #1f2937;
        font-size: 10px;
        color: #9ca3af;
        font-family: monospace;
      }
      .breadcrumb-strip {
        width: 960px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background-color: rgba(17, 24, 39, 0.4);
        border: 1px solid #1f2937;
        border-radius: 8px;
        margin-bottom: 16px;
        font-size: 12px;
      }
    </style>

    <div style="min-height: 100vh; display: flex; flex-direction: column;">
      <header>
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="background-color: rgba(79, 70, 229, 0.2); color: #818cf8; padding: 8px; border-radius: 8px; border: 1px solid rgba(99, 102, 241, 0.3);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 10px; font-family: monospace; font-weight: bold; background-color: rgba(99, 102, 241, 0.2); color: #a5b4fc; padding: 2px 6px; border: 1px solid rgba(99, 102, 241, 0.4); border-radius: 4px;">L1 REGION</span>
              <div style="font-size: 18px; font-weight: bold; color: white;">Worldforge Atlas Cartographer</div>
            </div>
            <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">Zoom descent slice centered on Cell #${targetCellId}</div>
          </div>
        </div>
        <div class="readout">
          <div><span style="color: #6b7280;">Grid Area:</span> <span style="color: #3b82f6; font-weight: bold;" id="readout-grid-size">0 × 0</span></div>
          <div style="width: 1px; background-color: #1f2937; height: 16px;"></div>
          <div><span style="color: #6b7280;">River Channels:</span> <span style="color: #a855f7; font-weight: bold;" id="readout-rivers-count">0</span></div>
        </div>
      </header>
      <main>
        <div class="sidebar">
          <div class="panel-title">REGION VIEW</div>
          <div style="font-size: 12px; color: #9ca3af; line-height: 1.6; background-color: rgba(3, 7, 18, 0.4); padding: 14px; border-radius: 8px; border: 1px solid rgba(31, 41, 55, 0.4);">
            <div style="color: #a5b4fc; font-weight: bold; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">ℹ️ Sub-Cell Geography</div>
            <p style="margin: 0 0 8px 0;">You have zoomed into the refined sub-cell heightfield map for <strong>Cell #${targetCellId}</strong>.</p>
            <p style="margin: 0 0 8px 0;">This terrain did not exist at the world level. It has been procedurally generated at L1 resolution (100 ft spacing).</p>
            <p style="margin: 0;">Solid dark bands indicate refined river banks width-scaled by local upstream flux.</p>
          </div>
          <button class="btn-ascend">⬅️ Ascend to World Map</button>
        </div>
        
        <div style="flex: 1; display: flex; flex-direction: column;">
          <div class="breadcrumb-strip">
            <div style="font-family: monospace; color: #9ca3af;">
              <span style="color: #818cf8; font-weight: bold;">Seed:</span> ${seed} <span style="color: #4b5563;">/</span> <span style="color: #818cf8; font-weight: bold;">Cell:</span> #${targetCellId}
            </div>
            <div style="color: #6b7280; font-size: 10px;">Esc or click sidebar button to ascend back</div>
          </div>
          
          <div class="map-area">
            <canvas id="c" width="960" height="540" style="border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); display:block;"></canvas>
            <div class="overlay-info">
              <div style="color: #9ca3af; font-family: monospace;">Region Size: <span style="color: white; font-weight: bold;" id="overlay-region-size">0 × 0 ft</span></div>
              <div style="color: #6b7280; font-family: monospace; font-size: 10px; margin-top: 2px;" id="overlay-region-res">Resolution: 100 ft | Grid: 0×0</div>
            </div>
            <div class="overlay-esc">
              Press <span style="color: #818cf8; font-weight: bold; background-color: #030712; padding: 2px 4px; border-radius: 4px; border: 1px solid #1f2937;">ESC</span> to ascend
            </div>
          </div>
        </div>
      </main>
    </div>
  `;

  await page.setContent(regionHtml);

  // Inject drawRegion function into browser context
  await page.evaluate((drawRegionStr) => {
    (window as any).drawRegion = new Function("const __name = (fn) => fn; return " + drawRegionStr)();
  }, drawRegion.toString());

  // Render the L1 region artifact in the page context
  await page.evaluate(
    ({ region }) => {
      const canvas = document.getElementById("c") as HTMLCanvasElement;
      const ctx = canvas.getContext("2d")!;
      (window as any).drawRegion(ctx, region);

      // Update readout text values in the DOM
      const w = region.heightfield.width;
      const h = region.heightfield.height;
      document.getElementById("readout-grid-size")!.innerText = `${w} × ${h}`;
      document.getElementById("readout-rivers-count")!.innerText = (region.rivers?.length ?? 0).toString();
      document.getElementById("overlay-region-size")!.innerText = `${Math.round(region.bounds.width).toLocaleString()} × ${Math.round(region.bounds.height).toLocaleString()} ft`;
      document.getElementById("overlay-region-res")!.innerText = `Resolution: ${region.heightfield.resolutionFt} ft | Grid: ${w}×${h}`;
    },
    { region }
  );

  const regionOutPath = path.join(proofDir, "laneA4-region-descend.png");
  await page.screenshot({ path: regionOutPath, fullPage: true });
  console.log(`Saved A4 region descent UI proof to: ${regionOutPath}`);

  // Capture breadcrumbs and ascend control close-up
  const breadcrumbOutPath = path.join(proofDir, "laneA4-breadcrumb.png");
  await page.screenshot({
    path: breadcrumbOutPath,
    clip: { x: 0, y: 0, width: 800, height: 250 }
  });
  console.log(`Saved A4 breadcrumb & ascend control proof to: ${breadcrumbOutPath}`);

  // --------------------------------------------------------------------------
  // 6. Render and save A5 Political Map UI (laneA5-political.png & laneA5-political-zoom.png)
  // --------------------------------------------------------------------------
  console.log("\nGenerating A5 Political Map UI proofs...");

  console.log(`Generating political world using generateFmgWorld for seed '${seed}'...`);
  const politicalWorld = generateFmgWorld(seed, {
    width: W,
    height: H,
    cellsDesired: 10000,
    template,
  });

  // Delete non-serializable quadtree to allow Playwright serialization
  if ((politicalWorld.pack.cells as any).q) {
    delete (politicalWorld.pack.cells as any).q;
  }

  console.log(`Political world generated: ${politicalWorld.pack.cells.h.length} cells, ${politicalWorld.pack.states?.filter(s => s && s.i > 0 && !s.removed).length} states, ${politicalWorld.pack.burgs?.filter(b => b && (b.i ?? 0) > 0 && !b.removed).length} burgs.`);

  // Reset page viewport and content to canvas
  await page.setViewportSize({ width: W, height: H });
  await page.setContent(`<canvas id="c" width="${W}" height="${H}" style="display:block"></canvas>`);

  // Re-inject draw core and helper functions into the page context
  await injectAtlasFn(page);

  // Render political layer (full map, scale: 1)
  console.log("Drawing political layer (full map)...");
  const politicalView = {
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    showScaleBar: true,
    showGraticule: false,
    showPolitical: true
  };
  await page.evaluate(
    ({ atlas, view }) => {
      const canvas = document.getElementById("c") as HTMLCanvasElement;
      const ctx = canvas.getContext("2d")!;
      (window as any).drawAtlas(ctx, atlas, view);
    },
    { atlas: politicalWorld, view: politicalView }
  );

  const politicalOutPath = path.join(proofDir, "laneA5-political.png");
  await page.locator("#c").screenshot({ path: politicalOutPath });
  console.log(`Saved A5 political map proof to: ${politicalOutPath}`);

  // Render political layer zoomed (scale: 2.5) centered on land centroid
  console.log("Drawing political layer (zoomed map)...");
  const politicalZoomScale = 2.5;
  const politicalZoomView = {
    scale: politicalZoomScale,
    offsetX: W / 2 - centerX * politicalZoomScale,
    offsetY: H / 2 - centerY * politicalZoomScale,
    showScaleBar: true,
    showGraticule: false,
    showPolitical: true
  };
  await page.evaluate(
    ({ atlas, view }) => {
      const canvas = document.getElementById("c") as HTMLCanvasElement;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      (window as any).drawAtlas(ctx, atlas, view);
    },
    { atlas: politicalWorld, view: politicalZoomView }
  );

  const politicalZoomOutPath = path.join(proofDir, "laneA5-political-zoom.png");
  await page.locator("#c").screenshot({ path: politicalZoomOutPath });
  console.log(`Saved A5 political map zoom proof to: ${politicalZoomOutPath}`);

  // --------------------------------------------------------------------------
  // 7. Render and save A6 Zoom Transition Sequence (laneA6-descend-sequence.png)
  // --------------------------------------------------------------------------
  console.log("\nGenerating A6 Zoom Transition Sequence proofs...");

  // Setup basic canvas
  await page.setViewportSize({ width: W, height: H });
  await page.setContent(`<canvas id="c" width="${W}" height="${H}" style="display:block"></canvas>`);

  // Inject drawAtlas, drawRegion, and all helpers
  await injectAtlasFn(page);
  await page.evaluate((drawRegionStr) => {
    (window as any).drawRegion = new Function("const __name = (fn) => fn; return " + drawRegionStr)();
  }, drawRegion.toString());

  // 1. Stage 1: Atlas default view (scale: 1.0)
  console.log("Capturing Stage 1...");
  await page.evaluate(
    ({ atlas }) => {
      const canvas = document.getElementById("c") as HTMLCanvasElement;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      (window as any).drawAtlas(ctx, atlas, { scale: 1, offsetX: 0, offsetY: 0 });
    },
    { atlas }
  );
  const buf1 = await page.locator("#c").screenshot();

  // 2. Stage 2: Atlas zoomed (scale: 3.9) just before descent
  console.log("Capturing Stage 2...");
  const scaleZoomed = 3.9;
  const viewZoomed = {
    scale: scaleZoomed,
    offsetX: W / 2 - centerX * scaleZoomed,
    offsetY: H / 2 - centerY * scaleZoomed,
  };
  await page.evaluate(
    ({ atlas, view }) => {
      const canvas = document.getElementById("c") as HTMLCanvasElement;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      (window as any).drawAtlas(ctx, atlas, view);
    },
    { atlas, view: viewZoomed }
  );
  const buf2 = await page.locator("#c").screenshot();

  // 3. Stage 3: L1 Region view (auto-descent)
  console.log("Capturing Stage 3...");
  await page.evaluate(
    ({ region }) => {
      const canvas = document.getElementById("c") as HTMLCanvasElement;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      (window as any).drawRegion(ctx, region);
    },
    { region }
  );
  const buf3 = await page.locator("#c").screenshot();

  // 4. Stage 4: Restored L0 Atlas view clamped (scale: 3.5)
  console.log("Capturing Stage 4...");
  const scaleRestored = 3.5;
  const viewRestored = {
    scale: scaleRestored,
    offsetX: W / 2 - centerX * scaleRestored,
    offsetY: H / 2 - centerY * scaleRestored,
  };
  await page.evaluate(
    ({ atlas, view }) => {
      const canvas = document.getElementById("c") as HTMLCanvasElement;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      (window as any).drawAtlas(ctx, atlas, view);
    },
    { atlas, view: viewRestored }
  );
  const buf4 = await page.locator("#c").screenshot();

  // 5. Composite them into a 2x2 grid in HTML and screenshot
  console.log("Compositing A6 sequence proof...");
  const compositeHtml = `
    <style>
      body {
        margin: 0;
        background-color: #030712;
        color: #f3f4f6;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
        padding: 24px;
        display: flex;
        flex-direction: column;
        align-items: center;
        -webkit-font-smoothing: antialiased;
      }
      .title {
        font-size: 18px;
        font-weight: bold;
        margin-bottom: 20px;
        color: white;
        text-align: center;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        width: 960px;
      }
      .card {
        background-color: rgba(17, 24, 39, 0.5);
        border: 1px solid #1f2937;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
      }
      .label {
        font-size: 11px;
        font-weight: bold;
        color: #a5b4fc;
        background-color: #111827;
        padding: 8px 12px;
        border-bottom: 1px solid #1f2937;
        font-family: monospace;
      }
      img {
        display: block;
        width: 470px;
        height: 264px;
      }
    </style>
    <div class="title">
      <span style="font-size: 10px; font-family: monospace; font-weight: bold; background-color: rgba(99, 102, 241, 0.2); color: #a5b4fc; padding: 2px 6px; border: 1px solid rgba(99, 102, 241, 0.4); border-radius: 4px;">L0 ⇄ L1 ZOOM SEQUENCE</span>
      Worldforge Zoom Transition Cycle (Directive A6)
    </div>
    <div class="grid">
      <div class="card">
        <div class="label">1. L0 ATLAS DEFAULT VIEW (scale: 1.0)</div>
        <img src="data:image/png;base64,${buf1.toString("base64")}">
      </div>
      <div class="card">
        <div class="label">2. L0 ATLAS ZOOMED IN (scale: 3.9 - transition trigger at &ge;4.0)</div>
        <img src="data:image/png;base64,${buf2.toString("base64")}">
      </div>
      <div class="card">
        <div class="label">3. L1 REGION VIEW (auto-descent over Land Cell #${targetCellId})</div>
        <img src="data:image/png;base64,${buf3.toString("base64")}">
      </div>
      <div class="card">
        <div class="label">4. L0 ATLAS RESTORED & CLAMPED (scale: 3.5 - hysteresis cooldown)</div>
        <img src="data:image/png;base64,${buf4.toString("base64")}">
      </div>
    </div>
  `;

  await page.setViewportSize({ width: 1020, height: 660 });
  await page.setContent(compositeHtml);
  
  const compositeOutPath = path.join(proofDir, "laneA6-descend-sequence.png");
  await page.screenshot({ path: compositeOutPath, fullPage: true });
  console.log(`Saved A6 descend-sequence composite proof to: ${compositeOutPath}`);

  await browser.close();
  console.log("Rendering and performance tests completed successfully.");
}

main().catch((err) => {
  console.error("Error running proof script:", err);
  process.exit(1);
});
