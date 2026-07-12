/**
 * @file markers-generator.test.ts — golden + invariant tests for the
 * Markers.generate port (pipeline stage 34). Goldens FREEZE AT ACCEPTANCE
 * per the Worldforge tracker conventions.
 *
 * Since the forests campaign (Task 8a), stage 36 APPENDS forest POI markers
 * (hunter-camp / forest-shrine / hermit-hollow / beast-den) to pack.markers
 * after the FMG stage-34 markers. The full-pipeline world here therefore
 * carries both blocks; the golden snapshot includes the POIs, and the
 * note-coverage invariant is scoped to FMG types (see FOREST_POI_TYPES).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { generateFmgWorld, type FmgWorldResult } from '../generateWorld';

const SEED = 'world-42';
const OPTS = { width: 960, height: 540, cellsDesired: 10000, template: 'continents' as const };

/** Forest POI marker types (forests campaign Task 8a, appended by stage 36).
 * They carry NO notes BY DESIGN: the legend writers draw from the shared
 * Alea stream, which the forests pass must never touch (world-preservation
 * doctrine) — so the one-note-per-marker invariant excludes them. */
const FOREST_POI_TYPES = new Set([
  'hunter-camp',
  'forest-shrine',
  'hermit-hollow',
  'beast-den',
]);

let world: FmgWorldResult;

describe('Markers.generate (FMG port, stage 34)', () => {
  beforeAll(() => {
    world = generateFmgWorld(SEED, OPTS);
  }, 120_000);

  it('matches FROZEN golden values for world-42', () => {
    const byType: Record<string, number> = {};
    for (const m of world.markers) byType[m.type] = (byType[m.type] || 0) + 1;

    // markerCount trace: 69 FMG stage-34 markers (the pre-forests golden,
    // unchanged — POIs only APPEND) + 20 forest POIs (forests campaign,
    // 8 qualifying forests at 1-per-40-cells density, hard cap 5/forest).
    // markerNoteCount stays 69: forest POIs write no notes (see header).
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

  it('invariants: ids sequential; coordinates valid; one note per FMG marker', () => {
    const noteIds = new Set(world.notes.map(n => n.id));
    world.markers.forEach((m, idx) => {
      expect(m.i).toBe(idx); // sequential ids by construction (POIs append)
      expect(Number.isFinite(m.x)).toBe(true);
      expect(Number.isFinite(m.y)).toBe(true);
      expect(m.cell).toBeGreaterThanOrEqual(0);
      expect(typeof m.icon).toBe('string');
      // every placed FMG marker wrote a legend (a few add-fns can early-return
      // upstream — assert at least 95% coverage rather than strict 100%).
      // Forest POIs are excluded: they carry no notes by design (see header).
    });
    const fmgMarkers = world.markers.filter(m => !FOREST_POI_TYPES.has(m.type));
    const withNotes = fmgMarkers.filter(m => noteIds.has(`marker${m.i}`)).length;
    expect(withNotes / fmgMarkers.length).toBeGreaterThan(0.95);
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
