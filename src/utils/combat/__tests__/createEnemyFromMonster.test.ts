import { describe, it, expect } from 'vitest';
import { createEnemyFromMonster } from '../createEnemyFromMonster';
import { registerMonster } from '../../../data/adapters/runtimeMonsterRegistry';
import { Monster } from '../../../types';
import { MonsterData } from '../../../types/ui';

describe('createEnemyFromMonster', () => {
  it('maps armorClass and baseAC correctly from registered monster data', () => {
    // 1. Setup mock monster data with specific AC
    const mockMonsterData: MonsterData = {
      id: 'mock_goblin',
      name: 'Mock Goblin',
      maxHP: 15,
      baseStats: {
        strength: 8,
        dexterity: 14,
        constitution: 10,
        intelligence: 10,
        wisdom: 8,
        charisma: 8,
        baseInitiative: 2,
        speed: 30,
        cr: '1/4',
        senses: { darkvision: 60, blindsight: 0, tremorsense: 0, truesight: 0 }
      },
      abilities: [],
      tags: ['goblinoid'],
      armorClass: 15, // Specific AC
      armorSource: 'Leather Armor'
    };

    // Register our mock monster in the runtime registry
    registerMonster(mockMonsterData);

    const monsterTemplate: Monster = {
      name: 'Mock Goblin',
      cr: '1/4',
      quantity: 1,
      description: 'Runtime registry test monster'
    };

    // 2. Convert to CombatCharacter
    const enemy = createEnemyFromMonster(monsterTemplate, 0);

    // 3. Verify mappings
    expect(enemy.id).toBe('enemy_mock_goblin_0');
    expect(enemy.name).toBe('Mock Goblin 1');
    expect(enemy.maxHP).toBe(15);
    expect(enemy.currentHP).toBe(15);
    expect(enemy.armorClass).toBe(15); // AC is mapped!
    expect(enemy.baseAC).toBe(15); // baseAC is mapped!
    expect(enemy.stats.speed).toBe(30);
  });

  it('gracefully falls back to generic enemy with default AC 10 when monster data is missing', () => {
    const missingMonsterTemplate: Monster = {
      name: 'Non Existent Dragon',
      cr: '10',
      quantity: 1,
      description: 'Missing registry fallback monster'
    };

    const enemy = createEnemyFromMonster(missingMonsterTemplate, 2);

    expect(enemy.name).toBe('Non Existent Dragon 3');
    expect(enemy.maxHP).toBe(10);
    expect(enemy.currentHP).toBe(10);
    expect(enemy.armorClass).toBe(10); // Default AC
    expect(enemy.baseAC).toBe(10); // Default baseAC
  });
});
