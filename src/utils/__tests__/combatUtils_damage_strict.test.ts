
import { describe, it, expect } from 'vitest';
import { calculateDamage } from '../combatUtils';
import type { CombatCharacter, DamageType } from '../../types';

describe('calculateDamage - Strict 5e Rules Verification', () => {
    // Create a mock character with Resistance and Vulnerability to the same damage type
    const createMockTarget = (resistances: DamageType[] = [], vulnerabilities: DamageType[] = []): CombatCharacter => ({
        id: 'target',
        name: 'Target',
        level: 1,
        class: { id: 'fighter', name: 'Fighter', hitDie: 10, primaryAbility: 'Strength', savingThrowProficiencies: [], armorProficiencies: [], weaponProficiencies: [], skills: [], features: [] },
        position: { x: 0, y: 0 },
        stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, baseInitiative: 0, speed: 30, cr: '1/4' },
        abilities: [],
        team: 'enemy',
        currentHP: 100,
        maxHP: 100,
        initiative: 0,
        statusEffects: [],
        actionEconomy: { action: { used: false, remaining: 1 }, bonusAction: { used: false, remaining: 1 }, reaction: { used: false, remaining: 1 }, movement: { used: 0, total: 30 }, freeActions: 1 },
        resistances,
        vulnerabilities,
        immunities: []
    });

    it('should result in 24 damage for 25 base damage when target has both Resistance and Vulnerability (PHB p.197 Rule)', () => {
        const target = createMockTarget(['Fire'], ['Fire']);
        const damage = 25;

        // PHB Rule: floor(25 / 2) * 2 = 12 * 2 = 24
        const result = calculateDamage(damage, null, target, 'Fire');

        expect(result).toBe(24);
    });
});
