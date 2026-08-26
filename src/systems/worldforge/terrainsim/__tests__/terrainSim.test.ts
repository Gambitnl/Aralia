/**
 * @file terrainSim.test.ts — creation, heal over in-game days, and removal.
 *
 * These are the three the board asks for, plus the two properties that make the
 * sim safe to persist: chunking independence (advancing 100 days in one call
 * equals two 50-day calls) and catch-up on load (a window reloaded a year late
 * still dates its history correctly).
 */
import { describe, it, expect } from 'vitest';
import {
  addGroundScar,
  addScarMark,
  advanceTerrainRegistry,
  advanceTerrainSim,
  createTerrainSimState,
  healedDayFor,
  pruneScarMarks,
} from '../terrainSim';
import { groundScarHeightOffsetAt } from '../groundScar';
import type { TerrainSimState } from '../types';

const at = (x: number, z: number) => ({ x, y: 0, z });

function windowWithCrater(day = 100, depthM = 1): TerrainSimState {
  const base = createTerrainSimState('window:test', day);
  const { state } = addGroundScar(base, {
    position: at(0, 0),
    shape: { kind: 'bowl', radiusM: 3 },
    depthM,
    cause: 'blast',
    bornDay: day,
    healMetersPerDay: 0.1, // 10 days to heal a 1 m pit; keeps the arithmetic obvious
    source: { kind: 'spell', name: 'Shatter' },
  });
  return state;
}

describe('creation', () => {
  it('adds a scar with an id, a born depth, and a cause default heal rate', () => {
    const base = createTerrainSimState('window:a', 40);
    const { state, scar } = addGroundScar(base, {
      position: at(2, 3),
      shape: { kind: 'bowl', radiusM: 3 },
      depthM: 0.8,
      cause: 'blast',
      bornDay: 40,
    });

    expect(scar.id).toBe('window:a:1');
    expect(scar.bornDepthM).toBe(0.8);
    expect(scar.healMetersPerDay).toBeCloseTo(0.025, 6); // blast profile
    expect(state.scars).toHaveLength(1);
    expect(state.nextId).toBe(2);
    // Pure: the input state is untouched.
    expect(base.scars).toHaveLength(0);
    // The scar is visible in the ground immediately.
    expect(groundScarHeightOffsetAt(state.scars, 2, 3)).toBeCloseTo(-0.8, 6);
  });

  it('a surface treatment goes straight to the mark list with no depth', () => {
    const base = createTerrainSimState('window:a', 40);
    const { state, mark } = addScarMark(base, {
      position: at(0, 0),
      shape: { kind: 'patch', radiusM: 4 },
      cause: 'fire',
      bornDay: 40,
    });
    expect(state.scars).toHaveLength(0);
    expect(state.marks).toEqual([mark]);
    expect(mark.weathering).toBe(0);
    // A scorch changes no height at all.
    expect(groundScarHeightOffsetAt(state.scars, 0, 0)).toBe(0);
  });
});

describe('decay over in-game days', () => {
  it('a scar loses depth per day and persists while it still has any', () => {
    const state = windowWithCrater(100, 1);
    const after3 = advanceTerrainSim(state, 103);

    expect(after3.lastSimDay).toBe(103);
    expect(after3.scars).toHaveLength(1);
    expect(after3.scars[0].depthM).toBeCloseTo(0.7, 6);
    expect(after3.scars[0].bornDepthM).toBe(1); // birth depth is a record, not a gauge
    expect(groundScarHeightOffsetAt(after3.scars, 0, 0)).toBeCloseTo(-0.7, 6);
  });

  it('persists across many separate advances — turns and days do not erase it', () => {
    let state = windowWithCrater(100, 1);
    for (let day = 101; day <= 105; day++) state = advanceTerrainSim(state, day);
    expect(state.scars).toHaveLength(1);
    expect(state.scars[0].depthM).toBeCloseTo(0.5, 6);
  });

  it('healing is chunking-independent: 100 days at once == two 50-day calls', () => {
    const start = windowWithCrater(0, 20); // deep enough to survive 100 days
    const oneShot = advanceTerrainSim(start, 100);
    const twoSteps = advanceTerrainSim(advanceTerrainSim(start, 50), 100);
    expect(twoSteps.scars[0].depthM).toBeCloseTo(oneShot.scars[0].depthM, 10);
    expect(twoSteps.lastSimDay).toBe(oneShot.lastSimDay);
  });

  it('advancing backwards or to the same day is a no-op', () => {
    const state = windowWithCrater(100, 1);
    expect(advanceTerrainSim(state, 100)).toBe(state);
    expect(advanceTerrainSim(state, 90)).toBe(state);
  });

  it('a mark weathers toward 1 and stops there', () => {
    const base = createTerrainSimState('window:a', 0);
    const { state } = addScarMark(base, {
      position: at(0, 0),
      shape: { kind: 'patch', radiusM: 4 },
      cause: 'fire',
      bornDay: 0,
      weatheringPerDay: 0.1,
    });
    expect(advanceTerrainSim(state, 3).marks[0].weathering).toBeCloseTo(0.3, 6);
    expect(advanceTerrainSim(state, 500).marks[0].weathering).toBe(1);
    // The record itself never leaves.
    expect(advanceTerrainSim(state, 5000).marks).toHaveLength(1);
  });
});

describe('removal when fully healed', () => {
  it('the scar record ends and its mark begins', () => {
    const state = windowWithCrater(100, 1); // 0.1 m/day → healed on day 110
    expect(healedDayFor(state.scars[0], 100)).toBeCloseTo(110, 6);

    const justBefore = advanceTerrainSim(state, 109);
    expect(justBefore.scars).toHaveLength(1);
    expect(justBefore.marks).toHaveLength(0);

    const healed = advanceTerrainSim(state, 110);
    expect(healed.scars).toHaveLength(0);
    expect(healed.marks).toHaveLength(1);
    expect(healed.marks[0].cause).toBe('blast');
    expect(healed.marks[0].bornDay).toBe(110);
    expect(healed.marks[0].source).toEqual({ kind: 'spell', name: 'Shatter' });
    // The ground is back to the height the generator produced.
    expect(groundScarHeightOffsetAt(healed.scars, 0, 0)).toBe(0);
  });

  it('a late catch-up dates the mark to the day it actually healed, then weathers it', () => {
    const state = windowWithCrater(100, 1);
    const late = advanceTerrainSim(state, 400); // player returns 300 days later
    expect(late.scars).toHaveLength(0);
    expect(late.marks[0].bornDay).toBe(110); // not 400
    // 290 days of weathering at the blast rate (1/240 per day) is fully weathered.
    expect(late.marks[0].weathering).toBe(1);
  });

  it('a scar with no heal rate never ends', () => {
    const base = createTerrainSimState('window:a', 0);
    const { state } = addGroundScar(base, {
      position: at(0, 0),
      shape: { kind: 'bowl', radiusM: 2 },
      depthM: 1,
      cause: 'excavation',
      bornDay: 0,
      healMetersPerDay: 0,
    });
    const later = advanceTerrainSim(state, 10_000);
    expect(later.scars).toHaveLength(1);
    expect(later.scars[0].depthM).toBe(1);
  });
});

describe('registry catch-up', () => {
  it('advances every tracked window and returns the same object when nothing moved', () => {
    const registry = {
      'window:a': windowWithCrater(100, 1),
      'window:b': createTerrainSimState('window:b', 100),
    };
    const advanced = advanceTerrainRegistry(registry, 105);
    expect(advanced['window:a'].scars[0].depthM).toBeCloseTo(0.5, 6);
    expect(advanced['window:b'].lastSimDay).toBe(105);
    expect(advanceTerrainRegistry(advanced, 105)).toBe(advanced);
  });
});

describe('pruneScarMarks', () => {
  it('is opt-in and drops the most weathered marks first', () => {
    let state = createTerrainSimState('window:a', 0);
    for (let i = 0; i < 5; i++) {
      ({ state } = addScarMark(state, {
        position: at(i, 0),
        shape: { kind: 'patch', radiusM: 1 },
        cause: 'fire',
        bornDay: i,
        weathering: i / 10,
      }));
    }
    expect(pruneScarMarks(state, 10)).toBe(state); // under the cap: untouched
    const pruned = pruneScarMarks(state, 2);
    expect(pruned.marks.map((m) => m.weathering)).toEqual([0, 0.1]);
  });
});
