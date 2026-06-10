/**
 * @file DistantTerrain.tsx
 * Distant horizon terrain for the 3D combat map — a procedurally displaced
 * ridge band ringing the battlefield so the map reads as part of a larger
 * landscape instead of a flat slab floating in fog.
 *
 * Why this exists:
 * The combat map already has a flat ground apron, a mesa skirt, and a gradient
 * sky dome (see BattleMap3D.tsx). But between the battlefield edge and the
 * horizon there was nothing — the eye travelled "detailed map → flat colored
 * disk → fog → sky", which reads as a diorama in haze. This component fills
 * that mid/far ground with rolling hills / mesas / cavern walls that rise above
 * the apron and dissolve into the scene fog, giving real depth.
 *
 * Design notes:
 * - One low-poly annulus (ring) mesh centered on the map. Vertices are pushed
 *   up by layered value-noise into terrain. No textures (matches the codebase's
 *   procedural style), no shadow casting, a few thousand tris — cheap.
 * - Scene fog (per biome, set in BattleMap3D) does the distance fade. The ridge
 *   base color is chosen to melt into each biome's fog/horizon color, and the
 *   SkyDome horizon is already set to the fog color, so ridge → fog → sky is
 *   seamless.
 * - Open biomes (forest/desert/swamp) get distant rolling terrain. Enclosed
 *   biomes (cave/dungeon) get a taller, steeper, closer dark ring that reads as
 *   cavern walls instead of an open horizon — their intentional dark mood is
 *   preserved, not brightened.
 *
 * Scope: this is decorative backdrop geometry inside the combat scene (like the
 * apron and sky dome). It is NOT World3D exploration terrain.
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { BattleMapData } from '../../../types/combat';

const TILE_WORLD_SIZE = 1.0;

// The ridge sits on the ground apron (BattleMap3D mounts the apron at y=-0.15).
// Matching that keeps the inner ring flush with the apron instead of hovering.
const APRON_Y = -0.15;

interface RidgeProfile {
  /** Inner radius (world units from map center) — keep clear of map corners (~25). */
  inner: number;
  /** Outer radius — where the ridge tucks down into fog. */
  outer: number;
  /** Peak displacement amplitude in world units. */
  amp: number;
  /** Fraction of the band over which the ridge rises from the apron to full height. */
  rise: number;
  /** Spatial frequency of the base hills (smaller = broader landforms). */
  freq: number;
  /** Valley color (low ground). */
  low: THREE.Color;
  /** Peak color (catches the light). */
  high: THREE.Color;
  /** Flat-topped mesa/butte shaping (desert) instead of rounded hills. */
  mesa?: boolean;
}

// Colors are picked to harmonize with each biome's fog so the fogged far edge of
// the ridge blends into the horizon. Open biomes read as land; cave/dungeon read
// as dark enclosing rock.
const RIDGE_PROFILES: Record<string, RidgeProfile> = {
  forest: {
    inner: 33, outer: 88, amp: 6.5, rise: 0.32, freq: 0.06,
    low: new THREE.Color(0x2e3f23), high: new THREE.Color(0x5d6e44),
  },
  desert: {
    inner: 36, outer: 94, amp: 15, rise: 0.24, freq: 0.034,
    low: new THREE.Color(0x8a5f2e), high: new THREE.Color(0xcaa468),
    mesa: true,
  },
  swamp: {
    inner: 30, outer: 72, amp: 4.5, rise: 0.30, freq: 0.07,
    low: new THREE.Color(0x232c1b), high: new THREE.Color(0x3c4a2c),
  },
  cave: {
    inner: 29, outer: 62, amp: 15, rise: 0.16, freq: 0.08,
    low: new THREE.Color(0x12151f), high: new THREE.Color(0x262c3c),
  },
  dungeon: {
    inner: 29, outer: 60, amp: 14, rise: 0.16, freq: 0.08,
    low: new THREE.Color(0x171119), high: new THREE.Color(0x2a2030),
  },
};

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Deterministic 2D value-noise sampled in cartesian space (seamless — no
 *  angular wrap seam) with a small FBM stack. */
function makeFbm(seed: number) {
  const hash = (xi: number, zi: number): number => {
    let h = Math.imul(xi | 0, 374761393) ^ Math.imul(zi | 0, 668265263) ^ Math.imul(seed | 0, 362437);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const noise = (x: number, z: number): number => {
    const xi = Math.floor(x), zi = Math.floor(z);
    const xf = x - xi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf);
    const v = zf * zf * (3 - 2 * zf);
    const v00 = hash(xi, zi), v10 = hash(xi + 1, zi);
    const v01 = hash(xi, zi + 1), v11 = hash(xi + 1, zi + 1);
    return THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(v00, v10, u),
      THREE.MathUtils.lerp(v01, v11, u),
      v,
    );
  };
  return (x: number, z: number): number => {
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let o = 0; o < 4; o++) {
      sum += amp * noise(x * f, z * f);
      norm += amp;
      amp *= 0.5;
      f *= 2.07;
    }
    return sum / norm; // 0..1
  };
}

interface DistantTerrainProps {
  mapData: BattleMapData;
}

/**
 * Procedural ridge band ringing the battlefield. Single mesh, fogged, no
 * shadows. Geometry is built centered on the origin and the mesh is positioned
 * at the map center so it surrounds the play area.
 */
const DistantTerrain: React.FC<DistantTerrainProps> = ({ mapData }) => {
  const { width, height } = mapData.dimensions;
  const biome = useMemo(() => {
    const m = mapData as BattleMapData & { biome?: string; theme?: string };
    return m.biome ?? m.theme ?? 'forest';
  }, [mapData]);

  const center = useMemo(
    () => [(width / 2) * TILE_WORLD_SIZE, APRON_Y, (height / 2) * TILE_WORLD_SIZE] as const,
    [width, height],
  );

  const geometry = useMemo(() => {
    const p = RIDGE_PROFILES[biome] ?? RIDGE_PROFILES.forest;
    const seed = mapData.seed ?? 42;
    const fbm = makeFbm(seed);

    const ANG = 132;       // angular segments
    const RAD = 30;        // radial segments
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const span = p.outer - p.inner;

    for (let ri = 0; ri <= RAD; ri++) {
      const rt = ri / RAD;                       // 0..1 across the band
      const r = p.inner + rt * span;
      // Rise from the apron, hold high, then tuck back down so the far edge
      // settles into the fog rather than ending on a hard ridge line.
      const env = smoothstep(0, p.rise, rt) * (1 - smoothstep(0.82, 1, rt) * 0.75);
      for (let ai = 0; ai <= ANG; ai++) {
        const at = ai / ANG;
        const ang = at * Math.PI * 2;
        const cx = Math.cos(ang) * r;
        const cz = Math.sin(ang) * r;
        const n = fbm(cx * p.freq, cz * p.freq);
        // Bias toward taller, more separated peaks (contrast the noise a touch).
        const shaped = n * n * (3 - 2 * n);
        // Rolling hills by default; for desert, carve flat-topped mesas/buttes —
        // a low desert floor with distinct plateaus where the noise crests, so
        // the distant landforms read as buttes instead of gentle dunes.
        const profile = p.mesa
          ? 0.10 + 0.28 * shaped + 0.62 * smoothstep(0.46, 0.62, shaped)
          : 0.18 + 0.82 * shaped;
        const y = env * p.amp * profile;
        positions.push(cx, y, cz);

        const hf = THREE.MathUtils.clamp(y / Math.max(0.001, p.amp), 0, 1);
        const col = p.low.clone().lerp(p.high, hf);
        colors.push(col.r, col.g, col.b);
      }
    }

    const stride = ANG + 1;
    for (let ri = 0; ri < RAD; ri++) {
      for (let ai = 0; ai < ANG; ai++) {
        const a = ri * stride + ai;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [biome, mapData.seed]);

  // Dispose the generated geometry when biome/seed changes or on unmount.
  React.useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      geometry={geometry}
      position={[center[0], center[1], center[2]]}
      castShadow={false}
      receiveShadow={false}
      frustumCulled={false}
    >
      <meshStandardMaterial
        vertexColors
        roughness={1}
        metalness={0}
        flatShading={false}
      />
    </mesh>
  );
};

export default DistantTerrain;
