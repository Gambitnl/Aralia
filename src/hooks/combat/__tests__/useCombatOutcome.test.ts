
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCombatOutcome, BattleOutcome } from '../useCombatOutcome';
import { CombatCharacter } from '../../../types/combat';
import { generateLoot } from '../../../services/lootService';

// Mock loot generation
vi.mock('../../../services/lootService', () => ({
  generateLoot: vi.fn(() => ({ gold: 50, items: [] }))
}));

describe('useCombatOutcome', () => {
  const mockPlayer: CombatCharacter = {
    id: 'p1',
    name: 'Hero',
    team: 'player',
    currentHP: 10,
    maxHP: 10,
    level: 1,
    class: 'Fighter',
    stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, baseInitiative: 0, proficiencyBonus: 2 },
    abilities: [],
    position: { x: 0, y: 0 },
    actionEconomy: { action: { used: false, remaining: 1 }, bonusAction: { used: false, remaining: 1 }, reaction: { used: false, remaining: 1 }, movement: { used: 0, total: 30 }, freeActions: 1 },
    statusEffects: []
  } as unknown as CombatCharacter;

  const mockEnemy: CombatCharacter = {
    id: 'e1',
    name: 'Goblin',
    team: 'enemy',
    currentHP: 5,
    maxHP: 5,
    level: 1, // acts as CR
    creatureTypes: ['Humanoid'],
    stats: { strength: 8, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 8, charisma: 8, baseInitiative: 2, proficiencyBonus: 2 },
    abilities: [],
    position: { x: 5, y: 5 },
    actionEconomy: { action: { used: false, remaining: 1 }, bonusAction: { used: false, remaining: 1 }, reaction: { used: false, remaining: 1 }, movement: { used: 0, total: 30 }, freeActions: 1 },
    statusEffects: []
  } as unknown as CombatCharacter;

  const initialEnemies = [mockEnemy];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with active state', () => {
    const { result } = renderHook(() => useCombatOutcome({
      characters: [mockPlayer, mockEnemy],
      initialEnemies
    }));

    expect(result.current.battleState).toBe('active');
    expect(result.current.rewards).toBeNull();
  });

  it('should detect victory when all enemies are defeated', async () => {
    const defeatedEnemy = { ...mockEnemy, currentHP: 0 };

    const { result, rerender } = renderHook(({ chars }) => useCombatOutcome({
      characters: chars,
      initialEnemies
    }), {
      initialProps: { chars: [mockPlayer, mockEnemy] }
    });

    expect(result.current.battleState).toBe('active');

    // Update characters with defeated enemy
    rerender({ chars: [mockPlayer, defeatedEnemy] });

    await waitFor(() => {
      expect(result.current.battleState).toBe('victory');
    });

    expect(generateLoot).toHaveBeenCalled();
    expect(result.current.rewards).toEqual({
      gold: 50,
      items: [],
      xp: 50 // 1 enemy * 50 xp
    });
  });

  it('should detect defeat when all players are defeated', async () => {
    const defeatedPlayer = { ...mockPlayer, currentHP: 0 };

    const { result, rerender } = renderHook(({ chars }) => useCombatOutcome({
      characters: chars,
      initialEnemies
    }), {
      initialProps: { chars: [mockPlayer, mockEnemy] }
    });

    rerender({ chars: [defeatedPlayer, mockEnemy] });

    await waitFor(() => {
      expect(result.current.battleState).toBe('defeat');
    });

    expect(result.current.rewards).toBeNull();
  });

  it('should not trigger victory if no enemies existed initially', async () => {
    const { result } = renderHook(() => useCombatOutcome({
      characters: [mockPlayer],
      initialEnemies: []
    }));

    expect(result.current.battleState).toBe('active');
  });

  it('should allow forcing an outcome', async () => {
    const { result } = renderHook(() => useCombatOutcome({
      characters: [mockPlayer, mockEnemy],
      initialEnemies
    }));

    result.current.forceOutcome('victory');

    await waitFor(() => {
      expect(result.current.battleState).toBe('victory');
    });

    // Forced victory generates default rewards if none existed
    expect(result.current.rewards).not.toBeNull();
  });
});
