
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useSummons } from '../../../../hooks/combat/useSummons';
import { CombatCharacter } from '../../../../types/combat';
import { Spell, SpellSchool } from '../../../../types/spells';

// Mock dependencies
const mockCaster: CombatCharacter = {
    id: 'caster-1',
    name: 'Wizard',
    team: 'player',
    position: { x: 0, y: 0 },
    currentHP: 20,
    maxHP: 20,
    armorClass: 12,
    stats: {
        strength: 10, dexterity: 12, constitution: 14,
        intelligence: 16, wisdom: 10, charisma: 8,
        baseInitiative: 0,
        speed: 30,
        cr: "1"
    },
    abilities: [],
    statusEffects: [],
    conditions: [],
    level: 5,
    class: 'Wizard' as any,
    initiative: 12,
    actionEconomy: {
        action: { used: false, remaining: 1 },
        bonusAction: { used: false, remaining: 1 },
        reaction: { used: false, remaining: 1 },
        movement: { used: 0, total: 30 },
        freeActions: 1
    }
};

const mockSpell: Spell = {
    id: 'find-familiar',
    name: 'Find Familiar',
    level: 1,
    school: SpellSchool.Conjuration,
    classes: ['Wizard'],
    castingTime: { value: 1, unit: 'hour' },
    range: { type: 'touch' },
    components: { verbal: true, somatic: true, material: true },
    duration: { type: 'instantaneous', concentration: false },
    effects: [],
    description: 'Summons a familiar.',
    targeting: { type: 'self', validTargets: [] }
};

const mockSummonEffect = {
    entityType: 'familiar',
    statBlock: {
        name: 'Owl Familiar',
        hp: 1,
        ac: 11,
        speed: 5,
        flySpeed: 60,
        abilities: {
            str: 3, dex: 13, con: 8, int: 2, wis: 12, cha: 7
        }
    },
    specialActions: [
        {
            name: 'Talons',
            description: 'Melee Weapon Attack',
            cost: 'action',
            damage: { dice: '1d4', type: 'slashing' }
        }
    ],
    duration: { type: 'special' }
};

// New mock effect without explicit statBlock but with formOptions
const mockVariableSummonEffect = {
    entityType: 'familiar',
    formOptions: ['Cat', 'Frog', 'Owl'],
    duration: { type: 'special' }
};

describe('useSummons Hook', () => {
    it('should initialize with empty summons', () => {
        const { result } = renderHook(() => useSummons());
        expect(result.current.summonedEntities).toEqual([]);
    });

    it('should add a summon correctly with explicit statBlock', () => {
        const { result } = renderHook(() => useSummons());

        let newSummon: CombatCharacter | undefined;

        act(() => {
            newSummon = result.current.addSummon(
                mockCaster,
                mockSpell,
                mockSummonEffect,
                { x: 1, y: 1 }
            );
        });

        expect(result.current.summonedEntities).toHaveLength(1);
        expect(newSummon).toBeDefined();

        if (newSummon) {
            expect(newSummon.name).toBe('Owl Familiar');
            expect(newSummon.team).toBe('player');
            expect(newSummon.position).toEqual({ x: 1, y: 1 });
            expect(newSummon.maxHP).toBe(1);
            expect(newSummon.stats.dexterity).toBe(13);
            expect(newSummon.isSummon).toBe(true);
            expect(newSummon.summonMetadata).toBeDefined();
            expect(newSummon.summonMetadata?.casterId).toBe(mockCaster.id);

            // Verify Special Actions parsed to Abilities
            expect(newSummon.abilities).toHaveLength(1);
            expect(newSummon.abilities[0].name).toBe('Talons');
            expect(newSummon.abilities[0].type).toBe('attack');
            // Average of 1d4 is 2.5 -> floor(2.5) = 2
            expect(newSummon.abilities[0].effects[0].value).toBe(2);
        }
    });

    it('should select correct form based on formIndex when statBlock is missing', () => {
        const { result } = renderHook(() => useSummons());

        let catSummon: CombatCharacter | undefined;
        let frogSummon: CombatCharacter | undefined;

        // Index 0: Cat
        act(() => {
            catSummon = result.current.addSummon(
                mockCaster,
                mockSpell,
                mockVariableSummonEffect,
                { x: 2, y: 2 },
                0
            );
        });

        // Index 1: Frog
        act(() => {
            frogSummon = result.current.addSummon(
                mockCaster,
                mockSpell,
                mockVariableSummonEffect,
                { x: 3, y: 3 },
                1
            );
        });

        expect(result.current.summonedEntities).toHaveLength(2);

        // Verify Cat
        expect(catSummon).toBeDefined();
        if (catSummon) {
            expect(catSummon.name).toBe('Cat');
            expect(catSummon.maxHP).toBe(2); // From template
        }

        // Verify Frog
        expect(frogSummon).toBeDefined();
        if (frogSummon) {
            expect(frogSummon.name).toBe('Frog');
            expect(frogSummon.maxHP).toBe(1); // From template
        }
    });

    it('should fallback to first option if formIndex is invalid', () => {
        const { result } = renderHook(() => useSummons());
        let defaultSummon: CombatCharacter | undefined;

        act(() => {
            defaultSummon = result.current.addSummon(
                mockCaster,
                mockSpell,
                mockVariableSummonEffect,
                { x: 4, y: 4 },
                99 // Invalid index
            );
        });

        expect(defaultSummon).toBeDefined();
        if (defaultSummon) {
            // Should default to first option: Cat
            expect(defaultSummon.name).toBe('Cat');
        }
    });

    it('should warn and not summon if no statBlock and no valid form options', () => {
        const { result } = renderHook(() => useSummons());
        const consoleSpy = vi.spyOn(console, 'warn');

        const invalidEffect = { entityType: 'unknown', duration: { type: 'special' } };

        act(() => {
             result.current.addSummon(
                mockCaster,
                mockSpell,
                invalidEffect,
                { x: 0, y: 0 }
            );
        });

        expect(result.current.summonedEntities).toHaveLength(0);
        expect(consoleSpy).toHaveBeenCalledWith("Attempted to summon entity without stat block definition.");
        consoleSpy.mockRestore();
    });

    it('should remove a summon by id', () => {
        const { result } = renderHook(() => useSummons());

        let summonId: string = '';

        act(() => {
            const summon = result.current.addSummon(
                mockCaster,
                mockSpell,
                mockSummonEffect,
                { x: 1, y: 1 }
            );
            if (summon) summonId = summon.id;
        });

        expect(result.current.summonedEntities).toHaveLength(1);

        act(() => {
            result.current.removeSummon(summonId);
        });

        expect(result.current.summonedEntities).toHaveLength(0);
    });

    it('should trigger onSummonAdded callback', () => {
        const onAddSpy = vi.fn();
        const { result } = renderHook(() => useSummons({ onSummonAdded: onAddSpy }));

        act(() => {
            result.current.addSummon(mockCaster, mockSpell, mockSummonEffect, { x: 0, y: 0 });
        });

        expect(onAddSpy).toHaveBeenCalledTimes(1);
    });
});
