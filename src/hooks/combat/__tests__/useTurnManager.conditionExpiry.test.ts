/**
 * This file tests mirrored spell-condition expiry at turn start.
 *
 * StatusConditionCommand writes both `statusEffects` and `conditions` because
 * Aralia still has runtime systems reading each mirror. These tests protect the
 * turn lifecycle cleanup that keeps those mirrors synchronized when a spell
 * condition expires.
 *
 * Called by: Vitest
 * Depends on: useTurnManager.ts and the shared combat-character test factory
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { advanceTurnEndConditionExpiry, useTurnManager } from '../useTurnManager';
import { createMockCombatCharacter } from '../../../utils/core';
import type { CombatCharacter, CombatLogEntry } from '../../../types/combat';

// ============================================================================
// Combat AI Test Boundary
// ============================================================================
// These tests inspect deterministic turn-start bookkeeping. AI execution is
// disabled so no background behavior competes with condition expiry.
// ============================================================================
vi.mock('../useCombatAI', () => ({
  useCombatAI: () => ({ aiState: 'idle' })
}));

// ============================================================================
// Test Character Builder
// ============================================================================
// The character starts with both mirrors for the same spell condition. A
// one-round duration means the first turn start should expire it.
// ============================================================================
const createMirroredConditionCharacter = (): CombatCharacter => createMockCombatCharacter({
  id: 'condition-target',
  name: 'Condition Target',
  team: 'player',
  statusEffects: [{
    id: 'status-restrained',
    name: 'Restrained',
    type: 'debuff',
    duration: 1,
    source: 'Web',
    sourceCasterId: 'caster',
    effect: { type: 'condition' }
  }],
  conditions: [{
    name: 'Restrained',
    duration: { type: 'rounds', value: 1 },
    appliedTurn: 1,
    source: 'Web',
    sourceCasterId: 'caster'
  }]
});

// ============================================================================
// Mirrored Condition Expiry
// ============================================================================
// A spell condition is only gone when both mirrors are gone. This prevents
// invisible stale mechanics after the player-facing label disappears, and it
// prevents stale labels after the structured condition expires.
// ============================================================================
describe('useTurnManager mirrored condition expiry', () => {
  it('expires matching statusEffects and conditions together with one cleanup log', () => {
    const character = createMirroredConditionCharacter();
    const onCharacterUpdate = vi.fn<(updated: CombatCharacter) => void>();
    const onLogEntry = vi.fn<(entry: CombatLogEntry) => void>();
    const { result } = renderHook(() => useTurnManager({
      characters: [character],
      mapData: null,
      onCharacterUpdate,
      onLogEntry
    }));

    act(() => {
      result.current.initializeCombat([character]);
    });

    const updated = onCharacterUpdate.mock.calls
      .map(call => call[0])
      .reverse()
      .find(candidate => candidate.id === character.id);

    expect(updated?.statusEffects).toHaveLength(0);
    expect(updated?.conditions).toHaveLength(0);
    expect(onLogEntry).toHaveBeenCalledWith(expect.objectContaining({
      type: 'status',
      message: "Condition Target's Restrained condition ends.",
      characterId: character.id,
      data: expect.objectContaining({ cleanup: 'mirrored_condition_expiry' })
    }));
  });

  it('expires an end-of-current-turn condition from both mirrors', () => {
    const character = createMockCombatCharacter({
      id: 'poisoned-target',
      name: 'Poisoned Target',
      statusEffects: [{
        id: 'status-poisoned',
        name: 'Poisoned',
        type: 'debuff',
        duration: 1,
        effect: { type: 'condition' }
      }],
      conditions: [{
        name: 'Poisoned',
        duration: { type: 'until_end_of_current_turn', value: 0 },
        appliedTurn: 1,
        turnEndEventsRemaining: 1
      }]
    });

    // Stinking Cloud's rider governs the whole current turn and then leaves
    // both the visible status list and the structured rules list.
    const result = advanceTurnEndConditionExpiry(character);

    expect(result.expiredNames).toEqual(['Poisoned']);
    expect(result.character.conditions).toHaveLength(0);
    expect(result.character.statusEffects).toHaveLength(0);
  });

  it('waits for the next affected-creature turn end when one future turn remains', () => {
    const character = createMockCombatCharacter({
      id: 'blinded-target',
      name: 'Blinded Target',
      statusEffects: [{
        id: 'status-blinded',
        name: 'Blinded',
        type: 'debuff',
        duration: 1,
        effect: { type: 'condition' }
      }],
      conditions: [{
        name: 'Blinded',
        duration: { type: 'turn_end', value: 1 },
        appliedTurn: 1,
        turnEndEventsRemaining: 2
      }]
    });

    // Holy Aura's retaliation survives the attacker's current turn end, then
    // expires from both mirrors when that attacker finishes its next turn.
    const afterCurrentTurn = advanceTurnEndConditionExpiry(character);
    expect(afterCurrentTurn.expiredNames).toEqual([]);
    expect(afterCurrentTurn.character.conditions?.[0]?.turnEndEventsRemaining).toBe(1);
    expect(afterCurrentTurn.character.statusEffects).toHaveLength(1);

    const afterNextTurn = advanceTurnEndConditionExpiry(afterCurrentTurn.character);
    expect(afterNextTurn.expiredNames).toEqual(['Blinded']);
    expect(afterNextTurn.character.conditions).toHaveLength(0);
    expect(afterNextTurn.character.statusEffects).toHaveLength(0);
  });
});
