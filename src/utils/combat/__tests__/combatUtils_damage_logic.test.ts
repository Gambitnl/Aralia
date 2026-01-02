
import { describe, it, expect } from 'vitest';
import { calculateDamage } from '../combatUtils';
import { CombatCharacter } from '../../types/combat';
import { DamageType } from '../../types/spells';

describe('calculateDamage Logic Fixes', () => {
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

    it('should correctly cancel Resistance and Vulnerability (XGtE Rule)', () => {
        // According to Xanathar's Guide to Everything:
        // "If you have resistance and vulnerability to the same type of damage, they cancel each other out."
        // Previous faulty logic: floor(D / 2) * 2.
        // For odd numbers (e.g., 25), this resulted in 24 (loss of 1).
        // Correct logic: Return D.

        const target = createTestChar('Conflicted', ['fire'], ['fire']);

        // Test Odd Number (Crucial for verifying fix)
        expect(calculateDamage(25, caster, target, 'fire')).toBe(25);

        // Test Even Number (Sanity check)
        expect(calculateDamage(10, caster, target, 'fire')).toBe(10);
    });

    it('should still apply resistance if no vulnerability', () => {
        const target = createTestChar('Resistant', ['cold']);
        expect(calculateDamage(25, caster, target, 'cold')).toBe(12); // floor(25/2)
    });

    it('should still apply vulnerability if no resistance', () => {
        const target = createTestChar('Vulnerable', [], ['cold']);
        expect(calculateDamage(25, caster, target, 'cold')).toBe(50); // 25 * 2
    });
});
