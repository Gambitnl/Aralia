/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/07/2026, 13:36:21
 * Dependents: components/ConversationPanel/ConversationPanel.tsx, hooks/actions/actionHandlers.ts
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/hooks/actions/handleResourceActions.ts
 * Handles resource management actions like spellcasting and ability usage.
 */
import React from 'react';
import { GameState, HitPointDiceSpendMap, RacialRestChoiceData, Spell } from '../../types';
import { AppAction } from '../../state/actionTypes';
import { AddMessageFn, AddGeminiLogFn } from './actionHandlerTypes';
import { CastSpellPayload } from '../../types/actions';
interface HandleRestProps {
    gameState: GameState;
    dispatch: React.Dispatch<AppAction>;
    addMessage: AddMessageFn;
    addGeminiLog: AddGeminiLogFn;
    /** Choices collected by the modal must survive the gameplay pipeline. */
    racialRestChoices?: Record<string, Record<string, RacialRestChoiceData>>;
}
interface HandleShortRestProps extends Omit<HandleRestProps, 'addGeminiLog'> {
    hitPointDiceSpend?: HitPointDiceSpendMap;
}
export declare function handleCastSpell(dispatch: React.Dispatch<AppAction>, payload: CastSpellPayload, gameState: GameState, addMessage: AddMessageFn): Promise<void>;
/**
 * Resolves a spellbook cast made OUTSIDE combat (the combat engine has its own
 * SpellCommand pipeline). The CAST_SPELL reducer only deducts the slot, so the
 * downtime effects are applied here:
 * - immediate healing -> MODIFY_PARTY_HEALTH on the chosen party member
 * - lasting buffs/utility -> APPLY_CHARACTER_STATUS_EFFECT (same-source replace)
 * - if the caster's sheet is open, its snapshot character is refreshed so the
 *   slot pips update immediately (the CAST_SPELL reducer does not sync it).
 */
export declare function handleOutOfCombatSpellbookCast(dispatch: React.Dispatch<AppAction>, payload: CastSpellPayload, spell: Spell, gameState: GameState, addMessage: AddMessageFn): void;
export declare function handleUseLimitedAbility(dispatch: React.Dispatch<AppAction>, payload: {
    characterId: string;
    abilityId: string;
}): void;
export declare function handleTogglePreparedSpell(dispatch: React.Dispatch<AppAction>, payload: {
    characterId: string;
    spellId: string;
}): void;
export declare function handleLongRest({ gameState, dispatch, addMessage, addGeminiLog, racialRestChoices, }: HandleRestProps): Promise<void>;
export declare function handleShortRest({ gameState, dispatch, addMessage, hitPointDiceSpend }: HandleShortRestProps): void;
export {};
