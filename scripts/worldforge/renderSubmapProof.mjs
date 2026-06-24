/**
 * Headless visual proof for SP1 (Voronoi submap engine): generate a submap for a
 * parent cell polygon with an inherited burg + road junctions, and render the
 * Voronoi cells (boundary = the parent shape; burg cell highlighted) to a PNG.
 *
 * Usage: npx tsx scripts/worldforge/renderSubmapProof.mjs
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateSubmap } from '../../src/systems/worldforge/submap/submapEngine.ts';
import { rootSeedPath } from '../../src/systems/worldforge/seedPath.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const W = 640, H = 640;

// A hexagon-ish parent cell (like an Azgaar Voronoi cell), centered in the view.
const cx = 320, cy = 330, R = 270;
const polygon = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 3) * i - Math.PI / 2;
  return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
});

const model = generateSubmap(
  {
    polygon,
    seedPath: rootSeedPath(761),
    biome: 'Temperate deciduous forest',
    features: [
      { kind: 'burg', x: cx, y: cy - 120, id: 137, name: 'Bomnogorvan' }, // toward the top
      { kind: 'roadJunction', x: cx - 80, y: cy + 60 },
      { kind: 'roadJunction', x: cx + 90, y: cy + 40 },
    ],
    polylines: [
      // an inherited river meandering across the parent cell (clipped to its shape)
      { kind: 'river', points: [[cx - R, cy - 40], [cx - 90, cy], [cx, cy - 110], [cx + 70, cy + 60], [cx + R, cy + R * 0.4]] },
      // an inherited road from the burg area to the SE
      { kind: 'road', points: [[cx, cy - 120], [cx + 60, cy + 40], [cx + R, cy + 120]] },
    ],
  },
  { count: 140 },
);
console.log('submap cells:', model.cells.length, '| burgCellIndex:', model.burgCellIndex);

const BIOME_TINT = {
  Grassland: '#cdd9a6', Savanna: '#d8d199', Wetland: '#a9c6a3',
  'Temperate deciduous forest': '#bcd0a0', 'Temperate rainforest': '#a7c69a',
};
const cellPaths = model.cells.map((c, i) => {
  const d = 'M' + c.polygon.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') + 'Z';
  const isBurg = i === model.burgCellIndex;
  const isJunction = c.feature?.kind === 'roadJunction';
  const tint = BIOME_TINT[c.biome] || '#d8e3c8';
  return `<path d="${d}" fill="${isBurg ? '#e0a73a' : isJunction ? '#c9d6b0' : tint}" stroke="#7a8a6a" stroke-width="0.8"/>`;
}).join('');
const polylineSvg = (model.polylines ?? []).map((pl) => {
  const d = 'M' + pl.points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L');
  return pl.kind === 'river'
    ? `<path d="${d}" fill="none" stroke="#5d97bb" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="${d}" fill="none" stroke="#8b5a2b" stroke-width="2.5" stroke-dasharray="6 4" stroke-linecap="round"/>`;
}).join('');
const boundary = 'M' + polygon.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') + 'Z';
const burg = model.cells[model.burgCellIndex ?? -1]?.feature;
const burgDot = burg ? `<circle cx="${burg.x}" cy="${burg.y}" r="5" fill="#fff" stroke="#7a1228" stroke-width="2"/><text x="${burg.x}" y="${burg.y - 10}" text-anchor="middle" font-family="Georgia,serif" font-size="13" fill="#3a1020" stroke="#fff" stroke-width="3" paint-order="stroke">${burg.name}</text>` : '';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`
  + `<rect width="${W}" height="${H}" fill="#1f3048"/>`
  + cellPaths
  + polylineSvg
  + `<path d="${boundary}" fill="none" stroke="#1a2233" stroke-width="3"/>`
  + burgDot
  + `</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(`<!doctype html><body style="margin:0">${svg}</body>`);
const outDir = path.join(__dirname, '../../.agent/azgaar-ref');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'ours-submap-proof.png');
await page.screenshot({ path: out });
console.log('saved', out);
await browser.close();
