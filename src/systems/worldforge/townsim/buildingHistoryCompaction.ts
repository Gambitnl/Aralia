/**
 * Versioned, replay-preserving compaction for living-building save history.
 *
 * Every full block is folded into renderer-ready state while a bounded tail
 * remains chronological. Fixed block boundaries make the serialized result
 * independent of whether game time advanced one day or many days per call.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 15:48:08
 * Dependents: systems/worldforge/townsim/townSimRegistry.ts
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { getBridgeAtlas, getBurgCultureType } from '../bridge/legacySubmapBridge';
import {
  applyHistory,
  buildingHistoryEventCount,
  cloneBuildingEventHistory,
  isBuildingHistoryJournal,
  snapshotBuildingHistory,
} from '../interior/buildingEventHistory';
import type {
  BuildingEvent,
  BuildingEventHistory,
  BuildingHistoryJournalV1,
} from '../interior/blueprintTypes';
import { buildingSourceNeedsStructuralMigration } from '../interior/buildingSource';
import { blueprintForPlot } from '../interior/generateInterior';
import { buildingPlotInput } from '../town/buildingPlotInput';
import { climateForBiomeId } from '../town/architectureStyle';
import { canonicalTownSeedPath, getCanonicalTownPlan } from '../town/canonicalTown';
import { toArtifactPlan } from '../town/townPlanAdapter';
import type { TownSimState } from './types';

/** At most 23 recent events remain after a compaction pass. */
export const BUILDING_HISTORY_BLOCK_SIZE = 24;

function clonedEvents(events: readonly BuildingEvent[]): BuildingEvent[] {
  const cloned = cloneBuildingEventHistory(events);
  if (!Array.isArray(cloned)) throw new Error('buildingHistoryCompaction: expected event array');
  return cloned;
}

/** Number of tail events to fold now; zero means the representation is bounded. */
export function foldableBuildingHistoryCount(history: BuildingEventHistory): number {
  const tailLength = isBuildingHistoryJournal(history) ? history.events.length : history.length;
  return Math.floor(tailLength / BUILDING_HISTORY_BLOCK_SIZE) * BUILDING_HISTORY_BLOCK_SIZE;
}

function splitHistory(history: BuildingEventHistory): {
  prefix: BuildingEventHistory;
  retained: BuildingEvent[];
} | undefined {
  const foldCount = foldableBuildingHistoryCount(history);
  if (foldCount === 0) return undefined;
  if (!isBuildingHistoryJournal(history)) {
    return {
      prefix: clonedEvents(history.slice(0, foldCount)),
      retained: clonedEvents(history.slice(foldCount)),
    };
  }
  const cloned = cloneBuildingEventHistory(history) as BuildingHistoryJournalV1;
  return {
    prefix: { ...cloned, events: cloned.events.slice(0, foldCount) },
    retained: cloned.events.slice(foldCount),
  };
}

/**
 * Compact every over-limit plot using the same canonical plan input as 3D.
 * Missing canonical plots fail loudly because approximating them would make
 * snapshot targets irrecoverable after the discarded prefix is gone.
 */
export function compactTownBuildingHistories(
  state: TownSimState,
  worldSeed: number,
): TownSimState {
  const histories = state.buildingEvents;
  if (!histories || !Object.values(histories).some((history) =>
    foldableBuildingHistoryCount(history) > 0)) return state;

  // Folding discards the original prefix, so its geometry must have a known
  // source. Preserve every event in unversioned saves until admission resolves
  // the layout; daily life can continue without this storage optimization.
  if (state.layoutRevision === undefined) return state;
  const atlas = getBridgeAtlas(worldSeed);
  const enginePlan = getCanonicalTownPlan(atlas, worldSeed, state.burgId, state.layoutRevision);
  const { plan } = toArtifactPlan(enginePlan, state.burgId);
  const townSeed = canonicalTownSeedPath(worldSeed, state.burgId);
  const burg = atlas.pack.burgs?.[state.burgId] as { cell?: number } | undefined;
  const biomeId = burg?.cell !== undefined ? atlas.pack.cells.biome?.[burg.cell] : undefined;
  if (biomeId === undefined) {
    throw new Error(
      `buildingHistoryCompaction: cannot resolve biome for burg ${state.burgId}`,
    );
  }
  const styleBase = {
    cultureType: getBurgCultureType(worldSeed, state.burgId),
    climate: climateForBiomeId(biomeId),
  };
  const buildingEvents = { ...histories };
  for (const [rawPlotId, history] of Object.entries(histories)) {
    const split = splitHistory(history);
    if (!split) continue;
    const plotId = Number(rawPlotId);
    const source = state.buildingSources?.[plotId];
    // A partial fold may precede the observed anchor. Keep that journal until
    // its next block includes the anchor; never reconstruct an older layout.
    // Pending structural changes likewise retain their full migration intent.
    if (source && (buildingHistoryEventCount(split.prefix) < buildingHistoryEventCount(
      JSON.parse(source.historySignature) ?? undefined) || buildingSourceNeedsStructuralMigration(source, split.prefix))) continue;
    const plot = plan.plots.find((candidate) => candidate.id === plotId);
    if (!plot) {
      throw new Error(
        `buildingHistoryCompaction: canonical burg ${state.burgId} has no plot ${plotId}`,
      );
    }
    const input = buildingPlotInput(plan, plot, townSeed, {
      ...styleBase,
      eventLog: split.prefix,
      retainedSource: source ? {worldSeed, burgId: state.burgId, source} : undefined,
    });
    const resolvedPrefix = blueprintForPlot(input, townSeed);
    // blueprintForPlot already replays the prefix; the explicit guard makes a
    // future adapter change fail here instead of persisting a lossy snapshot.
    const replayedPrefix = resolvedPrefix.liveHistory
      ? resolvedPrefix
      : applyHistory(resolvedPrefix, split.prefix);
    const snapshot = snapshotBuildingHistory(replayedPrefix, split.prefix);
    buildingEvents[plotId] = { ...snapshot, events: split.retained };
  }
  return { ...state, buildingEvents };
}
