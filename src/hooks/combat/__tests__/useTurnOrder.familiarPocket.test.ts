import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTurnOrder } from '../useTurnOrder';
import { createMockCombatCharacter } from '../../../utils/core';
import type { CombatCharacter } from '../../../types/combat';

const createFindFamiliarActor = (caster: CombatCharacter): CombatCharacter =>
  createMockCombatCharacter({
    id: 'find-familiar-owl',
    name: 'Find Familiar Owl',
    team: caster.team,
    currentHP: 1,
    maxHP: 1,
    initiative: caster.initiative,
    isSummon: true,
    summonMetadata: {
      casterId: caster.id,
      spellId: 'find-familiar',
      entityType: 'familiar',
      sourceName: 'Find Familiar',
      initiativePolicy: 'shared',
      dismissable: true
    }
  });

/**
 * Pocketed familiars leave the visible roster, but their turn-order slot is
 * still the shared-initiative slot after their caster. This protects the
 * dismiss -> skip -> recall contract without teaching the scheduler about a
 * separate pocket state store.
 */
describe('useTurnOrder familiar pocket contract', () => {
  it('skips a pocketed familiar and restores its after-caster turn when recalled', () => {
    const caster = createMockCombatCharacter({
      id: 'familiar-caster',
      name: 'Familiar Caster',
      team: 'player',
      initiative: 18,
      currentHP: 20,
      maxHP: 20
    });
    const familiar = createFindFamiliarActor(caster);
    const enemy = createMockCombatCharacter({
      id: 'enemy',
      name: 'Enemy',
      team: 'enemy',
      initiative: 10,
      currentHP: 8,
      maxHP: 8
    });

    const { result, rerender } = renderHook(
      ({ characters }) => useTurnOrder({ characters }),
      { initialProps: { characters: [caster, familiar, enemy] } }
    );

    act(() => {
      result.current.initializeTurnOrder([caster, familiar, enemy]);
    });

    expect(result.current.turnState.turnOrder).toEqual([caster.id, familiar.id, enemy.id]);
    expect(result.current.turnState.currentCharacterId).toBe(caster.id);

    rerender({ characters: [caster, enemy] });

    act(() => {
      result.current.advanceTurn();
    });

    expect(result.current.turnState.currentCharacterId).toBe(enemy.id);

    act(() => {
      result.current.advanceTurn();
    });

    expect(result.current.turnState.currentCharacterId).toBe(caster.id);

    rerender({ characters: [caster, familiar, enemy] });

    act(() => {
      result.current.advanceTurn();
    });

    expect(result.current.turnState.currentCharacterId).toBe(familiar.id);
    expect(result.current.turnState.turnOrder).toEqual([caster.id, familiar.id, enemy.id]);
  });
});
