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
import React, { useMemo } from 'react';
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
  // Trunk
  const trunk = new THREE.CylinderGeometry(0.06, 0.08, 0.5, 8);
  trunk.translate(0, 0.25, 0);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x5a3a1a,
    roughness: 0.9,
    metalness: 0.0,
  });

  // Canopy (two stacked cones for more natural look)
  const canopy1 = new THREE.ConeGeometry(0.3, 0.5, 8);
  canopy1.translate(0, 0.7, 0);
  const canopy2 = new THREE.ConeGeometry(0.22, 0.4, 8);
  canopy2.translate(0, 0.95, 0);

  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x1a4a1a,
    roughness: 0.8,
    metalness: 0.0,
  });

  // Merge canopies
  const mergedCanopy = mergeGeometries([canopy1, canopy2]);

  return [
    { geometry: trunk, material: trunkMat },
    { geometry: mergedCanopy, material: canopyMat },
  ];
}

function createBoulderGeometry(): PropGeometrySet[] {
  const geo = new THREE.IcosahedronGeometry(0.2, 1);
  // Jitter vertices for organic look
  const positions = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const jitter = 0.03;
    positions.setXYZ(
      i,
      x + (Math.sin(x * 100) * jitter),
      Math.max(0, y * 0.7 + 0.1) + (Math.sin(y * 100) * jitter * 0.5), // Flatten bottom
      z + (Math.sin(z * 100) * jitter),
    );
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0x6a6a6a,
    roughness: 0.85,
    metalness: 0.1,
  });

  return [{ geometry: geo, material: mat }];
}

function createStalagmiteGeometry(): PropGeometrySet[] {
  const geo = new THREE.ConeGeometry(0.12, 0.6, 6);
  geo.translate(0, 0.3, 0);

  const mat = new THREE.MeshStandardMaterial({
    color: 0x5a5a50,
    roughness: 0.9,
    metalness: 0.05,
  });

  return [{ geometry: geo, material: mat }];
}

function createPillarGeometry(): PropGeometrySet[] {
  const geo = new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8);
  geo.translate(0, 0.4, 0);

  // Add a simple capital (top piece)
  const capital = new THREE.CylinderGeometry(0.14, 0.1, 0.08, 8);
  capital.translate(0, 0.8, 0);

  const mat = new THREE.MeshStandardMaterial({
    color: 0x8a8070,
    roughness: 0.7,
    metalness: 0.1,
  });

  const merged = mergeGeometries([geo, capital]);
  return [{ geometry: merged, material: mat }];
}

function createCactusGeometry(): PropGeometrySet[] {
  // Main body
  const body = new THREE.CylinderGeometry(0.08, 0.1, 0.5, 8);
  body.translate(0, 0.25, 0);

  // Arms (simplified as smaller cylinders)
  const armR = new THREE.CylinderGeometry(0.04, 0.05, 0.2, 6);
  armR.rotateZ(-Math.PI / 4);
  armR.translate(0.12, 0.35, 0);

  const armL = new THREE.CylinderGeometry(0.04, 0.05, 0.15, 6);
  armL.rotateZ(Math.PI / 4);
  armL.translate(-0.1, 0.3, 0);

  const mat = new THREE.MeshStandardMaterial({
    color: 0x2a6a2a,
    roughness: 0.8,
    metalness: 0.0,
  });

  const merged = mergeGeometries([body, armR, armL]);
  return [{ geometry: merged, material: mat }];
}

function createMangroveGeometry(): PropGeometrySet[] {
  // Root/trunk — thicker at base
  const trunk = new THREE.CylinderGeometry(0.04, 0.12, 0.4, 6);
  trunk.translate(0, 0.2, 0);

  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x3a2a1a,
    roughness: 0.95,
    metalness: 0.0,
  });

  // Wide, flat canopy
  const canopy = new THREE.SphereGeometry(0.3, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  canopy.scale(1, 0.4, 1);
  canopy.translate(0, 0.5, 0);

  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x1a3a18,
    roughness: 0.85,
    metalness: 0.0,
  });

  return [
    { geometry: trunk, material: trunkMat },
    { geometry: canopy, material: canopyMat },
  ];
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

    for (const [decorationType, tiles] of decorationGroups) {
      const factory = PROP_FACTORIES[decorationType];
      if (!factory) continue;

      const geoSets = factory();
      const count = tiles.length;

      // Build instance matrices (same for all parts of this prop type)
      const matrices = new Float32Array(count * 16);
      const dummy = new THREE.Object3D();

      for (let i = 0; i < count; i++) {
        const tile = tiles[i];
        const jitterX = (rand() - 0.5) * 2 * POSITION_JITTER;
        const jitterZ = (rand() - 0.5) * 2 * POSITION_JITTER;
        const rotY = rand() * Math.PI * 2;
        const scaleVariation = 0.8 + rand() * 0.4; // 80% to 120%

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

      result.push({
        key: decorationType,
        parts: geoSets.map(gs => ({
          geometry: gs.geometry,
          material: gs.material,
          matrices,
          count,
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

  // Apply instance matrices
  useMemo(() => {
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
