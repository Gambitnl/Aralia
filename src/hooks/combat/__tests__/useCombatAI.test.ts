import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCombatAI } from '../useCombatAI';
import { CombatCharacter, BattleMapData, CombatAction } from '../../../types/combat';
import { AI_THINKING_DELAY_MS } from '../../../config/combatConfig';

const mockEvaluateCombatTurn = vi.fn();

vi.mock('../../../utils/combat/combatAI', () => ({
  evaluateCombatTurn: (...args: unknown[]) => mockEvaluateCombatTurn(...args)
}));

const mockCharacter: CombatCharacter = {
  id: 'goblin',
  name: 'Goblin',
  team: 'enemy',
  currentHP: 10,
  maxHP: 10,
  level: 1 as const,
  class: {
    id: 'fighter',
    name: 'Fighter',
    description: '',
    hitDie: 10,
    primaryAbility: ['Strength'],
    savingThrowProficiencies: [],
    skillProficienciesAvailable: [],
    numberOfSkillProficiencies: 0,
    armorProficiencies: [],
    weaponProficiencies: [],
    features: []
  } as any,
  stats: {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
    baseInitiative: 0,
    speed: 30,
    cr: '1/8'
  },
  armorClass: 10,
  initiative: 1,
  abilities: [
    {
      id: 'goblin-fire',
      name: 'Fire Bolt',
      description: 'A simple ranged attack.',
      type: 'attack',
      target: 'enemy',
      cost: { type: 'action' },
      cooldown: null,
      range: 120,
      effects: [],
      targeting: 'single_enemy',
      // Keep the mocked evaluator authoritative for action choice.
      icon: 'bolt',
      isSignature: true,
      isProficient: true,
      isRecharging: false,
      usesRemaining: null,
      maxUses: null,
      rangeDisplay: null,
      rangeType: 'spell'
    } as any
  ] as any,
  actionEconomy: {
    action: { used: false, remaining: 1 },
    bonusAction: { used: false, remaining: 1 },
    movement: { used: 0, total: 30 },
    reaction: { used: false, remaining: 1 },
    freeActions: 0,
    legendary: { used: 0, total: 0 }
  },
  statusEffects: [],
  conditions: [],
  position: { x: 0, y: 0 }
};

const playerTarget: CombatCharacter = {
  ...mockCharacter,
  id: 'hero',
  name: 'Hero',
  team: 'player',
  position: { x: 2, y: 0 },
  initiative: 2
};

const mockMapData: BattleMapData = {
  dimensions: { width: 4, height: 4 },
  tiles: new Map(
    Array.from({ length: 4 }, (_, x) =>
      Array.from({ length: 4 }, (_, y) => ({ x, y })).map(({ x, y }) => ({
        id: `${x}-${y}`,
        coordinates: { x, y },
        terrain: 'floor',
        elevation: 0,
        movementCost: 1,
        blocksMovement: false,
        blocksLoS: false,
        decoration: null,
        effects: []
      }))
    ).flat().map(tile => [tile.id, tile])
  ),
  theme: 'forest',
  seed: 1
};

const abilityAction: CombatAction = {
  id: 'goblin-ability',
  characterId: mockCharacter.id,
  type: 'ability',
  abilityId: 'goblin-fire',
  targetPosition: playerTarget.position,
  targetCharacterIds: [playerTarget.id],
  cost: { type: 'action' },
  timestamp: 1
};

const endTurnAction: CombatAction = {
  id: 'goblin-end',
  characterId: mockCharacter.id,
  type: 'end_turn',
  cost: { type: 'free' },
  timestamp: 2
};

describe('useCombatAI', () => {
  const mockExecuteAction = vi.fn().mockResolvedValue(true);
  const mockEndTurn = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    mockEvaluateCombatTurn.mockReset();
    mockExecuteAction.mockClear();
    mockEndTurn.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits for async executeAbility before transitioning into the next AI action', async () => {
    let resolveAbility = () => {};
    const mockExecuteAbility = vi.fn(() => new Promise<void>((resolve) => {
      resolveAbility = resolve;
    }));

    mockEvaluateCombatTurn
      .mockReturnValueOnce(abilityAction)
      .mockReturnValueOnce(endTurnAction);

    const { result } = renderHook(() => useCombatAI({
      difficulty: 'easy',
      characters: [mockCharacter, playerTarget],
      mapData: mockMapData,
      currentCharacterId: mockCharacter.id,
      executeAction: mockExecuteAction,
      executeAbility: mockExecuteAbility,
      endTurn: mockEndTurn,
      autoCharacters: new Set()
    }));

    expect(result.current.aiState).toBe('idle');

    act(() => {
      vi.advanceTimersByTime(AI_THINKING_DELAY_MS.easy);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockEvaluateCombatTurn).toHaveBeenCalledTimes(1);
    expect(mockExecuteAbility).toHaveBeenCalledTimes(1);
    expect(mockEndTurn).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(AI_THINKING_DELAY_MS.easy * 3);
    });

    await act(async () => {
      await Promise.resolve();
    });

    // executeAbility is awaited, so the second planning pass is blocked while
    // the action promise is unresolved.
    expect(mockEvaluateCombatTurn).toHaveBeenCalledTimes(1);
    expect(mockExecuteAbility).toHaveBeenCalledTimes(1);
    expect(mockEndTurn).not.toHaveBeenCalled();

    act(() => {
      resolveAbility();
    });

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      vi.advanceTimersByTime(AI_THINKING_DELAY_MS.easy);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockEvaluateCombatTurn).toHaveBeenCalledTimes(2);
    expect(mockEndTurn).toHaveBeenCalledTimes(1);
  });
});
