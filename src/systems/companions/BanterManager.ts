/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/companions/BanterManager.ts
 * Manages the selection and progression of companion banter.
 */

import { GameState } from '../../types';
import { BanterDefinition, BanterLine } from '../../types/companions';
import { BANTER_DEFINITIONS } from '../../data/banter';

export class BanterManager {
  private static cooldowns: Record<string, number> = {}; // banterId -> timestamp

  /**
   * Selects a random valid banter based on current game state.
   * Does not manage active state, only selection.
   */
  static selectBanter(gameState: GameState): BanterDefinition | null {
    const now = Date.now();
    const validBanters = BANTER_DEFINITIONS.filter(banter => {
      // 1. Check Cooldown
      if (this.cooldowns[banter.id]) {
        const cooldownMs = (banter.conditions?.cooldown || 5) * 60 * 1000;
        if (now - this.cooldowns[banter.id] < cooldownMs) return false;
      }

      // 2. Check Participants
      const allPresent = banter.participants.every(id => gameState.companions && gameState.companions[id]);
      if (!allPresent) return false;

      // 3. Check Location
      if (banter.conditions?.locationId && banter.conditions.locationId !== gameState.currentLocationId) {
        return false;
      }

      // 4. Check Chance (Increased frequency: default 30% if not specified)
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

  static markBanterUsed(banterId: string) {
    this.cooldowns[banterId] = Date.now();
  }
}
