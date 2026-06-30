/**
 * This test file checks the bridge from battle-map abilities into command objects.
 *
 * Combat abilities are lightweight button data, while commands are the objects
 * that actually roll attacks, apply healing, and write effect logs. These tests
 * protect the important split: attacks create attack commands, but Dash-style
 * movement does not masquerade as a weapon attack.
 */
import { describe, expect, it, vi } from 'vitest';
import { Ability, ActiveRider, CombatState } from '../../../types/combat';
import { GameState } from '../../../types';
import { createMockCombatCharacter, createMockCombatState } from '../../../utils/factories';
import { AbilityCommandFactory, WeaponAttackCommand } from '../AbilityCommandFactory';
import { SpellCommandFactory } from '../SpellCommandFactory';
import { combatEvents } from '../../../systems/events/CombatEvents';
import { DismissFamiliarToPocketCommand, RecallFamiliarFromPocketCommand } from '../../effects/FamiliarPocketCommands';
import { CommandedSummonCommand } from '../../effects/CommandedSummonCommand';
import { RegisterRiderCommand } from '../../effects/RegisterRiderCommand';
import type { Spell } from '../../../types/spells';
import shiningSmite from '../../../../public/data/spells/level-2/shining-smite.json';
import blindingSmite from '../../../../public/data/spells/level-3/blinding-smite.json';
import lightningArrow from '../../../../public/data/spells/level-3/lightning-arrow.json';

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

  it('ends Friends early when its caster makes a weapon attack roll', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

    try {
      const attacker = createMockCombatCharacter({
        id: 'friends-caster',
        name: 'Friends Caster',
        concentratingOn: {
          spellId: 'friends',
          spellName: 'Friends',
          spellLevel: 0,
          startedTurn: 1,
          effectIds: ['friends-charm-status'],
          canDropAsFreeAction: true
        }
      });
      const charmedTarget = createMockCombatCharacter({
        id: 'friends-target',
        name: 'Friends Target',
        conditions: [{ name: 'Charmed', duration: { type: 'minutes', value: 1 }, appliedTurn: 1, source: 'Friends', sourceCasterId: attacker.id }],
        statusEffects: [{
          id: 'friends-charm-status',
          name: 'Charmed',
          type: 'debuff',
          duration: 10,
          source: 'Friends',
          sourceCasterId: attacker.id,
          socialLifecycle: { kind: 'friends_charm', targetKnowsOnEnd: true, recastMemoryDurationRounds: 14400 }
        }]
      });
      const attackTarget = createMockCombatCharacter({
        id: 'attack-target',
        name: 'Attack Target',
        armorClass: 30,
        currentHP: 20,
        maxHP: 20
      });
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
      const commands = AbilityCommandFactory.createCommands(attack, attacker, [attackTarget], {} as GameState);
      const state = createMockCombatState({
        characters: [attacker, charmedTarget, attackTarget],
        turnState: {
          currentTurn: 2,
          turnOrder: [attacker.id, charmedTarget.id, attackTarget.id],
          currentCharacterId: attacker.id,
          phase: 'action',
          actionsThisTurn: []
        },
        combatLog: []
      });

      const result = await commands[0].execute(state);
      const updatedAttacker = result.characters.find(character => character.id === attacker.id);
      const updatedCharmedTarget = result.characters.find(character => character.id === charmedTarget.id);

      expect(updatedAttacker?.concentratingOn).toBeUndefined();
      expect(updatedCharmedTarget?.statusEffects.some(effect => effect.name === 'Charmed')).toBe(false);
      expect(updatedCharmedTarget?.socialAwareness?.some(entry =>
        entry.sourceSpellId === 'friends' &&
        entry.casterId === attacker.id
      )).toBe(true);
      expect(result.combatLog.some(entry => entry.data?.earlyEndReason === 'caster_makes_attack_roll')).toBe(true);
    } finally {
      randomSpy.mockRestore();
    }
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

  it('emits explicit unarmed attack metadata for Unarmed Strike actions', async () => {
    // Smites and other after-hit reactions need to distinguish a held weapon
    // from an Unarmed Strike. The command event is the shared source of that
    // attack fact, so a real Unarmed Strike button must publish it directly.
    combatEvents.clearForTest();
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.95);

    try {
      const attacker = createMockCombatCharacter({
        id: 'monk',
        name: 'Monk',
        stats: {
          baseInitiative: 0,
          speed: 30,
          cr: '0',
          strength: 16,
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
        armorClass: 10
      });
      const unarmedStrike: Ability = {
        id: 'unarmed_strike',
        name: 'Unarmed Strike',
        description: 'A real unarmed strike action used to prove attack metadata.',
        type: 'attack',
        cost: { type: 'action' },
        targeting: 'single_enemy',
        range: 1,
        isProficient: true,
        effects: [{ type: 'damage', value: 4, damageType: 'bludgeoning' }]
      };

      const command = new WeaponAttackCommand(unarmedStrike, attacker, [target], {
        spellId: unarmedStrike.id,
        spellName: unarmedStrike.name,
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
          attackType: 'unarmed',
          weaponType: 'unarmed'
        })
      ]));
    } finally {
      randomSpy.mockRestore();
      combatEvents.clearForTest();
    }
  });

  it('gives Shocking Grasp advantage against a target wearing metal armor', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    try {
      const caster = createMockCombatCharacter({ id: 'caster', name: 'Caster' });
      const metalTarget = createMockCombatCharacter({
        id: 'metal-target',
        name: 'Metal Target',
        armorClass: 10,
        hasMetalArmor: true
      });
      const shockingGrasp: Ability = {
        id: 'shocking-grasp-attack',
        sourceSpellId: 'shocking-grasp',
        name: 'Shocking Grasp',
        description: 'A melee spell attack used to prove metal armor advantage.',
        type: 'attack',
        attackType: 'spell',
        cost: { type: 'action' },
        targeting: 'single_enemy',
        range: 1,
        attackBonus: 99,
        effects: []
      };

      const command = new WeaponAttackCommand(shockingGrasp, caster, [metalTarget], {
        spellId: 'shocking-grasp',
        spellName: 'Shocking Grasp',
        castAtLevel: 0,
        caster,
        targets: [metalTarget],
        gameState: { characters: [caster, metalTarget], combatLog: [] } as unknown as GameState
      });
      const result = await command.execute({ characters: [caster, metalTarget], combatLog: [] } as any);

      // The attack log is the player-visible proof surface for advantage.
      // Metal armor should add advantage before the roll resolves.
      expect(result.combatLog[0].message).toContain('with Advantage');
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('does not give Shocking Grasp advantage against a non-metal-armored target', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

    try {
      const caster = createMockCombatCharacter({ id: 'caster', name: 'Caster' });
      const clothTarget = createMockCombatCharacter({
        id: 'cloth-target',
        name: 'Cloth Target',
        armorClass: 10,
        hasMetalArmor: false
      });
      const shockingGrasp: Ability = {
        id: 'shocking-grasp-attack',
        sourceSpellId: 'shocking-grasp',
        name: 'Shocking Grasp',
        description: 'A melee spell attack used to prove non-metal armor behavior.',
        type: 'attack',
        attackType: 'spell',
        cost: { type: 'action' },
        targeting: 'single_enemy',
        range: 1,
        attackBonus: 99,
        effects: []
      };

      const command = new WeaponAttackCommand(shockingGrasp, caster, [clothTarget], {
        spellId: 'shocking-grasp',
        spellName: 'Shocking Grasp',
        castAtLevel: 0,
        caster,
        targets: [clothTarget],
        gameState: { characters: [caster, clothTarget], combatLog: [] } as unknown as GameState
      });
      const result = await command.execute({ characters: [caster, clothTarget], combatLog: [] } as any);

      // Non-metal armor follows the ordinary melee spell attack path.
      expect(result.combatLog[0].message).not.toContain('with Advantage');
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('honors explicit unarmed attack metadata even when the button is not named Unarmed Strike', async () => {
    // Future generated buttons may know they are unarmed attacks without using
    // the literal Unarmed Strike name. The first-class Ability.attackType field
    // should publish that combat fact directly so smite prompts can opt into
    // unarmed hits without depending on text matching.
    combatEvents.clearForTest();
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.95);

    try {
      const attacker = createMockCombatCharacter({
        id: 'brawler',
        name: 'Brawler',
        stats: {
          baseInitiative: 0,
          speed: 30,
          cr: '0',
          strength: 16,
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
        armorClass: 10
      });
      const structuredUnarmedAttack: Ability = {
        id: 'martial_arts_blow',
        name: 'Martial Arts Blow',
        description: 'A structured unarmed attack whose name does not carry the legacy trigger text.',
        type: 'attack',
        attackType: 'unarmed',
        cost: { type: 'action' },
        targeting: 'single_enemy',
        range: 1,
        isProficient: true,
        effects: [{ type: 'damage', value: 4, damageType: 'bludgeoning' }]
      };

      const command = new WeaponAttackCommand(structuredUnarmedAttack, attacker, [target], {
        spellId: structuredUnarmedAttack.id,
        spellName: structuredUnarmedAttack.name,
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
          attackType: 'unarmed',
          weaponType: 'unarmed'
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

// ============================================================================
// After-Hit Smite Data Contracts
// ============================================================================
// These checks protect the spell-data side of the after-hit runtime bridge.
// Blinding Smite's extra upcast damage must live on the damage rider because
// that is the effect the shared weapon-hit path sends through DamageCommand.
// The Blinded condition row owns repeat saves, not extra damage scaling.
// ============================================================================

describe('after-hit smite data contracts', () => {
  it('keeps Shining Smite on the shared after-hit reaction rider lane', () => {
    const damageEffect = shiningSmite.effects.find(effect => effect.type === 'DAMAGE');
    const modifierEffect = shiningSmite.effects.find(effect => effect.type === 'ATTACK_ROLL_MODIFIER');

    // Shining Smite should wake up from the same after-hit reaction prompt as
    // the other modern smites. The target binding keeps the selected reaction
    // pointed at the creature that was already hit instead of asking for a new
    // target after the attack has resolved.
    expect(shiningSmite.castingTrigger).toEqual(expect.objectContaining({
      type: 'after_attack_hit',
      requiredCost: 'reaction',
      targetBinding: 'triggering_attack_target',
      attackFilter: expect.objectContaining({
        attackType: 'weapon',
        weaponType: 'any',
        includesUnarmedStrike: true
      })
    }));
    expect(shiningSmite.aiContext.playerInputRequired).toBe(false);

    // Both payload rows must stay hit-bound so the shared after-hit
    // materialization step can apply damage, advantage, light, and Invisible
    // suppression to the triggering hit target immediately.
    expect(damageEffect?.trigger).toEqual(expect.objectContaining({
      type: 'on_attack_hit',
      consumption: 'first_hit'
    }));
    expect(damageEffect?.damage).toEqual(expect.objectContaining({
      dice: '2d6',
      type: 'Radiant'
    }));
    expect(damageEffect?.scaling).toEqual(expect.objectContaining({
      type: 'slot_level',
      bonusPerLevel: '+1d6'
    }));
    expect(modifierEffect?.trigger).toEqual(expect.objectContaining({
      type: 'on_attack_hit',
      consumption: 'first_hit'
    }));
    expect(modifierEffect?.attackRollModifier).toEqual(expect.objectContaining({
      modifier: 'advantage',
      direction: 'incoming',
      consumption: 'while_active'
    }));
    expect(modifierEffect?.light).toEqual(expect.objectContaining({
      brightRadius: 5,
      attachedTo: 'target'
    }));
    expect(modifierEffect?.invisibilitySuppression).toEqual(expect.objectContaining({
      suppressesConditionBenefit: 'Invisible',
      scope: 'target'
    }));
  });

  it('keeps Blinding Smite slot scaling on the executable damage rider', () => {
    const damageEffect = blindingSmite.effects.find(effect => effect.type === 'DAMAGE');
    const statusEffect = blindingSmite.effects.find(effect => effect.type === 'STATUS_CONDITION');

    // Blinding Smite is the melee-only pair to Shining Smite's broader weapon
    // trigger. This live-data guard keeps its reaction prompt, target binding,
    // and unarmed-strike opt-in aligned with the shared after-hit bridge.
    expect(blindingSmite.castingTrigger).toEqual(expect.objectContaining({
      type: 'after_attack_hit',
      requiredCost: 'reaction',
      targetBinding: 'triggering_attack_target',
      attackFilter: expect.objectContaining({
        attackType: 'weapon',
        weaponType: 'melee',
        includesUnarmedStrike: true
      })
    }));
    expect(blindingSmite.aiContext.playerInputRequired).toBe(false);

    // The damage row is the only row that should own extra damage and slot
    // scaling because the shared hit-rider path sends it through DamageCommand.
    expect(damageEffect?.trigger).toEqual(expect.objectContaining({
      type: 'on_attack_hit',
      consumption: 'first_hit',
      attackFilter: expect.objectContaining({
        attackType: 'weapon',
        weaponType: 'melee'
      })
    }));
    expect(damageEffect?.damage).toEqual(expect.objectContaining({
      dice: '3d8',
      type: 'Radiant'
    }));
    expect(damageEffect?.scaling).toEqual(expect.objectContaining({
      type: 'slot_level',
      bonusPerLevel: '+1d8'
    }));

    // The status row owns Blinded and its turn-end Constitution repeat save,
    // but it must not carry the upcast damage increment.
    expect(statusEffect?.trigger).toEqual(expect.objectContaining({
      type: 'on_attack_hit',
      consumption: 'first_hit',
      attackFilter: expect.objectContaining({
        attackType: 'weapon',
        weaponType: 'melee'
      })
    }));
    expect(statusEffect?.statusCondition).toEqual(expect.objectContaining({
      name: 'Blinded',
      repeatSave: expect.objectContaining({
        timing: 'turn_end',
        saveType: 'Constitution',
        successEnds: true,
        useOriginalDC: true
      })
    }));
    expect(statusEffect?.scaling?.bonusPerLevel ?? '').toBe('');
  });

  it('keeps live smite spell casts on the shared after-hit reaction contract', async () => {
    const paladin = createMockCombatCharacter({
      id: 'paladin',
      name: 'Paladin',
      position: { x: 0, y: 0 }
    });
    const alreadyHitTarget = createMockCombatCharacter({
      id: 'already-hit-target',
      name: 'Already Hit Target',
      position: { x: 1, y: 0 }
    });

    // The hook-side after-hit tests prove when the prompt appears. This
    // live-data factory guard proves the real smite packets still enter that
    // shared reaction lane with a declared reaction cost and with executable
    // hit-bound payload rows ready for the command layer.
    for (const smiteSpell of [shiningSmite, blindingSmite]) {
      const commands = await SpellCommandFactory.createCommands(
        smiteSpell as unknown as Spell,
        paladin,
        [alreadyHitTarget],
        smiteSpell.level,
        {} as GameState
      );
      const riderCommands = commands.filter((command): command is RegisterRiderCommand =>
        command instanceof RegisterRiderCommand
      );
      const state: CombatState = {
        characters: [paladin],
        currentTurn: 1,
        round: 1,
        combatLog: []
      } as CombatState;
      const stateWithRiders = riderCommands.reduce(
        (nextState, command) => command.execute(nextState),
        state
      );
      const updatedPaladin = stateWithRiders.characters.find(character => character.id === paladin.id);

      expect(smiteSpell.castingTrigger).toEqual(expect.objectContaining({
        type: 'after_attack_hit',
        requiredCost: 'reaction',
        targetBinding: 'triggering_attack_target'
      }));
      expect(riderCommands.length).toBeGreaterThan(0);
      expect(riderCommands.every(command => command.description.includes(smiteSpell.name))).toBe(true);
      expect(updatedPaladin?.riders?.length).toBe(riderCommands.length);
      expect(updatedPaladin?.riders?.every(rider =>
        rider.duration.type === 'minutes' &&
        rider.duration.value === smiteSpell.duration.value
      )).toBe(true);
      if (smiteSpell.id === shiningSmite.id) {
        expect(updatedPaladin?.riders?.map(rider => rider.effect.type)).toEqual([
          'DAMAGE',
          'ATTACK_ROLL_MODIFIER'
        ]);
        expect(updatedPaladin?.riders?.[1].effect).toEqual(expect.objectContaining({
          attackRollModifier: expect.objectContaining({
            modifier: 'advantage',
            direction: 'incoming'
          }),
          light: expect.objectContaining({
            brightRadius: 5,
            attachedTo: 'target'
          })
        }));
      }
      if (smiteSpell.id === blindingSmite.id) {
        expect(updatedPaladin?.riders?.map(rider => rider.effect.type)).toEqual([
          'DAMAGE',
          'STATUS_CONDITION'
        ]);
        expect(updatedPaladin?.riders?.[1].effect).toEqual(expect.objectContaining({
          statusCondition: expect.objectContaining({
            name: 'Blinded',
            repeatSave: expect.objectContaining({
              timing: 'turn_end',
              saveType: 'Constitution',
              successEnds: true
            })
          })
        }));
      }
    }
  });
});

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

// ============================================================================
// Hit-Or-Miss Attack Riders
// ============================================================================
// Lightning Arrow is not a normal "extra damage on hit" rider. It spends the
// next matching ranged weapon attack whether that attack hits or misses, applies
// half primary damage on a miss, and still creates the secondary burst around
// the attack target. These tests protect that shared rider behavior so future
// next-attack spells can reuse it instead of becoming one-off weapon code.
// ============================================================================

describe('Frostbite next-weapon-attack rider', () => {
  const createFrostbiteRider = () => ({
    id: 'frostbite-rider',
    spellId: 'frostbite',
    casterId: 'caster',
    sourceName: 'Frostbite',
    type: 'debuff',
    duration: { type: 'rounds', value: 2 },
    startTime: 1,
    mechanics: {
      attackRollDirection: 'outgoing',
      attackRollModifier: 'disadvantage' as const,
      attackRollKind: 'weapon' as const,
      attackRollConsumption: 'next_attack' as const
    }
  });

  it('spends Frostbite when the target makes a matching weapon attack', async () => {
    const attacker = createMockCombatCharacter({
      id: 'attacker',
      name: 'Attacker',
      attackBonus: 99,
      activeEffects: [createFrostbiteRider()]
    });
    const target = createMockCombatCharacter({
      id: 'target',
      name: 'Target'
    });
    const weaponAttack: Ability = {
      id: 'weapon_attack',
      name: 'Weapon Attack',
      description: 'A weapon attack used to spend Frostbite.',
      type: 'attack',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: 1,
      isProficient: true,
      attackBonus: 99,
      effects: []
    };

    const [command] = AbilityCommandFactory.createCommands(weaponAttack, attacker, [target], {} as any);
    const newState = await command.execute({ characters: [attacker, target], combatLog: [] } as any);
    const updatedAttacker = newState.characters.find(character => character.id === attacker.id);

    expect(updatedAttacker?.activeEffects ?? []).toHaveLength(0);
  });

  it('keeps target-scoped outgoing disadvantage riders for attacks against other defenders', async () => {
    const attacker = createMockCombatCharacter({
      id: 'attacker',
      name: 'Attacker',
      attackBonus: 99,
      activeEffects: [{
        ...createFrostbiteRider(),
        id: 'chill-touch-undead-rider',
        spellId: 'chill-touch',
        sourceName: 'Chill Touch',
        mechanics: {
          attackRollDirection: 'outgoing' as const,
          attackRollModifier: 'disadvantage' as const,
          attackRollKind: 'any' as const,
          attackRollConsumption: 'while_active' as const,
          attackRollTargetId: 'original-caster'
        }
      }]
    });
    const otherDefender = createMockCombatCharacter({
      id: 'other-defender',
      name: 'Other Defender'
    });
    const weaponAttack: Ability = {
      id: 'weapon_attack',
      name: 'Weapon Attack',
      description: 'A weapon attack that should not consume the target-scoped Chill Touch rider.',
      type: 'attack',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: 1,
      isProficient: true,
      attackBonus: 99,
      effects: []
    };

    const [command] = AbilityCommandFactory.createCommands(weaponAttack, attacker, [otherDefender], {} as any);
    const newState = await command.execute({ characters: [attacker, otherDefender], combatLog: [] } as any);
    const updatedAttacker = newState.characters.find(character => character.id === attacker.id);

    // Chill Touch's Undead rider is scoped to the caster who applied it. An
    // attack against a different defender must not apply or consume that rider.
    expect(updatedAttacker?.activeEffects?.some(effect => effect.id === 'chill-touch-undead-rider')).toBe(true);
  });

  it('keeps Frostbite intact on a spell attack so the rider only spends on weapons', async () => {
    const attacker = createMockCombatCharacter({
      id: 'attacker',
      name: 'Attacker',
      attackBonus: 99,
      activeEffects: [createFrostbiteRider()]
    });
    const target = createMockCombatCharacter({
      id: 'target',
      name: 'Target'
    });
    const spellAttack: Ability = {
      id: 'spell_attack',
      name: 'Spell Attack',
      description: 'A spell attack that should not spend Frostbite.',
      type: 'attack',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: 12,
      isProficient: true,
      attackBonus: 99,
      effects: [],
      attackType: 'spell'
    };

    const [command] = AbilityCommandFactory.createCommands(spellAttack, attacker, [target], {} as any);
    const newState = await command.execute({ characters: [attacker, target], combatLog: [] } as any);
    const updatedAttacker = newState.characters.find(character => character.id === attacker.id);

    expect(updatedAttacker?.activeEffects?.some(effect => effect.spellId === 'frostbite')).toBe(true);
  });
});

describe('WeaponAttackCommand: Lightning Arrow-style hit-or-miss riders', () => {
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

