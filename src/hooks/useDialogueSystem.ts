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
 * 4. Retaining actually heard local directions in the player's existing Logbook.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 21:54:20
 * Dependents: components/layout/GameModals.tsx, hooks/useConversation.ts
 * Imports: 13 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useCallback, useEffect, useRef } from 'react';
import { GameState, Action, DiscoveryType } from '../types';
import type { NPC } from '../types/world';
import { AppAction } from '../state/actionTypes';
import { ProcessTopicResult, buildNpcDialoguePromptContext, resolveDialogueStorefront, resolveHouseholdPersonalReply } from '../services/dialogueService';
import * as OllamaTextService from '../services/ollamaTextService';
import { NPCS } from '../data/world/npcs';
import { sanitizeAIPromptText } from '../utils/core/securityUtils';
import { topicUnlockKey } from '../systems/facts/worldFactStore';
import { describeSpeechProfile } from '../systems/social/speechProfile';
import { buildRumorDialogueContext } from '../systems/intrigue/RumorMillSystem';
import { buildPropagatedFactDialogueContext } from '../systems/memory/factPropagation';
import { getGameDay } from '../utils/core';
import {currentNpcDialogueProfile,generatedDialogueSpeakerKey} from '../systems/social/npcDialogueMemory';
import { npcChatAttitudeHint, npcGreetingStance, NPC_SHUN_REPLY } from '../systems/social/npcLifeReactions';

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
    // A reply belongs to one conversation lifetime and one request. Clock and
    // topic updates may rerender that conversation without changing its owner.
    const conversation = useRef({ npcId: gameState.activeDialogueSession?.npcId, revision: 0 });
    const replyGeneration = useRef(0);
    const latestState=useRef(gameState);
    latestState.current=gameState;
    const currentNpcId = gameState.activeDialogueSession?.npcId;
    if (conversation.current.npcId !== currentNpcId) {
        conversation.current = { npcId: currentNpcId, revision: conversation.current.revision + 1 };
    }
    useEffect(() => () => { replyGeneration.current++; }, []);

    /**
     * Generates a response from the NPC through the existing configured text service.
     * Stores the result in the game state for history tracking.
     */
    const generateResponse = useCallback(async (prompt: string, signal?: AbortSignal): Promise<string> => {
        const generation = ++replyGeneration.current;
        const revision = conversation.current.revision;
        const session = gameState.activeDialogueSession;
        if (!session) throw new Error("This conversation is no longer open.");

        const npc = resolveDialogueNpc(gameState, session.npcId);
        if (!npc) throw new Error("This speaker is unavailable.");

        // Keep the speaker's voice in the prompt. Generated lines stay intact:
        // forced word swaps distorted names, negation and grammar in native play.
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
        // NPC lives (2026-11-04, GG-596 follow-up 2): the free-text reply uses
        // the same attitude as the greeting (warm, cold, wary...), read from the
        // current state so a change during the talk reaches the next reply.
        const reaction = npcGreetingStance(gameState, session.npcId);
        const attitudeHint = npcChatAttitudeHint(gameState, session.npcId);
        const basePrompt = currentNpcDialogueProfile(gameState,npc.id) ?? '';
        if (!basePrompt) throw new Error("This speaker has no dialogue profile.");
        const speakerKey=generatedDialogueSpeakerKey(gameState,npc.id);
        if (!speakerKey) throw new Error('This speaker has no current identity.');
        const playerPrompt=sanitizeAIPromptText(prompt ?? '');
        const requestId=crypto.randomUUID();
        const systemPrompt = [basePrompt, speechHint, memoryHint, hearsayHint, attitudeHint]
            .filter(Boolean)
            .join(' ');

        const stillOwned = () => !signal?.aborted && generation === replyGeneration.current
            && revision === conversation.current.revision && conversation.current.npcId === npc.id
            && latestState.current.activeDialogueSession?.npcId===npc.id
            && generatedDialogueSpeakerKey(latestState.current,npc.id)===speakerKey
            && currentNpcDialogueProfile(latestState.current,npc.id)===basePrompt;
        if (!stillOwned()) throw new Error('This reply is no longer requested.');
        if (reaction.refuses) {
            // The stance fell to "shuns" during this talk. The NPC gives the
            // authored refusal and no model call is made. This is authored
            // speech, so it carries no generated-exchange publication.
            dispatch({ type: 'SET_LAST_NPC_INTERACTION', payload: { npcId: npc.id, response: NPC_SHUN_REPLY } });
            return NPC_SHUN_REPLY;
        }
        try {
            const result = await OllamaTextService.generateNPCResponse(
                npc.name,
                // The player's free-form dialogue line — neutralize prompt-injection
                // markers before it reaches the model.
                playerPrompt,
                systemPrompt
            );

            // Closing the window cancels publication, even if the transport is
            // still finishing under its existing timeout. Never save unseen
            // late speech as the answer to another resident or newer choice.
            if (!stillOwned()) throw new Error('This reply is no longer requested.');
            if (result.success && result.data?.text?.trim()) {
                // History, TTS and the UI share the generated wording. The voice
                // profile still guides generation; it must not rewrite facts afterward.
                const voiced = result.data.text.trim();
                dispatch({
                    type: 'SET_LAST_NPC_INTERACTION',
                    // Publish this heard exchange into the existing history.
                    // Generated claims remain quotations, never new world facts.
                    payload: { npcId: npc.id, response: voiced,
                        dialogue:{topicId:'generated_exchange',speakerKey,
                            source:{kind:'generated-exchange',requestId,playerPrompt}} }
                });
                return voiced;
            }
            throw new Error(result.error || 'No reply was generated.');
        } catch (error) {
            // Failure is a UI state, never invented NPC speech. The controller
            // offers a voice-only retry without repeating the topic's effects.
            throw error instanceof Error ? error : new Error('No reply was generated.');
        }
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
        if (!session) {
            if (result.openMerchant || result.directReply) throw new Error('This conversation has ended.');
            return;
        }
        // Recheck the source identity before recording effects. Only the normal
        // action processor can open a shop; a reducer dispatch is not a shop.
        const storefront = result.openMerchant
            ? resolveDialogueStorefront(gameState, session.npcId) : undefined;
        if (result.openMerchant) {
            if (!processAction) throw new Error('Trading is unavailable in this view.');
            if (result.openMerchant.npcId !== session.npcId || !storefront
                || storefront.id !== result.openMerchant.businessId
                || result.openMerchant.initialTab === 'gossip' && (storefront.businessType !== 'tavern'
                    || topicId !== 'global_rumors'
                    || resolveDialogueNpc(gameState, session.npcId)?.knowledgeProfile?.topicOverrides?.[topicId])) {
                throw new Error('This storefront is no longer available.');
            }
        }
        // Factual answers are re-read before any effects, so a stale selection
        // cannot publish another person's family or changed household details.
        if (result.directReply && (result.directReply.npcId !== session.npcId
            || resolveHouseholdPersonalReply(gameState, session, topicId,
                resolveDialogueNpc(gameState, session.npcId)) !== result.directReply.text)) {
            throw new Error('This personal answer is no longer available.');
        }
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

        if (result.directReply) {
            dispatch({type: 'SET_LAST_NPC_INTERACTION', payload: {
                npcId: session.npcId, response: result.directReply.text,
                ...(result.directReply.dialogue ? {dialogue:result.directReply.dialogue} : {}),
            }});
        }

        // Keep directions the player actually heard in the existing Logbook.
        // This records the speaker's words, not a visit or permission to cross.
        // Stable world/source/word identity lets the reducer ignore rapid repeat
        // publications while preserving a later changed answer as its own account.
        if (result.directReply && (topicId === 'global_directions' || topicId === 'household_public_history')) {
            const speaker = resolveDialogueNpc(gameState, session.npcId)!;
            dispatch({type: 'ADD_DISCOVERY_ENTRY', payload: {
                id: 'npc-directions:' + gameState.worldSeed + ':' + encodeURIComponent(speaker.id) + ':' + encodeURIComponent(result.directReply.text),
                type: DiscoveryType.NPC_INTERACTION,
                title: 'Directions from ' + speaker.name,
                content: speaker.name + ' told you: "' + result.directReply.text + '"',
                gameTime: new Date(currentGameTime).toISOString(),
                source: {type: 'NPC', id: speaker.id, name: speaker.name},
                flags: [{key: 'knowledgeKind', value: 'local-directions', label: 'Travel directions'}],
            }});
        }

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

        // 3b. NPC lives (2026-11-02): a resident's help request uses the
        // existing quest offer, and paying it is one HELP_TOWNSFOLK action that
        // re-checks the quest, the purse and the resident before it changes anything.
        if (result.offerQuest) {
            dispatch({ type: 'OFFER_QUEST', payload: result.offerQuest });
        }
        if (result.helpTownsfolk) {
            dispatch({ type: 'HELP_TOWNSFOLK', payload: result.helpTownsfolk });
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

        if (result.openMerchant && storefront && processAction) {
            // Existing merchant execution remains responsible for current life,
            // attendance, stock, prices and later transactions. Opening debits nothing.
            processAction({ type: 'OPEN_DYNAMIC_MERCHANT',
                label: `Browse ${storefront.name}`,
                payload: { merchantType: storefront.businessType, buildingId: session.npcId,
                    ...(result.openMerchant.initialTab ? {initialTab: result.openMerchant.initialTab} : {}) } });
        }

        // Read the current person/business and processor along with the world;
        // neither stale ownership nor a prior callback can retarget this choice.
    }, [gameState, dispatch, processAction]);

    /**
     * Surfaces the "Invite to party" dialogue affordance. Emits a `talk` action
     * carrying a `recruitOffer`, which the NPC-interaction handler picks up
     * (handleNpcInteraction → handleRecruitOffer): it runs the consent gate,
     * converts the NPC, and dispatches RECRUIT_COMPANION on a yes (or posts the
     * refusal reason on a no). The UI offers it only when a companion opportunity
     * exists for a household resident; the shared consent gate rechecks that
     * opportunity as well as trust before any party mutation.
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
