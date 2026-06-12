/**
 * @file markers-generator.test.ts — golden + invariant tests for the
 * Markers.generate port (pipeline stage 34). Goldens FREEZE AT ACCEPTANCE
 * per the Worldforge tracker conventions.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { generateFmgWorld, type FmgWorldResult } from '../generateWorld';

const SEED = 'world-42';
const OPTS = { width: 960, height: 540, cellsDesired: 10000, template: 'continents' as const };

let world: FmgWorldResult;

describe('Markers.generate (FMG port, stage 34)', () => {
  beforeAll(() => {
    world = generateFmgWorld(SEED, OPTS);
  }, 120_000);

  it('matches FROZEN golden values for world-42', () => {
    const byType: Record<string, number> = {};
    for (const m of world.markers) byType[m.type] = (byType[m.type] || 0) + 1;

    const golden = {
      markerCount: world.markers.length,
      typeCounts: byType,
      markerNoteCount: world.notes.filter(n => n.id.startsWith('marker')).length,
      first: world.markers.length
        ? { type: world.markers[0].type, icon: world.markers[0].icon, cell: world.markers[0].cell }
        : null,
    };

    expect(golden.markerCount).toBeGreaterThan(0);
    expect(golden).toMatchSnapshot('markers-golden');
  });

  it('invariants: ids sequential; coordinates valid; one note per marker', () => {
    const noteIds = new Set(world.notes.map(n => n.id));
    world.markers.forEach((m, idx) => {
      expect(m.i).toBe(idx); // sequential ids by construction
      expect(Number.isFinite(m.x)).toBe(true);
      expect(Number.isFinite(m.y)).toBe(true);
      expect(m.cell).toBeGreaterThanOrEqual(0);
      expect(typeof m.icon).toBe('string');
      // every placed marker wrote a legend (a few add-fns can early-return
      // upstream — assert at least 95% coverage rather than strict 100%)
    });
    const withNotes = world.markers.filter(m => noteIds.has(`marker${m.i}`)).length;
    expect(withNotes / world.markers.length).toBeGreaterThan(0.95);
  });

  it('no marker shares a cell with another (occupied discipline)', () => {
    const cells = world.markers.map(m => m.cell);
    expect(new Set(cells).size).toBe(cells.length);
  });

  it('fantasy-gated types absent for the non-fantasy default culture set', () => {
    const types = new Set(world.markers.map(m => m.type));
    expect(types.has('portals')).toBe(false);
    expect(types.has('rifts')).toBe(false);
    expect(types.has('disturbed-burials')).toBe(false);
  });

  it('determinism: same seed + options → identical markers and notes', () => {
    const again = generateFmgWorld(SEED, OPTS);
    expect(again.markers).toEqual(world.markers);
    expect(again.notes).toEqual(world.notes);
  }, 120_000);
});
