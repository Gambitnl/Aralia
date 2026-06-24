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
import { generateFmgWorld } from '../../src/systems/worldforge/fmg/generateWorld.ts';
import { buildAtlasSvgModel, declutterLabels } from '../../src/components/Worldforge/atlasSvg.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const W = 960, H = 540;

// Use generateFmgWorld (not atlas-only) so the civilization layer — burgs,
// routes, states — exists for T5. FmgWorldResult extends FmgAtlasResult, so
// buildAtlasSvgModel consumes it directly.
const atlas = generateFmgWorld('761', {
  width: W,
  height: H,
  cellsDesired: 10000,
  template: 'continents',
});
const model = buildAtlasSvgModel(atlas);
const k = Math.min(W / model.width, H / model.height);
const oceanRegions = model.layers.find((l) => l.id === 'ocean').regions ?? [];
const landRegions = model.layers.find((l) => l.id === 'land').regions ?? [];
console.log('ocean depth bands:', oceanRegions.length, '| merged land regions:', landRegions.length);
const oceanPaths = oceanRegions
  .map((r) => `<path d="${r.d}" fill="${r.fill}" fill-rule="evenodd"/>`).join('');
const paths = landRegions
  .map((r) => `<path d="${r.d}" fill="${r.fill}" fill-rule="evenodd"/>`).join('');
const riverPaths = (model.rivers ?? [])
  .map((r) => `<path d="${r.d}" fill="${r.fill}"/>`).join('');
const routePaths = (model.routes ?? []).map((rt) => {
  const s = rt.group === 'trails' ? { c: '#708090', d: '3 3', w: 0.8 }
    : rt.group === 'searoutes' ? { c: '#87cefa', d: '4 4', w: 1 }
    : { c: '#8b5a2b', d: '', w: 1.2 };
  return `<path d="${rt.d}" fill="none" stroke="${s.c}" stroke-width="${s.w}"${s.d ? ` stroke-dasharray="${s.d}"` : ''} stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
}).join('');
const burgMarks = (model.burgs ?? []).map((b) => (b.capital
  ? `<circle cx="${b.x}" cy="${b.y}" r="3.5" fill="#fff" stroke="#7a1228" stroke-width="0.8" vector-effect="non-scaling-stroke"/><circle cx="${b.x}" cy="${b.y}" r="1.6" fill="#e11d48"/>`
  : `<circle cx="${b.x}" cy="${b.y}" r="2" fill="#fff" stroke="#374151" stroke-width="0.8" vector-effect="non-scaling-stroke"/>`)).join('');
const borderPath = model.stateBorders
  ? `<path d="${model.stateBorders}" fill="none" stroke="#2d1b38" stroke-opacity="0.7" stroke-width="1" stroke-dasharray="3 2" vector-effect="non-scaling-stroke"/>` : '';
console.log('river ribbons:', (model.rivers ?? []).length, '| routes:', (model.routes ?? []).length, '| burgs:', (model.burgs ?? []).length, '| state borders:', model.stateBorders ? 'yes' : 'no');
const coast = model.coastline
  ? `<path d="${model.coastline}" fill="none" stroke="#9fcdef" stroke-opacity="0.4" stroke-width="${5 / k}"/>`
    + `<path d="${model.coastline}" fill="none" stroke="#1a3d66" stroke-width="${1.2 / k}"/>`
  : '';
const placedLabels = declutterLabels(model.labels ?? [], { k, x: 0, y: 0 });
const labelText = placedLabels.map((l) => {
  const fam = l.kind === 'state' ? 'Georgia, serif' : 'sans-serif';
  const fw = l.kind === 'town' ? 400 : 700;
  const fill = l.kind === 'state' ? '#2d1b38' : '#111827';
  return `<text x="${l.sx.toFixed(1)}" y="${l.sy.toFixed(1)}" text-anchor="middle" font-family="${fam}" font-size="${l.fontSize}" font-weight="${fw}" fill="${fill}" stroke="#fff" stroke-width="${l.kind === 'state' ? 3 : 2}" paint-order="stroke">${l.text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
}).join('');
console.log('labels placed:', placedLabels.length, '/', (model.labels ?? []).length);
// Demo "you are here" marker at the first capital (T7) — proves the marker renders.
const demo = (model.burgs ?? []).find((b) => b.capital) ?? (model.burgs ?? [])[0];
const markerSvg = demo
  ? `<g transform="translate(${(demo.x * k).toFixed(1)},${(demo.y * k).toFixed(1)})"><circle r="9" fill="none" stroke="#f5c542" stroke-width="2"/><circle r="3.5" fill="#f5c542" stroke="#5a3e00" stroke-width="1"/></g>`
  : '';
const defs = '<defs><filter id="atlas-soften" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="1"/></filter></defs>';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`
  + defs
  + `<rect width="${W}" height="${H}" fill="#1f4a73"/>`
  + `<g transform="scale(${k})"><rect width="${model.width}" height="${model.height}" fill="#1f4a73"/>${oceanPaths}<g filter="url(#atlas-soften)">${paths}</g>${riverPaths}${borderPath}${routePaths}${coast}${burgMarks}</g>${labelText}${markerSvg}</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(`<!doctype html><body style="margin:0">${svg}</body>`);
const outDir = path.join(__dirname, '../../.agent/azgaar-ref');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'ours-atlas-svg-761.png');
await page.screenshot({ path: out });
console.log('saved', out);
await browser.close();
