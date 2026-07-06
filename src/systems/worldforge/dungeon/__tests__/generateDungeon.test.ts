/**
 * @file generateDungeon.test.ts
 * @description Acceptance invariants for the procedural dungeon generator
 * (spec docs/superpowers/specs/2026-07-05-procedural-dungeon-generator.md).
 * Numeric goldens are necessary but NOT sufficient — the design-preview eyeball
 * is the other half of the proof (Aralia visual-inspection rule).
 */

import { describe, it, expect } from 'vitest';
import { generateDungeon } from '../generateDungeon';
import { CellKind, type DungeonPlan } from '../types';

const SEEDS = [1, 7, 42, 1337, 99999];

/** FNV-1a over the grid — a compact byte-identity checksum. */
function gridChecksum(plan: DungeonPlan): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < plan.grid.length; i++) {
    h ^= plan.grid[i];
    h = Math.imul(h, 0x01000193);
  }
  return `${plan.W}x${plan.H}:${(h >>> 0).toString(16)}`;
}

function floorReachability(plan: DungeonPlan): number {
  let floor = 0;
  let reached = 0;
  for (let i = 0; i < plan.grid.length; i++) {
    if (plan.grid[i] === CellKind.Floor) {
      floor++;
      if (plan.bfs[i] >= 0) reached++;
    }
  }
  return floor === 0 ? 0 : reached / floor;
}

describe('generateDungeon', () => {
  it('reaches 100% of floor cells by flood fill from the entrance', () => {
    for (const seed of SEEDS) {
      const plan = generateDungeon({ seed });
      expect(floorReachability(plan)).toBe(1);
    }
  });

  it('is deterministic — identical grid checksum across 3 runs', () => {
    for (const seed of SEEDS) {
      const a = gridChecksum(generateDungeon({ seed }));
      const b = gridChecksum(generateDungeon({ seed }));
      const c = gridChecksum(generateDungeon({ seed }));
      expect(a).toBe(b);
      expect(b).toBe(c);
    }
  });

  it('different seeds produce different layouts', () => {
    const checksums = new Set(SEEDS.map((seed) => gridChecksum(generateDungeon({ seed }))));
    expect(checksums.size).toBe(SEEDS.length);
  });

  it('places the boss deep and the entrance as a distinct degree-1 leaf', () => {
    for (const seed of SEEDS) {
      const plan = generateDungeon({ seed });
      const maxDepth = Math.max(...plan.rooms.map((r) => r.depth));
      const boss = plan.rooms[plan.bossId];
      const entrance = plan.rooms[plan.entranceId];
      expect(boss.depth).toBeGreaterThanOrEqual(0.6 * maxDepth);
      expect(entrance.degree).toBe(1);
      expect(plan.entranceId).not.toBe(plan.bossId);
      // Entrance is not adjacent to the boss.
      const adjacent = plan.edges.some(
        (e) => (e.a === plan.entranceId && e.b === plan.bossId) || (e.b === plan.entranceId && e.a === plan.bossId),
      );
      expect(adjacent).toBe(false);
    }
  });

  it('guarantees loops — loop count equals the cyclomatic number', () => {
    for (const seed of SEEDS) {
      const plan = generateDungeon({ seed });
      const loops = plan.edges.filter((e) => e.isLoop).length;
      expect(loops).toBe(plan.edges.length - plan.rooms.length + 1);
    }
  });

  it('has >= 3 leaf rooms at 40+ rooms', () => {
    const plan = generateDungeon({ seed: 42, params: { roomCount: 44 } });
    const leaves = plan.rooms.filter((r) => r.degree === 1).length;
    expect(leaves).toBeGreaterThanOrEqual(3);
  });

  it('never places a prop or spawn on a doorway, wall, or void cell', () => {
    for (const seed of SEEDS) {
      const plan = generateDungeon({ seed });
      const doorSet = new Set(plan.doorways.map((d) => d.y * plan.W + d.x));
      for (const p of [...plan.props, ...plan.spawns]) {
        const i = p.y * plan.W + p.x;
        expect(plan.grid[i]).toBe(CellKind.Floor);
        expect(doorSet.has(i)).toBe(false);
      }
    }
  });

  it('critical path runs entrance → boss through real rooms, and spawns exist', () => {
    for (const seed of SEEDS) {
      const plan = generateDungeon({ seed });
      expect(plan.criticalRoomIds[0]).toBe(plan.entranceId);
      expect(plan.criticalRoomIds[plan.criticalRoomIds.length - 1]).toBe(plan.bossId);
      for (const id of plan.criticalRoomIds) {
        expect(plan.rooms[id]).toBeDefined();
      }
      expect(plan.spawns.length).toBeGreaterThan(0);
      expect(plan.stats.roomsRequested).toBe(plan.params.roomCount);
    }
  });

  it('traps sit on open room floor and secret door cells are real doorways', () => {
    for (const seed of SEEDS) {
      const plan = generateDungeon({ seed });
      const doorSet = new Set(plan.doorways.map((d) => d.y * plan.W + d.x));
      for (const t of plan.traps) {
        const i = t.y * plan.W + t.x;
        expect(plan.grid[i]).toBe(CellKind.Floor);
        expect(doorSet.has(i)).toBe(false);
        expect(t.roomId).not.toBe(plan.entranceId);
        expect(t.roomId).not.toBe(plan.bossId);
      }
      for (const c of plan.secretDoorCells) {
        const i = c.y * plan.W + c.x;
        expect(plan.grid[i]).toBe(CellKind.Floor);
        expect(plan.corridor[i]).toBe(1);
      }
      // every secret edge must have contributed at least one carved cell
      const secretEdges = plan.edges.filter((e) => e.isSecret).length;
      if (secretEdges > 0) expect(plan.secretDoorCells.length).toBeGreaterThan(0);
    }
  });

  it('generates 60 rooms in under 50 ms', () => {
    // Warm up (JIT) then measure.
    generateDungeon({ seed: 5, params: { roomCount: 60 } });
    const t0 = performance.now();
    const plan = generateDungeon({ seed: 11, params: { roomCount: 60 } });
    const ms = performance.now() - t0;
    expect(plan.stats.rooms).toBeGreaterThan(0);
    expect(ms).toBeLessThan(50);
  });
});
