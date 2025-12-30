/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/companions/RelationshipManager.ts
 * Manages companion relationships, approval changes, and loyalty checks.
 */

// Logic for companion approval and relationship progression
// TODO(lint-intent): 'RelationshipEvent' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { Companion, RelationshipLevel, ApprovalEvent, RelationshipEvent as _RelationshipEvent, RelationshipUnlock } from '../../types/companions';
// TODO(lint-intent): 'GameState' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { GameState as _GameState } from '../../types';

export class RelationshipManager {
  private static readonly APPROVAL_THRESHOLDS: Record<RelationshipLevel, [number, number]> = {
    enemy: [-100, -70],
    rival: [-69, -30],
    stranger: [-29, 9],
    acquaintance: [10, 29],
    friend: [30, 59],
    close: [60, 89],
    devoted: [90, 100],
    romance: [90, 100], // Romance is a special state, shares range with devoted but implies different flags
  };

  /**
   * Calculates the new approval value and returns the updated companion state.
   */
  static processApprovalEvent(
    companion: Companion,
    targetId: string, // Usually player ID
    change: number,
    reason: string
  ): Companion {
    const currentRelationship = companion.relationships[targetId] || {
      targetId,
      level: 'stranger',
      approval: 0,
      history: [],
      unlocks: [],
    };

    const newApproval = Math.max(-100, Math.min(100, currentRelationship.approval + change));

    // Determine new level based on approval
    // Note: We don't automatically switch to 'romance', that requires explicit triggers.
    // We strictly map based on thresholds unless current state is 'romance'.
    let newLevel: RelationshipLevel = currentRelationship.level;

    if (newLevel !== 'romance') {
       for (const [level, [min, max]] of Object.entries(this.APPROVAL_THRESHOLDS)) {
         if (newApproval >= min && newApproval <= max) {
           newLevel = level as RelationshipLevel;
           break;
         }
       }
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
        enemy: -2, rival: -1, stranger: 0, acquaintance: 1, friend: 2, close: 3, devoted: 4, romance: 4
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
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      source: 'event', // Could be passed in
      change,
      reason
    };

    // Update history if level changed
    const history = [...currentRelationship.history];
    if (newLevel !== currentRelationship.level) {
      history.push({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        description: `Relationship changed from ${currentRelationship.level} to ${newLevel}`,
        type: 'milestone'
      });
    }

    // Add unlock events to history
    newUnlocks.forEach(unlock => {
        history.push({
            id: crypto.randomUUID(),
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
          unlocks: [...currentUnlocks, ...newUnlocks]
        }
      }
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
    // Simple check: if loyalty is too low, they might leave
    // This is a placeholder for more complex logic
    return companion.loyalty > 10;
  }
}
