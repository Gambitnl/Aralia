
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useActionExecutor } from '../useActionExecutor';
import { CombatCharacter, CombatAction, TurnState, Ability } from '../../../types/combat';

describe('useActionExecutor', () => {
    // Mocks
    const mockEndTurn = vi.fn();
    const mockCanAfford = vi.fn();
    const mockConsumeAction = vi.fn();
    const mockRecordAction = vi.fn();
    const mockAddDamageNumber = vi.fn();
    const mockQueueAnimation = vi.fn();
    const mockHandleDamage = vi.fn();
    const mockProcessRepeatSaves = vi.fn();
    const mockProcessTileEffects = vi.fn();
    const mockOnCharacterUpdate = vi.fn();
    const mockOnLogEntry = vi.fn();
    const mockSetMovementDebuffs = vi.fn();

    // Test Data
    const mockCharacter: CombatCharacter = {
        id: 'char1',
        name: 'Hero',
        level: 1,
        class: {
            id: 'fighter',
            name: 'Fighter',
            description: '',
            hitDie: 10,
            primaryAbility: ['Strength'],
            savingThrowProficiencies: [],
            skillProficienciesAvailable: [],
            numberOfSkillProficiencies: 0,
            armorProficiencies: [],
            weaponProficiencies: [],
            features: []
        } as any,
        stats: {
            strength: 16,
            dexterity: 14,
            constitution: 14,
            intelligence: 10,
            wisdom: 10,
            charisma: 10,
            baseInitiative: 0,
            speed: 30,
            cr: '1'
        },
        currentHP: 10,
        maxHP: 10,
        position: { x: 0, y: 0 },
        initiative: 10,
        abilities: [],
        statusEffects: [],
        team: 'player',
        actionEconomy: {
            action: { used: false, remaining: 1 },
            bonusAction: { used: false, remaining: 1 },
            reaction: { used: false, remaining: 1 },
            movement: { used: 0, total: 30 },
            freeActions: 1
        }
    };

    const mockTurnState: TurnState = {
        currentTurn: 1,
        turnOrder: ['char1'],
        currentCharacterId: 'char1',
        phase: 'action',
        actionsThisTurn: []
    };

    const defaultProps = {
        characters: [mockCharacter],
        turnState: mockTurnState,
        mapData: null,
        onCharacterUpdate: mockOnCharacterUpdate,
        onLogEntry: mockOnLogEntry,
        endTurn: mockEndTurn,
        canAfford: mockCanAfford,
        consumeAction: mockConsumeAction,
        recordAction: mockRecordAction,
        addDamageNumber: mockAddDamageNumber,
        queueAnimation: mockQueueAnimation,
        handleDamage: mockHandleDamage,
        processRepeatSaves: mockProcessRepeatSaves,
        processTileEffects: mockProcessTileEffects,
        spellZones: [],
        movementDebuffs: [],
        reactiveTriggers: [],
        setMovementDebuffs: mockSetMovementDebuffs
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Default behavior: Can afford action
        mockCanAfford.mockReturnValue(true);
        mockConsumeAction.mockReturnValue(mockCharacter);
        mockProcessTileEffects.mockReturnValue(mockCharacter);
        mockHandleDamage.mockReturnValue(mockCharacter);
        mockProcessRepeatSaves.mockReturnValue(mockCharacter);
    });

    it('should handle end_turn action', () => {
        const { result } = renderHook(() => useActionExecutor(defaultProps));

        const action: CombatAction = {
            id: 'action1',
            characterId: 'char1',
            type: 'end_turn',
            cost: { type: 'free' },
            timestamp: Date.now()
        };

        const success = result.current.executeAction(action);

        expect(success).toBe(true);
        expect(mockEndTurn).toHaveBeenCalled();
    });

    it('should fail if character cannot afford action', () => {
        mockCanAfford.mockReturnValue(false);
        const { result } = renderHook(() => useActionExecutor(defaultProps));

        const action: CombatAction = {
            id: 'action1',
            characterId: 'char1',
            type: 'move',
            targetPosition: { x: 1, y: 1 },
            cost: { type: 'movement-only', movementCost: 5 },
            timestamp: Date.now()
        };

        const success = result.current.executeAction(action);

        expect(success).toBe(false);
        expect(mockOnLogEntry).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('cannot perform this action')
        }));
    });

    it('should consume resources and update character position on move', () => {
        // Setup updated character returned by consumeAction
        const movedCharacter = { ...mockCharacter, position: { x: 1, y: 1 } };
        mockConsumeAction.mockReturnValue(movedCharacter);
        // processTileEffects returns the character passed to it
        mockProcessTileEffects.mockImplementation((char) => char);

        const { result } = renderHook(() => useActionExecutor(defaultProps));

        const action: CombatAction = {
            id: 'action1',
            characterId: 'char1',
            type: 'move',
            targetPosition: { x: 1, y: 1 },
            cost: { type: 'movement-only', movementCost: 5 },
            timestamp: Date.now()
        };

        const success = result.current.executeAction(action);

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

    it('should reject movement onto an occupied combatant tile before spending movement', () => {
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
            type: 'move',
            targetPosition: blocker.position,
            cost: { type: 'movement-only', movementCost: 5 },
            timestamp: Date.now()
        };

        const success = result.current.executeAction(action);

        expect(success).toBe(false);
        expect(mockConsumeAction).not.toHaveBeenCalled();
        expect(mockOnLogEntry).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('Blocker is already there')
        }));
    });

    it('should let Dash spend an action and add current-turn movement without making an attack', () => {
        const dash: Ability = {
            id: 'dash',
            name: 'Dash',
            description: 'Gain extra movement for the turn.',
            type: 'movement',
            cost: { type: 'action' },
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

        const success = result.current.executeAction(action);

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

    it('should spend an enemy reaction and log an opportunity attack when movement leaves reach', () => {
        const scimitar: Ability = {
            id: 'scimitar',
            name: 'Scimitar',
            description: 'A close melee attack.',
            type: 'attack',
            cost: { type: 'action' },
            targeting: 'single_enemy',
            range: 1,
            effects: [{ type: 'damage', value: 4, damageType: 'physical' }]
        };
        const mover = { ...mockCharacter, position: { x: 0, y: 1 } };
        const attacker: CombatCharacter = {
            ...mockCharacter,
            id: 'orc',
            name: 'Orc',
            team: 'enemy',
            position: { x: 0, y: 0 },
            abilities: [scimitar],
            actionEconomy: {
                ...mockCharacter.actionEconomy,
                reaction: { used: false, remaining: 1 }
            }
        };
        mockConsumeAction.mockReturnValue(mover);
        mockProcessTileEffects.mockImplementation((char) => char);
        mockHandleDamage.mockImplementation((char) => char);

        const { result } = renderHook(() => useActionExecutor({
            ...defaultProps,
            characters: [mover, attacker]
        }));

        const action: CombatAction = {
            id: 'leave-reach',
            characterId: mover.id,
            type: 'move',
            targetPosition: { x: 0, y: 2 },
            cost: { type: 'movement-only', movementCost: 5 },
            timestamp: Date.now()
        };

        const success = result.current.executeAction(action);

        expect(success).toBe(true);
        expect(mockOnCharacterUpdate).toHaveBeenCalledWith(expect.objectContaining({
            id: 'orc',
            actionEconomy: expect.objectContaining({
                reaction: expect.objectContaining({ used: true })
            })
        }));
        expect(mockOnLogEntry).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('Opportunity Attack')
        }));
    });
});
