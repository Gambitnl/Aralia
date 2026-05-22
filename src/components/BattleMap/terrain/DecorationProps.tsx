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
import { BattleMapData, BattleMapDecoration } from '../../../types/combat';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TILE_SIZE = 1.0;
const ELEVATION_SCALE = 0.3;
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

/** Dead/bare tree — trunk with angled branches, no canopy */
function createDeadTreeGeometry(): PropGeometrySet[] {
  const trunk = new THREE.CylinderGeometry(0.05, 0.12, 1.4, 6);
  trunk.translate(0, 0.7, 0);
  const branch1 = new THREE.CylinderGeometry(0.02, 0.04, 0.5, 4);
  branch1.rotateZ(-0.7);
  branch1.translate(0.25, 1.1, 0);
  const branch2 = new THREE.CylinderGeometry(0.02, 0.03, 0.4, 4);
  branch2.rotateZ(0.5);
  branch2.translate(-0.18, 0.9, 0.1);
  const branch3 = new THREE.CylinderGeometry(0.015, 0.03, 0.35, 4);
  branch3.rotateX(0.6);
  branch3.translate(0.05, 1.2, -0.2);

  const mat = new THREE.MeshStandardMaterial({
    color: 0x4a3520, roughness: 0.9, metalness: 0.0,
  });

  return [{ geometry: mergeGeometries([trunk, branch1, branch2, branch3]), material: mat }];
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
  const geo = new THREE.CylinderGeometry(0.14, 0.16, 1.4, 8);
  geo.translate(0, 0.7, 0);

  // Add a simple capital (top piece)
  const capital = new THREE.CylinderGeometry(0.2, 0.14, 0.1, 8);
  capital.translate(0, 1.4, 0);

  // Base
  const base = new THREE.CylinderGeometry(0.16, 0.2, 0.1, 8);
  base.translate(0, 0.05, 0);

  const mat = new THREE.MeshStandardMaterial({
    color: 0x8a8070,
    roughness: 0.7,
    metalness: 0.1,
  });

  const merged = mergeGeometries([base, geo, capital]);
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

/** Bush — cluster of small spheres close to the ground */
function createBushGeometry(): PropGeometrySet[] {
  const s1 = new THREE.SphereGeometry(0.25, 8, 6);
  s1.translate(0, 0.22, 0);
  const s2 = new THREE.SphereGeometry(0.2, 7, 5);
  s2.translate(0.15, 0.18, 0.1);
  const s3 = new THREE.SphereGeometry(0.18, 7, 5);
  s3.translate(-0.12, 0.16, -0.08);
  const s4 = new THREE.SphereGeometry(0.15, 6, 4);
  s4.translate(0.05, 0.32, -0.05);

  const mat = new THREE.MeshStandardMaterial({
    color: 0x2a5a1a,
    roughness: 0.85,
    metalness: 0.0,
  });

  return [{ geometry: mergeGeometries([s1, s2, s3, s4]), material: mat }];
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
      }[];
    }[] = [];

    /** Helper: build instance matrices for a set of tiles */
    const buildMatrices = (
      tiles: { x: number; y: number; elevation: number }[],
    ): Float32Array => {
      const matrices = new Float32Array(tiles.length * 16);
      const dummy = new THREE.Object3D();
      for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i];
        const jitterX = (rand() - 0.5) * 2 * POSITION_JITTER;
        const jitterZ = (rand() - 0.5) * 2 * POSITION_JITTER;
        const rotY = rand() * Math.PI * 2;
        const scaleVariation = 0.8 + rand() * 0.4;

        dummy.position.set(
          tile.x * TILE_SIZE + 0.5 * TILE_SIZE + jitterX,
          tile.elevation * ELEVATION_SCALE,
          tile.y * TILE_SIZE + 0.5 * TILE_SIZE + jitterZ,
        );
        dummy.rotation.set(0, rotY, 0);
        dummy.scale.setScalar(scaleVariation);
        dummy.updateMatrix();
        dummy.matrix.toArray(matrices, i * 16);
      }
      return matrices;
    };

    for (const [decorationType, tiles] of decorationGroups) {
      // --- Tree variant handling: split tiles across 2-4 species ---
      if (decorationType === 'tree') {
        const variantRand = seededRandom((mapData.seed ?? 42) + 12345);
        // Weighted random: oak 40%, pine 25%, wide 25%, dead 10%
        const buckets: { x: number; y: number; elevation: number }[][] = TREE_VARIANTS.map(() => []);
        for (const tile of tiles) {
          const r = variantRand();
          const v = r < 0.40 ? 0 : r < 0.65 ? 1 : r < 0.90 ? 2 : 3;
          buckets[v].push(tile);
        }

        for (let v = 0; v < TREE_VARIANTS.length; v++) {
          if (buckets[v].length === 0) continue;
          const geoSets = TREE_VARIANTS[v]();
          const matrices = buildMatrices(buckets[v]);
          result.push({
            key: `tree-v${v}`,
            parts: geoSets.map(gs => ({
              geometry: gs.geometry,
              material: gs.material,
              matrices,
              count: buckets[v].length,
            })),
          });
        }
        continue;
      }

      // --- Normal (non-tree) decoration handling ---
      const factory = PROP_FACTORIES[decorationType];
      if (!factory) continue;

      const geoSets = factory();
      const matrices = buildMatrices(tiles);

      result.push({
        key: decorationType,
        parts: geoSets.map(gs => ({
          geometry: gs.geometry,
          material: gs.material,
          matrices,
          count: tiles.length,
        })),
      });
    }

    return result;
  }, [decorationGroups, mapData.seed]);

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
}> = ({ geometry, material, matrices, count }) => {
  const meshRef = React.useRef<THREE.InstancedMesh>(null);

  // Apply instance matrices — useEffect (not useMemo) so meshRef.current is assigned
  useEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const dummy = new THREE.Matrix4();

    for (let i = 0; i < count; i++) {
      dummy.fromArray(matrices, i * 16);
      mesh.setMatrixAt(i, dummy);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [matrices, count]);

  if (count === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      castShadow
      receiveShadow
      frustumCulled
    />
  );
};

export default DecorationProps;
