import { CombatCharacter, TurnState } from '../../../types/combat';
/**
 * Shared mocks + fixtures for the useActionExecutor hook test suite (split by concern).
 * Move-only extraction from the former single useActionExecutor.test.ts.
 */
export declare const mockEndTurn: import("vitest").Mock<import("@vitest/spy").Procedure>;
export declare const mockCanAfford: import("vitest").Mock<import("@vitest/spy").Procedure>;
export declare const mockConsumeAction: import("vitest").Mock<import("@vitest/spy").Procedure>;
export declare const mockRecordAction: import("vitest").Mock<import("@vitest/spy").Procedure>;
export declare const mockAddDamageNumber: import("vitest").Mock<import("@vitest/spy").Procedure>;
export declare const mockQueueAnimation: import("vitest").Mock<import("@vitest/spy").Procedure>;
export declare const mockHandleDamage: import("vitest").Mock<import("@vitest/spy").Procedure>;
export declare const mockProcessRepeatSaves: import("vitest").Mock<import("@vitest/spy").Procedure>;
export declare const mockProcessTileEffects: import("vitest").Mock<import("@vitest/spy").Procedure>;
export declare const mockOnCharacterUpdate: import("vitest").Mock<import("@vitest/spy").Procedure>;
export declare const mockOnLogEntry: import("vitest").Mock<import("@vitest/spy").Procedure>;
export declare const mockSetMovementDebuffs: import("vitest").Mock<import("@vitest/spy").Procedure>;
export declare const mockExecuteReactionSpell: import("vitest").Mock<import("@vitest/spy").Procedure>;
export declare const mockCharacter: CombatCharacter;
export declare const mockTurnState: TurnState;
export declare const defaultProps: {
    characters: CombatCharacter[];
    turnState: TurnState;
    mapData: any;
    onCharacterUpdate: import("vitest").Mock<import("@vitest/spy").Procedure>;
    onLogEntry: import("vitest").Mock<import("@vitest/spy").Procedure>;
    endTurn: import("vitest").Mock<import("@vitest/spy").Procedure>;
    canAfford: import("vitest").Mock<import("@vitest/spy").Procedure>;
    consumeAction: import("vitest").Mock<import("@vitest/spy").Procedure>;
    recordAction: import("vitest").Mock<import("@vitest/spy").Procedure>;
    addDamageNumber: import("vitest").Mock<import("@vitest/spy").Procedure>;
    queueAnimation: import("vitest").Mock<import("@vitest/spy").Procedure>;
    handleDamage: import("vitest").Mock<import("@vitest/spy").Procedure>;
    processRepeatSaves: import("vitest").Mock<import("@vitest/spy").Procedure>;
    processTileEffects: import("vitest").Mock<import("@vitest/spy").Procedure>;
    spellZones: any[];
    movementDebuffs: any[];
    reactiveTriggers: any[];
    setMovementDebuffs: import("vitest").Mock<import("@vitest/spy").Procedure>;
};
export declare function resetActionExecutorMocks(): void;
