
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useActionExecutor } from '../useActionExecutor';
import { CombatCharacter, CombatAction, TurnState, Ability } from '../../../types/combat';

/**
 * This file tests the action executor hook that spends combat resources, moves
 * characters, and fires reaction attacks.
 *
 * The battle UI calls this hook when a player or enemy tries to act. These tests
 * keep movement, Dash, blocked tiles, and opportunity attacks from drifting
 * apart as the combat system grows.
 */
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
        // DEBT: The full class shape is larger than this hook test needs. This
        // cast keeps the fixture focused on combat action behavior; a shared
        // class fixture should replace it once combat tests standardize setup.
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
            freeActions: 1,
            legendary: { used: 0, total: 0 }
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
            type: 'move' as const,
            targetPosition: { x: 1, y: 1 },
            cost: { type: 'movement-only' as const, movementCost: 5 },
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
            type: 'move' as const,
            targetPosition: { x: 1, y: 1 },
            cost: { type: 'movement-only' as const, movementCost: 5 },
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
            type: 'move' as const,
            targetPosition: blocker.position,
            cost: { type: 'movement-only' as const, movementCost: 5 },
            timestamp: Date.now()
        };

        const success = result.current.executeAction(action);

        expect(success).toBe(false);
        expect(mockConsumeAction).not.toHaveBeenCalled();
        expect(mockOnLogEntry).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('Blocker is in the way')
        }));
    });

    it('should let Dash spend an action and add current-turn movement without making an attack', () => {
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
            type: 'attack' as const,
            cost: { type: 'action' as const },
            targeting: 'single_enemy' as const,
            range: 1,
            effects: [{ type: 'damage' as const, value: 4, damageType: 'physical' as const }]
        };
        const mover = { ...mockCharacter, position: { x: 0, y: 1 } };
        const attacker: CombatCharacter = {
            ...mockCharacter,
            id: 'orc',
            name: 'Orc',
            team: 'enemy' as const,
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
            type: 'move' as const,
            targetPosition: { x: 0, y: 2 },
            cost: { type: 'movement-only' as const, movementCost: 5 },
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

    it('should omit proficiency bonus from opportunity attacks with non-proficient weapons', () => {
        // This weapon intentionally lacks proficiency. The expected attack log
        // should show only the Strength modifier, not Strength plus proficiency.
        const unproficientWeapon = {
            id: 'unproficient_weapon',
            name: 'Heavy Club',
            description: 'A heavy melee attack.',
            type: 'attack' as const,
            cost: { type: 'action' as const },
            targeting: 'single_enemy' as const,
            range: 1,
            isProficient: false,
            effects: [{ type: 'damage' as const, value: 4, damageType: 'physical' as const }]
        };
        const mover = { ...mockCharacter, position: { x: 0, y: 1 } };
        const attacker = {
            ...mockCharacter,
            id: 'orc',
            name: 'Orc',
            level: 1,
            stats: {
                ...mockCharacter.stats,
                strength: 14 // +2 mod
            },
            team: 'enemy' as const,
            position: { x: 0, y: 0 },
            abilities: [unproficientWeapon],
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

        const action = {
            id: 'leave-reach',
            characterId: mover.id,
            type: 'move' as const,
            targetPosition: { x: 0, y: 2 },
            cost: { type: 'movement-only' as const, movementCost: 5 },
            timestamp: Date.now()
        };

        const success = result.current.executeAction(action);

        expect(success).toBe(true);
        expect(mockOnLogEntry).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringMatching(/\+\s*2\s*=\s*\d+ vs AC/)
        }));
    });
});
