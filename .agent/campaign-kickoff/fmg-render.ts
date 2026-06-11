/**
 * Visual inspection rig for the ported FMG physical base (Worldforge 2a).
 * Runs generateFmgBase headless, rasterizes heights/features per-pixel via
 * nearest grid cell, renders through a Playwright canvas, writes PNG.
 * Usage: npx tsx .agent/campaign-kickoff/fmg-render.ts <seed> <template> <outName>
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateFmgBase } from '../../src/systems/worldforge/fmg/generateBase';
import { findGridCell } from '../../src/systems/worldforge/fmg/utils/graphUtils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seed = process.argv[2] || 'aralia-fmg-golden-1';
const template = process.argv[3] || 'continents';
const outName = process.argv[4] || `fmg-${template}-${seed}`;

const W = 960, H = 540;
const result = generateFmgBase(seed, { width: W, height: H, cellsDesired: 10000, template });
const grid = result.grid as any;
const heights: Uint8Array = grid.cells.h;
const featureIds: Uint16Array | number[] = grid.cells.f;
const features = grid.features;

console.log('generated:', { seed, template, cells: heights.length });

// Color ramp — FMG height convention: 0-100, water < 20.
function colorFor(h: number, featureType: string | undefined): [number, number, number] {
  if (h < 20) {
    if (featureType === 'lake') return [70, 130, 180];
    const t = h / 20; // 0 deep → 1 shallow
    return [Math.round(15 + 40 * t), Math.round(50 + 70 * t), Math.round(110 + 80 * t)];
  }
  if (h < 35) { const t = (h - 20) / 15; return [Math.round(90 + 40 * t), Math.round(150 - 10 * t), Math.round(70 + 10 * t)]; }
  if (h < 55) { const t = (h - 35) / 20; return [Math.round(130 + 40 * t), Math.round(140 - 40 * t), Math.round(80 - 20 * t)]; }
  if (h < 75) { const t = (h - 55) / 20; return [Math.round(170 - 50 * t), Math.round(100 + 10 * t), Math.round(60 + 50 * t)]; }
  const t = Math.min(1, (h - 75) / 25); const v = Math.round(150 + 105 * t); return [v, v, v];
}

// Draw the TRUE Voronoi cell polygons (cells.v vertex indices → vertices.p
// coordinates) — Azgaar's actual cells, not the square-grid lookup
// approximation (which made the first renders look like pixel blocks).
const polys: Array<{ pts: number[]; fill: string }> = [];
const verts = grid.vertices.p as Array<[number, number]>;
for (let i = 0; i < heights.length; i++) {
  const vIds: number[] = grid.cells.v[i];
  if (!vIds || vIds.length < 3) continue;
  const fid = featureIds[i];
  const ftype = fid && features[fid] ? features[fid].type : undefined;
  const [r, g, b] = colorFor(heights[i], ftype);
  const pts: number[] = [];
  for (const v of vIds) { const p = verts[v]; if (p) pts.push(p[0], p[1]); }
  polys.push({ pts, fill: `rgb(${r},${g},${b})` });
}
console.log('voronoi polygons:', polys.length);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(`<canvas id="c" width="${W}" height="${H}" style="display:block"></canvas>`);
await page.evaluate(
  ({ polys, w, h, drawEdges }) => {
    const ctx = (document.getElementById('c') as HTMLCanvasElement).getContext('2d')!;
    ctx.fillStyle = '#0e2d52'; ctx.fillRect(0, 0, w, h);
    for (const poly of polys) {
      ctx.beginPath();
      ctx.moveTo(poly.pts[0], poly.pts[1]);
      for (let i = 2; i < poly.pts.length; i += 2) ctx.lineTo(poly.pts[i], poly.pts[i + 1]);
      ctx.closePath();
      ctx.fillStyle = poly.fill;
      ctx.fill();
      if (drawEdges) { ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 0.5; ctx.stroke(); }
    }
  },
  { polys, w: W, h: H, drawEdges: process.env.EDGES === '1' },
);
const out = path.join(__dirname, `${outName}.png`);
await page.locator('#c').screenshot({ path: out });
console.log('wrote', out);
await browser.close();
