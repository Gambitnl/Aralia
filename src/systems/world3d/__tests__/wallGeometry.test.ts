import { describe, it, expect } from 'vitest';
import { buildWallMesh } from '../wallGeometry';
import type { ChunkData } from '../types';

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
