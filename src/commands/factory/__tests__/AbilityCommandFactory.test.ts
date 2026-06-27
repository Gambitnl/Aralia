/**
 * This test file checks the bridge from battle-map abilities into command objects.
 *
 * Combat abilities are lightweight button data, while commands are the objects
 * that actually roll attacks, apply healing, and write effect logs. These tests
 * protect the important split: attacks create attack commands, but Dash-style
 * movement does not masquerade as a weapon attack.
 */
import { describe, expect, it, vi } from 'vitest';
import { Ability } from '../../../types/combat';
import { GameState } from '../../../types';
import { createMockCombatCharacter } from '../../../utils/factories';
import { AbilityCommandFactory, WeaponAttackCommand } from '../AbilityCommandFactory';
import { combatEvents } from '../../../systems/events/CombatEvents';
import { DismissFamiliarToPocketCommand, RecallFamiliarFromPocketCommand } from '../../effects/FamiliarPocketCommands';
import { CommandedSummonCommand } from '../../effects/CommandedSummonCommand';

// ============================================================================
// Ability Translation
// ============================================================================
// This section keeps non-attack actions from accidentally re-entering the weapon
// attack path while preserving command support for true attacks and direct
// non-attack effects like healing.
// ============================================================================

describe('AbilityCommandFactory', () => {
  it('creates a weapon attack command for attack abilities', () => {
    const attacker = createMockCombatCharacter({ id: 'attacker', name: 'Attacker' });
    const target = createMockCombatCharacter({ id: 'target', name: 'Target' });
    const attack: Ability = {
      id: 'basic_attack',
      name: 'Basic Attack',
      description: 'A normal melee strike.',
      type: 'attack',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: 1,
      effects: [{ type: 'damage', value: 4, damageType: 'physical' }]
    };

    // Real attacks should still roll through WeaponAttackCommand so hit/miss,
    // cover, riders, and damage command behavior stay centralized.
    const commands = AbilityCommandFactory.createCommands(attack, attacker, [target], {} as any);

    expect(commands).toHaveLength(1);
    expect(commands[0]).toBeInstanceOf(WeaponAttackCommand);
  });

  it('does not create an attack command for Dash movement', () => {
    const actor = createMockCombatCharacter({ id: 'actor', name: 'Actor' });
    const dash: Ability = {
      id: 'dash',
      name: 'Dash',
      description: 'Gain extra movement for the turn.',
      type: 'movement',
      cost: { type: 'action' },
      targeting: 'self',
      range: 0,
      effects: [{ type: 'movement', value: 30 }]
    };

    // Dash is resolved by useActionExecutor because it changes movement economy
    // for the current turn. Returning no command prevents the old self-attack.
    const commands = AbilityCommandFactory.createCommands(dash, actor, [actor], {} as any);

    expect(commands).toHaveLength(0);
  });

  it('keeps direct healing effects on the command path', () => {
    const actor = createMockCombatCharacter({ id: 'actor', name: 'Actor' });
    const secondWind: Ability = {
      id: 'second_wind',
      name: 'Second Wind',
      description: 'Regain hit points.',
      type: 'utility',
      cost: { type: 'bonus' },
      targeting: 'self',
      range: 0,
      effects: [{ type: 'heal', value: 11 }]
    };

    // Non-attack utility effects still use commands when they have a concrete
    // command-side effect. This preserves future class-feature behavior while
    // removing the accidental weapon attack.
    const commands = AbilityCommandFactory.createCommands(secondWind, actor, [actor], {} as any);

    expect(commands).toHaveLength(1);
    expect(commands[0].metadata.effectType).toBe('HEALING');
  });

  it('uses the source spell id when creating familiar pocket commands', () => {
    const actor = createMockCombatCharacter({ id: 'actor', name: 'Actor' });
    const dismissFamiliar: Ability = {
      id: 'familiar_dismiss_find-familiar',
      sourceSpellId: 'find-familiar',
      name: 'Dismiss Familiar',
      description: 'Dismiss the familiar created by Find Familiar.',
      type: 'utility',
      cost: { type: 'action' },
      targeting: 'self',
      range: 0,
      effects: [{ type: 'familiar_pocket', familiarPocketAction: 'dismiss' }]
    };
    const recallFamiliar: Ability = {
      ...dismissFamiliar,
      id: 'familiar_recall_find-familiar',
      name: 'Recall Familiar',
      effects: [{ type: 'familiar_pocket', familiarPocketAction: 'recall' }]
    };

    const dismissCommands = AbilityCommandFactory.createCommands(dismissFamiliar, actor, [actor], {} as any);
    const recallCommands = AbilityCommandFactory.createCommands(recallFamiliar, actor, [actor], {} as any);

    // The familiar pocket commands compare their context spell id against
    // summonMetadata.spellId. The generated ability button has a different id,
    // so the factory must preserve the source spell id or the runtime button
    // cannot find its own familiar.
    expect(dismissCommands[0]).toBeInstanceOf(DismissFamiliarToPocketCommand);
    expect(dismissCommands[0].metadata.spellId).toBe('find-familiar');
    expect(recallCommands[0]).toBeInstanceOf(RecallFamiliarFromPocketCommand);
    expect(recallCommands[0].metadata.spellId).toBe('find-familiar');
  });

  it('places commanded-summon gates before summon attack commands', () => {
    const summon = createMockCombatCharacter({
      id: 'summon-beast',
      name: 'Bestial Spirit',
      isSummon: true,
      summonMetadata: {
        casterId: 'druid',
        spellId: 'summon-beast',
        sourceName: 'Summon Beast',
        commandCost: 'bonus_action',
        commandsPerTurn: 1,
        commandsUsedThisTurn: 0,
        dismissable: false
      }
    });
    const target = createMockCombatCharacter({ id: 'target', name: 'Target' });
    const rend: Ability = {
      id: 'summon_beast_rend',
      sourceSpellId: 'summon-beast',
      name: 'Rend',
      description: 'The spirit attacks after being commanded.',
      type: 'attack',
      cost: { type: 'bonus' },
      targeting: 'single_enemy',
      range: 1,
      effects: [
        { type: 'commanded_summon', commandedSummonAction: 'issue_command', summonCommandDescription: 'The spirit attacks after being commanded.' },
        { type: 'damage', dice: '1d8', damageType: 'physical' }
      ]
    };

    // Summon attacks are still attacks, but they must first spend the
    // spell-authored command budget. This protects Summon Beast / Conjure Fey
    // style actions from bypassing the controlled-entity cadence.
    const commands = AbilityCommandFactory.createCommands(rend, summon, [target], {} as any);

    expect(commands).toHaveLength(2);
    expect(commands[0]).toBeInstanceOf(CommandedSummonCommand);
    expect(commands[1]).toBeInstanceOf(WeaponAttackCommand);
  });

  it('blocks summon attack commands after the command budget is spent', () => {
    const summon = createMockCombatCharacter({
      id: 'summon-beast',
      name: 'Bestial Spirit',
      isSummon: true,
      summonMetadata: {
        casterId: 'druid',
        spellId: 'summon-beast',
        sourceName: 'Summon Beast',
        commandCost: 'bonus_action',
        commandsPerTurn: 1,
        commandsUsedThisTurn: 1,
        dismissable: false
      }
    });
    const target = createMockCombatCharacter({ id: 'target', name: 'Target' });
    const rend: Ability = {
      id: 'summon_beast_rend',
      sourceSpellId: 'summon-beast',
      name: 'Rend',
      description: 'The spirit attacks after being commanded.',
      type: 'attack',
      cost: { type: 'bonus' },
      targeting: 'single_enemy',
      range: 1,
      effects: [
        { type: 'commanded_summon', commandedSummonAction: 'issue_command', summonCommandDescription: 'The spirit attacks after being commanded.' },
        { type: 'damage', dice: '1d8', damageType: 'physical' }
      ]
    };

    // Once the summon has spent its allowed command, only the command gate is
    // returned. The gate logs the rejection; damage/attack commands are not
    // created, so over-budget summon actions cannot leak their later effects.
    const commands = AbilityCommandFactory.createCommands(rend, summon, [target], {} as any);

    expect(commands).toHaveLength(1);
    expect(commands[0]).toBeInstanceOf(CommandedSummonCommand);
  });
});

describe('WeaponAttackCommand Proficiency Penalties', () => {
  it('emits structured miss results for attack-event subscribers', async () => {
    // Armor of Agathys-style and other attack-result consumers cannot safely
    // read prose combat logs. The command-side weapon attack roll already knows
    // whether the target was hit, so it should publish that result on the
    // combat event bus for runtime subscribers.
    combatEvents.clearForTest();
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

    try {
      const attacker = createMockCombatCharacter({
        id: 'attacker',
        name: 'Attacker',
        stats: {
          baseInitiative: 0,
          speed: 30,
          cr: '0',
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 10,
          charisma: 10
        }
      });
      const target = createMockCombatCharacter({
        id: 'target',
        name: 'Target',
        armorClass: 30
      });
      const attack: Ability = {
        id: 'miss_event_attack',
        name: 'Miss Event Attack',
        description: 'A weapon attack that is forced to miss for event proof.',
        type: 'attack',
        cost: { type: 'action' },
        targeting: 'single_enemy',
        range: 1,
        isProficient: false,
        effects: [{ type: 'damage', value: 4, damageType: 'physical' }]
      };

      const command = new WeaponAttackCommand(attack, attacker, [target], {
        spellId: attack.id,
        spellName: attack.name,
        castAtLevel: 0,
        caster: attacker,
        targets: [target],
        gameState: { characters: [attacker, target], combatLog: [] } as unknown as GameState
      });

      await command.execute({ characters: [attacker, target], combatLog: [] } as any);

      expect(combatEvents.getDispatchLog()).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'unit_attack',
          attackerId: attacker.id,
          targetId: target.id,
          isHit: false,
          isCrit: false,
          attackType: 'weapon',
          weaponType: 'melee'
        })
      ]));
    } finally {
      randomSpy.mockRestore();
      combatEvents.clearForTest();
    }
  });

  it('omits proficiency bonus when attacking with a non-proficient weapon', async () => {
    const attacker = createMockCombatCharacter({
      id: 'attacker',
      name: 'Attacker',
      level: 1, // pb = 2
      stats: { baseInitiative: 0, speed: 30, cr: '0',
        strength: 14, // +2 mod
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10
      }
    });

    const target = createMockCombatCharacter({ id: 'target', name: 'Target' });

    const attack: Ability = {
      id: 'unproficient_attack',
      name: 'Unproficient Attack',
      description: 'A melee strike with a non-proficient weapon.',
      type: 'attack',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: 1,
      isProficient: false, // Explicitly not proficient
      effects: [{ type: 'damage', value: 4, damageType: 'physical' }]
    };

    const command = new WeaponAttackCommand(attack, attacker, [target], {
      spellId: attack.id,
      spellName: attack.name,
      castAtLevel: 0,
      caster: attacker,
      targets: [target],
      gameState: { characters: [attacker, target], combatLog: [] } as unknown as GameState
    });

    const newState = await command.execute({ characters: [attacker, target], combatLog: [] } as any);

    const logMessage = newState.combatLog[0].message;
    expect(logMessage).toContain('+ 2 =');
  });
});


describe('Active Effect Riders (Bless/Bane)', () => {
  it('consumes a bonus die from an active effect on the attacker', async () => {
    const attacker = createMockCombatCharacter({
      id: 'attacker',
      name: 'Attacker',
      level: 1, // pb = 2
      stats: { baseInitiative: 0, speed: 30, cr: '0',
        strength: 14, // +2 mod
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10
      },
      activeEffects: [{
        id: 'bless_effect',
        spellId: 'bless',
        casterId: 'cleric',
        sourceName: 'Bless',
        type: 'buff',
        duration: { type: 'minutes', value: 1 },
        startTime: 1,
        mechanics: {
          attackRollDirection: 'outgoing',
          attackRollModifier: 'bonus',
          attackRollConsumption: 'while_active',
          attackRollKind: 'any',
          attackRollDice: '1d4' // Using dice, but we will mock rollDice if possible, or just verify 'Mods: ' is in log
        }
      }]
    });

    const target = createMockCombatCharacter({ id: 'target', name: 'Target' });

    const attack: Ability = {
      id: 'basic_attack',
      name: 'Basic Attack',
      description: 'A melee strike.',
      type: 'attack',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: 1,
      isProficient: true, // pb + str = 2 + 2 = +4
      effects: [{ type: 'damage', value: 4, damageType: 'physical' }]
    };

    const command = new WeaponAttackCommand(attack, attacker, [target], {
      spellId: attack.id,
      spellName: attack.name,
      castAtLevel: 0,
      caster: attacker,
      targets: [target],
      gameState: { characters: [attacker, target], combatLog: [] } as unknown as GameState
    });

    const newState = await command.execute({ characters: [attacker, target], combatLog: [] } as any);

    const logMessage = newState.combatLog[0].message;
    // The base modifier is 4, but with bless it should be > 4
    // We expect the log to contain '(Mods: '
    expect(logMessage).toMatch(/Mods: \+\d+ \[Bless\]/);
  });

  it('consumes a penalty die from an active effect on the attacker', async () => {
    const attacker = createMockCombatCharacter({
      id: 'attacker',
      name: 'Attacker',
      level: 1, // pb = 2
      stats: { baseInitiative: 0, speed: 30, cr: '0',
        strength: 14, // +2 mod
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10
      },
      activeEffects: [{
        id: 'bane_effect',
        spellId: 'bane',
        casterId: 'cleric',
        sourceName: 'Bane',
        type: 'debuff',
        duration: { type: 'minutes', value: 1 },
        startTime: 1,
        mechanics: {
          attackRollDirection: 'outgoing',
          attackRollModifier: 'penalty',
          attackRollConsumption: 'while_active',
          attackRollKind: 'any',
          attackRollDice: '1d4'
        }
      }]
    });

    const target = createMockCombatCharacter({ id: 'target', name: 'Target' });

    const attack: Ability = {
      id: 'basic_attack',
      name: 'Basic Attack',
      description: 'A melee strike.',
      type: 'attack',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: 1,
      isProficient: true,
      effects: [{ type: 'damage', value: 4, damageType: 'physical' }]
    };

    const command = new WeaponAttackCommand(attack, attacker, [target], {
      spellId: attack.id,
      spellName: attack.name,
      castAtLevel: 0,
      caster: attacker,
      targets: [target],
      gameState: { characters: [attacker, target], combatLog: [] } as unknown as GameState
    });

    const newState = await command.execute({ characters: [attacker, target], combatLog: [] } as any);

    const logMessage = newState.combatLog[0].message;
    expect(logMessage).toMatch(/Mods: -\d+ \[Bane\]/);
  });
});

describe('WeaponAttackCommand: Sneak Attack (G9)', () => {
  it('triggers Sneak Attack with Advantage for a Rogue using a finesse weapon', async () => {
    const rogue = createMockCombatCharacter({
      id: 'rogue_hero',
      name: 'Rogue Hero',
      level: 3, // Sneak attack should be Math.ceil(3/2)d6 = 2d6
      class: { id: 'rogue', name: 'Rogue' } as any,
      stats: { baseInitiative: 0, speed: 30, cr: '0', strength: 10, dexterity: 16, constitution: 12, intelligence: 10, wisdom: 10, charisma: 10 },
      featUsageThisTurn: [],
      modifiers: { advantage: ['attack'], disadvantage: [], bonuses: [] } as any
    });

    const target = createMockCombatCharacter({
      id: 'enemy_goblin',
      name: 'Goblin',
      armorClass: 10,
      currentHP: 30,
      maxHP: 30
    });

    const rapierAttack: Ability = {
      id: 'rapier_attack',
      name: 'Rapier Attack',
      description: 'Attack with a finesse weapon.',
      type: 'attack',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: 1,
      isProficient: true,
      // This proof is about Sneak Attack with Advantage, not random accuracy.
      // Keep the base strike deterministic so the Sneak Attack branch is what
      // the test actually exercises.
      attackBonus: 99,
      weapon: {
        id: 'rapier',
        name: 'Rapier',
        type: 'weapon',
        properties: ['finesse'], // Finesse property makes it eligible
        category: 'Martial Weapon'
      } as any,
      effects: [{ type: 'damage', value: 4, damageType: 'piercing', dice: '1d8' }]
    };

    const command = new WeaponAttackCommand(rapierAttack, rogue, [target], {
      spellId: rapierAttack.id,
      spellName: rapierAttack.name,
      castAtLevel: 0,
      caster: rogue,
      targets: [target],
      gameState: { characters: [rogue, target], combatLog: [] } as unknown as GameState
    });

    // We execute the attack. Since the rogue has Advantage modifier on attack rolls, it should trigger Sneak Attack.
    const newState = await command.execute({ characters: [rogue, target], combatLog: [] } as any);

    // Verify Sneak Attack triggers and deals 2d6 piercing damage
    const sneakAttackLog = newState.combatLog.find(l => l.type === 'damage' && l.message.includes("Sneak Attack triggers"));
    expect(sneakAttackLog).toBeDefined();
    expect(sneakAttackLog?.message).toContain("2d6 piercing damage");

    // Verify rogue's featUsageThisTurn contains 'sneak_attack'
    const updatedRogue = newState.characters.find(c => c.id === 'rogue_hero');
    expect(updatedRogue?.featUsageThisTurn).toContain('sneak_attack');
  });

  it('triggers Sneak Attack with an adjacent ally for a Rogue using a finesse weapon', async () => {
    // Attacker is Rogue, has no advantage but has an adjacent ally
    const rogue = createMockCombatCharacter({
      id: 'rogue_hero',
      name: 'Rogue Hero',
      level: 1, // 1d6 sneak attack
      class: { id: 'rogue', name: 'Rogue' } as any,
      position: { x: 0, y: 0 },
      stats: { baseInitiative: 0, speed: 30, cr: '0', strength: 10, dexterity: 16, constitution: 12, intelligence: 10, wisdom: 10, charisma: 10 },
      featUsageThisTurn: []
    });

    const target = createMockCombatCharacter({
      id: 'enemy_goblin',
      name: 'Goblin',
      position: { x: 1, y: 0 }, // Adjacent to rogue and ally
      armorClass: 10,
      currentHP: 30,
      maxHP: 30
    });

    // Ally of the rogue who is adjacent to the target
    const fighterAlly = createMockCombatCharacter({
      id: 'fighter_ally',
      name: 'Fighter Ally',
      team: 'player', // Same team as rogue
      position: { x: 2, y: 0 }, // Distance to goblin is Math.max(|2-1|, |0-0|) = 1 (adjacent!)
      currentHP: 15,
      maxHP: 15
    });

    const rapierAttack: Ability = {
      id: 'rapier_attack',
      name: 'Rapier Attack',
      description: 'A finesse weapon attack used to validate Sneak Attack.',
      type: 'attack',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: 1,
      isProficient: true,
      // This proof is about the adjacent-ally Sneak Attack gate, not random
      // accuracy. Keep the strike deterministic so the test does not fail just
      // because the weapon attack missed before the Sneak Attack branch.
      attackBonus: 99,
      weapon: {
        id: 'rapier',
        name: 'Rapier',
        type: 'weapon',
        properties: ['finesse'],
        category: 'Martial Weapon'
      } as any,
      effects: [{ type: 'damage', value: 4, damageType: 'piercing', dice: '1d8' }]
    };

    const command = new WeaponAttackCommand(rapierAttack, rogue, [target], {
      spellId: rapierAttack.id,
      spellName: rapierAttack.name,
      castAtLevel: 0,
      caster: rogue,
      targets: [target],
      gameState: { characters: [rogue, target, fighterAlly], combatLog: [] } as unknown as GameState
    });

    const newState = await command.execute({ characters: [rogue, target, fighterAlly], combatLog: [] } as any);

    // Verify Sneak Attack triggers due to adjacent ally
    const sneakAttackLog = newState.combatLog.find(l => l.type === 'damage' && l.message.includes("Sneak Attack triggers"));
    expect(sneakAttackLog).toBeDefined();
    expect(sneakAttackLog?.message).toContain("1d6 piercing damage");
  });

  it('does not trigger Sneak Attack twice in the same turn', async () => {
    // Attacker has already used sneak_attack this turn
    const rogue = createMockCombatCharacter({
      id: 'rogue_hero',
      name: 'Rogue Hero',
      level: 1,
      class: { id: 'rogue', name: 'Rogue' } as any,
      stats: { baseInitiative: 0, speed: 30, cr: '0', strength: 10, dexterity: 16, constitution: 12, intelligence: 10, wisdom: 10, charisma: 10 },
      featUsageThisTurn: ['sneak_attack'], // Already used!
      modifiers: { advantage: ['attack'], disadvantage: [], bonuses: [] } as any
    });

    const target = createMockCombatCharacter({
      id: 'enemy_goblin',
      name: 'Goblin',
      armorClass: 10,
      currentHP: 30,
      maxHP: 30
    });

    const rapierAttack: Ability = {
      id: 'rapier_attack',
      name: 'Rapier Attack',
      description: 'A finesse weapon attack used to validate Sneak Attack limits.',
      type: 'attack',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: 1,
      isProficient: true,
      weapon: {
        id: 'rapier',
        name: 'Rapier',
        type: 'weapon',
        properties: ['finesse'],
        category: 'Martial Weapon'
      } as any,
      effects: [{ type: 'damage', value: 4, damageType: 'piercing', dice: '1d8' }]
    };

    const command = new WeaponAttackCommand(rapierAttack, rogue, [target], {
      spellId: rapierAttack.id,
      spellName: rapierAttack.name,
      castAtLevel: 0,
      caster: rogue,
      targets: [target],
      gameState: { characters: [rogue, target], combatLog: [] } as unknown as GameState
    });

    const newState = await command.execute({ characters: [rogue, target], combatLog: [] } as any);

    // Verify Sneak Attack did NOT trigger
    const sneakAttackLog = newState.combatLog.find(l => l.type === 'damage' && l.message.includes("Sneak Attack triggers"));
    expect(sneakAttackLog).toBeUndefined();
  });

  it('does not trigger Sneak Attack for non-finesse, non-ranged weapons (e.g. Unarmed Strike)', async () => {
    const rogue = createMockCombatCharacter({
      id: 'rogue_hero',
      name: 'Rogue Hero',
      level: 1,
      class: { id: 'rogue', name: 'Rogue' } as any,
      stats: { baseInitiative: 0, speed: 30, cr: '0', strength: 10, dexterity: 16, constitution: 12, intelligence: 10, wisdom: 10, charisma: 10 },
      featUsageThisTurn: [],
      modifiers: { advantage: ['attack'], disadvantage: [], bonuses: [] } as any
    });

    const target = createMockCombatCharacter({
      id: 'enemy_goblin',
      name: 'Goblin',
      armorClass: 10,
      currentHP: 30,
      maxHP: 30
    });

    // Melee attack without finesse (e.g., unarmed strike or longsword without finesse)
    const unarmedStrike: Ability = {
      id: 'unarmed_strike',
      name: 'Unarmed Strike',
      description: 'A plain melee attack without finesse or ranged properties.',
      type: 'attack',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: 1,
      effects: [{ type: 'damage', value: 1, damageType: 'bludgeoning' }]
    };

    const command = new WeaponAttackCommand(unarmedStrike, rogue, [target], {
      spellId: unarmedStrike.id,
      spellName: unarmedStrike.name,
      castAtLevel: 0,
      caster: rogue,
      targets: [target],
      gameState: { characters: [rogue, target], combatLog: [] } as unknown as GameState
    });

    const newState = await command.execute({ characters: [rogue, target], combatLog: [] } as any);

    // Verify Sneak Attack did NOT trigger
    const sneakAttackLog = newState.combatLog.find(l => l.type === 'damage' && l.message.includes("Sneak Attack triggers"));
    expect(sneakAttackLog).toBeUndefined();
  });
});

