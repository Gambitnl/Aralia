import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTargeting } from '../useTargeting';
import type { Ability, BattleMapData, BattleMapTile, CombatCharacter, Position } from '../../../types/combat';
import type { Spell } from '../../../types/spells';

// ============================================================================
// Test Fixtures
// ============================================================================
// These fixtures build the smallest battle map needed to prove teleport
// destination previews are driven by real combat-map rules. They intentionally
// avoid mocking line of sight or distance so the hook test protects the same
// range, wall, and occupancy checks used by the live map.
// ============================================================================

const makeTile = (
    x: number,
    y: number,
    overrides: Partial<BattleMapTile> = {}
): BattleMapTile => ({
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain: 'floor',
    decoration: null,
    blocksMovement: false,
    blocksLoS: false,
    movementCost: 1,
    elevation: 0,
    effects: [],
    ...overrides
} as BattleMapTile);

const makeMap = (): BattleMapData => {
    const tiles = new Map<string, BattleMapTile>();

    // The 5x5 map gives the test enough room to prove out-of-range rejection
    // without needing a large fixture. Specific tiles below are changed to
    // represent walls, occupied destinations, and line-of-sight blockers.
    for (let x = 0; x < 5; x += 1) {
        for (let y = 0; y < 5; y += 1) {
            tiles.set(`${x}-${y}`, makeTile(x, y));
        }
    }

    tiles.set('0-1', makeTile(0, 1, { blocksMovement: true }));
    tiles.set('1-0', makeTile(1, 0, { blocksLoS: true }));

    return {
        tiles,
        dimensions: { width: 5, height: 5 },
        theme: 'dungeon',
        seed: 7
    } as BattleMapData;
};

const makeCharacter = (id: string, position: Position): CombatCharacter => ({
    id,
    name: id,
    team: id === 'caster' ? 'player' : 'enemy',
    position,
    currentHP: 10,
    maxHP: 10,
    stats: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, speed: 30 },
    abilities: [],
    actionEconomy: { action: {}, bonusAction: {}, reaction: {}, movement: {} },
    statusEffects: [],
    level: 5
} as unknown as CombatCharacter);

const makeMistyStepAbility = (): Ability => {
    const spell: Spell = {
        id: 'misty-step',
        name: 'Misty Step',
        level: 2,
        school: 'Conjuration',
        classes: ['Wizard'],
        description: 'Teleport to an unoccupied space you can see.',
        castingTime: { value: 1, unit: 'bonus_action' },
        range: { type: 'self', distance: 0 },
        components: { verbal: true, somatic: false, material: false },
        duration: { type: 'instantaneous', concentration: false },
        targeting: { type: 'self', validTargets: ['self'], lineOfSight: true },
        effects: [{
            type: 'MOVEMENT',
            movementType: 'teleport',
            distance: 10,
            forcedMovement: { direction: 'caster_choice', maxDistance: '10 ft', usesReaction: false },
            duration: { type: 'rounds', value: 0 },
            trigger: { type: 'immediate' },
            condition: { type: 'always' }
        }]
    } as unknown as Spell;

    return {
        id: 'misty-step-ability',
        name: 'Misty Step',
        description: 'Teleport to a visible unoccupied tile.',
        type: 'spell',
        cost: { type: 'bonus' },
        targeting: 'self',
        range: 0,
        effects: [{ type: 'teleport', value: 2 }],
        spell
    } as unknown as Ability;
};

const makeAreaAbility = (shape: string, size = 3): Ability => ({
    id: `area-${shape}`,
    name: `${shape} Preview`,
    description: `Preview ${shape} area targeting.`,
    type: 'spell',
    cost: { type: 'action' },
    targeting: 'area',
    range: 12,
    effects: [{ type: 'damage', value: 1 }],
    areaOfEffect: {
        shape,
        size
    }
// Canonical spell data can arrive as cube/cylinder while the combat ability
// type still names the legacy square/circle variants. The preview mapper
// intentionally accepts both vocabularies, so this fixture keeps that bridge
// under test instead of narrowing the runtime surface.
} as unknown as Ability);

// ============================================================================
// Teleport Destination Preview
// ============================================================================
// Teleport previews must answer "where can this creature legally arrive?" not
// "what can this spell target?" These tests guard the candidate rules directly
// so future UI changes cannot accidentally turn blocked, occupied, invisible,
// or out-of-range tiles into blue destination highlights.
// ============================================================================

describe('useTargeting - teleport destination preview', () => {
    it('only previews visible, unoccupied, unblocked destinations within teleport range', () => {
        const caster = makeCharacter('caster', { x: 0, y: 0 });
        const occupyingEnemy = makeCharacter('occupied-target', { x: 1, y: 1 });
        const ability = makeMistyStepAbility();

        const { result } = renderHook(() => useTargeting({
            mapData: makeMap(),
            characters: [caster, occupyingEnemy]
        }));

        act(() => {
            result.current.previewTeleportDestinations(ability, caster, caster);
        });

        const previewedTiles = new Set(
            result.current.teleportDestinationPreview?.affectedTiles.map(tile => `${tile.x}-${tile.y}`) ?? []
        );

        // The current tile and another clear tile inside the 10-foot budget are
        // legal. The current tile is allowed because the movement command treats
        // the moved creature as excluded from occupancy checks.
        expect(previewedTiles.has('0-0')).toBe(true);
        expect(previewedTiles.has('0-2')).toBe(true);

        // These rejected tiles each prove a different destination rule: blocked
        // terrain, occupied space, line-of-sight obstruction, and range.
        expect(previewedTiles.has('0-1')).toBe(false);
        expect(previewedTiles.has('1-1')).toBe(false);
        expect(previewedTiles.has('2-0')).toBe(false);
        expect(previewedTiles.has('3-0')).toBe(false);
    });

    it('does not create destination candidates for non-teleport abilities', () => {
        const caster = makeCharacter('caster', { x: 0, y: 0 });
        const nonTeleportAbility: Ability = {
            id: 'second-wind',
            name: 'Second Wind',
            description: 'Recover hit points without moving.',
            type: 'heal',
            cost: { type: 'bonus' },
            targeting: 'self',
            range: 0,
            effects: [{ type: 'heal', value: 5 }]
        } as unknown as Ability;

        const { result } = renderHook(() => useTargeting({
            mapData: makeMap(),
            characters: [caster]
        }));

        act(() => {
            result.current.previewTeleportDestinations(nonTeleportAbility, caster, caster);
        });

        expect(result.current.teleportDestinationPreview).toBeNull();
    });
});

// ============================================================================
// Area Targeting Preview
// ============================================================================
// G62 tracks rendered proof for the combat-map preview matrix. This hook-level
// proof protects the source state that both 2D and 3D renderers consume: every
// supported area family must produce affected tiles before the player commits
// the spell, including canonical cube/cylinder aliases from spell JSON.
// ============================================================================

describe('useTargeting - area targeting preview', () => {
    it.each([
        ['circle / sphere', makeAreaAbility('circle', 2), { x: 2, y: 2 }],
        ['cone', makeAreaAbility('cone', 3), { x: 2, y: 0 }],
        ['line', makeAreaAbility('line', 4), { x: 4, y: 2 }],
        ['square / cube', makeAreaAbility('cube', 3), { x: 2, y: 2 }],
        ['cylinder', makeAreaAbility('cylinder', 2), { x: 2, y: 2 }]
    ])('previews affected tiles for %s shapes', (_label, ability, hoverPosition) => {
        const caster = makeCharacter('caster', { x: 2, y: 2 });

        const { result } = renderHook(() => useTargeting({
            mapData: makeMap(),
            characters: [caster]
        }));

        act(() => {
            result.current.startTargeting(ability);
        });
        act(() => {
            result.current.previewAoE(hoverPosition, caster);
        });

        const preview = result.current.aoePreview;

        expect(preview).toEqual(expect.objectContaining({
            center: hoverPosition,
            ability
        }));
        expect(preview?.affectedTiles.length).toBeGreaterThan(0);
        expect(
            preview?.affectedTiles.some(tile => Number.isFinite(tile.x) && Number.isFinite(tile.y))
        ).toBe(true);
    });
});
