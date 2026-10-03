/**
 * This file proves the once-only ability-delivery boundary used by CS04.
 *
 * Concentration replacement, damage, and source-loss all enter normal combat
 * through useAbilitySystem. A stable event id must be claimed before Action or
 * command execution so accepted, declined, and replayed requests stay atomic.
 *
 * Exercises: useAbilitySystem ability event claims and explicit reset.
 * Depends on: the production action-cost gate with lightweight command mocks.
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Ability, CombatCharacter } from '../../types/combat';
import { createMockCombatCharacter } from '../../utils/core';
import { useAbilitySystem } from '../useAbilitySystem';

// The delivery ledger belongs to the hook, not to command implementations.
// Empty successful commands isolate that boundary while the production action
// gate still decides whether a request is accepted before the command factory.
vi.mock('../../commands', () => ({
  SpellCommandFactory: { createCommands: vi.fn().mockResolvedValue([]) },
  AbilityCommandFactory: { createCommands: vi.fn().mockReturnValue([]) },
  CommandExecutor: {
    execute: vi.fn().mockReturnValue({
      success: true,
      finalState: { characters: [], combatLog: [] },
    }),
  },
}));

const makeActor = (): CombatCharacter => createMockCombatCharacter({
  id: 'event-owner',
  name: 'Event Owner',
  team: 'player',
  position: { x: 1, y: 1 },
});

const makeAbility = (): Ability => ({
  id: 'event-proof-action',
  name: 'Event Proof Action',
  description: 'A no-effect Action used to prove delivery ownership.',
  type: 'utility',
  cost: { type: 'action' },
  targeting: 'self',
  range: 0,
  effects: [],
});

describe('useAbilitySystem concentration delivery ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts one stable event and makes its replay an atomic no-op', async () => {
    const actor = makeActor();
    const onExecuteAction = vi.fn(() => true);
    const onLogEntry = vi.fn();
    const { result } = renderHook(() => useAbilitySystem({
      characters: [actor],
      mapData: null,
      onExecuteAction,
      onCharacterUpdate: vi.fn(),
      onLogEntry,
    }));
    const delivery = {
      executionEventId: 'cs04-accepted-event-001',
      executionDecision: 'accept' as const,
    };

    await act(async () => {
      await result.current.executeAbility(makeAbility(), actor, actor.position, [actor.id], undefined, undefined, delivery);
      await result.current.executeAbility(makeAbility(), actor, actor.position, [actor.id], undefined, undefined, delivery);
    });

    expect(onExecuteAction).toHaveBeenCalledTimes(1);
    expect(onLogEntry).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringMatching(/Duplicate ability event.*no action, spell slot, effect, or damage/i),
      data: expect.objectContaining({ outcome: 'duplicate_event' }),
    }));
  });

  it('claims a declined event without paying and reopens it only after explicit reset', async () => {
    const actor = makeActor();
    const onExecuteAction = vi.fn(() => true);
    const onLogEntry = vi.fn();
    const { result } = renderHook(() => useAbilitySystem({
      characters: [actor],
      mapData: null,
      onExecuteAction,
      onCharacterUpdate: vi.fn(),
      onLogEntry,
    }));
    const eventId = 'cs04-declined-event-001';

    await act(async () => {
      await result.current.executeAbility(makeAbility(), actor, actor.position, [actor.id], undefined, undefined, {
        executionEventId: eventId,
        executionDecision: 'decline',
      });
      await result.current.executeAbility(makeAbility(), actor, actor.position, [actor.id], undefined, undefined, {
        executionEventId: eventId,
        executionDecision: 'accept',
      });
    });

    expect(onExecuteAction).not.toHaveBeenCalled();
    expect(onLogEntry.mock.calls.map(call => call[0].data?.outcome)).toEqual(
      expect.arrayContaining(['declined_event', 'duplicate_event']),
    );

    // Reset Board calls this exact seam. Only an explicit encounter reset may
    // begin a new delivery epoch in which the same authored event id is legal.
    act(() => result.current.resetProcessedAbilityExecutionEvents());
    await act(async () => {
      await result.current.executeAbility(makeAbility(), actor, actor.position, [actor.id], undefined, undefined, {
        executionEventId: eventId,
        executionDecision: 'accept',
      });
    });

    expect(onExecuteAction).toHaveBeenCalledTimes(1);
  });
});
