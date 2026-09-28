import { describe, expect, it, vi } from 'vitest';
import { AbilityCommandFactory, WeaponAttackCommand, createMockCombatCharacter, createMockCombatState } from './AbilityCommandFactory.testHelpers';
import type { Ability, CombatState, GameState } from './AbilityCommandFactory.testHelpers';

// agora-f821.4: this file pins Math.random to make a roll deterministic. Game rolls now
// run on the audit log's own seed stream, so the pin only reaches them
// through the roller's supported injected-source seam. Feeding
// Math.random in as that source keeps every pin below meaning what it
// meant before the migration.
vi.mock('../../../systems/dice/rollers', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../systems/dice/rollers')>()
  return {
    ...actual,
    rollDice: (notation: string, options: { rng?: () => number } = {}) =>
      actual.rollDice(notation, { ...options, rng: options.rng ?? Math.random }),
    rollD20: (options: { rng?: () => number } = {}) =>
      actual.rollD20({ ...options, rng: options.rng ?? Math.random }),
    rollDamage: (
      notation: string,
      isCritical: boolean,
      minRoll = 1,
      rng?: () => number,
    ) => actual.rollDamage(notation, isCritical, minRoll, rng ?? Math.random),
  }
})


// ============================================================================
// Mode-Choice Damage Type Resolution (G4)
// ============================================================================
// Weapon-augmenting spells such as Shillelagh let the caster pick the delivered
// damage type from a fixed option list. That menu selection rides on
// CommandContext.playerInput (see SpellCommand's "Mode-choice" note). These
// cases pin the three menu states: a valid choice switches the damage type,
// while an invalid label or an absent choice both fall back to the weapon's
// normal damage type instead of throwing or silently forcing the special type.
// The factory createCommands path never sets playerInput, so the absent case is
// also the real default for a freshly generated attack button.
// ============================================================================

describe('AbilityCommandFactory mode-choice damage type resolution', () => {
  const createForceAugmentEffect = () => ({
    id: 'shillelagh-augment',
    spellId: 'shillelagh',
    casterId: 'druid',
    sourceName: 'Shillelagh',
    type: 'buff',
    duration: { type: 'minutes', value: 1 },
    startTime: 1,
    mechanics: {
      heldWeaponAugment: {
        sourceWeaponId: 'club',
        sourceSpellId: 'shillelagh',
        sourceCasterId: 'druid',
        damageDiceByLevel: { base: '1d8' },
        damageTypeChoice: {
          chooser: 'caster',
          options: ['Bludgeoning', 'Force'],
          defaultType: 'Bludgeoning'
        }
      }
    }
  });

  const createDruid = () => createMockCombatCharacter({
    id: 'druid',
    name: 'Druid',
    activeEffects: [createForceAugmentEffect() as any]
  });

  const createDefender = () => createMockCombatCharacter({
    id: 'club-target',
    name: 'Club Target',
    armorClass: 10,
    currentHP: 30,
    maxHP: 30
  });

  const clubAttack: Ability = {
    id: 'club_attack',
    name: 'Club Attack',
    description: 'A club swing augmented by Shillelagh.',
    type: 'attack',
    cost: { type: 'action' },
    targeting: 'single_enemy',
    range: 1,
    isProficient: true,
    attackBonus: 99,
    weapon: {
      id: 'club',
      name: 'Club',
      type: 'weapon',
      damageType: 'bludgeoning',
      category: 'Simple Weapon'
    } as any,
    effects: [{ type: 'damage', value: 4, damageType: 'bludgeoning' }]
  };

  const findDamageType = (state: CombatState): string | undefined =>
    state.combatLog.find(entry => entry.type === 'damage' && typeof entry.data?.type === 'string')?.data?.type as
      | string
      | undefined;

  it('delivers the chosen Force damage type when the mode choice is valid', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const druid = createDruid();
    const target = createDefender();
    const command = new WeaponAttackCommand(clubAttack, druid, [target], {
      spellId: 'shillelagh',
      spellName: 'Shillelagh',
      castAtLevel: 0,
      caster: druid,
      targets: [target],
      gameState: { characters: [druid, target], combatLog: [] } as unknown as GameState,
      playerInput: 'force'
    });

    try {
      const result = await command.execute(createMockCombatState({ characters: [druid, target] }));

      // A valid "force" choice from the mode menu must switch the delivered
      // damage type on the shared damage command rather than keeping the club's
      // ordinary bludgeoning type.
      expect(findDamageType(result)).toBe('Force');
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('falls back to the weapon damage type when the mode choice is invalid', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const druid = createDruid();
    const target = createDefender();
    const command = new WeaponAttackCommand(clubAttack, druid, [target], {
      spellId: 'shillelagh',
      spellName: 'Shillelagh',
      castAtLevel: 0,
      caster: druid,
      targets: [target],
      gameState: { characters: [druid, target], combatLog: [] } as unknown as GameState,
      playerInput: 'acid'
    });

    try {
      const result = await command.execute(createMockCombatState({ characters: [druid, target] }));

      // "acid" is not one of the offered options, so the special type is not
      // forced. The attack falls back to the weapon's normal bludgeoning type
      // instead of delivering an unlisted damage type or throwing.
      expect(findDamageType(result)).toBe('bludgeoning');
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('falls back to the weapon damage type when the mode choice is absent', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const druid = createDruid();
    const target = createDefender();

    // createCommands never threads a playerInput, so a factory-built attack
    // button carries no mode choice. The augment must then keep the weapon's
    // normal damage type rather than defaulting to the special option.
    const commands = AbilityCommandFactory.createCommands(
      clubAttack,
      druid,
      [target],
      { characters: [druid, target], combatLog: [] } as unknown as GameState
    );

    try {
      const result = await commands[0].execute(createMockCombatState({ characters: [druid, target] }));

      expect(findDamageType(result)).toBe('bludgeoning');
    } finally {
      randomSpy.mockRestore();
    }
  });
});
