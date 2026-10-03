// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/08/2026, 22:42:05
 * Dependents: state/reducers/companionReducer.ts, systems/party/recruitConsent.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/companions/RelationshipManager.ts
 * Manages companion relationships, approval changes, and loyalty checks.
 */

// Logic for companion approval and relationship progression
import {
  Companion,
  Relationship,
  RelationshipLevel,
  ApprovalEvent,
  RelationshipUnlock,
} from '../../types/companions';
import { generateId } from '../../utils/core/idGenerator';

/**
 * This manager turns companion approval events and the saved in-world clock into
 * relationship state. The companion reducer supplies both inputs, and the manager
 * preserves approval history, unlocks, and the special romance-exit policy.
 */
export class RelationshipManager {
  // Canonical runtime approval scale: -500 to +500 with 100-point step changes.
  // Each relationship level spans exactly 100 points for clean progression
  private static readonly APPROVAL_THRESHOLDS: Record<RelationshipLevel, [number, number]> = {
    hated: [-500, -401],      // Actively despised
    enemy: [-400, -301],      // Hostile
    rival: [-300, -201],      // Antagonistic
    distrusted: [-200, -101], // Suspicious
    wary: [-100, -1],         // Cautious
    stranger: [0, 99],        // Neutral (starting point)
    acquaintance: [100, 199], // Getting to know
    friend: [200, 299],       // Friendly
    close: [300, 399],        // Close bond
    devoted: [400, 499],      // Deep loyalty
    romance: [500, 500],      // Special state (requires explicit trigger at max devotion)
  };

  // Loyalty is treated as a retention floor here, not as the full leave/betrayal engine.
  // When a companion falls below this floor, callers can make the story-specific decision.
  private static readonly LOYALTY_RETENTION_FLOOR = 10;

  // Romance only begins its exit timer in enemy-or-worse territory. Rival approval
  // (-300) is still a serious conflict, but it is not the decided hostile boundary.
  private static readonly ROMANCE_EXIT_APPROVAL_THRESHOLD = -301;

  // A hostile romance must remain hostile for one complete in-world day. This is
  // measured from GameState.gameTime and therefore survives saves and reloads.
  private static readonly ROMANCE_EXIT_DURATION_MS = 24 * 60 * 60 * 1000;

  /**
   * Calculates the new approval value and returns the updated companion state.
   */
  static processApprovalEvent(
    companion: Companion,
    targetId: string, // Usually player ID
    change: number,
    reason: string,
    currentGameTimeMs: number
  ): Companion {
    // RALPH: Core state mutation for relationships.
    // Handles arithmetic, clamping (-500 to 500), and level transitions.
    const currentRelationship = companion.relationships[targetId] || {
      targetId,
      level: 'stranger',
      approval: 0,
      history: [],
      unlocks: [],
    };

    const newApproval = Math.max(-500, Math.min(500, currentRelationship.approval + change));

    // Ordinary relationships continue to follow the existing threshold table.
    // Romance instead uses the saved hostile-since marker so one immediate approval
    // collapse cannot masquerade as a sustained breakup condition.
    let newLevel: RelationshipLevel = currentRelationship.level;
    let romanceHostileSinceGameTimeMs = currentRelationship.romanceHostileSinceGameTimeMs;

    if (newLevel !== 'romance') {
      for (const [level, [min, max]] of Object.entries(this.APPROVAL_THRESHOLDS)) {
        if (newApproval >= min && newApproval <= max) {
          newLevel = level as RelationshipLevel;
          break;
        }
      }
      romanceHostileSinceGameTimeMs = undefined;
    } else {
      const romanceState = this.evaluateRomanceExit(
        currentRelationship,
        newApproval,
        currentGameTimeMs
      );
      newLevel = romanceState.level;
      romanceHostileSinceGameTimeMs = romanceState.romanceHostileSinceGameTimeMs;
    }

    // Process Unlocks
    // Check available progression items against new level/approval
    const currentUnlocks = currentRelationship.unlocks || [];
    const newUnlocks: RelationshipUnlock[] = [];

    // NOTE: In a real system, we'd want to handle "levels" more robustly than just string comparison,
    // but for now we trust the threshold logic.
    // We check if requiredLevel matches the CURRENT level (or if we want to support cumulative, we'd need an ordering).
    // For simplicity: unlock triggers if we are AT or ABOVE the required level.
    // To do "at or above", we need a numeric weight for levels.

    const levelWeight: Record<RelationshipLevel, number> = {
      hated: -5, enemy: -4, rival: -3, distrusted: -2, wary: -1,
      stranger: 0, acquaintance: 1, friend: 2, close: 3, devoted: 4, romance: 5
    };

    if (companion.progression) {
      companion.progression.forEach(item => {
        // Check if already unlocked
        if (currentUnlocks.some(u => u.id === item.id)) return;

        let requirementsMet = true;

        // Check level requirement
        if (item.requiredLevel) {
          const currentWeight = levelWeight[newLevel];
          const requiredWeight = levelWeight[item.requiredLevel];
          if (currentWeight < requiredWeight) {
            requirementsMet = false;
          }
        }

        // Check approval requirement
        if (item.requiredApproval !== undefined && newApproval < item.requiredApproval) {
          requirementsMet = false;
        }

        if (requirementsMet) {
          newUnlocks.push({ ...item, isUnlocked: true });
        }
      });
    }

    // Create event record
    const approvalEvent: ApprovalEvent = {
      id: generateId(),
      timestamp: Date.now(),
      source: 'event', // Could be passed in
      change,
      reason
    };

    // Update history if level changed
    const history = [...currentRelationship.history];
    if (newLevel !== currentRelationship.level) {
      history.push({
        id: generateId(),
        timestamp: Date.now(),
        description: `Relationship changed from ${currentRelationship.level} to ${newLevel}`,
        type: 'milestone'
      });
    }

    // Add unlock events to history
    newUnlocks.forEach(unlock => {
      history.push({
        id: generateId(),
        timestamp: Date.now(),
        description: `Unlocked: ${unlock.description}`,
        type: 'gift' // or milestone
      });
    });

    return {
      ...companion,
      approvalHistory: [...companion.approvalHistory, approvalEvent],
      relationships: {
        ...companion.relationships,
        [targetId]: {
          ...currentRelationship,
          approval: newApproval,
          level: newLevel,
          history,
          unlocks: [...currentUnlocks, ...newUnlocks],
          romanceHostileSinceGameTimeMs,
        }
      }
    };
  }

  // ============================================================================
  // In-world Romance Timer
  // ============================================================================
  // ADVANCE_TIME reaches this method through companionReducer. It changes only a
  // romance whose durable hostile interval has reached the full 24-hour policy.
  // ============================================================================

  static processInWorldTime(companion: Companion, currentGameTimeMs: number): Companion {
    let relationshipsChanged = false;

    // Check every relationship because the data model is target-keyed even though
    // the current reducer normally updates the player relationship.
    const relationships = Object.fromEntries(
      Object.entries(companion.relationships).map(([targetId, relationship]) => {
        if (relationship.level !== 'romance') {
          return [targetId, relationship];
        }

        const romanceState = this.evaluateRomanceExit(
          relationship,
          relationship.approval,
          currentGameTimeMs
        );

        // Preserve the existing object when neither the timer nor level changed.
        // This lets reducers avoid save churn on unrelated time advances.
        if (
          romanceState.level === relationship.level &&
          romanceState.romanceHostileSinceGameTimeMs === relationship.romanceHostileSinceGameTimeMs
        ) {
          return [targetId, relationship];
        }

        relationshipsChanged = true;
        const history = [...relationship.history];

        // Only the completed 24-hour interval creates a relationship milestone.
        // Starting or clearing the timer remains invisible bookkeeping.
        if (romanceState.level !== relationship.level) {
          history.push({
            id: generateId(),
            timestamp: currentGameTimeMs,
            description: `Relationship changed from ${relationship.level} to ${romanceState.level}`,
            type: 'milestone',
          });
        }

        return [
          targetId,
          {
            ...relationship,
            level: romanceState.level,
            history,
            romanceHostileSinceGameTimeMs: romanceState.romanceHostileSinceGameTimeMs,
          },
        ];
      })
    );

    // A no-op time tick returns the original companion reference. Once the timer
    // changes, the updated relationship remains inside normal persisted state.
    return relationshipsChanged ? { ...companion, relationships } : companion;
  }

  private static evaluateRomanceExit(
    relationship: Relationship,
    approval: number,
    currentGameTimeMs: number
  ): Pick<Relationship, 'level' | 'romanceHostileSinceGameTimeMs'> {
    // Recovery above the enemy boundary cancels any partial interval. A future
    // collapse must then sustain a fresh full day before romance can exit.
    if (approval > this.ROMANCE_EXIT_APPROVAL_THRESHOLD) {
      return { level: 'romance', romanceHostileSinceGameTimeMs: undefined };
    }

    // The first hostile observation starts the durable in-world interval. It does
    // not exit romance, regardless of how deep the single approval loss was.
    const hostileSince = relationship.romanceHostileSinceGameTimeMs ?? currentGameTimeMs;
    const hostileDuration = currentGameTimeMs - hostileSince;
    if (hostileDuration < this.ROMANCE_EXIT_DURATION_MS) {
      return { level: 'romance', romanceHostileSinceGameTimeMs: hostileSince };
    }

    // Once the interval completes, derive the destination from the canonical table
    // so enemy and hated approval retain their existing distinct meanings.
    return {
      level: this.getRelationshipLevel(approval),
      romanceHostileSinceGameTimeMs: undefined,
    };
  }

  static getRelationshipLevel(approval: number): RelationshipLevel {
    for (const [level, [min, max]] of Object.entries(this.APPROVAL_THRESHOLDS)) {
      if (approval >= min && approval <= max && level !== 'romance') {
        return level as RelationshipLevel;
      }
    }
    return 'stranger';
  }

  static checkLoyalty(companion: Companion): boolean {
    // Conservative contract: this only answers whether the companion is still above the
    // minimum retention floor. It does not remove the companion or resolve betrayal.
    return companion.loyalty > this.LOYALTY_RETENTION_FLOOR;
  }
}
