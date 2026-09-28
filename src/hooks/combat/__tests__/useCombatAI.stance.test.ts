/**
 * @file src/hooks/combat/__tests__/useCombatAI.stance.test.ts
 *
 * Guards the witness-memory -> combat-stance wiring (agora-db71.17, WF-G255).
 *
 * `resolveEncounterStance` has lived in `utils/combat/combatAI.ts` since
 * agora-f58b, but `evaluateCombatTurn` only runs it when the caller supplies
 * `options.stance`, and this hook supplied nothing. A creature that had watched
 * the player cut down three guards therefore fought exactly as hard as one that
 * had never seen them.
 *
 * The assertion is on the FOURTH argument handed to the planner, because that
 * argument is the whole wiring: everything below it was already proven by
 * `combatAIEncounterStance.test.ts`.
 *
 * Called by: focused Vitest runs for packet W4-D.
 * Depends on: useCombatAI.ts, GameContext.tsx.
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCombatAI } from '../useCombatAI';
import { GameProvider } from '../../../state/GameContext';
import { getGameEpoch } from '../../../utils/core';
import type { CombatCharacter, BattleMapData, CombatAction } from '../../../types/combat';
import type { GameState } from '../../../types';
import { AI_THINKING_DELAY_MS } from '../../../config/combatConfig';

const mockEvaluateCombatTurn = vi.fn();
vi.mock('../../../utils/combat/combatAI', () => ({
  evaluateCombatTurn: (...args: unknown[]) => mockEvaluateCombatTurn(...args),
}));

const goblin = {
  id: 'goblin',
  name: 'Goblin',
  team: 'enemy',
  currentHP: 10,
  maxHP: 10,
  abilities: [],
  position: { x: 0, y: 0 },
} as unknown as CombatCharacter;

const hero = { ...goblin, id: 'hero', name: 'Hero', team: 'player' } as CombatCharacter;

const mapData = {
  dimensions: { width: 2, height: 2 },
  tiles: new Map(),
  theme: 'forest',
  seed: 1,
} as unknown as BattleMapData;

const endTurnAction = {
  id: 'goblin-end',
  characterId: 'goblin',
  type: 'end_turn',
  cost: { type: 'free' },
  timestamp: 1,
} as CombatAction;

/** Day 4: `getGameDay` counts the epoch as day 1. */
const DAY_FOUR = new Date(getGameEpoch().getTime() + 3 * 24 * 60 * 60 * 1000);

const stateWithMemory = (): GameState =>
  ({
    gameTime: DAY_FOUR,
    npcMemory: {
      goblin: {
        disposition: -10,
        knownFacts: [],
        suspicion: 'none',
        goals: [],
        witnessedActs: [
          {
            id: 'act-1',
            domain: 'combat',
            observation: 'defeated_foes',
            actorId: 'player',
            channel: 'firsthand',
            confidence: 1,
            hops: 0,
            magnitude: 3,
            detail: 'three of my kin',
            day: 4,
          },
        ],
      },
    },
  } as unknown as GameState);

const renderWithState = (state: GameState | null) =>
  renderHook(
    () =>
      useCombatAI({
        difficulty: 'easy',
        characters: [goblin, hero],
        mapData,
        currentCharacterId: 'goblin',
        executeAction: vi.fn().mockResolvedValue(true),
        executeAbility: vi.fn().mockResolvedValue(undefined),
        endTurn: vi.fn(),
        autoCharacters: new Set<string>(),
      }),
    state
      ? {
          wrapper: ({ children }) =>
            React.createElement(GameProvider, { state, dispatch: vi.fn(), children }),
        }
      : undefined
  );

const runOneAiTurn = async () => {
  act(() => {
    vi.advanceTimersByTime(AI_THINKING_DELAY_MS.easy);
  });
  await act(async () => {
    await Promise.resolve();
  });
};

describe('useCombatAI - witness memory reaches the planner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockEvaluateCombatTurn.mockReset();
    mockEvaluateCombatTurn.mockReturnValue(endTurnAction);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes the combatant own npcMemory entry and the game day as the stance input', async () => {
    renderWithState(stateWithMemory());
    await runOneAiTurn();

    expect(mockEvaluateCombatTurn).toHaveBeenCalled();
    const options = mockEvaluateCombatTurn.mock.calls[0][3] as {
      stance?: { memory: { witnessedActs?: unknown[] }; gameDay: number };
    };
    expect(options.stance).toBeDefined();
    expect(options.stance?.gameDay).toBe(4);
    expect(options.stance?.memory.witnessedActs).toHaveLength(1);
  });

  it('passes no stance for a combatant that holds no memory of the player', async () => {
    const state = { ...stateWithMemory(), npcMemory: {} } as GameState;
    renderWithState(state);
    await runOneAiTurn();

    expect(mockEvaluateCombatTurn).toHaveBeenCalled();
    expect(mockEvaluateCombatTurn.mock.calls[0][3]).toEqual({});
  });

  it('still plans a turn when mounted with no GameProvider (standalone unit tests)', async () => {
    renderWithState(null);
    await runOneAiTurn();

    expect(mockEvaluateCombatTurn).toHaveBeenCalled();
    expect(mockEvaluateCombatTurn.mock.calls[0][3]).toEqual({});
  });
});
