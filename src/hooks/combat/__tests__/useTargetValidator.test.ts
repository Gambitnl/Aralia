import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useTargetValidator } from '../useTargetValidator';
import { CombatCharacter, BattleMapData } from '../../../types/combat';

describe('useTargetValidator Optimization', () => {
    const mockCharacter: CombatCharacter = {
        id: 'char1',
        name: 'Hero',
        position: { x: 5, y: 5 },
        team: 'player',
        hp: 10,
        maxHp: 20,
        abilities: [],
        initiative: 10,
        isDead: false,
        statusEffects: []
    } as unknown as CombatCharacter;

    const mockMapData: BattleMapData = {
        id: 'map1',
        dimensions: { width: 10, height: 10 },
        tiles: new Map()
    };

    it('should maintain stable function reference when non-structural data (HP) changes', () => {
        const { result, rerender } = renderHook(
            (props) => useTargetValidator(props),
            {
                initialProps: {
                    characters: [mockCharacter],
                    mapData: mockMapData
                }
            }
        );

        const firstIsValidTarget = result.current.isValidTarget;

        // Update HP only
        const updatedCharacter = { ...mockCharacter, hp: 5 };

        rerender({
            characters: [updatedCharacter],
            mapData: mockMapData
        });

        const secondIsValidTarget = result.current.isValidTarget;

        expect(secondIsValidTarget).toBe(firstIsValidTarget);
    });

    it('should update function reference when structural data (Position) changes', () => {
        const { result, rerender } = renderHook(
            (props) => useTargetValidator(props),
            {
                initialProps: {
                    characters: [mockCharacter],
                    mapData: mockMapData
                }
            }
        );

        const firstIsValidTarget = result.current.isValidTarget;

        // Update Position
        const movedCharacter = { ...mockCharacter, position: { x: 6, y: 6 } };

        rerender({
            characters: [movedCharacter],
            mapData: mockMapData
        });

        const secondIsValidTarget = result.current.isValidTarget;

        expect(secondIsValidTarget).not.toBe(firstIsValidTarget);
    });

    it('should update function reference when structural data (Team) changes', () => {
        const { result, rerender } = renderHook(
            (props) => useTargetValidator(props),
            {
                initialProps: {
                    characters: [mockCharacter],
                    mapData: mockMapData
                }
            }
        );

        const firstIsValidTarget = result.current.isValidTarget;

        // Update Team
        const traitorCharacter = { ...mockCharacter, team: 'enemy' };

        rerender({
            characters: [traitorCharacter],
            mapData: mockMapData
        });

        const secondIsValidTarget = result.current.isValidTarget;

        expect(secondIsValidTarget).not.toBe(firstIsValidTarget);
    });
});
