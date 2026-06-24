/**
 * Visual proof for SP-T iter-3 (typology-by-scale, criterion #5): render the
 * SAME footprint + seed at three populations (village / walled town / capital)
 * so the scale-driven ward count, walls, and civic anatomy are visible together.
 *
 * Usage: npx tsx scripts/worldforge/renderTownTypologyProof.mjs
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateTownPlan, scaleProfile, countPlots } from '../../src/systems/worldforge/town/townEngine.ts';
import { rootSeedPath } from '../../src/systems/worldforge/seedPath.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PANEL = 420, PAD = 20, GAP = 16;
const cases = [
  { pop: 400, label: 'Village (400)' },
  { pop: 3500, label: 'Walled town (3,500)' },
  { pop: 120000, label: 'Capital (120,000)' },
];
const W = PAD * 2 + PANEL * cases.length + GAP * (cases.length - 1);
const H = PAD * 2 + PANEL + 36;

const cx = PANEL / 2, cy = PANEL / 2 + 8, R = PANEL * 0.42;
const footprint = [
  [cx - R * 0.95, cy - R * 0.35], [cx - R * 0.2, cy - R * 0.95],
  [cx + R * 0.7, cy - R * 0.7], [cx + R * 0.95, cy + R * 0.15],
  [cx + R * 0.45, cy + R * 0.9], [cx - R * 0.5, cy + R * 0.85],
  [cx - R * 0.95, cy + R * 0.25],
];
const poly = (pts) => 'M' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') + 'Z';
const civicColor = { plaza: '#c9b88a', temple: '#8a9bc4', keep: '#7a4b4b', citadel: '#5a2f2f' };

const panels = cases.map((c, idx) => {
  const plan = generateTownPlan(footprint, rootSeedPath(137), { population: c.pop });
  const prof = scaleProfile(c.pop);
  console.log(c.label, '→', prof.typology, '| wards', plan.wards.length, '| plots', countPlots(plan), '| civic', plan.civic.map((x) => x.kind).join(','));
  const ox = PAD + idx * (PANEL + GAP);
  const tx = (s) => `translate(${ox},${PAD})`;
  const wards = plan.wards.map((w) => `<path d="${poly(w.polygon)}" fill="${w.civic === 'plaza' ? '#e7dcc0' : '#efe6d2'}" stroke="#b7a77f" stroke-width="0.8"/>`).join('');
  const plots = plan.wards.flatMap((w) => w.plots.map((pl) => `<path d="${poly(pl.polygon)}" fill="#9c7b54" stroke="#5f4527" stroke-width="0.6"/>`)).join('');
  const civic = plan.civic.map((x) => `<path d="${poly(x.polygon)}" fill="${civicColor[x.kind]}" stroke="#2a1f10" stroke-width="1.2"/>`).join('');
  const wall = plan.walls.ring.length ? `<path d="${poly(plan.walls.ring)}" fill="none" stroke="#6b5836" stroke-width="4" stroke-linejoin="round"/>` : '';
  const gates = plan.walls.gatehouses.map((g) => `<rect x="${(g[0] - 6).toFixed(1)}" y="${(g[1] - 6).toFixed(1)}" width="12" height="12" fill="#5a4a2a" stroke="#2a1f10" stroke-width="1"/>`).join('');
  return `<g transform="${tx()}">`
    + `<path d="${poly(footprint)}" fill="#d9cdb0"/>`
    + wards + plots + civic + wall + gates
    + `<path d="${poly(footprint)}" fill="none" stroke="#3a2a14" stroke-width="2"/>`
    + `<text x="${PANEL / 2}" y="${PANEL + 22}" text-anchor="middle" font-family="Georgia,serif" font-size="15" fill="#eee">${c.label} · ${prof.typology}</text>`
    + `</g>`;
}).join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`
  + `<rect width="${W}" height="${H}" fill="#3a5a40"/>` + panels + `</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(`<!doctype html><body style="margin:0">${svg}</body>`);
const outDir = path.join(__dirname, '../../.agent/town-compare');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'ours-town-typology-iter3.png');
await page.screenshot({ path: out });
console.log('saved', out);
await browser.close();
