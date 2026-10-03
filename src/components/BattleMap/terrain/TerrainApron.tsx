/**
 * @file TerrainApron.tsx — the ground from the edge of the battlefield to the
 * horizon, as ONE mesh.
 *
 * It replaces two things that between them made the combat map look like a
 * diorama: the flat fog-coloured quad `BattleMap3D` parked under everything,
 * and the decorative ridge band that floated on it. Neither continued the
 * terrain; both ENDED, and the far edge of the quad drew the straight line
 * against the sky that Remy circled.
 *
 * Shape: a rectangular annulus — a picture frame — whose inner boundary is
 * exactly the outer boundary of the heightfield's fringe plane, and whose rings
 * step outward with geometrically GROWING spacing. Near the board the rings are
 * about a tile apart; at the far rim they are a hundred tiles apart. That is
 * the LOD: detail where the eye is, almost nothing where the fog is.
 *
 * Height comes from `apronField`, the same function the fringe is built from,
 * so the join is not a blend between two surfaces — it is one surface sampled
 * by two meshes. Colour comes from `terrainSurfaceMaterial`, the same material
 * the board is painted with, for the same reason.
 *
 * Cost is reported live on `window.__bmApron` (dev only) and in the report:
 * one draw call, tens of thousands of triangles, built once per map.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BattleMapData, BattleMapTile } from '../../../types/combat';
import { makeTerrainHeightSampler } from './terrainHeightSampler';
import { FRINGE_TILES, makeApronField } from './apronField';
import { makeTerrainSurfaceMaterial } from './terrainSurfaceMaterial';

const TILE_SIZE = 1.0;

/**
 * Samples around the inner ring's perimeter, held CONSTANT for every ring.
 * The rings grow, so the along-perimeter spacing grows with them — the second
 * half of the LOD, and the reason the triangle count stays flat while the
 * covered area grows by three orders of magnitude.
 *
 * 640 puts the inner ring at roughly 0.8 tiles per sample on the shipped
 * 120x90 board. The apron field's finest term out there has a 20-plus-tile
 * wavelength (see the grain fade in apronField), so a chord that long is
 * sub-millimetre off the fringe it meets.
 */
const PERIMETER_SAMPLES = 640;
/** Radial spacing of the first ring, in tiles. */
const FIRST_RING_STEP = 1.2;
/** Each ring is this much wider than the one before it. */
const RING_GROWTH = 1.12;

/** Offset from the frame centre of the point at perimeter fraction `u`. */
function rectPoint(u: number, ax: number, az: number, out: [number, number]): void {
  const sideX = 2 * ax;
  const sideZ = 2 * az;
  const per = 2 * (sideX + sideZ);
  let s = u * per;
  if (s < sideX) {
    out[0] = -ax + s;
    out[1] = -az;
    return;
  }
  s -= sideX;
  if (s < sideZ) {
    out[0] = ax;
    out[1] = -az + s;
    return;
  }
  s -= sideZ;
  if (s < sideX) {
    out[0] = ax - s;
    out[1] = az;
    return;
  }
  s -= sideX;
  out[0] = -ax;
  out[1] = az - s;
}

export interface ApronBuild {
  geometry: THREE.BufferGeometry;
  rings: number;
  vertices: number;
  triangles: number;
  reachTiles: number;
  buildMs: number;
}

/**
 * Build the apron geometry for one map. Exported so a test can measure it
 * without mounting React or a WebGL context.
 */
export function buildApronGeometry(
  mapData: BattleMapData,
  tileGrid: (BattleMapTile | null)[][],
): ApronBuild {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  const { width, height } = mapData.dimensions;
  const seed = mapData.seed ?? 42;
  const sampler = makeTerrainHeightSampler(tileGrid, width, height, seed);
  const field = makeApronField(mapData, sampler);

  const cx = width / 2;
  const cz = height / 2;
  // The inner boundary IS the fringe plane's outer boundary.
  const innerAX = width / 2 + FRINGE_TILES;
  const innerAZ = height / 2 + FRINGE_TILES;

  // Ring outsets: 0, then geometrically growing steps out to the reach.
  const outsets: number[] = [0];
  let t = 0;
  let step = FIRST_RING_STEP;
  while (t < field.reachTiles) {
    t += step;
    step *= RING_GROWTH;
    outsets.push(t);
  }
  const rings = outsets.length;
  const vertexCount = rings * PERIMETER_SAMPLES;

  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);

  const pt: [number, number] = [0, 0];

  // Pass 1: positions. ONE height evaluation per vertex.
  for (let r = 0; r < rings; r++) {
    const ax = innerAX + outsets[r];
    const az = innerAZ + outsets[r];
    for (let j = 0; j < PERIMETER_SAMPLES; j++) {
      rectPoint(j / PERIMETER_SAMPLES, ax, az, pt);
      const tx = cx + pt[0];
      const tz = cz + pt[1];
      const i = (r * PERIMETER_SAMPLES + j) * 3;
      positions[i] = tx * TILE_SIZE;
      positions[i + 1] = field.heightAt(tx, tz);
      positions[i + 2] = tz * TILE_SIZE;
    }
  }

  /* Pass 2: normals, from the two tangents of THIS mesh — not from finite
   * differences of the height function.
   *
   * The distinction matters here in a way it usually doesn't. The rings are
   * 1.2 tiles apart at the seam and 111 tiles apart at the rim, so the surface
   * the mesh actually draws is a long way from the function it samples. A
   * normal taken from the function would light a slope the geometry does not
   * have, and the outer rings would shade as if they were crumpled when they
   * are in fact wide flat chords. Cross the ring tangent with the perimeter
   * tangent and the normal describes what is on screen.
   *
   * It is also five times cheaper, which is the difference between a 172 ms
   * hitch on map change and a 40 ms one. */
  const at = (r: number, j: number, k: number): number =>
    positions[(r * PERIMETER_SAMPLES + ((j % PERIMETER_SAMPLES) + PERIMETER_SAMPLES) % PERIMETER_SAMPLES) * 3 + k];
  for (let r = 0; r < rings; r++) {
    const rPrev = r > 0 ? r - 1 : r;
    const rNext = r < rings - 1 ? r + 1 : r;
    for (let j = 0; j < PERIMETER_SAMPLES; j++) {
      // Outward tangent (across the rings) and along-perimeter tangent.
      const ox = at(rNext, j, 0) - at(rPrev, j, 0);
      const oy = at(rNext, j, 1) - at(rPrev, j, 1);
      const oz = at(rNext, j, 2) - at(rPrev, j, 2);
      const px = at(r, j + 1, 0) - at(r, j - 1, 0);
      const py = at(r, j + 1, 1) - at(r, j - 1, 1);
      const pz = at(r, j + 1, 2) - at(r, j - 1, 2);
      let nx = oy * pz - oz * py;
      let ny = oz * px - ox * pz;
      let nz = ox * py - oy * px;
      const len = Math.hypot(nx, ny, nz);
      if (len < 1e-12) { nx = 0; ny = 1; nz = 0; } else {
        const s = (ny < 0 ? -1 : 1) / len; // always face the sky
        nx *= s; ny *= s; nz *= s;
      }
      const i = (r * PERIMETER_SAMPLES + j) * 3;
      normals[i] = nx;
      normals[i + 1] = ny;
      normals[i + 2] = nz;
    }
  }

  /* There is no colour pass. The apron is painted by the SAME material the
   * heightfield is (`makeTerrainSurfaceMaterial`), which colours from world XZ
   * and the surface normal — so the two meshes cannot disagree. The first
   * version of this file baked its own palette into vertex colours and the
   * result was geometrically seamless and tonally a hard rectangle around the
   * board, which is the same defect as the cliff wearing different clothes. */

  const quadCount = (rings - 1) * PERIMETER_SAMPLES;
  const indices = new Uint32Array(quadCount * 6);
  let w = 0;
  for (let r = 0; r < rings - 1; r++) {
    const base = r * PERIMETER_SAMPLES;
    const next = base + PERIMETER_SAMPLES;
    for (let j = 0; j < PERIMETER_SAMPLES; j++) {
      const j2 = (j + 1) % PERIMETER_SAMPLES; // wraps — the frame is closed
      const a = base + j;
      const b = base + j2;
      const c = next + j;
      const d = next + j2;
      /* Counter-clockwise seen from +Y. Get this backwards and the faces are
       * back-facing from above; with DoubleSide the shader then NEGATES the
       * normal per fragment and the entire apron loses the sun, rendering as a
       * black plain around a lit board — which is a bigger rectangle than the
       * one this mesh was built to remove. It shipped that way for one capture.
       * `emits triangles wound to face the sky` is the gate. */
      indices[w++] = a; indices[w++] = b; indices[w++] = c;
      indices[w++] = b; indices[w++] = d; indices[w++] = c;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();

  const buildMs = (typeof performance !== 'undefined' ? performance.now() : 0) - t0;
  return {
    geometry,
    rings,
    vertices: vertexCount,
    triangles: quadCount * 2,
    reachTiles: field.reachTiles,
    buildMs,
  };
}

interface TerrainApronProps {
  mapData: BattleMapData;
}

const TerrainApron: React.FC<TerrainApronProps> = ({ mapData }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { width, height } = mapData.dimensions;

  const tileGrid = useMemo(() => {
    const grid: (BattleMapTile | null)[][] = [];
    for (let y = 0; y < height; y++) {
      grid[y] = [];
      for (let x = 0; x < width; x++) {
        grid[y][x] = mapData.tiles.get(`${x}-${y}`) ?? null;
      }
    }
    return grid;
  }, [mapData, width, height]);

  const build = useMemo(() => buildApronGeometry(mapData, tileGrid), [mapData, tileGrid]);

  /* The board's own ground material, in apron mode. Same shader, same noise,
   * same palettes, same scale — the seam with the fringe is invisible because
   * there is nothing there to differ. */
  const surface = useMemo(
    () => makeTerrainSurfaceMaterial(mapData, { apron: true, side: THREE.DoubleSide }),
    [mapData],
  );

  useEffect(() => () => build.geometry.dispose(), [build]);
  useEffect(() => () => surface.dispose(), [surface]);

  // Dev-only cost readout for the headless capture rig — the brief asks for the
  // apron's triangle and draw-call price, and a number nobody can re-measure is
  // not a measurement.
  useEffect(() => {
    if (!import.meta.env?.DEV || typeof window === 'undefined') return;
    (window as unknown as { __bmApron?: unknown }).__bmApron = {
      rings: build.rings,
      vertices: build.vertices,
      triangles: build.triangles,
      reachTiles: build.reachTiles,
      buildMs: build.buildMs,
      drawCalls: 1,
      /* Toggle the mesh in the LIVE scene. A page reload regenerates the board,
       * so an on/off comparison across a reload measures two different scenes;
       * this measures one. Pair it with `__bm3dCam.renderTiming()`. */
      visible(on: boolean) {
        const m = meshRef.current;
        if (!m) return false;
        m.visible = on;
        return true;
      },
    };
    return () => { delete (window as unknown as { __bmApron?: unknown }).__bmApron; };
  }, [build]);

  return (
    /* DoubleSide (set on the material) is the safety net item 3 asks for, and
     * it is free: the same triangles, the same draw call, no skirt geometry and
     * no duplicated faces — which is how the gates and walls chipped open, see
     * the DoubleSide both-windings z-fight note. A camera that ends up under
     * the ground sees ground, not through it. It is a net, not the answer: the
     * answer is that there is no edge to fall off. */
    <mesh
      ref={meshRef}
      name="terrain-apron"
      geometry={build.geometry}
      material={surface.material}
      castShadow={false}
      receiveShadow={false}
      /* The backdrop must never swallow a tile click or an AoE hover. */
      raycast={() => null}
    />
  );
};

export default TerrainApron;
