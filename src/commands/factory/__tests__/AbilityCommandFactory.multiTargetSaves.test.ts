import { describe, expect, it, vi } from 'vitest';
import { createMockCombatCharacter, createMockCombatState, AbilityCommandFactory } from './AbilityCommandFactory.testHelpers';
import type { Ability, GameState } from './AbilityCommandFactory.testHelpers';
import { DamageCommand } from '../../effects/DamageCommand';

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
// Multi-Target Dispatch And Save-Bearing Abilities (SYS-6)
// ============================================================================
// The sibling factory test files each pin one spell family. This file pins the
// two shapes that cut across every family instead: how `createCommands` fans a
// single ability out over more than one target, and what happens to an ability
// that declares a saving throw.
//
// Multi-target matters because the two lanes fan out differently. An `attack`
// ability produces ONE WeaponAttackCommand that loops its own target list and
// rolls each target's AC separately, while a non-attack ability produces one
// effect command per effect whose context carries every target at once. Both
// lanes must reach every target; a regression that silently resolves only
// `targets[0]` would still pass every single-target sibling test.
//
// The save lane is deliberately a characterization test. `Ability` carries
// `saveDC` and `saveAbility`, but neither `AbilityCommandFactory` nor
// `AbilityEffectMapper` reads them today: the mapper hardcodes
// `condition: { type: 'always' }`, so a save-for-half ability lands full damage
// with no save rolled. The DamageCommand save lane it should be reaching
// (`condition.type === 'saving_throw'` with `saveEffect: 'half'`) already
// exists and is exercised by the spell-side tests. These cases record the
// current, wrong-by-5e-rules behavior so the gap is visible and so the day the
// mapper is wired the failure lands here instead of in the field.
// ============================================================================

/** Mocked Math.random value that yields a d20 of 12: floor(0.55 * 20) + 1. */
const ROLL_TWELVE = 0.55;

const createStrikeAttacker = () => createMockCombatCharacter({
  id: 'fan-attacker',
  name: 'Fan Attacker',
  team: 'enemy',
  stats: { strength: 10, dexterity: 10 } as any,
  level: 1
});

const createDefender = (id: string, armorClass: number) => createMockCombatCharacter({
  id,
  name: id,
  team: 'player',
  armorClass,
  currentHP: 20,
  maxHP: 20
});

describe('AbilityCommandFactory multi-target dispatch', () => {
  const cleaveStrike: Ability = {
    id: 'cleave_strike',
    name: 'Cleave Strike',
    description: 'One swing that reaches two foes.',
    type: 'attack',
    cost: { type: 'action' },
    targeting: 'multiple_enemies',
    range: 1,
    attackBonus: 0,
    effects: [{ type: 'damage', value: 4, damageType: 'slashing' }]
  };

  it('resolves each target of an attack ability against its own AC', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(ROLL_TWELVE);
    const attacker = createStrikeAttacker();
    // A 12 total meets AC 12 (hit) and falls short of AC 20 (miss). One shared
    // roll therefore has to produce two different outcomes.
    const hittable = createDefender('fan-hittable', 12);
    const armored = createDefender('fan-armored', 20);

    const commands = AbilityCommandFactory.createCommands(
      cleaveStrike,
      attacker,
      [hittable, armored],
      {} as GameState
    );

    try {
      // One attack ability is still one command; the fan-out lives inside it.
      expect(commands).toHaveLength(1);

      const result = await commands[0].execute(createMockCombatState({
        characters: [attacker, hittable, armored],
        combatLog: []
      }));

      const updatedHittable = result.characters.find(character => character.id === hittable.id);
      const updatedArmored = result.characters.find(character => character.id === armored.id);

      expect(updatedHittable?.currentHP).toBeLessThan(20);
      expect(updatedArmored?.currentHP).toBe(20);
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('logs an attack entry for every target rather than only the first', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(ROLL_TWELVE);
    const attacker = createStrikeAttacker();
    const first = createDefender('fan-log-first', 12);
    const second = createDefender('fan-log-second', 12);

    const commands = AbilityCommandFactory.createCommands(
      cleaveStrike,
      attacker,
      [first, second],
      {} as GameState
    );

    try {
      const result = await commands[0].execute(createMockCombatState({
        characters: [attacker, first, second],
        combatLog: []
      }));

      // Both defenders share an AC the shared roll beats, so a loop that
      // stopped after targets[0] would leave the second one at full HP and
      // absent from the log.
      const updatedFirst = result.characters.find(character => character.id === first.id);
      const updatedSecond = result.characters.find(character => character.id === second.id);
      expect(updatedFirst?.currentHP).toBeLessThan(20);
      expect(updatedSecond?.currentHP).toBeLessThan(20);

      const mentionsTarget = (targetId: string) => result.combatLog.some(entry =>
        (entry.targetIds || []).includes(targetId)
      );
      expect(mentionsTarget(first.id)).toBe(true);
      expect(mentionsTarget(second.id)).toBe(true);
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('applies a non-attack damage effect to every target through one effect command', async () => {
    // A utility-typed ability skips the attack wrapper entirely: the effect is
    // mapped to a SpellEffect and the resulting DamageCommand reads the whole
    // target list off its context.
    const burst: Ability = {
      id: 'ember_burst',
      name: 'Ember Burst',
      description: 'A flat burst that scorches everyone in the template.',
      type: 'utility',
      cost: { type: 'action' },
      targeting: 'area',
      range: 30,
      areaShape: 'circle',
      areaSize: 2,
      effects: [{ type: 'damage', value: 5, damageType: 'fire' }]
    };

    const caster = createStrikeAttacker();
    const first = createDefender('burst-first', 12);
    const second = createDefender('burst-second', 20);

    const commands = AbilityCommandFactory.createCommands(
      burst,
      caster,
      [first, second],
      {} as GameState
    );

    expect(commands).toHaveLength(1);
    expect(commands[0]).toBeInstanceOf(DamageCommand);

    const result = await commands[0].execute(createMockCombatState({
      characters: [caster, first, second],
      combatLog: []
    }));

    // AC is irrelevant on this lane, so the high-AC target must be hurt too.
    expect(result.characters.find(character => character.id === first.id)?.currentHP).toBe(15);
    expect(result.characters.find(character => character.id === second.id)?.currentHP).toBe(15);
  });

  it('produces one command per mappable effect and drops unmappable ones', async () => {
    // Multi-effect abilities are the other axis of fan-out. Damage and healing
    // both map; a bare `movement` effect that is not a teleport deliberately
    // does not, because useActionExecutor owns movement economy.
    const mixed: Ability = {
      id: 'searing_mend',
      name: 'Searing Mend',
      description: 'Scorches a foe, mends an ally, and shoves them apart.',
      type: 'utility',
      cost: { type: 'action' },
      targeting: 'multiple_any',
      range: 30,
      effects: [
        { type: 'damage', value: 3, damageType: 'fire' },
        { type: 'heal', value: 2 },
        { type: 'movement', value: 10 }
      ]
    };

    const caster = createStrikeAttacker();
    const target = createDefender('mixed-target', 12);

    const commands = AbilityCommandFactory.createCommands(
      mixed,
      caster,
      [target],
      {} as GameState
    );

    expect(commands).toHaveLength(2);
    expect(commands[0]).toBeInstanceOf(DamageCommand);
  });
});

describe('AbilityCommandFactory save-bearing abilities', () => {
  const createSaveAbility = (): Ability => ({
    id: 'scorching_wave',
    name: 'Scorching Wave',
    description: 'A wave of flame; a Dexterity save halves the damage.',
    type: 'utility',
    cost: { type: 'action' },
    targeting: 'area',
    range: 30,
    areaShape: 'cone',
    areaSize: 3,
    saveDC: 15,
    saveAbility: 'Dexterity',
    effects: [{ type: 'damage', value: 8, damageType: 'fire' }]
  });

  it('does not yet carry saveDC or saveAbility onto the mapped damage effect', () => {
    const caster = createStrikeAttacker();
    const target = createDefender('save-target', 12);

    const commands = AbilityCommandFactory.createCommands(
      createSaveAbility(),
      caster,
      [target],
      {} as GameState
    );

    expect(commands).toHaveLength(1);
    const damageCommand = commands[0] as DamageCommand;
    const mappedEffect = (damageCommand as any).effect;

    // CHARACTERIZATION, not an endorsement. AbilityEffectMapper hardcodes
    // `condition: { type: 'always' }`, so the ability's declared DC 15 Dexterity
    // save never reaches the command that knows how to roll it. When the mapper
    // learns to emit `{ type: 'saving_throw', saveType: 'Dexterity',
    // saveDC: 15, saveEffect: 'half' }`, this expectation should flip.
    expect(mappedEffect.condition).toEqual({ type: 'always' });
    expect(mappedEffect.condition.saveDC).toBeUndefined();
    expect(mappedEffect.condition.saveEffect).toBeUndefined();
  });

  it('applies full damage to a target that should have saved for half', async () => {
    const caster = createStrikeAttacker();
    // A wildly high Dexterity would clear DC 15 on nearly any roll, so a wired
    // save lane would leave this target on 16 HP, not 12.
    const nimble = createMockCombatCharacter({
      id: 'save-nimble',
      name: 'Nimble',
      team: 'player',
      currentHP: 20,
      maxHP: 20,
      stats: { dexterity: 30 } as any
    });

    const commands = AbilityCommandFactory.createCommands(
      createSaveAbility(),
      caster,
      [nimble],
      {} as GameState
    );

    const result = await commands[0].execute(createMockCombatState({
      characters: [caster, nimble],
      combatLog: []
    }));

    // Full 8 damage, no save rolled and none logged.
    expect(result.characters.find(character => character.id === nimble.id)?.currentHP).toBe(12);
    expect(result.combatLog.some(entry => /sav(e|ing)/i.test(entry.message))).toBe(false);
  });
});
