/**
 * Proof for the BODY-1 → renderer wiring (2026-06-20).
 *
 * The occupant renderer (interiorParts.buildInteriorParts) now sizes and colors
 * each villager from their parametric BodyPlan (body/generateBody) via the
 * bridge projection groundChunkLoader.bodyPlanToOccupantBody. This script
 * regenerates that exact projection for a synthetic mixed population and prints
 * the per-person render dimensions + a spread summary, so we can eyeball that a
 * crowd reads as a POPULATION (varied heights/builds/palettes), not clones.
 *
 * Run: npx tsx .agent/body-wiring/body-spread-proof.mts
 */
import { generateBody } from '../../src/systems/worldforge/body/generateBody';
import type { Occupant } from '../../src/systems/worldforge/roster/types';
import { rootSeedPath, childSeedPath } from '../../src/systems/worldforge/seedPath';

const FT = 0.3048;

// Mirror of bridge groundChunkLoader.bodyPlanToOccupantBody.
function project(plan: ReturnType<typeof generateBody>) {
  const p = plan.proportions;
  return {
    heightM: p.height * FT,
    shoulderWidthM: p.shoulderWidth * FT,
    depthM: (p.torsoGirth / Math.PI) * FT,
    headSizeM: p.headSize * FT,
    skin: plan.skinToneHex,
    clothing: plan.clothingPrimaryHex,
  };
}

const ageBands = ['child', 'adult', 'elder'] as const;
const occupations = ['resident', 'shopkeeper', 'artisan'] as const;
const townSeed = rootSeedPath(42);

const N = 18;
const rows: Array<ReturnType<typeof project> & { id: number; age: string; occ: string }> = [];
for (let id = 1; id <= N; id++) {
  const occupant: Occupant = {
    id,
    name: `occ-${id}`,
    ageBand: ageBands[id % 3],
    homePlotId: id,
    occupation: occupations[id % 3],
  };
  // Same per-occupant seed path the bridge uses.
  const plan = generateBody(occupant, childSeedPath(townSeed, `occ:${id}`));
  rows.push({ id, age: occupant.ageBand, occ: occupant.occupation, ...project(plan) });
}

const pad = (s: string | number, n: number) => String(s).padEnd(n);
console.log(
  pad('id', 3) + pad('age', 7) + pad('occ', 11) +
  pad('heightM', 9) + pad('shoulW', 8) + pad('depthM', 8) + pad('headM', 7) + pad('skin', 9) + 'clothing',
);
for (const r of rows) {
  console.log(
    pad(r.id, 3) + pad(r.age, 7) + pad(r.occ, 11) +
    pad(r.heightM.toFixed(3), 9) + pad(r.shoulderWidthM.toFixed(3), 8) +
    pad(r.depthM.toFixed(3), 8) + pad(r.headSizeM.toFixed(3), 7) +
    pad(r.skin, 9) + r.clothing,
  );
}

const heights = rows.map((r) => r.heightM);
const distinctHeights = new Set(heights.map((h) => h.toFixed(3))).size;
const distinctSkin = new Set(rows.map((r) => r.skin)).size;
const distinctClothing = new Set(rows.map((r) => r.clothing)).size;
const childMax = Math.max(...rows.filter((r) => r.age === 'child').map((r) => r.heightM));
const adultMin = Math.min(...rows.filter((r) => r.age === 'adult').map((r) => r.heightM));

console.log('\n--- spread summary ---');
console.log(`heightM range: ${Math.min(...heights).toFixed(3)} .. ${Math.max(...heights).toFixed(3)}`);
console.log(`distinct heights: ${distinctHeights}/${N}  | distinct skin tones: ${distinctSkin}  | distinct clothing: ${distinctClothing}`);
console.log(`tallest child ${childMax.toFixed(3)}m  <  shortest adult ${adultMin.toFixed(3)}m  => ${childMax < adultMin ? 'OK (age monotonic)' : 'FAIL'}`);
console.log(distinctHeights >= N - 1 ? 'VERDICT: population, not clones ✓' : 'VERDICT: too uniform ✗');
