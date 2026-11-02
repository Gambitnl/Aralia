/**
 * Version 1 of the existing prop art. Rendering and placement read the same
 * geometry and local transforms, so a nominal catalog cell never masquerades
 * as the footprint of a cart shaft, fence rail, or pile of logs.
 * Legacy scene-origin size variation remains explicit until a new campaign
 * source can select a stable successor; this extraction changes no property.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/11/2026, 03:10:38
 * Dependents: components/World3D/GroundProps.tsx, systems/worldforge/props/prospectivePropPlacement.ts
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three';
import type { PropInstance } from '../propSchema';
import { propSourceId } from '../propSchema';
import type { SceneOrigin } from '@/systems/world3d/sceneOrigin';
import type { RenderedGroundPropShape, PropShapePoint } from '@/components/World3D/groundPropGeometry';
import { createRockGeometry } from './rockGeometry';
import { createLogGeometry } from './logGeometry';
import { createBushGeometry } from './bushGeometry';
import { hash3 } from './proceduralNoise';
import { createWoodpileLogGeometryV1, WOODPILE_LOG_POSITIONS_V1 } from './woodpileGeometry';
import { buildTownPropForms } from './townPropForms';

// ── Palette: flat wood/stone tones consistent with the styled-town look ─────
const WOOD = '#8a6a48';
const WOOD_DARK = '#6e5238';
const WOOD_PALE = '#a58a63';
const STONE = '#8d8d86';
const ROCK = '#7d7a72';
/**
 * Moss-bearing stone. `mossy-rock-cluster` used to draw in the plain ROCK tone,
 * so the only thing separating it from a bare boulder was its name. This is a
 * green-GRAY, not a green: measured against the vegetation scatter's bush tone
 * (sRGB 76,125,58 — saturation 0.37) this sits at saturation 0.10, so moss
 * reads as a stain on stone rather than as foliage sitting on the ground.
 * Rejected: tinting the whole boulder bucket, which would have turned every
 * bare rock in every biome green to fix one def.
 */
const ROCK_MOSSY = '#747c66';
const LEAF = '#4f7a3a';
const HAY = '#c9a94e';
const SACK = '#b3a07d';
const CANVAS = '#d8cfb6';
const CANVAS_RED = '#b0563f';

export const PROP_PALETTE_V1 = {WOOD,WOOD_DARK,WOOD_PALE,STONE,ROCK,ROCK_MOSSY,LEAF,HAY,SACK,CANVAS,CANVAS_RED};
export interface PropVisualPoseV1 { rot: number; tilt: number; tiltAxis: [number, number] }
export function composeTiltedRotationV1(
  out: THREE.Quaternion,
  up: THREE.Vector3,
  scratchAxis: THREE.Vector3,
  scratchTilt: THREE.Quaternion,
  it: PropVisualPoseV1,
): THREE.Quaternion {
  out.setFromAxisAngle(up, it.rot);
  if (it.tilt !== 0) {
    scratchAxis.set(it.tiltAxis[0], 0, it.tiltAxis[1]);
    if (scratchAxis.lengthSq() > 1e-12) {
      scratchAxis.normalize();
      // NEGATIVE angle. `fitToSurface` returns the axis `[-nz, nx]/|n_xz|`, and
      // a right-hand turn about that axis by +tiltRad lifts the DOWNHILL edge —
      // it leans the prop off the slope instead of onto it. See the sign note in
      // bridge/propPlacementGate.ts; the placement gate scores the same lean.
      scratchTilt.setFromAxisAngle(scratchAxis, -it.tilt);
      out.premultiply(scratchTilt);
    }
  }
  return out;
}

const FORM_SIZE_MUL: Record<string, number> = {
  // GG-586: a fountain basin is about 3 m across its radius against a well's
  // 0.8 m; a market cross stands about 2.5 times a grave cross.
  fountain: 3.4, 'market-cross': 2.5,
  // Stone family (bucket base = the plain scatter boulder).
  cairn: 0.75, 'stone-planter': 0.8, 'stone-bench': 0.9,
  'mossy-rock-cluster': 1.05, 'rubble-pile': 1.1, 'standing-stone': 1.15,
  'broken-wall': 1.4, 'boundary-wall': 1.5, 'dry-stone-wall': 1.5,
  'gravel-bar': 1.6, 'toppled-column': 1.6, 'rock-outcrop': 2.4,
  // Vegetation family (bucket base = the plain scatter bush).
  'mushroom-ring': 0.5, 'fern-clump': 0.65, 'gorse-shrub': 0.85, topiary: 0.9,
  'reed-bed': 1.1, 'bramble-patch': 1.2, deadfall: 1.2,
  'ivy-mass': 1.4, 'hedge-run': 1.6,
};

/**
 * Defs whose instances draw a long-tailed size spread instead of one nominal
 * size. Loose stone is the case that needs it: a real scatter is mostly rubble
 * you step over with the occasional one you walk around, and the placement
 * engine's own `variation.scale` is a flat 0.85–1.15 for every prop in the
 * game, which cannot produce that shape. Restricted to the two scatter stone
 * defs — a menhir or a dry-stone wall is a built thing and has a size.
 */
const SIZE_TAIL_DEFS = new Set(['boulder', 'mossy-rock-cluster']);

/**
 * Cubed uniform in [0.6, 1.7]: median 0.74, ~10% above 1.15, ~1% above 1.6.
 * Against the boulder base that puts the typical scatter rock at roughly knee
 * height with rare ones at chest height, and nothing within reach of the 17 m
 * trees measured in the same window.
 */
function sizeTail(x: number, z: number, variant: number): number {
  const u = hash3(0x51ce, Math.round(x * 29), Math.round(z * 29), variant);
  return 0.6 + 1.1 * u * u * u;
}

/**
 * RENDER FORM mapping for expanded-catalog defIds. The placement engine emits
 * many defs beyond the 14 bespoke forms below; rather than model each, we route
 * every emitted def to a DELIBERATE reused render bucket picked per prop family
 * (stone→boulder, log/beam→fallen-log, vegetation→bush, box→crate, barrel-like→
 * barrel, sack/heap→sack). This is NOT a silent fallback: the mapping is chosen
 * per def so a gravestone reads as a low rock, a reed bed as a bush clump, a
 * tree stump as a short log — plausible at walking scale in the flat-shaded look.
 *
 * A def with NO entry keeps its own id (a bespoke form below, e.g. 'crate').
 * The placement engine's RENDERABLE_DEF_IDS must stay a subset of
 * {bespoke ids} ∪ {keys here}. Any def outside both is never emitted.
 */
const RENDER_VARIANT: Record<string, string> = {
  // Stone / masonry → boulder (rock geometry). NOTE: gravestone/tomb/stone-
  // cross, statue/milestone/wayside-shrine, brazier, fingerpost and grindstone
  // GRADUATED to owned seeded meshes (townPropForms) — they keep their own id.
  'boundary-wall': 'boulder',
  'stone-planter': 'boulder', 'stone-bench': 'boulder',
  cairn: 'boulder', 'standing-stone': 'boulder', 'rock-outcrop': 'boulder',
  'mossy-rock-cluster': 'boulder', 'broken-wall': 'boulder', 'rubble-pile': 'boulder',
  'toppled-column': 'boulder',
  'dry-stone-wall': 'boulder', 'gravel-bar': 'boulder',
  // Log / trunk / beam → fallen-log (log geometry).
  'tree-stump': 'fallen-log', 'driftwood-pile': 'fallen-log', 'log-bridge': 'fallen-log',
  'roof-beam-charred': 'fallen-log', 'dead-snag': 'fallen-log', 'jetty-post': 'fallen-log',
  plough: 'fallen-log',
  // Vegetation → bush.
  'bramble-patch': 'bush', deadfall: 'bush', 'fern-clump': 'bush',
  'gorse-shrub': 'bush', 'hedge-run': 'bush', 'reed-bed': 'bush',
  topiary: 'bush', 'ivy-mass': 'bush', 'mushroom-ring': 'bush',
  // Box-like clutter → crate.
  'produce-basket': 'crate', 'notice-board': 'crate', 'net-drying-rack': 'crate',
  'tool-rack': 'crate', 'metal-bar-stack': 'crate', 'chicken-coop': 'crate',
  'trestle-table': 'crate', 'wood-bench': 'crate', beehive: 'crate',
  // Barrel-like → barrel.
  'fish-barrel': 'barrel', 'slop-bucket': 'barrel', 'overturned-barrel': 'barrel',
  'coiled-rope': 'barrel', 'mooring-post': 'barrel', 'awning-pole': 'barrel',
  // Loose heaps → sack.
  'coal-heap': 'sack', 'rubbish-heap': 'sack',
  // The market square (GG-586): a fountain is a wide well basin, a market
  // cross a tall stone cross, a pillory a post with a cross board.
  fountain: 'well', 'market-cross': 'stone-cross', pillory: 'fingerpost',
};

/** Resolve an emitted defId to the id of the render form that draws it. */
export function renderFormForV1(defId: string): string {
  return RENDER_VARIANT[defId] ?? defId;
}

export type ComposedGeometryKey = 'box' | 'stall-post' | 'woodpile-log' | 'well-ring' | 'cart-wheel';

export interface ComposedPrimitive {
  geometry: ComposedGeometryKey;
  color: string;
  position: readonly [number, number, number];
  rotation?: readonly [number, number, number];
  scale?: readonly [number, number, number];
  roughness?: number;
  flat?: boolean;
  castShadow?: boolean;
}

export function composedPrimitivesV1(defId: string, p: { variant: number }): ComposedPrimitive[] {
  if (defId === 'market-stall') {
    const posts = ([[-1.1, -0.7], [1.1, -0.7], [-1.1, 0.7], [1.1, 0.7]] as const)
      .map(([x, z]): ComposedPrimitive => ({
        geometry: 'stall-post', color: WOOD_DARK, position: [x, 1.05, z], castShadow: true,
      }));
    return [
      ...posts,
      { geometry: 'box', color: WOOD, position: [0, 0.85, 0], scale: [2.4, 0.1, 1.5], castShadow: true },
      {
        geometry: 'box',
        color: p.variant % 2 === 0 ? CANVAS : CANVAS_RED,
        position: [0, 2.25, 0.15],
        rotation: [-0.35, 0, 0],
        scale: [2.6, 0.05, 1.9],
        castShadow: true,
      },
    ];
  }

  if (defId === 'woodpile') {
    return WOODPILE_LOG_POSITIONS_V1
      .map(([x, y], index) => ({
        geometry: 'woodpile-log',
        color: index % 2 ? WOOD_DARK : WOOD,
        position: [x, y, 0],
        rotation: [Math.PI / 2, 0, 0],
        castShadow: true,
      }));
  }

  if (defId === 'fence-run') {
    return [
      ...[-3, -1, 1, 3].map((x): ComposedPrimitive => ({
        geometry: 'box', color: WOOD_DARK, position: [x, 0.55, 0], scale: [0.12, 1.1, 0.12], castShadow: true,
      })),
      { geometry: 'box', color: WOOD, position: [0, 0.85, 0], scale: [6.4, 0.08, 0.08], castShadow: true },
      { geometry: 'box', color: WOOD, position: [0, 0.45, 0], scale: [6.4, 0.08, 0.08], castShadow: true },
    ];
  }

  if (defId === 'well') {
    return [
      { geometry: 'well-ring', color: STONE, position: [0, 0.45, 0], castShadow: true },
      { geometry: 'box', color: WOOD_DARK, position: [-0.75, 1.3, 0], scale: [0.1, 1.8, 0.1], castShadow: true },
      { geometry: 'box', color: WOOD_DARK, position: [0.75, 1.3, 0], scale: [0.1, 1.8, 0.1], castShadow: true },
      {
        geometry: 'box', color: WOOD, position: [0, 2.35, 0], rotation: [0, 0, Math.PI / 4],
        scale: [1.5, 1.5, 1.6], castShadow: true,
      },
    ];
  }

  if (defId === 'water-trough') {
    return [
      { geometry: 'box', color: WOOD_DARK, position: [0, 0.06, 0], scale: [1.8, 0.12, 0.7], castShadow: true },
      { geometry: 'box', color: WOOD, position: [0, 0.3, -0.31], scale: [1.8, 0.5, 0.08] },
      { geometry: 'box', color: WOOD, position: [0, 0.3, 0.31], scale: [1.8, 0.5, 0.08] },
      { geometry: 'box', color: WOOD, position: [-0.86, 0.3, 0], scale: [0.08, 0.5, 0.7] },
      { geometry: 'box', color: WOOD, position: [0.86, 0.3, 0], scale: [0.08, 0.5, 0.7] },
      { geometry: 'box', color: '#4a7d96', position: [0, 0.4, 0], scale: [1.62, 0.02, 0.52], roughness: 0.3, flat: false },
    ];
  }

  if (defId === 'cart') {
    return [
      { geometry: 'box', color: WOOD, position: [0, 0.62, 0], scale: [2, 0.12, 1.1], castShadow: true },
      { geometry: 'box', color: WOOD_PALE, position: [0, 0.85, -0.5], scale: [2, 0.35, 0.06] },
      { geometry: 'box', color: WOOD_PALE, position: [0, 0.85, 0.5], scale: [2, 0.35, 0.06] },
      { geometry: 'cart-wheel', color: WOOD_DARK, position: [0, 0.45, -0.62], rotation: [Math.PI / 2, 0, 0], castShadow: true },
      { geometry: 'cart-wheel', color: WOOD_DARK, position: [0, 0.45, 0.62], rotation: [Math.PI / 2, 0, 0], castShadow: true },
      { geometry: 'box', color: WOOD_DARK, position: [1.35, 0.75, 0], rotation: [0, 0, -0.25], scale: [0.9, 0.07, 0.07] },
    ];
  }

  if (defId === 'crate-stack') {
    return [
      { geometry: 'box', color: WOOD, position: [-0.35, 0.35, 0], scale: [0.7, 0.7, 0.7], castShadow: true },
      { geometry: 'box', color: WOOD_PALE, position: [0.4, 0.3, 0.1], rotation: [0, 0.3, 0], scale: [0.6, 0.6, 0.6], castShadow: true },
      { geometry: 'box', color: WOOD_DARK, position: [-0.1, 0.98, 0.05], rotation: [0, -0.2, 0], scale: [0.62, 0.62, 0.62], castShadow: true },
    ];
  }

  return [];
}

export const COMPOSED_PROP_IDS = [
  'market-stall', 'woodpile', 'fence-run', 'well', 'water-trough', 'cart', 'crate-stack',
] as const;


export function createPropGeometriesV1() { return {
      box: new THREE.BoxGeometry(1, 1, 1),
      barrel: new THREE.CylinderGeometry(0.42, 0.36, 1, 10),
      sack: new THREE.SphereGeometry(0.5, 8, 6),
      hay: new THREE.SphereGeometry(0.5, 8, 6),
      // Owned seeded generators (world-props slice 1): cached variants,
      // instanced per variant. Seeds are frozen constants → deterministic.
      bushes: [0, 1, 2].map((i) => createBushGeometry(i + 21)),
      boulders: [0, 1, 2, 3].map((i) => createRockGeometry(i + 7)),
      logs: [0, 1, 2].map((i) => createLogGeometry(i + 42)),
      // Reused shapes for the batched multi-part forms. Boxes carry their
      // dimensions in instance matrices; cylinders retain the exact authored
      // taper and segment counts from the former per-prop JSX.
      composed: {
        box: new THREE.BoxGeometry(1, 1, 1),
        'stall-post': new THREE.CylinderGeometry(0.05, 0.06, 2.1, 6),
        'woodpile-log': createWoodpileLogGeometryV1(),
        'well-ring': new THREE.CylinderGeometry(0.8, 0.85, 0.9, 10),
        'cart-wheel': new THREE.CylinderGeometry(0.45, 0.45, 0.08, 10),
      } satisfies Record<ComposedGeometryKey, THREE.BufferGeometry>,
      // Owned TOWN prop generators (vertex-colored composed meshes):
      // gravestone/tomb/cross, lantern/sign/fingerpost, statue/milestone/
      // shrine, anvil/grindstone, scarecrow, brazier.
      town: buildTownPropForms(),
    }; }

export type PropGeometriesV1 = ReturnType<typeof createPropGeometriesV1>;

/** Explicitly preserve the legacy camera-origin scale hash. A future source
 * revision must choose world coordinates rather than changing old art here. */
export function propRenderScaleV1(p: PropInstance, origin: SceneOrigin): number {
  if (p.renderRecipe !== undefined && p.renderRecipe !== 'props-v1') throw Error('Unsupported prop render recipe');
  if (p.renderScale !== undefined) {
    if (!(p.renderScale > 0) || !Number.isFinite(p.renderScale)) throw Error('Invalid frozen prop scale');
    return p.renderScale;
  }
  let scale = p.variation.scale * (FORM_SIZE_MUL[p.defId] ?? 1);
  if (SIZE_TAIL_DEFS.has(p.defId)) scale *= sizeTail(p.xM-origin.x, p.zM-origin.z, p.variation.variant);
  return scale;
}

export const SIMPLE_PROP_RENDER_V1: Record<string, {base: [number, number, number]; yLift: number}> = {
  crate: {base:[.75,.75,.75],yLift:.5}, barrel: {base:[1,.95,1],yLift:.5},
  sack: {base:[.9,.55,.9],yLift:.45}, haystack: {base:[2.4,1.9,2.4],yLift:.42},
  bush: {base:[1,.85,1],yLift:.45}, boulder: {base:[1,.95,1],yLift:.3},
  'fallen-log': {base:[1,1,1],yLift:0}, town: {base:[1,1,1],yLift:0},
};

/** The simple renderer adds this lift in WORLD Y after applying lean/yaw.
 * Exposing that same term lets footprint queries cache rigid geometry without
 * accidentally rotating the lift into horizontal occupied space. */
export function propWorldVerticalLiftV1(p: PropInstance, origin: SceneOrigin, g: PropGeometriesV1): number {
  const form=renderFormForV1(p.defId);
  if(composedPrimitivesV1(form,p.variation).length)return 0;
  const profile=SIMPLE_PROP_RENDER_V1[g.town[form]?'town':form];
  return profile?profile.base[1]*propRenderScaleV1(p,origin)*profile.yLift*Math.cos(p.surface?.tiltRad??0):0;
}

export function disposePropGeometriesV1(g: PropGeometriesV1): void {
  const geometries = [g.box,g.barrel,g.sack,g.hay,...g.bushes,...g.boulders,...g.logs,
    ...Object.values(g.composed),...Object.values(g.town).flatMap(f=>f.geometries)];
  for (const geometry of new Set(geometries)) geometry.dispose();
}

/** Actual scaled triangles in the same pose-local frame used by mounted-shape
 * capture. No mesh, world, prop, or terrain is moved. Callers doing a batch
 * should own one geometry library and dispose it after their measurements. */
export function propShapeV1(p: PropInstance, origin: SceneOrigin, supplied?: PropGeometriesV1): RenderedGroundPropShape | undefined {
  const g = supplied ?? createPropGeometriesV1();
  try {
    const form = renderFormForV1(p.defId), scale = propRenderScaleV1(p,origin);
    if (!(scale>0) || !Number.isFinite(scale)) throw Error('Invalid prop recipe scale');
    const triangles: RenderedGroundPropShape['triangles'] = [];
    const vertex = new THREE.Vector3();
    const append = (geometry: THREE.BufferGeometry, matrix: THREE.Matrix4) => {
      const positions=geometry.getAttribute('position'), index=geometry.getIndex(), count=index?.count??positions.count;
      if (count%3) throw Error('Invalid recipe triangles');
      for(let j=0;j<count;j+=3){
        const points=[j,j+1,j+2].map(k=>{vertex.fromBufferAttribute(positions,index?index.getX(k):k).applyMatrix4(matrix);
          return [vertex.x,vertex.y,vertex.z] as PropShapePoint;});
        triangles.push([points[0],points[1],points[2]]);
      }
    };
    const pieces = composedPrimitivesV1(form,p.variation);
    if(pieces.length){
      const parent=new THREE.Matrix4().makeScale(scale,scale,scale);
      for(const piece of pieces){
        const local=new THREE.Matrix4().compose(new THREE.Vector3(...piece.position),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(...(piece.rotation??[0,0,0]))),
          new THREE.Vector3(...(piece.scale??[1,1,1])));
        append(g.composed[piece.geometry],new THREE.Matrix4().multiplyMatrices(parent,local));
      }
    } else {
      const variant=p.variation.variant;
      const town=g.town[form];
      const geometry = town?.geometries[variant%town.geometries.length] ?? (
        form==='crate'?g.box:form==='barrel'?g.barrel:form==='sack'?g.sack:form==='haystack'?g.hay:
        form==='bush'?g.bushes[variant%3]:form==='boulder'?g.boulders[variant%4]:form==='fallen-log'?g.logs[variant%3]:undefined);
      if(!geometry)return undefined;
      const profile=SIMPLE_PROP_RENDER_V1[town?'town':form];
      const tilt=p.surface?.tiltRad??0, q=composeTiltedRotationV1(new THREE.Quaternion(),new THREE.Vector3(0,1,0),
        new THREE.Vector3(),new THREE.Quaternion(),{rot:p.rotationRad,tilt,tiltAxis:p.surface?.tiltAxis??[1,0]});
      // The renderer's lift is world-vertical after rotation. Undo the pose
      // rotation to express that exact lift in the captured local frame.
      const lift=new THREE.Vector3(0,propWorldVerticalLiftV1(p,origin,g),0).applyQuaternion(q.clone().invert());
      append(geometry,new THREE.Matrix4().compose(lift,new THREE.Quaternion(),new THREE.Vector3(...profile.base).multiplyScalar(scale)));
    }
    return {sourceId:propSourceId(p),defId:p.defId,variation:{...p.variation},triangles};
  } finally {if(!supplied)disposePropGeometriesV1(g);}
}
