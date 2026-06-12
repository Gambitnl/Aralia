/**
 * @file renderRegionProof.ts — headless proof renderer for L1 region generator.
 *
 * Directive C1+C2 verification: produces PNGs showing the region heightfield
 * with LOCAL-RANGE hypsometry + hillshade, plus river channels rendered as
 * width-scaled water bands with smoothed centerlines.
 *
 * Four proofs:
 * - laneC-region-default.png: LAND anchor with river (coastal)
 * - laneC-region-alt.png: different anchor (inland mid-elevation)
 * - laneC-region-mountain.png: high-relief mountain anchor
 * - laneC2-town-region.png: burg anchor with town envelope + roads (C2)
 *
 * Technique: Playwright canvas pattern (see .agent/campaign-kickoff/fmg-render-atlas.ts).
 *
 * Usage: npx tsx scripts/worldforge/renderRegionProof.ts
 * Output: docs/projects/worldforge/orchestration/proof/laneC-*.png
 *
 * What changed: C2 — added town proof showing envelope outline + gates + roads.
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateFmgAtlas } from '../../src/systems/worldforge/fmg/generateAtlas';
import { generateRegion, expandRegionMembership } from '../../src/systems/worldforge/region/generateRegion';
import { generateFmgWorld } from '../../src/systems/worldforge/fmg/generateWorld';
import { rootSeedPath } from '../../src/systems/worldforge/seedPath';
import type { RegionArtifact, RegionRiverBank, RegionTownSite, RegionRoad } from '../../src/systems/worldforge/artifacts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROOF_DIR = path.resolve(__dirname, '../../docs/projects/worldforge/orchestration/proof');

const W = 960;
const H = 540;
const WORLD_SEED = 42;
const FEET_PER_PIXEL = 9842.52;

console.log('Generating atlas...');
const atlas = generateFmgAtlas('world-42', {
  width: W,
  height: H,
  cellsDesired: 10000,
  template: 'continents',
});

console.log('Generating world (for C2 proof)...');
const world = generateFmgWorld('world-42', {
  width: W,
  height: H,
  cellsDesired: 10000,
  template: 'continents',
});

const { pack } = atlas;
const cellsN = pack.cells.h.length;
console.log(`Atlas: ${cellsN} cells, ${pack.rivers?.length ?? 0} rivers`);

// Find anchors
function findLandCellWithRiver(): number {
  for (let i = 0; i < cellsN; i++) {
    if (pack.cells.h[i] >= 20 && pack.cells.r && pack.cells.r[i] > 0) return i;
  }
  throw new Error('No land cell with river');
}

function findMidElevationCell(exclude: number): number {
  for (let i = 0; i < cellsN; i++) {
    if (i !== exclude && pack.cells.h[i] >= 30 && pack.cells.h[i] <= 55) return i;
  }
  throw new Error('No mid-elevation cell');
}

function findMountainCell(): number {
  // Find highest land cell with some nearby relief variation
  let best = -1;
  let bestH = 0;
  for (let i = 0; i < cellsN; i++) {
    const h = pack.cells.h[i];
    if (h > bestH && h >= 50) {
      bestH = h;
      best = i;
    }
  }
  if (best < 0) throw new Error('No mountain cell');
  return best;
}

const defaultAnchor = findLandCellWithRiver();
const altAnchor = findMidElevationCell(defaultAnchor);
const mountainAnchor = findMountainCell();

console.log(`Anchors: default=${defaultAnchor} (h=${pack.cells.h[defaultAnchor]}), alt=${altAnchor} (h=${pack.cells.h[altAnchor]}), mountain=${mountainAnchor} (h=${pack.cells.h[mountainAnchor]})`);

const worldPath = rootSeedPath(WORLD_SEED);

/**
 * Chaikin smoothing: iteratively average adjacent points to produce curves.
 */
function chaikinSmooth(pts: Array<[number, number]>, iterations: number): Array<[number, number]> {
  let current = pts;
  for (let iter = 0; iter < iterations; iter++) {
    const smoothed: Array<[number, number]> = [];
    for (let i = 0; i < current.length - 1; i++) {
      const [ax, ay] = current[i];
      const [bx, by] = current[i + 1];
      smoothed.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25]);
      smoothed.push([ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    current = smoothed;
  }
  return current;
}

async function renderRegion(
  region: RegionArtifact,
  label: string,
  outPath: string,
  atlasData: { cellPoints: Array<[number, number]>; cellHeights: Uint8Array | Uint16Array | Uint32Array; memberCells: number[]; feetPerPixel: number },
): Promise<void> {
  const { heightfield, rivers, bounds } = region;
  const { width: gw, height: gh, samples } = heightfield;

  // ── Local-range hypsometry ──────────────────────────────────────────
  // Find the region's own min/max to stretch the color ramp
  let localMin = Infinity, localMax = -Infinity;
  for (let i = 0; i < samples.length; i++) {
    localMin = Math.min(localMin, samples[i]);
    localMax = Math.max(localMax, samples[i]);
  }
  const range = localMax - localMin || 1;

  // ── Hillshade: simple slope-based shading from NW light ─────────────
  // Compute gradient magnitude at each sample for terrain shading
  const shade = new Float32Array(gw * gh);
  for (let row = 1; row < gh - 1; row++) {
    for (let col = 1; col < gw - 1; col++) {
      const idx = row * gw + col;
      // Sobel-like gradient (NW light direction)
      const dzdx = (samples[idx + 1] - samples[idx - 1]) / 2;
      const dzdy = (samples[idx + gw] - samples[idx - gw]) / 2;
      // Light from NW: slope facing NW is lit, SE is shadowed
      const lightX = -0.7, lightY = -0.7; // NW direction
      const slope = dzdx * lightX + dzdy * lightY;
      // Map slope to shade factor: 0.5 (shadow) to 1.5 (bright highlight)
      shade[idx] = Math.max(0.4, Math.min(1.6, 1.0 + slope * 15));
    }
  }
  // Fill edges with neutral shade
  for (let row = 0; row < gh; row++) {
    shade[row * gw] = 1.0;
    shade[row * gw + gw - 1] = 1.0;
  }
  for (let col = 0; col < gw; col++) {
    shade[col] = 1.0;
    shade[(gh - 1) * gw + col] = 1.0;
  }

  // ── Water mask from atlas (not height threshold) ────────────────────
  // Build a water mask by checking which samples correspond to atlas water
  // cells (h<20). This avoids the blue-speckle artifact where water-discipline
  // land cells (clamped to 0.19) were miscolored as water.
  const waterMask = new Uint8Array(gw * gh);
  const memberData = atlasData.memberCells.map((id) => ({
    x: atlasData.cellPoints[id][0] * atlasData.feetPerPixel,
    y: atlasData.cellPoints[id][1] * atlasData.feetPerPixel,
    h: atlasData.cellHeights[id] / 100,
  }));
  for (let row = 0; row < gh; row++) {
    const sy = bounds.y + row * heightfield.resolutionFt;
    for (let col = 0; col < gw; col++) {
      const sx = bounds.x + col * heightfield.resolutionFt;
      let nearestDist = Infinity;
      let nearestH = 1;
      for (const cell of memberData) {
        const dx = sx - cell.x;
        const dy = sy - cell.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < nearestDist) {
          nearestDist = distSq;
          nearestH = cell.h;
        }
      }
      if (nearestH < 0.2) waterMask[row * gw + col] = 1;
    }
  }

  // ── Render pixels ───────────────────────────────────────────────────
  const pixels = new Uint8Array(gw * gh * 4);
  const WATER_THRESHOLD = 0.2;

  for (let i = 0; i < samples.length; i++) {
    const h = samples[i];
    // Normalize to local range
    const t = (h - localMin) / range;
    const s = shade[i];
    let r: number, g: number, b: number;

    if (waterMask[i]) {
      // Water: deep blue → shallow blue-green
      const wt = Math.max(0, Math.min(1, (h - localMin) / Math.max(0.01, 0.2 - localMin)));
      r = Math.round((10 + 50 * wt) * s);
      g = Math.round((40 + 90 * wt) * s);
      b = Math.round((90 + 100 * wt) * s);
    } else if (t < 0.3) {
      // Lowland green
      const lt = t / 0.3;
      r = Math.round((50 + 50 * lt) * s);
      g = Math.round((110 + 30 * lt) * s);
      b = Math.round((30 + 20 * lt) * s);
    } else if (t < 0.6) {
      // Highland: green → brown
      const lt = (t - 0.3) / 0.3;
      r = Math.round((100 + 60 * lt) * s);
      g = Math.round((140 - 50 * lt) * s);
      b = Math.round((50 - 20 * lt) * s);
    } else if (t < 0.85) {
      // Mountain: brown → grey
      const lt = (t - 0.6) / 0.25;
      r = Math.round((160 - 20 * lt) * s);
      g = Math.round((90 + 30 * lt) * s);
      b = Math.round((30 + 60 * lt) * s);
    } else {
      // Peaks: grey → white
      const lt = (t - 0.85) / 0.15;
      r = Math.round((140 + 115 * lt) * s);
      g = Math.round((120 + 135 * lt) * s);
      b = Math.round((90 + 165 * lt) * s);
    }

    pixels[i * 4] = Math.min(255, Math.max(0, r));
    pixels[i * 4 + 1] = Math.min(255, Math.max(0, g));
    pixels[i * 4 + 2] = Math.min(255, Math.max(0, b));
    pixels[i * 4 + 3] = 255;
  }

  // ── Prepare river data: smoothed centerlines + width bands ──────────
  const riverBands: Array<{ pts: number[]; w: number }> = [];
  for (const bank of rivers) {
    // Convert feet → canvas pixel coordinates
    const rawPts: Array<[number, number]> = bank.centerline.map(([fx, fy]) => [
      (fx - bounds.x) / bounds.width * W,
      (fy - bounds.y) / bounds.height * H,
    ]);
    // Chaikin smooth (3 iterations for gentle curves)
    const smoothed = chaikinSmooth(rawPts, 3);
    const pts: number[] = [];
    for (const [x, y] of smoothed) pts.push(x, y);

    // Width in canvas pixels
    const w = Math.max(3, bank.widthFt / bounds.width * W * 3);
    if (pts.length >= 4) riverBands.push({ pts, w });
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: W, height: H } });

  await page.setContent(`<canvas id="c" width="${W}" height="${H}" style="display:block"></canvas>`);

  await page.evaluate(
    ({ pixelsArr, gw, gh, riverBands, label }) => {
      const canvas = document.getElementById('c') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d')!;

      // Draw heightfield
      const imgData = ctx.createImageData(gw, gh);
      imgData.data.set(new Uint8Array(pixelsArr));
      const offscreen = document.createElement('canvas');
      offscreen.width = gw;
      offscreen.height = gh;
      const offCtx = offscreen.getContext('2d')!;
      offCtx.putImageData(imgData, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(offscreen, 0, 0, gw, gh, 0, 0, canvas.width, canvas.height);

      // Draw rivers as width-scaled water bands
      for (const r of riverBands) {
        // Outer glow (wider, lighter)
        ctx.strokeStyle = 'rgba(60, 120, 180, 0.3)';
        ctx.lineWidth = r.w * 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(r.pts[0], r.pts[1]);
        for (let i = 2; i < r.pts.length; i += 2) ctx.lineTo(r.pts[i], r.pts[i + 1]);
        ctx.stroke();

        // Main water body
        ctx.strokeStyle = '#2a6090';
        ctx.lineWidth = r.w;
        ctx.beginPath();
        ctx.moveTo(r.pts[0], r.pts[1]);
        for (let i = 2; i < r.pts.length; i += 2) ctx.lineTo(r.pts[i], r.pts[i + 1]);
        ctx.stroke();

        // Highlight center
        ctx.strokeStyle = 'rgba(120, 180, 220, 0.5)';
        ctx.lineWidth = r.w * 0.3;
        ctx.beginPath();
        ctx.moveTo(r.pts[0], r.pts[1]);
        for (let i = 2; i < r.pts.length; i += 2) ctx.lineTo(r.pts[i], r.pts[i + 1]);
        ctx.stroke();
      }

      // Label
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(4, 4, 320, 24);
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px monospace';
      ctx.fillText(label, 8, 18);
    },
    {
      pixelsArr: Array.from(pixels),
      gw,
      gh,
      riverBands,
      label: `${label} | ${gw}x${gh} | ${rivers.length} rivers`,
    },
  );

  await page.locator('#c').screenshot({ path: outPath });
  console.log(`Wrote ${outPath}`);
  await browser.close();
}

/**
 * Render a region with town sites: terrain + rivers + roads + envelope + gates.
 * Same terrain pipeline as renderRegion but overlays C2 civilization data.
 */
async function renderTownRegion(
  region: RegionArtifact,
  label: string,
  outPath: string,
  atlasData: { cellPoints: Array<[number, number]>; cellHeights: Uint8Array | Uint16Array | Uint32Array; memberCells: number[]; feetPerPixel: number },
): Promise<void> {
  const { heightfield, rivers, bounds, townSites, roads } = region;
  const { width: gw, height: gh, samples } = heightfield;

  // Reuse same terrain rendering pipeline
  let localMin = Infinity, localMax = -Infinity;
  for (let i = 0; i < samples.length; i++) {
    localMin = Math.min(localMin, samples[i]);
    localMax = Math.max(localMax, samples[i]);
  }
  const range = localMax - localMin || 1;

  const shade = new Float32Array(gw * gh);
  for (let row = 1; row < gh - 1; row++) {
    for (let col = 1; col < gw - 1; col++) {
      const idx = row * gw + col;
      const dzdx = (samples[idx + 1] - samples[idx - 1]) / 2;
      const dzdy = (samples[idx + gw] - samples[idx - gw]) / 2;
      const slope = dzdx * -0.7 + dzdy * -0.7;
      shade[idx] = Math.max(0.4, Math.min(1.6, 1.0 + slope * 15));
    }
  }
  for (let row = 0; row < gh; row++) {
    shade[row * gw] = 1.0;
    shade[row * gw + gw - 1] = 1.0;
  }
  for (let col = 0; col < gw; col++) {
    shade[col] = 1.0;
    shade[(gh - 1) * gw + col] = 1.0;
  }

  // Water mask
  const waterMask = new Uint8Array(gw * gh);
  const memberData = atlasData.memberCells.map((id) => ({
    x: atlasData.cellPoints[id][0] * atlasData.feetPerPixel,
    y: atlasData.cellPoints[id][1] * atlasData.feetPerPixel,
    h: atlasData.cellHeights[id] / 100,
  }));
  for (let row = 0; row < gh; row++) {
    const sy = bounds.y + row * heightfield.resolutionFt;
    for (let col = 0; col < gw; col++) {
      const sx = bounds.x + col * heightfield.resolutionFt;
      let nearestDist = Infinity, nearestH = 1;
      for (const cell of memberData) {
        const dx = sx - cell.x, dy = sy - cell.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < nearestDist) { nearestDist = d2; nearestH = cell.h; }
      }
      if (nearestH < 0.2) waterMask[row * gw + col] = 1;
    }
  }

  // Terrain pixels
  const pixels = new Uint8Array(gw * gh * 4);
  for (let i = 0; i < samples.length; i++) {
    const h = samples[i];
    const t = (h - localMin) / range;
    const s = shade[i];
    let r: number, g: number, b: number;
    if (waterMask[i]) {
      const wt = Math.max(0, Math.min(1, (h - localMin) / Math.max(0.01, 0.2 - localMin)));
      r = Math.round((10 + 50 * wt) * s);
      g = Math.round((40 + 90 * wt) * s);
      b = Math.round((90 + 100 * wt) * s);
    } else if (t < 0.3) {
      const lt = t / 0.3;
      r = Math.round((50 + 50 * lt) * s);
      g = Math.round((110 + 30 * lt) * s);
      b = Math.round((30 + 20 * lt) * s);
    } else if (t < 0.6) {
      const lt = (t - 0.3) / 0.3;
      r = Math.round((100 + 60 * lt) * s);
      g = Math.round((140 - 50 * lt) * s);
      b = Math.round((50 - 20 * lt) * s);
    } else if (t < 0.85) {
      const lt = (t - 0.6) / 0.25;
      r = Math.round((160 - 20 * lt) * s);
      g = Math.round((90 + 30 * lt) * s);
      b = Math.round((30 + 60 * lt) * s);
    } else {
      const lt = (t - 0.85) / 0.15;
      r = Math.round((140 + 115 * lt) * s);
      g = Math.round((120 + 135 * lt) * s);
      b = Math.round((90 + 165 * lt) * s);
    }
    pixels[i * 4] = Math.min(255, Math.max(0, r));
    pixels[i * 4 + 1] = Math.min(255, Math.max(0, g));
    pixels[i * 4 + 2] = Math.min(255, Math.max(0, b));
    pixels[i * 4 + 3] = 255;
  }

  // River bands
  const riverBands: Array<{ pts: number[]; w: number }> = [];
  for (const bank of rivers) {
    const rawPts: Array<[number, number]> = bank.centerline.map(([fx, fy]) => [
      (fx - bounds.x) / bounds.width * W,
      (fy - bounds.y) / bounds.height * H,
    ]);
    const smoothed = chaikinSmooth(rawPts, 3);
    const pts: number[] = [];
    for (const [x, y] of smoothed) pts.push(x, y);
    const w = Math.max(3, bank.widthFt / bounds.width * W * 3);
    if (pts.length >= 4) riverBands.push({ pts, w });
  }

  // Road lines (canvas coords)
  const roadLines: Array<{ pts: number[]; w: number; kind: string }> = [];
  for (const road of roads) {
    const rawPts: Array<[number, number]> = road.centerline.map(([fx, fy]) => [
      (fx - bounds.x) / bounds.width * W,
      (fy - bounds.y) / bounds.height * H,
    ]);
    const smoothed = chaikinSmooth(rawPts, 3);
    const pts: number[] = [];
    for (const [x, y] of smoothed) pts.push(x, y);
    const w = Math.max(2, road.widthFt / bounds.width * W * 3);
    if (pts.length >= 4) roadLines.push({ pts, w, kind: road.kind });
  }

  // Town envelopes + gates (canvas coords)
  const envelopes: Array<{ x: number; y: number; w: number; h: number; gates: number[][] }> = [];
  for (const site of townSites) {
    const env = site.envelope;
    const ex = (env.x - bounds.x) / bounds.width * W;
    const ey = (env.y - bounds.y) / bounds.height * H;
    const ew = env.width / bounds.width * W;
    const eh = env.height / bounds.height * H;
    const gates = site.gates.map(([gx, gy]) => [
      (gx - bounds.x) / bounds.width * W,
      (gy - bounds.y) / bounds.height * H,
    ]);
    envelopes.push({ x: ex, y: ey, w: ew, h: eh, gates });
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.setContent(`<canvas id="c" width="${W}" height="${H}" style="display:block"></canvas>`);

  await page.evaluate(
    ({ pixelsArr, gw, gh, riverBands, roadLines, envelopes, label }) => {
      const canvas = document.getElementById('c') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d')!;

      // Terrain
      const imgData = ctx.createImageData(gw, gh);
      imgData.data.set(new Uint8Array(pixelsArr));
      const offscreen = document.createElement('canvas');
      offscreen.width = gw;
      offscreen.height = gh;
      const offCtx = offscreen.getContext('2d')!;
      offCtx.putImageData(imgData, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(offscreen, 0, 0, gw, gh, 0, 0, canvas.width, canvas.height);

      // Rivers
      for (const r of riverBands) {
        ctx.strokeStyle = 'rgba(60, 120, 180, 0.3)';
        ctx.lineWidth = r.w * 2;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(r.pts[0], r.pts[1]);
        for (let i = 2; i < r.pts.length; i += 2) ctx.lineTo(r.pts[i], r.pts[i + 1]);
        ctx.stroke();
        ctx.strokeStyle = '#2a6090'; ctx.lineWidth = r.w;
        ctx.beginPath(); ctx.moveTo(r.pts[0], r.pts[1]);
        for (let i = 2; i < r.pts.length; i += 2) ctx.lineTo(r.pts[i], r.pts[i + 1]);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(120, 180, 220, 0.5)'; ctx.lineWidth = r.w * 0.3;
        ctx.beginPath(); ctx.moveTo(r.pts[0], r.pts[1]);
        for (let i = 2; i < r.pts.length; i += 2) ctx.lineTo(r.pts[i], r.pts[i + 1]);
        ctx.stroke();
      }

      // Roads
      for (const rd of roadLines) {
        // Road casing (darker edge)
        ctx.strokeStyle = rd.kind === 'road' ? '#6b4c2a' : '#8a7a5a';
        ctx.lineWidth = rd.w + 2;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(rd.pts[0], rd.pts[1]);
        for (let i = 2; i < rd.pts.length; i += 2) ctx.lineTo(rd.pts[i], rd.pts[i + 1]);
        ctx.stroke();
        // Road fill
        ctx.strokeStyle = rd.kind === 'road' ? '#c9a66b' : '#b8a880';
        ctx.lineWidth = rd.w;
        ctx.beginPath(); ctx.moveTo(rd.pts[0], rd.pts[1]);
        for (let i = 2; i < rd.pts.length; i += 2) ctx.lineTo(rd.pts[i], rd.pts[i + 1]);
        ctx.stroke();
      }

      // Town envelopes
      for (const env of envelopes) {
        // Dashed outline
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(env.x, env.y, env.w, env.h);
        ctx.setLineDash([]);

        // Semi-transparent fill
        ctx.fillStyle = 'rgba(255, 68, 68, 0.08)';
        ctx.fillRect(env.x, env.y, env.w, env.h);

        // Gates as dots
        for (const gate of env.gates) {
          ctx.fillStyle = '#ff0';
          ctx.beginPath();
          ctx.arc(gate[0], gate[1], 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#a00';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Label
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(4, 4, 420, 24);
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px monospace';
      ctx.fillText(label, 8, 18);
    },
    {
      pixelsArr: Array.from(pixels),
      gw, gh, riverBands, roadLines, envelopes,
      label: `${label} | ${gw}x${gh}`,
    },
  );

  await page.locator('#c').screenshot({ path: outPath });
  console.log(`Wrote ${outPath}`);
  await browser.close();
}

(async () => {
  const proofs = [
    { anchor: defaultAnchor, name: 'laneC-region-default.png', desc: 'land+river' },
    { anchor: altAnchor, name: 'laneC-region-alt.png', desc: 'alt anchor' },
    { anchor: mountainAnchor, name: 'laneC-region-mountain.png', desc: 'mountain' },
  ];

  for (const { anchor, name, desc } of proofs) {
    console.log(`Generating region for cell:${anchor}...`);
    const region = generateRegion(atlas, anchor, worldPath, {
      feetPerPixel: FEET_PER_PIXEL,
      resolutionFt: 100,
    });
    // Compute member cells for water mask (only cells in the region)
    const memberCells = expandRegionMembership(
      pack.cells.c, anchor, pack.cells.p, FEET_PER_PIXEL,
    );
    const atlasData = {
      cellPoints: pack.cells.p,
      cellHeights: pack.cells.h,
      memberCells,
      feetPerPixel: FEET_PER_PIXEL,
    };
    await renderRegion(region, `Region cell:${anchor} (${desc})`, path.join(PROOF_DIR, name), atlasData);
  }

  // ── C2 proof: town region with roads + envelope + gates ────────────
  const worldPack = world.pack;
  let burgAnchor = -1;
  for (let i = 0; i < worldPack.cells.h.length; i++) {
    if (worldPack.cells.burg && worldPack.cells.burg[i] > 0 && worldPack.cells.h[i] >= 20) {
      burgAnchor = i;
      break;
    }
  }
  if (burgAnchor < 0) throw new Error('No burg cell found for C2 proof');

  console.log(`Generating C2 town region for cell:${burgAnchor}...`);
  const townRegion = generateRegion(world, burgAnchor, worldPath, {
    feetPerPixel: FEET_PER_PIXEL,
    resolutionFt: 100,
    world,
  });

  const townMemberCells = expandRegionMembership(
    worldPack.cells.c, burgAnchor, worldPack.cells.p, FEET_PER_PIXEL,
  );
  const townAtlasData = {
    cellPoints: worldPack.cells.p,
    cellHeights: worldPack.cells.h,
    memberCells: townMemberCells,
    feetPerPixel: FEET_PER_PIXEL,
  };
  await renderTownRegion(
    townRegion,
    `C2 Town cell:${burgAnchor} | ${townRegion.townSites.length} sites, ${townRegion.roads.length} roads`,
    path.join(PROOF_DIR, 'laneC2-town-region.png'),
    townAtlasData,
  );

  console.log('Proof rendering complete.');
})();
