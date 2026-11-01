import { describe, it, expect } from 'vitest';
import { buildWallMesh } from '../wallGeometry';
import type { ChunkData } from '../types';
import { WORLD3D_CONFIG, heightToMeters } from '../config';
import { gridPointToLocal } from '../coords';

const baseChunk = (): ChunkData => ({
  cx: 0,
  cy: 0,
  resolution: 4,
  heights: new Float32Array(16).fill(50),
  biomeIds: new Array(16).fill('plains'),
  rivers: [],
  roads: [],
  sites: [],
});

const run = (colorHex?: string) => ({
  points: [{ x: 0.5, y: 0.5 }, { x: 1.5, y: 0.5 }, { x: 1.5, y: 1.5 }],
  width: [0.1, 0.1, 0.1],
  colorHex,
});

describe('buildWallMesh', () => {
  it('builds a closed rampart with outward normals, a 2.4 m thickness and 4.8 m exposed height', () => {
    const mesh = buildWallMesh({ ...baseChunk(), walls: [{ points: [{ x: 0.01, y: 0.05 }, { x: 0.1, y: 0.05 }], width: [0.1,0.1] }] });
    const ys = Array.from(mesh.positions).filter((_,i) => i % 3 === 1);
    const zs = Array.from(mesh.positions).filter((_,i) => i % 3 === 2);
    expect(Math.max(...ys) - heightToMeters(50)).toBeCloseTo(4.8, 4);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(2.4, 4);
    expect(mesh.indices.length).toBe(36);
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const dy = mesh.positions[i+1] - (Math.min(...ys)+Math.max(...ys))/2;
      const dz = mesh.positions[i+2] - (Math.min(...zs)+Math.max(...zs))/2;
      if (Math.abs(mesh.normals[i+1]) > 0.9) expect(dy * mesh.normals[i+1]).toBeGreaterThan(0);
      if (Math.abs(mesh.normals[i+2]) > 0.9) expect(dz * mesh.normals[i+2]).toBeGreaterThan(0);
    }
  });
  it('returns empty geometry (including colors) when there are no walls', () => {
    const mesh = buildWallMesh(baseChunk());
    expect(mesh.positions).toHaveLength(0);
    expect(mesh.colors).toHaveLength(0);
  });

  it('emits per-vertex colors parallel to positions', () => {
    const mesh = buildWallMesh({ ...baseChunk(), walls: [run('#7a4030')] });
    expect(mesh.positions.length).toBeGreaterThan(0);
    expect(mesh.colors.length).toBe(mesh.positions.length);
    expect(mesh.normals.length).toBe(mesh.positions.length);
    // First vertex carries the run's tint (#7a4030).
    expect(mesh.colors[0]).toBeCloseTo(0x7a / 255, 6);
    expect(mesh.colors[1]).toBeCloseTo(0x40 / 255, 6);
    expect(mesh.colors[2]).toBeCloseTo(0x30 / 255, 6);
  });

  it('falls back to the legacy weathered-stone tint when a run has no colorHex', () => {
    const mesh = buildWallMesh({ ...baseChunk(), walls: [run(undefined)] });
    expect(mesh.colors.length).toBe(mesh.positions.length);
    // #9a9387 — the tint WallPiece used to hardcode on its material.
    expect(mesh.colors[0]).toBeCloseTo(0x9a / 255, 6);
    expect(mesh.colors[1]).toBeCloseTo(0x93 / 255, 6);
    expect(mesh.colors[2]).toBeCloseTo(0x87 / 255, 6);
  });
});

// agora-257c (2026-10-28): a bend is one mitered join, not two boxes.
describe('wall corners', () => {
  it('meets at a right-angle bend on two shared corner posts, outer and inner', () => {
    const mesh = buildWallMesh({ ...baseChunk(), walls: [run('#7a4030')] });
    const M = WORLD3D_CONFIG.METERS_PER_CELL;
    const c = gridPointToLocal(1.5, 0.5, 0, 0);
    const near = new Set<string>();
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const x = mesh.positions[i], z = mesh.positions[i + 2];
      if (Math.hypot(x - c.x, z - c.z) < 1.2 * Math.SQRT2 + 0.01 && Math.hypot(x - c.x, z - c.z) > 0.5) {
        near.add(`${x.toFixed(3)},${z.toFixed(3)}`);
      }
    }
    // Separate boxes put four corners here; a miter puts exactly two.
    expect(near.size).toBe(2);
    expect(M).toBeGreaterThan(0);
  });
});
