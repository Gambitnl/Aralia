import { describe, expect, it } from 'vitest';
import { createMockCombatCharacter, SpellCommandFactory, RegisterRiderCommand } from './AbilityCommandFactory.testHelpers';
import type { CombatState, GameState, Spell } from './AbilityCommandFactory.testHelpers';
import lightningArrow from '../../../../public/data/spells/level-3/lightning-arrow.json';

// ============================================================================
// Next-Attack Rider Data Contracts
// ============================================================================
// Lightning Arrow has two damage riders with different save rules. The primary
// attack target takes transformed-weapon damage directly on a hit, or half on a
// miss through the shared miss multiplier. The nearby burst targets are the ones
// that make Dexterity saves. Keeping this split in live data prevents the
// shared DamageCommand path from asking the primary target for a save it should
// not get.
// ============================================================================

describe('next-attack rider data contracts', () => {
  it('keeps Lightning Arrow primary damage non-save while the burst uses a Dexterity save', () => {
    const [primaryDamage, burstDamage] = lightningArrow.effects;

    expect(primaryDamage.condition).toEqual(expect.objectContaining({
      type: 'always'
    }));
    expect(primaryDamage).toEqual(expect.objectContaining({
      missDamageMultiplier: 0.5
    }));
    expect(burstDamage.condition).toEqual(expect.objectContaining({
      type: 'save',
      saveType: 'Dexterity',
      saveEffect: 'half'
    }));
    expect(burstDamage.areaOfEffect).toEqual(expect.objectContaining({
      shape: 'Sphere',
      size: 10
    }));
  });

  it('registers Lightning Arrow riders with the live one-minute concentration window', async () => {
    const ranger = createMockCombatCharacter({
      id: 'ranger',
      name: 'Ranger',
      position: { x: 0, y: 0 }
    });
    const state: CombatState = {
      characters: [ranger],
      currentTurn: 1,
      round: 1,
      combatLog: []
    } as CombatState;

    // The hand-built hit/miss tests below prove rider behavior after the
    // riders exist. This live-data guard proves the actual spell-cast factory
    // registers those pending riders with Lightning Arrow's 1-minute duration
    // instead of a stale instantaneous or one-round window.
    const commands = await SpellCommandFactory.createCommands(
      lightningArrow as unknown as Spell,
      ranger,
      [ranger],
      3,
      {} as GameState
    );
    const riderCommands = commands.filter((command): command is RegisterRiderCommand =>
      command instanceof RegisterRiderCommand
    );

    const stateWithRiders = riderCommands.reduce(
      (nextState, command) => command.execute(nextState),
      state
    );
    const updatedRanger = stateWithRiders.characters.find(character => character.id === ranger.id);

    expect(riderCommands).toHaveLength(2);
    expect(updatedRanger?.riders?.map(rider => rider.duration)).toEqual([
      { type: 'minutes', value: 1 },
      { type: 'minutes', value: 1 }
    ]);
    expect(updatedRanger?.riders?.map(rider => rider.consumption)).toEqual([
      'per_instance_hit_or_miss',
      'per_instance_hit_or_miss'
    ]);
    expect(updatedRanger?.riders?.map(rider => rider.attackFilter)).toEqual([
      expect.objectContaining({ attackType: 'weapon', weaponType: 'ranged' }),
      expect.objectContaining({ attackType: 'weapon', weaponType: 'ranged' })
    ]);
    // The registered primary rider should stay focused on the attacked creature.
    // If it accidentally gains the burst area, the main target would be routed
    // through the wrong save-style splash path.
    const primaryRiderEffect = updatedRanger?.riders?.[0].effect;
    expect(primaryRiderEffect).toEqual(expect.objectContaining({
      missDamageMultiplier: 0.5,
      objectTransformation: expect.objectContaining({
        sourceObject: 'weapon_or_ammunition_used_for_attack'
      })
    }));
    expect(primaryRiderEffect).not.toHaveProperty('areaOfEffect');

    // The registered burst rider should stay separate from the primary
    // transformed-weapon hit/miss payload. If it inherits the miss multiplier,
    // missed weapon attacks would incorrectly halve the splash instead of using
    // the Dexterity-save half-damage rule.
    const burstRiderEffect = updatedRanger?.riders?.[1].effect;
    expect(burstRiderEffect).toEqual(expect.objectContaining({
      areaOfEffect: expect.objectContaining({
        shape: 'Sphere',
        size: 10
      }),
      condition: expect.objectContaining({
        type: 'save',
        saveType: 'Dexterity',
        saveEffect: 'half'
      })
    }));
    expect(burstRiderEffect).not.toHaveProperty('missDamageMultiplier');
  });
});
