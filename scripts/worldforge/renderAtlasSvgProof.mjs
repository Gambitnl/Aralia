// scripts/worldforge/renderAtlasSvgProof.mjs
// Build the SVG model for seed 'world-761', serialize to an SVG string,
// rasterize via Playwright, and write a PNG next to the real-Azgaar reference
// for parity review (Worldforge SP0 iteration #1 visual-inspection gate).
//
// Usage: npx tsx scripts/worldforge/renderAtlasSvgProof.mjs
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateFmgAtlas } from '../../src/systems/worldforge/fmg/generateAtlas.ts';
import { buildAtlasSvgModel } from '../../src/components/Worldforge/atlasSvg.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const W = 960, H = 540;

// Mirror the exact generateFmgAtlas call shape used in renderAtlasProof.ts.
// Use seed '761' (not 'world-761') to match reference capture language.
const atlas = generateFmgAtlas('761', {
  width: W,
  height: H,
  cellsDesired: 10000,
  template: 'continents',
});
const model = buildAtlasSvgModel(atlas);
const k = Math.min(W / model.width, H / model.height);
const landPolys = model.layers.find((l) => l.id === 'land').polygons;
console.log('land polygons:', landPolys.length);
const polys = landPolys
  .map((p) => `<polygon points="${p.points}" fill="${p.fill}"/>`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`
  + `<rect width="${W}" height="${H}" fill="#15375d"/>`
  + `<g transform="scale(${k})"><rect width="${model.width}" height="${model.height}" fill="#3d6ea4"/>${polys}</g></svg>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(`<!doctype html><body style="margin:0">${svg}</body>`);
const outDir = path.join(__dirname, '../../.agent/azgaar-ref');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'ours-atlas-svg-761.png');
await page.screenshot({ path: out });
console.log('saved', out);
await browser.close();
