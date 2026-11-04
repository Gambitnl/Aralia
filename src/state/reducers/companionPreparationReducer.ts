/**
 * Applies the player's explicit choices in Elara's preparations conversation.
 * The existing quest reducer owns quest/journal transitions; this boundary keeps
 * the handover, personal belongings, promise memory and modest trust change in
 * one state update. It never recruits anyone or advances temple restoration.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 12:51:04
 * Dependents: state/reducers/companionReducer.ts
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { GameState } from '@/types/state';
import type { CompanionMemory, CompanionPreparationChoice } from '@/types/companions';
import { QuestStatus } from '@/types/quests';
import { getQuestById } from '@/data/quests';
import { generateId } from '@/utils/core/idGenerator';
import { RelationshipManager } from '@/systems/companions/RelationshipManager';
import { preparationCompanion, preparationQuestline, transferPreparationSupplies, hasPreparationSupplies, preparationResupplyRequested, ELARA_PREPARATIONS_QUEST_ID, PREPARATION_OBJECTIVE_ID } from '@/systems/companions/companionPreparations';
import { questReducer } from './questReducer';
import { appendQuestJournalEvent, createQuestJournalEvent } from '@/systems/quests/questJournal';

export function applyCompanionPreparationChoice(state: GameState, companionId: string, choice: CompanionPreparationChoice): Partial<GameState> {
  const original = preparationCompanion(state);
  const conversation = state.activeConversation;
  // Recheck the actual session at commit time. A stale button cannot give goods
  // to an absent person, cross worlds, or interrupt a pending skill/AI action.
  if (!original || original.id !== companionId || !conversation || conversation.pendingResponse || !conversation.isPlayerTurn) return {};
  const now = state.gameTime.getTime();
  const traveler = state.party[0]?.name ?? 'The traveler';
  let companion = { ...original, questline: original.questline ?? preparationQuestline(state) };
  const stage = original.questline?.currentStageId;
  let questPatch: Partial<GameState> = {};
  let inventory = state.inventory;
  let words = '';
  let reply = '';
  let memory: CompanionMemory | undefined;
  const remember = (text: string, event: string): CompanionMemory => ({
    id: generateId(), type: 'event', text, timestamp: now,
    tags: ['preparations', ELARA_PREPARATIONS_QUEST_ID, event], importance: 7,
  });

  if (choice === 'ask' && !original.questline) {
    words = 'How are your preparations going?';
    reply = 'I still need two days of food and water for the road. If you can spare them, they would help me continue my restoration work.';
  } else if (choice === 'promise' && ['offered', 'declined', 'withdrawn'].includes(stage ?? '')) {
    const quest = getQuestById(ELARA_PREPARATIONS_QUEST_ID)!;
    quest.dateStarted = now;
    const priorQuest = state.questLog.find(item => item.id === quest.id);
    if (priorQuest && priorQuest.status !== QuestStatus.Abandoned) return {};
    if (priorQuest) {
      // A withdrawn promise remains in memory. A new offer reopens its one
      // canonical quest rather than duplicating the log or erasing the past.
      questPatch = {
        questLog: state.questLog.map(item => item.id === quest.id ? quest : item),
        ...appendQuestJournalEvent(state, createQuestJournalEvent(state, { type: 'quest_accepted', quest, title: `Promise Renewed: ${quest.title}`, description: 'You renewed your offer to help Elara prepare for the road.' })),
      };
    } else questPatch = questReducer(state, { type: 'ACCEPT_QUEST', payload: quest });
    companion.questline = { ...companion.questline, currentStageId: 'collecting' };
    words = 'I will bring you two rations and two days of water.';
    reply = 'Thank you. I will count on your word. Bring them to me when you are ready.';
    memory = remember(`${traveler} promised to bring me two rations and two water-days for my journey.`, 'promise-open');
  } else if (choice === 'decline' && ['offered', 'declined', 'withdrawn'].includes(stage ?? '')) {
    if (stage === 'declined') return {};
    companion.questline = { ...companion.questline, currentStageId: 'declined' };
    words = 'I cannot commit to that.';
    reply = 'Then I will not count on it. Thank you for being clear with me.';
    memory = remember(`${traveler} declined to promise supplies for my journey.`, 'declined');
  } else if (choice === 'withdraw' && stage === 'collecting') {
    companion.questline = { ...companion.questline, currentStageId: 'withdrawn' };
    questPatch = { questLog: state.questLog.map(quest => quest.id === ELARA_PREPARATIONS_QUEST_ID ? { ...quest, status: QuestStatus.Abandoned, notes: 'You told Elara you could not keep your promise to bring provisions.' } : quest) };
    words = 'I cannot keep my promise about the supplies.';
    reply = 'I was relying on that promise. I will need to make another plan.';
    memory = remember(`${traveler} withdrew their promise to bring me road supplies.`, 'promise-withdrawn');
    companion = { ...RelationshipManager.processApprovalEvent(companion, 'player', -3, 'Withdrew a promise about road supplies', now), questline: companion.questline };
  } else if (choice === 'deliver' && stage === 'collecting') {
    const quest = state.questLog.find(item => item.id === ELARA_PREPARATIONS_QUEST_ID);
    if (quest?.status !== QuestStatus.Active) return {};
    const transfer = transferPreparationSupplies(state.inventory);
    if (!transfer) return {};
    inventory = transfer.remaining;
    companion.inventory = [...(original.inventory ?? []), ...transfer.given];
    companion.questline = { ...companion.questline, currentStageId: 'supplied', stages: {
      ...companion.questline.stages,
      offered: { ...companion.questline.stages.offered, isCompleted: true },
      collecting: { ...companion.questline.stages.collecting, isCompleted: true },
      supplied: { ...companion.questline.stages.supplied, isCompleted: true },
    } };
    companion = { ...RelationshipManager.processApprovalEvent(companion, 'player', 5, 'Kept a promise about road supplies', now), questline: companion.questline };
    questPatch = questReducer({ ...state, inventory }, { type: 'UPDATE_QUEST_OBJECTIVE', payload: { questId: quest.id, objectiveId: PREPARATION_OBJECTIVE_ID, isCompleted: true } });
    questPatch.questLog = questPatch.questLog?.map(item => item.id === quest.id ? { ...item, dateCompleted: now } : item);
    words = 'Here are the two rations and two days of water I promised.';
    reply = 'You kept your word. I have the provisions now, and I will remember your help. The restoration work is still ahead of me.';
    memory = remember(`${traveler} kept their promise and gave me two rations and two water-days. I carry those provisions for my journey.`, 'promise-fulfilled');
  } else if (choice === 'resupply' && stage === 'supplied') {
    // Ask first, then hand over actual stacks. Replenishment is neither a new
    // promise reward nor permission to enter the temple or spend her belongings.
    if (!preparationResupplyRequested(original) || hasPreparationSupplies(original.inventory ?? [])) return {};
    const transfer = transferPreparationSupplies(state.inventory);
    if (!transfer) return {};
    inventory = transfer.remaining;
    companion.inventory = [...(original.inventory ?? []), ...transfer.given];
    words = 'Here are two more rations and two water-days for your journey.';
    reply = 'Thank you. I will carry these for the road. We still need to decide the next risks together.';
    memory = remember(`${traveler} gave me two more rations and two water-days after I asked to replenish my road supplies. These are my provisions; our travel terms remain unchanged.`, 'supplies-replenished');
  } else if (choice === 'recall' && stage === 'supplied') {
    words = 'How are your preparations going?';
    reply = 'I remember the provisions you brought and the promise you kept. Restoring the temple is still my goal.';
    if (!hasPreparationSupplies(original.inventory ?? [])) {
      reply += ' I need to replenish my food and water for the road. Two more rations and two water-days would help, if you can spare them.';
      if (!preparationResupplyRequested(original)) memory = remember(`I asked ${traveler} whether they could spare two more rations and two water-days for my restoration journey. Their earlier promise was kept; this is a new preparation need.`, 'resupply-requested');
    }
  } else return {};

  if (memory) companion.memories = [...original.memories, memory];
  return {
    ...questPatch,
    inventory,
    companions: { ...state.companions, [companion.id]: companion },
    activeConversation: { ...conversation, isPlayerTurn: true, pendingResponse: false, messages: [...conversation.messages,
      { id: generateId(), speakerId: 'player', text: words, timestamp: now, memoryHandled: true },
      { id: generateId(), speakerId: companion.id, text: reply, timestamp: now, memoryHandled: true },
    ] },
  };
}
