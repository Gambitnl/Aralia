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

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/11/2026, 02:09:02
 * Dependents: components/World3D/World3DScene.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useMemo, useLayoutEffect, useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { SceneOrigin } from '@/systems/world3d/sceneOrigin';
import { groundSurfaceY, type GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { PropInstance } from '@/systems/worldforge/props/propSchema';
import { groundPropInstanceSource, setGroundPropInstanceSources, type GroundPropInstanceSource } from './groundPropGeometry';
import { hash3 } from '@/systems/worldforge/props/generators/proceduralNoise';
import { createPropGeometriesV1, composeTiltedRotationV1 as composeTiltedRotation,
  renderFormForV1 as renderFormFor, propRenderScaleV1, composedPrimitivesV1 as composedPrimitives,
  COMPOSED_PROP_IDS, SIMPLE_PROP_RENDER_V1, PROP_PALETTE_V1, type ComposedGeometryKey } from '@/systems/worldforge/props/generators/propRenderRecipeV1';

const {WOOD,WOOD_DARK,ROCK,ROCK_MOSSY,LEAF,HAY,SACK} = PROP_PALETTE_V1;

/** A prop instance resolved to scene space (meters, origin-rebased). */
interface Placed {
  source: GroundPropInstanceSource;
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
    const scale = propRenderScaleV1(p, origin);
    list.push({
      source: groundPropInstanceSource(p),
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
    // Keep identity paired with these exact matrices, including reused forms.
    setGroundPropInstanceSources(mesh, items.map(item => item.source));
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


interface ComposedPrimitiveBatch {
  key: string;
  geometry: ComposedGeometryKey;
  color: string;
  roughness: number;
  flat: boolean;
  castShadow: boolean;
  matrices: THREE.Matrix4[];
  sources: GroundPropInstanceSource[];
}

/** Reproduce one authored prop's exact visible primitive pieces. */
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
          batch = { key, geometry: primitive.geometry, color: primitive.color, roughness, flat, castShadow, matrices: [], sources: [] };
          batches.set(key, batch);
        }

        localPosition.fromArray(primitive.position);
        localRotation.setFromEuler(new THREE.Euler(...(primitive.rotation ?? [0, 0, 0])));
        localScale.fromArray(primitive.scale ?? [1, 1, 1]);
        localMatrix.compose(localPosition, localRotation, localScale);
        batch.matrices.push(new THREE.Matrix4().multiplyMatrices(parentMatrix, localMatrix));
        batch.sources.push(placed.source);
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
    // Six woodpile logs across two materials still name one canonical prop.
    setGroundPropInstanceSources(mesh, batch.sources);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  }, [batch.matrices, batch.sources]);

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
  /** After actual instance matrices are installed; no frame loop or save write. */
  onReady?: (root: THREE.Group) => void;
}

const GroundProps: React.FC<GroundPropsProps> = ({ ground, sceneOrigin, onReady }) => {
  const rootRef = useRef<THREE.Group>(null), readyRef = useRef(onReady);
  readyRef.current = onReady;
  const byDef = useMemo(
    () => (ground && ground.props?.length ? placeAll(ground.props, ground, sceneOrigin) : null),
    [ground, sceneOrigin],
  );

  // Shared geometries for the instanced forms (module-stable shapes).
  const geoms = useMemo(() => createPropGeometriesV1(), []);
  // Transform work runs only when the canonical prop placement changes. Live
  // frames reuse the resulting instance matrices without rebuilding anything.
  const composedBatches = useMemo(
    () => (byDef ? buildComposedPrimitiveBatches(byDef) : []),
    [byDef],
  );

  useEffect(() => { if (rootRef.current) readyRef.current?.(rootRef.current); }, [byDef]);
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
    <group ref={rootRef} name="ground-props" data-testid="ground-props">
      {/* Instanced high-count forms */}
      <InstancedForm items={get('crate')} geometry={geoms.box} color={WOOD} {...SIMPLE_PROP_RENDER_V1.crate} />
      <InstancedForm items={get('barrel')} geometry={geoms.barrel} color={WOOD_DARK} {...SIMPLE_PROP_RENDER_V1.barrel} />
      <InstancedForm items={get('sack')} geometry={geoms.sack} color={SACK} {...SIMPLE_PROP_RENDER_V1.sack} />
      <InstancedForm items={get('haystack')} geometry={geoms.hay} color={HAY} {...SIMPLE_PROP_RENDER_V1.haystack} />
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
          {...SIMPLE_PROP_RENDER_V1.bush}
          colorJitter={0.35}
          castShadow={false}
        />
      ))}
      {logsByVariant.map((items, i) => (
        <InstancedForm key={`log-${i}`} items={items} geometry={geoms.logs[i]} color={WOOD_DARK} {...SIMPLE_PROP_RENDER_V1['fallen-log']} colorJitter={0.25} />
      ))}
      {/* Jitter 0.18 -> 0.26: the measured spread across a forest window's 867
          stone instances was sRGB value 0.43-0.53, which at distance collapses
          to one flat gray. Stone wants value variation more than hue variation,
          and ROCK's saturation is low enough (linear-HSL 0.11) that the wider
          swing cannot make a rock read as colored. */}
      {bouldersByVariant.map((items, i) => (
        <InstancedForm key={`rock-${i}`} items={items} geometry={geoms.boulders[i]} color={ROCK} {...SIMPLE_PROP_RENDER_V1.boulder} colorJitter={0.26} />
      ))}
      {mossyByVariant.map((items, i) => (
        <InstancedForm key={`mossrock-${i}`} items={items} geometry={geoms.boulders[i]} color={ROCK_MOSSY} {...SIMPLE_PROP_RENDER_V1.boulder} colorJitter={0.26} />
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
            {...SIMPLE_PROP_RENDER_V1.town}
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
