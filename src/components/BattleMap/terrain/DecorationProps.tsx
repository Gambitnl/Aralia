/**
 * @file DecorationProps.tsx
 * Procedural 3D decoration props (trees, boulders, stalagmites, pillars, cacti, mangroves)
 * rendered as instanced meshes for draw call efficiency.
 *
 * Until glTF models are sourced (Phase 2), props are rendered as procedural geometry:
 * - Trees: cylinder trunk + cone/sphere canopy
 * - Boulders: icosahedron with jittered vertices
 * - Stalagmites: cone pointing up
 * - Pillars: cylinder
 * - Cacti: green cylinder + arms
 * - Mangroves: twisted trunk + wide canopy
 *
 * Each prop type uses a single InstancedMesh for minimal draw calls.
 * Placement uses seeded random jitter (±0.3 tiles offset, random Y rotation)
 * so props don't sit on grid centers.
 *
 * @see docs/superpowers/specs/2026-05-21-3d-combat-map-design.md — "Decorations as 3D Props" section
 */
import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { BattleMapData, BattleMapDecoration, BattleMapTile } from '../../../types/combat';
import { makeTerrainHeightSampler } from './TerrainMesh';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TILE_SIZE = 1.0;
const POSITION_JITTER = 0.3;

// ---------------------------------------------------------------------------
// Seeded random
// ---------------------------------------------------------------------------

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// ---------------------------------------------------------------------------
// Procedural prop geometries
// ---------------------------------------------------------------------------

type PropGeometrySet = {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
};

function createTreeGeometry(): PropGeometrySet[] {
  // Trunk — thick, tall, visible at tactical zoom
  const trunk = new THREE.CylinderGeometry(0.08, 0.14, 1.2, 8);
  trunk.translate(0, 0.6, 0);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x4a2a10,
    roughness: 0.95,
    metalness: 0.0,
  });

  // Multi-sphere canopy for natural, fluffy tree crown
  // Main canopy sphere
  const canopy1 = new THREE.SphereGeometry(0.55, 10, 8);
  canopy1.translate(0, 1.5, 0);
  // Side clusters for volume
  const canopy2 = new THREE.SphereGeometry(0.4, 8, 6);
  canopy2.translate(0.25, 1.3, 0.15);
  const canopy3 = new THREE.SphereGeometry(0.38, 8, 6);
  canopy3.translate(-0.2, 1.35, -0.15);
  // Top cluster
  const canopy4 = new THREE.SphereGeometry(0.32, 8, 6);
  canopy4.translate(0.05, 1.8, 0.05);

  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x1a5a1a,
    roughness: 0.85,
    metalness: 0.0,
  });

  // Merge all canopy spheres
  const mergedCanopy = mergeGeometries([canopy1, canopy2, canopy3, canopy4]);

  return [
    { geometry: trunk, material: trunkMat },
    { geometry: mergedCanopy, material: canopyMat },
  ];
}

/** Tall pine/conifer — narrow layered cone canopy, dark green */
function createTallPineGeometry(): PropGeometrySet[] {
  const trunk = new THREE.CylinderGeometry(0.05, 0.10, 1.6, 6);
  trunk.translate(0, 0.8, 0);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x3a2010, roughness: 0.95, metalness: 0.0,
  });

  // Layered cone canopy — 3 tiers for spruce look
  const cone1 = new THREE.ConeGeometry(0.45, 0.6, 8);
  cone1.translate(0, 1.9, 0);
  const cone2 = new THREE.ConeGeometry(0.34, 0.5, 8);
  cone2.translate(0, 2.3, 0);
  const cone3 = new THREE.ConeGeometry(0.20, 0.4, 6);
  cone3.translate(0, 2.6, 0);

  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x0f4a1a, roughness: 0.85, metalness: 0.0,
  });

  return [
    { geometry: trunk, material: trunkMat },
    { geometry: mergeGeometries([cone1, cone2, cone3]), material: canopyMat },
  ];
}

/** Wide flat canopy — acacia/spreading oak style */
function createWideFlatTreeGeometry(): PropGeometrySet[] {
  const trunk = new THREE.CylinderGeometry(0.10, 0.16, 0.9, 8);
  trunk.translate(0, 0.45, 0);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x5a3a1a, roughness: 0.95, metalness: 0.0,
  });

  const canopy1 = new THREE.SphereGeometry(0.7, 10, 8);
  canopy1.scale(1, 0.38, 1);
  canopy1.translate(0, 1.2, 0);
  const canopy2 = new THREE.SphereGeometry(0.5, 8, 6);
  canopy2.scale(1, 0.35, 1);
  canopy2.translate(0.3, 1.1, 0.2);
  const canopy3 = new THREE.SphereGeometry(0.45, 8, 6);
  canopy3.scale(1, 0.35, 1);
  canopy3.translate(-0.25, 1.15, -0.15);

  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x2a6a22, roughness: 0.85, metalness: 0.0,
  });

  return [
    { geometry: trunk, material: trunkMat },
    { geometry: mergeGeometries([canopy1, canopy2, canopy3]), material: canopyMat },
  ];
}

/**
 * Dead/bare tree — gnarled recursive branching (task 77, GOAL #35).
 * The old version was three straight cylinders on a pole (a stick figure);
 * this builds a tapered, twisting branch skeleton via recursion so the
 * silhouette reads "dead gothic tree" at tactical zoom. Deterministic local
 * LCG: the geometry is shared by all instances (per-instance variety comes
 * from the task-75 scale/tilt/tint variation).
 */
function createDeadTreeGeometry(): PropGeometrySet[] {
  const parts: THREE.BufferGeometry[] = [];
  let s = 48271;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const UP = new THREE.Vector3(0, 1, 0);

  const addBranch = (
    start: THREE.Vector3,
    dir: THREE.Vector3,
    len: number,
    radius: number,
    depth: number,
  ): void => {
    const seg = new THREE.CylinderGeometry(Math.max(0.008, radius * 0.55), radius, len, 5);
    seg.translate(0, len / 2, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
    seg.applyMatrix4(new THREE.Matrix4().compose(start, quat, new THREE.Vector3(1, 1, 1)));
    parts.push(seg);
    if (depth <= 0) return;

    const end = start.clone().add(dir.clone().normalize().multiplyScalar(len));
    const childCount = depth >= 3 ? 3 : 2;
    for (let i = 0; i < childCount; i++) {
      const tilt = 0.45 + rnd() * 0.65;     // splay outward — gnarled, not straight
      const spin = rnd() * Math.PI * 2;
      const childDir = dir.clone().normalize()
        .applyAxisAngle(new THREE.Vector3(1, 0, 0), Math.sin(spin) * tilt)
        .applyAxisAngle(new THREE.Vector3(0, 0, 1), Math.cos(spin) * tilt);
      // Dead trees still reach for the sky they lost — clamp droop.
      if (childDir.y < 0.1) childDir.y = 0.1 + rnd() * 0.3;
      addBranch(end, childDir, len * (0.52 + rnd() * 0.18), radius * 0.55, depth - 1);
    }
  };

  // Trunk leans slightly (swamp settling), then three branch generations.
  addBranch(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.12, 1, -0.06),
    0.85,
    0.11,
    3,
  );

  const mat = new THREE.MeshStandardMaterial({
    color: 0x453322, roughness: 0.95, metalness: 0.0,
  });

  return [{ geometry: mergeGeometries(parts), material: mat }];
}

// Tree variant factories for random per-instance species selection
const TREE_VARIANTS: (() => PropGeometrySet[])[] = [
  createTreeGeometry,        // Oak (40%)
  createTallPineGeometry,    // Pine (25%)
  createWideFlatTreeGeometry,// Wide/flat (25%)
  createDeadTreeGeometry,    // Dead/bare (10%)
];

function createBoulderGeometry(): PropGeometrySet[] {
  const geo = new THREE.IcosahedronGeometry(0.35, 1);
  // Jitter vertices for organic look
  const positions = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const jitter = 0.05;
    positions.setXYZ(
      i,
      x * 1.1 + (Math.sin(x * 100) * jitter),
      Math.max(0, y * 0.6 + 0.12) + (Math.sin(y * 100) * jitter * 0.5), // Flatten bottom
      z + (Math.sin(z * 100) * jitter),
    );
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0x5a5a5a,
    roughness: 0.9,
    metalness: 0.05,
  });

  return [{ geometry: geo, material: mat }];
}

function createStalagmiteGeometry(): PropGeometrySet[] {
  const geo = new THREE.ConeGeometry(0.18, 1.0, 6);
  geo.translate(0, 0.5, 0);

  const mat = new THREE.MeshStandardMaterial({
    color: 0x5a5a50,
    roughness: 0.9,
    metalness: 0.05,
  });

  return [{ geometry: geo, material: mat }];
}

function createPillarGeometry(): PropGeometrySet[] {
  // Target: 3–4× character height (~7 world units total).
  // Characters stand ~2.3 units tall (3.2× scale × 0.72 local height).
  // Dungeon pillars should feel architectural and imposing.

  // Plinth / base — wide, short slab at ground level
  const plinth = new THREE.CylinderGeometry(0.32, 0.36, 0.22, 12);
  plinth.translate(0, 0.11, 0);

  // Shaft — tapers slightly from base to top
  const shaft = new THREE.CylinderGeometry(0.20, 0.26, 6.5, 12);
  shaft.translate(0, 3.47, 0);   // center at (0 + 0.22 + 6.5/2)

  // Capital — flared top block, wider than shaft
  const capital = new THREE.CylinderGeometry(0.36, 0.22, 0.30, 12);
  capital.translate(0, 6.87, 0); // just above shaft top (0.22 + 6.5 + 0.15)

  // Crown disc — flat widening at very top
  const crown = new THREE.CylinderGeometry(0.40, 0.36, 0.10, 12);
  crown.translate(0, 7.07, 0);   // sits atop the capital

  const mat = new THREE.MeshStandardMaterial({
    color: 0x7a7060,
    roughness: 0.75,
    metalness: 0.08,
  });

  const merged = mergeGeometries([plinth, shaft, capital, crown]);
  return [{ geometry: merged, material: mat }];
}

function createCactusGeometry(): PropGeometrySet[] {
  // Main body — tall saguaro style
  const body = new THREE.CylinderGeometry(0.1, 0.13, 1.0, 8);
  body.translate(0, 0.5, 0);

  // Rounded top
  const top = new THREE.SphereGeometry(0.1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  top.translate(0, 1.0, 0);

  // Arms (simplified as smaller cylinders)
  const armR = new THREE.CylinderGeometry(0.05, 0.06, 0.35, 6);
  armR.rotateZ(-Math.PI / 3.5);
  armR.translate(0.18, 0.65, 0);
  const armRTop = new THREE.CylinderGeometry(0.05, 0.05, 0.2, 6);
  armRTop.translate(0.28, 0.78, 0);

  const armL = new THREE.CylinderGeometry(0.05, 0.06, 0.3, 6);
  armL.rotateZ(Math.PI / 3.5);
  armL.translate(-0.15, 0.55, 0);
  const armLTop = new THREE.CylinderGeometry(0.05, 0.05, 0.18, 6);
  armLTop.translate(-0.25, 0.68, 0);

  const mat = new THREE.MeshStandardMaterial({
    color: 0x2a6a2a,
    roughness: 0.8,
    metalness: 0.0,
  });

  const merged = mergeGeometries([body, top, armR, armRTop, armL, armLTop]);
  return [{ geometry: merged, material: mat }];
}

function createMangroveGeometry(): PropGeometrySet[] {
  // Root/trunk — thicker at base, tall
  const trunk = new THREE.CylinderGeometry(0.06, 0.18, 0.9, 6);
  trunk.translate(0, 0.45, 0);

  // Exposed root legs
  const root1 = new THREE.CylinderGeometry(0.03, 0.05, 0.5, 4);
  root1.rotateZ(0.4);
  root1.translate(0.15, 0.15, 0.08);
  const root2 = new THREE.CylinderGeometry(0.03, 0.05, 0.5, 4);
  root2.rotateZ(-0.35);
  root2.translate(-0.12, 0.15, -0.1);

  const trunkGeo = mergeGeometries([trunk, root1, root2]);

  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x3a2a1a,
    roughness: 0.95,
    metalness: 0.0,
  });

  // Wide, flat canopy — multi-sphere
  const canopy1 = new THREE.SphereGeometry(0.45, 8, 6);
  canopy1.scale(1, 0.45, 1);
  canopy1.translate(0, 1.1, 0);
  const canopy2 = new THREE.SphereGeometry(0.3, 8, 6);
  canopy2.scale(1, 0.4, 1);
  canopy2.translate(0.2, 1.0, 0.15);

  const canopyGeo = mergeGeometries([canopy1, canopy2]);

  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x1a3a18,
    roughness: 0.85,
    metalness: 0.0,
  });

  return [
    { geometry: trunkGeo, material: trunkMat },
    { geometry: canopyGeo, material: canopyMat },
  ];
}

/** Fallen log — horizontal cylinder with slight taper, bark-colored */
function createFallenLogGeometry(): PropGeometrySet[] {
  const log = new THREE.CylinderGeometry(0.07, 0.09, 0.6, 8);
  log.rotateZ(Math.PI / 2); // Lay horizontal
  log.translate(0, 0.07, 0);

  // Broken end cap
  const endCap = new THREE.SphereGeometry(0.07, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  endCap.rotateZ(Math.PI / 2);
  endCap.translate(-0.3, 0.07, 0);

  const mat = new THREE.MeshStandardMaterial({
    color: 0x4a3018,
    roughness: 0.95,
    metalness: 0.0,
  });

  return [{ geometry: mergeGeometries([log, endCap]), material: mat }];
}

/** Tree stump — short thick cylinder with rough top */
function createStumpGeometry(): PropGeometrySet[] {
  const stump = new THREE.CylinderGeometry(0.08, 0.11, 0.15, 8);
  stump.translate(0, 0.075, 0);

  // Ring pattern on top
  const ring = new THREE.RingGeometry(0.02, 0.07, 8);
  ring.rotateX(-Math.PI / 2);
  ring.translate(0, 0.155, 0);

  const stumpMat = new THREE.MeshStandardMaterial({
    color: 0x5a3a1a,
    roughness: 0.9,
    metalness: 0.0,
  });

  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x7a5a30,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  return [
    { geometry: stump, material: stumpMat },
    { geometry: ring, material: ringMat },
  ];
}

/** Bush — leafy clump: noisy multi-lobe cluster with a base→tip light gradient
 * (GOAL #36 — smooth flat-colored lobes read as "green billiard balls"). */
function createBushGeometry(): PropGeometrySet[] {
  const s1 = new THREE.SphereGeometry(0.25, 8, 6);
  s1.translate(0, 0.22, 0);
  const s2 = new THREE.SphereGeometry(0.2, 7, 5);
  s2.translate(0.15, 0.18, 0.1);
  const s3 = new THREE.SphereGeometry(0.18, 7, 5);
  s3.translate(-0.12, 0.16, -0.08);
  const s4 = new THREE.SphereGeometry(0.15, 6, 4);
  s4.translate(0.05, 0.32, -0.05);

  const geo = mergeGeometries([s1, s2, s3, s4]);

  // Leafy irregularity: hash-noise displacement along normals breaks the
  // smooth sphere surface; flat shading then gives faceted "leaf cluster"
  // highlights. Vertex colors run dark interior → lighter sunlit tips.
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const norm = geo.attributes.normal as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const baseColor = new THREE.Color(0x1e4212);
  const tipColor = new THREE.Color(0x4f8226);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = Math.sin(x * 41.7 + y * 73.3 + z * 57.1) * 43758.5453;
    const jitter = (n - Math.floor(n) - 0.5) * 0.1; // ±0.05
    const ny = Math.max(0.01, y + norm.getY(i) * jitter);
    pos.setXYZ(i, x + norm.getX(i) * jitter, ny, z + norm.getZ(i) * jitter);
    const t = Math.min(1, Math.max(0, ny / 0.45));
    c.copy(baseColor).lerp(tipColor, t * t);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.0,
    vertexColors: true,
    flatShading: true,
  });

  return [{ geometry: geo, material: mat }];
}

/** Simple geometry merge (no dependencies on three-stdlib) */
function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  let vertOffset = 0;

  for (const geo of geometries) {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const norm = geo.attributes.normal as THREE.BufferAttribute;
    const idx = geo.index;

    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (norm) {
        normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
      }
    }

    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indices.push(idx.array[i] + vertOffset);
      }
    } else {
      for (let i = 0; i < pos.count; i++) {
        indices.push(i + vertOffset);
      }
    }

    vertOffset += pos.count;
  }

  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length > 0) {
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  } else {
    merged.computeVertexNormals();
  }
  merged.setIndex(indices);

  return merged;
}

// ---------------------------------------------------------------------------
// Prop type → geometry factory map
// ---------------------------------------------------------------------------

const PROP_FACTORIES: Record<NonNullable<BattleMapDecoration>, () => PropGeometrySet[]> = {
  tree: createTreeGeometry,
  boulder: createBoulderGeometry,
  stalagmite: createStalagmiteGeometry,
  pillar: createPillarGeometry,
  cactus: createCactusGeometry,
  mangrove: createMangroveGeometry,
  fallen_log: createFallenLogGeometry,
  stump: createStumpGeometry,
  bush: createBushGeometry,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DecorationPropsProps {
  mapData: BattleMapData;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const DecorationProps: React.FC<DecorationPropsProps> = ({ mapData }) => {
  // Group tiles by decoration type
  const decorationGroups = useMemo(() => {
    const groups = new Map<NonNullable<BattleMapDecoration>, { x: number; y: number; elevation: number }[]>();

    for (const [, tile] of mapData.tiles) {
      if (tile.decoration && tile.decoration in PROP_FACTORIES) {
        const dec = tile.decoration as NonNullable<BattleMapDecoration>;
        if (!groups.has(dec)) groups.set(dec, []);
        groups.get(dec)!.push({
          x: tile.coordinates.x,
          y: tile.coordinates.y,
          elevation: tile.elevation,
        });
      }
    }

    return groups;
  }, [mapData]);

  // Same surface formula as the rendered mesh — props sit ON the ground by
  // construction instead of at flat `tile.elevation * ELEVATION_SCALE`, which
  // floated/sank items beside elevation steps (task-71/79 grounding pattern;
  // required once the gap-#28 bluff layer introduced 2-3-step faces).
  const groundSampler = useMemo(() => {
    const { width, height } = mapData.dimensions;
    const grid: (BattleMapTile | null)[][] = [];
    for (let y = 0; y < height; y++) {
      grid[y] = [];
      for (let x = 0; x < width; x++) {
        grid[y][x] = mapData.tiles.get(`${x}-${y}`) ?? null;
      }
    }
    return makeTerrainHeightSampler(grid, width, height, mapData.seed ?? 42);
  }, [mapData]);

  // Build instanced meshes for each decoration type
  const instancedGroups = useMemo(() => {
    const rand = seededRandom(mapData.seed ?? 42);
    const result: {
      key: string;
      parts: {
        geometry: THREE.BufferGeometry;
        material: THREE.Material;
        matrices: Float32Array;
        count: number;
        colors?: Float32Array;
      }[];
    }[] = [];

    // Task 75 (GOAL #49): per-instance variation beyond the original
    // jitter/rotY/uniform-scale. Drawn from a SEPARATE rng stream so the
    // original stream's draw count per instance is unchanged — same seed
    // keeps identical positions/rotations/base scale (clean A/B, no layout
    // churn for existing saves/captures).
    const vrand = seededRandom((mapData.seed ?? 42) + 7575);

    /**
     * Per-instance brightness/warmth tint. Instance colors MULTIPLY the
     * material color in three.js, so tints are neutral values around 1.0 —
     * not pre-multiplied base colors (the earlier helper pre-multiplied and
     * was never wired; this replaces it).
     */
    const buildColorVariations = (count: number): Float32Array => {
      const out = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const brightness = 0.84 + vrand() * 0.32; // ±16% brightness
        const warmth = (vrand() - 0.5) * 0.08;    // slight warm/cool shift
        out[i * 3 + 0] = brightness + warmth;
        out[i * 3 + 1] = brightness;
        out[i * 3 + 2] = brightness - warmth;
      }
      return out;
    };

    /** Helper: build instance matrices for a set of tiles */
    const buildMatrices = (
      tiles: { x: number; y: number; elevation: number }[],
      opts: { tilt: boolean } = { tilt: false },
    ): Float32Array => {
      const matrices = new Float32Array(tiles.length * 16);
      const dummy = new THREE.Object3D();
      for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i];
        const jitterX = (rand() - 0.5) * 2 * POSITION_JITTER;
        const jitterZ = (rand() - 0.5) * 2 * POSITION_JITTER;
        const rotY = rand() * Math.PI * 2;
        const scaleVariation = 0.8 + rand() * 0.4;

        // Silhouette variety: independent width/height multipliers on top of
        // the base scale, so instances read squat/tall/lean instead of being
        // photocopies (GOAL #49 "every instance identical geometry").
        const widthMul = 0.88 + vrand() * 0.26;
        const heightMul = 0.78 + vrand() * 0.5;
        // Natural settling: small random tilt for ground clutter (boulders,
        // stumps, logs); upright props (pillars, cacti) opt out.
        const tiltX = opts.tilt ? (vrand() - 0.5) * 0.22 : 0;
        const tiltZ = opts.tilt ? (vrand() - 0.5) * 0.22 : 0;

        const wx = tile.x * TILE_SIZE + 0.5 * TILE_SIZE + jitterX;
        const wz = tile.y * TILE_SIZE + 0.5 * TILE_SIZE + jitterZ;
        dummy.position.set(wx, groundSampler(wx, wz), wz);
        dummy.rotation.set(tiltX, rotY, tiltZ);
        dummy.scale.set(
          scaleVariation * widthMul,
          scaleVariation * heightMul,
          scaleVariation * widthMul,
        );
        dummy.updateMatrix();
        dummy.matrix.toArray(matrices, i * 16);
      }
      return matrices;
    };

    /** Ground clutter settles at small random tilts; built/living things stay upright. */
    const TILTABLE = new Set<string>(['boulder', 'stump', 'fallen_log', 'stalagmite']);

    for (const [decorationType, tiles] of decorationGroups) {
      // --- Tree tiles are now handled by EzTreeLayer (ez-tree procedural geometry) ---
      // Skip here to avoid double-rendering with the old sphere-based geometry.
      if (decorationType === 'tree') {
        continue;
      }

      // --- Normal (non-tree) decoration handling ---
      const factory = PROP_FACTORIES[decorationType];
      if (!factory) continue;

      const geoSets = factory();
      const matrices = buildMatrices(tiles, { tilt: TILTABLE.has(decorationType) });
      // One tint per INSTANCE, shared by all parts of that instance so a
      // prop's pieces (trunk + top, rock + base) stay color-coherent.
      const colors = buildColorVariations(tiles.length);

      // Swamp dead trees (task 77, GOAL #35): the NORTH_STAR's swamp calls
      // for "murky water, dead trees, hanging moss", but the old dead-tree
      // geometry was unmounted dead code. ~28% of mangrove tiles now render
      // the gnarled dead tree instead. Transforms/tints are built ONCE for
      // all tiles (above) and partitioned by index, so the RNG streams — and
      // therefore every other prop's layout — are byte-identical to before.
      if (decorationType === 'mangrove') {
        const splitRand = seededRandom((mapData.seed ?? 42) + 313);
        const deadIdx: number[] = [];
        const mangIdx: number[] = [];
        tiles.forEach((_, i) => (splitRand() < 0.28 ? deadIdx : mangIdx).push(i));

        const pick = (idx: number[], src: Float32Array, stride: number): Float32Array => {
          const out = new Float32Array(idx.length * stride);
          idx.forEach((srcI, k) => out.set(src.subarray(srcI * stride, (srcI + 1) * stride), k * stride));
          return out;
        };

        if (mangIdx.length > 0) {
          result.push({
            key: 'mangrove',
            parts: geoSets.map(gs => ({
              geometry: gs.geometry,
              material: gs.material,
              matrices: pick(mangIdx, matrices, 16),
              count: mangIdx.length,
              colors: pick(mangIdx, colors, 3),
            })),
          });
        }
        if (deadIdx.length > 0) {
          result.push({
            key: 'mangrove-deadtree',
            parts: createDeadTreeGeometry().map(gs => ({
              geometry: gs.geometry,
              material: gs.material,
              matrices: pick(deadIdx, matrices, 16),
              count: deadIdx.length,
              colors: pick(deadIdx, colors, 3),
            })),
          });
        }
        continue;
      }

      result.push({
        key: decorationType,
        parts: geoSets.map(gs => ({
          geometry: gs.geometry,
          material: gs.material,
          matrices,
          count: tiles.length,
          colors,
        })),
      });
    }

    return result;
  }, [decorationGroups, mapData.seed, groundSampler]);

  return (
    <group>
      {instancedGroups.map(group => (
        <group key={group.key}>
          {group.parts.map((part, partIdx) => (
            <InstancedPropMesh
              key={`${group.key}-${partIdx}`}
              geometry={part.geometry}
              material={part.material}
              matrices={part.matrices}
              count={part.count}
              colors={part.colors}
            />
          ))}
        </group>
      ))}
    </group>
  );
};

// ---------------------------------------------------------------------------
// InstancedPropMesh — applies instance matrices to an InstancedMesh
// ---------------------------------------------------------------------------

const InstancedPropMesh: React.FC<{
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  matrices: Float32Array;
  count: number;
  colors?: Float32Array;
}> = ({ geometry, material, matrices, count, colors }) => {
  const meshRef = React.useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const dummy = new THREE.Matrix4();
    const col = new THREE.Color();

    for (let i = 0; i < count; i++) {
      dummy.fromArray(matrices, i * 16);
      mesh.setMatrixAt(i, dummy);
      if (colors) {
        col.setRGB(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]);
        mesh.setColorAt(i, col);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (colors && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [matrices, count, colors]);

  if (count === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      castShadow
      receiveShadow
      frustumCulled={false}
    />
  );
};

export default DecorationProps;
