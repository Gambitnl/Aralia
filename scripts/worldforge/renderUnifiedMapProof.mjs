/**
 * Visual proof for the map↔WF unification: generate a real FMG world, rewrite a
 * 30×20 legacy grid's biomes from it (unifyMapBiomesWithWorld), and render the
 * grid as colored tiles. Should look like a downsampled view of the WF world —
 * seas + coastlines + biome regions — not random noise.
 *
 * Usage: npx tsx scripts/worldforge/renderUnifiedMapProof.mjs
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateFmgWorld } from '../../src/systems/worldforge/fmg/generateWorld.ts';
import { unifyMapBiomesWithWorld } from '../../src/systems/worldforge/local/unifyMapBiomes.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cols = 30, rows = 20, cell = 20;
const W = cols * cell, H = rows * cell;

const world = generateFmgWorld('2026');
const map = {
  gridSize: { rows, cols },
  tiles: Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) => ({ x, y, biomeId: 'plains', discovered: false, isPlayerCurrent: false }))),
};
unifyMapBiomesWithWorld(map, world, { cols, rows });

// Color by legacy biome id prefix (rough family palette).
const colorFor = (id) => {
  if (id === 'ocean') return '#22506e';
  if (id.startsWith('forest')) return '#3f7d3f';
  if (id.startsWith('jungle')) return '#2f6b3a';
  if (id.startsWith('plains') || id.startsWith('steppe')) return '#c2cf7a';
  if (id.startsWith('desert')) return '#d9c184';
  if (id.startsWith('wetland') || id === 'floodplain') return '#6f9a6a';
  if (id.startsWith('tundra')) return '#cfe0e6';
  if (id.startsWith('mountain') || id.startsWith('highland')) return '#9a8f7a';
  if (id.startsWith('coastal')) return '#6fa0b0';
  return '#b8b8a0';
};

let rects = '';
const counts = {};
for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
  const id = map.tiles[y][x].biomeId;
  counts[id] = (counts[id] ?? 0) + 1;
  rects += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="${colorFor(id)}" stroke="#0003" stroke-width="0.5"/>`;
}
console.log('unified grid biome counts:', counts);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${rects}</svg>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(`<!doctype html><body style="margin:0">${svg}</body>`);
const outDir = path.join(__dirname, '../../.agent/scratch');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'unified-map-proof.png');
await page.screenshot({ path: out });
console.log('saved', out);
await browser.close();
