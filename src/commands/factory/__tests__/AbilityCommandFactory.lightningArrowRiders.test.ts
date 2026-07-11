import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockCombatCharacter, WeaponAttackCommand } from './AbilityCommandFactory.testHelpers';
import type { Ability, ActiveRider, GameState } from './AbilityCommandFactory.testHelpers';

describe('WeaponAttackCommand: Lightning Arrow-style hit-or-miss riders', () => {
  afterEach(() => {
    // Miss-path tests pin the attack roll they promise to exercise. Restore the
    // shared random source so later rider cases keep their own behavior.
    vi.restoreAllMocks();
  });

  const createLightningArrowRiders = (casterId: string): ActiveRider[] => [
    {
      id: 'lightning-arrow-primary',
      spellId: 'lightning-arrow',
      casterId,
      sourceName: 'Lightning Arrow',
      effect: {
        type: 'DAMAGE',
        trigger: {
          type: 'on_attack_hit',
          frequency: 'every_time',
          consumption: 'per_instance_hit_or_miss',
          attackFilter: {
            weaponType: 'ranged',
            attackType: 'weapon'
          }
        },
        condition: {
          type: 'save',
          saveType: 'Dexterity',
          saveEffect: 'half'
        },
        damage: {
          dice: '4d8',
          type: 'Lightning'
        },
        objectTransformation: {
          sourceObject: 'weapon_or_ammunition_used_for_attack',
          temporaryForm: 'lightning_bolt',
          trigger: 'attack_hits_or_misses',
          returnsToNormalForm: true,
          description: 'The weapon or ammunition becomes the Lightning Arrow payload instead of dealing normal weapon damage.'
        },
        missDamageMultiplier: 0.5
      },
      consumption: 'per_instance_hit_or_miss',
      attackFilter: {
        weaponType: 'ranged',
        attackType: 'weapon'
      },
      usedThisTurn: false,
      duration: { type: 'minutes', value: 1 }
    } as ActiveRider,
    {
      id: 'lightning-arrow-burst',
      spellId: 'lightning-arrow',
      casterId,
      sourceName: 'Lightning Arrow',
      effect: {
        type: 'DAMAGE',
        trigger: {
          type: 'on_attack_hit',
          frequency: 'every_time',
          consumption: 'per_instance_hit_or_miss',
          attackFilter: {
            weaponType: 'ranged',
            attackType: 'weapon'
          }
        },
        condition: {
          type: 'save',
          saveType: 'Dexterity',
          saveEffect: 'half'
        },
        damage: {
          dice: '2d8',
          type: 'Lightning'
        },
        areaOfEffect: {
          shape: 'Sphere',
          size: 10,
          height: 0
        }
      },
      consumption: 'per_instance_hit_or_miss',
      attackFilter: {
        weaponType: 'ranged',
        attackType: 'weapon'
      },
      usedThisTurn: false,
      duration: { type: 'minutes', value: 1 }
    } as ActiveRider
  ];

  const rangedAttack: Ability = {
    id: 'longbow_attack',
    name: 'Longbow Attack',
    description: 'A ranged weapon attack used to spend Lightning Arrow.',
    type: 'attack',
    cost: { type: 'action' },
    targeting: 'single_enemy',
    range: 12,
    isProficient: true,
    attackBonus: 99,
    effects: []
  };

  it('applies primary and burst rider payloads on a ranged weapon hit, then consumes the riders', async () => {
    const ranger = createMockCombatCharacter({
      id: 'ranger',
      name: 'Ranger',
      position: { x: 0, y: 0 },
      riders: createLightningArrowRiders('ranger')
    });
    const primaryTarget = createMockCombatCharacter({
      id: 'primary-target',
      name: 'Primary Target',
      position: { x: 4, y: 0 },
      currentHP: 100,
      maxHP: 100,
      armorClass: 10
    });
    const nearbyTarget = createMockCombatCharacter({
      id: 'nearby-target',
      name: 'Nearby Target',
      position: { x: 5, y: 0 },
      currentHP: 100,
      maxHP: 100
    });
    const farTarget = createMockCombatCharacter({
      id: 'far-target',
      name: 'Far Target',
      position: { x: 8, y: 0 },
      currentHP: 100,
      maxHP: 100
    });
    const command = new WeaponAttackCommand(rangedAttack, ranger, [primaryTarget], {
      spellId: rangedAttack.id,
      spellName: rangedAttack.name,
      castAtLevel: 0,
      caster: ranger,
      targets: [primaryTarget],
      gameState: { characters: [ranger, primaryTarget, nearbyTarget, farTarget], combatLog: [] } as unknown as GameState
    });

    const newState = await command.execute({
      characters: [ranger, primaryTarget, nearbyTarget, farTarget],
      combatLog: []
    } as any);

    const updatedRanger = newState.characters.find(character => character.id === ranger.id);
    const updatedPrimary = newState.characters.find(character => character.id === primaryTarget.id);
    const updatedNearby = newState.characters.find(character => character.id === nearbyTarget.id);
    const updatedFar = newState.characters.find(character => character.id === farTarget.id);

    // A hit spends both Lightning Arrow riders. The primary target receives
    // only the transformed-weapon primary damage, and nearby secondary
    // creatures receive the shared burst payload. A creature outside 10 feet of
    // the attacked target is not included in the burst.
    expect(updatedRanger?.riders ?? []).toHaveLength(0);
    expect(updatedPrimary?.currentHP).toBeLessThan(100);
    expect(updatedNearby?.currentHP).toBeLessThan(100);
    expect(updatedFar?.currentHP).toBe(100);
    // The burst can also include the attacked creature when the area is centered
    // on that target, so count the Lightning Arrow primary payload by its
    // player-facing transformed-shot log instead of every damage log that names
    // the primary target.
    expect(newState.combatLog.filter(entry =>
      entry.type === 'damage' &&
      entry.targetIds?.includes(primaryTarget.id) &&
      entry.message.includes('with Lightning Arrow')
    )).toHaveLength(1);
    expect(newState.combatLog.some(entry =>
      entry.type === 'damage' &&
      entry.targetIds?.includes(nearbyTarget.id)
    )).toBe(true);
    // Damage logs are player-facing proof of which spell or attack caused an
    // effect. Hit riders must identify the rider spell, not the longbow button
    // that delivered the shot, so Lightning Arrow remains traceable in combat
    // history and downstream proof.
    expect(newState.combatLog.some(entry =>
      entry.type === 'damage' &&
      entry.message.includes('with Lightning Arrow')
    )).toBe(true);
  });

  it('replaces normal weapon payloads when the Lightning Arrow rider transforms the ammunition', async () => {
    const ranger = createMockCombatCharacter({
      id: 'ranger',
      name: 'Ranger',
      position: { x: 0, y: 0 },
      riders: createLightningArrowRiders('ranger')
    });
    const primaryTarget = createMockCombatCharacter({
      id: 'primary-target',
      name: 'Primary Target',
      position: { x: 4, y: 0 },
      currentHP: 500,
      maxHP: 500,
      armorClass: 10
    });
    const heavyBowAttack: Ability = {
      ...rangedAttack,
      effects: [{
        type: 'damage',
        value: 300,
        damageType: 'piercing'
      }]
    };
    const command = new WeaponAttackCommand(heavyBowAttack, ranger, [primaryTarget], {
      spellId: heavyBowAttack.id,
      spellName: heavyBowAttack.name,
      castAtLevel: 0,
      caster: ranger,
      targets: [primaryTarget],
      gameState: { characters: [ranger, primaryTarget], combatLog: [] } as unknown as GameState
    });

    const newState = await command.execute({
      characters: [ranger, primaryTarget],
      combatLog: []
    } as any);

    const updatedPrimary = newState.characters.find(character => character.id === primaryTarget.id);

    // The bow's deliberately huge 300-damage payload would dwarf Lightning
    // Arrow's 4d8 primary and 2d8 burst rider. If normal weapon damage leaked
    // through, the target would fall far below this threshold. Staying above
    // it proves the spell rider replaced the attack payload instead of stacking
    // on top of it.
    expect(updatedPrimary?.currentHP ?? 0).toBeGreaterThan(350);
  });

  it('applies miss half-damage and burst payloads on a ranged weapon miss, then consumes the riders', async () => {
    // A -99 attack bonus still auto-hits on a natural 20. Pin a normal roll so
    // this case always proves the miss payload instead of occasionally taking
    // the separately covered hit branch in a long aggregate.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const ranger = createMockCombatCharacter({
      id: 'ranger',
      name: 'Ranger',
      position: { x: 0, y: 0 },
      riders: createLightningArrowRiders('ranger')
    });
    const primaryTarget = createMockCombatCharacter({
      id: 'primary-target',
      name: 'Primary Target',
      position: { x: 4, y: 0 },
      currentHP: 100,
      maxHP: 100,
      armorClass: 200
    });
    const nearbyTarget = createMockCombatCharacter({
      id: 'nearby-target',
      name: 'Nearby Target',
      position: { x: 5, y: 0 },
      currentHP: 100,
      maxHP: 100
    });
    const farTarget = createMockCombatCharacter({
      id: 'far-target',
      name: 'Far Target',
      position: { x: 8, y: 0 },
      currentHP: 100,
      maxHP: 100
    });
    const missingRangedAttack: Ability = {
      ...rangedAttack,
      attackBonus: -99
    };
    const command = new WeaponAttackCommand(missingRangedAttack, ranger, [primaryTarget], {
      spellId: missingRangedAttack.id,
      spellName: missingRangedAttack.name,
      castAtLevel: 0,
      caster: ranger,
      targets: [primaryTarget],
      gameState: { characters: [ranger, primaryTarget, nearbyTarget, farTarget], combatLog: [] } as unknown as GameState
    });

    const newState = await command.execute({
      characters: [ranger, primaryTarget, nearbyTarget, farTarget],
      combatLog: []
    } as any);

    const updatedRanger = newState.characters.find(character => character.id === ranger.id);
    const updatedPrimary = newState.characters.find(character => character.id === primaryTarget.id);
    const updatedNearby = newState.characters.find(character => character.id === nearbyTarget.id);
    const updatedFar = newState.characters.find(character => character.id === farTarget.id);

    // A miss still spends the next-attack rider. The primary target receives
    // the miss multiplier damage, and the burst still resolves around that
    // same attacked target through the shared DamageCommand route.
    expect(updatedRanger?.riders ?? []).toHaveLength(0);
    expect(updatedPrimary?.currentHP).toBeLessThan(100);
    expect(updatedNearby?.currentHP).toBeLessThan(100);
    expect(updatedFar?.currentHP).toBe(100);
    expect(newState.combatLog.filter(entry =>
      entry.type === 'damage' &&
      entry.targetIds?.includes(primaryTarget.id)
    )).toHaveLength(1);
    expect(newState.combatLog.some(entry =>
      entry.type === 'damage' &&
      entry.targetIds?.includes(nearbyTarget.id)
    )).toBe(true);
    // The miss branch uses a separate half-damage command before the burst.
    // It still needs to preserve the spell rider source so combat history does
    // not describe the transformed lightning payload as ordinary bow damage.
    expect(newState.combatLog.some(entry =>
      entry.type === 'damage' &&
      entry.message.includes('with Lightning Arrow')
    )).toBe(true);
  });

  it('does not reuse Lightning Arrow riders on a later ranged weapon attack', async () => {
    const ranger = createMockCombatCharacter({
      id: 'ranger',
      name: 'Ranger',
      position: { x: 0, y: 0 },
      riders: createLightningArrowRiders('ranger')
    });
    const primaryTarget = createMockCombatCharacter({
      id: 'primary-target',
      name: 'Primary Target',
      position: { x: 4, y: 0 },
      currentHP: 100,
      maxHP: 100,
      armorClass: 10
    });
    const nearbyTarget = createMockCombatCharacter({
      id: 'nearby-target',
      name: 'Nearby Target',
      position: { x: 5, y: 0 },
      currentHP: 100,
      maxHP: 100
    });
    const firstCommand = new WeaponAttackCommand(rangedAttack, ranger, [primaryTarget], {
      spellId: rangedAttack.id,
      spellName: rangedAttack.name,
      castAtLevel: 0,
      caster: ranger,
      targets: [primaryTarget],
      gameState: { characters: [ranger, primaryTarget, nearbyTarget], combatLog: [] } as unknown as GameState
    });

    const stateAfterFirstAttack = await firstCommand.execute({
      characters: [ranger, primaryTarget, nearbyTarget],
      combatLog: []
    } as any);
    const rangerAfterFirstAttack = stateAfterFirstAttack.characters.find(character => character.id === ranger.id)!;
    const primaryAfterFirstAttack = stateAfterFirstAttack.characters.find(character => character.id === primaryTarget.id)!;
    const nearbyAfterFirstAttack = stateAfterFirstAttack.characters.find(character => character.id === nearbyTarget.id)!;
    const secondCommand = new WeaponAttackCommand(rangedAttack, rangerAfterFirstAttack, [primaryAfterFirstAttack], {
      spellId: rangedAttack.id,
      spellName: rangedAttack.name,
      castAtLevel: 0,
      caster: rangerAfterFirstAttack,
      targets: [primaryAfterFirstAttack],
      gameState: { characters: [rangerAfterFirstAttack, primaryAfterFirstAttack, nearbyAfterFirstAttack], combatLog: [] } as unknown as GameState
    });

    const stateAfterSecondAttack = await secondCommand.execute({
      characters: [rangerAfterFirstAttack, primaryAfterFirstAttack, nearbyAfterFirstAttack],
      combatLog: []
    } as any);
    const primaryAfterSecondAttack = stateAfterSecondAttack.characters.find(character => character.id === primaryTarget.id);
    const nearbyAfterSecondAttack = stateAfterSecondAttack.characters.find(character => character.id === nearbyTarget.id);

    // Lightning Arrow is consumed by the first matching attack. Because this
    // test attack has no ordinary weapon-damage effect, the second attack is a
    // clean guard: if either target loses more HP, the one-shot rider leaked.
    expect(rangerAfterFirstAttack.riders ?? []).toHaveLength(0);
    expect(primaryAfterSecondAttack?.currentHP).toBe(primaryAfterFirstAttack.currentHP);
    expect(nearbyAfterSecondAttack?.currentHP).toBe(nearbyAfterFirstAttack.currentHP);
  });

  it('does not spend Lightning Arrow riders on a melee weapon attack', async () => {
    const ranger = createMockCombatCharacter({
      id: 'ranger',
      name: 'Ranger',
      position: { x: 0, y: 0 },
      riders: createLightningArrowRiders('ranger')
    });
    const primaryTarget = createMockCombatCharacter({
      id: 'primary-target',
      name: 'Primary Target',
      position: { x: 1, y: 0 },
      currentHP: 100,
      maxHP: 100,
      armorClass: 10
    });
    const meleeAttack: Ability = {
      id: 'shortsword_attack',
      name: 'Shortsword Attack',
      description: 'A melee weapon attack that should not spend Lightning Arrow.',
      type: 'attack',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: 1,
      isProficient: true,
      attackBonus: 99,
      effects: []
    };
    const command = new WeaponAttackCommand(meleeAttack, ranger, [primaryTarget], {
      spellId: meleeAttack.id,
      spellName: meleeAttack.name,
      castAtLevel: 0,
      caster: ranger,
      targets: [primaryTarget],
      gameState: { characters: [ranger, primaryTarget], combatLog: [] } as unknown as GameState
    });

    const newState = await command.execute({
      characters: [ranger, primaryTarget],
      combatLog: []
    } as any);

    const updatedRanger = newState.characters.find(character => character.id === ranger.id);
    const updatedPrimary = newState.characters.find(character => character.id === primaryTarget.id);

    // Lightning Arrow waits for a ranged weapon attack. A melee hit can still
    // happen while the spell is pending, but it must not transform the weapon,
    // consume the pending riders, or create lightning damage.
    expect(updatedRanger?.riders ?? []).toHaveLength(2);
    expect(updatedPrimary?.currentHP).toBe(100);
    expect(newState.combatLog.some(entry =>
      entry.type === 'damage' &&
      entry.message.includes('with Lightning Arrow')
    )).toBe(false);
  });

  it('does not spend Lightning Arrow riders on a spell attack', async () => {
    const ranger = createMockCombatCharacter({
      id: 'ranger',
      name: 'Ranger',
      position: { x: 0, y: 0 },
      riders: createLightningArrowRiders('ranger')
    });
    const primaryTarget = createMockCombatCharacter({
      id: 'primary-target',
      name: 'Primary Target',
      position: { x: 4, y: 0 },
      currentHP: 100,
      maxHP: 100,
      armorClass: 10
    });
    const spellAttack: Ability = {
      id: 'ranged_spell_attack',
      name: 'Ranged Spell Attack',
      description: 'A spell attack that should not spend Lightning Arrow.',
      type: 'attack',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: 12,
      isProficient: true,
      attackBonus: 99,
      effects: [],
      attackType: 'spell'
    } as unknown as Ability;
    const command = new WeaponAttackCommand(spellAttack, ranger, [primaryTarget], {
      spellId: spellAttack.id,
      spellName: spellAttack.name,
      castAtLevel: 0,
      caster: ranger,
      targets: [primaryTarget],
      gameState: { characters: [ranger, primaryTarget], combatLog: [] } as unknown as GameState
    });

    const newState = await command.execute({
      characters: [ranger, primaryTarget],
      combatLog: []
    } as any);

    const updatedRanger = newState.characters.find(character => character.id === ranger.id);
    const updatedPrimary = newState.characters.find(character => character.id === primaryTarget.id);

    // Lightning Arrow belongs to ranged weapon attacks, not all ranged attack
    // rolls. A spell attack can be ranged and still must leave the pending
    // transformed-ammunition riders untouched.
    expect(updatedRanger?.riders ?? []).toHaveLength(2);
    expect(updatedPrimary?.currentHP).toBe(100);
    expect(newState.combatLog.some(entry =>
      entry.type === 'damage' &&
      entry.message.includes('with Lightning Arrow')
    )).toBe(false);
  });

  it('keeps Lightning Arrow riders on the spell duration window before they are spent', () => {
    const [primaryRider, burstRider] = createLightningArrowRiders('ranger');

    // Lightning Arrow waits for the next qualifying ranged weapon attack for
    // up to 1 minute with concentration. The active rider fixtures mirror that
    // pending window so the hit/miss tests do not silently prove a stale
    // 1-round or instantaneous rider model.
    expect(primaryRider.duration).toEqual({ type: 'minutes', value: 1 });
    expect(burstRider.duration).toEqual({ type: 'minutes', value: 1 });
  });
});
