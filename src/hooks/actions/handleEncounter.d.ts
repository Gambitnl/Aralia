/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 16/07/2026, 13:29:09
 * Dependents: App.tsx, components/World3D/World3DWrapper.tsx, hooks/actions/actionHandlers.ts, hooks/actions/handleNpcInteraction.ts, hooks/useDeEscalation.ts, hooks/useSeaEncounter.ts
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/hooks/actions/handleEncounter.ts
 * Handles encounter-related actions like 'GENERATE_ENCOUNTER'.
 */
import React from 'react';
import { GameState, ShowEncounterModalPayload, StartBattleMapEncounterPayload, Item } from '../../types';
import { AppAction } from '../../state/actionTypes';
import type { RichNPC } from '../../types/world';
interface HandleGenerateEncounterProps {
    gameState: GameState;
    dispatch: React.Dispatch<AppAction>;
}
/** Opens the encounter modal immediately on the bestiary tab — no API call. */
export declare function handleGenerateEncounter({ dispatch }: HandleGenerateEncounterProps): void;
/**
 * Performs the Gemini AI encounter generation.
 * Called lazily when the user first opens the "AI Generated" tab inside the modal.
 * The modal stays open throughout (TRIGGER_AI_ENCOUNTER does not close it).
 */
export declare function handleTriggerAiEncounter({ gameState, dispatch }: HandleGenerateEncounterProps): Promise<void>;
export declare function handleShowEncounterModal(dispatch: React.Dispatch<AppAction>, payload: ShowEncounterModalPayload): void;
export declare function handleHideEncounterModal(dispatch: React.Dispatch<AppAction>): void;
export declare function handleStartBattleMapEncounter(dispatch: React.Dispatch<AppAction>, payload: StartBattleMapEncounterPayload): Promise<void>;
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
export declare function handleEndBattle(dispatch: React.Dispatch<AppAction>, rewards?: {
    gold: number;
    items: Item[];
    xp: number;
}, rescue?: EndBattleRescueOptions): void;
export {};
