import { vi } from 'vitest';
import { CombatCharacter, TurnState } from '../../../types/combat';

/**
 * Shared mocks + fixtures for the useActionExecutor hook test suite (split by concern).
 * Move-only extraction from the former single useActionExecutor.test.ts.
 */
// Mocks
export const mockEndTurn = vi.fn();
export const mockCanAfford = vi.fn();
export const mockConsumeAction = vi.fn();
export const mockRecordAction = vi.fn();
export const mockAddDamageNumber = vi.fn();
export const mockQueueAnimation = vi.fn();
export const mockHandleDamage = vi.fn();
export const mockProcessRepeatSaves = vi.fn();
export const mockProcessTileEffects = vi.fn();
export const mockOnCharacterUpdate = vi.fn();
export const mockOnLogEntry = vi.fn();
export const mockSetMovementDebuffs = vi.fn();
export const mockExecuteReactionSpell = vi.fn().mockResolvedValue(undefined);

// Test Data
export const mockCharacter: CombatCharacter = {
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
        freeActions: 1,
        legendary: { used: 0, total: 0 }
    }
};

export const mockTurnState: TurnState = {
    currentTurn: 1,
    turnOrder: ['char1'],
    currentCharacterId: 'char1',
    phase: 'action',
    actionsThisTurn: []
};

export const defaultProps = {
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

export function resetActionExecutorMocks(): void {
    vi.clearAllMocks();
    // Default behavior: Can afford action
    mockCanAfford.mockReturnValue(true);
    mockConsumeAction.mockReturnValue(mockCharacter);
    mockProcessTileEffects.mockReturnValue(mockCharacter);
    mockHandleDamage.mockReturnValue(mockCharacter);
    mockProcessRepeatSaves.mockReturnValue(mockCharacter);
}
