/**
 * This file proves that ordinary weapon attacks consume structured Hide state.
 *
 * The attack uses the production command factory with deterministic dice. An
 * undetected source grants Advantage for the current roll, then attacking ends
 * only Hide-derived Hidden after that roll is published—even when the attack
 * misses. Unrelated Hidden state remains untouched.
 *
 * Called by: focused Vitest proof for Stealth & Hidden.
 * Depends on: AbilityCommandFactory and the production combat factories.
 */

import { describe, expect, it } from 'vitest';
import type { Ability, CombatCharacter } from '@/types/combat';
import { AbilityCommandFactory } from '../AbilityCommandFactory';
import {
  createMockCombatCharacter,
  createMockCombatState,
  createMockGameState,
} from '@/utils/core';

const ATTACK: Ability = {
  id: 'hidden-shortbow',
  name: 'Hidden Shortbow',
  description: 'A deterministic ranged attack used to prove Hide timing.',
  type: 'attack',
  cost: { type: 'action' },
  targeting: 'single_enemy',
  range: 12,
  attackBonus: 5,
  isProficient: true,
  effects: [{ type: 'damage', value: 3, damageType: 'piercing' }],
};

function createAttacker(): CombatCharacter {
  return createMockCombatCharacter({
    id: 'hidden-attacker',
    name: 'Hidden Attacker',
    team: 'player',
    position: { x: 2, y: 2 },
    statusEffects: [
      {
        id: 'other-hidden',
        name: 'Hidden',
        type: 'buff',
        duration: 3,
        source: 'another-feature',
      },
      {
        id: 'hide-owned',
        name: 'Hidden',
        type: 'neutral',
        duration: 999,
        persistsUntilRemoved: true,
        source: 'hide-action',
        stealth: {
          ownerId: 'hide-action',
          stealthDc: 14,
          detectedBy: [],
          breaksOnAttack: true,
        },
      },
    ],
  });
}

describe('WeaponAttackCommand Hide lifecycle', () => {
  it('uses undetected Hidden for this roll, then reveals only Hide-derived state', async () => {
    const attacker = createAttacker();
    const target = createMockCombatCharacter({
      id: 'observer-target',
      name: 'Observer Target',
      team: 'enemy',
      position: { x: 8, y: 2 },
      armorClass: 99,
      baseAC: 99,
    });
    const command = AbilityCommandFactory.createCommands(
      ATTACK,
      attacker,
      [target],
      createMockGameState(),
      undefined,
      undefined,
      { attackRollRng: () => 0.575, damageRng: () => 0.5 },
    )[0];
    const result = await command.execute(createMockCombatState({
      characters: [attacker, target],
      combatLog: [],
      mapData: null,
    }));
    const attackLog = result.combatLog.find(entry => entry.message.includes('attacks Observer Target'));
    const revealLog = result.combatLog.find(entry => entry.message.includes('reveals their position'));
    const resultingAttacker = result.characters.find(character => character.id === attacker.id);

    expect(attackLog?.message).toContain('Rolled 12 (with Advantage)');
    expect(attackLog?.data).toMatchObject({ hiddenAttackerAdvantage: true, isHit: false });
    expect(revealLog?.data).toEqual({ removedStatusIds: ['hide-owned'] });
    expect(resultingAttacker?.statusEffects).toEqual([
      expect.objectContaining({ id: 'other-hidden', source: 'another-feature' }),
    ]);
  });

  it('does not grant Hidden Advantage once this defender detected the source', async () => {
    const attacker = createAttacker();
    const detectedAttacker: CombatCharacter = {
      ...attacker,
      statusEffects: attacker.statusEffects.map(status => status.id === 'hide-owned'
        ? { ...status, stealth: { ...status.stealth!, detectedBy: ['observer-target'] } }
        : status),
    };
    const target = createMockCombatCharacter({
      id: 'observer-target',
      name: 'Observer Target',
      team: 'enemy',
      position: { x: 8, y: 2 },
      armorClass: 99,
      baseAC: 99,
    });
    const command = AbilityCommandFactory.createCommands(
      ATTACK,
      detectedAttacker,
      [target],
      createMockGameState(),
      undefined,
      undefined,
      { attackRollRng: () => 0.575, damageRng: () => 0.5 },
    )[0];
    const result = await command.execute(createMockCombatState({
      characters: [detectedAttacker, target],
      combatLog: [],
      mapData: null,
    }));
    const attackLog = result.combatLog.find(entry => entry.message.includes('attacks Observer Target'));

    expect(attackLog?.message).not.toContain('with Advantage');
    expect(attackLog?.data).toMatchObject({ hiddenAttackerAdvantage: false });
  });
});
