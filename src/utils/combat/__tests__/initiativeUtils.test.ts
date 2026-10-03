/**
 * This file proves Aralia's deterministic house tie policy and shared order.
 *
 * The tests use real CombatCharacter facts so the Tactical Sandbox and combat
 * hooks cannot drift into different tie breakers. They also prove that a shared
 * summon is consecutive with its caster without disappearing or acting twice.
 *
 * Exercises: initiativeUtils.
 * Depends on: the standard combat-character test factory.
 */

import { describe, expect, it } from 'vitest';
import { createMockCombatCharacter } from '../../core';
import type { CombatCharacter } from '../../../types/combat';
import { buildInitiativeOrder, rollInitiativeTotal } from '../initiativeUtils';

// ============================================================================
// Deterministic Combatant Fixtures
// ============================================================================
// Every actor carries an explicit total, Dexterity score, and initiative bonus
// so each ordering assertion identifies the exact fact that decided the tie.
// ============================================================================

function createInitiativeActor(
  id: string,
  initiative: number,
  dexterity: number,
  baseInitiative: number,
): CombatCharacter {
  return createMockCombatCharacter({
    id,
    name: id,
    initiative,
    stats: {
      strength: 10,
      dexterity,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
      baseInitiative,
      speed: 30,
      cr: '0',
    },
  });
}

describe('buildInitiativeOrder', () => {
  it('rolls the canonical d20 plus Dexterity modifier and initiative bonus', () => {
    const actor = createInitiativeActor('initiative-roll', 0, 16, 2);

    // A fraction of 0.45 maps to d20 face 10, then DEX +3 and bonus +2 yield 15.
    expect(rollInitiativeTotal(actor, () => 0.45)).toBe(15);
  });

  it('uses Aralia house order: total, Dexterity, bonus, then stable authored order', () => {
    const slowTotal = createInitiativeActor('slow-total', 12, 20, 5);
    const highDexterity = createInitiativeActor('high-dexterity', 15, 18, 0);
    const highBonus = createInitiativeActor('high-bonus', 15, 16, 3);
    const stableFirst = createInitiativeActor('stable-first', 15, 16, 1);
    const stableSecond = createInitiativeActor('stable-second', 15, 16, 1);

    const ordered = buildInitiativeOrder([
      stableFirst,
      slowTotal,
      stableSecond,
      highBonus,
      highDexterity,
    ]);

    expect(ordered.map(character => character.id)).toEqual([
      'high-dexterity',
      'high-bonus',
      'stable-first',
      'stable-second',
      'slow-total',
    ]);
  });

  it('anchors each shared summon after its caster exactly once', () => {
    const caster = createInitiativeActor('caster', 15, 16, 0);
    const rival = createInitiativeActor('rival', 15, 18, 0);
    const lateActor = createInitiativeActor('late-actor', 10, 12, 0);
    const sharedSummon = {
      ...createInitiativeActor('shared-summon', 15, 20, 0),
      isSummon: true,
      summonMetadata: {
        casterId: caster.id,
        spellId: 'shared-turn-proof',
        initiativePolicy: 'shared' as const,
      },
    };

    const orderedIds = buildInitiativeOrder([
      caster,
      sharedSummon,
      rival,
      lateActor,
    ]).map(character => character.id);

    expect(orderedIds).toEqual(['rival', 'caster', 'shared-summon', 'late-actor']);
    expect(new Set(orderedIds).size).toBe(4);
  });

  it('keeps an orphaned shared summon as an ordinary actor', () => {
    const orphan = {
      ...createInitiativeActor('orphan', 14, 12, 0),
      isSummon: true,
      summonMetadata: {
        casterId: 'missing-caster',
        spellId: 'shared-turn-proof',
        initiativePolicy: 'shared' as const,
      },
    };
    const actor = createInitiativeActor('actor', 10, 18, 0);

    expect(buildInitiativeOrder([actor, orphan]).map(character => character.id))
      .toEqual(['orphan', 'actor']);
  });
});
