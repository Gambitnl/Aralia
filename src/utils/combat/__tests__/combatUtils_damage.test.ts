
import { describe, it, expect } from 'vitest';
import { calculateDamage, calculateDamageWithDefense } from '../../combat/combatUtils';
import { CombatCharacter } from '../../../types/combat';
import { DamageType } from '../../../types/spells';

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
        class: { id: 'test', name: 'Test', description: '', hitDie: 8, primaryAbility: ['Strength'], savingThrowProficiencies: [], skillProficienciesAvailable: [], numberOfSkillProficiencies: 0, armorProficiencies: [], weaponProficiencies: [], features: [] } as any,
        position: { x: 0, y: 0 },
        stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, baseInitiative: 0, speed: 30, cr: '1' },
        abilities: [],
        team: 'player',
        currentHP: 10,
        maxHP: 10,
        initiative: 0,
        statusEffects: [],
        actionEconomy: { action: { used: false, remaining: 1 }, bonusAction: { used: false, remaining: 1 }, reaction: { used: false, remaining: 1 }, legendary: { used: 0, total: 0 }, movement: { used: 0, total: 30 }, freeActions: 1 },
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

    // ------------------------------------------------------------------
    // Magical bypass options (agora-5143)
    // ------------------------------------------------------------------
    // nonMagicalResistances / nonMagicalImmunities only engage when the caller
    // states the damage is NOT magical. Before the options parameter existed
    // these two entry points hard-coded `undefined`, so a nonmagical-only
    // defense could never fire through them.
    // ------------------------------------------------------------------
    describe('magical bypass options', () => {
        const createNonMagicalDefender = (
            name: string,
            nonMagicalResistances: string[] = [],
            nonMagicalImmunities: string[] = []
        ): CombatCharacter => ({
            ...createTestChar(name),
            nonMagicalResistances,
            nonMagicalImmunities,
        });

        it('applies nonmagical resistance when the damage is declared nonmagical', () => {
            const target = createNonMagicalDefender('Lycanthrope', ['bludgeoning']);
            expect(calculateDamage(10, caster, target, 'bludgeoning', undefined, { isMagical: false })).toBe(5);
        });

        it('forces a magical bypass past nonmagical resistance', () => {
            const target = createNonMagicalDefender('Lycanthrope', ['bludgeoning']);
            expect(calculateDamage(10, caster, target, 'bludgeoning', undefined, { isMagical: true })).toBe(10);
        });

        it('applies nonmagical immunity only when the damage is declared nonmagical', () => {
            const target = createNonMagicalDefender('Specter', [], ['slashing']);
            expect(calculateDamage(12, caster, target, 'slashing', undefined, { isMagical: false })).toBe(0);
            expect(calculateDamage(12, caster, target, 'slashing', undefined, { isMagical: true })).toBe(12);
        });

        it('leaves an undeclared damage instance exactly as it behaved before', () => {
            const target = createNonMagicalDefender('Lycanthrope', ['bludgeoning']);
            // No options object and an empty options object both mean "not stated".
            expect(calculateDamage(10, caster, target, 'bludgeoning')).toBe(10);
            expect(calculateDamage(10, caster, target, 'bludgeoning', undefined, {})).toBe(10);
        });

        it('does not let the magical flag touch ordinary resistances', () => {
            const target = createTestChar('Fire Resistant', ['fire']);
            expect(calculateDamage(10, caster, target, 'fire', undefined, { isMagical: true })).toBe(5);
        });

        it('reports the nonmagical resistance in the defense breakdown', () => {
            const target = createNonMagicalDefender('Lycanthrope', ['bludgeoning']);
            const breakdown = calculateDamageWithDefense(10, caster, target, 'bludgeoning', undefined, { isMagical: false });

            expect(breakdown.finalDamage).toBe(5);
            expect(breakdown.isResistant).toBe(true);
            expect(breakdown.tags).toContain('[Resisted: Bludgeoning (-50%)]');
        });

        it('reports no resistance in the breakdown once the damage is magical', () => {
            const target = createNonMagicalDefender('Lycanthrope', ['bludgeoning']);
            const breakdown = calculateDamageWithDefense(10, caster, target, 'bludgeoning', undefined, { isMagical: true });

            expect(breakdown.finalDamage).toBe(10);
            expect(breakdown.isResistant).toBe(false);
            expect(breakdown.tags).toEqual([]);
        });
    });
});
