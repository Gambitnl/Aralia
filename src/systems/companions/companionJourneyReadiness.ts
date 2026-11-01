/** A shared expedition is consent to a particular person's purpose, not a
 * substitute for friendship. Only Elara's already played public work currently
 * authors such an opportunity. Other companions keep their existing gates. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 07:13:28
 * Dependents: components/ConversationPanel/CompanionTravelChoices.tsx, state/reducers/companionTravelReducer.ts, systems/party/recruitConsent.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {GameState} from '@/types/state';
import {QuestStatus} from '@/types/quests';
import {companionTempleWork,companionWorkAccount} from './companionGoalWork';
import {preparationCompanion,ELARA_PREPARATIONS_QUEST_ID} from './companionPreparations';
import {companionActivityContactError} from './companionWorldActivities';

export function travelConversationCompanion(state:GameState,id:string) {
 const c=state.companions?.[id],conversation=state.activeConversation;
 if(!c||!state.metNpcIds?.includes(id)||!conversation?.participants.includes(id)
  ||companionActivityContactError(state,id))return undefined;
 const present=state.party.some(p=>p.id===id)||state.currentLocationActiveDynamicNpcIds?.includes(id);
 if(!present||c.whereabouts&&c.whereabouts.worldSeed!==state.worldSeed)return undefined;
 return c;
}

export function companionJourneyReadiness(state:GameState,id:string) {
 const c=travelConversationCompanion(state,id);
 if(!c||id!=='elara_vance'||(c.relationships.player?.approval??0)<0)return undefined;
 const work=companionTempleWork(state,id),preparation=preparationCompanion(state);
 const account=work?.quest&&companionWorkAccount(state,work.quest);
 const p=c.whereabouts?.position,feet=state.playerGroundPos;
 // A remembered promise cannot remotely recruit someone or move their source
 // body into the scene. Both people must actually be at this conversation.
 if(!p||!feet||c.whereabouts?.locationId!==state.currentLocationId
  ||![p.xM,p.yM,p.zM,feet.xM,feet.yM,feet.zM].every(Number.isFinite)
  ||Math.hypot(p.xM-feet.xM,p.zM-feet.zM,p.yM-(feet.yM??NaN))>3)return undefined;
 if(!work?.quest||work.quest.status!==QuestStatus.Completed||!account?.id
  ||work.quest.companionWork?.reportDiscoveryId!==account.id
  ||!c.memories.some(m=>m.tags.includes('reported')&&m.tags.includes(work.questId))
  ||preparation?.id!==id||c.questline?.id!==ELARA_PREPARATIONS_QUEST_ID
  ||c.questline.currentStageId!=='supplied'||c.questline.origin?.worldSeed!==state.worldSeed
  ||!c.memories.some(m=>m.tags.includes(ELARA_PREPARATIONS_QUEST_ID)&&m.tags.includes('promise-fulfilled')))return undefined;
 return {companion:c,destination:work.goal.disclosedDestination!,goalId:work.goal.id};
}

export const TEMPLE_INSPECTION_TERMS = [
 'Travel to the Temple of the Morning together to inspect the way inside.',
 'Judge deeper risks together; neither person promises to follow anywhere.',
 'Respect the temple and each person’s right to refuse or leave.',
 'Keep a way back and prepare enough supplies before setting out.',
] as const;

/** Publicly looking for independent work permits a conversation, not a hire.
 * Old saves without that source activity and remote contacts gain no new role. */
export function independentWorkConversation(state:GameState,id:string) {
 const companion=travelConversationCompanion(state,id),activity=companion?.publicActivity;
 if(id!=='kaelen_thorne'||!companion||companion.inParty||state.party.some(person=>person.id===id)
  ||activity?.kind!=='seeking-independent-work'||activity.companionId!==id
  ||activity.worldSeed!==state.worldSeed||activity.locationId!==state.currentLocationId)return undefined;
 const memory=companion.memories.find(memory=>memory.tags.includes('independent-work-discussed')
  &&memory.tags.includes(activity.sourceId)&&memory.tags.includes(`world:${state.worldSeed}`));
 return {companion,activity,memory};
}
