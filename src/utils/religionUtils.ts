
/**
 * @file src/utils/religionUtils.ts
 * Utility functions for managing divine favor, ranking, and temple services.
 */
import { GameState, Item } from '../types';
import { Deity, DivineFavor, FavorRank, ReligionState, TempleService, TempleServiceRequirement } from '../types/religion';
import { DEITIES, TEMPLE_SERVICES } from '../data/religion';

/**
 * Calculates the FavorRank based on a numerical favor score.
 *
 * @param score The raw favor score (-100 to 100).
 * @returns The corresponding FavorRank.
 */
export const getFavorRank = (score: number): FavorRank => {
  if (score <= -50) return 'Heretic';
  if (score <= -10) return 'Shunned';
  if (score < 10) return 'Neutral';
  if (score < 40) return 'Initiate';
  if (score < 75) return 'Devotee';
  if (score < 95) return 'Champion';
  return 'Chosen';
};

/**
 * Checks if a player meets the requirements for a temple service.
 *
 * @param gameState The current game state.
 * @param deityId The ID of the deity offering the service.
 * @param serviceId The ID of the service being requested.
 * @returns Object containing success boolean and failure reason if any.
 */
export const canAffordTempleService = (
  gameState: GameState,
  deityId: string,
  serviceId: string
): { success: boolean; reason?: string } => {
  const service = TEMPLE_SERVICES[serviceId];
  if (!service) return { success: false, reason: 'Service not found.' };

  const req = service.requirement;
  const playerGold = gameState.gold;
  const playerFavor = gameState.religion?.deityFavor[deityId]?.score || 0;

  // Check Gold
  if (req.goldCost && playerGold < req.goldCost) {
    return { success: false, reason: `Not enough gold. (Required: ${req.goldCost})` };
  }

  // Check Favor
  if (req.minFavor && playerFavor < req.minFavor) {
    return { success: false, reason: `Not enough favor. (Required: ${req.minFavor})` };
  }

  // Check Quest
  if (req.questId) {
    const quest = gameState.questLog.find(q => q.id === req.questId);
    if (!quest || quest.status !== 'Completed') {
      return { success: false, reason: 'Quest requirement not met.' };
    }
  }

  // Check Item Cost
  if (req.itemCost) {
    const itemCount = gameState.inventory.filter(i => i.id === req.itemCost!.itemId).length;
    if (itemCount < req.itemCost.count) {
      return { success: false, reason: `Missing required items.` };
    }
  }

  return { success: true };
};

/**
 * Modifies the player's favor with a specific deity.
 * Returns a NEW GameState object (does not mutate).
 *
 * @param gameState The current game state.
 * @param deityId The ID of the deity.
 * @param amount The amount to change favor by.
 * @returns Updated GameState.
 */
export const modifyFavor = (
  gameState: GameState,
  deityId: string,
  amount: number
): GameState => {
  if (!DEITIES[deityId]) {
    console.warn(`Deity ${deityId} not found.`);
    return gameState;
  }

  // Ensure religion state exists, defaulting if missing (e.g. old saves)
  const currentReligionState: ReligionState = gameState.religion || {
    deityFavor: {},
    discoveredDeities: [],
    activeBlessings: []
  };

  const currentFavor = currentReligionState.deityFavor[deityId] || {
    score: 0,
    rank: 'Neutral',
    consecutiveDaysPrayed: 0
  };

  const newScore = Math.max(-100, Math.min(100, currentFavor.score + amount));
  const newRank = getFavorRank(newScore);

  const updatedReligionState: ReligionState = {
    ...currentReligionState,
    deityFavor: {
      ...currentReligionState.deityFavor,
      [deityId]: {
        ...currentFavor,
        score: newScore,
        rank: newRank,
      }
    }
  };

  // If the deity was not previously discovered, add them (if favor becomes positive)
  if (newScore > 0 && !updatedReligionState.discoveredDeities.includes(deityId)) {
    updatedReligionState.discoveredDeities = [...updatedReligionState.discoveredDeities, deityId];
  }

  return {
    ...gameState,
    religion: updatedReligionState
  };
};

/**
 * Helper to get available services for a generic temple based on deity.
 * In a real scenario, specific temples might have limited lists.
 */
export const getServicesForDeity = (deityId: string): TempleService[] => {
  // Return a curated list based on domains for now, or just all for testing
  // Ideally this logic would live in the Temple data structure
  const deity = DEITIES[deityId];
  if (!deity) return [];

  const services: TempleService[] = [];

  // Basic healing for Life/Light/Nature
  if (deity.domains.includes('Life') || deity.domains.includes('Light') || deity.domains.includes('Nature')) {
    services.push(TEMPLE_SERVICES['healing_word']);
    services.push(TEMPLE_SERVICES['cure_disease']);
  }

  // Restoration for most good/neutral
  if (deity.alignment.includes('Good') || deity.alignment.includes('Neutral')) {
     services.push(TEMPLE_SERVICES['restoration']);
  }

  // Knowledge specific
  if (deity.domains.includes('Knowledge') || deity.domains.includes('Arcana')) {
    services.push(TEMPLE_SERVICES['identify_magic']);
    services.push(TEMPLE_SERVICES['divine_guidance']);
  }

  // War/Strength
  if (deity.domains.includes('War')) {
     services.push(TEMPLE_SERVICES['blessing_strength']);
  }

  return services;
};
