
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCombatOutcome } from '../useCombatOutcome';
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
      xp: 200 // 1 enemy at CR 1 (level acts as CR) → 200 XP per the 5e table
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

    act(() => {
      result.current.forceOutcome('victory');
    });

    await waitFor(() => {
      expect(result.current.battleState).toBe('victory');
    });

    // Forced victory generates default rewards if none existed
    expect(result.current.rewards).not.toBeNull();
  });

  it('should support forcing flee outcome without rewards (GG-467)', async () => {
    const { result } = renderHook(() => useCombatOutcome({
      characters: [mockPlayer, mockEnemy],
      initialEnemies
    }));

    act(() => {
      result.current.forceOutcome('flee');
    });

    await waitFor(() => {
      expect(result.current.battleState).toBe('flee');
    });

    expect(result.current.rewards).toBeNull();
  });

  it('should detect flee when all active player characters have escaped (GG-467)', async () => {
    const { result } = renderHook(() => useCombatOutcome({
      characters: [mockPlayer, mockEnemy],
      initialEnemies,
      escapedPlayerIds: ['p1']
    }));

    expect(result.current.battleState).toBe('flee');
    expect(result.current.rewards).toBeNull();
  });

  it('passes canonical fractional CR to generateLoot and computes fractional CR XP', async () => {
    const goblinEnemy: CombatCharacter = {
      ...mockEnemy,
      id: 'goblin-1',
      name: 'Goblin',
      level: 0.25,
      cr: '1/4',
      stats: { ...mockEnemy.stats, cr: '1/4' }
    };
    const defeatedGoblin = { ...goblinEnemy, currentHP: 0 };

    const { result, rerender } = renderHook(({ chars }) => useCombatOutcome({
      characters: chars,
      initialEnemies: [goblinEnemy]
    }), {
      initialProps: { chars: [mockPlayer, goblinEnemy] }
    });

    rerender({ chars: [mockPlayer, defeatedGoblin] });

    await waitFor(() => {
      expect(result.current.battleState).toBe('victory');
    });

    expect(generateLoot).toHaveBeenCalledWith([
      expect.objectContaining({
        name: 'Goblin',
        cr: '1/4'
      })
    ]);
    expect(result.current.rewards?.xp).toBe(50); // CR 1/4 is worth 50 XP
  });

  it('preserves CR 0 for rats and does not inflate to CR 1', async () => {
    const ratEnemy: CombatCharacter = {
      ...mockEnemy,
      id: 'rat-1',
      name: 'Rat',
      level: 0,
      cr: '0',
      stats: { ...mockEnemy.stats, cr: '0' }
    };
    const defeatedRat = { ...ratEnemy, currentHP: 0 };

    const { result, rerender } = renderHook(({ chars }) => useCombatOutcome({
      characters: chars,
      initialEnemies: [ratEnemy]
    }), {
      initialProps: { chars: [mockPlayer, ratEnemy] }
    });

    rerender({ chars: [mockPlayer, defeatedRat] });

    await waitFor(() => {
      expect(result.current.battleState).toBe('victory');
    });

    expect(generateLoot).toHaveBeenCalledWith([
      expect.objectContaining({
        name: 'Rat',
        cr: '0'
      })
    ]);
    expect(result.current.rewards?.xp).toBe(10); // CR 0 is worth 10 XP
  });
});
