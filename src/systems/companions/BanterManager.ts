/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/companions/BanterManager.ts
 * Manages the selection and progression of companion banter.
 */

import { GameState } from '../../types';
// TODO(lint-intent): 'Companion' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { BanterDefinition, RelationshipLevel, Companion as _Companion } from '../../types/companions';
import { BANTER_DEFINITIONS } from '../../data/banter';

const LEVEL_WEIGHTS: Record<RelationshipLevel, number> = {
  enemy: -2,
  hated: -2,
  distrusted: -1,
  wary: -1,
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
    // RALPH: Validates if any banter is eligible to play right now.
    // Filters based on Cooldowns -> Participants -> Location -> Relationship Levels -> Random Chance.
    const now = Date.now();
    const cooldowns = gameState.banterCooldowns || {};

    const validBanters = BANTER_DEFINITIONS.filter(banter => {
      // 1. Check Cooldown
      // RALPH: Prevents the same banter from spamming repeatedly.
      if (cooldowns[banter.id]) {
        const cooldownMs = (banter.conditions?.cooldown || 5) * 60 * 1000;
        if (now - cooldowns[banter.id] < cooldownMs) return false;
      }

      // 2. Check Participants
      // Ensure all participants are in the party
      // RALPH: Essential validation - can't banter if the characters aren't there.
      const allPresent = banter.participants.every(id => gameState.companions && gameState.companions[id]);
      if (!allPresent) return false;

      // 3. Check Location
      // RALPH: Context-sensitivity check (e.g., commenting on a specific dungeon).
      if (banter.conditions?.locationId && banter.conditions.locationId !== gameState.currentLocationId) {
        return false;
      }

      // 4. Check Relationships
      // RALPH: Checks if the dynamic relationship state meets the requirements for this specific line.
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
      // RALPH: Probabilistic gate to make banter feel organic rather than deterministic.
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
