
import { describe, it, expect } from 'vitest';
import { ResistanceCalculator } from '../ResistanceCalculator';
import type { CombatCharacter, DamageType } from '@/types';

describe('ResistanceCalculator', () => {
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

    const createMockCaster = (featChoices?: any): CombatCharacter => ({
        id: 'caster',
        name: 'Caster',
        level: 5,
        class: { id: 'wizard', name: 'Wizard', hitDie: 6, primaryAbility: 'Intelligence', savingThrowProficiencies: [], armorProficiencies: [], weaponProficiencies: [], skills: [], features: [] },
        position: { x: 0, y: 0 },
        stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, baseInitiative: 0, speed: 30, cr: 'N/A' },
        abilities: [],
        team: 'player',
        currentHP: 30,
        maxHP: 30,
        initiative: 0,
        statusEffects: [],
        actionEconomy: { action: { used: false, remaining: 1 }, bonusAction: { used: false, remaining: 1 }, reaction: { used: false, remaining: 1 }, movement: { used: 0, total: 30 }, freeActions: 1 },
        featChoices: featChoices
    });

    it('should ignore resistance if source has Elemental Adept', () => {
        const target = createMockTarget(['Fire'], []); // Only resistance
        const source = createMockCaster({
            'elemental_adept': {
                selectedDamageType: 'Fire'
            }
        });

        // 25 damage. Resistance normally = 12. With Feat = 25.
        const result = ResistanceCalculator.applyResistances(25, 'Fire', target, source);
        expect(result).toBe(25);
    });

    it('should NOT ignore resistance if source has Elemental Adept for WRONG element', () => {
        const target = createMockTarget(['Fire'], []);
        const source = createMockCaster({
            'elemental_adept': {
                selectedDamageType: 'Cold' // Wrong element
            }
        });

        // 25 damage. Resistance applies = 12.
        const result = ResistanceCalculator.applyResistances(25, 'Fire', target, source);
        expect(result).toBe(12);
    });
});
