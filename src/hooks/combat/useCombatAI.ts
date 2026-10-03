// @dependencies-start
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
// @dependencies-end

/**
 * @file src/hooks/combat/useCombatAI.ts
 * 
 * A specialized hook to manage the Artificial Intelligence state machine for combat.
 * It handles the lifecycle of an AI turn: Thinking -> Evaluating -> Acting -> Waiting -> Repeating.
 */

import { useState, useEffect, useRef } from 'react';
import { CombatCharacter, CombatAction, BattleMapData } from '../../types/combat';
import { evaluateCombatTurn, type CombatTurnOptions } from '../../utils/combat/combatAI';
import type { CombatDifficulty } from '../../config/combatConfig';
import { useAIConfig, resolveThinkingDelayMs } from '../../context/AIConfigContext';
import { useOptionalGameState } from '../../state/GameContext';
import { getGameDay } from '../../utils/core';

const MAX_AI_ACTIONS_PER_TURN = 3;

/**
 * Generated monsters may carry the id of the template they were built from.
 * The field is optional, so read it without widening CombatCharacter.
 */
const readTemplateId = (character: CombatCharacter): string | undefined =>
    (character as CombatCharacter & { templateId?: string }).templateId;

interface UseCombatAIProps {
    /** The difficulty setting that determines AI thinking speed */
    difficulty: CombatDifficulty;
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
export const useCombatAI = ({
    difficulty,
    characters,
    mapData,
    currentCharacterId,
    executeAction,
    executeAbility,
    endTurn,
    autoCharacters
}: UseCombatAIProps) => {
    // State machine for the AI's turn execution
    // idle: Not an AI turn, or waiting for turn start
    // thinking: Simulating "thought" delay before acting
    // acting: Currently calculating or executing an action (prevents double-execution)
    // done: AI has finished its actions for the turn
    const [aiState, setAiState] = useState<'idle' | 'thinking' | 'acting' | 'done'>('idle');

    // Pacing comes from context, so a host can retune the per-difficulty delays
    // or give one creature its own pace. With no provider mounted the context
    // default reproduces the table this hook used to import directly.
    const aiConfig = useAIConfig();

    // Witness memory -> combat stance (agora-db71.17, PK-18 / WF-G255).
    //
    // `resolveEncounterStance` has existed in combatAI.ts since agora-f58b and had
    // no production caller, because `evaluateCombatTurn` only runs it when the
    // caller supplies `options.stance` and this hook supplied none. A creature that
    // watched the player cut down three guards therefore fought exactly as hard as
    // one that had never seen them.
    //
    // The memory lives on GameState, which this hook did not previously read. It is
    // taken from the context rather than a new prop because the prop would have to
    // be threaded from CombatView, and CombatView already reads the same context two
    // hundred lines above this call. `useOptionalGameState` (not `useGameState`) is
    // the accessor the codebase provides for hooks that are also mounted standalone
    // in unit tests: in play the provider is always mounted, so `null` means "no
    // provider", never "no memory".
    const gameContext = useOptionalGameState();
    const npcMemory = gameContext?.state.npcMemory;
    const gameTime = gameContext?.state.gameTime;

    /**
     * Per-turn planner options for one combatant. Returns `{}` when this creature
     * holds no memory of the player, which is the exact input `evaluateCombatTurn`
     * treats as "behave as before".
     */
    const turnOptionsFor = (character: CombatCharacter): CombatTurnOptions => {
        const memory = npcMemory?.[character.id];
        if (!memory || !gameTime) return {};
        return { stance: { memory, gameDay: getGameDay(gameTime) } };
    };

    const thinkingDelayFor = (character: CombatCharacter): number => resolveThinkingDelayMs(
        aiConfig,
        difficulty,
        character.id,
        readTemplateId(character)
    );

    // Track actions to prevent infinite loops while still allowing a full
    // move/action sequence to resolve within the current turn.
    const [aiActionsPerformed, setAiActionsPerformed] = useState(0);
    const aiActionsPerformedRef = useRef(0);

    /**
     * Effect: Turn Start / AI Activation
     * Watches for changes in the current active character.
     * If the new character is an enemy or auto-controlled, initiates the AI workflow.
     */
    useEffect(() => {
        if (!currentCharacterId) return;

        // We must find the character object to check its team
        const character = characters.find(c => c.id === currentCharacterId);
        if (!character) return;

        // Reset state for the new turn
        aiActionsPerformedRef.current = 0;
        setTimeout(() => setAiActionsPerformed(0), 0);

        const isAiControlled = character.team === 'enemy' || autoCharacters.has(character.id);

        if (isAiControlled) {
            // It is an AI turn. 
            // We introduce a delay to allow the UI to update and creating a natural pacing.
            // This transitions the state to 'thinking' only if we are idle (turn just started).
            const delay = thinkingDelayFor(character);
            const timer = setTimeout(() => {
                setAiState(prev => prev === 'idle' ? 'thinking' : prev);
            }, delay);

            return () => clearTimeout(timer);
        } else {
            // Human turn, ensure AI is idle
            setTimeout(() => setAiState('idle'), 0);
        }
    }, [currentCharacterId, characters, autoCharacters, difficulty, aiConfig]);


    /**
     * Effect: AI Decision Loop
     * This is the core "brain" loop. It fires when the state becomes 'thinking'.
     * It evaluates the board, chooses an action, executes it, and then loops or ends.
     */
    useEffect(() => {
        if (aiState !== 'thinking') return;

        // 1. Validate Context
        // We need the current character to perform any action plan.
        const character = characters.find(c => c.id === currentCharacterId);
        if (!character) {
            // If character disappeared (e.g. died mid-turn?), abort to idle
            setTimeout(() => setAiState('idle'), 0);
            return;
        }

        // Strict validation: Ensure we don't accidentally evaluate a player turn 
        // due to an untracked setTimeout carrying over from the previous enemy turn.
        const isAiControlled = character.team === 'enemy' || autoCharacters.has(character.id);
        if (!isAiControlled) {
            setTimeout(() => setAiState('idle'), 0);
            return;
        }

        // 2. Safety / Existential Checks
        // Prevent infinite loops with a hard cap on actions per turn (e.g. Move + Action + Bonus)
        // Also requires mapData to be present for pathfinding.
        if (aiActionsPerformedRef.current >= MAX_AI_ACTIONS_PER_TURN || !mapData) {
            setTimeout(() => setAiState('done'), 0);
            endTurn();
            return;
        }

        // 3. Action Execution Wrapper
        // We use an async function to allow for potential future async evaluations,
        // though evaluateCombatTurn is currently synchronous.
        const performTurnLogic = async () => {
            // Lock the state to prevent re-entry while processing
            setTimeout(() => setAiState('acting'), 0);

            // 4. Evaluate Best Move
            // evaluateCombatTurn (in combatAI.ts) analyzes the board and returns the optimal CombatAction.
            // We pass the fresh 'characters' list to ensure decision is based on latest HP/positions.
            const action = evaluateCombatTurn(character, characters, mapData, turnOptionsFor(character));

            if (action.type === 'end_turn') {
                // AI decided it has nothing productive left to do
                setTimeout(() => setAiState('done'), 0);
                endTurn();
            } else if (action.type === 'ability' && action.abilityId) {
                const ability = character.abilities.find(a => a.id === action.abilityId);
                if (ability) {
                    await executeAbility(
                        ability,
                        character,
                        action.targetPosition || character.position,
                        action.targetCharacterIds || []
                    );
                    aiActionsPerformedRef.current += 1;
                    setAiActionsPerformed(aiActionsPerformedRef.current);
                    setTimeout(() => setAiState('thinking'), thinkingDelayFor(character));
                } else {
                    console.warn(`AI Action failed: Ability ${action.abilityId} not found.`);
                    setTimeout(() => setAiState('done'), 0);
                    endTurn();
                }
            } else {
                // 5. Execute Action
                // Attempt to perform the chosen action (Move/Attack/etc).
                // executeAction handles the game engine updates.
                const success = await executeAction(action);

                if (success) {
                    // Increment counter to eventually hit determining condition (max actions or end_turn decision)
                    aiActionsPerformedRef.current += 1;
                    setAiActionsPerformed(aiActionsPerformedRef.current);

                    // 6. Loop Back
                    // After a successful action, we go back to 'thinking'.
                    // This allows the AI to make a *sequence* of moves (e.g., Move then Attack).
                    // We apply the delay again for pacing between individual actions.
                    // This delay is also configurable via the difficulty setting.
                    setTimeout(() => setAiState('thinking'), thinkingDelayFor(character));
                } else {
                    // Action failed (e.g., resource exhaustion not caught by planner).
                    // Fallback to ending turn to prevent getting stuck in 'acting' state.
                    console.warn(`AI Action failed: ${action.type}. Ending turn.`);
                    setTimeout(() => setAiState('done'), 0);
                    endTurn();
                }
            }
        };

        performTurnLogic();

        // WARNING: This dependency array includes `characters` which changes on every action.
        // This is intentional to ensure the AI sees fresh state, but it means the effect
        // re-fires frequently. Verify that the `aiState !== 'thinking'` guard (line 104) is
        // sufficient to prevent double-execution. Consider using a ref for characters if
        // performance issues arise in large battles.
    }, [
        aiState,
        characters,
        mapData,
        currentCharacterId,
        executeAction,
        executeAbility,
        endTurn,
        difficulty,
        autoCharacters,
        aiConfig,
        // Witness memory is read inside the loop, so a stance that changes mid-fight
        // (a fresh act recorded by a bystander) reaches the next evaluation.
        npcMemory,
        gameTime
    ]);

    // Return the state mostly for debug/visualization purposes if needed
    return { aiState };
};
