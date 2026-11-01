/**
 * The live river's upstream landscape: a waterfall, its plunge pool, and a
 * main rapids channel. The original reach becomes the smaller offshoot.
 * Both channels use the same solver grid and water renderer. The original
 * comparison reach remains available with headwaters=0 or live=0.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 17/10/2026, 05:21:18
 * Dependents: components/DesignPreview/steps/water/RiverScene.tsx, components/DesignPreview/steps/water/riverSectionLabels.ts, components/World3D/water/riverFlowBlockersView.ts, components/World3D/water/riverReachScene.ts, components/World3D/water/riverSistersCliffSurface.ts, components/World3D/water/riverWaterfallCliff.ts, components/World3D/water/riverWaterfallView.ts, components/World3D/water/waterfallTerrainComparisonView.ts, systems/world3d/river/riverFlowField.ts, systems/world3d/river/riverLive.ts, systems/world3d/river/riverRapidsReconstruction.ts, systems/world3d/river/riverReach.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { CourseSample, RiverGridSpec } from './riverReach';
import { rapidsWaterfallCut, RAPIDS_WATERFALL_SEQUENCE } from './waterfallTerrainProfiles';
import { reconstructedRapidsAt, projectReconstructedRapids, reconstructionCourseLength, reconstructionDomain, reconstructionSection,reconstructionLandscapeLowering,reconstructionCrossHeight,RECONSTRUCTION_FALLS } from './riverRapidsReconstruction';
import {getSistersCliffSurface} from '../../../components/World3D/water/riverSistersCliffSurface';

// The reconstructed first gorge and its longer receiving rapids shift the
// downstream reference footprints. Cover their banks and an outlet margin;
// extending terrain past the old grid would silently leave it without water.
// Further full-size falls still require a larger course/domain design.
export const HEADWATERS_GRID: RiverGridSpec = { x0: -190, z0: -110, dx: 0.5, nx: 1088, nz: 500 };
// A separate address range keeps the existing river's bed keys and edit nodes
// in their original places. This is a channel address, not an arc length.
export const MAIN_CHANNEL_S = 1000;
// Airborne water is drawn separately: the shallow-water solver starts at its
// impact, where vertical momentum dissipates into the plunge pool. Asking a
// terrain-following solver to descend a cliff produced needles and recoveries.
export const WATERFALL = { crestS: -171, crestBed: 77.3, poolLevel: 18, heightM: 60, gravity: 9.81 } as const;
// This small spill is part of the same flowing channel, not a second source.
// The deep receiving basin stands on its own plateau; its shallow outlet lip
// drops six meters before the runoff slopes into the preserved original bed.
export const POOL_SPILL = { crestS: -113, toeS: -111, crestBed: 17.5, toeBed: 11.5,
  poolBed: 14.6, bankTop: 19.2, crestHalfW: 7.5 } as const;
export function waterfallHydraulics(shape: { widthScale: number; depthScale: number; dischargeM3S: number }, poolLevel: number = WATERFALL.poolLevel): { width: number; depth: number; speed: number; flightS: number; impactS: number; top: number } {
  const width = 10 * shape.widthScale;
  // Width and depth describe the selected launch opening. Keep their area
  // fixed while Q changes: more discharge leaves this opening faster.
  const depth = 0.7 * shape.depthScale;
  const speed = shape.dischargeM3S / (width * depth);
  const top = WATERFALL.crestBed + depth;
  const flightS = Math.sqrt(2 * Math.max(1, top - poolLevel) / WATERFALL.gravity);
  return { width, depth, speed, flightS, impactS: WATERFALL.crestS + speed * flightS, top };
}
/** One tangent launch shared by the rendered fall and its receiving cells.
 * Course addresses are not distance, so never locate the impact by adding s. */
export function waterfallLanding(crest: CourseSample, hydraulics: ReturnType<typeof waterfallHydraulics>): { x: number; z: number; forward: number } {
  const forward = hydraulics.speed * hydraulics.flightS;
  return { x: crest.x + crest.tx * forward, z: crest.z + crest.tz * forward, forward };
}
/** Continuous granite upland outside the fixed launch opening. The source
 * is carved into a mountain, rather than perched on a narrow elevated trough.
 * Its floor remains fixed so the selected width/depth still give Q / area. */
/** Uneven rock shoulders project beyond the recessed spill opening. Terrain
 * and exposed face use this same plan-view boundary, avoiding a straight
 * retaining wall across the whole gorge. The wet opening keeps its launch. */
export function waterfallRockBoundary(lateral: number, width: number): number {
  const edge = Math.max(0, Math.abs(lateral) - width * 0.5);
  // Unequal projecting shoulders and smaller chipped corners meet a recessed
  // launch notch. These are shared by the heightfield and exposed rock face.
  const masses = 8 + 4.6 * Math.sin(lateral * 0.083 + 0.8) + 3.1 * Math.sin(lateral * 0.173 - 0.4);
  const chips = 1.7 * Math.abs(Math.sin(lateral * 0.39 + 0.3));
  return smooth(edge / 3.8) * (masses + chips);
}
export function waterfallSourceRockHeight(lateral: number, width: number, forward = 0): number {
  const edge = Math.max(0, Math.abs(lateral) - width * 0.5);
  // The wet bed stays exactly at crestBed inside the chosen opening. Outside
  // it, water-worn shoulders climb at unequal rates into the fractured upland;
  // this preserves Q / opening area while avoiding a straight retaining bank.
  const side = lateral < 0 ? 1.1 : 0.78;
  const worn = 1.1 + 0.35 * Math.sin(forward * 0.17 + lateral * 0.31);
  const shoulder = (2.0 + side) * smooth(edge / (3.7 * worn));
  const upland = (26 + 6 * Math.sin(lateral * 0.074 + forward * 0.025)) * (1 - Math.exp(-Math.max(0, edge - 4) / 43));
  const slabs = 1.2 * Math.sin(lateral * 0.21 + forward * 0.085) + 0.6 * Math.abs(Math.sin(lateral * 0.49 - forward * 0.12));
  const bedrock = smooth(edge / 5) * slabs;
  return WATERFALL.crestBed + shoulder + upland + bedrock;
}
export function waterfallFlight(age: number, speed: number): { forward: number; drop: number } {
  return { forward: speed * age, drop: 0.5 * WATERFALL.gravity * age * age };
}
export function airborneHeadwater(s: number): boolean { return enabled && s < -171; }
let enabled = false;
let fullCourse=false;
export function setRiverHeadwaters(on: boolean, reconstructed=false): void { enabled = on;fullCourse=on&&reconstructed; }
export function riverHeadwatersEnabled(): boolean { return enabled; }
export function riverReconstructionEnabled():boolean{return enabled&&fullCourse;}
/** Both browser and worker infer the same installed configuration from its
 * complete grid. No downstream water is synthesized by selecting the course. */
export function headwatersGrid(reconstructed=false):RiverGridSpec{return reconstructed?reconstructionDomain().grid:HEADWATERS_GRID;}
export function configureHeadwatersGrid(grid:RiverGridSpec):void {
  const full=headwatersGrid(true);
  setRiverHeadwaters(grid.x0===HEADWATERS_GRID.x0&&(grid.nz===HEADWATERS_GRID.nz||grid.nx===full.nx),grid.nx===full.nx&&grid.nz===full.nz);
}

const smooth = (v: number): number => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };

/** The main current curves north while the existing offshoot bends south. */
export function mainRapidsAt(s: number): CourseSample {
  const u = s - MAIN_CHANNEL_S;
  if(fullCourse)return reconstructedRapidsAt(Math.max(0,Math.min(reconstructionCourseLength(),u)));
  const dz = -0.16 - 0.0008 * u;
  const len = Math.hypot(1, dz);
  return { x: u - 25, z: 29 - 0.16 * u - 0.0004 * u * u, s,
    tx: 1 / len, tz: dz / len, curv: 0.0008 / (len ** 3), stretch: len };
}

/** Nearest point on the main channel, including its smoothly bending banks. */
export function projectMainRapids(x: number, z: number): { s: number; n: number; d: number; k: number } {
  if(fullCourse)return projectReconstructedRapids(x,z);
  let u = Math.max(0, Math.min(420, x + 25));
  for (let i = 0; i < 5; i += 1) {
    const zz = 29 - 0.16 * u - 0.0004 * u * u;
    const dz = -0.16 - 0.0008 * u;
    u = Math.max(0, Math.min(420, u - ((u - 25 - x) + (zz - z) * dz) / (1 + dz * dz - 0.0008 * (zz - z))));
  }
  const p = mainRapidsAt(MAIN_CHANNEL_S + u);
  const dx = x - p.x; const dz = z - p.z;
  return { s: p.s, n: dx * p.tz - dz * p.tx, d: Math.hypot(dx, dz), k: 0 };
}

/** Upstream bed sections, ending exactly on the original reach at s=-60. */
const KEYS = [
  [-230, 77.3, 5, 80, 78], [-175, 77.3, 5, 80, 78],
  [-171, 14.6, 11, 19.2, 18], [-160, 14.6, 19, 19.2, 18],
  [-122, 14.6, 18, 19.2, 18], [-115, 17.5, 8, 19.2, 18],
  [POOL_SPILL.crestS, POOL_SPILL.crestBed, POOL_SPILL.crestHalfW, 19.2, 18],
  [POOL_SPILL.toeS, POOL_SPILL.toeBed, 8, 13.1, 12.1],
  [-103, 10.9, 8.5, 12.5, 11.5],
  [-60, 6.1, 11.1666666667, 7.1, 6.65],
] as const;

export function headwaterKey(s: number): { s: number; thalweg: number; halfW: number; bankTop: number; shapeP: number; manning: number; level: number } | null {
  if (!enabled) return null;
  if (s >= MAIN_CHANNEL_S) {
    const u = s - MAIN_CHANNEL_S;
    const section=fullCourse?reconstructionSection(u):null;
    const thalweg = 5.2 - 0.035 * u-(section?.lowering??0);
    return { s, thalweg, halfW: section?.halfWidth??8.5, bankTop: thalweg + 1.5, shapeP: 3, manning: 0.045, level: thalweg + 0.55 };
  }
  if (s >= -60) return null;
  // The cliff is a vertical boundary, not a four-meter ramp whose last dry
  // cells lie below the pool. Such cells filled from the pool but were outside
  // the active band, producing persistent false ceiling-warning pockets.
  if (s < WATERFALL.crestS && s >= -175) return { s, thalweg: WATERFALL.crestBed, halfW: 5, bankTop: 80, shapeP: 3, manning: 0.045, level: 78 };
  let a: readonly number[] = KEYS[0]; let b: readonly number[] = KEYS[0];
  for (let i = 1; i < KEYS.length; i += 1) { b = KEYS[i]; if (s <= b[0]) break; a = b; }
  const t = Math.max(0, Math.min(1, (s - a[0]) / Math.max(1e-9, b[0] - a[0])));
  const lerp = (k: number): number => a[k] + (b[k] - a[k]) * t;
  return { s, thalweg: lerp(1), halfW: lerp(2), bankTop: lerp(3), shapeP: 3, manning: 0.045, level: lerp(4) };
}

/** Unequal oblique pockets leave connected gravel bypasses between local
 * fast tongues. Cuts only lower the unmodified channel; the original course
 * ownership and continuous low-water thread remain separate constraints. */
export const MAIN_RAPIDS_FEATURES = Object.freeze([
  { lip: 43, center: -2.2, halfWidth: 2.4, obliquity: 0.10, drop: 0.20, ramp: 2.0, pocket: 4.6, recover: 13, clearHalfWidth: 0.9 },
  { lip: 67, center: 1.8, halfWidth: 2.8, obliquity: -0.08, drop: 0.28, ramp: 1.8, pocket: 6.0, recover: 15, clearHalfWidth: 1.15 },
  { lip: 92, center: -1.1, halfWidth: 2.1, obliquity: 0.13, drop: 0.18, ramp: 2.6, pocket: 4.0, recover: 12, clearHalfWidth: 0.8 },
]);
export const MAIN_RAPIDS_DROPS = Object.freeze(MAIN_RAPIDS_FEATURES.map(feature => feature.lip));

/** Only the mouth and early pocket need an open rock passage. Rocks elsewhere
 * keep their native positions, including those in the central channel. */
export function mainRapidsChuteAt(u: number): { center: number; halfWidth: number } | null {
  // Keep the reference bed readable and traversable through the existing
  // native boulder exclusion path. Placement and collision agree; original
  // offshoot rocks stay outside this main-channel-only selection.
  if(RAPIDS_WATERFALL_SEQUENCE.some(f=>u>=f.start-1&&u<=f.start+f.length+2))return {center:0,halfWidth:5.8};
  const feature = MAIN_RAPIDS_FEATURES.find(f => u >= f.lip - 2 && u <= f.lip + f.ramp + f.pocket + 3);
  return feature ? { center: feature.center + feature.obliquity * (u - feature.lip), halfWidth: feature.clearHalfWidth } : null;
}

// Two short, unequal bedrock ribs connect native rock caps to the flanks.
// They leave the old channel and the oblique low-water mouth untouched.
const MAIN_RIBS = [
  [[88, 7.5, 0], [90, 6, .35], [91.4, 4.4, .45], [92.8, 2.8, .55], [94.3, 1.5, 0]],
  [[98, -7.5, 0], [100, -6, .35], [101.4, -4.4, .45], [102.8, -2.8, .55], [104.3, -1.5, 0]],
] as const;

/** Shared raised bed support; original-course ownership reaches exact zero. */
export function mainRibUplift(u: number, n: number, originalDistance: number, mainDistance: number): number {
  if (!enabled || u < 86 || u > 106 || Math.abs(n) >= 8.5 || originalDistance <= mainDistance) return 0;
  const chute = mainRapidsChuteAt(u);
  const clear = chute ? smooth((Math.abs(n - chute.center) - chute.halfWidth - .5) / .5) : 1;
  let lift = 0;
  for (const rib of MAIN_RIBS) for (let i = 1; i < rib.length; i++) {
    const a = rib[i - 1], b = rib[i], du = b[0] - a[0], dn = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((u - a[0]) * du + (n - a[1]) * dn) / (du * du + dn * dn)));
    const distance = Math.hypot(u - a[0] - du * t, n - a[1] - dn * t);
    // Broad buried shoulders support the caps; overlapping segments do not add height.
    const across = 1 - smooth((distance - .75) / .55);
    lift = Math.max(lift, (a[2] + (b[2] - a[2]) * t) * across);
  }
  return lift * smooth((originalDistance - mainDistance) / 2) * clear;
}

export function mainRapidsProfile(u: number, n = 0): { cut: number; pocket: number; threadSigma: number; thread: number } {
  let pocket = 0, cut = 0;
  for (const feature of MAIN_RAPIDS_FEATURES) {
    const distance = u - feature.lip;
    const along = smooth(distance / feature.ramp)
      * (1 - smooth((distance - feature.ramp - feature.pocket) / feature.recover));
    const center = feature.center + feature.obliquity * distance;
    const across = 1 - smooth((Math.abs(n - center) - feature.halfWidth * 0.4) / (feature.halfWidth * 0.6));
    const local = along * across;
    pocket = Math.max(pocket, local);
    cut = Math.max(cut, feature.drop * local);
  }
  const thread = smooth((u - 35) / 6) * (1 - smooth((u - 113) / 6));
  return { cut, pocket, threadSigma: 1.65 + 1.1 * pocket, thread };
}

/** Share the carve's valley ownership with its visible rock classification.
 * The fork keeps its existing partition; farther downhill the quiet channel
 * retains its bank while the reconstructed valley owns the wider landscape. */
export function mainReconstructionOwnership(u:number,mainDistance:number,originalDistance:number,originalHalfWidth:number):number {
  const join=smooth((u-90)/30);
  const nearest=smooth((originalDistance-mainDistance)/2);
  const protectedChannel=smooth((originalDistance-originalHalfWidth-4)/12);
  return nearest+(protectedChannel-nearest)*join;
}

/** Carve the additional channel without raising or moving the original bed. */
export function carveMainRapids(x: number, z: number, ground: number, rough: number, originalDistance = Infinity, includeRibs = true,originalHalfWidth=12): number {
  if (!enabled || x < -25) return ground;
  const pr = projectMainRapids(x, z);
  const key = headwaterKey(pr.s)!;
  if(fullCourse){
    // Lower the connected valley and its actual shoulders together. A deep
    // narrow subtraction under the old upland would create artificial fins.
    // Protect the actual quiet channel plus4m of bank, rather than assigning
    // half the valley to it forever. The old nearest-branch partition clipped
    // the broad Sisters face90m off-axis although the quiet river was41m away.
    // Keep the existing fork opening before blending to this corridor guard.
    const u=pr.s-MAIN_CHANNEL_S;
    const ownership=mainReconstructionOwnership(u,pr.d,originalDistance,originalHalfWidth);
    const section=reconstructionSection(u,pr.n);
    // The finite Sisters triangles own their actual ground projection. The
    // shallow-water solver receives their upper surface; no decorative rock
    // wall is placed in front of a different collision bed. Quiet land keeps
    // the same ownership guard. Airborne/underside liquid is still unsupported.
    // Follow the actual stage record when the connecting rapids change.
    // A fixed station range would draw the moved cliff above a different bed.
    const sisters=RECONSTRUCTION_FALLS[1];
    if(u>sisters.startM-45&&u<sisters.endM+55&&Math.abs(pr.n)<sisters.halfWidthM+20){
      const native=getSistersCliffSurface().heightAt(x,z);
      if(native!==undefined)return ground+(native-ground)*ownership;
    }
    const land=smooth((Math.abs(pr.n)-section.halfWidth-8)/100);
    const shoulder=(section.lowering-reconstructionLandscapeLowering(u))*land;
    const target=key.thalweg+shoulder+reconstructionCrossHeight(u,pr.n,section.halfWidth)+section.relief+rough*.08;
    return ground+(Math.min(ground,target)-ground)*ownership;
  }
  const t = pr.d / key.halfW;
  // The gravel banks rise into a separating ridge; farther away the existing
  // valley is untouched. Taking the lower bed leaves an open junction.
  const bed = key.thalweg + 1.5 * Math.pow(Math.min(1, t), 3) + rough * 0.08;
  const bank = key.bankTop + Math.max(0, pr.d - key.halfW) * 0.6;
  const h = t < 1 ? bed : bank;
  const w = 1 - smooth((pr.d - key.halfW - 5) / 9);
  const carved = ground + (Math.min(ground, h) - ground) * w;
  const profile = mainRapidsProfile(pr.s - MAIN_CHANNEL_S, pr.n);
  const cross = 1 - smooth((t - 0.55) / 0.2);
  // Cut the receiving pockets after the old minimum operation. Raising a
  // lip before that operation would be silently erased. The center thread
  // is deeper between lips and broadens inside pockets; banks stay intact.
  // Where the original river is closer, its existing bed is preserved.
  const ownership = smooth((originalDistance - pr.d) / 2);
  const threadCut = 0.16 * profile.thread * Math.exp(-0.5 * (pr.n / profile.threadSigma) ** 2);
  // The sequence is excavated into this very bed, read by both the native
  // solver and ground mesh. It adds no neighboring blocks or water emitters.
  // Ownership reaches zero where the preserved original offshoot is closer.
  return carved - ((profile.cut + threadCut) * cross + rapidsWaterfallCut(pr.s - MAIN_CHANNEL_S, pr.n)) * w * ownership
    + (includeRibs ? mainRibUplift(pr.s - MAIN_CHANNEL_S, pr.n, originalDistance, pr.d) : 0);
}
