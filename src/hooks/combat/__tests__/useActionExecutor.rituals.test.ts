/**
 * @file src/hooks/combat/__tests__/useActionExecutor.rituals.test.ts
 *
 * Proves the combat executor treats a long cast as a ceremony instead of an
 * instant effect. Before this, every ability ran immediately, so a ten-minute
 * ritual resolved in the same instant as a cantrip.
 *
 * The two cases pinned here are the whole contract: a ten-minute spell starts a
 * ritual and applies nothing, and a cantrip is untouched by the new gate.
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useActionExecutor } from '../useActionExecutor';
import { GameProvider } from '../../../state/GameContext';
import type { GameState } from '../../../types';
import type { AppAction } from '../../../state/actionTypes';
import type { Ability, CombatAction, CombatCharacter } from '../../../types/combat';
import type { Spell } from '../../../types/spells';
import type { RitualState } from '../../../types/rituals';
import { ritualReducer } from '../../../state/reducers/ritualReducer';
import { ROUND_DURATION_SECONDS } from '../../../utils/core/spellTimeUtils';
import {
  mockCharacter,
  mockConsumeAction,
  mockHandleDamage,
  mockOnCharacterUpdate,
  mockOnLogEntry,
  mockRecordAction,
  defaultProps,
  resetActionExecutorMocks,
} from './useActionExecutor.fixtures';

const mockDispatch = vi.fn();

/** Renders the hook inside a provider so the executor can reach app dispatch. */
function renderExecutor(caster: CombatCharacter) {
  const props = { ...defaultProps, characters: [caster] };
  return renderHook(() => useActionExecutor(props), {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        GameProvider,
        { state: {} as GameState, dispatch: mockDispatch as React.Dispatch<AppAction>, children },
      ),
  });
}

function makeAbility(id: string, spell: Partial<Spell>): Ability {
  return {
    id,
    name: spell.name ?? id,
    description: '',
    type: 'spell',
    cost: { type: 'action' },
    targeting: 'single',
    range: 60,
    effects: [],
    spell: {
      id,
      name: spell.name ?? id,
      ...spell,
    },
  } as unknown as Ability;
}

const CIRCLE_OF_STARS: Ability = makeAbility('ritual-spell', {
  name: 'Circle of Stars',
  ritual: true,
  castingTime: { value: 10, unit: 'minute' },
} as Partial<Spell>);

const FIRE_BOLT: Ability = makeAbility('fire-bolt', {
  name: 'Fire Bolt',
  level: 0,
  castingTime: { value: 1, unit: 'action' },
} as Partial<Spell>);

function castAction(abilityId: string): CombatAction {
  return {
    id: `cast-${abilityId}`,
    characterId: 'char1',
    type: 'ability',
    abilityId,
    cost: { type: 'action' },
    targetCharacterIds: [],
    timestamp: Date.now(),
  } as CombatAction;
}

describe('useActionExecutor ritual routing', () => {
  beforeEach(() => {
    resetActionExecutorMocks();
    mockDispatch.mockClear();
  });

  it('starts a ritual for a ten-minute cast and applies no effect', async () => {
    const caster: CombatCharacter = { ...mockCharacter, abilities: [CIRCLE_OF_STARS] };
    const { result } = renderExecutor(caster);

    const success = await result.current.executeAction(castAction('ritual-spell'));

    expect(success).toBe(true);

    const ritualDispatch = mockDispatch.mock.calls
      .map(call => call[0] as AppAction)
      .find(action => action.type === 'START_RITUAL');
    expect(ritualDispatch).toBeDefined();
    const ritual = (ritualDispatch as { payload: { spellName: string; durationTotalSeconds: number; progressSeconds: number } }).payload;
    expect(ritual.spellName).toBe('Circle of Stars');
    expect(ritual.durationTotalSeconds).toBe(600);
    expect(ritual.progressSeconds).toBe(0);

    // Nothing about the cast resolved: no resources spent, no character write,
    // no damage, and no action recorded against the turn.
    expect(mockConsumeAction).not.toHaveBeenCalled();
    expect(mockOnCharacterUpdate).not.toHaveBeenCalled();
    expect(mockHandleDamage).not.toHaveBeenCalled();
    expect(mockRecordAction).not.toHaveBeenCalled();

    const messages = mockOnLogEntry.mock.calls.map(call => call[0].message as string);
    expect(messages.some(message => message.includes('begins the ritual of Circle of Stars'))).toBe(true);
  });

  it('executes a cantrip normally', async () => {
    const caster: CombatCharacter = { ...mockCharacter, abilities: [FIRE_BOLT] };
    const { result } = renderExecutor(caster);

    const success = await result.current.executeAction(castAction('fire-bolt'));

    expect(success).toBe(true);
    expect(mockDispatch.mock.calls.some(call => (call[0] as AppAction).type === 'START_RITUAL')).toBe(false);
    expect(mockConsumeAction).toHaveBeenCalled();
    expect(mockRecordAction).toHaveBeenCalled();
    expect(mockOnCharacterUpdate).toHaveBeenCalled();
  });

  /**
   * agora-f821.38 (Remy, combat sheet q4, 2026-09-20 23:21Z: "start the ceremony
   * only"). The gate accepts the action, so it returns true — and a caller that
   * reads plain true goes on to cast the spell instantly ON TOP of the ceremony.
   * The envelope carries the distinction back so the caller can stop.
   */
  it('marks the action envelope as ritualStarted so the caller stops before the cast', async () => {
    const caster: CombatCharacter = { ...mockCharacter, abilities: [CIRCLE_OF_STARS] };
    const { result } = renderExecutor(caster);

    const action = castAction('ritual-spell');
    const success = await result.current.executeAction(action);

    expect(success).toBe(true);
    expect(action.ritualStarted).toBe(true);
  });

  it('leaves ritualStarted unset for an ordinary one-action cast', async () => {
    const caster: CombatCharacter = { ...mockCharacter, abilities: [FIRE_BOLT] };
    const { result } = renderExecutor(caster);

    const action = castAction('fire-bolt');
    await result.current.executeAction(action);

    expect(action.ritualStarted).toBeUndefined();
  });

  /**
   * The other half of the ruling: the slow cast has to actually run over the
   * turns. This takes the RitualState the gate really dispatched and drives it
   * through the real ritual reducer one combat round at a time, so a regression
   * that completes a ten-minute ceremony early — or never — turns this red.
   */
  it('completes the started ritual over turns when nothing interrupts it', async () => {
    const caster: CombatCharacter = { ...mockCharacter, abilities: [CIRCLE_OF_STARS] };
    const { result } = renderExecutor(caster);

    await result.current.executeAction(castAction('ritual-spell'));

    const startDispatch = mockDispatch.mock.calls
      .map(call => call[0] as AppAction)
      .find(action => action.type === 'START_RITUAL') as { payload: RitualState };
    const ritual = startDispatch.payload;

    // 600 seconds of ceremony at 6 seconds a round is 100 rounds of combat.
    const roundsToFinish = ritual.durationTotalSeconds / ROUND_DURATION_SECONDS;
    expect(roundsToFinish).toBe(100);

    let state = { activeRitual: ritual, messages: [], gameTime: 0 } as unknown as GameState;
    const advance = () => {
      state = {
        ...state,
        ...ritualReducer(state, { type: 'ADVANCE_RITUAL', payload: { rounds: 1 } } as AppAction),
      } as GameState;
    };

    for (let round = 0; round < roundsToFinish - 1; round++) advance();

    // One round short: still in progress, and still nothing resolved.
    expect(state.activeRitual?.progressSeconds).toBe((roundsToFinish - 1) * ROUND_DURATION_SECONDS);
    expect(state.activeRitual?.progressSeconds).toBeLessThan(ritual.durationTotalSeconds);
    expect(state.activeRitual?.isPaused).toBeFalsy();

    advance();

    expect(state.activeRitual?.progressSeconds).toBe(ritual.durationTotalSeconds);
    expect(state.messages.some(message => message.text.includes('ritual is complete'))).toBe(true);

    // The executor never resolved the spell itself at any point.
    expect(mockHandleDamage).not.toHaveBeenCalled();
    expect(mockConsumeAction).not.toHaveBeenCalled();
  });
});
