import { describe, expect, it } from 'vitest';
import { createMockCombatCharacter, WeaponAttackCommand } from './AbilityCommandFactory.testHelpers';
import type { Ability, GameState } from './AbilityCommandFactory.testHelpers';

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
