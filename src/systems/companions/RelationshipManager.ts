/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/companions/RelationshipManager.ts
 * Manages companion relationships, approval changes, and loyalty checks.
 */

// Logic for companion approval and relationship progression
import { Companion, RelationshipLevel, ApprovalEvent, RelationshipEvent } from '../../types/companions';
import { GameState } from '../../types';

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

    return {
      ...companion,
      approvalHistory: [...companion.approvalHistory, approvalEvent],
      relationships: {
        ...companion.relationships,
        [targetId]: {
          ...currentRelationship,
          approval: newApproval,
          level: newLevel,
          history
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
