import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UtilityCommand } from '../../effects/UtilityCommand';
import { WeaponAttackCommand } from '../AbilityCommandFactory';
import shillelagh from '../../../../public/data/spells/level-0/shillelagh.json';
import { rollDamage } from '@/utils/combatUtils';
import type { Ability, CombatCharacter, CombatState } from '@/types/combat';
import type { Item } from '@/types/items';

vi.mock('@/utils/combatUtils', async () => {
  const actual = await vi.importActual<typeof import('@/utils/combatUtils')>('@/utils/combatUtils');

  return {
    ...actual,
    rollD20: vi.fn(() => 10),
    rollDamage: vi.fn((formula: string) => formula === '1d10+3' ? 13 : 1)
  };
});

const club: Item = {
  id: 'club',
  name: 'Club',
  description: 'A simple wooden club.',
  type: 'weapon',
  damageDice: '1d4',
  damageType: 'bludgeoning',
  properties: []
};

const sword: Item = {
  id: 'longsword',
  name: 'Longsword',
  description: 'A sword that Shillelagh cannot empower.',
  type: 'weapon',
  damageDice: '1d8',
  damageType: 'slashing',
  properties: []
};

const quarterstaff: Item = {
  id: 'quarterstaff',
  name: 'Quarterstaff',
  description: 'A simple wooden quarterstaff.',
  type: 'weapon',
  damageDice: '1d6',
  damageType: 'bludgeoning',
  properties: []
};

const createCaster = (weapon: Item | undefined = club): CombatCharacter => ({
  id: 'caster',
  name: 'Druid',
  stats: {
    strength: 8,
    dexterity: 10,
    constitution: 12,
    intelligence: 10,
    wisdom: 16,
    charisma: 10
  },
  spellcastingAbility: 'wisdom',
  class: { id: 'druid', name: 'Druid' },
  level: 5,
  position: { x: 0, y: 0 },
  currentHP: 20,
  maxHP: 20,
  armorClass: 12,
  abilities: [],
  actionEconomy: { action: { used: false, remaining: 1 }, bonusAction: { used: false, remaining: 1 }, reaction: { used: false, remaining: 1 }, legendary: { used: 0, total: 0 }, movement: { used: 0, total: 30 }, freeActions: 1 },
  activeEffects: [],
  equippedItems: weapon ? { MainHand: weapon } : {}
} as CombatCharacter);

const createTarget = (): CombatCharacter => ({
  id: 'target',
  name: 'Target Dummy',
  stats: {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10
  },
  level: 1,
  position: { x: 1, y: 0 },
  currentHP: 30,
  maxHP: 30,
  armorClass: 14,
  abilities: [],
  actionEconomy: { action: { used: false, remaining: 1 }, bonusAction: { used: false, remaining: 1 }, reaction: { used: false, remaining: 1 }, legendary: { used: 0, total: 0 }, movement: { used: 0, total: 30 }, freeActions: 1 }
} as CombatCharacter);

const createAllyWielder = (weapon: Item = club): CombatCharacter => ({
  ...createCaster(weapon),
  id: 'ally',
  name: 'Ally Wielder',
  spellcastingAbility: undefined,
  activeEffects: []
} as CombatCharacter);

const createState = (caster: CombatCharacter, target = createTarget()): CombatState => ({
  characters: [caster, target],
  combatLog: [],
  turnState: {
    currentTurn: 3,
    turnOrder: ['caster', 'target'],
    currentCharacterId: 'caster',
    phase: 'action',
    actionsThisTurn: []
  }
} as CombatState);

const createShillelaghCommand = (caster: CombatCharacter): UtilityCommand => {
  const effect = shillelagh.effects[0] as any;

  return new UtilityCommand(effect, {
    spellId: shillelagh.id,
    spellName: shillelagh.name,
    castAtLevel: 0,
    caster,
    targets: [caster],
    gameState: {} as any,
    effectDuration: shillelagh.duration as any,
    conditionalEndings: effect.conditionalEndings || (shillelagh as any).conditionalEndings
  });
};

const createClubAttack = (weapon: Item = club): Ability => ({
  id: 'attack_main',
  name: weapon.name,
  description: `Attack with ${weapon.name}.`,
  type: 'attack',
  cost: { type: 'action' },
  targeting: 'single_enemy',
  range: 1,
  effects: [{ type: 'damage', dice: weapon.damageDice || '1d4', damageType: weapon.damageType || 'bludgeoning' }],
  weapon,
  isProficient: true
} as Ability);

describe('Shillelagh held-weapon bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers only an eligible held club or quarterstaff', () => {
    const caster = createCaster(club);
    const state = createState(caster);

    const empoweredState = createShillelaghCommand(caster).execute(state);
    const empoweredCaster = empoweredState.characters.find(character => character.id === 'caster');

    expect(empoweredCaster?.activeEffects?.[0]?.mechanics?.heldWeaponAugment?.sourceWeaponId).toBe('club');
    expect(empoweredState.temporaryWeaponEnchantments?.[0]?.itemId).toBe('club');
    expect(empoweredState.combatLog.some(entry => entry.message.includes('empowered by Shillelagh'))).toBe(true);

    const staffCaster = createCaster(quarterstaff);
    const staffState = createShillelaghCommand(staffCaster).execute(createState(staffCaster));

    expect(staffState.characters.find(character => character.id === 'caster')?.activeEffects?.[0]?.mechanics?.heldWeaponAugment?.sourceWeaponId).toBe('quarterstaff');

    const invalidCaster = createCaster(sword);
    const rejectedState = createShillelaghCommand(invalidCaster).execute(createState(invalidCaster));

    expect(rejectedState.characters.find(character => character.id === 'caster')?.activeEffects).toEqual([]);
    expect(rejectedState.combatLog.some(entry => entry.data?.rejectedAttackAugment === 'missing_eligible_held_weapon')).toBe(true);
  });

  it('uses spellcasting ability and Shillelagh damage on the next matching weapon hit', async () => {
    const caster = createCaster(club);
    const target = createTarget();
    const empoweredState = createShillelaghCommand(caster).execute(createState(caster, target));
    const empoweredCaster = empoweredState.characters.find(character => character.id === 'caster')!;

    const command = new WeaponAttackCommand(createClubAttack(club), empoweredCaster, [target], {
      spellId: 'attack_main',
      spellName: 'Club',
      castAtLevel: 0,
      caster: empoweredCaster,
      targets: [target],
      gameState: {} as any,
      playerInput: 'Force'
    });

    const result = await command.execute(empoweredState);
    const damagedTarget = result.characters.find(character => character.id === 'target')!;

    expect(damagedTarget.currentHP).toBeLessThan(30);
    expect(rollDamage).toHaveBeenCalledWith('1d10+3', false, 1);
    expect(result.combatLog.some(entry => entry.message.includes('= 16 vs AC 14. HIT!'))).toBe(true);
  });

  it('does not apply Shillelagh damage on a miss or a different weapon', async () => {
    const caster = createCaster(club);
    const target = { ...createTarget(), armorClass: 30 };
    const empoweredState = createShillelaghCommand(caster).execute(createState(caster, target));
    const empoweredCaster = empoweredState.characters.find(character => character.id === 'caster')!;

    const missCommand = new WeaponAttackCommand(createClubAttack(club), empoweredCaster, [target], {
      spellId: 'attack_main',
      spellName: 'Club',
      castAtLevel: 0,
      caster: empoweredCaster,
      targets: [target],
      gameState: {} as any,
      playerInput: 'Force'
    });

    await missCommand.execute(empoweredState);

    expect(rollDamage).not.toHaveBeenCalled();

    const swappedTarget = { ...createTarget(), armorClass: 12 };
    const swappedCommand = new WeaponAttackCommand(createClubAttack(sword), empoweredCaster, [swappedTarget], {
      spellId: 'attack_main',
      spellName: 'Longsword',
      castAtLevel: 0,
      caster: empoweredCaster,
      targets: [swappedTarget],
      gameState: {} as any,
      playerInput: 'Force'
    });

    await swappedCommand.execute(createState(empoweredCaster, swappedTarget));

    expect(rollDamage).toHaveBeenCalledWith('1d8', false, 1);
  });

  it('refreshes the prior Shillelagh active effect on recast', () => {
    const caster = createCaster(club);
    const firstCastState = createShillelaghCommand(caster).execute(createState(caster));
    const casterAfterFirstCast = firstCastState.characters.find(character => character.id === 'caster')!;
    const secondCastState = createShillelaghCommand(casterAfterFirstCast).execute(firstCastState);
    const casterAfterSecondCast = secondCastState.characters.find(character => character.id === 'caster')!;

    expect(casterAfterSecondCast.activeEffects?.filter(effect => effect.spellId === 'shillelagh')).toHaveLength(1);
    expect(secondCastState.temporaryWeaponEnchantments?.filter(enchantment => enchantment.spellId === 'shillelagh')).toHaveLength(1);
  });

  it('lets a handed-off enchanted weapon keep Shillelagh damage and magical status', async () => {
    const caster = createCaster(club);
    const ally = createAllyWielder(club);
    const resistantTarget = {
      ...createTarget(),
      nonMagicalResistances: ['bludgeoning']
    } as CombatCharacter;
    const initialState = {
      ...createState(caster, resistantTarget),
      characters: [caster, ally, resistantTarget]
    };
    const empoweredState = createShillelaghCommand(caster).execute(initialState);

    const handoffCommand = new WeaponAttackCommand(createClubAttack(club), ally, [resistantTarget], {
      spellId: 'attack_main',
      spellName: 'Club',
      castAtLevel: 0,
      caster: ally,
      targets: [resistantTarget],
      gameState: {} as any,
      playerInput: 'weapon_normal'
    });

    const result = await handoffCommand.execute(empoweredState);
    const damagedTarget = result.characters.find(character => character.id === 'target')!;

    expect(result.temporaryWeaponEnchantments?.[0]?.heldWeaponAugment.isMagical).toBe(true);
    expect(rollDamage).toHaveBeenCalledWith('1d10+3', false, 1);
    expect(damagedTarget.currentHP).toBe(17);
  });
});
