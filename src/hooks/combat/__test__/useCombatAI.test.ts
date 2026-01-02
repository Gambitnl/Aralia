// TODO(lint-intent): 'waitFor' is unused in this test; use it in the assertion path or remove it.
import { renderHook, act, waitFor as _waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCombatAI } from '../useCombatAI';
import { CombatCharacter, BattleMapData } from '../../../types/combat';
import { AI_THINKING_DELAY_MS } from '../../../config/combatConfig';

// Mock dependencies
const mockExecuteAction = vi.fn(() => true);
const mockEndTurn = vi.fn();

// Sample data
const mockCharacter: CombatCharacter = {
  id: 'char1',
  name: 'Goblin',
  team: 'enemy',
  position: { x: 0, y: 0 },
  currentHP: 10,
  maxHP: 10,
  stats: {
    strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10,
    baseInitiative: 0, speed: 30, cr: '1/8'
  },
  armorClass: 10,
  initiative: 0,
  level: 1 as any,
  class: { id: 'fighter', name: 'Fighter', description: '', hitDie: 10, primaryAbility: ['Strength'], savingThrowProficiencies: [], skillProficienciesAvailable: [], numberOfSkillProficiencies: 0, armorProficiencies: [], weaponProficiencies: [], features: [] } as any,
  abilities: [], // No abilities, so it will end turn
  actionEconomy: {
    action: { used: false, remaining: 1 },
    bonusAction: { used: false, remaining: 1 },
    movement: { used: 0, total: 30 },
    reaction: { used: false, remaining: 1 },
    freeActions: 0
  },
  statusEffects: [],
  conditions: []
};

const mockMapData: BattleMapData = {
  dimensions: { width: 10, height: 10 },
  tiles: new Map(),
  theme: 'forest',
  seed: 1
};

// Populate a simple map
for (let x = 0; x < 10; x++) {
  for (let y = 0; y < 10; y++) {
    const id = `${x}-${y}`;
    mockMapData.tiles.set(id, {
      id,
      coordinates: { x, y },
      terrain: 'floor',
      elevation: 0,
      movementCost: 1,
      blocksMovement: false,
      blocksLoS: false,
      decoration: null,
      effects: []
    });
  }
}

describe('useCombatAI', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockExecuteAction.mockClear();
    mockEndTurn.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should remain idle when it is not an AI turn', () => {
    const { result } = renderHook(() => useCombatAI({
      difficulty: 'normal',
      characters: [mockCharacter],
      mapData: mockMapData,
      currentCharacterId: 'other-char', // Not the AI character
      executeAction: mockExecuteAction,
      endTurn: mockEndTurn,
      autoCharacters: new Set()
    }));

    expect(result.current.aiState).toBe('idle');

    // Advance time - nothing should happen
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.aiState).toBe('idle');
  });

  it('should transition to thinking after the configured delay when AI turn starts', async () => {
    const difficulty = 'normal';
    const delay = AI_THINKING_DELAY_MS[difficulty];

    const { result } = renderHook(() => useCombatAI({
      difficulty,
      characters: [mockCharacter],
      mapData: mockMapData,
      currentCharacterId: mockCharacter.id,
      executeAction: mockExecuteAction,
      endTurn: mockEndTurn,
      autoCharacters: new Set()
    }));

    expect(result.current.aiState).toBe('idle');

    // Advance time just before the delay
    act(() => {
      vi.advanceTimersByTime(delay - 100);
    });
    expect(result.current.aiState).toBe('idle');

    // Advance past the delay
    act(() => {
      vi.advanceTimersByTime(101);
    });

    // Since the hook uses an async function internally in useEffect,
    // we need to wait for the state update cycle to complete.
    // However, since we are using fake timers, waitFor might timeout if it depends on real time.
    // We simply wait for the microtask queue to drain which handles the async function start.

    await act(async () => {
       await Promise.resolve();
    });

    // Check if endTurn is eventually called (since character has no abilities)
    // We don't use waitFor here because we control the time.
    expect(mockEndTurn).toHaveBeenCalled();
  });

  it('should respect the difficulty delay setting (hard)', async () => {
    const difficulty = 'hard'; // 1500ms
    const delay = AI_THINKING_DELAY_MS[difficulty];

    const { result } = renderHook(() => useCombatAI({
      difficulty,
      characters: [mockCharacter],
      mapData: mockMapData,
      currentCharacterId: mockCharacter.id,
      executeAction: mockExecuteAction,
      endTurn: mockEndTurn,
      autoCharacters: new Set()
    }));

    expect(result.current.aiState).toBe('idle');

    // Fast forward almost to the delay
    act(() => {
      vi.advanceTimersByTime(delay - 50);
    });
    expect(result.current.aiState).toBe('idle');

    // Complete the delay
    act(() => {
      vi.advanceTimersByTime(100);
    });

    await act(async () => {
       await Promise.resolve();
    });

    expect(mockEndTurn).toHaveBeenCalled();
  });

  it('should respect the difficulty delay setting (easy)', async () => {
    const difficulty = 'easy'; // 500ms
    const delay = AI_THINKING_DELAY_MS[difficulty];

    const { result } = renderHook(() => useCombatAI({
      difficulty,
      characters: [mockCharacter],
      mapData: mockMapData,
      currentCharacterId: mockCharacter.id,
      executeAction: mockExecuteAction,
      endTurn: mockEndTurn,
      autoCharacters: new Set()
    }));

    expect(result.current.aiState).toBe('idle');

    // Fast forward almost to the delay
    act(() => {
      vi.advanceTimersByTime(delay - 50);
    });
    expect(result.current.aiState).toBe('idle');

    // Complete the delay
    act(() => {
      vi.advanceTimersByTime(100);
    });

    await act(async () => {
       await Promise.resolve();
    });

    expect(mockEndTurn).toHaveBeenCalled();
  });
});
