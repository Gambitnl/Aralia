/** L2 LOCAL layer render proof — the submap replacement's first picture. */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateFmgAtlas } from '../../src/systems/worldforge/fmg/generateAtlas';
import { generateRegion } from '../../src/systems/worldforge/region/generateRegion';
import { generateLocal } from '../../src/systems/worldforge/local/generateLocal';
import { rootSeedPath } from '../../src/systems/worldforge/seedPath';
import { boundsCenter } from '../../src/systems/worldforge/units';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const atlas = generateFmgAtlas('world-42', { width: 960, height: 540, cellsDesired: 10000, template: 'continents' });
const region = generateRegion(atlas, 110, rootSeedPath(42), { feetPerPixel: 1000 });
const local = generateLocal(region, boundsCenter(region.bounds), region.seedPath, { biomeId: 6 });
const { terrain, features, bounds } = local;
console.log('local:', { cells: terrain.widthCells, features: features.length });

const PALETTE: Record<string, [number, number, number]> = {
  grass: [96, 142, 66], dirt: [122, 96, 60], rock: [128, 124, 118], sand: [206, 184, 130],
  wetland: [90, 110, 70], water: [56, 110, 165], paved: [150, 142, 128], floor: [170, 160, 140],
};
const W = terrain.widthCells, H = terrain.heightCells;
const buf = Buffer.alloc(W * H * 4);
let eMin = Infinity, eMax = -Infinity;
for (const v of terrain.elevationFt) { if (v < eMin) eMin = v; if (v > eMax) eMax = v; }
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const mat = terrain.materials[terrain.materialIndex[i]];
    let [r, g, b] = PALETTE[mat] ?? [255, 0, 255];
    // hillshade from elevation gradient + local-range brightness
    const e = terrain.elevationFt[i];
    const ex = terrain.elevationFt[y * W + Math.min(x + 1, W - 1)];
    const ey = terrain.elevationFt[Math.min(y + 1, H - 1) * W + x];
    const shade = 1 + ((ex - e) + (ey - e)) * 0.04;
    const lift = 0.85 + 0.3 * ((e - eMin) / Math.max(1, eMax - eMin));
    const s = Math.max(0.55, Math.min(1.45, shade * lift));
    const o = i * 4;
    buf[o] = Math.min(255, r * s); buf[o + 1] = Math.min(255, g * s); buf[o + 2] = Math.min(255, b * s); buf[o + 3] = 255;
  }
}
// features as dots
const dot = (fx: number, fy: number, rad: number, c: [number, number, number]) => {
  const cx = Math.floor((fx - bounds.x) / 5), cy = Math.floor((fy - bounds.y) / 5);
  for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
    if (dx * dx + dy * dy > rad * rad) continue;
    const x = cx + dx, y = cy + dy;
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const o = (y * W + x) * 4;
    buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2];
  }
};
for (const f of features) {
  if (f.kind === 'tree') dot(f.x, f.y, 2, [26, 70, 32]);
  else if (f.kind === 'bush') dot(f.x, f.y, 1, [70, 110, 50]);
  else if (f.kind === 'boulder') dot(f.x, f.y, 1, [88, 86, 84]);
}
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(`<canvas id="c" width="${W}" height="${H}"></canvas>`);
await page.evaluate(({ b64, w, h }) => {
  const bytes = Uint8ClampedArray.from(atob(b64), ch => ch.charCodeAt(0));
  const ctx = (document.getElementById('c') as HTMLCanvasElement).getContext('2d')!;
  ctx.putImageData(new ImageData(bytes, w, h), 0, 0);
}, { b64: buf.toString('base64'), w: W, h: H });
await page.locator('#c').screenshot({ path: path.join(__dirname, 'local-first-light.png') });
console.log('wrote local-first-light.png');
await browser.close();
