// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 08:56:42
 * Dependents: state/reducers/worldReducer.ts, systems/combat/worldScenario/worldBattleScenario.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file reconciles a finished hostile-opening battle with its saved
 * WorldForge creature scene.
 *
 * Combat owns hit points and final referee cells. WorldForge owns creature and
 * site identity. This bridge accepts an outcome only when every final token can
 * be matched to the exact saved entity and converted back into world meters;
 * otherwise it returns a source gap and leaves the historical receipt intact.
 *
 * Called by: worldReducer before END_BATTLE clears the tactical map
 * Depends on: the saved opening-scene receipt and tile/world conversion referee
 */
import { patchTileToWorldMeters } from "@/systems/combat/fightInPlace/inSceneMovement";
import type {
  BattleMapData,
  BattleMapOpeningEntityOutcome,
  BattleMapOpeningSceneResolution,
  CombatEnemySnapshotEntry,
} from "@/types/combat";
import type { OpeningThreatSceneReceiptV2 } from "./worldforgeEncounterReceipt";

// ============================================================================
// Reconciliation Result
// ============================================================================
// A source gap is deliberately data, not an exception. The reducer can keep the
// old receipt and surface the exact mismatch without corrupting world history.
// ============================================================================

export type OpeningThreatOutcomeReconciliation =
  | {
      status: "ready";
      receipt: OpeningThreatSceneReceiptV2;
      detail: string;
    }
  | {
      status: "source-gap";
      detail: string;
    };

export type OpeningThreatBattleResult = "victory" | "defeat";

// ============================================================================
// Exact Outcome Authoring
// ============================================================================

/** Compare durable resolution values without accepting a conflicting rewrite. */
function resolutionsMatch(
  left: BattleMapOpeningSceneResolution,
  right: BattleMapOpeningSceneResolution,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Turn final combat tokens into one immutable scene resolution.
 *
 * Withdrawn creatures retain their last seen cell rather than receiving an
 * invented off-map destination. Downed creatures remain physical return-visit
 * evidence. A party defeat leaves standing enemies holding the disturbed site.
 */
export function resolveOpeningThreatSceneAfterCombat(
  receipt: OpeningThreatSceneReceiptV2,
  mapData: BattleMapData,
  finalEnemies: readonly CombatEnemySnapshotEntry[],
  result: OpeningThreatBattleResult,
  resolvedAtGameTimeMs: number,
): OpeningThreatOutcomeReconciliation {
  const provenance = mapData.provenance;
  const encounterContext = mapData.encounterContext;
  if (
    !provenance ||
    provenance.worldSeed !== receipt.worldSeed ||
    provenance.anchorCellId !== receipt.sourceCellId ||
    encounterContext?.kind !== "opening-standoff" ||
    encounterContext.sourceSceneReceiptId !== receipt.id
  ) {
    return {
      status: "source-gap",
      detail: `Opening scene ${receipt.id} cannot reconcile combat without its exact WorldForge tactical provenance.`,
    };
  }

  if (!Number.isFinite(resolvedAtGameTimeMs)) {
    return {
      status: "source-gap",
      detail: `Opening scene ${receipt.id} received an invalid world time for combat resolution.`,
    };
  }

  if (finalEnemies.length !== receipt.entities.length) {
    return {
      status: "source-gap",
      detail: `Opening scene ${receipt.id} expected ${receipt.entities.length} final creature snapshots but received ${finalEnemies.length}.`,
    };
  }

  const receiptEntities = new Map(
    receipt.entities.map((entity) => [entity.entityId, entity] as const),
  );
  const seenEntityIds = new Set<string>();
  const entityOutcomes: BattleMapOpeningEntityOutcome[] = [];
  const patchAnchor = {
    playerXM: provenance.anchorWorldMeters.x,
    playerZM: provenance.anchorWorldMeters.z,
  };

  // Preserve receipt order so deterministic saves and screenshot diagnostics do
  // not change when transient combat arrays happen to be reordered.
  for (const receiptEntity of receipt.entities) {
    const snapshot = finalEnemies.find((candidate) => {
      const source = candidate.worldSource;
      return (
        source?.kind === "worldforge-opening-threat" &&
        source.sceneReceiptId === receipt.id &&
        source.entityId === receiptEntity.entityId
      );
    });
    if (!snapshot || seenEntityIds.has(receiptEntity.entityId)) {
      return {
        status: "source-gap",
        detail: `Opening scene ${receipt.id} is missing a unique final snapshot for source entity ${receiptEntity.entityId}.`,
      };
    }
    seenEntityIds.add(receiptEntity.entityId);

    const source = snapshot.worldSource;
    if (
      source?.kind !== "worldforge-opening-threat" ||
      source.sourceOpeningReceiptId !== receipt.sourceOpeningReceiptId ||
      source.monsterName !== receiptEntity.monsterName ||
      source.monsterOrdinal !== receiptEntity.monsterOrdinal ||
      source.socialRole !== receiptEntity.socialRole ||
      receiptEntities.get(source.entityId) !== receiptEntity
    ) {
      return {
        status: "source-gap",
        detail: `Combatant ${snapshot.id} does not match source entity ${receiptEntity.entityId} in opening scene ${receipt.id}.`,
      };
    }

    const tile = mapData.tiles.get(
      `${snapshot.position.x}-${snapshot.position.y}`,
    );
    if (!tile || tile.blocksMovement || !Number.isFinite(snapshot.currentHP)) {
      return {
        status: "source-gap",
        detail: `Combatant ${snapshot.id} ended on an invalid referee cell or hit-point state for opening scene ${receipt.id}.`,
      };
    }

    const world = patchTileToWorldMeters(
      mapData,
      patchAnchor,
      snapshot.position.x,
      snapshot.position.y,
    );
    const status =
      snapshot.currentHP <= 0
        ? "downed"
        : result === "victory"
          ? "withdrew"
          : "holding-ground";
    entityOutcomes.push({
      sourceEntityId: receiptEntity.entityId,
      combatantId: snapshot.id,
      status,
      finalHitPoints: snapshot.currentHP,
      finalTacticalPosition: { ...snapshot.position },
      lastSeenWorldGroundMeters: { x: world.xM, z: world.zM },
    });
  }

  // Anchor physical churn to an actual final creature cell nearest the outcome
  // centroid. This avoids fabricating a decorative midpoint on blocked terrain.
  const disturbanceCandidates = entityOutcomes.filter(
    (outcome) => outcome.status === "downed",
  );
  const physicalCandidates =
    disturbanceCandidates.length > 0 ? disturbanceCandidates : entityOutcomes;
  const centroid = physicalCandidates.reduce(
    (sum, outcome) => ({
      x: sum.x + outcome.finalTacticalPosition.x / physicalCandidates.length,
      y: sum.y + outcome.finalTacticalPosition.y / physicalCandidates.length,
    }),
    { x: 0, y: 0 },
  );
  const disturbanceAnchor = physicalCandidates.slice().sort((left, right) => {
    const leftDistance = Math.hypot(
      left.finalTacticalPosition.x - centroid.x,
      left.finalTacticalPosition.y - centroid.y,
    );
    const rightDistance = Math.hypot(
      right.finalTacticalPosition.x - centroid.x,
      right.finalTacticalPosition.y - centroid.y,
    );
    return (
      leftDistance - rightDistance ||
      left.sourceEntityId.localeCompare(right.sourceEntityId)
    );
  })[0]!;
  const spread = Math.max(
    0,
    ...entityOutcomes.map((outcome) =>
      Math.hypot(
        outcome.finalTacticalPosition.x -
          disturbanceAnchor.finalTacticalPosition.x,
        outcome.finalTacticalPosition.y -
          disturbanceAnchor.finalTacticalPosition.y,
      ),
    ),
  );
  const downedCount = entityOutcomes.filter(
    (outcome) => outcome.status === "downed",
  ).length;
  const disturbanceVector = {
    x:
      disturbanceAnchor.finalTacticalPosition.x -
      receipt.activitySite.position.x,
    y:
      disturbanceAnchor.finalTacticalPosition.y -
      receipt.activitySite.position.y,
  };
  const disturbanceVectorLength = Math.hypot(
    disturbanceVector.x,
    disturbanceVector.y,
  );
  const disturbanceDirection =
    disturbanceVectorLength > 1e-9
      ? {
          x: disturbanceVector.x / disturbanceVectorLength,
          y: disturbanceVector.y / disturbanceVectorLength,
        }
      : {
          x: receipt.approachDirection.x,
          y: receipt.approachDirection.z,
        };
  const resolution: BattleMapOpeningSceneResolution = {
    outcome: result === "victory" ? "party-victory" : "party-defeat",
    resolvedAtGameTimeMs,
    entityOutcomes,
    activitySiteCondition:
      result === "victory" ? "abandoned-disturbed" : "held-disturbed",
    combatDisturbance: {
      kind: "combat-churn",
      position: { ...disturbanceAnchor.finalTacticalPosition },
      worldGroundMeters: {
        ...disturbanceAnchor.lastSeenWorldGroundMeters,
      },
      direction: disturbanceDirection,
      extentCells: {
        length: Math.max(3, Math.min(8, spread + 2)),
        width: downedCount >= 2 ? 3.2 : 2.4,
      },
      severity: downedCount >= 2 ? "heavy" : "scattered",
      sourceEntityIds: entityOutcomes.map((outcome) => outcome.sourceEntityId),
    },
  };

  if (receipt.resolution) {
    return resolutionsMatch(receipt.resolution, resolution)
      ? {
          status: "ready",
          receipt,
          detail: `Opening scene ${receipt.id} already stores this exact combat outcome.`,
        }
      : {
          status: "source-gap",
          detail: `Opening scene ${receipt.id} already has a different combat outcome and cannot be rewritten.`,
        };
  }

  return {
    status: "ready",
    receipt: { ...receipt, resolution },
    detail: `Opening scene ${receipt.id} recorded ${downedCount} downed and ${entityOutcomes.length - downedCount} surviving creature outcomes plus one ${resolution.activitySiteCondition} site.`,
  };
}
