/**
 * @file src/hooks/actions/handleResourceActions.ts
 * Handles resource management actions like spellcasting and ability usage.
 */
import React from 'react';
import { GameState } from '../../types';
import { AppAction } from '../../state/actionTypes';
import { AddMessageFn, AddGeminiLogFn } from './actionHandlerTypes';
import { handleGossipEvent, handleResidueChecks, handleLongRestWorldEvents } from './handleWorldEvents'; // Import the new world event handlers.

interface HandleRestProps {
    gameState: GameState; // Pass full gameState for context
    dispatch: React.Dispatch<AppAction>;
    addMessage: AddMessageFn;
    addGeminiLog: AddGeminiLogFn;
}

export function handleCastSpell(dispatch: React.Dispatch<AppAction>, payload: { characterId: string; spellLevel: number }): void {
    dispatch({ type: 'CAST_SPELL', payload });
}

export function handleUseLimitedAbility(dispatch: React.Dispatch<AppAction>, payload: { characterId: string; abilityId: string }): void {
    dispatch({ type: 'USE_LIMITED_ABILITY', payload });
}

export function handleTogglePreparedSpell(dispatch: React.Dispatch<AppAction>, payload: { characterId: string; spellId: string }): void {
    dispatch({ type: 'TOGGLE_PREPARED_SPELL', payload });
}

export async function handleLongRest({ gameState, dispatch, addMessage, addGeminiLog }: HandleRestProps): Promise<void> {
    addMessage("The party begins to settle in for a long rest...", "system");

    // --- NEW: OVERNIGHT WORLD SIMULATION ---
    // This new sequence makes the world feel alive by processing events that happen "overnight".
    // DEPENDS ON: `handleLongRestWorldEvents`, `handleResidueChecks`, `handleGossipEvent` from `handleWorldEvents.ts`.
    // DISPATCHES: `BATCH_UPDATE_NPC_MEMORY` and then `PROCESS_GOSSIP_UPDATES` to `npcReducer.ts`.

    // Step 1: Check for any discovered evidence from player's past actions.
    addMessage("You notice the faint sounds of the world continuing around you as you rest.", "system");
    await handleResidueChecks(gameState, dispatch);

    // Step 2: Calculate all long-term memory changes (decay, pruning, drift) for all NPCs.
    // This is a pure function that returns a new state object.
    const newNpcMemoryState = handleLongRestWorldEvents(gameState);
    
    // Step 3: Dispatch a single, batched action to apply all memory maintenance changes at once.
    // This is highly performant as it causes only one state update for all these changes.
    dispatch({ type: 'BATCH_UPDATE_NPC_MEMORY', payload: newNpcMemoryState });

    // Step 4: Run the gossip simulation. It's crucial to run this *after* the memory decay,
    // using the newly updated state, so that NPCs are gossiping with their most current memories.
    const updatedGameStateForGossip = { ...gameState, npcMemory: newNpcMemoryState };
    await handleGossipEvent(updatedGameStateForGossip, addGeminiLog, dispatch);
    // --- END NEW ---

    // Step 5: Apply the mechanical benefits of the long rest to the player party.
    dispatch({ type: 'LONG_REST' });
    
    // Step 6: Advance the in-game clock.
    dispatch({ type: 'ADVANCE_TIME', payload: { seconds: 8 * 3600 } }); // 8 hours

    addMessage("You awake feeling refreshed and ready for a new day.", "system");
}

export function handleShortRest({ dispatch, addMessage }: Omit<HandleRestProps, 'gameState' | 'addGeminiLog'>): void {
    addMessage("The party takes a short rest, tending to their wounds.", "system");
    dispatch({ type: 'SHORT_REST' });
    dispatch({ type: 'ADVANCE_TIME', payload: { seconds: 1 * 3600 } }); // 1 hour
}