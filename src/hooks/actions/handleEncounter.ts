// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 15/07/2026, 08:56:38
 * Dependents: App.tsx, components/World3D/World3DWrapper.tsx, hooks/actions/actionHandlers.ts, hooks/actions/handleNpcInteraction.ts, hooks/useDeEscalation.ts, hooks/useSeaEncounter.ts
 * Imports: 9 files
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
import { simpleHash } from '../../utils/core/hashUtils';
import type { RichNPC } from '../../types/world';
// Shared recruitment building blocks — the SAME converter/consent modules used
// by the dialogue (P6) and tavern (P-tavern) triggers, so the rescue path never
// duplicates conversion or consent logic (DISCOVERY §6, decision #2).
import { evaluateRecruitOffer } from '../../systems/party/recruitConsent';
import { npcToPartyMember } from '../../systems/party/npcToPartyMember';

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
        // Scale the encounter to the LIVE party (including recruited companions).
        // tempParty is a snapshot frozen at game start and never updated on recruit,
        // so preferring it made encounters ignore anyone who joined the party.
        const partyForEncounter: TempPartyMember[] = gameState.party.length > 0
            ? gameState.party.map(p => ({
                id: p.id!,
                name: p.name,
                level: p.level || 1,
                classId: p.class.id,
            }))
            : (gameState.tempParty ?? []);
        if (partyForEncounter.length === 0) {
            throw new Error("Cannot generate encounter for an empty party.");
        }

    const { xpBudget, themeTags } = calculateEncounterParameters(partyForEncounter, gameState.currentLocationId, gameState.messages.slice(-10));
    const encounterSeed = simpleHash(
      [
        gameState.worldSeed,
        gameState.currentLocationId,
        xpBudget,
        ...partyForEncounter.map(p => `${p.level ?? 1}`),
        ...themeTags.sort(),
      ].join('|'),
    );

    const result = await GeminiService.generateEncounter(xpBudget, themeTags, partyForEncounter, gameState.devModelOverride, encounterSeed);

        if (result.data?.rateLimitHit || result.metadata?.rateLimitHit) {
            dispatch({ type: 'SET_RATE_LIMIT_ERROR_FLAG' });
        }

        if (result.error || !result.data) {
            throw new Error(result.error || "Failed to generate encounter.");
        }

        const finalEncounter = processAndValidateEncounter(result.data.encounter, themeTags, encounterSeed);
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
    // A source-world encounter may already provide regiment-derived actors with
    // stable WorldForge identities. Preserve those prepared combatants instead
    // of rebuilding them as generic bestiary monsters. Callers without a map
    // may still prepare their actors here, but CombatView deliberately withholds
    // play until that encounter class supplies a real WorldForge projection.
    const combatants = payload.combatants ?? await (async () => {
        const { createEnemyFromMonster } = await import('../../utils/combat/createEnemyFromMonster');
        return payload.monsters.flatMap((monster) =>
            Array.from({ length: monster.quantity }, (_, i) => createEnemyFromMonster(monster, i))
        );
    })();
    dispatch({ type: 'START_BATTLE_MAP_ENCOUNTER', payload: { startBattleMapEncounterData: { ...payload, combatants } } });
}

/**
 * Optional rescue context for {@link handleEndBattle}.
 *
 * When an encounter resolves on a RESCUE branch — the party freed a captive /
 * saved an NPC during the fight — that grateful rescuee may auto-join the party.
 * The caller passes the rescued NPC plus a read-only snapshot of game state so
 * the additive recruit step can run consent → convert → dispatch.
 */
export interface EndBattleRescueOptions {
    /** The NPC the party rescued during this encounter. Triggers the auto-join. */
    rescuedNpc?: RichNPC;
    /**
     * Read-only game state, required to evaluate consent. Consent is
     * auto-accepted for a grateful rescuee (see below), but `evaluateRecruitOffer`
     * still needs the state to build its verdict.
     */
    gameState?: GameState;
}

/**
 * Resolve a finished battle.
 *
 * Base behaviour (UNCHANGED): dispatch `END_BATTLE` with any rewards. Every
 * existing caller — e.g. `actionHandlers.END_BATTLE` — keeps working with the
 * two-arg form.
 *
 * ADDITIVE rescue branch: when `rescue.rescuedNpc` (and `rescue.gameState`) are
 * supplied, after ending the battle we auto-join the rescued NPC. A rescuee who
 * owes the party their life consents automatically, so we call
 * {@link evaluateRecruitOffer} with `{ autoAccept: true }` to BYPASS the normal
 * disposition/relationship gate, convert the NPC into a `{ character, companion }`
 * pair via {@link npcToPartyMember} (`source: 'rescue'`), dispatch
 * `RECRUIT_COMPANION`, and post a join message. The recruit reducer (P3) writes
 * both the `party` and `companions` stores under the shared id.
 *
 * This branch ONLY fires when a rescuee is passed; the normal battle-end flow is
 * never disturbed.
 */
export function handleEndBattle(
    dispatch: React.Dispatch<AppAction>,
    rewards?: { gold: number; items: Item[]; xp: number },
    rescue?: EndBattleRescueOptions,
): void {
    dispatch({ type: 'END_BATTLE', payload: { rewards } });

    // Additive rescue auto-join. No rescuee → nothing else happens.
    const rescuedNpc = rescue?.rescuedNpc;
    if (!rescuedNpc || !rescue?.gameState) {
        return;
    }

    // A grateful rescuee bypasses the disposition gate (consent auto-accepted).
    const verdict = evaluateRecruitOffer(rescuedNpc, rescue.gameState, { autoAccept: true });
    if (!verdict.willJoin) {
        // autoAccept always yields willJoin:true, but honour the verdict defensively.
        return;
    }

    const payload = npcToPartyMember(rescuedNpc, 'rescue');
    dispatch({ type: 'RECRUIT_COMPANION', payload });

    dispatch({
        type: 'ADD_MESSAGE',
        payload: {
            id: Date.now(),
            text: verdict.reason,
            sender: 'system',
            timestamp: new Date(),
            metadata: { companionId: payload.companion.id, type: 'recruit', source: 'rescue' },
        },
    });
}
