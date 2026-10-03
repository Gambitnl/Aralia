/**
 * This file proves DamageCommand's stable post-HP reaction handoff.
 *
 * The command remains the sole owner of resistance, temporary HP, HP, and
 * downing. Its ordinary damage log then exposes the generated log ID and exact
 * before/after receipt for reaction consumers without applying damage again.
 *
 * Exercises: DamageCommand.
 * Depends on: shared command fixtures and the real damage/HP pipeline.
 */

import { describe, expect, it, vi } from 'vitest';
import type { DamageEffect } from '../../../types/spells';
import { createMockCombatCharacter, createMockCombatState, createMockCommandContext } from '../../../utils/core';
import { DamageCommand } from '../DamageCommand';

describe('DamageCommand post-HP reaction event', () => {
  it('publishes one structured event whose ID is the damage-log ID', async () => {
    const caster = createMockCombatCharacter({ id: 'event-source', name: 'Event Source' });
    const target = createMockCombatCharacter({
      id: 'event-target',
      name: 'Event Target',
      currentHP: 20,
      maxHP: 20,
      tempHP: 3,
    });
    const effect: DamageEffect = {
      type: 'DAMAGE',
      damage: { dice: '8d1', type: 'Slashing' },
      trigger: { type: 'immediate' },
      condition: { type: 'always' },
    };
    const context = createMockCommandContext({
      spellId: 'normal-attack',
      spellName: 'Attack',
      caster,
      targets: [target],
      damageRng: () => 0,
    });
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const result = await new DamageCommand(effect, context).execute(createMockCombatState({
      characters: [caster, target],
      combatLog: [],
    }));
    vi.restoreAllMocks();

    const damageLogs = result.combatLog.filter(entry => entry.type === 'damage');
    const event = damageLogs.at(-1);
    expect(damageLogs).toHaveLength(1);
    expect(event?.id).toEqual(expect.any(String));
    expect(event?.data).toMatchObject({
      damageEventBoundary: 'post_hp',
      sourceCharacterId: caster.id,
      targetCharacterId: target.id,
      hitConfirmed: true,
      rawDamage: 8,
      finalDamage: 8,
      damageType: 'Slashing',
      hitPointsBefore: 20,
      hitPointsAfter: 15,
      temporaryHitPointsBefore: 3,
      temporaryHitPointsAfter: 0,
      targetDownedAfter: false,
      targetIncapacitatedAfter: false,
    });
    expect(result.characters.find(character => character.id === target.id)).toMatchObject({
      currentHP: 15,
      tempHP: 0,
    });
  });
});
