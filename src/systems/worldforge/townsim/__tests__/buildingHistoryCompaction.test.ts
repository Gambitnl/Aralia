/**
 * Integration proof for save-history compaction against a real canonical burg.
 * The test deliberately uses household/style production input rather than a
 * fixture plan, because replay drift there would corrupt persisted targets.
 */
import { describe, expect, it } from 'vitest';
import { getBridgeAtlas, getBurgCultureType, getTownTilesForGrid } from '../../bridge/legacySubmapBridge';
import { applyHistory, appendBuildingEvent, buildingHistoryEventCount, isBuildingHistoryJournal } from '../../interior/buildingEventHistory';
import type { BuildingEvent, BuildingEventHistory } from '../../interior/blueprintTypes';
import { blueprintForPlot } from '../../interior/generateInterior';
import { buildingPlotInput } from '../../town/buildingPlotInput';
import { climateForBiomeId } from '../../town/architectureStyle';
import { canonicalTownSeedPath, getCanonicalTownPlan } from '../../town/canonicalTown';
import { toArtifactPlan } from '../../town/townPlanAdapter';
import { compactTownBuildingHistories } from '../buildingHistoryCompaction';
import { advanceTown } from '../townSimRegistry';
import type { TownSimState } from '../types';

const WORLD_SEED = 12345;

function lifecycleEvents(count: number): BuildingEvent[] {
  return Array.from({ length: count }, (_, index) => index % 2 === 0
    ? { day: index + 1, kind: 'abandonment' as const, payload: { boardedFraction: 0.5 } }
    : { day: index + 1, kind: 'reoccupation' as const });
}

function stateFor(burgId: number, plotId: number, history: BuildingEventHistory): TownSimState {
  return {
    burgId,
    villagers: {},
    chronicle: { burgId, events: [], nextEventId: 1 },
    buildingEvents: { [plotId]: history },
    lastSimDay: 100,
    nextVillagerId: 1,
  };
}

describe('compactTownBuildingHistories', () => {
  it('preserves exact replay and produces chunking-independent journals', () => {
    const burgId = getTownTilesForGrid(WORLD_SEED, 96, 96)[0]!.burgId;
    const atlas = getBridgeAtlas(WORLD_SEED);
    const { plan } = toArtifactPlan(
      getCanonicalTownPlan(atlas, WORLD_SEED, burgId),
      burgId,
    );
    const plot = plan.plots[0];
    const allEvents = lifecycleEvents(48);
    const oneShot = compactTownBuildingHistories(
      stateFor(burgId, plot.id, allEvents),
      WORLD_SEED,
    );

    const firstBlock = compactTownBuildingHistories(
      stateFor(burgId, plot.id, allEvents.slice(0, 24)),
      WORLD_SEED,
    );
    let steppedHistory = firstBlock.buildingEvents![plot.id];
    for (const event of allEvents.slice(24)) {
      steppedHistory = appendBuildingEvent(steppedHistory, event);
    }
    const stepped = compactTownBuildingHistories(
      stateFor(burgId, plot.id, steppedHistory),
      WORLD_SEED,
    );

    expect(stepped.buildingEvents![plot.id]).toEqual(oneShot.buildingEvents![plot.id]);
    expect(isBuildingHistoryJournal(oneShot.buildingEvents![plot.id])).toBe(true);
    expect(buildingHistoryEventCount(oneShot.buildingEvents![plot.id])).toBe(48);

    const burg = atlas.pack.burgs![burgId] as { cell: number };
    const townSeed = canonicalTownSeedPath(WORLD_SEED, burgId);
    const input = buildingPlotInput(plan, plot, townSeed, {
      cultureType: getBurgCultureType(WORLD_SEED, burgId),
      climate: climateForBiomeId(atlas.pack.cells.biome![burg.cell]),
    });
    const basePlan = blueprintForPlot(input, townSeed);
    const full = applyHistory(basePlan, allEvents);
    const compacted = applyHistory(basePlan, oneShot.buildingEvents![plot.id]);
    expect(compacted.liveHistory).toEqual(full.liveHistory);
    expect(compacted.styleResolved).toEqual(full.styleResolved);
  }, 20_000);

  it('runs automatically after a town advances', () => {
    const burgId = getTownTilesForGrid(WORLD_SEED, 96, 96)[0]!.burgId;
    const atlas = getBridgeAtlas(WORLD_SEED);
    const { plan } = toArtifactPlan(
      getCanonicalTownPlan(atlas, WORLD_SEED, burgId),
      burgId,
    );
    const source = stateFor(burgId, plan.plots[0].id, lifecycleEvents(24));
    source.lastSimDay = 24;

    const advanced = advanceTown(source, WORLD_SEED, 25);

    expect(isBuildingHistoryJournal(advanced.buildingEvents![plan.plots[0].id])).toBe(true);
  }, 20_000);
});
