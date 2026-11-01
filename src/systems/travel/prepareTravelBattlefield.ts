/** Projects both production travel and its dev fixture from the same authoritative destination. Missing or unsupported geometry keeps the original source-gap result. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 01:23:21
 * Dependents: hooks/app/useAppDeveloperCombatFixtures.ts, hooks/app/useAppTravelActions.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { BattleMapData } from "../../types/combat";
import type { TravelCombatEncounter, TravelMeta } from "../../types/travelMeta";
import type { GameState } from "../../types/state";

interface TravelBattlefieldPreparation {
  extractedBattleMap?: BattleMapData;
  sourceGapDetail?: string;
}

/**
 * Resolve one travel combat request against the exact destination WorldForge
 * artifact. Both normal travel and the deterministic visual fixture call this
 * boundary, so the proof route cannot quietly diverge from production.
 */
export async function prepareTravelBattlefield(
  encounter: TravelCombatEncounter,
  destination: TravelMeta["destinationCell"],
  sourceState: Pick<GameState, "worldSeed" | "gameTime" | "worldforgeDeltas">,
): Promise<TravelBattlefieldPreparation> {
  if (encounter.kind === "sea-hostile") {
    return {
      sourceGapDetail:
        "The hostile sea-travel event has no authoritative sea surface, vessel deck, or boarding geometry for tactical combat.",
    };
  }
  if (!destination || sourceState.worldSeed == null) {
    return {
      sourceGapDetail:
        "The land-travel encounter did not retain both its destination atlas cell and world seed.",
    };
  }

  try {
    const [{ loadCompleteGroundWorld }, { createTravelAmbushBattlefield }] =
      await Promise.all([
        import("../../components/World3D/createWorldGenClient"),
        import("../combat/worldScenario/travelAmbushBattlefield"),
      ]);
    // Game clock is an in-world UTC Date; read UTC fields so the ambush
    // battlefield lighting hour matches the HUD clock (never host getHours()).
    const hour =
      sourceState.gameTime instanceof Date
        ? sourceState.gameTime.getUTCHours() +
          sourceState.gameTime.getUTCMinutes() / 60
        : 12;
    const ground = await loadCompleteGroundWorld({
      wfSeed: sourceState.worldSeed,
      entryCellId: destination.cellId,
      centerPx: destination.anchor.centerPx,
      hour,
      deltas: sourceState.worldforgeDeltas,
    });
    const projection = createTravelAmbushBattlefield(ground, {
      worldSeed: sourceState.worldSeed,
      destinationCellId: destination.cellId,
      destinationCenterPx: destination.anchor.centerPx,
      routeCells: encounter.routeCells,
      hour,
    });
    return projection.status === "ready"
      ? { extractedBattleMap: projection.mapData }
      : { sourceGapDetail: projection.detail };
  } catch (error) {
    return {
      sourceGapDetail: `WorldForge could not project the travel encounter location: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

