import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useActionExecutor } from '../useActionExecutor';
import { BattleMapData, BattleMapTile, CombatCharacter, CombatAction, TurnState, Ability, Position } from '../../../types/combat';
import type { ActiveSpellZone } from '../../../systems/spells/effects/triggerHandler';
import type { SpellEffect } from '../../../types/spells';
import {
    mockEndTurn,
    mockCanAfford,
    mockConsumeAction,
    mockRecordAction,
    mockAddDamageNumber,
    mockQueueAnimation,
    mockHandleDamage,
    mockProcessRepeatSaves,
    mockProcessTileEffects,
    mockOnCharacterUpdate,
    mockOnLogEntry,
    mockSetMovementDebuffs,
    mockExecuteReactionSpell,
    mockCharacter,
    mockTurnState,
    defaultProps,
    resetActionExecutorMocks,
} from './useActionExecutor.fixtures';

/** Builds a plain tactical board for normal Move-path aerial integration. */
function createAerialMoveMap(): BattleMapData {
    const tiles = new Map<string, BattleMapTile>();
    for (let y = 0; y < 8; y += 1) {
        for (let x = 0; x < 8; x += 1) {
            tiles.set(`${x}-${y}`, {
                id: `${x}-${y}`,
                coordinates: { x, y },
                terrain: 'floor',
                elevation: 0,
                movementCost: 5,
                blocksMovement: false,
                blocksLoS: false,
                decoration: null,
                effects: [],
            });
        }
    }
    return { dimensions: { width: 8, height: 8 }, tiles, theme: 'dungeon', seed: 33 };
}

describe('useActionExecutor', () => {
    beforeEach(() => {
        resetActionExecutorMocks();
    });

    it('should handle end_turn action', async () => {
        const { result } = renderHook(() => useActionExecutor(defaultProps));

        const action: CombatAction = {
            id: 'action1',
            characterId: 'char1',
            type: 'end_turn',
            cost: { type: 'free' },
            timestamp: Date.now()
        };

        const success = await result.current.executeAction(action);

        expect(success).toBe(true);
        expect(mockEndTurn).toHaveBeenCalled();
    });

    it('should fail if character cannot afford action', async () => {
        mockCanAfford.mockReturnValue(false);
        const { result } = renderHook(() => useActionExecutor(defaultProps));

        const action: CombatAction = {
            id: 'action1',
            characterId: 'char1',
            type: 'move' as const,
            targetPosition: { x: 1, y: 1 },
            cost: { type: 'movement-only' as const, movementCost: 5 },
            timestamp: Date.now()
        };

        const success = await result.current.executeAction(action);

        expect(success).toBe(false);
        expect(mockOnLogEntry).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('cannot perform this action')
        }));
    });

    it('should consume resources and update character position on move', async () => {
        // Setup updated character returned by consumeAction
        const movedCharacter = { ...mockCharacter, position: { x: 1, y: 1 } };
        mockConsumeAction.mockReturnValue(movedCharacter);
        // processTileEffects returns the character passed to it
        mockProcessTileEffects.mockImplementation((char) => char);

        const { result } = renderHook(() => useActionExecutor(defaultProps));

        const action: CombatAction = {
            id: 'action1',
            characterId: 'char1',
            type: 'move' as const,
            targetPosition: { x: 1, y: 1 },
            cost: { type: 'movement-only' as const, movementCost: 5 },
            timestamp: Date.now()
        };

        const success = await result.current.executeAction(action);

        expect(success).toBe(true);
        expect(mockConsumeAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'char1' }), action.cost);

        // Check that onCharacterUpdate was called with the updated position
        // Note: The hook logic is:
        // 1. updatedCharacter = consumeAction(...) -> returns movedCharacter (pos {1,1} because we mocked it so? No wait.)
        // Actually consumeAction typically just updates economy.
        // The move logic in executeAction EXPLICITLY sets the position:
        // updatedCharacter = { ...updatedCharacter, position: action.targetPosition };

        // So even if consumeAction returns original position, the hook updates it.
        // Let's reset mockConsumeAction to return character with just economy changes (original position)
        mockConsumeAction.mockReturnValue({ ...mockCharacter, actionEconomy: { ...mockCharacter.actionEconomy, movement: { used: 5, total: 30 } } });

        expect(mockOnCharacterUpdate).toHaveBeenCalledWith(expect.objectContaining({
            position: { x: 1, y: 1 }
        }));

        expect(mockRecordAction).toHaveBeenCalledWith(action);
    });

    it('routes a normal flying Move through 3D validation and shared movement payment', async () => {
        const flyer: CombatCharacter = {
            ...mockCharacter,
            position: { x: 0, y: 0 },
            stats: {
                ...mockCharacter.stats,
                speed: 30,
                extraMovementSpeeds: { fly: 40 },
            },
            aerialMovement: {
                altitudeFeet: 10,
                isFlying: true,
                canHover: false,
                source: 'test Fly Speed',
            },
            actionEconomy: {
                ...mockCharacter.actionEconomy,
                movement: { used: 0, total: 40 },
            },
        };
        mockProcessTileEffects.mockImplementation(character => character);
        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [flyer],
            mapData: createAerialMoveMap(),
        }));
        const action: CombatAction = {
            id: 'normal-flying-move',
            characterId: flyer.id,
            type: 'move',
            targetPosition: { x: 3, y: 0 },
            targetAltitudeFeet: 15,
            movementMode: 'fly',
            movementPath: [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
                { x: 2, y: 0 },
                { x: 3, y: 0 },
            ],
            cost: { type: 'movement-only', movementCost: 15 },
            timestamp: Date.now(),
        };

        expect(await result.current.executeAction(action)).toBe(true);
        expect(mockConsumeAction).not.toHaveBeenCalled();
        expect(mockOnCharacterUpdate).toHaveBeenCalledWith(expect.objectContaining({
            position: { x: 3, y: 0 },
            aerialMovement: expect.objectContaining({ altitudeFeet: 15, isFlying: true }),
            actionEconomy: expect.objectContaining({ movement: { used: 20, total: 40 } }),
        }));
        expect(mockRecordAction).toHaveBeenCalledWith(expect.objectContaining({
            cost: expect.objectContaining({ movementCost: 20 }),
            movementMode: 'fly',
        }));
    });

    it('rejects a blocked aerial Move before any normal action mutation', async () => {
        const mapData = createAerialMoveMap();
        mapData.tiles.set('2-0', {
            ...mapData.tiles.get('2-0')!,
            airspace: { blockerTopFeet: 30 },
        });
        const flyer: CombatCharacter = {
            ...mockCharacter,
            position: { x: 0, y: 0 },
            stats: { ...mockCharacter.stats, extraMovementSpeeds: { fly: 40 } },
            aerialMovement: { altitudeFeet: 10, isFlying: true, canHover: false, source: 'test' },
            actionEconomy: {
                ...mockCharacter.actionEconomy,
                movement: { used: 0, total: 40 },
            },
        };
        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [flyer],
            mapData,
        }));
        const action: CombatAction = {
            id: 'blocked-flying-move',
            characterId: flyer.id,
            type: 'move',
            targetPosition: { x: 3, y: 0 },
            targetAltitudeFeet: 20,
            movementMode: 'fly',
            movementPath: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
            cost: { type: 'movement-only', movementCost: 15 },
            timestamp: Date.now(),
        };

        expect(await result.current.executeAction(action)).toBe(false);
        expect(mockConsumeAction).not.toHaveBeenCalled();
        expect(mockOnCharacterUpdate).not.toHaveBeenCalled();
        expect(mockRecordAction).not.toHaveBeenCalled();
        expect(mockOnLogEntry).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('Airspace blocker reaches 30 ft'),
        }));
    });

    it('should reject movement onto an occupied combatant tile before spending movement', async () => {
        const blocker: CombatCharacter = {
            ...mockCharacter,
            id: 'blocker',
            name: 'Blocker',
            position: { x: 1, y: 1 },
            team: 'enemy'
        };

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [mockCharacter, blocker]
        }));

        const action: CombatAction = {
            id: 'blocked-move',
            characterId: mockCharacter.id,
            type: 'move' as const,
            targetPosition: blocker.position,
            cost: { type: 'movement-only' as const, movementCost: 5 },
            timestamp: Date.now()
        };

        const success = await result.current.executeAction(action);

        expect(success).toBe(false);
        expect(mockConsumeAction).not.toHaveBeenCalled();
        expect(mockOnLogEntry).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('Blocker is in the way')
        }));
    });

    it('rejects an off-turn attack before affordability, payment, or effects', async () => {
        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            turnState: {
                ...mockTurnState,
                currentCharacterId: 'another-character'
            }
        }));
        const action: CombatAction = {
            id: 'off-turn-attack',
            characterId: mockCharacter.id,
            type: 'ability',
            abilityId: 'longbow-attack',
            targetCharacterIds: ['target'],
            cost: { type: 'action' },
            timestamp: Date.now()
        };

        const success = await result.current.executeAction(action);

        expect(success).toBe(false);
        expect(mockCanAfford).not.toHaveBeenCalled();
        expect(mockConsumeAction).not.toHaveBeenCalled();
        expect(mockOnCharacterUpdate).not.toHaveBeenCalled();
        expect(mockRecordAction).not.toHaveBeenCalled();
        expect(mockOnLogEntry).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('not their turn'),
            data: { rejectedReason: 'not_turn_owner' }
        }));
    });

    it('should reject demon movement that crosses a protected blood-circle tile', async () => {
        const demon: CombatCharacter = {
            ...mockCharacter,
            id: 'summoned-demon',
            name: 'Summoned Demon',
            summonMetadata: {
                casterId: 'caster',
                spellId: 'summon-greater-demon',
                bloodCircle: {
                    center: { x: 1, y: 0 },
                    protectedTiles: [{ x: 1, y: 0 }]
                }
            }
        };
        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [demon],
            turnState: { ...mockTurnState, currentCharacterId: demon.id }
        }));
        const action: CombatAction = {
            id: 'cross-circle',
            characterId: demon.id,
            type: 'move',
            targetPosition: { x: 2, y: 0 },
            movementPath: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
            cost: { type: 'movement-only', movementCost: 10 },
            timestamp: Date.now()
        };

        const success = await result.current.executeAction(action);

        expect(success).toBe(false);
        expect(mockConsumeAction).not.toHaveBeenCalled();
        expect(mockOnLogEntry).toHaveBeenCalledWith(expect.objectContaining({
            message: 'Summoned Demon cannot cross its protective blood circle.'
        }));
    });
});
