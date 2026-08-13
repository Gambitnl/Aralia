/**
 * @file GroundProps.tsx
 * @description Render rung for the WAVE-1 beautification props. `GroundWorld`
 * already carries a deterministic `props: PropInstance[]` layer (market stalls,
 * dock crates, smithy woodpiles, farm fences, wilderness boulders/logs/bushes —
 * see src/systems/worldforge/props/); NOTHING rendered them until this file.
 *
 * Approach (matches the flat-shaded primitive look of the streamed world):
 *  - High-count S-class props (crate, barrel, sack, bush, boulder, haystack)
 *    render as ONE InstancedMesh per form — wilderness scatter can be large.
 *  - Low-count composed props (stall, woodpile, fence run, well, trough,
 *    fallen log, cart, crate-stack) render as per-instance <group>s of a few
 *    primitives each.
 *  - Position: xM/zM are tile-local ground meters (the GroundFeature
 *    convention); Y is sampled from the ground heightfield exactly the way
 *    PlayerAvatar plants itself (groundSurfaceYM), then shifted into scene
 *    space by subtracting the scene origin — the same rebase every other
 *    ground-mode piece uses.
 *  - All variation (rotation, scale jitter, variant index) is seed-derived on
 *    the instance, so the render is deterministic per world+window.
 */
import React, { useMemo, useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import type { SceneOrigin } from '@/systems/world3d/sceneOrigin';
import { groundSurfaceY, type GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { PropInstance } from '@/systems/worldforge/props/propSchema';
import { createRockGeometry } from '@/systems/worldforge/props/generators/rockGeometry';
import { createLogGeometry } from '@/systems/worldforge/props/generators/logGeometry';
import { createBushGeometry } from '@/systems/worldforge/props/generators/bushGeometry';
import { hash3 } from '@/systems/worldforge/props/generators/proceduralNoise';
import { buildTownPropForms } from '@/systems/worldforge/props/generators/townPropForms';

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

/** A prop instance resolved to scene space (meters, origin-rebased). */
interface Placed {
  x: number;
  y: number;
  z: number;
  rot: number;
  scale: number;
  variant: number;
  /**
   * SURFACE FIT, baked by the prop engine's stage-2 gate (propSchema
   * `PropInstance.surface`). `tilt` is the lean toward the ground normal in
   * radians and `tiltAxis` is the horizontal axis it turns about. Zero for a
   * prop placed before a probe existed, which draws exactly as it used to.
   */
  tilt: number;
  tiltAxis: [number, number];
}

/**
 * Reusable scratch quaternions for the tilt composition. A tilted prop turns
 * about a HORIZONTAL axis, applied OUTSIDE the yaw (premultiply) so the lean
 * stays in world space and the prop leans downhill instead of sideways. Same
 * order as vegetationInstanceMatrices.ts, which is the working example.
 */
function composeTiltedRotation(
  out: THREE.Quaternion,
  up: THREE.Vector3,
  scratchAxis: THREE.Vector3,
  scratchTilt: THREE.Quaternion,
  it: Placed,
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

/**
 * Per-def size multiplier for the reused rock and bush render forms.
 *
 * Every def routed through RENDER_VARIANT used to draw at its bucket's single
 * `base`, so the catalog's own S/M/L `sizeClass` reached the screen nowhere: a
 * measured forest window drew all 867 stone instances between 1.57 m and 2.33 m
 * wide (median 2.02 m) whether they were a cairn, a scatter boulder or a crag,
 * and all 7,057 bush-form instances between 1.57 m and 2.32 m wide whether they
 * were a fern clump or a hedge run. One size for everything is what makes a
 * window read as a diorama — a 2 m "fern" beside an 8 m tree has no scale.
 *
 * Multipliers are finer-grained than the catalog's three size classes on
 * purpose (a menhir and a rubble pile are both M but are not the same object),
 * and they are ordered to agree with it: every S def sits below 1, every L def
 * above. A def absent here draws at its bucket's base.
 */
const FORM_SIZE_MUL: Record<string, number> = {
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
};

/** Resolve an emitted defId to the id of the render form that draws it. */
function renderFormFor(defId: string): string {
  return RENDER_VARIANT[defId] ?? defId;
}

function placeAll(
  props: PropInstance[],
  ground: GroundWorld,
  origin: SceneOrigin,
): Map<string, Placed[]> {
  const byDef = new Map<string, Placed[]>();
  for (const p of props) {
    // The surface fit is authoritative when present: the gate read the ground
    // at this exact point, sank the prop into the slope, and the placement loop
    // then seated it. `groundYM` is already METERS (propSchema), so no unit
    // conversion belongs here. Re-sampling the heightfield instead would undo
    // both corrections and put the prop back on the surface it floats over.
    const y = p.surface
      ? p.surface.groundYM - p.surface.sinkM
      : groundSurfaceY(ground, p.xM, p.zM);
    // Route the emitted def to its render form (expanded defs reuse a bespoke
    // form; see RENDER_VARIANT). Referee data is unaffected — that lives in the
    // catalog and is imprinted separately at combat extraction.
    const form = renderFormFor(p.defId);
    // Mossy stone is bucketed apart from bare stone because the two differ only
    // by instance tint, and an InstancedMesh carries one base color per mesh.
    const key = p.defId === 'mossy-rock-cluster' ? 'boulder-mossy' : form;
    let list = byDef.get(key);
    if (!list) byDef.set(key, (list = []));
    const x = p.xM - origin.x;
    const z = p.zM - origin.z;
    let scale = p.variation.scale * (FORM_SIZE_MUL[p.defId] ?? 1);
    if (SIZE_TAIL_DEFS.has(p.defId)) scale *= sizeTail(x, z, p.variation.variant);
    list.push({
      x,
      y,
      z,
      rot: p.rotationRad,
      scale,
      variant: p.variation.variant,
      tilt: p.surface?.tiltRad ?? 0,
      tiltAxis: p.surface?.tiltAxis ?? [1, 0],
    });
  }
  return byDef;
}

// ── Instanced simple forms ───────────────────────────────────────────────────

interface InstancedFormProps {
  items: Placed[];
  geometry: THREE.BufferGeometry;
  color: string;
  /** Base local scale (m) applied before per-instance jitter. */
  base: [number, number, number];
  /** Lift so the form's origin sits on the ground (fraction of base Y). */
  yLift: number;
  flat?: boolean;
  /**
   * Per-instance color jitter amplitude (0 = uniform color). Deterministic:
   * the jitter is hashed from the instance's own seed-derived placement, so
   * the same world renders the same tones forever.
   */
  colorJitter?: number;
  /** Geometry carries a baked `color` attribute (owned town-prop generators). */
  vertexColors?: boolean;
  /** Dense foliage uses ambient contact shading instead of a second depth pass. */
  castShadow?: boolean;
}

/** Deterministic per-instance tone: hash the placement into an HSL wobble. */
function jitterColor(baseColor: THREE.Color, it: Placed, amount: number, out: THREE.Color): THREE.Color {
  const k = hash3(0x70e5, Math.round(it.x * 37), Math.round(it.z * 37), it.variant);
  const k2 = hash3(0xc01e, Math.round(it.z * 53), Math.round(it.x * 53), it.variant);
  out.copy(baseColor);
  const hsl = { h: 0, s: 0, l: 0 };
  out.getHSL(hsl);
  out.setHSL(
    (hsl.h + (k - 0.5) * amount * 0.25 + 1) % 1,
    THREE.MathUtils.clamp(hsl.s + (k2 - 0.5) * amount * 0.6, 0, 1),
    THREE.MathUtils.clamp(hsl.l + (k - 0.5) * amount * 0.5, 0.05, 0.95),
  );
  return out;
}

const InstancedForm: React.FC<InstancedFormProps> = ({
  items,
  geometry,
  color,
  base,
  yLift,
  flat,
  colorJitter,
  vertexColors,
  castShadow = true,
}) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const tiltAxis = new THREE.Vector3();
    const tiltQuat = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const baseC = new THREE.Color(color);
    const c = new THREE.Color();
    items.forEach((it, i) => {
      composeTiltedRotation(q, up, tiltAxis, tiltQuat, it);
      s.set(base[0] * it.scale, base[1] * it.scale, base[2] * it.scale);
      // A leaning form raises its center by less than its upright height, so
      // the lift follows cos(tilt) — the same correction the vegetation
      // matrices apply. Without it a tilted rock lifts off its own slope.
      pos.set(it.x, it.y + base[1] * it.scale * yLift * Math.cos(it.tilt), it.z);
      m.compose(pos, q, s);
      mesh.setMatrixAt(i, m);
      if (colorJitter) mesh.setColorAt(i, jitterColor(baseC, it, colorJitter, c));
    });
    mesh.count = items.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [items, base, yLift, color, colorJitter]);
  if (items.length === 0) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, undefined, items.length]}
      frustumCulled={false}
      castShadow={castShadow}
    >
      <meshStandardMaterial
        color={colorJitter || vertexColors ? '#ffffff' : color}
        vertexColors={vertexColors ?? false}
        roughness={0.9}
        flatShading={flat ?? true}
      />
    </instancedMesh>
  );
};

// ── Composed (multi-primitive) forms — low-count town props ─────────────────

// ── Main component ───────────────────────────────────────────────────────────

// ============================================================================
// Batched composed props
// ============================================================================
// The original components above are the visual specification for each form.
// The live renderer below reproduces those same primitive transforms in shared
// InstancedMeshes, preventing a capital from allocating hundreds of duplicate
// geometries and materials for fence posts, wheels, planks, and crates.
// ============================================================================

type ComposedGeometryKey = 'box' | 'stall-post' | 'woodpile-log' | 'well-ring' | 'cart-wheel';

interface ComposedPrimitive {
  geometry: ComposedGeometryKey;
  color: string;
  position: readonly [number, number, number];
  rotation?: readonly [number, number, number];
  scale?: readonly [number, number, number];
  roughness?: number;
  flat?: boolean;
  castShadow?: boolean;
}

interface ComposedPrimitiveBatch {
  key: string;
  geometry: ComposedGeometryKey;
  color: string;
  roughness: number;
  flat: boolean;
  castShadow: boolean;
  matrices: THREE.Matrix4[];
}

/** Reproduce one authored prop's exact visible primitive pieces. */
function composedPrimitives(defId: string, p: Placed): ComposedPrimitive[] {
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
    return ([[-0.3, 0.15], [0, 0.15], [0.3, 0.15], [-0.15, 0.42], [0.15, 0.42], [0, 0.68]] as const)
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

const COMPOSED_PROP_IDS = [
  'market-stall', 'woodpile', 'fence-run', 'well', 'water-trough', 'cart', 'crate-stack',
] as const;

/** Combine the prop transform with each primitive's local transform. */
function buildComposedPrimitiveBatches(byDef: Map<string, Placed[]>): ComposedPrimitiveBatch[] {
  const batches = new Map<string, ComposedPrimitiveBatch>();
  const up = new THREE.Vector3(0, 1, 0);
  const tiltAxis = new THREE.Vector3();
  const tiltQuat = new THREE.Quaternion();
  const parentPosition = new THREE.Vector3();
  const parentRotation = new THREE.Quaternion();
  const parentScale = new THREE.Vector3();
  const localPosition = new THREE.Vector3();
  const localRotation = new THREE.Quaternion();
  const localScale = new THREE.Vector3();
  const parentMatrix = new THREE.Matrix4();
  const localMatrix = new THREE.Matrix4();

  COMPOSED_PROP_IDS.forEach((defId) => {
    (byDef.get(defId) ?? []).forEach((placed) => {
      parentPosition.set(placed.x, placed.y, placed.z);
      composeTiltedRotation(parentRotation, up, tiltAxis, tiltQuat, placed);
      parentScale.setScalar(placed.scale);
      parentMatrix.compose(parentPosition, parentRotation, parentScale);

      composedPrimitives(defId, placed).forEach((primitive) => {
        const roughness = primitive.roughness ?? 0.9;
        const flat = primitive.flat ?? true;
        const castShadow = primitive.castShadow ?? false;
        const key = `${primitive.geometry}|${primitive.color}|${roughness}|${flat ? 1 : 0}|${castShadow ? 1 : 0}`;
        let batch = batches.get(key);
        if (!batch) {
          batch = { key, geometry: primitive.geometry, color: primitive.color, roughness, flat, castShadow, matrices: [] };
          batches.set(key, batch);
        }

        localPosition.fromArray(primitive.position);
        localRotation.setFromEuler(new THREE.Euler(...(primitive.rotation ?? [0, 0, 0])));
        localScale.fromArray(primitive.scale ?? [1, 1, 1]);
        localMatrix.compose(localPosition, localRotation, localScale);
        batch.matrices.push(new THREE.Matrix4().multiplyMatrices(parentMatrix, localMatrix));
      });
    });
  });

  return [...batches.values()];
}

const ComposedPrimitiveBatchMesh: React.FC<{
  batch: ComposedPrimitiveBatch;
  geometry: THREE.BufferGeometry;
}> = ({ batch, geometry }) => {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    batch.matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.count = batch.matrices.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  }, [batch.matrices]);

  if (batch.matrices.length === 0) return null;
  return (
    <instancedMesh
      name={`ground-props:composed:${batch.key}`}
      ref={ref}
      args={[geometry, undefined, batch.matrices.length]}
      castShadow={batch.castShadow}
    >
      <meshStandardMaterial color={batch.color} roughness={batch.roughness} flatShading={batch.flat} />
    </instancedMesh>
  );
};

interface GroundPropsProps {
  ground?: GroundWorld | null;
  sceneOrigin: SceneOrigin;
}

const GroundProps: React.FC<GroundPropsProps> = ({ ground, sceneOrigin }) => {
  const byDef = useMemo(
    () => (ground && ground.props?.length ? placeAll(ground.props, ground, sceneOrigin) : null),
    [ground, sceneOrigin],
  );

  // Shared geometries for the instanced forms (module-stable shapes).
  const geoms = useMemo(
    () => ({
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
        'woodpile-log': new THREE.CylinderGeometry(0.14, 0.14, 1.4, 7),
        'well-ring': new THREE.CylinderGeometry(0.8, 0.85, 0.9, 10),
        'cart-wheel': new THREE.CylinderGeometry(0.45, 0.45, 0.08, 10),
      } satisfies Record<ComposedGeometryKey, THREE.BufferGeometry>,
      // Owned TOWN prop generators (vertex-colored composed meshes):
      // gravestone/tomb/cross, lantern/sign/fingerpost, statue/milestone/
      // shrine, anvil/grindstone, scarecrow, brazier.
      town: buildTownPropForms(),
    }),
    [],
  );

  // Transform work runs only when the canonical prop placement changes. Live
  // frames reuse the resulting instance matrices without rebuilding anything.
  const composedBatches = useMemo(
    () => (byDef ? buildComposedPrimitiveBatches(byDef) : []),
    [byDef],
  );

  if (!byDef) return null;
  const get = (id: string) => byDef.get(id) ?? [];
  const bouldersByVariant: Placed[][] = [[], [], [], []];
  for (const b of get('boulder')) bouldersByVariant[b.variant % 4].push(b);
  const mossyByVariant: Placed[][] = [[], [], [], []];
  for (const b of get('boulder-mossy')) mossyByVariant[b.variant % 4].push(b);
  const bushesByVariant: Placed[][] = [[], [], []];
  for (const b of get('bush')) bushesByVariant[b.variant % 3].push(b);
  const logsByVariant: Placed[][] = [[], [], []];
  for (const l of get('fallen-log')) logsByVariant[l.variant % 3].push(l);

  return (
    <group name="ground-props" data-testid="ground-props">
      {/* Instanced high-count forms */}
      <InstancedForm items={get('crate')} geometry={geoms.box} color={WOOD} base={[0.75, 0.75, 0.75]} yLift={0.5} />
      <InstancedForm items={get('barrel')} geometry={geoms.barrel} color={WOOD_DARK} base={[1, 0.95, 1]} yLift={0.5} />
      <InstancedForm items={get('sack')} geometry={geoms.sack} color={SACK} base={[0.9, 0.55, 0.9]} yLift={0.45} />
      <InstancedForm items={get('haystack')} geometry={geoms.hay} color={HAY} base={[2.4, 1.9, 2.4]} yLift={0.42} />
      {/* Bucket bases are the size of the PLAIN scatter member of each family;
          every other def in the family reaches its own size through
          FORM_SIZE_MUL. Before this the bases were 1.5/1.7 wide, which sized
          the whole family off its largest member. */}
      {/* Thousands of small bushes already receive N8AO contact shading. Their
          shadow silhouettes disappear into the forest floor at this scale,
          while replaying their 240-triangle crowns consumed about 1.86 million
          shadow-pass triangles in the measured town view. */}
      {bushesByVariant.map((items, i) => (
        <InstancedForm
          key={`bush-${i}`}
          items={items}
          geometry={geoms.bushes[i]}
          color={LEAF}
          base={[1.0, 0.85, 1.0]}
          yLift={0.45}
          colorJitter={0.35}
          castShadow={false}
        />
      ))}
      {logsByVariant.map((items, i) => (
        <InstancedForm key={`log-${i}`} items={items} geometry={geoms.logs[i]} color={WOOD_DARK} base={[1, 1, 1]} yLift={0} colorJitter={0.25} />
      ))}
      {/* Jitter 0.18 -> 0.26: the measured spread across a forest window's 867
          stone instances was sRGB value 0.43-0.53, which at distance collapses
          to one flat gray. Stone wants value variation more than hue variation,
          and ROCK's saturation is low enough (linear-HSL 0.11) that the wider
          swing cannot make a rock read as colored. */}
      {bouldersByVariant.map((items, i) => (
        <InstancedForm key={`rock-${i}`} items={items} geometry={geoms.boulders[i]} color={ROCK} base={[1.0, 0.95, 1.0]} yLift={0.3} colorJitter={0.26} />
      ))}
      {mossyByVariant.map((items, i) => (
        <InstancedForm key={`mossrock-${i}`} items={items} geometry={geoms.boulders[i]} color={ROCK_MOSSY} base={[1.0, 0.95, 1.0]} yLift={0.3} colorJitter={0.26} />
      ))}
      {/* Owned town-prop forms: one instanced mesh per (def, variant). The
          geometries are ground-origin unit-frame with baked vertex colors,
          so base is identity and yLift 0. */}
      {Object.entries(geoms.town).flatMap(([defId, form]) => {
        const all = get(defId);
        if (all.length === 0) return [];
        const byVariant: Placed[][] = form.geometries.map(() => []);
        for (const it of all) byVariant[it.variant % form.geometries.length].push(it);
        return byVariant.map((items, i) => (
          <InstancedForm
            key={`${defId}-${i}`}
            items={items}
            geometry={form.geometries[i]}
            color="#ffffff"
            base={[1, 1, 1]}
            yLift={0}
            vertexColors
          />
        ));
      })}
      {/* Composed forms now preserve their individual shapes through instance
          matrices while sharing one mesh per geometry/material/shadow tuple. */}
      {composedBatches.map((batch) => (
        <ComposedPrimitiveBatchMesh
          key={batch.key}
          batch={batch}
          geometry={geoms.composed[batch.geometry]}
        />
      ))}
    </group>
  );
};

export default GroundProps;
