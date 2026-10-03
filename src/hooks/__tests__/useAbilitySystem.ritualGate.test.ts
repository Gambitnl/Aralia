/**
 * @file src/hooks/__tests__/useAbilitySystem.ritualGate.test.ts
 *
 * The acceptance proof for agora-f821.38 (Remy, combat sheet q4, 2026-09-20
 * 23:21Z: "start the ceremony only").
 *
 * The bug this pins lived in the seam between two hooks, which is why neither
 * hook's own suite could see it. `useActionExecutor` intercepts a long cast,
 * dispatches START_RITUAL, and returns `true` because the action WAS accepted.
 * `useAbilitySystem` read that `true` as "cleared to cast" and ran the spell
 * anyway, so a ten-minute ceremony also landed instantly on the target.
 *
 * So this test wires the real executor to the real ability system, exactly as
 * the combat screen does, and casts a ten-minute spell through the seam.
 *
 * Called by: focused Vitest runs for the combat ritual gate.
 * Depends on: the real useActionExecutor and useAbilitySystem, a real
 * GameProvider dispatch spy, and mocked command factories that would be the
 * only way an instant spell effect could reach the target.
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useAbilitySystem } from '../useAbilitySystem';
import { useActionExecutor } from '../combat/useActionExecutor';
import { GameProvider } from '../../state/GameContext';
import type { GameState } from '../../types';
import type { AppAction } from '../../state/actionTypes';
import type { Ability, CombatCharacter } from '../../types/combat';
import type { Spell } from '../../types/spells';
import {
  mockCharacter,
  mockTurnState,
  defaultProps,
  mockConsumeAction,
  mockHandleDamage,
  resetActionExecutorMocks,
} from '../combat/__tests__/useActionExecutor.fixtures';

// Commands are the ONLY route by which damage, a condition, or a spent spell
// slot could reach the target. Mocking them means "was a command ever created"
// is the same question as "did the spell resolve".
vi.mock('../../commands', () => ({
  SpellCommandFactory: { createCommands: vi.fn().mockResolvedValue([]) },
  AbilityCommandFactory: { createCommands: vi.fn().mockReturnValue([]) },
  CommandExecutor: {
    execute: vi.fn().mockReturnValue({ success: true, finalState: { characters: [], combatLog: [] } }),
  },
}));

vi.mock('../combat/useTargeting', async () => {
  const React_ = await vi.importActual<typeof import('react')>('react');
  return {
    useTargeting: () => {
      const [selectedAbility, setSelectedAbility] = React_.useState<unknown | null>(null);
      const [targetingMode, setTargetingMode] = React_.useState(false);
      return {
        startTargeting: React_.useCallback((ability: unknown) => {
          setSelectedAbility(ability);
          setTargetingMode(true);
        }, []),
        cancelTargeting: React_.useCallback(() => {
          setSelectedAbility(null);
          setTargetingMode(false);
        }, []),
        selectedAbility,
        targetingMode,
        aoePreview: null,
        teleportDestinationPreview: null,
        params: null,
        previewAoE: vi.fn(),
        previewTeleportDestinations: vi.fn(),
        isTeleportDestination: () => false,
      };
    },
  };
});

const mockDispatch = vi.fn();

/** A ten-minute ceremony. Nothing about it may resolve inside one combat turn. */
const CEREMONY_SPELL = {
  id: 'ten-minute-ceremony',
  name: 'Ten Minute Ceremony',
  level: 1,
  school: 'Divination',
  classes: ['Cleric'],
  description: 'A ceremony that takes ten minutes of uninterrupted work.',
  ritual: true,
  castingTime: { value: 10, unit: 'minute' },
  range: { type: 'distance', distance: 60 },
  components: { verbal: true, somatic: true, material: false },
  duration: { type: 'instantaneous' },
  targeting: { type: 'single', validTargets: ['enemies'] },
  effects: [
    { type: 'DAMAGE', damage: { dice: '4d6', type: 'radiant' }, trigger: { type: 'immediate' }, condition: { type: 'always' } },
    { type: 'STATUS_CONDITION', statusCondition: { name: 'Blinded', duration: { type: 'rounds', value: 3 } }, trigger: { type: 'immediate' }, condition: { type: 'always' } },
  ],
} as unknown as Spell;

const CEREMONY_ABILITY = {
  id: 'ten-minute-ceremony',
  name: 'Ten Minute Ceremony',
  description: 'Begins a ten-minute ceremony.',
  type: 'spell',
  range: 60,
  targeting: 'single_enemy',
  cost: { type: 'action' },
  effects: [],
  spell: CEREMONY_SPELL,
} as unknown as Ability;

const SPELL_SLOTS = { 1: { current: 3, max: 3 } };

const caster: CombatCharacter = {
  ...mockCharacter,
  abilities: [CEREMONY_ABILITY],
  spellSlots: SPELL_SLOTS,
} as unknown as CombatCharacter;

const target: CombatCharacter = {
  ...mockCharacter,
  id: 'target1',
  name: 'Victim',
  team: 'enemy',
  position: { x: 2, y: 0 },
  abilities: [],
} as unknown as CombatCharacter;

/**
 * Wires the two hooks together the way the combat screen does: the executor's
 * `executeAction` IS the ability system's `onExecuteAction`.
 */
function renderCombatSeam(onCharacterUpdate: (character: CombatCharacter) => void) {
  return renderHook(
    () => {
      const executor = useActionExecutor({
        ...defaultProps,
        characters: [caster, target],
        turnState: mockTurnState,
      } as unknown as Parameters<typeof useActionExecutor>[0]);

      return useAbilitySystem({
        characters: [caster, target],
        mapData: null,
        onExecuteAction: executor.executeAction,
        onCharacterUpdate,
        onLogEntry: vi.fn(),
        onAbilityEffect: vi.fn(),
      });
    },
    {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(GameProvider, {
          state: {} as GameState,
          dispatch: mockDispatch as React.Dispatch<AppAction>,
          children,
        }),
    },
  );
}

describe('useAbilitySystem - combat ritual gate starts the ceremony only', () => {
  beforeEach(() => {
    resetActionExecutorMocks();
    mockDispatch.mockClear();
  });

  it('starts the ritual and resolves nothing against the target', async () => {
    const { SpellCommandFactory, CommandExecutor } = await import('../../commands');
    const onCharacterUpdate = vi.fn();

    const { result } = renderCombatSeam(onCharacterUpdate);

    await act(async () => {
      await (result.current.executeAbility as unknown as (
        ability: Ability,
        caster: CombatCharacter,
        position: { x: number; y: number },
        targetIds: string[],
      ) => Promise<void>)(CEREMONY_ABILITY, caster, target.position, [target.id]);
    });

    // The ceremony began.
    const startRitual = mockDispatch.mock.calls
      .map(call => call[0] as AppAction)
      .find(action => action.type === 'START_RITUAL');
    expect(startRitual).toBeDefined();
    expect((startRitual as { payload: { spellName: string; durationTotalSeconds: number } }).payload.spellName)
      .toBe('Ten Minute Ceremony');
    expect((startRitual as { payload: { durationTotalSeconds: number } }).payload.durationTotalSeconds).toBe(600);

    // And the spell did NOT also go off. No command was ever built, so no
    // damage and no condition could have reached the target.
    expect(vi.mocked(SpellCommandFactory.createCommands)).not.toHaveBeenCalled();
    expect(vi.mocked(CommandExecutor.execute)).not.toHaveBeenCalled();
    expect(mockHandleDamage).not.toHaveBeenCalled();

    // No spell slot was spent: the caster is never written back with fewer.
    const casterWrites = onCharacterUpdate.mock.calls
      .map(call => call[0] as CombatCharacter)
      .filter(character => character.id === caster.id);
    for (const write of casterWrites) {
      expect((write as unknown as { spellSlots: typeof SPELL_SLOTS }).spellSlots[1].current).toBe(3);
    }
    expect(caster.spellSlots).toEqual(SPELL_SLOTS);

    // The action itself was never charged, because the gate refuses before cost.
    expect(mockConsumeAction).not.toHaveBeenCalled();

    // Nothing was written to the target at all.
    const targetWrites = onCharacterUpdate.mock.calls
      .map(call => call[0] as CombatCharacter)
      .filter(character => character.id === target.id);
    expect(targetWrites).toEqual([]);
  });
});
