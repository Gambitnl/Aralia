/**
 * @file GroundScatter.tsx
 * Small ground-level scatter objects that fill open tiles with visual interest.
 *
 * Generates instanced meshes for:
 * - Small rock clusters (2-4 pebbles merged)
 * - Fallen leaves (flat quads with slight curl)
 * - Twig bundles (thin cylinders at angles)
 * - Mushroom patches (tiny spheres on stems)
 *
 * Placement strategy:
 * - 4-8 scatter objects per open grass tile
 * - Skip tiles with decorations (trees, boulders already fill them)
 * - Reduced density near tile edges for natural transition
 * - Seeded random for deterministic placement
 *
 * Performance: ~3000-5000 instances total, split across 4 InstancedMeshes.
 * Single draw call per scatter type.
 *
 * @see docs/superpowers/specs/2026-05-21-3d-combat-map-design.md
 */
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BattleMapData, BattleMapTile } from '../../../types/combat';
import { makeTerrainHeightSampler } from './TerrainMesh';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TILE_SIZE = 1.0;
const SCATTER_PER_TILE = 6;

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
// Scatter geometry factories
// ---------------------------------------------------------------------------

/** Small cluster of 2-3 pebbles */
function createPebbleGeometry(): THREE.BufferGeometry {
  const pebble1 = new THREE.SphereGeometry(0.04, 6, 4);
  pebble1.scale(1.2, 0.6, 1.0);
  pebble1.translate(0, 0.02, 0);

  const pebble2 = new THREE.SphereGeometry(0.03, 5, 3);
  pebble2.scale(1.0, 0.55, 1.1);
  pebble2.translate(0.05, 0.015, 0.03);

  const pebble3 = new THREE.SphereGeometry(0.025, 5, 3);
  pebble3.scale(1.1, 0.5, 0.9);
  pebble3.translate(-0.03, 0.012, -0.02);

  return mergeGeometries([pebble1, pebble2, pebble3]);
}

/** Flat fallen leaf — slight curl via vertex displacement */
function createLeafGeometry(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(0.08, 0.06, 2, 2);
  // Curl the leaf slightly
  const positions = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    // Lift edges
    const curl = Math.abs(x) * 0.3 + Math.abs(y) * 0.15;
    positions.setZ(i, curl);
  }
  geo.rotateX(-Math.PI / 2.2); // Mostly flat on ground
  geo.translate(0, 0.01, 0);
  geo.computeVertexNormals();
  return geo;
}

/** Small twig bundle — 2 thin cylinders at angles */
function createTwigGeometry(): THREE.BufferGeometry {
  const twig1 = new THREE.CylinderGeometry(0.005, 0.007, 0.12, 3);
  twig1.rotateZ(0.2);
  twig1.rotateX(Math.PI / 2 - 0.1);
  twig1.translate(0, 0.005, 0);

  const twig2 = new THREE.CylinderGeometry(0.004, 0.006, 0.09, 3);
  twig2.rotateZ(-0.3);
  twig2.rotateX(Math.PI / 2 + 0.15);
  twig2.translate(0.02, 0.004, 0.01);

  return mergeGeometries([twig1, twig2]);
}

/** Tiny mushroom — sphere cap on thin stem */
function createMushroomGeometry(): THREE.BufferGeometry {
  const stem = new THREE.CylinderGeometry(0.008, 0.01, 0.04, 5);
  stem.translate(0, 0.02, 0);

  const cap = new THREE.SphereGeometry(0.02, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  cap.scale(1, 0.6, 1);
  cap.translate(0, 0.04, 0);

  return mergeGeometries([stem, cap]);
}

/** Simple geometry merge */
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
// Scatter type definitions
// ---------------------------------------------------------------------------

interface ScatterType {
  name: string;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  /** Weight for random selection (higher = more common) */
  weight: number;
}

function createScatterTypes(): ScatterType[] {
  return [
    {
      name: 'pebbles',
      geometry: createPebbleGeometry(),
      material: new THREE.MeshStandardMaterial({
        color: 0x6a6a60,
        roughness: 0.9,
        metalness: 0.05,
      }),
      weight: 3,
    },
    {
      name: 'leaf',
      geometry: createLeafGeometry(),
      material: new THREE.MeshStandardMaterial({
        color: 0x8a6a30,
        roughness: 0.9,
        metalness: 0.0,
        side: THREE.DoubleSide,
      }),
      weight: 4,
    },
    {
      name: 'twig',
      geometry: createTwigGeometry(),
      material: new THREE.MeshStandardMaterial({
        color: 0x5a4020,
        roughness: 0.95,
        metalness: 0.0,
      }),
      weight: 2,
    },
    {
      name: 'mushroom',
      geometry: createMushroomGeometry(),
      material: new THREE.MeshStandardMaterial({
        color: 0xc8a080,
        roughness: 0.8,
        metalness: 0.0,
      }),
      weight: 1,
    },
  ];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface GroundScatterProps {
  mapData: BattleMapData;
}

const GroundScatter: React.FC<GroundScatterProps> = ({ mapData }) => {
  const scatterTypes = useMemo(() => createScatterTypes(), []);

  // Collect open grass tiles (no decoration)
  const openTiles = useMemo(() => {
    const tiles: { x: number; y: number; elevation: number }[] = [];
    for (const [, tile] of mapData.tiles) {
      if (
        (tile.terrain === 'grass' || tile.terrain === 'difficult') &&
        !tile.decoration
      ) {
        tiles.push({
          x: tile.coordinates.x,
          y: tile.coordinates.y,
          elevation: tile.elevation,
        });
      }
    }
    return tiles;
  }, [mapData]);

  // The same surface formula the terrain mesh renders (bicubic blend + micro
  // noise + water carve) — items sit ON the rendered ground by construction.
  // Flat `tile.elevation * ELEVATION_SCALE` floated/sank items near elevation
  // steps (up to ~0.45u beside a 3-step neighbor — many pebble-heights).
  // GOAL #24 / the gap #27 class; mirrors the task-71 actor-grounding fix.
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

  // Build instance data per scatter type
  const scatterInstances = useMemo(() => {
    const rand = seededRandom((mapData.seed ?? 42) + 33333);
    const totalWeight = scatterTypes.reduce((s, t) => s + t.weight, 0);

    // Pre-allocate matrices per type (we'll trim after)
    const maxPerType = openTiles.length * SCATTER_PER_TILE;
    const matricesPerType: Float32Array[] = scatterTypes.map(
      () => new Float32Array(maxPerType * 16),
    );
    const countsPerType = new Array(scatterTypes.length).fill(0);

    const dummy = new THREE.Object3D();

    for (const tile of openTiles) {
      // Vary scatter count per tile (4-8)
      const count = 4 + Math.floor(rand() * 5);

      for (let i = 0; i < count; i++) {
        // Weighted random type selection
        let r = rand() * totalWeight;
        let typeIdx = 0;
        for (let t = 0; t < scatterTypes.length; t++) {
          r -= scatterTypes[t].weight;
          if (r <= 0) { typeIdx = t; break; }
        }

        const offsetX = 0.1 + rand() * 0.8; // Keep away from exact edges
        const offsetZ = 0.1 + rand() * 0.8;
        const rotY = rand() * Math.PI * 2;
        const scale = 0.6 + rand() * 0.8;

        const wx = tile.x * TILE_SIZE + offsetX;
        const wz = tile.y * TILE_SIZE + offsetZ;
        dummy.position.set(wx, groundSampler(wx, wz), wz);
        dummy.rotation.set(0, rotY, 0);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();

        const idx = countsPerType[typeIdx];
        dummy.matrix.toArray(matricesPerType[typeIdx], idx * 16);
        countsPerType[typeIdx]++;
      }
    }

    // Trim arrays to actual size
    return scatterTypes.map((st, i) => ({
      type: st,
      matrices: matricesPerType[i].slice(0, countsPerType[i] * 16),
      count: countsPerType[i],
    }));
  }, [openTiles, mapData.seed, scatterTypes, groundSampler]);

  return (
    <group>
      {scatterInstances.map(({ type, matrices, count }) =>
        count > 0 ? (
          <ScatterInstancedMesh
            key={type.name}
            geometry={type.geometry}
            material={type.material}
            matrices={matrices}
            count={count}
          />
        ) : null,
      )}
    </group>
  );
};

// ---------------------------------------------------------------------------
// ScatterInstancedMesh
// ---------------------------------------------------------------------------

const ScatterInstancedMesh: React.FC<{
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  matrices: Float32Array;
  count: number;
}> = ({ geometry, material, matrices, count }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

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
      receiveShadow
      frustumCulled={false}
    />
  );
};

export default GroundScatter;
