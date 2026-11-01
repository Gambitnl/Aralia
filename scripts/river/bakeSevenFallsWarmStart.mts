/**
 * Bake the seven-falls river's warm start (2026-10-24).
 *
 * Runs the live river headless on the seven-falls course (riverCourse=references:
 * headwaters on, airborne spill on, reconstructed course) from full basins
 * (LiveRiver.fillBasinsToSpill) to steady flow, then writes the water of the wet
 * cells to public/data/river/seven-falls-warm.bin (gitignored). The live page
 * loads it at start (LiveRiver.startWarm) so every fall runs from the first
 * frame. A terrain change makes the file stale: the page then says so and
 * starts from full basins. Bake again after any change to the course.
 *
 * Usage (bundle with plain esbuild; tsx's keepNames slows construction ~3x):
 *   npx esbuild scripts/river/bakeSevenFallsWarmStart.mts --bundle --platform=node --format=esm --alias:@=./src --outfile=G:/Temp/bake.mjs
 *   node --max-old-space-size=16000 G:/Temp/bake.mjs [flowSeconds=1500]
 * It needs about 6 GB of RAM and, at about 1x real time, about as many wall
 * seconds as flow seconds.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { LiveRiver, bedChecksum, encodeRiverWarmState } from '../../src/systems/world3d/river/riverLive';

const flowS = Number(process.argv[2] ?? 1500);
const out = 'public/data/river/seven-falls-warm.bin';
const live = new LiveRiver(20260928, true, true, true);
live.warmNoise();
live.startDry();
const added = live.fillBasinsToSpill();
const solver = (live as unknown as { solver: { h: Float64Array; hu: Float64Array; hv: Float64Array; bed: Float64Array; n?: number; inVolume: number; outVolume: number } }).solver;
let report = 0;
while (live.simTime < flowS) {
  live.advance(500);
  if (live.simTime - report >= 100) {
    report = live.simTime;
    const r = live.frame().spill?.receipt;
    console.log(`flow ${live.simTime.toFixed(0)} s: launched ${r?.releasedVolume.toFixed(1) ?? 0} m3, out ${solver.outVolume.toFixed(1)} m3`);
  }
}
const bytes = encodeRiverWarmState({ simTime: live.simTime, cells: 0, n: solver.h.length, bedSum: bedChecksum(solver.bed),
  added, inVolume: solver.inVolume, outVolume: solver.outVolume }, solver.h, solver.hu, solver.hv);
mkdirSync('public/data/river', { recursive: true });
writeFileSync(out, bytes);
console.log(`wrote ${out}: ${(bytes.length / 1e6).toFixed(1)} MB at ${live.simTime.toFixed(0)} s of flow`);
