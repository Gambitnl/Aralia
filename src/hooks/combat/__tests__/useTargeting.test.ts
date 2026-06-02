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
// TODO(lint-intent): Replace this cast once test map fixtures share the full BattleMapTile builder used by combat-map tests.
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
// TODO(lint-intent): Replace this cast once BattleMapData gets a compact public fixture builder.
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
// TODO(lint-intent): Replace this cast once combat character test builders cover the full runtime shape.
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
    // TODO(lint-intent): Replace this cast once migrated spell test fixtures expose the full union shape.
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
    // TODO(lint-intent): Replace this cast once spell-backed ability fixtures are centralized.
    } as unknown as Ability;
};

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
        // TODO(lint-intent): Replace this cast once non-spell ability test builders are available.
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
