import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTargetValidator } from '../useTargetValidator';
import type { Ability, BattleMapData, BattleMapTile } from '../../../types/combat';
import { createMockCombatCharacter } from '../../../utils/core/factories';

// These tests cover the targeting rulebook used by the battle-map UI. The
// important player-facing behavior is not just whether a target is valid, but
// whether the system can explain invalid clicks such as a melee attack aimed
// at an enemy several grid tiles away.

const createTile = (x: number, y: number): BattleMapTile => ({
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain: 'floor',
    elevation: 0,
    movementCost: 1,
    blocksMovement: false,
    blocksLoS: false,
    decoration: null,
    effects: []
});

const createMap = (width: number, height: number): BattleMapData => {
    const tiles = new Map<string, BattleMapTile>();

    // Build a complete rectangular test map so range, line-of-sight, and tile
    // existence checks behave like the real combat grid.
    for (let x = 0; x < width; x += 1) {
        for (let y = 0; y < height; y += 1) {
            const tile = createTile(x, y);
            tiles.set(tile.id, tile);
        }
    }

    return {
        dimensions: { width, height },
        tiles,
        theme: 'forest',
        seed: 1
    };
};

const meleeAttack: Ability = {
    id: 'unarmed_strike',
    name: 'Unarmed Strike',
    description: 'A basic close-range attack.',
    type: 'attack',
    cost: { type: 'action' },
    targeting: 'single_enemy',
    range: 1,
    effects: [{ type: 'damage', value: 1, damageType: 'physical' }]
};

describe('useTargetValidator', () => {
    it('keeps existing boolean validation while explaining out-of-range enemies', () => {
        const caster = createMockCombatCharacter({
            id: 'kaelen',
            name: 'Kaelen',
            team: 'player',
            position: { x: 0, y: 0 }
        });
        const farEnemy = createMockCombatCharacter({
            id: 'orc-1',
            name: 'Orc 1',
            team: 'enemy',
            position: { x: 3, y: 0 }
        });

        const { result } = renderHook(() => useTargetValidator({
            characters: [caster, farEnemy],
            mapData: createMap(5, 5)
        }));

        const validation = result.current.getTargetValidation(meleeAttack, caster, farEnemy.position);

        expect(result.current.isValidTarget(meleeAttack, caster, farEnemy.position)).toBe(false);
        expect(validation).toEqual({
            isValid: false,
            reason: 'Orc 1 is too far away for Unarmed Strike. Range: 1 tile (5 ft); distance: 3 tiles (15 ft).'
        });
    });

    it('still returns adjacent enemies as valid targets', () => {
        const caster = createMockCombatCharacter({
            id: 'kaelen',
            name: 'Kaelen',
            team: 'player',
            position: { x: 0, y: 0 }
        });
        const adjacentEnemy = createMockCombatCharacter({
            id: 'goblin-1',
            name: 'Goblin 1',
            team: 'enemy',
            position: { x: 1, y: 0 }
        });

        const { result } = renderHook(() => useTargetValidator({
            characters: [caster, adjacentEnemy],
            mapData: createMap(3, 3)
        }));

        expect(result.current.getTargetValidation(meleeAttack, caster, adjacentEnemy.position)).toEqual({
            isValid: true
        });
        expect(result.current.getValidTargets(meleeAttack, caster)).toEqual([adjacentEnemy.position]);
    });

    it('explains when a single-target enemy ability is aimed at empty ground', () => {
        const caster = createMockCombatCharacter({
            id: 'kaelen',
            name: 'Kaelen',
            team: 'player',
            position: { x: 0, y: 0 }
        });

        const { result } = renderHook(() => useTargetValidator({
            characters: [caster],
            mapData: createMap(3, 3)
        }));

        expect(result.current.getTargetValidation(meleeAttack, caster, { x: 1, y: 0 })).toEqual({
            isValid: false,
            reason: 'Unarmed Strike needs an enemy target.'
        });
    });
});
