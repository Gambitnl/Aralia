/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/companions/BanterManager.ts
 * Manages the selection and progression of companion banter.
 */

import { GameState } from '../../types';
import { BanterDefinition, RelationshipLevel, Companion } from '../../types/companions';
import { BANTER_DEFINITIONS } from '../../data/banter';

const LEVEL_WEIGHTS: Record<RelationshipLevel, number> = {
  enemy: -2,
  rival: -1,
  stranger: 0,
  acquaintance: 1,
  friend: 2,
  close: 3,
  devoted: 4,
  romance: 4 // Treat romance as equivalent to devoted for hierarchy checks
};

export class BanterManager {
  /**
   * Selects a random valid banter based on current game state.
   * Does not manage active state, only selection.
   * Uses gameState.banterCooldowns for persistence.
   */
  static selectBanter(gameState: GameState): BanterDefinition | null {
    const now = Date.now();
    const cooldowns = gameState.banterCooldowns || {};

    const validBanters = BANTER_DEFINITIONS.filter(banter => {
      // 1. Check Cooldown
      if (cooldowns[banter.id]) {
        const cooldownMs = (banter.conditions?.cooldown || 5) * 60 * 1000;
        if (now - cooldowns[banter.id] < cooldownMs) return false;
      }

      // 2. Check Participants
      // Ensure all participants are in the party
      const allPresent = banter.participants.every(id => gameState.companions && gameState.companions[id]);
      if (!allPresent) return false;

      // 3. Check Location
      if (banter.conditions?.locationId && banter.conditions.locationId !== gameState.currentLocationId) {
        return false;
      }

      // 4. Check Relationships
      if (banter.conditions?.minRelationship && gameState.companions) {
        for (const [charId, requiredLevel] of Object.entries(banter.conditions.minRelationship)) {
          // Identify who we are checking relationship FOR.
          // In most cases, it's the companion's relationship with the PLAYER.
          // If the key is 'player', we check player's relationship? No, the key is the Companion ID.
          // Example: { 'kaelen_thorne': 'friend' } means Kaelen must be at least Friend with Player.

          const companion = gameState.companions[charId];
          if (!companion) return false; // Should be caught by participants check, but safety first

          const playerRel = companion.relationships['player'];
          if (!playerRel) return false;

          const currentWeight = LEVEL_WEIGHTS[playerRel.level];
          const requiredWeight = LEVEL_WEIGHTS[requiredLevel];

          if (currentWeight < requiredWeight) return false;
        }
      }

      // 5. Check Chance (Increased frequency: default 30% if not specified)
      const chance = banter.conditions?.chance ?? 0.3;
      if (Math.random() > chance) {
        return false;
      }

      return true;
    });

    if (validBanters.length === 0) return null;

    // Pick one randomly
    return validBanters[Math.floor(Math.random() * validBanters.length)];
  }
}
