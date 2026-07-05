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
    const y = groundSurfaceY(ground, p.xM, p.zM);
    // Route the emitted def to its render form (expanded defs reuse a bespoke
    // form; see RENDER_VARIANT). Referee data is unaffected — that lives in the
    // catalog and is imprinted separately at combat extraction.
    const form = renderFormFor(p.defId);
    let list = byDef.get(form);
    if (!list) byDef.set(form, (list = []));
    list.push({
      x: p.xM - origin.x,
      y,
      z: p.zM - origin.z,
      rot: p.rotationRad,
      scale: p.variation.scale,
      variant: p.variation.variant,
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

const InstancedForm: React.FC<InstancedFormProps> = ({ items, geometry, color, base, yLift, flat, colorJitter, vertexColors }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const s = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const baseC = new THREE.Color(color);
    const c = new THREE.Color();
    items.forEach((it, i) => {
      q.setFromAxisAngle(up, it.rot);
      s.set(base[0] * it.scale, base[1] * it.scale, base[2] * it.scale);
      pos.set(it.x, it.y + base[1] * it.scale * yLift, it.z);
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
    <instancedMesh ref={ref} args={[geometry, undefined, items.length]} frustumCulled={false} castShadow>
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

const flatMat = (color: string) => (
  <meshStandardMaterial color={color} roughness={0.9} flatShading />
);

const MarketStall: React.FC<{ p: Placed }> = ({ p }) => {
  const s = p.scale;
  const awning = p.variant % 2 === 0 ? CANVAS : CANVAS_RED;
  return (
    <group position={[p.x, p.y, p.z]} rotation={[0, p.rot, 0]} scale={s}>
      {/* 4 corner posts */}
      {([[-1.1, -0.7], [1.1, -0.7], [-1.1, 0.7], [1.1, 0.7]] as const).map(([px, pz], i) => (
        <mesh key={i} position={[px, 1.05, pz]} castShadow>
          <cylinderGeometry args={[0.05, 0.06, 2.1, 6]} />
          {flatMat(WOOD_DARK)}
        </mesh>
      ))}
      {/* counter slab */}
      <mesh position={[0, 0.85, 0]} castShadow>
        <boxGeometry args={[2.4, 0.1, 1.5]} />
        {flatMat(WOOD)}
      </mesh>
      {/* angled awning plane */}
      <mesh position={[0, 2.25, 0.15]} rotation={[-0.35, 0, 0]} castShadow>
        <boxGeometry args={[2.6, 0.05, 1.9]} />
        {flatMat(awning)}
      </mesh>
    </group>
  );
};

const Woodpile: React.FC<{ p: Placed }> = ({ p }) => (
  <group position={[p.x, p.y, p.z]} rotation={[0, p.rot, 0]} scale={p.scale}>
    {/* stacked log rows: 3 + 2 + 1 */}
    {([[-0.3, 0.15], [0, 0.15], [0.3, 0.15], [-0.15, 0.42], [0.15, 0.42], [0, 0.68]] as const).map(([ox, oy], i) => (
      <mesh key={i} position={[ox, oy, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.14, 1.4, 7]} />
        {flatMat(i % 2 ? WOOD_DARK : WOOD)}
      </mesh>
    ))}
  </group>
);

const FenceRun: React.FC<{ p: Placed }> = ({ p }) => {
  // A ~6 m run: 4 posts + 2 rails, oriented by rotationRad.
  const posts = [-3, -1, 1, 3];
  return (
    <group position={[p.x, p.y, p.z]} rotation={[0, p.rot, 0]} scale={p.scale}>
      {posts.map((ox, i) => (
        <mesh key={i} position={[ox, 0.55, 0]} castShadow>
          <boxGeometry args={[0.12, 1.1, 0.12]} />
          {flatMat(WOOD_DARK)}
        </mesh>
      ))}
      <mesh position={[0, 0.85, 0]} castShadow>
        <boxGeometry args={[6.4, 0.08, 0.08]} />
        {flatMat(WOOD)}
      </mesh>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[6.4, 0.08, 0.08]} />
        {flatMat(WOOD)}
      </mesh>
    </group>
  );
};

const Well: React.FC<{ p: Placed }> = ({ p }) => (
  <group position={[p.x, p.y, p.z]} rotation={[0, p.rot, 0]} scale={p.scale}>
    {/* stone ring */}
    <mesh position={[0, 0.45, 0]} castShadow>
      <cylinderGeometry args={[0.8, 0.85, 0.9, 10]} />
      {flatMat(STONE)}
    </mesh>
    {/* two roof posts */}
    <mesh position={[-0.75, 1.3, 0]} castShadow>
      <boxGeometry args={[0.1, 1.8, 0.1]} />
      {flatMat(WOOD_DARK)}
    </mesh>
    <mesh position={[0.75, 1.3, 0]} castShadow>
      <boxGeometry args={[0.1, 1.8, 0.1]} />
      {flatMat(WOOD_DARK)}
    </mesh>
    {/* tiny gable roof (cone-as-prism look via rotated box pair) */}
    <mesh position={[0, 2.35, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
      <boxGeometry args={[1.5, 1.5, 1.6]} />
      {flatMat(WOOD)}
    </mesh>
  </group>
);

const Trough: React.FC<{ p: Placed }> = ({ p }) => (
  <group position={[p.x, p.y, p.z]} rotation={[0, p.rot, 0]} scale={p.scale}>
    {/* open box: floor + 4 walls */}
    <mesh position={[0, 0.06, 0]} castShadow>
      <boxGeometry args={[1.8, 0.12, 0.7]} />
      {flatMat(WOOD_DARK)}
    </mesh>
    <mesh position={[0, 0.3, -0.31]}><boxGeometry args={[1.8, 0.5, 0.08]} />{flatMat(WOOD)}</mesh>
    <mesh position={[0, 0.3, 0.31]}><boxGeometry args={[1.8, 0.5, 0.08]} />{flatMat(WOOD)}</mesh>
    <mesh position={[-0.86, 0.3, 0]}><boxGeometry args={[0.08, 0.5, 0.7]} />{flatMat(WOOD)}</mesh>
    <mesh position={[0.86, 0.3, 0]}><boxGeometry args={[0.08, 0.5, 0.7]} />{flatMat(WOOD)}</mesh>
    {/* water surface */}
    <mesh position={[0, 0.4, 0]}>
      <boxGeometry args={[1.62, 0.02, 0.52]} />
      <meshStandardMaterial color="#4a7d96" roughness={0.3} />
    </mesh>
  </group>
);

const Cart: React.FC<{ p: Placed }> = ({ p }) => (
  <group position={[p.x, p.y, p.z]} rotation={[0, p.rot, 0]} scale={p.scale}>
    {/* bed */}
    <mesh position={[0, 0.62, 0]} castShadow>
      <boxGeometry args={[2.0, 0.12, 1.1]} />
      {flatMat(WOOD)}
    </mesh>
    {/* side rails */}
    <mesh position={[0, 0.85, -0.5]}><boxGeometry args={[2.0, 0.35, 0.06]} />{flatMat(WOOD_PALE)}</mesh>
    <mesh position={[0, 0.85, 0.5]}><boxGeometry args={[2.0, 0.35, 0.06]} />{flatMat(WOOD_PALE)}</mesh>
    {/* two wheels */}
    <mesh position={[0, 0.45, -0.62]} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[0.45, 0.45, 0.08, 10]} />
      {flatMat(WOOD_DARK)}
    </mesh>
    <mesh position={[0, 0.45, 0.62]} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[0.45, 0.45, 0.08, 10]} />
      {flatMat(WOOD_DARK)}
    </mesh>
    {/* handles */}
    <mesh position={[1.35, 0.75, 0]} rotation={[0, 0, -0.25]}>
      <boxGeometry args={[0.9, 0.07, 0.07]} />
      {flatMat(WOOD_DARK)}
    </mesh>
  </group>
);

const CrateStack: React.FC<{ p: Placed }> = ({ p }) => (
  <group position={[p.x, p.y, p.z]} rotation={[0, p.rot, 0]} scale={p.scale}>
    <mesh position={[-0.35, 0.35, 0]} castShadow><boxGeometry args={[0.7, 0.7, 0.7]} />{flatMat(WOOD)}</mesh>
    <mesh position={[0.4, 0.3, 0.1]} rotation={[0, 0.3, 0]} castShadow><boxGeometry args={[0.6, 0.6, 0.6]} />{flatMat(WOOD_PALE)}</mesh>
    <mesh position={[-0.1, 0.98, 0.05]} rotation={[0, -0.2, 0]} castShadow><boxGeometry args={[0.62, 0.62, 0.62]} />{flatMat(WOOD_DARK)}</mesh>
  </group>
);

// ── Main component ───────────────────────────────────────────────────────────

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
      // Owned TOWN prop generators (vertex-colored composed meshes):
      // gravestone/tomb/cross, lantern/sign/fingerpost, statue/milestone/
      // shrine, anvil/grindstone, scarecrow, brazier.
      town: buildTownPropForms(),
    }),
    [],
  );

  if (!byDef) return null;
  const get = (id: string) => byDef.get(id) ?? [];
  const bouldersByVariant: Placed[][] = [[], [], [], []];
  for (const b of get('boulder')) bouldersByVariant[b.variant % 4].push(b);
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
      {bushesByVariant.map((items, i) => (
        <InstancedForm key={`bush-${i}`} items={items} geometry={geoms.bushes[i]} color={LEAF} base={[1.5, 1.1, 1.5]} yLift={0.45} colorJitter={0.35} />
      ))}
      {logsByVariant.map((items, i) => (
        <InstancedForm key={`log-${i}`} items={items} geometry={geoms.logs[i]} color={WOOD_DARK} base={[1, 1, 1]} yLift={0} colorJitter={0.25} />
      ))}
      {bouldersByVariant.map((items, i) => (
        <InstancedForm key={`rock-${i}`} items={items} geometry={geoms.boulders[i]} color={ROCK} base={[1.7, 1.3, 1.7]} yLift={0.3} colorJitter={0.18} />
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
      {/* Composed low-count forms */}
      {get('market-stall').map((p, i) => <MarketStall key={i} p={p} />)}
      {get('woodpile').map((p, i) => <Woodpile key={i} p={p} />)}
      {get('fence-run').map((p, i) => <FenceRun key={i} p={p} />)}
      {get('well').map((p, i) => <Well key={i} p={p} />)}
      {get('water-trough').map((p, i) => <Trough key={i} p={p} />)}
      {get('cart').map((p, i) => <Cart key={i} p={p} />)}
      {get('crate-stack').map((p, i) => <CrateStack key={i} p={p} />)}
    </group>
  );
};

export default GroundProps;
