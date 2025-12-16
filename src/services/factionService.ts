/**
 * @file src/services/factionService.ts
 * Service for managing factions, reputation, and world events.
 */

import {
  Faction,
  FactionRelationship,
  FactionRelationshipType,
  PlayerFactionStanding,
  PlayerReputationRank,
  WorldEvent,
  WorldEventType
} from '../types/factions';
import { GameState } from '../types';

export class FactionService {
  /**
   * Calculates the new reputation score after an action
   */
  static calculateReputationChange(
    currentScore: number,
    change: number
  ): number {
    return Math.max(-100, Math.min(100, currentScore + change));
  }

  /**
   * Determines the rank based on reputation score
   */
  static getRankFromScore(score: number): PlayerReputationRank {
    if (score <= -100) return 'Nemesis';
    if (score <= -75) return 'Enemy';
    if (score <= -50) return 'Outlaw';
    if (score <= -25) return 'Untrusted';
    if (score < 10) return 'Unknown';
    if (score < 25) return 'Acquaintance';
    if (score < 50) return 'Associate';
    if (score < 75) return 'Ally';
    if (score < 100) return 'Trusted';
    return 'Champion';
  }

  /**
   * Updates player reputation with a faction and propagates consequences
   */
  static updateReputation(
    gameState: GameState,
    factionId: string,
    change: number,
    reason: string
  ): {
    updatedReputation: Record<string, PlayerFactionStanding>;
    messages: string[];
  } {
    const messages: string[] = [];
    const newReputation = { ...gameState.playerReputation };

    // Ensure entry exists
    if (!newReputation[factionId]) {
      newReputation[factionId] = {
        factionId,
        reputation: 0,
        rank: 'Unknown',
        knownDeeds: [],
        favorsOwed: 0
      };
    } else {
      // Deep copy the entry we are about to modify
      newReputation[factionId] = {
        ...newReputation[factionId],
        knownDeeds: [...newReputation[factionId].knownDeeds]
      };
    }

    const currentStanding = newReputation[factionId];
    const oldRank = currentStanding.rank;
    const newScore = this.calculateReputationChange(currentStanding.reputation, change);
    const newRank = this.getRankFromScore(newScore);

    // Update the target faction
    currentStanding.reputation = newScore;
    currentStanding.rank = newRank;
    currentStanding.knownDeeds.push({
      id: crypto.randomUUID(),
      description: reason,
      date: new Date(gameState.gameTime).getTime(),
      impact: change
    });

    if (oldRank !== newRank) {
      messages.push(`Reputation with ${gameState.factions[factionId]?.name || factionId} changed from ${oldRank} to ${newRank}.`);
    }

    // Ripple effects to allies and enemies
    const faction = gameState.factions[factionId];
    if (faction && faction.relationships) {
      Object.entries(faction.relationships).forEach(([relatedFactionId, rel]) => {
        // Skip if we already updated this one (though currently we only do primary)
        if (relatedFactionId === factionId) return;

        let rippleMultiplier = 0;

        // If you help my friend, I like you (a little)
        if (change > 0 && (rel.type === 'Ally' || rel.type === 'Friendly')) {
          rippleMultiplier = 0.25;
        }
        // If you hurt my friend, I dislike you
        else if (change < 0 && (rel.type === 'Ally' || rel.type === 'Friendly')) {
          rippleMultiplier = 0.5;
        }
        // If you help my enemy, I dislike you
        else if (change > 0 && (rel.type === 'Hostile' || rel.type === 'War')) {
          rippleMultiplier = -0.25;
        }
        // If you hurt my enemy, I might like you
        else if (change < 0 && (rel.type === 'Hostile' || rel.type === 'War')) {
          rippleMultiplier = 0.1; // "The enemy of my enemy..."
        }

        if (rippleMultiplier !== 0) {
          const rippleChange = Math.floor(change * rippleMultiplier);
          if (Math.abs(rippleChange) >= 1) {
            if (!newReputation[relatedFactionId]) {
              newReputation[relatedFactionId] = {
                factionId: relatedFactionId,
                reputation: 0,
                rank: 'Unknown',
                knownDeeds: [],
                favorsOwed: 0
              };
            } else {
               // Deep copy before modifying
               newReputation[relatedFactionId] = {
                 ...newReputation[relatedFactionId],
                 knownDeeds: [...newReputation[relatedFactionId].knownDeeds]
               };
            }

            const relatedStanding = newReputation[relatedFactionId];
            relatedStanding.reputation = this.calculateReputationChange(relatedStanding.reputation, rippleChange);
            relatedStanding.rank = this.getRankFromScore(relatedStanding.reputation);
            // We don't necessarily add a deed for ripples to avoid spam, or we add a "heard about" deed
          }
        }
      });
    }

    return { updatedReputation: newReputation, messages };
  }

  /**
   * Generates a random world event based on active factions
   */
  static generateWorldEvent(gameState: GameState): WorldEvent | null {
    const factionIds = Object.keys(gameState.factions);
    if (factionIds.length < 2) return null;

    // Pick two random factions
    const initiatorId = factionIds[Math.floor(Math.random() * factionIds.length)];
    let targetId = factionIds[Math.floor(Math.random() * factionIds.length)];
    while (targetId === initiatorId) {
      targetId = factionIds[Math.floor(Math.random() * factionIds.length)];
    }

    const initiator = gameState.factions[initiatorId];
    const target = gameState.factions[targetId];

    // Determine event type based on relationship
    const relationship = initiator.relationships[targetId]?.type || 'Neutral';

    let eventType: WorldEventType = 'EconomicBoom'; // Fallback
    let description = '';
    let title = '';

    if (relationship === 'War' || relationship === 'Hostile') {
      const roll = Math.random();
      if (roll < 0.3) {
        eventType = 'TerritoryChange';
        title = 'Border Skirmish';
        description = `${initiator.name} has seized territory from ${target.name} after a bloody skirmish.`;
      } else if (roll < 0.6) {
        eventType = 'EconomicCrash';
        title = 'Trade Blockade';
        description = `${initiator.name} is blockading trade routes to ${target.name}.`;
      } else {
        eventType = 'PeaceTreaty';
        title = 'Ceasefire Negotiations';
        description = `${initiator.name} and ${target.name} have entered ceasefire talks.`;
      }
    } else if (relationship === 'Ally' || relationship === 'Friendly') {
       const roll = Math.random();
       if (roll < 0.5) {
         eventType = 'AllianceFormed';
         title = 'Strengthened Bonds';
         description = `${initiator.name} and ${target.name} have announced a new trade agreement.`;
       } else {
         eventType = 'Festival';
         title = 'Joint Celebration';
         description = `${initiator.name} is hosting a festival in honor of their allies, ${target.name}.`;
       }
    } else {
      // Neutral
      if (Math.random() < 0.1) {
        eventType = 'WarDeclaration';
        title = 'Tensions Rise';
        description = `${initiator.name} has publicly denounced ${target.name}, moving closer to war.`;
      } else {
         eventType = 'EconomicBoom';
         title = 'New Trade Route';
         description = `Merchants have established a new route between ${initiator.name} and ${target.name}.`;
      }
    }

    return {
      id: crypto.randomUUID(),
      type: eventType,
      title,
      description,
      date: new Date(gameState.gameTime).getTime(),
      initiatorFactionId: initiatorId,
      targetFactionId: targetId,
      isActive: true,
      duration: 7 // Default 7 days
    };
  }
}
