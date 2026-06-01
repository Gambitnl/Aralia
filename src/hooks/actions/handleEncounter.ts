// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/05/2026, 23:14:41
 * Dependents: hooks/actions/actionHandlers.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/hooks/actions/handleEncounter.ts
 * Handles encounter-related actions like 'GENERATE_ENCOUNTER'.
 */
import React from 'react';
import { GameState, ShowEncounterModalPayload, StartBattleMapEncounterPayload, Item, TempPartyMember } from '../../types';
import { AppAction } from '../../state/actionTypes';
import * as GeminiService from '../../services/geminiService';
import { calculateEncounterParameters, processAndValidateEncounter } from '../../utils/encounterUtils';

interface HandleGenerateEncounterProps {
    gameState: GameState;
    dispatch: React.Dispatch<AppAction>;
}

/** Opens the encounter modal immediately on the bestiary tab — no API call. */
export function handleGenerateEncounter({ dispatch }: HandleGenerateEncounterProps): void {
    dispatch({ type: 'GENERATE_ENCOUNTER' });
}

/**
 * Performs the Gemini AI encounter generation.
 * Called lazily when the user first opens the "AI Generated" tab inside the modal.
 * The modal stays open throughout (TRIGGER_AI_ENCOUNTER does not close it).
 */
export async function handleTriggerAiEncounter({ gameState, dispatch }: HandleGenerateEncounterProps): Promise<void> {
    dispatch({ type: 'TRIGGER_AI_ENCOUNTER' });
    try {
        const partyForEncounter: TempPartyMember[] = gameState.tempParty ?? gameState.party.map(p => ({
            id: p.id!,
            name: p.name,
            level: p.level || 1,
            classId: p.class.id,
        }));
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

    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
        const payload: ShowEncounterModalPayload = { error: errorMessage };
        dispatch({ type: 'SHOW_ENCOUNTER_MODAL', payload: { encounterData: payload } });
    }
}

export function handleShowEncounterModal(dispatch: React.Dispatch<AppAction>, payload: ShowEncounterModalPayload): void {
    dispatch({ type: 'SHOW_ENCOUNTER_MODAL', payload: { encounterData: payload } });
}

export function handleHideEncounterModal(dispatch: React.Dispatch<AppAction>): void {
    dispatch({ type: 'HIDE_ENCOUNTER_MODAL' });
}

export async function handleStartBattleMapEncounter(dispatch: React.Dispatch<AppAction>, payload: StartBattleMapEncounterPayload): Promise<void> {
    // Build combat-ready enemies only when the player actually starts a battle.
    // createEnemyFromMonster imports the runtime monster registry, which pulls in
    // the generated bestiary; keeping that import here prevents the main menu
    // from downloading monster data during startup.
    const { createEnemyFromMonster } = await import('../../utils/combat/createEnemyFromMonster');
    const combatants = payload.monsters.flatMap((monster) =>
        Array.from({ length: monster.quantity }, (_, i) => createEnemyFromMonster(monster, i))
    );
    dispatch({ type: 'START_BATTLE_MAP_ENCOUNTER', payload: { startBattleMapEncounterData: { ...payload, combatants } } });
}

export function handleEndBattle(dispatch: React.Dispatch<AppAction>, rewards?: { gold: number; items: Item[]; xp: number }): void {
    dispatch({ type: 'END_BATTLE', payload: { rewards } });
}
