/**
 * @file src/hooks/combat/useCombatAI.ts
 * 
 * A specialized hook to manage the Artificial Intelligence state machine for combat.
 * It handles the lifecycle of an AI turn: Thinking -> Evaluating -> Acting -> Waiting -> Repeating.
 */

import { useState, useEffect, useCallback } from 'react';
import { CombatCharacter, CombatAction, BattleMapData } from '../../types/combat';
import { evaluateCombatTurn } from '../../utils/combat/combatAI';
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
    executeAction: (action: CombatAction) => boolean;
    /** Callback to end the turn */
    endTurn: () => void;
    /** Set of character IDs that are controlled by AI (in addition to 'enemy' team) */
    autoCharacters: Set<string>;
}

/**
 * Custom hook to encapsulate all AI decision-making logic.
 * Detects if the current turn is an AI turn, waits for a thinking delay,
 * determines the best action, and executes it.
 */
export const useCombatAI = ({
    difficulty,
    characters,
    mapData,
    currentCharacterId,
    executeAction,
    endTurn,
    autoCharacters
}: UseCombatAIProps) => {
    // State machine for the AI's turn execution
    // idle: Not an AI turn, or waiting for turn start
    // thinking: Simulating "thought" delay before acting
    // acting: Currently calculating or executing an action (prevents double-execution)
    // done: AI has finished its actions for the turn
    const [aiState, setAiState] = useState<'idle' | 'thinking' | 'acting' | 'done'>('idle');

    // Track actions to prevent infinite loops (max 3 actions per turn limit)
    const [aiActionsPerformed, setAiActionsPerformed] = useState(0);

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
        setAiActionsPerformed(0);

        const isAiControlled = character.team === 'enemy' || autoCharacters.has(character.id);

        if (isAiControlled) {
            // It is an AI turn. 
            // We introduce a delay to allow the UI to update and creating a natural pacing.
            // This transitions the state to 'thinking'.
            const delay = AI_THINKING_DELAY_MS[difficulty];
            const timer = setTimeout(() => {
                setAiState('thinking');
            }, delay);

            return () => clearTimeout(timer);
        } else {
            // Human turn, ensure AI is idle
            setAiState('idle');
        }
    }, [currentCharacterId, characters, autoCharacters, difficulty]);


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
            setAiState('idle');
            return;
        }

        // 2. Safety / Existential Checks
        // Prevent infinite loops with a hard cap on actions per turn (e.g. Move + Action + Bonus)
        // Also requires mapData to be present for pathfinding.
        if (aiActionsPerformed >= 3 || !mapData) {
            setAiState('done');
            endTurn();
            return;
        }

        // 3. Action Execution Wrapper
        // We use an async function to allow for potential future async evaluations,
        // though evaluateCombatTurn is currently synchronous.
        const performTurnLogic = async () => {
            // Lock the state to prevent re-entry while processing
            setAiState('acting');

            // 4. Evaluate Best Move
            // evaluateCombatTurn (in combatAI.ts) analyzes the board and returns the optimal CombatAction.
            // We pass the fresh 'characters' list to ensure decision is based on latest HP/positions.
            const action = evaluateCombatTurn(character, characters, mapData);

            if (action.type === 'end_turn') {
                // AI decided it has nothing productive left to do
                setAiState('done');
                endTurn();
            } else {
                // 5. Execute Action
                // Attempt to perform the chosen action (Move/Attack/etc).
                // executeAction handles the game engine updates.
                const success = executeAction(action);

                if (success) {
                    // Increment counter to eventually hit determining condition (max actions or end_turn decision)
                    setAiActionsPerformed(prev => prev + 1);

                    // 6. Loop Back
                    // After a successful action, we go back to 'thinking'.
                    // This allows the AI to make a *sequence* of moves (e.g., Move then Attack).
                    // We apply the delay again for pacing between individual actions.
                    setTimeout(() => setAiState('thinking'), AI_THINKING_DELAY_MS[difficulty]);
                } else {
                    // Action failed (e.g., resource exhaustion not caught by planner).
                    // Fallback to ending turn to prevent getting stuck in 'acting' state.
                    console.warn(`AI Action failed: ${action.type}. Ending turn.`);
                    setAiState('done');
                    endTurn();
                }
            }
        };

        performTurnLogic();

    }, [
        aiState,
        characters,
        mapData,
        currentCharacterId,
        aiActionsPerformed,
        executeAction,
        endTurn,
        difficulty
    ]);

    // Return the state mostly for debug/visualization purposes if needed
    return { aiState };
};
