/**
 * Visual proof for SP-T iter-4 (terrain/water, criterion #4): a town footprint
 * with an inherited river → docks on waterfront wards + bridges where the river
 * crosses between wards, plus slope-aware frontage from a height field.
 *
 * Usage: npx tsx scripts/worldforge/renderTownWaterProof.mjs
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateTownPlan, countPlots } from '../../src/systems/worldforge/town/townEngine.ts';
import { rootSeedPath } from '../../src/systems/worldforge/seedPath.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const W = 720, H = 720;
const cx = 360, cy = 370, R = 300;
const footprint = [
  [cx - R * 0.95, cy - R * 0.35], [cx - R * 0.2, cy - R * 0.95],
  [cx + R * 0.7, cy - R * 0.7], [cx + R * 0.95, cy + R * 0.15],
  [cx + R * 0.45, cy + R * 0.9], [cx - R * 0.5, cy + R * 0.85],
  [cx - R * 0.95, cy + R * 0.25],
];
// A river meandering across the footprint (footprint coords).
const river = [[cx - R, cy - 40], [cx - 120, cy + 10], [cx + 10, cy - 30], [cx + 130, cy + 60], [cx + R, cy + 120]];
// A regional road continued through the town toward the gatehouses.
const road = [[cx - R - 60, cy + 120], [cx - 40, cy + 80], [cx + 60, cy - 40], [cx + R + 60, cy - 90]];

const plan = generateTownPlan(footprint, rootSeedPath(137), {
  population: 6000,
  plotWidth: 26, plotDepth: 30, gap: 5,
  water: [river],
  roads: [road],
  heightAt: (p) => p[1] * 1.4, // gentle N–S grade
  maxGrade: 0.9,
});
const docks = plan.civic.filter((c) => c.kind === 'dock').length;
const bridges = plan.civic.filter((c) => c.kind === 'bridge').length;
const interior = plan.wards.reduce((n, w) => n + w.plots.filter((p) => p.kind === 'interior').length, 0);
const lshapes = plan.wards.reduce((n, w) => n + w.plots.filter((p) => p.shape === 'L').length, 0);
console.log('wards', plan.wards.length, '| plots', countPlots(plan), '| docks', docks, '| bridges', bridges, '| interior', interior, '| L-shapes', lshapes, '| streets', plan.streets.length);

const poly = (pts) => 'M' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') + 'Z';
const open = (pts) => 'M' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L');
const civicColor = { plaza: '#c9b88a', temple: '#8a9bc4', keep: '#7a4b4b', citadel: '#5a2f2f', dock: '#3f6f8f', bridge: '#caa86a' };

const wards = plan.wards.map((w) => `<path d="${poly(w.polygon)}" fill="${w.civic === 'plaza' ? '#e7dcc0' : '#efe6d2'}" stroke="#b7a77f" stroke-width="0.9"/>`).join('');
const plots = plan.wards.flatMap((w) => w.plots.map((pl) => {
  const fill = pl.kind === 'interior' ? '#b89a72' : '#9c7b54';
  return `<path d="${poly(pl.polygon)}" fill="${fill}" stroke="#5f4527" stroke-width="0.6"/>`;
})).join('');
const streets = plan.streets.map((s) => `<path d="${open(s)}" fill="none" stroke="#cdbf9c" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
const civic = plan.civic.map((c) => `<path d="${poly(c.polygon)}" fill="${civicColor[c.kind]}" stroke="#1c150a" stroke-width="1.3"/>`).join('');
const wall = plan.walls.ring.length ? `<path d="${poly(plan.walls.ring)}" fill="none" stroke="#6b5836" stroke-width="4" stroke-linejoin="round"/>` : '';
const gates = plan.walls.gatehouses.map((g) => `<rect x="${(g[0] - 7).toFixed(1)}" y="${(g[1] - 7).toFixed(1)}" width="14" height="14" fill="#5a4a2a" stroke="#2a1f10" stroke-width="1.2"/>`).join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`
  + `<rect width="${W}" height="${H}" fill="#3a5a40"/>`
  + `<path d="${poly(footprint)}" fill="#d9cdb0"/>`
  + wards + streets + plots
  + `<path d="${open(river)}" fill="none" stroke="#5d97bb" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`
  + civic + wall + gates
  + `<path d="${poly(footprint)}" fill="none" stroke="#3a2a14" stroke-width="2.5"/>`
  + `</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(`<!doctype html><body style="margin:0">${svg}</body>`);
const outDir = path.join(__dirname, '../../.agent/town-compare');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'ours-town-water-iter4.png');
await page.screenshot({ path: out });
console.log('saved', out);
await browser.close();
