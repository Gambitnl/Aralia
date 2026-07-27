/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/07/2026, 11:54:58
 * Dependents: hooks/combat/useTurnManager.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { CombatCharacter, TurnState, CombatAction } from '../../types/combat';
interface UseTurnOrderProps {
    characters: CombatCharacter[];
    initialTurnState?: TurnState;
}
interface TurnOrderResult {
    turnState: TurnState;
    /**
     * Sorts characters by initiative and starts the first turn.
     */
    initializeTurnOrder: (charactersWithInitiative: CombatCharacter[]) => void;
    /**
     * Advances to the next character in the turn order.
     * Skips dead characters (HP <= 0).
     * Returns metadata about the transition (isNewRound, nextCharacterId).
     */
    advanceTurn: () => {
        isNewRound: boolean;
        nextCharacterId: string | null;
        previousCharacterId: string | null;
    };
    /**
     * Adds a character to the existing turn order dynamically.
     */
    joinTurnOrder: (characterId: string, afterCharacterId?: string, options?: {
        initiative?: number;
    }) => void;
    /**
     * Removes a character from the initiative order when a spell-created actor
     * leaves combat outside the normal death flow.
     */
    removeFromTurnOrder: (characterId: string) => void;
    /**
     * Checks if it is currently the given character's turn.
     */
    isCharacterTurn: (characterId: string) => boolean;
    /**
     * Manually sets the current character (debug/testing).
     */
    setCurrentCharacter: (characterId: string) => void;
    /**
     * Records an action taken by the current character for history tracking.
     */
    recordAction: (action: CombatAction) => void;
    /**
     * Reset the turn order state (e.g. for new combat)
     */
    resetTurnOrder: () => void;
}
export declare const useTurnOrder: ({ characters }: UseTurnOrderProps) => TurnOrderResult;
export {};
