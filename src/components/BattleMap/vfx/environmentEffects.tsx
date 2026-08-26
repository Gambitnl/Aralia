// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 10:05:10
 * Dependents: components/BattleMap/vfx/VFXSystem.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file vfx/environmentEffects.tsx
 * Environment-scale VFX for the 3D battle map: tactical visibility masks
 * (fog-of-war, darkness, dim light) and live light-source glows.
 *
 * Extracted from VFXSystem.tsx (task agora-b70d). This is the "state of the
 * board" layer — what the viewer can see and where light comes from — as
 * opposed to per-spell areas (./spellEffects) or per-creature feedback
 * (./combatFeedback). Ambient weather particles (rain / snow / dust / spores)
 * landed here under Agora task agora-43ae; see the AMBIENT WEATHER section at
 * the bottom of this file.
 *
 * `buildTileVisibilityOverlays` and `LIGHT_SOURCE_MARKER_HTML_PROPS` are
 * re-exported from VFXSystem.tsx for backward compatibility, because
 * vfx/__tests__/VFXSystem.visibility.test.ts and any other caller import them
 * from that path.
 *
 * Dependencies: react, @react-three/drei (Html), @react-three/fiber (useFrame),
 *               three, types/combat, utils/random/seededRandom, ./vfxConstants
 * Dependents: vfx/VFXSystem.tsx
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type {
  BattleMapBiome,
  BattleMapData,
  CombatCharacter,
  LightLevel,
  LightSource,
  Position,
} from '../../../types/combat';
import { SeededRandom } from '../../../utils/random/seededRandom';
import { TILE_SIZE, tileCenter } from './vfxConstants';

/**
 * Tactical visibility labels are screen-space UI, not miniature world props.
 *
 * Drei's Html scales with camera distance only when `distanceFactor` is set.
 * Explicitly keeping transform off documents and locks the intended behavior:
 * the LIGHT marker stays the same readable pixel size at close and overview
 * zoom while its rings and point light remain ordinary world-space mechanics.
 */
export const LIGHT_SOURCE_MARKER_HTML_PROPS = {
  transform: false,
} as const;

// ---------------------------------------------------------------------------
// Tactical visibility masks
// ---------------------------------------------------------------------------

export interface TileVisibilityOverlay {
  id: string;
  position: Position;
  color: string;
  opacity: number;
}

/**
 * Build the 3D tile masks that communicate tactical visibility.
 *
 * This helper is exported so tests can prove hidden/dim/dark tile decisions
 * without mounting a WebGL canvas. The renderer below only turns these plain
 * overlay records into Three.js meshes.
 */
export const buildTileVisibilityOverlays = (
  mapData: BattleMapData,
  lightLevels?: Map<string, LightLevel>,
  visibleTiles?: Set<string>
): TileVisibilityOverlay[] => {
  const overlays: TileVisibilityOverlay[] = [];

  for (const [, tile] of mapData.tiles) {
    const tileId = tile.id;
    const isVisible = visibleTiles ? visibleTiles.has(tileId) : true;
    const level = lightLevels?.get(tileId) ?? 'bright';

    if (!isVisible) {
      overlays.push({ id: tileId, position: tile.coordinates, color: '#020617', opacity: 0.78 });
    } else if (level === 'magical_darkness') {
      overlays.push({ id: tileId, position: tile.coordinates, color: '#020617', opacity: 0.66 });
    } else if (level === 'darkness') {
      overlays.push({ id: tileId, position: tile.coordinates, color: '#020617', opacity: 0.42 });
    } else if (level === 'dim') {
      overlays.push({ id: tileId, position: tile.coordinates, color: '#0f172a', opacity: 0.24 });
    }
  }

  return overlays;
};

/**
 * Instanced renderer for the tactical visibility masks.
 *
 * Previously each dim/dark/hidden tile was its own <mesh> (plane + material +
 * draw call). On large maps with sparse lighting that is thousands of tiles →
 * thousands of draw calls every frame, which dominated the 3D battle-map frame
 * cost. There are only ever four distinct (color, opacity) visibility classes,
 * so we bucket overlays by class and emit ONE InstancedMesh per class: same
 * planes, same colors, same opacities, same positions — identical pixels, but
 * the ~4k draw calls collapse to at most 4. A shared unit plane geometry and a
 * per-class material keep memory flat regardless of tile count.
 */
const VISIBILITY_PLANE = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE).rotateX(-Math.PI / 2);

export const TileVisibilityMasks: React.FC<{ overlays: TileVisibilityOverlay[] }> = ({ overlays }) => {
  const groups = useMemo(() => {
    const byClass = new Map<string, { color: string; opacity: number; positions: Position[] }>();
    for (const o of overlays) {
      const key = `${o.color}|${o.opacity}`;
      let g = byClass.get(key);
      if (!g) { g = { color: o.color, opacity: o.opacity, positions: [] }; byClass.set(key, g); }
      g.positions.push(o.position);
    }
    return [...byClass.entries()].map(([key, g]) => ({ key, ...g }));
  }, [overlays]);

  return (
    <group>
      {groups.map(g => (
        <VisibilityMaskInstances key={g.key} color={g.color} opacity={g.opacity} positions={g.positions} />
      ))}
    </group>
  );
};

const VisibilityMaskInstances: React.FC<{ color: string; opacity: number; positions: Position[] }> = ({ color, opacity, positions }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }),
    [color, opacity]
  );
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    positions.forEach((p, i) => {
      dummy.position.set(tileCenter(p.x), 0.085, tileCenter(p.y));
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.count = positions.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [positions]);

  if (positions.length === 0) return null;
  return (
    <instancedMesh
      ref={meshRef}
      args={[VISIBILITY_PLANE, material, positions.length]}
      frustumCulled={false}
    />
  );
};

// ---------------------------------------------------------------------------
// Light sources
// ---------------------------------------------------------------------------

/** A structured light source resolved to a board position. */
export interface LightSourceMarker {
  source: LightSource;
  position: Position;
}

/**
 * Resolve structured light sources to world positions.
 *
 * Attached lights follow their caster/target; point lights use their stored
 * tile position. A source with no resolvable position is dropped rather than
 * drawn at the origin.
 */
export const buildLightSourceMarkers = (
  activeLightSources: LightSource[],
  characters: CombatCharacter[]
): LightSourceMarker[] => (
  activeLightSources.flatMap(source => {
    const attachedCharacter = source.attachedToCharacterId
      ? characters.find(character => character.id === source.attachedToCharacterId)
      : null;
    const caster = characters.find(character => character.id === source.casterId);
    const position = attachedCharacter?.position || source.position || caster?.position;
    return position ? [{ source, position }] : [];
  })
);

/**
 * Live light-source glow for the 3D combat map.
 */
export const LightSourceVisual: React.FC<{ source: LightSource; position: Position }> = ({ source, position }) => {
  const brightTiles = Math.max(0.25, source.brightRadius / 5);
  const totalTiles = Math.max(brightTiles, (source.brightRadius + source.dimRadius) / 5);
  const color = source.color === 'cold' ? '#93c5fd' : source.color === 'green' ? '#bef264' : '#fde68a';

  return (
    <group position={[tileCenter(position.x), 0.08, tileCenter(position.y)]}>
      {/* The larger dim ring and smaller bright disk mirror the structured
          LightSource radii so light creation and concentration cleanup become
          visible in 3D instead of only affecting hidden visibility math. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[brightTiles * TILE_SIZE, totalTiles * TILE_SIZE, 48]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.28}
          transparent
          opacity={0.16}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[brightTiles * TILE_SIZE, 48]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.38}
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <pointLight color={color} intensity={0.7} distance={Math.max(2, totalTiles * 1.25)} position={[0, 0.8, 0]} />
      <Html
        {...LIGHT_SOURCE_MARKER_HTML_PROPS}
        position={[0, 0.72, 0]}
        center
        style={{ pointerEvents: 'none' }}
      >
        <div style={{
          padding: '2px 6px',
          borderRadius: 999,
          border: '1px solid rgba(253, 230, 138, 0.88)',
          background: 'rgba(69, 26, 3, 0.82)',
          color: '#fef3c7',
          fontSize: 8,
          fontWeight: 900,
          letterSpacing: 0.5,
          whiteSpace: 'nowrap',
        }}>
          LIGHT
        </div>
      </Html>
    </group>
  );
};

// ---------------------------------------------------------------------------
// Ambient weather (agora-43ae)
// ---------------------------------------------------------------------------

/**
 * Environment-scale weather the whole board sits inside.
 *
 * This is NOT a tactical layer. Nothing here reads visibility, blocks line of
 * sight, or changes a rule — it is the "what is falling through the air over
 * this place" band that makes the visibility masks and light glows above read
 * as an outdoor scene instead of a lit diorama.
 */
export type AmbientWeatherKind = 'rain' | 'snow' | 'dust' | 'spores';

/**
 * Which biome gets which weather.
 *
 * There is no weather field on BattleMapData, so the biome IS the source —
 * the same `theme` the ground painter and the biome pill already derive from.
 * This table is therefore the complete, explicit mapping rather than a guess
 * with a default: `cave` and `dungeon` are ROOFED, so they resolve to null and
 * render nothing. That is an answer, not a missing case.
 *
 * When BattleMapData gains a real weather/season field, this table becomes the
 * fallback-free biome default the field overrides, and nothing else here moves.
 */
export const AMBIENT_WEATHER_BY_BIOME: Record<
  BattleMapBiome,
  AmbientWeatherKind | null
> = {
  forest: 'spores',   // pollen and seed fluff drifting up through the canopy
  cave: null,         // roofed
  dungeon: null,      // roofed
  desert: 'dust',
  swamp: 'spores',
  snow: 'snow',
  jungle: 'spores',
  coast: 'rain',
  ruins: 'dust',
  volcanic: 'dust',   // ash, read as heavy slow dust
};

/** The look and motion of one weather kind. */
export interface AmbientWeatherProfile {
  kind: AmbientWeatherKind;
  color: string;
  /** Point size in world units. */
  size: number;
  opacity: number;
  /** World units fallen per second. NEGATIVE rises — spores drift upward. */
  fallSpeed: number;
  /** Radians per second of the horizontal sway oscillation. */
  driftSpeed: number;
  /** Peak horizontal sway velocity in world units per second. */
  driftAmplitude: number;
  /** Height of the volume particles occupy, in world units. */
  ceiling: number;
  /** Particles per tile of board area. */
  densityPerTile: number;
}

/**
 * Motion is what separates these four, not color.
 *
 * Rain falls fast and nearly straight; snow falls slowly and sways wide; dust
 * hangs and wanders; spores rise. A viewer reads the difference with the color
 * removed, which is the test for whether a particle band is doing real work.
 */
export const AMBIENT_WEATHER_PROFILES: Record<
  AmbientWeatherKind,
  AmbientWeatherProfile
> = {
  rain: {
    kind: 'rain',
    color: '#bfdbfe',
    size: 0.035,
    opacity: 0.42,
    fallSpeed: 7.5,
    driftSpeed: 0.8,
    driftAmplitude: 0.12,
    ceiling: 6,
    densityPerTile: 1.1,
  },
  snow: {
    kind: 'snow',
    color: '#f8fafc',
    size: 0.06,
    opacity: 0.62,
    fallSpeed: 0.9,
    driftSpeed: 1.4,
    driftAmplitude: 0.45,
    ceiling: 6,
    densityPerTile: 0.8,
  },
  dust: {
    kind: 'dust',
    color: '#d6c39a',
    size: 0.045,
    opacity: 0.3,
    fallSpeed: 0.25,
    driftSpeed: 0.5,
    driftAmplitude: 0.7,
    ceiling: 4,
    densityPerTile: 0.55,
  },
  spores: {
    kind: 'spores',
    color: '#d9f99d',
    size: 0.05,
    opacity: 0.38,
    fallSpeed: -0.35, // rises
    driftSpeed: 0.9,
    driftAmplitude: 0.35,
    ceiling: 5,
    densityPerTile: 0.45,
  },
};

/**
 * Upper bound on particles for one board.
 *
 * A 120x90 board at rain density would be almost 12,000 points. They are one
 * draw call either way, but the per-frame CPU step is linear in the count and
 * runs on the same thread as the rest of the scene. The cap thins a huge board
 * rather than letting the weather set the frame budget.
 */
export const AMBIENT_WEATHER_MAX_PARTICLES = 3000;

/** The weather this board has, or null when the board is roofed. */
export const resolveAmbientWeather = (
  mapData: BattleMapData
): AmbientWeatherKind | null => AMBIENT_WEATHER_BY_BIOME[mapData.theme];

/** A seeded field of particles: positions plus a per-particle sway phase. */
export interface AmbientWeatherField {
  count: number;
  /** xyz triples, world space. */
  positions: Float32Array;
  /** One sway phase per particle, radians. */
  phases: Float32Array;
}

/** How many particles a board of this size gets under {@link AMBIENT_WEATHER_MAX_PARTICLES}. */
export const ambientWeatherParticleCount = (
  profile: AmbientWeatherProfile,
  dimensions: { width: number; height: number }
): number =>
  Math.min(
    AMBIENT_WEATHER_MAX_PARTICLES,
    Math.round(profile.densityPerTile * dimensions.width * dimensions.height)
  );

/**
 * Seed a weather field across the whole board volume.
 *
 * SEEDED, NOT RANDOM: the same map seed always produces the same starting
 * field. A screenshot of a board is reproducible, a visual regression is
 * reproducible, and the unit tests below can assert exact positions. The
 * per-kind salt keeps two kinds from sharing a scatter if a future board ever
 * mounts more than one.
 */
export const createAmbientWeatherField = (
  profile: AmbientWeatherProfile,
  dimensions: { width: number; height: number },
  seed: number
): AmbientWeatherField => {
  const count = ambientWeatherParticleCount(profile, dimensions);
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const rng = new SeededRandom(seed + profile.kind.length * 7919);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = rng.next() * dimensions.width * TILE_SIZE;
    positions[i * 3 + 1] = rng.next() * profile.ceiling;
    positions[i * 3 + 2] = rng.next() * dimensions.height * TILE_SIZE;
    phases[i] = rng.next() * Math.PI * 2;
  }

  return { count, positions, phases };
};

/**
 * Advance a weather field by one frame.
 *
 * Vertical travel wraps through the volume: a raindrop that reaches the ground
 * re-enters at the ceiling in the same column, a spore that clears the ceiling
 * re-enters at the floor. Wrapping keeps the field's density constant forever
 * without respawn bookkeeping.
 *
 * Horizontal sway integrates a sine, so each particle's drift stays bounded by
 * `driftAmplitude / driftSpeed` instead of turning into a random walk that
 * eventually empties one side of the board. The horizontal wrap is a safety
 * net for that bound, not the mechanism.
 */
export const stepAmbientWeatherField = (
  positions: THREE.BufferAttribute,
  phases: Float32Array,
  profile: AmbientWeatherProfile,
  dimensions: { width: number; height: number },
  delta: number,
  elapsedTime: number
): void => {
  const spanX = dimensions.width * TILE_SIZE;
  const spanZ = dimensions.height * TILE_SIZE;
  const count = phases.length;

  for (let i = 0; i < count; i++) {
    let y = positions.getY(i) - profile.fallSpeed * delta;
    if (y < 0) y += profile.ceiling;
    else if (y > profile.ceiling) y -= profile.ceiling;
    positions.setY(i, y);

    const sway =
      Math.sin(elapsedTime * profile.driftSpeed + phases[i]) *
      profile.driftAmplitude *
      delta;
    let x = positions.getX(i) + sway;
    if (x < 0) x += spanX;
    else if (x > spanX) x -= spanX;
    positions.setX(i, x);

    // The cross-axis uses the same phase shifted a quarter turn, so a particle
    // traces a shallow ellipse rather than a flat line. Two independent phase
    // buffers would double the memory for a difference no viewer can see.
    const swayZ =
      Math.cos(elapsedTime * profile.driftSpeed + phases[i]) *
      profile.driftAmplitude *
      0.5 *
      delta;
    let z = positions.getZ(i) + swayZ;
    if (z < 0) z += spanZ;
    else if (z > spanZ) z -= spanZ;
    positions.setZ(i, z);
  }

  positions.needsUpdate = true;
};

/**
 * The ambient weather band for one board.
 *
 * Renders nothing at all on a roofed biome: no group, no points, no material.
 * One <points> for the whole board, so the entire weather layer is a single
 * draw call regardless of board size — the same instancing discipline the
 * visibility masks above follow.
 *
 * NOT YET MOUNTED: the 3D scene container (vfx/VFXSystem.tsx) is outside this
 * packet's file ownership, so this component ships built and unmounted, the
 * same way WeaponTrail / ImpactEffect / BloodDecal are preserved in
 * ./combatFeedback. Mounting is one line in VFXSystem's returned <group>:
 * `<AmbientWeather mapData={mapData} />`.
 */
export const AmbientWeather: React.FC<{ mapData: BattleMapData }> = ({ mapData }) => {
  const kind = resolveAmbientWeather(mapData);
  const profile = kind ? AMBIENT_WEATHER_PROFILES[kind] : null;

  const field = useMemo(
    () =>
      profile
        ? createAmbientWeatherField(profile, mapData.dimensions, mapData.seed)
        : null,
    [profile, mapData.dimensions, mapData.seed]
  );

  const geometry = useMemo(() => {
    if (!field) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(field.positions.slice(), 3));
    return geo;
  }, [field]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  const pointsRef = useRef<THREE.Points>(null);

  useFrame((state, delta) => {
    if (!pointsRef.current || !field || !profile) return;
    const positions = pointsRef.current.geometry.attributes
      .position as THREE.BufferAttribute;
    stepAmbientWeatherField(
      positions,
      field.phases,
      profile,
      mapData.dimensions,
      delta,
      state.clock.elapsedTime
    );
  });

  if (!profile || !field || !geometry || field.count === 0) return null;

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        color={profile.color}
        size={profile.size}
        transparent
        opacity={profile.opacity}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
};
