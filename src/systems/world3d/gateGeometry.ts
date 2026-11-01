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
const WALL_TOP_M = 4.8;      // the rampart's top over its ground (wallGeometry.WALL_HEIGHT_M 5.2 less its 0.4 m footing)
// Water gate: the wall over the river starts this far above the lower bank, so
// the opening reaches from the water (about 1.5 m under the bank) to here.
const WATER_GATE_OPENING_ABOVE_BANK_M = 0.6;
const GRILLE_SPACING_M = 0.9; // iron bars of the water gate's grille
const GRILLE_BAR_M = 0.09;
const GRILLE_RGB: [number, number, number] = [0.16, 0.15, 0.14];

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
    // Each face gets its own four vertices with its OUTWARD normal, wound once
    // to face out (agora-257c, 2026-10-28). Every vertex used to carry (0,1,0),
    // so each tower side lit as if it faced the sky and the gates drew near
    // white beside the tan wall; and every face was emitted in both windings,
    // the coplanar-duplicate trap that blackened the deck tops (deckGeometry).
    const top = baseY + h;
    const face = (p: Array<[number, number, number]>, n: [number, number, number]) => {
      const start = positions.length / 3;
      for (const v of p) { positions.push(...v); normals.push(...n); colors.push(...color); }
      // Wind so the geometric normal agrees with n: (b - a) x (c - a) . n > 0.
      const [a, b, cc] = p;
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = cc[0] - a[0], vy = cc[1] - a[1], vz = cc[2] - a[2];
      const dot = (uy * vz - uz * vy) * n[0] + (uz * vx - ux * vz) * n[1] + (ux * vy - uy * vx) * n[2];
      if (dot >= 0) indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
      else indices.push(start, start + 2, start + 1, start, start + 3, start + 2);
    };
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i];
      const [bx, bz] = corners[(i + 1) % 4];
      // Outward: the edge's perpendicular pointing away from the box center.
      let nx = bz - az, nz = -(bx - ax);
      const len = Math.hypot(nx, nz) || 1;
      nx /= len; nz /= len;
      if (nx * ((ax + bx) / 2 - cx) + nz * ((az + bz) / 2 - cz) < 0) { nx = -nx; nz = -nz; }
      face([[ax, baseY, az], [bx, baseY, bz], [bx, top, bz], [ax, top, az]], [nx, 0, nz]);
    }
    face(corners.map(([x, z]) => [x, top, z] as [number, number, number]), [0, 1, 0]);
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
    } else if (g.form === 'waterGate') {
      // A WATER GATE (agora-257c, 2026-10-28): where a river passes under the
      // town wall, the wall runs on over the water instead of stopping. The
      // gate point is the river's centerline, so the ground there is the bed:
      // each tower stands on its own bank, and the wall section over the water
      // starts above the LOWER bank, leaving an opening down to the water, with
      // an iron grille in it. Heights follow the rampart (WALL_HEIGHT_M 3.2).
      const bankY: number[] = [];
      for (const side of [-1, 1]) {
        const [tx, tz] = along(side * off);
        const ground = heightAtLocal(data, tx, tz);
        bankY.push(ground);
        pushBox(tx, tz, ground - BASE_SINK_M, TOWER_SIDE_M, TOWER_H_M, TOWER_SIDE_M, g.angleRad, color);
      }
      const lowBank = Math.min(bankY[0], bankY[1]);
      const spanW = off * 2 - TOWER_SIDE_M;
      const archTop = lowBank + WATER_GATE_OPENING_ABOVE_BANK_M;
      pushBox(local.x, local.z, archTop, spanW, WALL_TOP_M - WATER_GATE_OPENING_ABOVE_BANK_M, 1.2, g.angleRad, color);
      // The grille: bars from the river bed up into the wall section.
      const bedY = heightAt(data, g.x, g.y);
      const bars = Math.max(3, Math.floor(spanW / GRILLE_SPACING_M));
      for (let k = 1; k < bars; k++) {
        const [bx, bz] = along(-spanW / 2 + (spanW * k) / bars);
        pushBox(bx, bz, bedY - BASE_SINK_M, GRILLE_BAR_M, archTop - bedY + BASE_SINK_M + 0.2, GRILLE_BAR_M, g.angleRad, GRILLE_RGB);
      }
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
/** Ground height at a CHUNK-LOCAL point, meters (inverse of gridPointToLocal). */
function heightAtLocal(data: ChunkData, lx: number, lz: number): number {
  const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;
  const M = WORLD3D_CONFIG.METERS_PER_CELL;
  return heightAt(data, (lx + data.cx * S) / M, (lz + data.cy * S) / M);
}

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
