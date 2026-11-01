/** Keep public work offers, accepted promises, refusals and reports distinct.
 * Quest lifecycle/journal writes use the existing quest owner. Exact companion
 * memories record only deliberate spoken choices; repetition earns no trust. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 22:39:44
 * Dependents: state/reducers/companionReducer.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {GameState} from '@/types/state';
import {QuestStatus, type Quest} from '@/types/quests';
import type {CompanionGoalWorkChoice, CompanionMemory} from '@/types/companions';
import {companionTempleWork, templeAccountQuest, firsthandTempleAccount} from '@/systems/companions/companionGoalWork';
import {RelationshipManager} from '@/systems/companions/RelationshipManager';
import {appendQuestJournalEvent, createQuestJournalEvent} from '@/systems/quests/questJournal';
import {generateId} from '@/utils/core/idGenerator';
import {questReducer} from './questReducer';

export function applyCompanionGoalWorkChoice(state: GameState, companionId: string, choice: CompanionGoalWorkChoice): Partial<GameState> {
  const conversation=state.activeConversation;
  if (!conversation || conversation.pendingResponse || !conversation.isPlayerTurn) return {};
  const work=companionTempleWork(state,companionId);
  if (!work) return {};
  const now=state.gameTime.getTime(),traveler=state.party[0]?.name??'The traveler';
  let companion=work.companion,patch:Partial<GameState>={},words='',reply='',event:string|undefined,memoryText='';
  const current=work.quest;
  const offer=() => `Find the temple's entrance near ${work.source.nearbyBurgName} and bring me a firsthand account. I need to know what you actually find. The restoration is a larger undertaking.`;
  if ((choice==='ask' || choice==='accept') && (companion.relationships.player?.approval ?? 0) < -100) {
    // Hearing an offer of help does not oblige her to rely on a distrusted
    // person's word. This is separate from the stricter travel-consent gate.
    words=choice==='ask'?'Could I help with your temple?':'I would promise you a firsthand report.';
    reply='I am not willing to rely on your word for this. My restoration work will continue, but I will make other arrangements.';
    if (!companion.memories.some(memory=>memory.tags.includes(work.questId)&&memory.tags.includes('refused-promise'))) {
      event='refused-promise';memoryText=`I refused to rely on ${traveler}'s proposed scouting promise because I do not trust their word.`;
    }
  } else if (choice==='ask' && (!current || current.status===QuestStatus.Abandoned)) {
    const offered=templeAccountQuest(state,work);
    if (current) { offered.notes=[current.notes,'You asked to discuss this work again after withdrawing your earlier promise.'].filter(Boolean).join('\n'); offered.objectives=current.objectives.map(objective=>({...objective})); }
    patch=questReducer(state,{type:'OFFER_QUEST',payload:offered});
    words=current?'Is there still something I could do for your temple?':'How could I help with your temple?';reply=offer();event='offered';
    memoryText=`I offered ${traveler} the work of finding my temple's entrance and returning with a firsthand account. They have not accepted this offer.`;
  } else if (choice==='accept' && current?.status===QuestStatus.Available) {
    patch=questReducer(state,{type:'ACCEPT_QUEST',payload:current});
    patch.questLog=patch.questLog?.map(quest=>quest.id===current.id?{...quest,companionWork:{...quest.companionWork!,response:'pending'},notes:current.notes?`${current.notes}\nYou have now accepted the work and made a scouting promise.`:undefined}:quest);
    words='I will find the entrance and return with what I actually observe.';reply='Then I will count on your report. Do not promise me that the way inside is safe before you have seen it.';event='promised';
    memoryText=`${traveler} promised to find the ${work.source.name}'s entrance and return with a firsthand account. This promise remains unresolved.`;
  } else if (choice==='decline' && current?.status===QuestStatus.Available && current.companionWork?.response!=='declined') {
    const declined={...current,notes:'You declined this offer. You have made no promise.',companionWork:{...current.companionWork!,response:'declined' as const}};
    patch={questLog:state.questLog.map(quest=>quest.id===current.id?declined:quest),...appendQuestJournalEvent(state,createQuestJournalEvent(state,{type:'npc_conversation',quest:declined,title:`Offer Declined: ${current.title}`,description:'You told Elara you could not promise a firsthand report.'}))};
    words='I cannot promise you that report.';reply='Then I will not count on one from you. My restoration work remains my own.';event='declined';memoryText=`${traveler} declined my offer to seek a firsthand account. They made no promise.`;
  } else if (choice==='withdraw' && current?.status===QuestStatus.Active) {
    patch=questReducer(state,{type:'ABANDON_QUEST',payload:{questId:current.id,reason:'You told Elara you could not keep your promise to bring a firsthand account.'}});
    companion=RelationshipManager.processApprovalEvent(companion,'player',-3,'Withdrew a promise to bring a firsthand temple account',now);
    words='I cannot keep my promise to bring that report.';reply='I was relying on your word. I will need to make another plan.';event='withdrawn';memoryText=`${traveler} withdrew their promise to bring a firsthand account of my temple's entrance.`;
  } else if (choice==='report' && current?.status===QuestStatus.Active) {
    const account=firsthandTempleAccount(state,work.site);
    if (!account) return {};
    // Complete only this bounded report. The public restoration goal stays
    // unfinished; the source encounter, loot and travel agreement are unchanged.
    const withEvidence:Quest={...current,companionWork:{...current.companionWork!,reportDiscoveryId:account.id}};
    let staged:GameState={...state,questLog:state.questLog.map(quest=>quest.id===current.id?withEvidence:quest)};
    const first=questReducer(staged,{type:'UPDATE_QUEST_OBJECTIVE',payload:{questId:current.id,objectiveId:'find_entrance',isCompleted:true}});
    staged={...staged,...first};
    const second=questReducer(staged,{type:'UPDATE_QUEST_OBJECTIVE',payload:{questId:current.id,objectiveId:'report_to_elara',isCompleted:true}});
    const afterUpdates:GameState={...staged,...second};
    const completion=afterUpdates.questLog.find(quest=>quest.id===current.id)?.status===QuestStatus.Completed ? {} : questReducer(afterUpdates,{type:'COMPLETE_QUEST',payload:{questId:current.id}});
    const finalQuests=completion.questLog??afterUpdates.questLog;
    if (finalQuests.find(quest=>quest.id===current.id)?.status!==QuestStatus.Completed) return {};
    patch={...first,...second,...completion,questLog:finalQuests.map(quest=>quest.id===current.id?{...quest,dateCompleted:now}:quest)};
    companion=RelationshipManager.processApprovalEvent(companion,'player',10,'Kept a promise with a firsthand temple account',now);
    words=`I found the entrance. My recorded account is: ${account.content}`;reply='Thank you for bringing back what you actually observed. I remember your promise and the report you kept it with. We still need to judge the way inside; the temple is not restored.';event='reported';memoryText=`${traveler} kept their promise and reported their recorded discovery ${account.id}: ${account.content} I received their account; I have not inspected or restored the temple myself.`;
  } else if (choice==='recall' && current) {
    words='Where do we stand on your temple work?';
    reply=current.status===QuestStatus.Active?'You promised to find the entrance and return with what you observed. I am still counting on that report.'
      :current.status===QuestStatus.Completed?'I remember your firsthand report and the promise you kept. Restoring the temple is still my goal.'
      :current.status===QuestStatus.Abandoned?'I remember that you withdrew your promise. I am not counting on that report from you.'
      :current.companionWork?.response==='declined'?'You declined my offer. I am not treating it as a promise.':offer();
  } else return {};
  if (event) {
    const memory:CompanionMemory={id:generateId(),type:'event',text:memoryText,timestamp:now,importance:7,tags:['companion-work',work.questId,event]};
    companion={...companion,memories:[...companion.memories,memory]};
  }
  return {...patch,companions:{...state.companions,[companionId]:companion},activeConversation:{...conversation,messages:[...conversation.messages,
    {id:generateId(),speakerId:'player',text:words,timestamp:now,memoryHandled:true},
    {id:generateId(),speakerId:companionId,text:reply,timestamp:now,memoryHandled:true},
  ]}};
}
