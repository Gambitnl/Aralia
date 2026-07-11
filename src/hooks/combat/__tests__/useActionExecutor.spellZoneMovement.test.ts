import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useActionExecutor } from '../useActionExecutor';
import { CombatCharacter, CombatAction, TurnState, Ability, Position } from '../../../types/combat';
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

describe('useActionExecutor', () => {
    beforeEach(() => {
        resetActionExecutorMocks();
    });

    it('should pass explicit movement paths to spell-zone movement triggers', async () => {
        const spikeGrowthStyleEffect: SpellEffect = {
            type: 'DAMAGE',
            trigger: { type: 'on_move_in_area' },
            condition: { type: 'always' },
            damage: { dice: '1d1', type: 'Piercing' }
        } as unknown as SpellEffect;
        const zone: ActiveSpellZone = {
            id: 'zone-spike-growth',
            spellId: 'spike-growth-style-zone',
            casterId: 'caster',
            position: { x: 0, y: 0 },
            areaOfEffect: { shape: 'cube', size: 30 },
            effects: [spikeGrowthStyleEffect],
            triggeredThisTurn: new Set(),
            triggeredEver: new Set()
        };
        const movementPath: Position[] = [
            { x: -7, y: 0 },
            { x: -6, y: 0 },
            { x: -5, y: 0 },
            { x: -4, y: 0 },
            { x: -3, y: 0 },
            { x: -2, y: 0 },
            { x: -1, y: 0 },
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 2, y: 0 },
            { x: 3, y: 0 },
            { x: 4, y: 0 },
            { x: 5, y: 0 },
            { x: 6, y: 0 },
            { x: 7, y: 0 }
        ];
        const pathingMover = { ...mockCharacter, position: movementPath[0] };
        mockConsumeAction.mockReturnValue(pathingMover);
        mockProcessTileEffects.mockImplementation((char) => char);
        mockHandleDamage.mockImplementation((char) => char);

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [pathingMover],
            spellZones: [zone]
        }));

        // The move starts and ends outside the zone, so endpoint-only area
        // checks miss it. The explicit path records the walked tiles that
        // passed through the zone interior.
        const action = {
            id: 'move-through-zone',
            characterId: pathingMover.id,
            type: 'move' as const,
            targetPosition: movementPath[movementPath.length - 1],
            movementPath,
            cost: { type: 'movement-only' as const, movementCost: 70 },
            timestamp: Date.now()
        } as CombatAction;

        const success = await result.current.executeAction(action);

        expect(success).toBe(true);
        expect(mockHandleDamage).toHaveBeenCalledWith(
            expect.objectContaining({ id: pathingMover.id }),
            expect.any(Number),
            'zone effect',
            'Piercing'
        );
    });

    it('should refresh spell-zone status conditions instead of stacking duplicates', async () => {
        const zoneStatusEffect: SpellEffect = {
            type: 'STATUS_CONDITION',
            statusCondition: { name: 'Restrained' },
            condition: { type: 'always' },
            trigger: { type: 'on_enter_area' }
        } as unknown as SpellEffect;
        const zone: ActiveSpellZone = {
            id: 'zone-restrain',
            spellId: 'entangling-zone',
            casterId: 'caster',
            position: { x: 1, y: 1 },
            areaOfEffect: { shape: 'cube', size: 10 },
            effects: [zoneStatusEffect],
            triggeredThisTurn: new Set(),
            triggeredEver: new Set()
        };
        const restrainedMover: CombatCharacter = {
            ...mockCharacter,
            position: { x: 0, y: 0 },
            statusEffects: [{
                id: 'existing-restrained',
                name: 'Restrained',
                type: 'debuff',
                duration: 3,
                source: 'old-vines'
            }],
            conditions: [{
                name: 'Restrained',
                duration: { type: 'rounds', value: 3 },
                appliedTurn: 0,
                source: 'old-vines'
            }]
        };
        mockConsumeAction.mockReturnValue(restrainedMover);
        mockProcessTileEffects.mockImplementation((char) => char);

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [restrainedMover],
            spellZones: [zone]
        }));
        const action = {
            id: 'move-into-restraining-zone',
            characterId: restrainedMover.id,
            type: 'move' as const,
            targetPosition: { x: 1, y: 1 },
            cost: { type: 'movement-only' as const, movementCost: 5 },
            timestamp: Date.now()
        } as CombatAction;

        const success = await result.current.executeAction(action);

        expect(success).toBe(true);
        const movedUpdate = mockOnCharacterUpdate.mock.calls
            .map(call => call[0] as CombatCharacter)
            .find(character => character.id === restrainedMover.id);

        expect(movedUpdate?.statusEffects.filter(effect => effect.name === 'Restrained')).toHaveLength(1);
        expect(movedUpdate?.statusEffects[0]).toMatchObject({
            id: 'existing-restrained',
            duration: 1
        });
        expect(movedUpdate?.conditions?.filter(condition => condition.name === 'Restrained')).toHaveLength(1);
        expect(movedUpdate?.conditions?.[0]).toMatchObject({
            appliedTurn: mockTurnState.currentTurn,
            source: 'zone_effect'
        });
    });

    it('should let Dash spend an action and add current-turn movement without making an attack', async () => {
        const dash: Ability = {
            id: 'dash',
            name: 'Dash',
            description: 'Gain extra movement for the turn.',
            type: 'movement',
            cost: { type: 'action' as const },
            targeting: 'self',
            range: 0,
            effects: [{ type: 'movement', value: 30 }]
        };
        const characterWithDash = { ...mockCharacter, abilities: [dash] };
        const afterActionCost = {
            ...characterWithDash,
            actionEconomy: {
                ...characterWithDash.actionEconomy,
                action: { used: true, remaining: 1 }
            }
        };
        mockConsumeAction.mockReturnValue(afterActionCost);

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [characterWithDash]
        }));

        const action: CombatAction = {
            id: 'dash-action',
            characterId: characterWithDash.id,
            type: 'ability',
            abilityId: 'dash',
            cost: dash.cost,
            targetPosition: characterWithDash.position,
            targetCharacterIds: [characterWithDash.id],
            timestamp: Date.now()
        };

        const success = await result.current.executeAction(action);

        expect(success).toBe(true);
        expect(mockOnCharacterUpdate).toHaveBeenCalledWith(expect.objectContaining({
            actionEconomy: expect.objectContaining({
                action: expect.objectContaining({ used: true }),
                movement: expect.objectContaining({ total: 60, used: 0 })
            })
        }));
        expect(mockOnLogEntry).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('gains 30 ft of movement from Dash')
        }));
        expect(mockOnLogEntry).not.toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('attacks Hero')
        }));
    });
});
