/**
 * @file src/hooks/useDialogueSystem.ts
 * @description
 * This hook acts as the central controller for the Dialogue System.
 * It connects the Game State (Redux), the Dialogue Service (Business Logic),
 * and the AI Service (Gemini) to the UI components.
 *
 * It handles:
 * 1. Generating AI responses.
 * 2. Processing side effects of dialogue choices (XP, Reputation, Unlocks, Costs).
 * 3. Managing the dialogue session lifecycle.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 20/09/2026, 21:00:39
 * Dependents: components/layout/GameModals.tsx, hooks/useConversation.ts
 * Imports: 12 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useCallback } from 'react';
import { GameState, Action } from '../types';
import type { NPC } from '../types/world';
import { AppAction } from '../state/actionTypes';
import { ProcessTopicResult, buildNpcDialoguePromptContext } from '../services/dialogueService';
import * as OllamaTextService from '../services/ollamaTextService';
import { NPCS } from '../data/world/npcs';
import { sanitizeAIPromptText } from '../utils/core/securityUtils';
import { topicUnlockKey } from '../systems/facts/worldFactStore';
import { applySpeechProfile, describeSpeechProfile } from '../systems/social/speechProfile';
import { buildRumorDialogueContext } from '../systems/intrigue/RumorMillSystem';
import { buildPropagatedFactDialogueContext } from '../systems/memory/factPropagation';
import { getGameDay } from '../utils/core';

/**
 * Resolves a dialogue speaker from BOTH NPC tables (agora-f821.6, deepdive F7).
 *
 * `NPCS` is a hand-authored table of six entries. Every town resident and every
 * opening-situation stranger lives in `gameState.generatedNpcs` instead, and the
 * session-opening path (`handleNpcInteraction`) and the window
 * (`GameModals.tsx`) already resolve both tables. This hook used to read only
 * `NPCS`, so a generated NPC answered every topic with the literal string
 * `"..."` and its disposition message read "NPC approves of your words."
 *
 * `RichNPC extends NPC`, so the widened lookup needs no new shape: generated
 * NPCs carry `initialPersonalityPrompt` and `speechProfile` already.
 */
export const resolveDialogueNpc = (
  gameState: GameState,
  npcId: string
): NPC | undefined => NPCS[npcId] ?? gameState.generatedNpcs?.[npcId];

/**
 * Prompt-ready lines for the things this NPC knows SECOND-HAND (agora-f821.12,
 * deepdive findings F8/F9).
 *
 * Two of the three unwired dialogue-context builders live here:
 *  - `buildRumorDialogueContext` — town gossip that has actually reached this
 *    NPC, after the rumor mill's one-night delay. A stranger outside the town
 *    has no entry in `reachedNpcs`, so they get nothing until the talk travels.
 *  - `buildPropagatedFactDialogueContext` — `KnownFact`s that arrived through
 *    `propagateFact` (source `gossip`), attributed to whoever passed them on.
 *
 * The third builder, `buildWitnessDialogueContext`, is NOT repeated here: it is
 * already composed by `buildNpcDialoguePromptContext` in `dialogueService`, and
 * what an NPC saw for themselves is first-hand evidence that must not be framed
 * as hearsay.
 *
 * Exported because `useConversation` (the free-text chat lane) feeds the same
 * lines to the same model through a different prompt builder. One composer, two
 * lanes, so the lanes cannot drift apart.
 */
export const buildNpcHearsayLines = (
  gameState: GameState,
  npcId: string
): string[] => {
  const gameDay = getGameDay(gameState.gameTime);
  const rumors = buildRumorDialogueContext(gameState.townRumors ?? [], npcId, gameDay);
  const propagated = buildPropagatedFactDialogueContext(
    gameState.npcMemory?.[npcId]?.knownFacts ?? [],
    (sourceNpcId) => resolveDialogueNpc(gameState, sourceNpcId)?.name
  );
  return [...rumors, ...propagated];
};

/**
 * Wraps {@link buildNpcHearsayLines} into one prompt fragment, or `''` when the
 * NPC has heard nothing. The instruction is deliberately hedged: second-hand
 * talk is the one knowledge source the NPC may be wrong about, and a model told
 * otherwise will state a rumor as fact.
 */
export const describeNpcHearsay = (gameState: GameState, npcId: string): string => {
  const lines = buildNpcHearsayLines(gameState, npcId);
  if (lines.length === 0) return '';
  return `You have also heard this second-hand, and it may be wrong: ${lines.join(' ')} Repeat it as talk you picked up, never as something you saw yourself.`;
};

export const useDialogueSystem = (
    gameState: GameState,
    dispatch: React.Dispatch<AppAction>,
    /**
     * The interaction-action processor (`processAction` from useGameActions).
     * Required to make {@link inviteToParty} work end-to-end: the `talk` action
     * is routed through the action handlers (handleNpcInteraction → handleRecruitOffer),
     * NOT the Redux reducer, so a raw `dispatch` would be inert for it. When omitted
     * (e.g. in unit tests of the side-effect callbacks), `inviteToParty` falls back
     * to `dispatch` so the action is still emitted and assertable.
     */
    processAction?: (action: Action) => void
) => {

    /**
     * Generates a response from the NPC using the Gemini AI service.
     * Stores the result in the game state for history tracking.
     */
    const generateResponse = useCallback(async (prompt: string): Promise<string> => {
        const session = gameState.activeDialogueSession;
        if (!session) return "...";

        const npc = resolveDialogueNpc(gameState, session.npcId);
        if (!npc) return "...";

        // Speech fingerprinting (agora-9e0f): the profile hint steers the model, and
        // the post-processor below enforces the same voice when the model ignores it.
        const speechHint = describeSpeechProfile(npc.speechProfile);
        // Knowledge profile (agora-13a9.4) + witness recall (agora-f58b), composed
        // in one call by the dialogue service so the boundary ("what I will talk
        // about") is read before the evidence ("what I saw you do"). Guarded topics
        // are named but their authored secret text is withheld.
        const memoryHint = buildNpcDialoguePromptContext(gameState, session.npcId, npc);
        // Second-hand knowledge (agora-f821.12): rumors that reached this NPC and
        // facts that arrived through propagateFact. Kept separate from the witness
        // block above, because hearsay may be wrong and eyewitness memory may not.
        const hearsayHint = describeNpcHearsay(gameState, session.npcId);
        const basePrompt = npc.initialPersonalityPrompt ?? '';
        if (!basePrompt) return "...";
        const systemPrompt = [basePrompt, speechHint, memoryHint, hearsayHint]
            .filter(Boolean)
            .join(' ');

        try {
            const result = await OllamaTextService.generateNPCResponse(
                npc.name,
                // The player's free-form dialogue line — neutralize prompt-injection
                // markers before it reaches the model.
                sanitizeAIPromptText(prompt ?? ""),
                systemPrompt
            );

            if (result.data?.text) {
                // Post-process before it is stored, so history, TTS and the UI all see the
                // same fingerprinted line rather than diverging copies.
                const voiced = applySpeechProfile(result.data.text, npc.speechProfile);
                dispatch({
                    type: 'SET_LAST_NPC_INTERACTION',
                    payload: { npcId: npc.id, response: voiced }
                });
                return voiced;
            }
        } catch (error) {
            console.error("Failed to generate dialogue response:", error);
            // Fallback response handled by UI or return generic
        }
        return "...";
        // Depends on `gameState` as a whole rather than a field list: the prompt now
        // reads generatedNpcs, npcMemory, townRumors and gameTime as well as the
        // session, and a stale memory snapshot would make the NPC forget something
        // it demonstrably just saw.
    }, [gameState, dispatch]);

    /**
     * Handles the side effects of a topic selection.
     * Maps the `ProcessTopicResult` from the service to Redux actions.
     */
    const handleTopicOutcome = useCallback((result: ProcessTopicResult, topicId: string) => {
        const session = gameState.activeDialogueSession;
        if (!session) return;
        const currentGameTime = Number(gameState?.gameTime ?? Date.now());

        // 0. Persist Topic Memory
        // Ensure this topic is remembered in the NPC's long-term memory
        dispatch({
            type: 'DISCUSS_TOPIC',
            payload: {
                topicId,
                npcId: session.npcId,
                date: currentGameTime
            }
        });

        // 1. Grant Experience
        if (result.xpReward && result.xpReward > 0) {
            dispatch({ type: 'GRANT_EXPERIENCE', payload: { amount: result.xpReward } });
            dispatch({
                type: 'ADD_NOTIFICATION',
                payload: { type: 'success', message: `Gained ${result.xpReward} XP` }
            });
        }

        // 2. Modify Disposition
        if (result.dispositionChange && result.dispositionChange !== 0) {
            dispatch({
                type: 'UPDATE_NPC_DISPOSITION',
                payload: { npcId: session.npcId, amount: result.dispositionChange }
            });

            // Log dynamic feedback
            const direction = result.dispositionChange > 0 ? "approves" : "disapproves";
            dispatch({
                type: 'ADD_MESSAGE',
                payload: {
                    id: Date.now(),
                    text: `${resolveDialogueNpc(gameState, session.npcId)?.name || 'NPC'} ${direction} of your words.`,
                    sender: 'system',
                    timestamp: new Date(currentGameTime) as unknown as Date
                }
            });
        }

        // 3. Process Costs (Deductions)
        if (result.deductions && result.deductions.length > 0) {
            result.deductions.forEach(cost => {
                if (cost.type === 'gold') {
                    dispatch({
                        type: 'MODIFY_GOLD',
                        payload: { amount: -cost.value }
                    });
                    dispatch({
                        type: 'ADD_NOTIFICATION',
                        payload: { type: 'info', message: `Paid ${cost.value} Gold` }
                    });
                } else if (cost.type === 'item' && cost.targetId) {
                    dispatch({
                        type: 'REMOVE_ITEM',
                        payload: { itemId: cost.targetId, count: cost.value }
                    });
                     dispatch({
                        type: 'ADD_NOTIFICATION',
                        payload: { type: 'info', message: `Removed item(s)` }
                    });
                }
            });
        }

        // 4. Handle Topic Unlocks — durable cross-NPC propagation (DIAL-002/DIAL-004)
        // Every unlock becomes a world-level fact: what THIS NPC told the player
        // now durably unlocks the gated topic with EVERY NPC (dialogueService's
        // `topic_known` prerequisite reads the same store), and it survives
        // save/reload because the store serializes with GameState. Provenance
        // (who told you, via which topic) rides along for audits and future
        // region-scoped ripples.
        if (result.unlocks && result.unlocks.length > 0) {
            result.unlocks.forEach(unlockedTopicId => {
                dispatch({
                    type: 'LEARN_WORLD_FACT',
                    payload: {
                        fact: {
                            key: topicUnlockKey(unlockedTopicId),
                            sourceNpcId: session.npcId,
                            sourceTopicId: topicId,
                            learnedAt: currentGameTime,
                        },
                    },
                });
            });
        }

        // 5. Handle Lock Topic (if the NPC refuses to speak on it again)
        if (result.lockTopic) {
            // This would require a mechanism to permanently ban a topic ID for an NPC
            // Currently not supported in the simple reducer, but could be added to NPC Memory.
        }

        // `gameState` in full: the disposition message now names a generated NPC,
        // which lives in `generatedNpcs`, not in the two fields listed before.
    }, [gameState, dispatch]);

    /**
     * Surfaces the "Invite to party" dialogue affordance. Emits a `talk` action
     * carrying a `recruitOffer`, which the NPC-interaction handler picks up
     * (handleNpcInteraction → handleRecruitOffer): it runs the consent gate,
     * converts the NPC, and dispatches RECRUIT_COMPANION on a yes (or posts the
     * refusal reason on a no). The button is always shown in the UI — ineligible
     * NPCs are declined by the consent gate with a reason, not hidden.
     */
    const inviteToParty = useCallback((npcId: string) => {
        const action: Action = {
            type: 'talk',
            label: 'Invite to party',
            targetId: npcId,
            payload: { targetNpcId: npcId, recruitOffer: { targetNpcId: npcId } }
        };
        if (processAction) {
            processAction(action);
        } else {
            // Fallback: emit through the raw dispatch so the action is still
            // observable (used by unit tests that pass no processAction).
            dispatch(action as unknown as AppAction);
        }
    }, [processAction, dispatch]);

    return {
        generateResponse,
        handleTopicOutcome,
        inviteToParty
    };
};
