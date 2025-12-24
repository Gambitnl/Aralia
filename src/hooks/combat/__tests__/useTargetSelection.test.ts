import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useTargetSelection } from '../useTargetSelection';
import { createMockCombatCharacter } from '../../../utils/factories';
import { BattleMapData, BattleMapTile } from '../../../types/combat';

describe('useTargetSelection', () => {
    const mockMapData: BattleMapData = {
        id: 'map-1',
        dimensions: { width: 10, height: 10 },
        tiles: new Map<string, BattleMapTile>([
            ['0-0', { id: '0-0', coordinates: { x: 0, y: 0 }, terrainType: 'floor', isWall: false, movementCost: 1 }],
            ['0-1', { id: '0-1', coordinates: { x: 0, y: 1 }, terrainType: 'floor', isWall: false, movementCost: 1 }],
            ['1-0', { id: '1-0', coordinates: { x: 1, y: 0 }, terrainType: 'floor', isWall: false, movementCost: 1 }],
            ['1-1', { id: '1-1', coordinates: { x: 1, y: 1 }, terrainType: 'floor', isWall: false, movementCost: 1 }],
            ['2-0', { id: '2-0', coordinates: { x: 2, y: 0 }, terrainType: 'floor', isWall: false, movementCost: 1 }], // Out of range example
        ])
    };

    const mockCaster = createMockCombatCharacter({
        id: 'caster-1',
        position: { x: 0, y: 0 }
    });

    // Mock primitives
    const mockSelectedAbility: any = {
        id: 'ability-1',
        range: 1,
    };
    const mockAoePreview = {
        affectedTiles: [{ x: 1, y: 1 }]
    };
    const mockIsValidTarget = vi.fn((ability, caster, target) => {
        // Mock simple validation: allow everything except specific coordinates
        return !(target.x === 9 && target.y === 9);
    });

    it('should return empty sets when targeting is disabled', () => {
        const { result } = renderHook(() => useTargetSelection({
            selectedAbility: mockSelectedAbility,
            targetingMode: false,
            isValidTarget: mockIsValidTarget,
            aoePreview: mockAoePreview,
            currentCharacter: mockCaster,
            mapData: mockMapData,
            characters: [mockCaster]
        }));

        expect(result.current.validTargetSet.size).toBe(0);
    });

    it('should calculate aoeSet correctly', () => {
        const { result } = renderHook(() => useTargetSelection({
            selectedAbility: mockSelectedAbility,
            targetingMode: true,
            isValidTarget: mockIsValidTarget,
            aoePreview: mockAoePreview,
            currentCharacter: mockCaster,
            mapData: mockMapData,
            characters: [mockCaster]
        }));

        expect(result.current.aoeSet.has('1-1')).toBe(true);
        expect(result.current.aoeSet.size).toBe(1);
    });

    it('should calculate validTargetSet based on range and validation', () => {
        const { result } = renderHook(() => useTargetSelection({
            selectedAbility: mockSelectedAbility,
            targetingMode: true,
            isValidTarget: mockIsValidTarget,
            aoePreview: mockAoePreview,
            currentCharacter: mockCaster,
            mapData: mockMapData,
            characters: [mockCaster]
        }));

        // Range is 1, so (0,0), (0,1), (1,0), (1,1) should be checked.
        // (0,0) is caster position (usually valid target for some spells, but mock isValidTarget allows it)
        // (2,0) is dist 2, so out of range.

        expect(result.current.validTargetSet.has('0-0')).toBe(true);
        expect(result.current.validTargetSet.has('0-1')).toBe(true);
        expect(result.current.validTargetSet.has('1-0')).toBe(true);
        expect(result.current.validTargetSet.has('1-1')).toBe(true);
        expect(result.current.validTargetSet.has('2-0')).toBe(false); // Out of range
    });

    it('should update validTargetSet when caster moves', () => {
        const movedCaster = { ...mockCaster, position: { x: 1, y: 0 } };

        const { result } = renderHook(() => useTargetSelection({
            selectedAbility: mockSelectedAbility,
            targetingMode: true,
            isValidTarget: mockIsValidTarget,
            aoePreview: mockAoePreview,
            currentCharacter: movedCaster,
            mapData: mockMapData,
            characters: [movedCaster]
        }));

        // Now (2,0) is dist 1 from (1,0), so it should be in range
        expect(result.current.validTargetSet.has('2-0')).toBe(true);
    });
});
