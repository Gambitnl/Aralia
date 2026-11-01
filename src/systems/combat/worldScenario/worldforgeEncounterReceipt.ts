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

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 29/10/2026, 18:48:07
 * Dependents: components/World3D/hooks/useInPlaceCombatTransition.ts, systems/combat/fightInPlace/activeGroundCombatSession.ts, systems/combat/worldScenario/openingThreatBattlefield.ts, systems/combat/worldScenario/openingThreatOutcome.ts, systems/combat/worldScenario/statePatrolWorldEvent.ts, systems/combat/worldScenario/surfaceHostileContinuity.ts, systems/combat/worldScenario/surfaceHostileEncounter.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {
  BattleMapOpeningActivitySite,
  BattleMapOpeningEcologicalTrace,
  BattleMapOpeningSceneResolution,
  BattleMapOpeningTerrainImprint,
  WorldforgeOpeningThreatSource,
  WorldforgeSurfaceHostileSource,
  CombatEnemySnapshotEntry,
  BattleMapEncounterContext,
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

/** One contact in the existing world history, not another enemy-state store. */
export interface SurfaceHostileEncounterReceipt {
  id: string;
  kind: "surface-hostile-contact";
  sourceScope: string;
  partySources: Extract<BattleMapEncounterContext, {kind: "surface-contact"}>["partySources"];
  worldSeed: number;
  sourceCellId: number;
  triggeredAtGameTimeMs: number;
  playerGroundMeters: { x: number; z: number };
  entities: Array<{
    combatantId: string;
    name: string;
    source: WorldforgeSurfaceHostileSource;
    maxHP: number;
    currentHP: number;
    spellSlots?: CombatEnemySnapshotEntry['spellSlots'];
    limitedUses?: CombatEnemySnapshotEntry['limitedUses'];
  }>;
  resolution?: {
    result: "victory" | "defeat" | "flee" | "ended";
    resolvedAtGameTimeMs: number;
    entities: Array<{
      entityId: string;
      currentHP: number;
      position: { xM: number; zM: number };
      spellSlots?: CombatEnemySnapshotEntry['spellSlots'];
      limitedUses?: CombatEnemySnapshotEntry['limitedUses'];
    }>;
  };
}

/** Every generated-world encounter record accepted by GameState. */
export type WorldforgeEncounterReceipt =
  StatePatrolEncounterReceipt | OpeningThreatSceneReceipt | SurfaceHostileEncounterReceipt;
