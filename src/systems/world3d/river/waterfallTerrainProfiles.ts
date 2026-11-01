/** Shared Norway-reference names, native miniature bed cuts and diagnostic contact tops for the comparison
 * panel. These are normalized 60 m terrain analogues, not surveyed replicas.
 * Every top and sloped bank returned here is both visible rock and a solver contact surface.
 * The coarse model still has one pressure-bearing Film; other contacts use its
 * existing supported packets and flight. Stream spans specify actual admission
 * gaps, without claiming independent resolved films or continuous liquid. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 16/10/2026, 20:37:15
 * Dependents: components/DesignPreview/steps/water/WaterfallComparisonPanel.tsx, components/World3D/water/riverReachScene.ts, components/World3D/water/waterfallComparisonLandscape.ts, components/World3D/water/waterfallTerrainComparisonView.ts, systems/world3d/river/riverHeadwaters.ts, systems/world3d/river/waterfallTerrainComparisons.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { FALL_TYPES } from '../waterfall/waterfallTypes';
import type { ContactSourceSpan, ContactSurface, ContactVec3 } from './waterfallContactFlow';

export type NorwayTerrainComparisonId = 'storfossen' | 'seven-sisters' | 'steinsdalsfossen' | 'latefossen' | 'tvindefossen' | 'stigfossen' | 'langfossen';
export type TerrainComparisonId = NorwayTerrainComparisonId | 'stepped' | 'sloped' | 'broken';
export interface TerrainComparisonCase {
  readonly id: TerrainComparisonId; readonly label: string; readonly description: string; readonly clipAt: string;
  readonly streamSpans?: readonly ContactSourceSpan[];
  buildSurfaces(): ContactSurface[];
  /** Optional plain shoulders shared by the drawn land and parcel contact.
   * They do not add a pressure-bearing Film or close vertical cliff faces. */
  buildBanks?(): ContactSurface[];
}
// X/Z rectangles preserve the existing sweep and support charts. Cross slopes
// in the twin/gully steer supported water toward the shared lower contact tops.
function top(id: string, x0: number, x1: number, z0: number, z1: number, height: number, sx: number, sz = 0): ContactSurface {
  const point = (x: number, z: number): ContactVec3 => [x, height + sx * (x - x0) + sz * (z - (z0 + z1) / 2), z];
  const norm = Math.hypot(sx, 1, sz);
  return { id, vertices: [point(x0,z0),point(x1,z0),point(x1,z1),point(x0,z1)], normal: [-sx/norm,1/norm,-sz/norm] };
}
const lanes = (centers: number[], width: number): readonly ContactSourceSpan[] => Object.freeze(centers.map(z => Object.freeze({ z0: z-width/2, z1: z+width/2 })));
const sisters = lanes([-12,-8,-4,0,4,8,12],10/7);
const twins = lanes([-5.5,5.5],5);
const fan = lanes([-4,0,4],10/3);
const gully = lanes([-3.5,3.5],5);
const profiles: Record<NorwayTerrainComparisonId, { description: string; streamSpans?: readonly ContactSourceSpan[]; buildSurfaces(): ContactSurface[] }> = {
  storfossen: { description: 'Normalized gorge analogue: five descending shelves, with the same 60 m drop and supply.',
    buildSurfaces: () => Array.from({length:5},(_,i)=>top(`storfossen-shelf-${i+1}`,-.5+i*6.6,5.3+i*6.6,-7-i*.7,7+i*.7,67-i*11,-.5)) },
  'seven-sisters': { description: 'Normalized ribbon analogue: seven separated inlets and seven steep rock lanes; coarse contact mechanics.', streamSpans: sisters,
    buildSurfaces: () => sisters.map((s,i)=>top(`seven-sisters-lane-${i+1}`,-.5,4.5,s.z0-.2,s.z1+.2,76,-10.5)) },
  steinsdalsfossen: { description: 'Normalized free-plunge analogue: water clears recessed rock; underside collision and surveyed overhang geometry are unresolved.',
    buildSurfaces: () => [top('steinsdalsfossen-overhang',-8,-1,-8,8,77,-.3),top('steinsdalsfossen-recess',-7,-2,-8,8,49,-1.2),top('steinsdalsfossen-back-shelf',-6,-1,-9,9,25,-.5)] },
  latefossen: { description: 'Normalized twin analogue: two separated chutes with cross slopes toward a shared lower shelf.', streamSpans: twins,
    buildSurfaces: () => [top('latefossen-left',-.5,12,-8.2,-2.8,72,-2.5,-.8),top('latefossen-right',-.5,12,2.8,8.2,72,-2.5,.8),top('latefossen-confluence',12.5,26,-8,8,35,-.7)] },
  tvindefossen: { description: 'Normalized terraced analogue: three inlets feed nine progressively wider contact tops; no prescribed cosmetic braids.', streamSpans: fan,
    buildSurfaces: () => Array.from({length:9},(_,i)=>top(`tvindefossen-terrace-${i+1}`,-.5+i*5,4+i*5,-6-i*1.1,6+i*1.1,73-i*6,-.35)) },
  stigfossen: { description: 'Normalized gully analogue: two inlets descend through three stages, then a lower apron.', streamSpans: gully,
    buildSurfaces: () => [...Array.from({length:3},(_,stage)=>gully.map((s,side)=>top(`stigfossen-stage-${stage+1}-${side?'right':'left'}`,-.5+stage*8.75,7.5+stage*8.75,s.z0-.3,s.z1+.3,72-stage*20,-1.5,side?.3:-.3))).flat(),top('stigfossen-gully-base',25.1,30.5,-8,8,18.7,-.03)] },
  langfossen: { description: 'Normalized broad-slope analogue: one wide continuous inclined contact top and a lower apron.',
    buildSurfaces: () => [top('langfossen-broad-slope',-.5,48,-13,13,75,-1.1),top('langfossen-apron',48.5,57,-15,15,21.5,-.3)] },
};

/** Keep the exact existing three-meter shoulders, including gaps between
 * neighboring lanes. One geometry definition now prevents water contact from
 * silently disagreeing with the plain rock drawn around each wet shelf.
 * The original shelf stays first in the contact list and keeps its Film. */
function banksFor(surfaces: ContactSurface[]): ContactSurface[] {
  const banks: ContactSurface[] = [];
  for (const surface of surfaces) for (const side of [-1, 1]) {
    const [a,b,c] = surface.vertices, inner = side < 0 ? a[2] : c[2], outer = inner + side * 3;
    const z0 = Math.min(inner,outer), z1 = Math.max(inner,outer);
    if (surfaces.some(other => other !== surface && other.vertices[0][0] < b[0] && other.vertices[1][0] > a[0]
      && Math.max(z0,other.vertices[0][2]) < Math.min(z1,other.vertices[2][2]))) continue;
    const n = surface.normal, sx = -n[0]/n[1];
    const innerHeight = a[1] - n[2] * (inner-a[2])/n[1];
    banks.push(top(`${surface.id}-bank-${side < 0 ? 'left' : 'right'}`,a[0],b[0],z0,z1,innerHeight+1.5,sx,side));
  }
  return banks;
}
export const TERRAIN_COMPARISON_CASES: readonly TerrainComparisonCase[] = Object.freeze(FALL_TYPES.map(reference => {
  const id=reference.id as NorwayTerrainComparisonId, profile=profiles[id];
  if (!profile) throw Error(`missing-normalized-terrain-profile:${id}`);
  return Object.freeze({ id, label: reference.name, clipAt: reference.clipAt, ...profile,
    buildBanks: () => banksFor(profile.buildSurfaces()) });
}));

/** The first reference is being rebuilt at its provisional full descent;
 * the other six remain historical miniatures awaiting their own reconstruction.
 * These records only carve shared rock, never emit water. The original 60 m
 * diagnostic profiles stay unchanged for their frozen physics experiments. */
export const RAPIDS_WATERFALL_SEQUENCE = Object.freeze(TERRAIN_COMPARISON_CASES.map((profile, index) => ({
  id: profile.id, label: profile.label, start: index === 0 ? 115 : 199 + (index - 1) * 24,
  length: index === 0 ? 52 : 20, drop: index === 0 ? 36 : 2.4,
  form: ['irregular offset gorge', 'seven rock channels', 'recessed plunge', 'twin chutes', 'broad terraces', 'split gully', 'long rock slope'][index],
  reconstruction: index === 0 ? 'candidate: provisional dimensions' : 'unfinished: historical miniature',
})));

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => { const t=clamp01(v); return t*t*(3-2*t); };
/** Excavated depth below the old main bed, in meters. Each fall retains its
 * downstream lowering, so its outlet never climbs back to an artificial tray.
 * Cross-channel ribs divide the ribbons/twins; they taper into the same banks.
 * A height field can represent a recessed notch, but cannot certify an
 * overhang underside. The old free-plunge reference is kept as that limitation. */
export function rapidsWaterfallCut(u: number, n: number): number {
  let cut=0;
  for (let i=0;i<RAPIDS_WATERFALL_SEQUENCE.length;i++) {
    const feature=RAPIDS_WATERFALL_SEQUENCE[i], t=(u-feature.start)/feature.length;
    if(t<=0)break;
    if(t>=1){cut+=feature.drop;continue;}
    let descent:number;
    if(i===0) {
      // The reference has unequal falls around offset rock noses, not a
      // regular staircase. Different parts of each lip project downstream.
      // Fractions are authored from the inspected frame, not survey data.
      const lips=[.08,.24,.45,.66,.86], widths=[.045,.07,.055,.085,.09];
      const drops=[4,7,10,9,6];
      let depth=0;
      for(let ledge=0;ledge<lips.length;ledge++) {
        // Limit lip skew at the banks: an unbounded diagonal across a tall
        // step created narrow ten-meter fins in the first wet render.
        const skew=(ledge%2 ? -.008 : .008)*Math.tanh(n/2);
        const lip=Math.max(0,Math.min(1-widths[ledge],lips[ledge]+skew));
        depth+=drops[ledge]*ease((t-lip)/widths[ledge]);
      }
      // A short, broad rock nose sits on one shelf. The former narrow ridge
      // crossed two drops and became pointed fins in the wet render. Flat
      // bedding and beveled edges now divide flow around a squat real block;
      // the solver and drawn ground use this very same surface.
      const along=clamp01(Math.min((t-.30)/.035,(.425-t)/.035));
      const across=clamp01(Math.min((n+4.2)/.8,(.5-n)/.8));
      const nose=2.8*along*across;
      descent=(depth-nose)/feature.drop;
    }
    else if(i===1) descent=ease((t-.26)/.10);
    else if(i===2) descent=ease((t-.34)/.06);
    else if(i===3) descent=.72*ease((t-.16)/.48)+.28*ease((t-.72)/.08);
    else if(i===4) descent=Math.floor(t*9)/9+ease((t*9)%1/.2)/9;
    else if(i===5) descent=Math.floor(t*3)/3+ease((t*3)%1/.12)/3;
    else descent=ease(t);
    // Small dry divides are carved less deeply than their adjacent channels.
    // Their source is upstream river water spreading around actual bed relief.
    const phase=i===1?(1-Math.cos(n*2*Math.PI/1.6))*.5:i===3||i===5?Math.cos(n*Math.PI/3.2):0;
    // The source-only rendered run measured roughly 0.30 m above the old
    // ribbon bed; its 0.22 m divides disappeared under one broad sheet.
    // These real rock divides now stand above that water and let the existing
    // solver route flow between them. No stream receives an independent inlet.
    const ridgeHeight=i===1?.75:i===3?1:.8;
    const divide=(i===1||i===3||i===5)? ridgeHeight*Math.max(0,phase)*Math.sin(Math.PI*t)**2 : 0;
    cut+=feature.drop*clamp01(descent)-divide;
    break;
  }
  // Full descent needs a gorge cut into the surrounding hillside, rather
  // than the miniature's three-meter shoulder becoming a vertical slot.
  // The host carve's original-course ownership still protects the quiet arm.
  return cut*(1-ease((Math.abs(n)-6)/18));
}
