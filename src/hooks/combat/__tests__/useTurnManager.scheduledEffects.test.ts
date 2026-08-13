/**
 * This file proves scheduled damage is bound to the live turn coordinator.
 *
 * It mounts the exact CS35 actors and canonical schedules, advances ordinary
 * turns, and verifies start-of-target Fire, end-of-target Acid, once-only Acid
 * consumption, recurring Fire, selective removal, HP, and log order.
 *
 * Exercises: useTurnManager and useCombatEngine scheduled-effect integration.
 * Depends on: the CS35 scenario fixture and deterministic replay roller.
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CombatCharacter, CombatLogEntry } from '../../../types/combat';
import { createMockCombatCharacter } from '../../../utils/core';
import { useTurnManager } from '../useTurnManager';
import {
  createDamageOverTimeScheduledEffects,
  DAMAGE_OVER_TIME_ACID_SCHEDULE_ID,
  DAMAGE_OVER_TIME_SEARING_SCHEDULE_ID,
  DAMAGE_OVER_TIME_SOURCE_ID,
  DAMAGE_OVER_TIME_TARGET_ID,
  getDamageOverTimeScheduledEffectsInitiativeTotal,
  prepareDamageOverTimeScheduledEffectsCharacters,
  rollDamageOverTimeScheduledEffect,
} from '../../../components/DesignPreview/steps/scenarioControls/damageOverTimeScheduledEffectsScenarioControls';

// ============================================================================
// Live Turn Sequence
// ============================================================================
// Local character state mirrors the parent component in production. Rerendering
// after every turn gives the hook the HP written by its previous phase before
// the next phase begins.
// ============================================================================

describe('useTurnManager scheduled damage phases', () => {
  it('fires exact target phases once, consumes Acid, recurs Fire, and honors removal', async () => {
    let charactersState = prepareDamageOverTimeScheduledEffectsCharacters([
      createMockCombatCharacter({ id: DAMAGE_OVER_TIME_SOURCE_ID, name: 'Ember Arcanist' }),
      createMockCombatCharacter({ id: DAMAGE_OVER_TIME_TARGET_ID, name: 'Marked Guard' }),
    ]);
    const logs: CombatLogEntry[] = [];
    const onCharacterUpdate = (updatedCharacter: CombatCharacter) => {
      charactersState = charactersState.map(character => (
        character.id === updatedCharacter.id ? updatedCharacter : character
      ));
    };
    const { result, rerender } = renderHook(
      ({ chars }: { chars: CombatCharacter[] }) => useTurnManager({
        characters: chars,
        mapData: null,
        onCharacterUpdate,
        onLogEntry: entry => logs.push(entry),
        initiativeRoller: getDamageOverTimeScheduledEffectsInitiativeTotal,
        scheduledEffectDiceRoller: (dice, context) => (
          rollDamageOverTimeScheduledEffect(dice, context.scheduledEffect)
        ),
      }),
      { initialProps: { chars: charactersState } },
    );

    act(() => {
      result.current.initializeCombat(charactersState);
      const schedules = createDamageOverTimeScheduledEffects();
      schedules.forEach(effect => {
        result.current.addScheduledSpellEffect(effect);
      });
      // Reset/hydration can republish the same stable IDs. The live queue must
      // replace them rather than creating a double-fire pair.
      schedules.forEach(effect => {
        result.current.addScheduledSpellEffect(effect);
      });
    });
    rerender({ chars: charactersState });

    expect(result.current.turnState).toMatchObject({
      currentTurn: 1,
      currentCharacterId: DAMAGE_OVER_TIME_SOURCE_ID,
      turnOrder: [DAMAGE_OVER_TIME_SOURCE_ID, DAMAGE_OVER_TIME_TARGET_ID],
    });
    expect(result.current.scheduledSpellEffects.map(effect => effect.id)).toEqual([
      DAMAGE_OVER_TIME_SEARING_SCHEDULE_ID,
      DAMAGE_OVER_TIME_ACID_SCHEDULE_ID,
    ]);

    // Ending the owner turn starts the target turn. Only Searing Smite matches
    // that phase, so HP drops by the pinned 1d6 total and Acid remains queued.
    await act(async () => {
      await result.current.endTurn();
    });
    rerender({ chars: charactersState });
    expect(result.current.turnState.currentCharacterId).toBe(DAMAGE_OVER_TIME_TARGET_ID);
    expect(charactersState.find(character => character.id === DAMAGE_OVER_TIME_TARGET_ID)?.currentHP)
      .toBe(56);
    expect(result.current.scheduledSpellEffects.map(effect => effect.id)).toEqual([
      DAMAGE_OVER_TIME_SEARING_SCHEDULE_ID,
      DAMAGE_OVER_TIME_ACID_SCHEDULE_ID,
    ]);

    // Ending the target turn fires only Melf's Acid Arrow. Its once frequency
    // consumes that one record while leaving recurring Fire independently live.
    await act(async () => {
      await result.current.endTurn();
    });
    rerender({ chars: charactersState });
    expect(charactersState.find(character => character.id === DAMAGE_OVER_TIME_TARGET_ID)?.currentHP)
      .toBe(51);
    expect(result.current.scheduledSpellEffects.map(effect => effect.id))
      .toEqual([DAMAGE_OVER_TIME_SEARING_SCHEDULE_ID]);

    // A second source-to-target transition produces one more Fire tick and no
    // second Acid tick. Damage logs therefore preserve exact phase order.
    await act(async () => {
      await result.current.endTurn();
    });
    rerender({ chars: charactersState });
    expect(charactersState.find(character => character.id === DAMAGE_OVER_TIME_TARGET_ID)?.currentHP)
      .toBe(47);
    const damageLogs = logs.filter(entry => entry.type === 'damage');
    expect(damageLogs.map(entry => entry.data?.spellId)).toEqual([
      'searing-smite',
      'melfs-acid-arrow',
      'searing-smite',
    ]);
    expect(damageLogs.map(entry => entry.data?.trigger)).toEqual([
      'turn_start',
      'turn_end',
      'turn_start',
    ]);

    // Removing the final live record before another matching phase prevents
    // every later tick; ordinary turn advancement still proceeds.
    act(() => {
      result.current.removeScheduledSpellEffect(DAMAGE_OVER_TIME_SEARING_SCHEDULE_ID);
    });
    rerender({ chars: charactersState });
    expect(result.current.scheduledSpellEffects).toEqual([]);

    await act(async () => {
      await result.current.endTurn();
    });
    rerender({ chars: charactersState });
    await act(async () => {
      await result.current.endTurn();
    });
    rerender({ chars: charactersState });
    expect(charactersState.find(character => character.id === DAMAGE_OVER_TIME_TARGET_ID)?.currentHP)
      .toBe(47);
    expect(logs.filter(entry => entry.type === 'damage')).toHaveLength(3);
  });
});
