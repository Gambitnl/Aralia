/**
 * Structural-extension tests prove that a saved addition becomes canonical
 * building geometry while the pre-existing core remains fixed on its plot.
 * The small hand-built footprint isolates replay validation; the generator
 * case proves rooms, roofs, and district architecture consume the new shape.
 */
import { describe, expect, it } from 'vitest';
import { rootSeedPath } from '../../seedPath';
import type { BuildingEvent } from '../blueprintTypes';
import {
  applyStructuralExtensions,
  planBuildingExtensionCandidates,
} from '../buildingExtensions';
import type { Footprint } from '../footprint';
import { generateBuilding } from '../generateBuilding';
import { buildBlueprintParts } from '../../bridge/interiorParts';
import { snapshotBuildingHistory } from '../buildingEventHistory';

// ============================================================================
// Isolated Footprint Fixture
// ============================================================================
// A tiny hand-built shell makes connectivity and lot boundaries independent
// from generator randomness.
// ============================================================================

// This rectangle is intentionally plain: extension behavior, not the random
// footprint generator, is the subject of the low-level assertions.
const BASE: Footprint = {
  cols: 2,
  rows: 2,
  occ: [[true, true], [true, true]],
  cells: [
    { cx: 0, cy: 0 }, { cx: 1, cy: 0 },
    { cx: 0, cy: 1 }, { cx: 1, cy: 1 },
  ],
  masses: [{ kind: 'main', x: 0, y: 0, w: 2, h: 2 }],
};

/** Store one explicit addition outcome in the same shape saves will use. */
function extension(mass: { x: number; y: number; w: number; h: number }): BuildingEvent {
  return { day: 10, kind: 'extension', payload: { phase: 1, mass: { kind: 'wing', ...mass } } };
}

// ============================================================================
// Structural Replay Contracts
// ============================================================================

describe('applyStructuralExtensions', () => {
  it('normalizes a one-sided addition while preserving the original site origin', () => {
    const result = applyStructuralExtensions(BASE, [extension({ x: -2, y: 0, w: 3, h: 1 })]);

    expect(result.footprint.cols).toBe(4);
    expect(result.footprint.cells).toHaveLength(6);
    expect(result.siteOriginFt).toEqual({ x: 15, y: 5 });
    expect(result.footprint.masses[1]).toMatchObject({
      kind: 'wing', x: 0, y: 0, w: 3, h: 1, extensionEventIndex: 0,
    });
  });

  it('rejects detached, empty, duplicate, and lot-overhanging additions', () => {
    expect(() => applyStructuralExtensions(BASE, [extension({ x: 4, y: 0, w: 1, h: 1 })]))
      .toThrow(/disconnected/);
    expect(() => applyStructuralExtensions(BASE, [extension({ x: 1, y: 1, w: 0, h: 1 })]))
      .toThrow(/empty mass/);
    expect(() => applyStructuralExtensions(BASE, [extension({ x: 0, y: 0, w: 1, h: 1 })]))
      .toThrow(/adds no footprint cells/);
    expect(() => applyStructuralExtensions(
      BASE,
      [extension({ x: 1, y: 0, w: 2, h: 1 })],
      { maxWidthFt: 15 },
    )).toThrow(/lot width/);
  });

  it('leaves legacy mass-activation events byte-compatible', () => {
    const result = applyStructuralExtensions(BASE, [{
      day: 10,
      kind: 'extension',
      payload: { massIndex: 1, phase: 1 },
    }]);

    expect(result).toEqual({ footprint: BASE });
    expect(result.footprint).toBe(BASE);
  });
});

describe('planBuildingExtensionCandidates', () => {
  it('keeps district proportions coherent while rotating individual buildings', () => {
    const make = (buildingId: number) => generateBuilding({
      buildingId,
      type: 'tavern',
      seedPath: rootSeedPath(8800),
      storeys: 2,
    });
    const a = make(10);
    const b = make(11);
    const options = {
      districtKey: 'river-market',
      roofForm: 'hip' as const,
      maxWidthFt: Math.max(a.widthFt, b.widthFt) + 30,
      maxDepthFt: Math.max(a.depthFt, b.depthFt) + 30,
    };
    const candidatesA = planBuildingExtensionCandidates(a, options);
    const candidatesB = planBuildingExtensionCandidates(b, options);

    expect(candidatesA).toHaveLength(2);
    expect(candidatesB).toHaveLength(2);
    expect(candidatesA.every((candidate) => candidate.roofForm === 'hip')).toBe(true);
    expect(candidatesA.map((candidate) => [candidate.mass.w, candidate.mass.h].sort()))
      .toEqual(candidatesB.map((candidate) => [candidate.mass.w, candidate.mass.h].sort()));
    expect(candidatesA.map((candidate) => candidate.mass))
      .not.toEqual(candidatesB.map((candidate) => candidate.mass));
  });

  it('returns only candidates that remain valid when replayed cumulatively', () => {
    const plan = generateBuilding({
      buildingId: 12,
      type: 'shop',
      seedPath: rootSeedPath(8812),
      storeys: 2,
    });
    const limits = { maxWidthFt: plan.widthFt + 30, maxDepthFt: plan.depthFt + 30 };
    const candidates = planBuildingExtensionCandidates(plan, {
      ...limits,
      roofForm: 'steep',
      districtKey: 'highland-row',
    });
    const base: Footprint = {
      cols: plan.widthFt / 5,
      rows: plan.depthFt / 5,
      occ: Array.from({ length: plan.depthFt / 5 }, (_, y) =>
        Array.from({ length: plan.widthFt / 5 }, (_, x) =>
          plan.footprintCells.some((cell) => cell.cx === x && cell.cy === y))),
      cells: plan.footprintCells,
      masses: plan.masses,
    };
    const events: BuildingEvent[] = candidates.map((candidate, index) => ({
      day: index + 1,
      kind: 'extension',
      payload: { phase: candidate.phase, mass: candidate.mass },
    }));

    expect(candidates).toHaveLength(2);
    expect(() => applyStructuralExtensions(base, events, limits)).not.toThrow();
  });
});

describe('generateBuilding structural extension integration', () => {
  it('regenerates every floor and roof without changing district architecture', () => {
    const shared = {
      buildingId: 44,
      type: 'tavern' as const,
      seedPath: rootSeedPath(4400),
      storeys: 2,
      style: {
        cultureType: 'Highland',
        climate: 'cold' as const,
        wealth: 'common' as const,
        ageBand: 'old' as const,
        architecture: {
          settlementKey: 'north-town',
          districtKey: 'stone-market',
          buildingKey: 'plot-44',
        },
      },
    };
    const base = generateBuilding(shared);
    const baseCols = base.widthFt / 5;
    const log: BuildingEvent[] = [extension({ x: baseCols - 1, y: 1, w: 3, h: 2 })];
    const grown = generateBuilding({ ...shared, eventLog: log });

    expect(grown.footprintCells.length).toBeGreaterThan(base.footprintCells.length);
    expect(grown.widthFt).toBe(base.widthFt + 10);
    expect(grown.siteOriginFt).toEqual({ x: base.widthFt / 2, y: base.depthFt / 2 });
    for (const floor of grown.floors) {
      const covered = floor.rooms.reduce((total, room) => total + room.cells.length, 0);
      expect(covered).toBe(grown.footprintCells.length);
    }
    expect(grown.roof?.planes.length).toBeGreaterThanOrEqual(base.roof?.planes.length ?? 0);
    expect(grown.styleResolved?.districtSignature).toBe(base.styleResolved?.districtSignature);
    expect(grown.styleResolved?.roofForm).toBe(base.styleResolved?.roofForm);
    expect(grown.liveHistory?.features).toContainEqual(expect.objectContaining({
      kind: 'extension-phase',
      massIndex: grown.masses.length - 1,
      phase: 1,
    }));
  });

  it('retains structural additions and their absolute ordinal after snapshotting', () => {
    const shared = {
      buildingId: 46,
      type: 'shop' as const,
      seedPath: rootSeedPath(4600),
      storeys: 2,
      style: {
        cultureType: 'River',
        climate: 'temperate' as const,
        wealth: 'common' as const,
        ageBand: 'aged' as const,
      },
    };
    const base = generateBuilding(shared);
    const log = [extension({ x: base.widthFt / 5 - 1, y: 1, w: 3, h: 2 })];
    const grown = generateBuilding({ ...shared, eventLog: log });
    const journal = snapshotBuildingHistory(grown, log);
    const replayed = generateBuilding({ ...shared, eventLog: journal });

    expect(replayed.footprintCells).toEqual(grown.footprintCells);
    expect(replayed.masses).toEqual(grown.masses);
    expect(replayed.roof).toEqual(grown.roof);
    expect(replayed.liveHistory).toEqual(grown.liveHistory);
    expect(journal.snapshot.structuralEvents[0].eventIndex).toBe(0);
  });

  it('moves every production part through the stable site-origin contract', () => {
    const plan = generateBuilding({
      buildingId: 45,
      type: 'shop',
      seedPath: rootSeedPath(4500),
      storeys: 2,
      style: {
        cultureType: 'River',
        climate: 'temperate',
        wealth: 'common',
        ageBand: 'new',
      },
    });
    const centered = buildBlueprintParts(plan, 3, '#ffffff');
    const shiftedPlan = {
      ...plan,
      siteOriginFt: { x: plan.widthFt / 2 + 5, y: plan.depthFt / 2 },
    };
    const shifted = buildBlueprintParts(shiftedPlan, 3, '#ffffff');

    expect(shifted.parts).toHaveLength(centered.parts.length);
    shifted.parts.forEach((part, index) => {
      expect(part.x).toBeCloseTo(centered.parts[index].x - 5 * 0.3048, 6);
      expect(part.z).toBeCloseTo(centered.parts[index].z, 6);
    });
    expect(shifted.roof?.positions[0]).toBeCloseTo(
      (centered.roof?.positions[0] ?? 0) - 5 * 0.3048,
      5,
    );
  });
});
