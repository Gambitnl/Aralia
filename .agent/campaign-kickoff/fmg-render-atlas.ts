/**
 * Visual inspection rig for the FMG atlas port (Worldforge 2b): renders the
 * PACKED cell graph with real biome colors + river polylines — the standing
 * render-and-eyeball proof for slice 2 (climate → reGraph → rivers → biomes).
 * Usage: npx tsx .agent/campaign-kickoff/fmg-render-atlas.ts <seed> <template> <outName>
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateFmgAtlas } from '../../src/systems/worldforge/fmg/generateAtlas';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seed = process.argv[2] || 'world-42';
const template = process.argv[3] || 'continents';
const outName = process.argv[4] || `fmg-atlas-${template}-${seed}`;

const W = 960, H = 540;
const atlas = generateFmgAtlas(seed, { width: W, height: H, cellsDesired: 10000, template }) as any;
const pack = atlas.pack;
const biomeColors: string[] = atlas.biomesData.color;
const cellsN = pack.cells.h.length;
console.log('atlas:', { seed, template, packCells: cellsN, rivers: pack.rivers.length });

const verts = pack.vertices.p as Array<[number, number]>;
const polys: Array<{ pts: number[]; fill: string }> = [];
for (let i = 0; i < cellsN; i++) {
  const vIds: number[] = pack.cells.v[i];
  if (!vIds || vIds.length < 3) continue;
  const h = pack.cells.h[i];
  let fill: string;
  if (h < 20) {
    const t = Math.max(0, h / 20);
    fill = `rgb(${Math.round(15 + 40 * t)},${Math.round(55 + 70 * t)},${Math.round(115 + 75 * t)})`;
  } else {
    fill = biomeColors[pack.cells.biome[i]] ?? '#888888';
  }
  const pts: number[] = [];
  for (const v of vIds) { const p = verts[v]; if (p) pts.push(p[0], p[1]); }
  polys.push({ pts, fill });
}

// Rivers: polylines through pack cell centers, width from river discharge.
const rivers: Array<{ pts: number[]; w: number }> = [];
for (const r of pack.rivers) {
  const pts: number[] = [];
  for (const c of r.cells) {
    if (c < 0) continue;
    const p = pack.cells.p[c];
    if (p) pts.push(p[0], p[1]);
  }
  if (pts.length >= 4) rivers.push({ pts, w: Math.max(0.6, Math.min(3.5, (r.width ?? 1) * 1.5)) });
}
console.log('drawing rivers:', rivers.length);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(`<canvas id="c" width="${W}" height="${H}" style="display:block"></canvas>`);
await page.evaluate(
  ({ polys, rivers, w, h }) => {
    const ctx = (document.getElementById('c') as HTMLCanvasElement).getContext('2d')!;
    ctx.fillStyle = '#0e2d52'; ctx.fillRect(0, 0, w, h);
    for (const poly of polys) {
      ctx.beginPath();
      ctx.moveTo(poly.pts[0], poly.pts[1]);
      for (let i = 2; i < poly.pts.length; i += 2) ctx.lineTo(poly.pts[i], poly.pts[i + 1]);
      ctx.closePath();
      ctx.fillStyle = poly.fill; ctx.fill();
    }
    ctx.strokeStyle = '#3d6fa8'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const r of rivers) {
      ctx.lineWidth = r.w;
      ctx.beginPath();
      ctx.moveTo(r.pts[0], r.pts[1]);
      for (let i = 2; i < r.pts.length; i += 2) ctx.lineTo(r.pts[i], r.pts[i + 1]);
      ctx.stroke();
    }
  },
  { polys, rivers, w: W, h: H },
);
const out = path.join(__dirname, `${outName}.png`);
await page.locator('#c').screenshot({ path: out });
console.log('wrote', out);
await browser.close();
