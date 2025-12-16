
import { describe, it, expect } from 'vitest';
import { FactionService } from '../factionService';
import { GameState } from '../../types';
import { Faction, PlayerFactionStanding } from '../../types/factions';

describe('FactionService', () => {
  const mockFactions: Record<string, Faction> = {
    'faction-a': {
      id: 'faction-a',
      name: 'Kingdom of A',
      description: 'A powerful kingdom',
      category: 'Kingdom',
      power: 80,
      influence: 70,
      wealth: 90,
      relationships: {
        'faction-b': { targetFactionId: 'faction-b', type: 'Ally', score: 60 },
        'faction-c': { targetFactionId: 'faction-c', type: 'Hostile', score: -60 },
      },
      goals: [],
      beliefs: [],
      assets: [],
      color: 'blue'
    },
    'faction-b': {
      id: 'faction-b',
      name: 'Republic of B',
      description: 'A trading republic',
      category: 'Kingdom',
      power: 50,
      influence: 80,
      wealth: 100,
      relationships: {
        'faction-a': { targetFactionId: 'faction-a', type: 'Ally', score: 60 },
      },
      goals: [],
      beliefs: [],
      assets: [],
      color: 'green'
    },
    'faction-c': {
      id: 'faction-c',
      name: 'Empire of C',
      description: 'An evil empire',
      category: 'Kingdom',
      power: 90,
      influence: 50,
      wealth: 60,
      relationships: {
        'faction-a': { targetFactionId: 'faction-a', type: 'Hostile', score: -60 },
      },
      goals: [],
      beliefs: [],
      assets: [],
      color: 'red'
    }
  };

  const mockGameState = {
    factions: mockFactions,
    playerReputation: {},
    gameTime: new Date()
  } as unknown as GameState;

  it('calculates reputation change correctly', () => {
    expect(FactionService.calculateReputationChange(0, 10)).toBe(10);
    expect(FactionService.calculateReputationChange(90, 20)).toBe(100); // Cap at 100
    expect(FactionService.calculateReputationChange(-90, -20)).toBe(-100); // Floor at -100
  });

  it('determines rank from score correctly', () => {
    expect(FactionService.getRankFromScore(100)).toBe('Champion');
    expect(FactionService.getRankFromScore(55)).toBe('Ally');
    expect(FactionService.getRankFromScore(0)).toBe('Unknown');
    expect(FactionService.getRankFromScore(-80)).toBe('Enemy');
  });

  it('updates reputation and propagates ripples', () => {
    const result = FactionService.updateReputation(
      mockGameState,
      'faction-a',
      20,
      'Saved the king'
    );

    const newReputation = result.updatedReputation;

    // Direct effect
    expect(newReputation['faction-a'].reputation).toBe(20);
    expect(newReputation['faction-a'].rank).toBe('Acquaintance');

    // Ripple to Ally (Faction B should increase)
    // 20 * 0.25 = 5
    expect(newReputation['faction-b'].reputation).toBe(5);

    // Ripple to Enemy (Faction C should decrease)
    // 20 * -0.25 = -5
    expect(newReputation['faction-c'].reputation).toBe(-5);
  });

  it('generates a world event', () => {
    const event = FactionService.generateWorldEvent(mockGameState);
    expect(event).not.toBeNull();
    if (event) {
      expect(event.initiatorFactionId).toBeDefined();
      expect(event.targetFactionId).toBeDefined();
      expect(event.description).toBeDefined();
    }
  });
});
