import { describe, it, expect } from 'vitest';
import { createPlayerCombatCharacter } from '../combatUtils';
import { AbilityEffectMapper } from '../../../commands/factory/AbilityEffectMapper';
import { CLASSES_DATA } from '../../../data/classes';
import { createMockPlayerCharacter } from '../../core/factories';
import type { AbilityEffect } from '../../../types/combat';

describe('Channel Divinity: Turn Undead (cleric)', () => {
  it('is granted to a level-2+ cleric as a usable ability, not a level-1 one', () => {
    const l1 = createPlayerCombatCharacter(createMockPlayerCharacter({ class: CLASSES_DATA['cleric'], level: 1 }));
    const l2 = createPlayerCombatCharacter(createMockPlayerCharacter({ class: CLASSES_DATA['cleric'], level: 2 }));
    expect(l1.abilities.some(a => a.id === 'channel_divinity_turn_undead')).toBe(false);
    const cd = l2.abilities.find(a => a.id === 'channel_divinity_turn_undead');
    expect(cd).toBeTruthy();
    expect(cd!.effects[0].type).toBe('status');
    expect(cd!.effects[0].statusEffect?.name).toBe('Frightened');
  });

  it('its status effect maps to a real STATUS_CONDITION(Frightened) the engine applies', () => {
    const l2 = createPlayerCombatCharacter(createMockPlayerCharacter({ class: CLASSES_DATA['cleric'], level: 2 }));
    const cd = l2.abilities.find(a => a.id === 'channel_divinity_turn_undead')!;
    const mapped = AbilityEffectMapper.mapToSpellEffect(cd.effects[0] as AbilityEffect);
    expect(mapped).toBeTruthy();
    expect(mapped!.type).toBe('STATUS_CONDITION');
    // The condition name resolves (Frightened is a known condition), so the effect
    // is applied rather than dropped as null.
    expect((mapped as { statusCondition?: { name?: string } }).statusCondition?.name).toBe('Frightened');
  });
});

describe('Divine Smite (paladin)', () => {
  it('is a real weapon attack that adds 2d8 radiant damage (not an inert button)', () => {
    const pal = createPlayerCombatCharacter(createMockPlayerCharacter({
      class: CLASSES_DATA['paladin'], level: 2,
      equippedItems: { MainHand: { id: 'longsword', name: 'Longsword', type: 'weapon', damageDice: '1d8', slot: 'MainHand' } as never },
    }));
    const smite = pal.abilities.find(a => a.id === 'divine_smite');
    expect(smite).toBeTruthy();
    expect(smite!.type).toBe('attack'); // rolls to hit
    expect(smite!.weapon).toBeTruthy();
    // Two damage effects: the weapon's + the radiant smite.
    const radiant = smite!.effects.find(e => e.type === 'damage' && e.damageType === 'radiant');
    expect(radiant?.dice).toBe('2d8');
  });
});

describe('Bardic Inspiration (bard)', () => {
  it('is an ally-targeted buff that applies a real Inspired condition', () => {
    const bard = createPlayerCombatCharacter(createMockPlayerCharacter({ class: CLASSES_DATA['bard'], level: 1 }));
    const bi = bard.abilities.find(a => a.id === 'bardic_inspiration');
    expect(bi).toBeTruthy();
    expect(bi!.targeting).toBe('single_ally');
    expect(bi!.effects[0].statusEffect?.name).toBe('Inspired');
    // The status maps to a real STATUS_CONDITION (Inspired is now a known condition), not dropped.
    const mapped = AbilityEffectMapper.mapToSpellEffect(bi!.effects[0] as AbilityEffect);
    expect(mapped!.type).toBe('STATUS_CONDITION');
    expect((mapped as { statusCondition?: { name?: string } }).statusCondition?.name).toBe('Inspired');
  });
});

describe('Flurry of Blows (monk)', () => {
  it('is a real bonus-action unarmed strike that deals damage, not an inert button', () => {
    const monk = createPlayerCombatCharacter(createMockPlayerCharacter({ class: CLASSES_DATA['monk'], level: 2 }));
    const flurry = monk.abilities.find(a => a.id === 'flurry_of_blows');
    expect(flurry?.type).toBe('attack');
    expect(flurry?.cost.type).toBe('bonus');
    const dmg = flurry?.effects.find(e => e.type === 'damage');
    expect(dmg?.dice).toMatch(/1d6/);
  });
});

describe('Lay on Hands (paladin)', () => {
  it('grants a healing ability that maps to a real HEALING effect', () => {
    const pal = createPlayerCombatCharacter(createMockPlayerCharacter({ class: CLASSES_DATA['paladin'], level: 1 }));
    const loh = pal.abilities.find(a => a.id === 'lay_on_hands');
    expect(loh).toBeTruthy();
    expect(loh!.effects[0].type).toBe('heal');
    const mapped = AbilityEffectMapper.mapToSpellEffect(loh!.effects[0] as AbilityEffect);
    expect(mapped!.type).toBe('HEALING');
  });
});
