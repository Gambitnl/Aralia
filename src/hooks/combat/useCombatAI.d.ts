/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 05:49:10
 * Dependents: components/Combat/CombatView.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { CombatCharacter, CombatAction, BattleMapData } from '../../types/combat';
import { AI_THINKING_DELAY_MS } from '../../config/combatConfig';
interface UseCombatAIProps {
    /** The difficulty setting that determines AI thinking speed */
    difficulty: keyof typeof AI_THINKING_DELAY_MS;
    /** Current state of all characters in combat */
    characters: CombatCharacter[];
    /** The map data for pathfinding and positioning */
    mapData: BattleMapData | null;
    /** The ID of the character currently taking their turn */
    currentCharacterId: string | null;
    /** Callback to execute a chosen action */
    executeAction: (action: CombatAction) => Promise<boolean> | boolean;
    /** Callback to execute an ability (needed for damage/commands) */
    executeAbility: (ability: any, caster: CombatCharacter, targetPos: any, targetIds: string[]) => Promise<void> | void;
    /** Callback to end the turn */
    endTurn: () => void;
    /** Set of character IDs that are controlled by AI (in addition to 'enemy' team) */
    autoCharacters: Set<string>;
}
/**
 * Custom hook to encapsulate all AI decision-making logic.
 * Detects if the current turn is an AI turn, waits for a thinking delay,
 * determines the best action, and executes it.
 *
 * Focused regression coverage keeps the loop bounded while still allowing
 * auto-controlled allies, move actions, and ability actions to reuse the same
 * turn flow as enemies.
 */
export declare const useCombatAI: ({ difficulty, characters, mapData, currentCharacterId, executeAction, executeAbility, endTurn, autoCharacters }: UseCombatAIProps) => {
    aiState: "done" | "idle" | "thinking" | "acting";
};
export {};
