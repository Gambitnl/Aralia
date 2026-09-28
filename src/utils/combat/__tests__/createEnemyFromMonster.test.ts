import { describe, it, expect } from 'vitest';
import {
  buildFallbackMonsterProfile,
  createEnemyFromMonster,
  parseChallengeRating
} from '../createEnemyFromMonster';
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

  it('gracefully falls back to a CR-scaled generic enemy when monster data is missing', () => {
    const missingMonsterTemplate: Monster = {
      name: 'Non Existent Dragon',
      cr: '10',
      quantity: 1,
      description: 'Missing registry fallback monster'
    };

    const enemy = createEnemyFromMonster(missingMonsterTemplate, 2);

    expect(enemy.name).toBe('Non Existent Dragon 3');
    // CR 10 anchor: Monster Manual median 153 HP / AC 18, not the old flat 10/10.
    expect(enemy.maxHP).toBe(153);
    expect(enemy.currentHP).toBe(153);
    expect(enemy.armorClass).toBe(18);
    expect(enemy.baseAC).toBe(18);
    expect(enemy.level).toBe(10);
  });
});

describe('createEnemyFromMonster fallback scaling', () => {
  const missing = (name: string, cr: string): Monster => ({
    name,
    cr,
    quantity: 1,
    description: 'Missing registry fallback monster'
  });

  it('reads fractional challenge ratings instead of truncating them', () => {
    expect(parseChallengeRating('1/4')).toBe(0.25);
    expect(parseChallengeRating('1/8')).toBe(0.125);
    expect(parseChallengeRating('5')).toBe(5);
    expect(parseChallengeRating('')).toBeUndefined();
    expect(parseChallengeRating('unrated')).toBeUndefined();
  });

  it('falls back to CR 1/4 when the challenge rating is unreadable', () => {
    const profile = buildFallbackMonsterProfile('Thing', 'unrated');
    expect(profile.cr).toBe(0.25);
    expect(profile.stats.cr).toBe('unrated');
  });

  it('scales hit points, armor class and damage monotonically with CR', () => {
    const ladder = ['0', '1/8', '1/4', '1/2', '1', '2', '5', '10', '17', '24'];
    const profiles = ladder.map(cr => buildFallbackMonsterProfile('Thing', cr));
    for (let i = 1; i < profiles.length; i++) {
      expect(profiles[i].hp).toBeGreaterThan(profiles[i - 1].hp);
      expect(profiles[i].armorClass).toBeGreaterThanOrEqual(profiles[i - 1].armorClass);
      expect(profiles[i].damage).toBeGreaterThan(profiles[i - 1].damage);
    }
  });

  it('interpolates between anchor rows for a CR the table does not list', () => {
    const cr12 = buildFallbackMonsterProfile('Thing', '12');
    const cr11 = buildFallbackMonsterProfile('Thing', '11');
    const cr13 = buildFallbackMonsterProfile('Thing', '13');
    expect(cr12.damage).toBeGreaterThan(cr11.damage);
    expect(cr12.damage).toBeLessThan(cr13.damage);
  });

  it('clamps above the top of the table rather than extrapolating', () => {
    expect(buildFallbackMonsterProfile('Thing', '40').hp)
      .toBe(buildFallbackMonsterProfile('Thing', '30').hp);
  });

  it('reads an archetype out of the monster name', () => {
    expect(buildFallbackMonsterProfile('Hill Giant', '5').archetypeId).toBe('brute');
    expect(buildFallbackMonsterProfile('Goblin Sneak', '1/4').archetypeId).toBe('skirmisher');
    expect(buildFallbackMonsterProfile('Cult Mage', '5').archetypeId).toBe('caster');
    expect(buildFallbackMonsterProfile('Iron Sentinel', '5').archetypeId).toBe('armored');
    expect(buildFallbackMonsterProfile('Unnamed Blob', '5').archetypeId).toBe('generic');
  });

  it('gives the archetype the expected combat shape', () => {
    const brute = buildFallbackMonsterProfile('Hill Giant', '5');
    const caster = buildFallbackMonsterProfile('Cult Mage', '5');
    const armored = buildFallbackMonsterProfile('Iron Sentinel', '5');
    const skirmisher = buildFallbackMonsterProfile('Goblin Sneak', '5');

    expect(brute.hp).toBeGreaterThan(caster.hp);
    expect(armored.armorClass).toBeGreaterThan(brute.armorClass);
    expect(skirmisher.stats.dexterity).toBeGreaterThan(brute.stats.dexterity);
    expect(caster.stats.intelligence).toBeGreaterThan(brute.stats.intelligence);
    expect(caster.damageType).toBe('force');
    expect(brute.damageType).toBe('bludgeoning');
  });

  it('keeps every archetype within a quarter of the unhinted hit points', () => {
    const generic = buildFallbackMonsterProfile('Unnamed Blob', '5').hp;
    for (const name of ['Hill Giant', 'Cult Mage', 'Iron Sentinel', 'Goblin Sneak', 'Veteran Captain']) {
      const hp = buildFallbackMonsterProfile(name, '5').hp;
      expect(hp).toBeGreaterThanOrEqual(Math.round(generic * 0.75));
      expect(hp).toBeLessThanOrEqual(Math.round(generic * 1.25));
    }
  });

  it('is deterministic for the same name and CR', () => {
    const a = createEnemyFromMonster(missing('Unlisted Wyrm', '7'), 0);
    const b = createEnemyFromMonster(missing('Unlisted Wyrm', '7'), 0);
    expect(a).toEqual(b);
  });

  it('wires the scaled profile onto the generated combat character', () => {
    const enemy = createEnemyFromMonster(missing('Hill Giant Raider', '5'), 0);
    const profile = buildFallbackMonsterProfile('Hill Giant Raider', '5');

    expect(enemy.maxHP).toBe(profile.hp);
    expect(enemy.armorClass).toBe(profile.armorClass);
    expect(enemy.stats).toEqual(profile.stats);
    expect(enemy.actionEconomy.movement.total).toBe(profile.stats.speed);

    const attack = enemy.abilities.find(a => a.id === 'basic_attack');
    expect(attack?.name).toBe(profile.attackName);
    expect(attack?.effects[0]).toEqual({
      type: 'damage',
      value: profile.damage,
      damageType: profile.damageType
    });
  });

  it('sets baseInitiative from the generated Dexterity', () => {
    const skirmisher = buildFallbackMonsterProfile('Kobold Scout', '1/4');
    expect(skirmisher.stats.baseInitiative)
      .toBe(Math.floor((skirmisher.stats.dexterity - 10) / 2));
  });
});
