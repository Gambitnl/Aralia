
import { describe, it, expect } from 'vitest';
import { calculateDamage } from '../../combat/combatUtils';
import { CombatCharacter } from '../../../types/combat';
import { DamageType } from '../../../types/spells';
import { createSpellZone } from '@/systems/spells/effects/triggerHandler';

describe('calculateDamage Logic Fixes', () => {
    // Helper to create a dummy character with specific resistance/vulnerability
    const createTestChar = (
        name: string,
        resistances: DamageType[] = [],
        vulnerabilities: DamageType[] = [],
        immunities: DamageType[] = [],
        position = { x: 0, y: 0 },
        team: 'player' | 'enemy' = 'player'
    ): CombatCharacter => ({
        id: name,
        name,
        level: 1,
        class: { id: 'test', name: 'Test', description: '', hitDie: 8, primaryAbility: ['Strength'], savingThrowProficiencies: [], skillProficienciesAvailable: [], numberOfSkillProficiencies: 0, armorProficiencies: [], weaponProficiencies: [], features: [] } as any,
        position,
        stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, baseInitiative: 0, speed: 30, cr: '1' },
        abilities: [],
        team,
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

    it('should sequence Resistance before Vulnerability, not cancel them', () => {
        // WHAT CHANGED (2026-09-09): this case previously asserted the 2014
        // Xanathar's optional rule, "resistance and vulnerability to the same
        // type cancel each other out", so 25 stayed 25.
        // WHY IT CHANGED: the project follows the 2024 order - ordinary
        // modifiers, then Resistance, then Vulnerability - and asserted exactly
        // that in resistanceUtils.test.ts ("should apply resistance before
        // vulnerability when both match", floor(25 / 2) * 2 = 24). The two
        // committed tests contradicted each other, so calculateDamage could not
        // satisfy both; the 2024 sequencing wins because ResistanceCalculator,
        // the shared implementation both call, documents it in source.
        // WHAT IS PRESERVED: the even-damage sanity check still shows the two
        // operations returning 10 to 10, which is what made the cancellation
        // reading look correct in the first place.
        const target = createTestChar('Conflicted', ['fire'], ['fire']);

        // Odd damage is what exposes the sequencing: 25 -> floor(25/2)=12 -> 24.
        expect(calculateDamage(25, caster, target, 'fire')).toBe(24);

        // Even damage round-trips, so it cannot distinguish the two readings.
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

    it('should honor spell-zone resistance when context is provided', () => {
        const target = createTestChar('Protected', [], [], [], { x: 1, y: 0 });
        const zone = createSpellZone(
            'protective-aura',
            caster.id,
            caster.position,
            { shape: 'sphere', size: 20 },
            [
                {
                    type: 'DEFENSIVE',
                    trigger: { type: 'immediate' },
                    condition: { type: 'always' },
                    defenseType: 'resistance',
                    damageType: ['Fire'],
                    duration: { type: 'minutes', value: 10 },
                    description: 'Fire resistance aura'
                } as any
            ],
            1,
            10,
            undefined,
            undefined,
            ['point']
        );

        expect(calculateDamage(25, caster, target, 'fire', {
            spellZones: [zone],
            characters: [caster, target]
        })).toBe(12);
    });
});
