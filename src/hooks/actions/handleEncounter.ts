
/**
 * @file src/hooks/actions/handleEncounter.ts
 * Handles encounter-related actions like 'GENERATE_ENCOUNTER'.
 */
import React from 'react';
import { GameState, ShowEncounterModalPayload, StartBattleMapEncounterPayload, Item } from '../../types';
import { AppAction } from '../../state/actionTypes';
import * as GeminiService from '../../services/geminiService';
import { calculateEncounterParameters, processAndValidateEncounter } from '../../utils/encounterUtils';

interface HandleGenerateEncounterProps {
    gameState: GameState;
    dispatch: React.Dispatch<AppAction>;
}

export async function handleGenerateEncounter({ gameState, dispatch }: HandleGenerateEncounterProps): Promise<void> {
    dispatch({ type: 'GENERATE_ENCOUNTER' }); 
    try {
        const partyForEncounter = gameState.tempParty || gameState.party.map(p => ({ id: p.id!, level: p.level || 1, classId: p.class.id }));
        if (partyForEncounter.length === 0) {
            throw new Error("Cannot generate encounter for an empty party.");
        }

        const { xpBudget, themeTags } = calculateEncounterParameters(partyForEncounter, gameState.currentLocationId, gameState.messages.slice(-10));
        const result = await GeminiService.generateEncounter(xpBudget, themeTags, partyForEncounter, gameState.devModelOverride);
        
        if (result.data?.rateLimitHit || result.metadata?.rateLimitHit) {
          dispatch({ type: 'SET_RATE_LIMIT_ERROR_FLAG' });
        }

        if (result.error || !result.data) {
            throw new Error(result.error || "Failed to generate encounter.");
        }

        const finalEncounter = processAndValidateEncounter(result.data.encounter, themeTags);
        
        const payload: ShowEncounterModalPayload = { encounter: finalEncounter, sources: result.data.sources, partyUsed: partyForEncounter };
        dispatch({ type: 'SHOW_ENCOUNTER_MODAL', payload: { encounterData: payload } });

    } catch (err: any) {
        const payload: ShowEncounterModalPayload = { error: err.message };
        dispatch({ type: 'SHOW_ENCOUNTER_MODAL', payload: { encounterData: payload } });
    }
}

export function handleShowEncounterModal(dispatch: React.Dispatch<AppAction>, payload: ShowEncounterModalPayload): void {
    dispatch({ type: 'SHOW_ENCOUNTER_MODAL', payload: { encounterData: payload } });
}

export function handleHideEncounterModal(dispatch: React.Dispatch<AppAction>): void {
    dispatch({ type: 'HIDE_ENCOUNTER_MODAL' });
}

export function handleStartBattleMapEncounter(dispatch: React.Dispatch<AppAction>, payload: StartBattleMapEncounterPayload): void {
    dispatch({ type: 'START_BATTLE_MAP_ENCOUNTER', payload });
}

export function handleEndBattle(dispatch: React.Dispatch<AppAction>, rewards?: { gold: number; items: Item[]; xp: number }): void {
    dispatch({ type: 'END_BATTLE', payload: { rewards } });
}
