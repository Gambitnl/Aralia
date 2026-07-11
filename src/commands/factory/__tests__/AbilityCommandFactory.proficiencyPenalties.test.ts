import { describe, expect, it, vi } from 'vitest';
import { createMockCombatCharacter, WeaponAttackCommand, combatEvents } from './AbilityCommandFactory.testHelpers';
import type { Ability, GameState } from './AbilityCommandFactory.testHelpers';

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
