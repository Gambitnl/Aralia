/**
 * @file src/hooks/actions/handleNpcInteraction.ts
 * Handles NPC interaction actions like 'talk'.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 03:11:09
 * Dependents: hooks/actions/actionHandlers.ts
 * Imports: 31 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React from 'react';
import { GameState, Action, GoalStatus } from '../../types';
import { AppAction } from '../../state/actionTypes';
import * as OllamaTextService from '../../services/ollamaTextService';
import { townChronicleForLocation } from '../../systems/worldforge/townsim/chronicleForLocation';
import { npcGreetingPromptLine, npcGreetingStance, npcShunMessage } from '../../systems/social/npcLifeReactions';
import { synthesizeSpeech } from '../../services/ttsService';
import { AddMessageFn, AddGeminiLogFn, PlayPcmAudioFn } from './actionHandlerTypes';
import { NPCS } from '../../constants';
import { resolveAndRegisterEntities } from '../../utils/context';
import { generateNPC, NPCGenerationConfig } from '../../services/npcGenerator';
import { generateId } from '../../utils/core/idGenerator';
import { getDayPartLabel, getGameDay } from '../../utils/core/timeUtils';
import { buildActionMemoryDispatches, hasDirectPlayerMeeting } from '../../systems/memory/actionMemoryMatrix';
import { latestSpokenDialogueReplies } from '../../systems/social/npcDialogueMemory';
import { OllamaService } from '../../services/ollama';
import { ConversationMessage } from '../../types/conversation';
import { getWeatherSummary } from '../../types/environment';
import { INITIAL_QUESTS } from '../../data/quests';
import type { QuestOffer } from '../../types/actions';
import type { RichNPC } from '../../types/world';
import type { Companion } from '../../types/companions';
import { preparationMeetingRecall } from '../../systems/companions/companionPreparations';
import { companionRumorRecall } from '../../systems/companions/companionRumors';
import { companionActivityContactError, companionActivityMeetingLine } from '../../systems/companions/companionWorldActivities';
import { sharedJourneyRecall } from '../../systems/companions/companionJourney';
import { evaluateRecruitOffer } from '../../systems/party/recruitConsent';
import { npcToPartyMember, promoteCompanionToMember } from '../../systems/party/npcToPartyMember';
import { isInParty } from '../../systems/party/recruitTypes';
import { isWatchRole, isWantedInTown } from '../../systems/social/watchReaction';
import { handleStartBattleMapEncounter } from './handleEncounter';
import { prepareActiveGroundSettlementEncounter } from '../../systems/combat/fightInPlace/activeGroundCombatSession';
import { createAuthoredTownWatchSourceGap } from '../../systems/combat/fightInPlace/authoredTownWatchSourceGap';

/**
 * Guard confrontation (item 1): when the player is WANTED in this town and tries
 * to talk to a member of the town watch, the guard does not chat — they move to
 * arrest, which resolves into the same tactical combat the hostile opening uses.
 *
 * Returns true when it handled the interaction (a confrontation was started or a
 * refusal posted), so the caller stops before opening any dialogue session.
 */
async function tryWatchConfrontation(
  npcRole: string | undefined,
  npcName: string,
  gameState: GameState,
  dispatch: React.Dispatch<AppAction>,
  addMessage: AddMessageFn,
): Promise<boolean> {
  if (!isWatchRole(npcRole)) return false;
  const wanted = isWantedInTown(gameState.notoriety?.knownCrimes, gameState.currentLocationId);
  if (!wanted) return false;

  addMessage(
    `${npcName} levels a spear at you. "You're wanted. Surrender or fall." There is no talking your way out now.`,
    'system',
  );
  dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
  // When the player is walking a generated GroundWorld, ask that live world to
  // supply the exact terrain and controlling regiment. Current crimes and all
  // generated-state standings cross the boundary as evidence; the provider
  // selects only the relation matching this confrontation.
  const sourceEncounter = await prepareActiveGroundSettlementEncounter({
    trigger: {
      kind: 'watch-confrontation',
      source: 'player-interaction',
      sourceId: `talk:${npcName}`,
      locationId: gameState.currentLocationId,
      summary: `${npcName} identifies the wanted party and moves to arrest them.`,
    },
    knownCrimes: gameState.notoriety?.knownCrimes ?? [],
    playerFactionStandings: gameState.playerFactionStandings ?? {},
  });

  if (sourceEncounter.status === 'ready') {
    await handleStartBattleMapEncounter(dispatch, sourceEncounter.payload);
    return true;
  }

  // Static authored towns and non-3D interactions have no GroundWorld provider.
  // Enter the explicit inert source-gap state without creating generic guards:
  // a roster is not a location, and displaying one would still counterfeit a
  // production encounter before this town has a canonical WorldForge mapping.
  if (sourceEncounter.status === 'unavailable' || sourceEncounter.status === 'not-applicable') {
    await handleStartBattleMapEncounter(dispatch, {
      monsters: [],
      sourceGap: createAuthoredTownWatchSourceGap(
        gameState.currentLocationId,
        npcName,
      ),
    });
    return true;
  }

  addMessage(
    `The confrontation cannot enter tactical combat: ${sourceEncounter.detail}`,
    'system',
  );
  return true;
}

interface BanterContext {
    locationName: string;
    weather: string;
    timeOfDay: string;
    currentTask?: string;
    /** Recent town history from the living-world sim (chronicleForLocation). */
    townChronicle?: string[];
}

interface HandleTalkProps {
  action: Action;
  gameState: GameState;
  dispatch: React.Dispatch<AppAction>;
  addMessage: AddMessageFn;
  addGeminiLog: AddGeminiLogFn;
  playPcmAudio: PlayPcmAudioFn;
  playerContext: string;
  generalActionContext: string;
}

// ============================================================================
// Conversation Target And Quest Offer Helpers
// ============================================================================
// This section keeps NPC talk routing local to this handler. The quest helper is
// intentionally narrow: dialogue can offer a quest by id, and this handler
// resolves that id through the existing quest registry before using the current
// ACCEPT_QUEST reducer contract.
// ============================================================================

function getConversationTarget(action: Action, gameState: GameState): string | null {
    const directTargetId = ('targetId' in action ? (action as { targetId?: string }).targetId : undefined);
    const payloadTargetId = (action.payload as { targetNpcId?: string } | undefined)?.targetNpcId;

    if (directTargetId) return directTargetId;
    if (payloadTargetId) return payloadTargetId;
    if (typeof action.label === 'string') {
        const labelTargetMatch = action.label.match(/^talk to (.+)$/i);
        if (labelTargetMatch) {
            const normalizedLabel = labelTargetMatch[1].trim().toLowerCase();
            const companionByLabel = Object.entries(gameState.companions).find(([, companion]) =>
                companion.identity.name.toLowerCase() === normalizedLabel
            );
            if (companionByLabel) return companionByLabel[0];
        }
    }
    return null;
}

function getDialogueQuestOffer(action: Action): QuestOffer | undefined {
    // Dialogue outcomes only need to carry the quest id. The full quest object
    // stays source-backed in src/data/quests so this bridge does not create a
    // parallel quest schema inside NPC action payloads.
    return (action.payload as { questOffer?: QuestOffer } | undefined)?.questOffer;
}

function acceptDialogueQuestOffer(
    offer: QuestOffer | undefined,
    gameState: GameState,
    dispatch: React.Dispatch<AppAction>
): void {
    // If there is no offer, preserve the existing dialogue-only NPC behavior.
    if (!offer) return;

    const quest = INITIAL_QUESTS[offer.questId];
    const alreadyKnownQuest = gameState.questLog.some(existingQuest => existingQuest.id === offer.questId);

    // Missing or duplicate offers should not interrupt ordinary NPC dialogue.
    // The reducer also blocks duplicates, but skipping here avoids noisy
    // dispatches from repeated dialogue outcomes.
    if (!quest || alreadyKnownQuest) return;

    dispatch({ type: 'ACCEPT_QUEST', payload: quest });
}

// ============================================================================
// Recruit Offer Helpers ("Invite to party" dialogue outcome)
// ============================================================================
// Mirrors the quest-offer bridge above: a dialogue outcome can carry a minimal
// "invite to party" offer naming the target NPC, and this handler runs the
// shared recruit pipeline — consent gate (P5) -> NPC->member converter (P4) ->
// RECRUIT_COMPANION reducer (P3) — without duplicating any of that logic here.
// The NPC consents (or declines) via evaluateRecruitOffer; on yes we convert and
// dispatch, on no we surface the refusal reason as a system message.
// ============================================================================

/**
 * Minimal dialogue-to-recruit handoff payload. Like {@link QuestOffer}, the
 * dialogue layer only names the NPC it is inviting (and may flag an auto-accept
 * for narrative join moments, e.g. a grateful rescuee). The target NPC is
 * resolved against the runtime registries before the recruit pipeline runs, so
 * NPC payloads never carry a full character/companion blob.
 */
interface RecruitOffer {
    /** Id of the NPC being invited to join the party. */
    targetNpcId: string;
    /**
     * When true, bypass the disposition/relationship consent gate (passed through
     * to {@link evaluateRecruitOffer}). Reserved for scripted join moments; ordinary
     * dialogue invites leave this unset so consent is genuinely evaluated.
     */
    autoAccept?: boolean;
}

function getRecruitOffer(action: Action): RecruitOffer | undefined {
    // The recruitOffer field is not declared on the static `talk` payload union,
    // so we read it defensively the same way getDialogueQuestOffer reads the
    // quest offer — dialogue topics opt in by attaching it.
    return (action.payload as { recruitOffer?: RecruitOffer } | undefined)?.recruitOffer;
}

/**
 * Run the "Invite to party" outcome for a dialogue offer.
 *
 * Resolves the target NPC, asks {@link evaluateRecruitOffer} whether they will
 * join, and on consent converts them to a party member and dispatches
 * `RECRUIT_COMPANION`. Authored companions that already live in
 * `state.companions` (Kaelen/Elara) are promoted via {@link promoteCompanionToMember}
 * so their relationship history persists; freshly-met world NPCs go through the
 * {@link npcToPartyMember} converter. A decline (or already-in-party) posts the
 * NPC's own reason and dispatches nothing.
 */
function handleRecruitOffer(
    offer: RecruitOffer | undefined,
    gameState: GameState,
    dispatch: React.Dispatch<AppAction>,
    addMessage: AddMessageFn
): void {
    // No offer ⇒ ordinary dialogue, no recruit side effects (mirrors quest path).
    if (!offer) return;

    const targetId = offer.targetNpcId;
    if (!targetId) return;

    // An already-met authored companion: promote the existing record so loyalty
    // and relationship history carry over ("met -> joined"). Skip if already
    // travelling with the party.
    const existingCompanion = gameState.companions?.[targetId];
    if (existingCompanion) {
        const verdict = evaluateRecruitOffer(
            { id: targetId, name: existingCompanion.identity.name },
            gameState,
            { autoAccept: offer.autoAccept }
        );

        if (!verdict.willJoin) {
            if (!isInParty(existingCompanion)) {
                // A refusal is part of this person's shared history, without
                // granting trust or changing the consent decision itself.
                dispatch({ type: 'ADD_COMPANION_MEMORY', payload: { companionId: targetId, memory: {
                    id: generateId(), type: 'event', timestamp: gameState.gameTime.getTime(),
                    text: verdict.reason, tags: ['recruitment', 'refused'], importance: 7,
                } } });
            }
            addMessage(verdict.reason, 'system');
            return;
        }

        if (isInParty(existingCompanion)) {
            addMessage(`${existingCompanion.identity.name} is already travelling with you.`, 'system');
            return;
        }

        dispatch({ type: 'RECRUIT_COMPANION', payload: promoteCompanionToMember(existingCompanion) });
        addMessage(verdict.reason, 'system');
        return;
    }

    // Otherwise resolve a world/generated NPC and convert it. Only generated
    // NPCs carry the full RichNPC stats/biography the converter needs.
    const richNpc = gameState.generatedNpcs?.[targetId] as RichNPC | undefined;
    if (!richNpc) {
        addMessage(`There is no one named ${targetId} to invite to your party.`, 'system');
        return;
    }

    const verdict = evaluateRecruitOffer(richNpc, gameState, { autoAccept: offer.autoAccept });
    if (!verdict.willJoin) {
        addMessage(verdict.reason, 'system');
        return;
    }

    dispatch({ type: 'RECRUIT_COMPANION', payload: npcToPartyMember(richNpc, 'dialogue') });
    addMessage(verdict.reason, 'system');
}

function buildConversationContext(state: GameState): BanterContext {
    const locId = state.currentLocationId;
    const locName = state.dynamicLocations?.[locId]?.name || locId;
    const weather = getWeatherSummary(state.environment);
    // G5: day-part word from the character's local in-world clock (the HUD
    // clock, UTC-rendered) — never host-machine getHours().
    const timeOfDay = getDayPartLabel(new Date(state.gameTime));

    // WHAT CHANGED: Normalized dual-status checks for mixed save/runtime schemas.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activeQuest = state.questLog.find((q: any) => q.status === 'Active' || q.status === 'active');

    return {
        locationName: locName,
        weather,
        timeOfDay,
        currentTask: activeQuest?.title,
        townChronicle: townChronicleForLocation({
            // GRID-RETIRE: BA-2 — prefer the canonical cell.
            cellId: state.playerCell?.cellId ?? null,
            currentLocationId: state.currentLocationId,
            worldSeed: state.worldSeed,
            townSim: state.townSim,
            gameTime: state.gameTime,
        }),
    };
}

async function withGreetingDeadline<T>(request: Promise<T>, waitMs: number): Promise<T | null> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            request,
            new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), waitMs); }),
        ]);
    } finally {
        if (timer !== undefined) clearTimeout(timer);
    }
}

function getCompanionConversationMessage(companion: Companion, wasMet: boolean, state: GameState): string {
    const worldSeed = state.worldSeed;
    // A played shared arrival is the present conversation, not another introduction.
    // Original meeting facts remain saved without being repeated on every greeting.
    const journey = sharedJourneyRecall(companion, worldSeed, state.currentLocationId,
        state.party?.find(person => person.id === companion.id)?.conditions?.includes('exhaustion'));
    if (journey) return journey;
    // Authored public information makes the first meeting useful even offline.
    // Secret ambitions never enter this line or the optional model context.
    const goal = companion.goals?.find(goal => !goal.isSecret && goal.status === 'active');
    const aim = goal ? goal.description.charAt(0).toLowerCase() + goal.description.slice(1) : null;
    const invitationRecall = companion.memories?.some(memory => memory.tags.includes('recruitment') && memory.tags.includes('refused'))
        ? ' "I remember your invitation to travel together."' : '';
    const preparationMemory = preparationMeetingRecall(companion);
    const preparationRecall = preparationMemory ? ` "${preparationMemory}"` : '';
    const rumorMemory = companionRumorRecall(companion, worldSeed);
    const rumorRecall = rumorMemory ? ` "${rumorMemory}"` : '';
    const activityLine = companionActivityMeetingLine(companion, worldSeed);
    if (wasMet) {
        return `${companion.identity.name} recognizes you. ${aim
            ? `"I'm still working to ${aim}.${activityLine}"` : `"What is on your mind?${activityLine}"`}${invitationRecall}${preparationRecall}${rumorRecall}`;
    }
    return `"I'm ${companion.identity.name}${companion.identity.class ? `, a ${companion.identity.class.toLowerCase()}` : ''}.` +
        `${aim ? ` My aim is to ${aim}.` : ''}${activityLine}"`;
}

export async function handleStartDialogue({
  action,
  gameState,
  dispatch,
  addMessage
}: HandleTalkProps): Promise<void> {
  const { npcId } = (action.payload as { npcId?: string } | undefined) || {};
  if (!npcId) return;
  const contactError=companionActivityContactError(gameState,npcId);
  if(contactError){addMessage(contactError,'system');return;}

  // Check if NPC exists in static or generated registries
  let npc = NPCS[npcId] || gameState.generatedNpcs?.[npcId];

  // If not found, and ID looks like an ambient one (or we treat unknown as generative opportunity)
  if (!npc) {
    addMessage("Approaching a villager...", "system");

    // Generate new NPC
    const config: NPCGenerationConfig = {
      id: npcId,
      role: 'civilian',
      // In future, pull town wealth/biome from gameState to influence race/clothing
    };

    const generatedNpc = generateNPC(config);
    npc = generatedNpc;

    // Register them permanently
    dispatch({ type: 'REGISTER_GENERATED_NPC', payload: { npc: generatedNpc } });

    addMessage(`You greet ${generatedNpc.name}, a ${generatedNpc.biography.age}-year-old ${generatedNpc.biography.classId}.`, "system");
  }

  // Town arrival registers residents before the player speaks to them. First
  // contact belongs to the meeting, not NPC creation, so those residents and
  // authored NPCs must remember this entry path too. Repeat visits preserve the
  // original meeting fact while updating the last time we spoke.
  // Capture familiarity before first-contact recording. Reading the newly added
  // fact in the UI would incorrectly turn this first meeting into a reunion.
  // An exact-life delivered conversation remains a prior meeting after a venue
  // packet changes. Keep its old record; do not copy facts or award trust.
  const hadDirectMeeting = hasDirectPlayerMeeting(gameState.npcMemory?.[npc.id]?.knownFacts)
    || latestSpokenDialogueReplies(gameState,npc.id,1).length>0;
  if (!hadDirectMeeting) {
    // Add "Met" fact immediately so they remember you. Routed through the
    // action-memory matrix so first contact carries the same id, strength,
    // lifespan and provenance rules as every other remembered act.
    buildActionMemoryDispatches({
      actionType: 'met',
      observerNpcId: npc.id,
      gameDay: getGameDay(gameState.gameTime),
      timestamp: gameState.gameTime.getTime(),
      detail: 'the adventurer',
    }).forEach(memoryAction => dispatch(memoryAction));
  }
  if (!gameState.metNpcIds.includes(npc.id)) dispatch({ type: 'ADD_MET_NPC', payload: { npcId: npc.id } });

  dispatch({
    type: 'UPDATE_NPC_INTERACTION_TIMESTAMP',
    payload: { npcId: npc.id, timestamp: gameState.gameTime.getTime() },
  });

  // Now dispatch the actual session start with the guaranteed valid ID
  dispatch({ type: 'START_DIALOGUE_SESSION', payload: { npcId, contactStatus: hadDirectMeeting ? 'returning' : 'first-meeting' } });
}

export async function handleTalk({
  action,
  gameState,
  dispatch,
  addMessage,
  addGeminiLog,
  playPcmAudio,
  playerContext,
  generalActionContext,
}: HandleTalkProps): Promise<void> {
  const targetId = getConversationTarget(action, gameState);

  if (!targetId) {
    addMessage("Invalid talk target.", "system");
    return;
  }

  const contactError=companionActivityContactError(gameState,targetId);
  if(contactError){addMessage(contactError,'system');return;}

  // An "Invite to party" dialogue outcome can ride on any talk action. Process it
  // once, up front, so the recruit pipeline runs regardless of which talk branch
  // (companion / static NPC / generated NPC) the target resolves into. It is a
  // side effect — like the quest handoff — so the normal dialogue still proceeds.
  handleRecruitOffer(getRecruitOffer(action), gameState, dispatch, addMessage);

  const companion = gameState.companions[targetId];
  if (companion) {
    if (gameState.activeConversation) {
      addMessage('You are already in a conversation.', 'system');
      return;
    }

    if (gameState.activeDialogueSession) {
      dispatch({ type: 'END_DIALOGUE_SESSION' });
    }

    // Opening a companion conversation is a real meeting, even when the model
    // is unavailable. Use the existing NPC memory owner and saved game clock;
    // repeated greetings touch recency without inventing another first meeting.
    const wasMet = gameState.metNpcIds.includes(targetId);
    if (!hasDirectPlayerMeeting(gameState.npcMemory?.[targetId]?.knownFacts)) {
      buildActionMemoryDispatches({
        actionType: 'met', observerNpcId: targetId,
        gameDay: getGameDay(gameState.gameTime), timestamp: gameState.gameTime.getTime(),
        detail: playerContext,
      }).forEach(memoryAction => dispatch(memoryAction));
    }
    if (!wasMet) dispatch({ type: 'ADD_MET_NPC', payload: { npcId: targetId } });
    dispatch({ type: 'UPDATE_NPC_INTERACTION_TIMESTAMP', payload: {
      npcId: targetId, timestamp: gameState.gameTime.getTime(),
    } });

    dispatch({ type: 'SET_CONVERSATION_PENDING', payload: true });
    dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });

    const context = buildConversationContext(gameState);
    const participant = {
      id: targetId,
      name: companion.identity.name,
      race: companion.identity.race,
      class: companion.identity.class,
      sex: companion.identity.sex,
      age: companion.identity.age,
      physicalDescription: companion.identity.physicalDescription,
      personality: `Values: ${companion.personality.values.join(', ')}. Quirks: ${companion.personality.quirks.join(', ')}. ` +
        `Public ambitions: ${(companion.goals ?? []).filter(goal => !goal.isSecret && goal.status === 'active').map(goal => goal.description).join('; ') || 'not disclosed'}. ` +
        `Remembered preparations: ${preparationMeetingRecall(companion) || 'none disclosed'}. ` +
        `Remembered player-shared accounts: ${companionRumorRecall(companion, gameState.worldSeed) || 'none disclosed'}. ` +
        'Treat shared accounts as hearsay. Do not invent local people, destinations, past meetings or promises. Do not claim consent to travel.'
    };

    let initialMessage: ConversationMessage = {
      id: generateId(),
      speakerId: targetId,
      text: getCompanionConversationMessage(companion, wasMet, gameState),
      timestamp: Date.now(),
    };

    try {
        // Availability discovery can itself stall when the local proxy is down.
        // Bound both optional waits below the action watchdog. A late result has
        // no writer attached, so it cannot reopen or overwrite a later meeting.
        const available = await withGreetingDeadline(OllamaService.isAvailable(), 1500);
        const result = available ? await withGreetingDeadline(OllamaService.continueConversation(
            [participant],
            [],
            context
        ), 8000) : null;

        if (result?.metadata) {
            addGeminiLog(
                'continueConversation',
                result.metadata.prompt,
                result.metadata.response || ''
            );
        }

        if (result?.success && result.data) {
            initialMessage = {
                ...initialMessage,
                speakerId: result.data.speakerId,
                text: result.data.text,
                emotion: result.data.emotion,
            };
        }
    } catch {
        // Keep fallback message on any model/path failure.
    } finally {
        dispatch({ type: 'SET_CONVERSATION_PENDING', payload: false });
    }

    // Retain only public ambitions actually spoken in this greeting. Merely
    // owning the authored companion data must never reveal a secret objective.
    for (const goal of companion.goals ?? []) {
      const factId = targetId + ':public-goal:' + goal.id;
      if (goal.isSecret || goal.status !== 'active'
        || !initialMessage.text.toLowerCase().includes(goal.description.toLowerCase())
        || companion.discoveredFacts?.some(fact => fact.id === factId || fact.fact === goal.description)) continue;
      dispatch({ type: 'ADD_DISCOVERED_FACT', payload: { companionId: targetId, fact: {
        id: factId, category: 'other', fact: goal.description,
        discoveredAt: gameState.gameTime.getTime(), source: 'conversation',
      } } });
    }

    dispatch({
        type: 'START_CONVERSATION',
        payload: {
            companionIds: [targetId],
            initialMessage,
        },
    });

    return;
  }

  const npc = NPCS[targetId];
  if (npc) {
    // Guard confrontation: a wanted player cannot talk their way past the watch.
    if (await tryWatchConfrontation(npc.role, npc.name, gameState, dispatch, addMessage)) {
      return;
    }

    // Add NPC to met list on first successful interaction
    if (!hasDirectPlayerMeeting(gameState.npcMemory?.[npc.id]?.knownFacts)) {
      buildActionMemoryDispatches({
        actionType: 'met',
        observerNpcId: npc.id,
        gameDay: getGameDay(gameState.gameTime),
        timestamp: gameState.gameTime.getTime(),
        detail: playerContext,
      }).forEach(memoryAction => dispatch(memoryAction));
    }
    if (!gameState.metNpcIds.includes(npc.id)) dispatch({ type: 'ADD_MET_NPC', payload: { npcId: npc.id } });

    // 1. Retrieve NPC memory from gameState
    const memory = gameState.npcMemory[npc.id];
    if (!memory) {
      addMessage(`Error: Could not retrieve memory for ${npc.name}.`, "system");
      return;
    }

    // NPC lives (2026-11-02): the NPC's stance toward the player comes from its
    // disposition, the talk it heard about the player, a crime the player is
    // wanted for here, and its own sim mood. At the lowest stance the NPC turns
    // away and no conversation opens; otherwise the stance sets the greeting tone.
    const reaction = npcGreetingStance(gameState, npc.id);
    if (reaction.refuses) {
      addMessage(npcShunMessage(npc.name, gameState), 'system');
      return;
    }


    // START DIALOGUE SESSION
    // Instead of immediately generating a generic response, we now open the Dialogue Interface.
    // The "Greeting" will be generated dynamically by the Interface or service if needed,
    // or we can generate a preliminary one here.

    // For now, let's keep the initial "Greeting" generation to seed the conversation window with text.

    // 2. Construct the full prompt
    // We no longer manually build the memory string here; we pass the memory object to geminiService.
    const isFollowUp = npc.id === gameState.lastInteractedNpcId;
    let fullPrompt: string;
    if (isFollowUp) {
      fullPrompt = `Player interacts again. Your previous response was: "${gameState.lastNpcResponse || 'None'}".`;
    } else {
      fullPrompt = `Player (${playerContext}) approaches and wants to talk. General context: ${generalActionContext}.`;
    }

    // Add active goals to the prompt since memoryUtils doesn't handle goals yet
    const activeGoals = memory.goals?.filter(g => g.status === GoalStatus.Active);
    if (activeGoals && activeGoals.length > 0) {
      fullPrompt += `\nMy Current Goals: ["${activeGoals.map(g => g.description).join('", "')}"]`;
    }

    // Living-world sim: let townsfolk reference their own town's recent history.
    const townHistory = townChronicleForLocation({
      cellId: gameState.playerCell?.cellId ?? null,
      currentLocationId: gameState.currentLocationId,
      worldSeed: gameState.worldSeed,
      townSim: gameState.townSim,
      gameTime: gameState.gameTime,
    });
    if (townHistory.length > 0) {
      fullPrompt += `\nRecent happenings in this town (you may reference them naturally): ${townHistory.join(' ')}`;
    }
    fullPrompt += `\nYour attitude: ${npcGreetingPromptLine(gameState, npc.id)}`;

    // Post-combat acknowledgment: if a fight just broke out here (the opening
    // strangers were beaten), the NPC should react to the aftermath — not greet
    // the player as if nothing happened. This is the same generation path the
    // opening used, now given fight-aware context instead of a replayed line.
    if ((gameState.defeatedNpcIds?.length ?? 0) > 0) {
      fullPrompt += `\nA fight just ended moments ago right here — the aftermath is fresh. React to that (wary, shaken, or curious), do NOT ignore it.`;
    }

    fullPrompt += `\n\nYour EXTREMELY BRIEF response (1-2 sentences MAX):`;

    // 3. Call the refactored geminiService function
    const npcMemoryContext = JSON.stringify(memory);
    const npcResponseResult = await OllamaTextService.generateNPCResponse(
      npc.name,
      fullPrompt,
      npcMemoryContext
    );

    const promptSent = npcResponseResult.data?.promptSent || npcResponseResult.metadata?.promptSent || 'Unknown prompt';
    const rawResponse = npcResponseResult.data?.rawResponse || npcResponseResult.metadata?.rawResponse || npcResponseResult.error || 'No response';

    addGeminiLog('generateNPCResponse', promptSent, rawResponse);

    if (npcResponseResult.data?.rateLimitHit || npcResponseResult.metadata?.rateLimitHit) {
      dispatch({ type: 'SET_RATE_LIMIT_ERROR_FLAG' });
    }

    if (npcResponseResult.data?.text) {
      const responseText = npcResponseResult.data.text;
      addMessage(`${npc.name}: "${responseText}"`, 'npc');

      // [Linker] Ensure entities mentioned by NPC exist
      await resolveAndRegisterEntities(responseText, gameState, dispatch, addGeminiLog);

      dispatch({ type: 'SET_LAST_NPC_INTERACTION', payload: { npcId: npc.id, response: responseText } });

      dispatch({ type: 'UPDATE_NPC_INTERACTION_TIMESTAMP', payload: { npcId: npc.id, timestamp: gameState.gameTime.getTime() } });
      dispatch({ type: 'UPDATE_NPC_DISPOSITION', payload: { npcId: npc.id, amount: 1 } });

      // Dispatch START_DIALOGUE_SESSION to open the UI
      dispatch({ type: 'START_DIALOGUE_SESSION', payload: { npcId: npc.id } });

      // Dialogue topics can now hand off a minimal quest offer after the NPC
      // response succeeds. Ordinary NPC talks have no offer, so they keep the
      // same session-opening behavior without quest side effects.
      acceptDialogueQuestOffer(getDialogueQuestOffer(action), gameState, dispatch);

      try {
        const ttsResult = await synthesizeSpeech(responseText, npc.voice?.name || 'Kore', gameState.devModelOverride);
        if (ttsResult.rateLimitHit) {
          dispatch({ type: 'SET_RATE_LIMIT_ERROR_FLAG' });
        }
        if (ttsResult.audioData) {
          await playPcmAudio(ttsResult.audioData);
        } else if (ttsResult.error) {
          throw ttsResult.error;
        }
      } catch (err) {
        // TTS is a nice-to-have: never leak its failures into the game log.
        console.warn(`[TTS] Could not synthesize speech for ${npc.name}:`, err);
      }
    } else {
      addMessage(`${npc.name} seems unresponsive or an error occurred.`, 'system');
      dispatch({ type: 'RESET_NPC_INTERACTION_CONTEXT' });
    }
  } else if (gameState.generatedNpcs?.[targetId]) {
    // Situation/town-generated strangers live in `generatedNpcs`, not the static
    // NPCS registry. Route them through the same dialogue session the town path
    // uses (handleStartDialogue / DialogueInterface both resolve generatedNpcs)
    // so a fresh player can actually talk to the people the opening placed —
    // instead of hitting the "no one named X" dead-end below.
    const generated = gameState.generatedNpcs[targetId];

    // Post-combat gate: a stranger the party has already BEATEN in combat (e.g. a
    // hostile opening guard put down in the fight they started) does not cheerfully
    // replay their pre-fight threat line. Give an honest flavor line and stop —
    // never re-open the seeded conversation. END_BATTLE records the defeat.
    if (gameState.defeatedNpcIds?.includes(generated.id)) {
      addMessage(`${generated.name} is in no state to talk.`, 'system');
      dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
      return;
    }

    // Guard confrontation: a wanted player who approaches a (still-standing)
    // watch NPC is arrested into combat rather than given a conversation.
    if (await tryWatchConfrontation(
      (generated as { role?: string }).role,
      generated.name,
      gameState,
      dispatch,
      addMessage,
    )) {
      return;
    }

    // The Town Plan and body Talk route enters here. Familiarity belongs to
    // this person's prior direct memory, not a pre-registered town roster ID.
    const hadDirectMeeting = hasDirectPlayerMeeting(gameState.npcMemory?.[generated.id]?.knownFacts)
      || latestSpokenDialogueReplies(gameState,generated.id,1).length>0;
    if (!hadDirectMeeting) {
      buildActionMemoryDispatches({
        actionType: 'met',
        observerNpcId: generated.id,
        gameDay: getGameDay(gameState.gameTime),
        timestamp: gameState.gameTime.getTime(),
        detail: playerContext,
      }).forEach(memoryAction => dispatch(memoryAction));
    }
    if (!gameState.metNpcIds.includes(generated.id)) dispatch({ type: 'ADD_MET_NPC', payload: { npcId: generated.id } });

    dispatch({ type: 'UPDATE_NPC_INTERACTION_TIMESTAMP', payload: { npcId: generated.id, timestamp: gameState.gameTime.getTime() } });
    dispatch({ type: 'START_DIALOGUE_SESSION', payload: { npcId: generated.id, contactStatus: hadDirectMeeting ? 'returning' : 'first-meeting' } });
  } else {
    addMessage(`There is no one named ${targetId} to talk to here.`, 'system');
    dispatch({ type: 'RESET_NPC_INTERACTION_CONTEXT' });
  }
  dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
}
