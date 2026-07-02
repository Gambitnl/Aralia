/**
 * @file gateGeometry.ts
 * Procedural gatehouse models at town road-gate openings (styled-architecture
 * slice, 2026-07-01). Assembled from oriented boxes into one vertex-colored
 * mesh per chunk — same transferable-arrays contract as wallGeometry/deckGeometry.
 */
import type { ChunkData, ChunkGeometryArrays } from './types';
import { WORLD3D_CONFIG, heightToMeters } from './config';
import { gridPointToLocal } from './coords';

const TOWER_H_M = 5.5;       // rises above the 3.2 m rampart (wallGeometry.WALL_HEIGHT_M)
const TOWER_SIDE_M = 3;
const LINTEL_H_M = 1.2;      // beam spanning over the gap
const TUNNEL_DEPTH_M = 5;    // tunnelBlock: extent along the road
const BASE_SINK_M = 0.4;     // footing sink, matches the wall

type GateMesh = ChunkGeometryArrays & { colors: Float32Array };

export function buildGateMesh(data: ChunkData): GateMesh {
  const gates = data.gatehouses ?? [];
  const positions: number[] = [], indices: number[] = [], normals: number[] = [], colors: number[] = [];
  const rgb = (hex: string): [number, number, number] => [
    parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255,
  ];

  /** Push a box centered at (cx, cz), base at baseY, yawed by ang. */
  const pushBox = (cx: number, cz: number, baseY: number, w: number, h: number, d: number, ang: number, color: [number, number, number]) => {
    const c = Math.cos(ang), s = Math.sin(ang);
    const corners: Array<[number, number]> = ([[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]] as Array<[number, number]>)
      .map(([x, z]) => [cx + x * c - z * s, cz + x * s + z * c]);
    const base = positions.length / 3;
    for (const y of [baseY, baseY + h]) {
      for (const [x, z] of corners) { positions.push(x, y, z); normals.push(0, 1, 0); colors.push(...color); }
    }
    // 4 sides + top, both windings (no back-face culling artifacts, matches wallGeometry).
    const quad = (a: number, b: number, cc: number, dd: number) => {
      indices.push(a, b, cc, cc, dd, a, cc, b, a, a, dd, cc);
    };
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      quad(base + i, base + j, base + 4 + j, base + 4 + i);
    }
    quad(base + 4, base + 5, base + 6, base + 7); // top
  };

  for (const g of gates) {
    const local = gridPointToLocal(g.x, g.y, data.cx, data.cy);
    const baseY = heightAt(data, g.x, g.y) - BASE_SINK_M;
    const color = rgb(g.colorHex);
    const along = (dist: number): [number, number] =>
      [local.x + Math.cos(g.angleRad) * dist, local.z + Math.sin(g.angleRad) * dist];
    const off = g.gapHalfM + TOWER_SIDE_M / 2;

    if (g.form === 'twinTowers') {
      for (const side of [-1, 1]) {
        const [tx, tz] = along(side * off);
        pushBox(tx, tz, baseY, TOWER_SIDE_M, TOWER_H_M, TOWER_SIDE_M, g.angleRad, color);
      }
      pushBox(local.x, local.z, baseY + TOWER_H_M - LINTEL_H_M, off * 2 + TOWER_SIDE_M, LINTEL_H_M, 1.2, g.angleRad, color);
    } else if (g.form === 'singleTower') {
      const [tx, tz] = along(off);
      pushBox(tx, tz, baseY, TOWER_SIDE_M + 1, TOWER_H_M, TOWER_SIDE_M + 1, g.angleRad, color);
    } else { // tunnelBlock: two jamb walls along the road + a roof slab over the gap
      const jambOff = g.gapHalfM + 0.8;
      for (const side of [-1, 1]) {
        const [jx, jz] = along(side * jambOff);
        pushBox(jx, jz, baseY, 1.6, TOWER_H_M - 1, TUNNEL_DEPTH_M, g.angleRad + Math.PI / 2, color);
      }
      pushBox(local.x, local.z, baseY + TOWER_H_M - 1, jambOff * 2 + 1.6, 1.4, TUNNEL_DEPTH_M, g.angleRad, color);
    }
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
    normals: new Float32Array(normals),
    colors: new Float32Array(colors),
  };
}

// Same nearest-vertex terrain sampler as wallGeometry.heightAt (deliberately
// duplicated — both files keep their samplers private and parallel).
function heightAt(data: ChunkData, gx: number, gy: number): number {
  const res = data.resolution;
  const span = WORLD3D_CONFIG.CHUNK_WORLD_SIZE / WORLD3D_CONFIG.METERS_PER_CELL;
  const minGX = data.cx * span, minGY = data.cy * span;
  const tx = span === 0 ? 0 : (gx - minGX) / span;
  const ty = span === 0 ? 0 : (gy - minGY) / span;
  const i = Math.max(0, Math.min(res - 1, Math.round(tx * (res - 1))));
  const j = Math.max(0, Math.min(res - 1, Math.round(ty * (res - 1))));
  return heightToMeters(data.heights[j * res + i]);
}
