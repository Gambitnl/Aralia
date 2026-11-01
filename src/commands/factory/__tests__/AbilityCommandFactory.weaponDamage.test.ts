/**
 * GG-496 (audit 2026-10-25): player weapon hits must add the attack's ability
 * modifier and a magic weapon's +N to damage, and the +N to the attack roll.
 * Before the fix, weapon damage was the dice alone (only unarmed strikes added
 * Strength), magicProperties.magicalBonus was never read in combat, and the
 * Great Weapon Master check looked for lowercase 'heavy' while item data says
 * 'Heavy'.
 *
 * Dice are pinned: the d20 is 11 (attackRollRng 0.5) against AC 5, so every
 * attack hits without a critical, and every damage die rolls 1 (damageRng 0).
 *
 * Exercises: src/commands/factory/AbilityCommandFactory.ts (WeaponAttackCommand),
 * src/commands/effects/DamageCommand.ts
 */
import { describe, expect, it } from 'vitest';
import { WeaponAttackCommand, createMockCombatCharacter, createMockCombatState } from './AbilityCommandFactory.testHelpers';
import type { Ability, GameState } from './AbilityCommandFactory.testHelpers';

const STATS = { baseInitiative: 0, speed: 30, cr: '0', strength: 16, dexterity: 10, constitution: 12, intelligence: 10, wisdom: 10, charisma: 10 };

function fighter(feats: string[] = []) {
  return createMockCombatCharacter({ id: 'hero', name: 'Hero', level: 1, stats: STATS, feats, featUsageThisTurn: [] } as never);
}

function dummy() {
  return createMockCombatCharacter({ id: 'dummy', name: 'Dummy', armorClass: 5, currentHP: 50, maxHP: 50 });
}

type WeaponAbilityInput = Omit<Partial<Ability>, 'weapon'> & { weapon: Record<string, unknown>; dice: string };

function weaponAbility(over: WeaponAbilityInput): Ability {
  const { weapon, dice, ...rest } = over;
  return {
    id: 'attack_main',
    name: String(weapon.name),
    description: 'Attack.',
    type: 'attack',
    cost: { type: 'action' },
    targeting: 'single_enemy',
    range: 1,
    isProficient: true,
    weapon: { id: String(weapon.name).toLowerCase(), type: 'weapon', category: 'Martial Melee', ...weapon } as never,
    effects: [{ type: 'damage', value: 0, dice, damageType: 'slashing' } as never],
    ...rest,
  } as Ability;
}

async function hit(ability: Ability, attacker = fighter()) {
  const target = dummy();
  const command = new WeaponAttackCommand(ability, attacker, [target], {
    spellId: ability.id,
    spellName: ability.name,
    castAtLevel: 0,
    caster: attacker,
    targets: [target],
    gameState: { characters: [attacker, target], combatLog: [] } as unknown as GameState,
    attackRollRng: () => 0.5,
    damageRng: () => 0,
  } as never);
  const state = await command.execute(createMockCombatState({ characters: [attacker, target] }));
  const after = state.characters.find((c) => c.id === 'dummy')!;
  const attackLog = state.combatLog.find((l) => l.message.includes('attacks Dummy'));
  return { damage: 50 - after.currentHP, attackMessage: attackLog?.message ?? '' };
}

describe('weapon damage modifiers (GG-496)', () => {
  it('adds the Strength modifier to a longsword hit', async () => {
    const { damage } = await hit(weaponAbility({ weapon: { name: 'Longsword', properties: ['Versatile'] }, dice: '1d8' }));
    expect(damage).toBe(1 + 3);
  });

  it('adds a +2 weapon bonus to the attack roll and to damage', async () => {
    const { damage, attackMessage } = await hit(weaponAbility({
      weapon: { name: 'Longsword', properties: ['Versatile'], magicProperties: { magicalBonus: 2 } },
      dice: '1d8',
    }));
    expect(damage).toBe(1 + 3 + 2);
    // Strength 3 + proficiency 2 + magic 2.
    expect(attackMessage).toContain('+ 7 =');
  });

  it('adds no positive ability modifier to an off-hand hit', async () => {
    const { damage } = await hit(weaponAbility({
      id: 'attack_off',
      cost: { type: 'bonus' },
      weapon: { name: 'Shortsword', properties: ['Finesse', 'Light'] },
      dice: '1d6',
    }));
    expect(damage).toBe(1);
  });

  it('applies Great Weapon Master to a weapon whose data says Heavy', async () => {
    const { damage } = await hit(
      weaponAbility({ weapon: { name: 'Greatsword', properties: ['Heavy', 'Two-Handed'] }, dice: '2d6' }),
      fighter(['great_weapon_master']),
    );
    // 2 dice at 1 each + Strength 3 + proficiency 2 (GWM 2024).
    expect(damage).toBe(2 + 3 + 2);
  });
});

// GG-495: a ranged weapon attacks with Dexterity, a reach weapon stays a
// Strength melee weapon, and a thrown melee weapon keeps its melee modifier.
describe('weapon attack ability modifier by attack mode (GG-495)', () => {
  const archer = () => createMockCombatCharacter({
    id: 'hero', name: 'Hero', level: 1, featUsageThisTurn: [],
    stats: { ...STATS, strength: 8, dexterity: 16 },
  } as never);

  it('uses Dexterity for a longbow even at range 1', async () => {
    const { damage, attackMessage } = await hit(weaponAbility({
      weapon: { name: 'Longbow', category: 'Martial Ranged', properties: ['Ammunition', 'Heavy', 'Two-Handed'] },
      dice: '1d8',
    }), archer());
    expect(attackMessage).toContain('+ 5 ='); // Dex 3 + proficiency 2
    expect(damage).toBe(1 + 3);
  });

  it('keeps Strength for a reach glaive at range 2', async () => {
    const { attackMessage } = await hit(weaponAbility({
      range: 2,
      weapon: { name: 'Glaive', properties: ['Heavy', 'Reach', 'Two-Handed'] },
      dice: '1d10',
    }));
    expect(attackMessage).toContain('+ 5 ='); // Str 3 + proficiency 2
  });

  it('keeps Strength for a thrown handaxe', async () => {
    const { attackMessage } = await hit(weaponAbility({
      id: 'attack_main_thrown',
      range: 4,
      weapon: { name: 'Handaxe', category: 'Simple Melee', properties: ['Light', 'Thrown'] },
      dice: '1d6',
    }));
    expect(attackMessage).toContain('+ 5 ='); // Str 3 + proficiency 2
  });
});

// GG-495 open part (2026-11-01): past the normal range but within the long
// range, a thrown or ranged attack roll has Disadvantage and says why.
describe('long-range Disadvantage (GG-495)', () => {
  const thrownSpear = () => weaponAbility({
    id: 'attack_main_thrown',
    range: 4,
    longRange: 12,
    weapon: { name: 'Spear', category: 'Simple Melee', properties: ['Thrown', 'Versatile'] },
    dice: '1d6',
  });

  async function throwAt(distanceTiles: number) {
    const attacker = createMockCombatCharacter({ ...fighter(), position: { x: 0, y: 0 } } as never);
    const target = createMockCombatCharacter({ ...dummy(), position: { x: distanceTiles, y: 0 } } as never);
    const ability = thrownSpear();
    const command = new WeaponAttackCommand(ability, attacker, [target], {
      spellId: ability.id,
      spellName: ability.name,
      castAtLevel: 0,
      caster: attacker,
      targets: [target],
      gameState: { characters: [attacker, target], combatLog: [] } as unknown as GameState,
      attackRollRng: () => 0.5,
      damageRng: () => 0,
    } as never);
    const state = await command.execute(createMockCombatState({ characters: [attacker, target] }));
    return state.combatLog.find((l) => l.message.includes('attacks Dummy'))?.message ?? '';
  }

  it('rolls with Disadvantage at 30 ft for a spear thrown at 20/60 ft', async () => {
    const message = await throwAt(6);
    expect(message).toContain('(with Disadvantage)');
    expect(message).toContain('(Long range)');
  });

  it('rolls normally inside the 20 ft normal range', async () => {
    const message = await throwAt(3);
    expect(message).not.toContain('Disadvantage');
    expect(message).not.toContain('Long range');
  });
});
