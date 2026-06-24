/**
 * Headless visual proof for SP-T (Voronoi-ward town generator, iter #1):
 * subdivide a burg footprint into wards and pack each ward's street frontage
 * with party-wall building plots; render footprint + wards + plots to a PNG.
 *
 * Usage: npx tsx scripts/worldforge/renderTownProof.mjs
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateTownPlan, countPlots } from '../../src/systems/worldforge/town/townEngine.ts';
import { rootSeedPath } from '../../src/systems/worldforge/seedPath.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const W = 720, H = 720;

// An irregular burg footprint (as a leaf submap cell would hand us), centered.
const cx = 360, cy = 370, R = 300;
const footprint = [
  [cx - R * 0.95, cy - R * 0.35], [cx - R * 0.2, cy - R * 0.95],
  [cx + R * 0.7, cy - R * 0.7], [cx + R * 0.95, cy + R * 0.15],
  [cx + R * 0.45, cy + R * 0.9], [cx - R * 0.5, cy + R * 0.85],
  [cx - R * 0.95, cy + R * 0.25],
];

const plan = generateTownPlan(footprint, rootSeedPath(137), {
  wardCount: 18, plotWidth: 26, plotDepth: 30, gap: 5,
});
console.log('wards:', plan.wards.length, '| plots:', countPlots(plan));

const poly = (pts) => 'M' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') + 'Z';
const wardPaths = plan.wards.map((w) => {
  const fill = w.civic === 'plaza' ? '#e7dcc0' : '#efe6d2';
  return `<path d="${poly(w.polygon)}" fill="${fill}" stroke="#b7a77f" stroke-width="1"/>`;
}).join('');
const plotPaths = plan.wards.flatMap((w) => w.plots.map((pl) =>
  `<path d="${poly(pl.polygon)}" fill="#9c7b54" stroke="#5f4527" stroke-width="0.8"/>`,
)).join('');
const civicColor = { plaza: '#c9b88a', temple: '#8a9bc4', keep: '#7a4b4b' };
const civicPaths = plan.civic.map((c) =>
  `<path d="${poly(c.polygon)}" fill="${civicColor[c.kind]}" stroke="#2a1f10" stroke-width="1.5"/>`,
).join('');
const fp = poly(footprint);
const wall = poly(plan.walls.ring);
const gates = plan.walls.gatehouses.map((g) =>
  `<rect x="${(g[0] - 9).toFixed(1)}" y="${(g[1] - 9).toFixed(1)}" width="18" height="18" fill="#5a4a2a" stroke="#2a1f10" stroke-width="1.5"/>`,
).join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`
  + `<rect width="${W}" height="${H}" fill="#3a5a40"/>`
  + `<path d="${fp}" fill="#d9cdb0" stroke="none"/>`
  + wardPaths
  + plotPaths
  + civicPaths
  + `<path d="${wall}" fill="none" stroke="#6b5836" stroke-width="5" stroke-linejoin="round"/>`
  + gates
  + `<path d="${fp}" fill="none" stroke="#3a2a14" stroke-width="3"/>`
  + `</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(`<!doctype html><body style="margin:0">${svg}</body>`);
const outDir = path.join(__dirname, '../../.agent/town-compare');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'ours-town-voronoi-iter1.png');
await page.screenshot({ path: out });
console.log('saved', out);
await browser.close();
