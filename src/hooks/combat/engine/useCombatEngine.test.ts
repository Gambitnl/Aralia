
import { renderHook, act } from '@testing-library/react';
import { useCombatEngine } from './useCombatEngine';
// TODO(lint-intent): 'Position' is unused in this test; use it in the assertion path or remove it.
import { CombatCharacter, Position as _Position } from '../../../types/combat';
import { vi, describe, it, expect } from 'vitest';

describe('useCombatEngine', () => {
    const mockCharacter: CombatCharacter = {
        id: 'char1',
        name: 'Hero',
        team: 'player',
        level: 1 as any,
        class: { id: 'fighter', name: 'Fighter', description: '', hitDie: 10, primaryAbility: ['Strength'], savingThrowProficiencies: [], skillProficienciesAvailable: [], numberOfSkillProficiencies: 0, armorProficiencies: [], weaponProficiencies: [], features: [] } as any,
        currentHP: 20,
        maxHP: 20,
        position: { x: 0, y: 0 },
        statusEffects: [],
        damagedThisTurn: false,
        initiative: 0,
        abilities: [],
        actionEconomy: {
            action: { used: false, remaining: 1 },
            bonusAction: { used: false, remaining: 1 },
            reaction: { used: false, remaining: 1 },
            movement: { used: 0, total: 30 },
            freeActions: 1
        },
        stats: {
             strength: 10,
             dexterity: 10,
             constitution: 10,
             intelligence: 10,
             wisdom: 10,
             charisma: 10,
             baseInitiative: 0,
             speed: 30,
             cr: "0"
        }
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    } as any;

    const mockProps = {
        characters: [mockCharacter],
        mapData: null,
        onCharacterUpdate: vi.fn(),
        onLogEntry: vi.fn(),
        onMapUpdate: vi.fn(),
        addDamageNumber: vi.fn(),
    };

    it('should handle damage correctly', () => {
        const { result } = renderHook(() => useCombatEngine(mockProps));

        act(() => {
            result.current.handleDamage(mockCharacter, 5, 'test_source', 'physical');
        });

        expect(mockProps.addDamageNumber).toHaveBeenCalledWith(5, mockCharacter.position, 'damage');
        expect(mockProps.onLogEntry).toHaveBeenCalled();

        const updatedChar = result.current.handleDamage(mockCharacter, 5, 'test_source', 'physical');
        expect(updatedChar.currentHP).toBe(15);
        expect(updatedChar.damagedThisTurn).toBe(true);
    });

    it('should process repeat saves correctly', () => {
        const characterWithEffect: CombatCharacter = {
            ...mockCharacter,
            statusEffects: [{
                id: 'effect1',
                name: 'Poison',
                type: 'debuff',
                duration: 2,
                effect: { type: 'condition' },
                repeatSave: {
                    timing: 'turn_end',
                    saveType: 'Constitution', // Match SavingThrowAbility casing
                    dc: 10,
                    successEnds: true
                }
            }]
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
        } as any;

        const { result } = renderHook(() => useCombatEngine(mockProps));

        act(() => {
             result.current.processRepeatSaves(characterWithEffect, 'turn_end');
        });

        expect(mockProps.onLogEntry).toHaveBeenCalled();
    });

    it('should manage spell zones', () => {
        const { result } = renderHook(() => useCombatEngine(mockProps));
        // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
        const zone = { id: 'zone1' } as any;

        act(() => {
            result.current.addSpellZone(zone);
        });

        expect(result.current.spellZones).toContain(zone);

        act(() => {
            result.current.removeSpellZone('zone1');
        });

        expect(result.current.spellZones).not.toContain(zone);
    });
});
