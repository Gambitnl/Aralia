// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 16/07/2026, 08:56:41
 * Dependents: components/World3D/World3DWrapper.tsx, systems/combat/fightInPlace/activeGroundCombatSession.ts, systems/combat/worldScenario/openingThreatBattlefield.ts, systems/combat/worldScenario/openingThreatOutcome.ts, systems/combat/worldScenario/statePatrolWorldEvent.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file owns the save-backed history records emitted by generated-world
 * encounter systems.
 *
 * Receipts are intentionally separate from WorldDelta. A patrol interception
 * or hostile opening changes narrative history and entity presence, but it does
 * not repaint a road, building, or other regenerated terrain artifact.
 *
 * Called by: world-event authoring, opening-threat projection, GameState
 * Depends on: combat's source-entity and ecological-trace value contracts
 */
import type {
  BattleMapOpeningActivitySite,
  BattleMapOpeningEcologicalTrace,
  BattleMapOpeningSceneResolution,
  BattleMapOpeningTerrainImprint,
  WorldforgeOpeningThreatSource,
} from "@/types/combat";

// ============================================================================
// Generated-State Patrol History
// ============================================================================

export interface StatePatrolEncounterReceipt {
  id: string;
  kind: "state-patrol-interception";
  worldSeed: number;
  gameDay: number;
  triggeredAtGameTimeMs: number;
  sourceCellId: number;
  burgId: number;
  stateId: number;
  factionId: string;
  playerGroundMeters: { x: number; z: number };
}

// ============================================================================
// Hostile Opening Scene History
// ============================================================================

/**
 * Frozen entity scene authored from one validated GroundWorld tactical crop.
 * World-meter positions survive the battle transition and save/load cycle;
 * sourcePatchTile is retained only as inspectable evidence of the projection.
 */
interface OpeningThreatSceneReceiptBase {
  id: string;
  kind: "opening-threat-scene";
  sourceOpeningReceiptId: string;
  worldSeed: number;
  sourceCellId: number;
  playerGroundMeters: { x: number; z: number };
  approachDirection: { x: number; z: number };
  entities: Array<
    WorldforgeOpeningThreatSource & {
      sourcePatchTile: { x: number; y: number };
    }
  >;
  ecologicalTraces: BattleMapOpeningEcologicalTrace[];
}

/** Legacy contact receipt retained so existing saves remain loadable. */
export interface OpeningThreatSceneReceiptV1 extends OpeningThreatSceneReceiptBase {
  policyVersion: "opening-threat-scene-v1";
}

/**
 * Current contact receipt. The activity site is required here because v2's
 * purpose is to make monster occupation a persistent world fact, not UI lore.
 */
export interface OpeningThreatSceneReceiptV2 extends OpeningThreatSceneReceiptBase {
  policyVersion: "opening-threat-scene-v2";
  activitySite: BattleMapOpeningActivitySite;
  /**
   * Occupation imprints were added after the first v2 saves shipped. The field
   * stays optional so those saves load; projection upgrades them in place while
   * preserving every existing body, trace, and activity-site anchor.
   */
  terrainImprints?: BattleMapOpeningTerrainImprint[];
  /**
   * Once combat ends, this immutable result retires the contact scene while
   * retaining downed bodies, withdrawals, and site disturbance for return
   * visits. Its absence means the standoff is still unresolved.
   */
  resolution?: BattleMapOpeningSceneResolution;
}

export type OpeningThreatSceneReceipt =
  OpeningThreatSceneReceiptV1 | OpeningThreatSceneReceiptV2;

/** Every generated-world encounter record accepted by GameState. */
export type WorldforgeEncounterReceipt =
  StatePatrolEncounterReceipt | OpeningThreatSceneReceipt;
