
import { describe, it, expect } from 'vitest';
import { calculateDamage } from '../combatUtils';
import { CombatCharacter } from '../../types/combat';
import { DamageType } from '../../types/spells';

describe('calculateDamage', () => {
    // Helper to create a dummy character with specific resistance/vulnerability
    const createTestChar = (
        name: string,
        resistances: DamageType[] = [],
        vulnerabilities: DamageType[] = [],
        immunities: DamageType[] = []
    ): CombatCharacter => ({
        id: name,
        name,
        level: 1,
        class: { id: 'test', name: 'Test', hitDie: 'd8', primaryAbility: 'Strength', saves: [] },
        position: { x: 0, y: 0 },
        stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, baseInitiative: 0, speed: 30, cr: '1' },
        abilities: [],
        team: 'player',
        currentHP: 10,
        maxHP: 10,
        initiative: 0,
        statusEffects: [],
        actionEconomy: { action: { used: false, remaining: 1 }, bonusAction: { used: false, remaining: 1 }, reaction: { used: false, remaining: 1 }, movement: { used: 0, total: 30 }, freeActions: 1 },
        resistances: resistances,
        vulnerabilities: vulnerabilities,
        immunities: immunities,
    });

    const caster = createTestChar('Caster');

    it('should return base damage when no modifiers apply', () => {
        const target = createTestChar('Target');
        const damage = calculateDamage(10, caster, target, 'fire');
        expect(damage).toBe(10);
    });

    it('should halve damage for resistance', () => {
        const target = createTestChar('Resistant', ['fire']);
        // 10 / 2 = 5
        expect(calculateDamage(10, caster, target, 'fire')).toBe(5);
        // 11 / 2 = 5.5 -> 5 (floor)
        expect(calculateDamage(11, caster, target, 'fire')).toBe(5);
    });

    it('should double damage for vulnerability', () => {
        const target = createTestChar('Vulnerable', [], ['cold']);
        expect(calculateDamage(10, caster, target, 'cold')).toBe(20);
    });

    it('should return 0 damage for immunity', () => {
        const target = createTestChar('Immune', [], [], ['poison']);
        expect(calculateDamage(100, caster, target, 'poison')).toBe(0);
    });

    it('should handle precedence: Immunity > Resistance/Vulnerability', () => {
        // Even if vulnerable and immune (rare), immunity wins.
        const target = createTestChar('Weird', [], ['fire'], ['fire']);
        expect(calculateDamage(10, caster, target, 'fire')).toBe(0);
    });

    it('should allow forcing magical bypass', () => {
        // Not implemented yet, but function signature might change to support options
    });
});
