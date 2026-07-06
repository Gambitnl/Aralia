import { describe, it, expect } from 'vitest';
import { applyImmediateAbilityTurnEffects } from '../useActionExecutor';
import { ResistanceCalculator } from '../../../utils/combat/resistanceUtils';
import type { Ability, CombatCharacter } from '../../../types/combat';

const rageAbility = {
  id: 'rage',
  name: 'Rage',
  description: 'Enter a rage.',
  type: 'utility',
  cost: { type: 'bonus' },
  targeting: 'self',
  range: 0,
  effects: [],
} as unknown as Ability;

const barbarian = (): CombatCharacter => ({
  id: 'barb-1',
  name: 'Grukk',
  statusEffects: [],
  conditions: [],
} as unknown as CombatCharacter);

describe('Rage mechanic (barbarian)', () => {
  it('using Rage applies a Raging status with physical resistance', () => {
    const { character, followUpLogs } = applyImmediateAbilityTurnEffects(barbarian(), rageAbility, 1);
    const raging = character.statusEffects.find(s => s.id === 'raging');
    expect(raging).toBeTruthy();
    expect(raging!.modifiers?.resistance).toContain('physical');
    expect(followUpLogs.some(l => /Rage/i.test(l.message))).toBe(true);
  });

  it('a raging character takes HALF physical damage (the iconic benefit)', () => {
    const { character } = applyImmediateAbilityTurnEffects(barbarian(), rageAbility, 1);
    const dmg = ResistanceCalculator.applyResistances(10, 'physical' as never, character);
    expect(dmg).toBe(5);
    // Also covers the standard physical subtypes.
    expect(ResistanceCalculator.applyResistances(8, 'slashing' as never, character)).toBe(4);
  });

  it('a non-raging character takes full physical damage', () => {
    const dmg = ResistanceCalculator.applyResistances(10, 'physical' as never, barbarian());
    expect(dmg).toBe(10);
  });

  it('re-using Rage while already raging does not stack', () => {
    const { character: once } = applyImmediateAbilityTurnEffects(barbarian(), rageAbility, 1);
    const { character: twice } = applyImmediateAbilityTurnEffects(once, rageAbility, 2);
    expect(twice.statusEffects.filter(s => s.id === 'raging').length).toBe(1);
  });
});

describe('Reckless Attack mechanic (barbarian)', () => {
  const recklessAbility = { id: 'reckless_attack', name: 'Reckless Attack', type: 'utility', cost: { type: 'free' }, targeting: 'self', range: 0, effects: [] } as unknown as Ability;

  it('applies a reckless status (attack advantage) and a Reckless condition (the downside)', () => {
    const { character, followUpLogs } = applyImmediateAbilityTurnEffects(barbarian(), recklessAbility, 1);
    const status = character.statusEffects.find(s => s.id === 'reckless');
    expect(status?.modifiers?.advantage).toContain('attack');
    // The downside: a 'Reckless' condition the attack resolver reads to grant attackers advantage.
    expect((character.conditions || []).some(c => c.name === 'Reckless')).toBe(true);
    expect(followUpLogs.some(l => /recklessly/i.test(l.message))).toBe(true);
  });

  it('does not stack when re-used', () => {
    const { character: once } = applyImmediateAbilityTurnEffects(barbarian(), recklessAbility, 1);
    const { character: twice } = applyImmediateAbilityTurnEffects(once, recklessAbility, 1);
    expect(twice.statusEffects.filter(s => s.id === 'reckless').length).toBe(1);
  });
});

const withEconomy = (id: string, name: string): CombatCharacter => ({
  id, name, statusEffects: [], conditions: [],
  actionEconomy: { action: { used: false, remaining: 1 }, bonusAction: { used: false, remaining: 1 }, reaction: { used: false, remaining: 1 }, legendary: { used: 0, total: 0 }, movement: { used: 0, total: 30 }, freeActions: 1 },
} as unknown as CombatCharacter);

describe('Steady Aim mechanic (rogue)', () => {
  const steadyAim = { id: 'steady_aim', name: 'Steady Aim', type: 'utility', cost: { type: 'bonus' }, targeting: 'self', range: 0, effects: [] } as unknown as Ability;

  it('grants attack advantage and forgoes movement', () => {
    const { character } = applyImmediateAbilityTurnEffects(withEconomy('rog-1', 'Vex'), steadyAim, 1);
    expect(character.statusEffects.find(s => s.id === 'steady_aim')?.modifiers?.advantage).toContain('attack');
    expect(character.actionEconomy.movement.used).toBe(character.actionEconomy.movement.total);
  });
});

describe('Rage of the Wilds — bear boon (Path of the Wild Heart barbarian)', () => {
  const bearRage = { id: 'rage', name: 'Rage (Bear Spirit)', type: 'utility', cost: { type: 'bonus' }, targeting: 'self', range: 0, effects: [], tags: ['wild_heart_bear'] } as unknown as Ability;

  it('a bear-spirit raging barbarian resists ALL damage except psychic', () => {
    const { character } = applyImmediateAbilityTurnEffects(barbarian(), bearRage, 1);
    const raging = character.statusEffects.find(s => s.id === 'raging');
    expect(raging?.modifiers?.resistance).toContain('fire');
    expect(raging?.modifiers?.resistance).toContain('cold');
    expect(raging?.modifiers?.resistance).toContain('necrotic');
    // Fire damage is halved.
    expect(ResistanceCalculator.applyResistances(10, 'fire' as never, character)).toBe(5);
    // Psychic is the one exception — full damage.
    expect(raging?.modifiers?.resistance).not.toContain('psychic');
    expect(ResistanceCalculator.applyResistances(10, 'psychic' as never, character)).toBe(10);
  });

  it('a plain (untagged) Rage still resists only physical damage, not fire', () => {
    const { character } = applyImmediateAbilityTurnEffects(barbarian(), rageAbility, 1);
    expect(ResistanceCalculator.applyResistances(10, 'fire' as never, character)).toBe(10);
    expect(ResistanceCalculator.applyResistances(10, 'physical' as never, character)).toBe(5);
  });
});

describe('Vow of Enmity mechanic (Oath of Vengeance paladin)', () => {
  const vow = { id: 'vow_of_enmity', name: 'Vow of Enmity (Channel Divinity)', type: 'utility', cost: { type: 'bonus' }, targeting: 'self', range: 0, effects: [] } as unknown as Ability;

  it('applies a Vow of Enmity status granting attack advantage', () => {
    const { character, followUpLogs } = applyImmediateAbilityTurnEffects(barbarian(), vow, 1);
    const status = character.statusEffects.find(s => s.id === 'vow_of_enmity');
    // WeaponAttackCommand reads statusEffects[].modifiers.advantage for 'attack'.
    expect(status?.modifiers?.advantage).toContain('attack');
    expect(followUpLogs.some(l => /Vow of Enmity/i.test(l.message))).toBe(true);
  });

  it('does not stack when re-used', () => {
    const { character: once } = applyImmediateAbilityTurnEffects(barbarian(), vow, 1);
    const { character: twice } = applyImmediateAbilityTurnEffects(once, vow, 2);
    expect(twice.statusEffects.filter(s => s.id === 'vow_of_enmity').length).toBe(1);
  });
});

describe('Action Surge mechanic (fighter)', () => {
  const actionSurge = { id: 'action_surge', name: 'Action Surge', type: 'utility', cost: { type: 'free' }, targeting: 'self', range: 0, effects: [] } as unknown as Ability;
  const fighter = (): CombatCharacter => withEconomy('ftr-1', 'Roland');

  it('grants one additional action this turn', () => {
    const { character, followUpLogs } = applyImmediateAbilityTurnEffects(fighter(), actionSurge, 1);
    expect(character.actionEconomy.action.remaining).toBe(2);
    expect(followUpLogs.some(l => /Action Surge/i.test(l.message))).toBe(true);
  });
});
