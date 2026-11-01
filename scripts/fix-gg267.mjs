import { readFileSync, writeFileSync } from 'fs';

const path = 'docs/projects/GLOBAL_GAPS.md';
const lines = readFileSync(path, 'utf8').split('\n');
const idx = lines.findIndex(l => l.trim().startsWith('| GG-267 |'));
if (idx < 0) {
  console.error('GG-267 row not found');
  process.exit(1);
}
const cells = lines[idx].split('|');
// present columns (13): 0 empty,1 id,2 status,3 classification,4 surface,5 gap,6 evidence,
//   7 whyItMatters,8 owner,9 routingLink,10 nextAction,11 nextProof,12 notes (~empty)
cells[7] = ' Farm land is a strong visual sign of place; the same grain fields in a glacier town and a desert town break the read of the world. ';
cells[8] = ' worldforge ';
cells[9] = ' d2de3cb5 | docs/projects/GLOBAL_GAPS.md ';
cells[10] = ' Give the town plan the FMG biome id (climateForBiomeId in architectureStyle.ts:201 already reads it) and grade farm parcels by a climate-based rule on that biome. Do not port the retired RealmSmith desert ban: oasis towns do farm and tundra is the more likely wrong case. ';
cells[11] = ' A seeded town test shows no grain farm parcels for a tundra or hot-desert burg, farm parcels for a temperate burg, and some farm parcels for an oasis (hot desert near water) burg. Seeded-RNG first-draw bias and non-stacking travel exhaustion follow-ups added: 2026-09-09 (GG-140, GG-141). ';
if (cells.length > 12) cells[12] = ' ';
lines[idx] = cells.join('|');
writeFileSync(path, lines.join('\n'), 'utf8');
console.log('rewrote GG-267 cells 7..11');
console.log(lines[idx].slice(-260));
