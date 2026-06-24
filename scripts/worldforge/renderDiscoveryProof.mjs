/**
 * Visual proof for SP4 (hidden places, iter #1): scatter off-map hidden places in
 * a region and reveal the ones within the player's proximity radius. Discovered =
 * solid icon + label; still-hidden = faint dot.
 *
 * Usage: npx tsx scripts/worldforge/renderDiscoveryProof.mjs
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { generateHiddenPlaces, revealNearby, discoveredCount } from '../../src/systems/worldforge/discovery/hiddenPlaces.ts';
import { rootSeedPath } from '../../src/systems/worldforge/seedPath.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const W = 640, H = 640;
const cx = 320, cy = 330, R = 280;
const region = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 3) * i - Math.PI / 2;
  return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
});

let places = generateHiddenPlaces(region, rootSeedPath(761), { count: 14, discoveryRadius: 70 });
const player = [cx + 40, cy + 20];
const res = revealNearby(places, player);
places = res.places;
console.log('places', places.length, '| discovered', discoveredCount(places), '| newly', res.revealed.length);

const ICON = { ruin: '#b08d57', cave: '#6b6b78', shrine: '#c9a0d0', camp: '#c47b4a', grove: '#5fa05f', wreck: '#7a8a9a' };
const dots = places.map((p) => {
  if (!p.discovered) return `<circle cx="${p.position[0]}" cy="${p.position[1]}" r="3" fill="#ffffff" opacity="0.18"/>`;
  return `<g>`
    + `<rect x="${(p.position[0] - 8).toFixed(1)}" y="${(p.position[1] - 8).toFixed(1)}" width="16" height="16" rx="3" fill="${ICON[p.kind]}" stroke="#1c150a" stroke-width="1.5"/>`
    + `<text x="${p.position[0]}" y="${(p.position[1] - 12).toFixed(1)}" text-anchor="middle" font-family="Georgia,serif" font-size="12" fill="#fff" stroke="#000" stroke-width="2.5" paint-order="stroke">${p.name}</text>`
    + `</g>`;
}).join('');
const boundary = 'M' + region.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') + 'Z';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`
  + `<rect width="${W}" height="${H}" fill="#22303f"/>`
  + `<path d="${boundary}" fill="#2f4a3a" stroke="#16202b" stroke-width="3"/>`
  + `<circle cx="${player[0]}" cy="${player[1]}" r="70" fill="#ffd98e" opacity="0.10" stroke="#ffd98e" stroke-dasharray="5 4"/>`
  + dots
  + `<circle cx="${player[0]}" cy="${player[1]}" r="6" fill="#ffd98e" stroke="#7a5a10" stroke-width="2"/>`
  + `<text x="${player[0]}" y="${player[1] + 22}" text-anchor="middle" font-family="Georgia,serif" font-size="12" fill="#ffd98e">player</text>`
  + `</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(`<!doctype html><body style="margin:0">${svg}</body>`);
const outDir = path.join(__dirname, '../../.agent/azgaar-ref');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'ours-discovery-proof.png');
await page.screenshot({ path: out });
console.log('saved', out);
await browser.close();
