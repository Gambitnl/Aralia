// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 13:56:06
 * Dependents: state/reducers/companionReducer.ts
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {companionSiteRiskContext,companionSiteRiskConcerns,ENTRANCE_SURVEY_TERMS} from '@/systems/companions/companionSiteRisk';
/** Deliberate invitations preserve the person's answer and use the existing
 * consent/promotion pipeline. No caller can pass a prebuilt recruit or force a
 * yes. The companion reducer remains the sole two-store membership owner. */

import type {GameState} from '@/types/state';
import type {CompanionTravelChoice,CompanionMemory,Companion} from '@/types/companions';
import type {RecruitPayload} from '@/systems/party/recruitTypes';
import {evaluateRecruitOffer} from '@/systems/party/recruitConsent';
import {promoteCompanionToMember} from '@/systems/party/npcToPartyMember';
import {travelConversationCompanion,companionJourneyReadiness,independentWorkConversation,TEMPLE_INSPECTION_TERMS} from '@/systems/companions/companionJourneyReadiness';
import {generateId} from '@/utils/core/idGenerator';
import {sharedJourneyRecall} from '@/systems/companions/companionJourney';

export function applyCompanionTravelChoice(state:GameState,id:string,choice:CompanionTravelChoice):{patch:Partial<GameState>;recruit?:RecruitPayload} {
 const original=travelConversationCompanion(state,id),conversation=state.activeConversation;
 if(!original||!conversation?.isPlayerTurn||conversation.pendingResponse)return {patch:{}};
 const now=state.gameTime.getTime(),traveler=state.party[0]?.name??'The traveler';
 let c:Companion={...original},words='',reply='',event:string|undefined,recruit:RecruitPayload|undefined;
 const active=state.party.some(p=>p.id===id)||c.inParty;
 if(choice==='discuss_work'){
  const work=independentWorkConversation(state,id);if(!work)return {patch:{}};
  words=work.memory?'What work requirements did we discuss?':'What sort of paid work are you looking for?';
  reply=(work.memory?'As I said, Chief: paid work. ':'Paid work, Chief. ')+
   'Tell me what needs doing, what it pays, and how we get back before asking me to take a risk. I make my own decisions, and my private affairs stay private. A rumor is something to investigate, not a promise of treasure. I have not accepted a job or agreed to travel with you.';
  // One sourced conversation is remembered. Repeating it cannot manufacture
  // trust, disclose secret goals, transfer wages or accept an unimplemented job.
  if(!work.memory)c={...c,memories:[...c.memories,{id:generateId(),type:'event',timestamp:now,importance:6,
   tags:['independent-work-discussed',work.activity.sourceId,`world:${state.worldSeed}`],
   text:`${traveler} asked what paid work I would consider. I asked for a concrete task, agreed pay and a way back, while retaining my independence. We made no job or travel agreement.`}]};
 }else if(choice==='invite'&&!active){
  const verdict=evaluateRecruitOffer({id,name:c.identity.name},state);
  words='Will you travel with my party?';
  reply=verdict.willJoin?'I trust you. I agree to travel with your party.'
   :companionJourneyReadiness(state,id)
    ?'You kept your promises, and I appreciate that. I am not agreeing to follow your party wherever it goes. I would consider travelling to inspect my temple together, on terms we both agree to.'
    :'I am not ready to commit to travelling with your party.';
  event=verdict.willJoin?'accepted':'refused';
  if(verdict.willJoin)recruit=promoteCompanionToMember(c);
 }else if(choice==='propose_goal'&&!active){
  const ready=companionJourneyReadiness(state,id);if(!ready||c.travelAgreement?.response==='offered')return {patch:{}};
  c.travelAgreement={worldSeed:ready.destination.worldSeed,sourceId:ready.destination.sourceId,goalId:ready.goalId,
   sitePath:ready.destination.sitePath,destinationName:ready.destination.name,offeredAt:now,response:'offered',
   terms:[...TEMPLE_INSPECTION_TERMS]};
  words=`Would you inspect the way into the ${ready.destination.name} with me?`;
  reply='You brought a firsthand account and kept your provision promise. I am willing to travel there with you to inspect the way inside. We judge deeper risks together, respect the temple and keep a way back. My restoration remains my own work. This is not a promise to follow you anywhere. We must prepare enough supplies before setting out. Are those terms acceptable?';
  event='terms-offered';
 }else if(choice==='accept_terms'&&!active){
  const a=c.travelAgreement;if(a?.response!=='offered')return {patch:{}};
  const verdict=evaluateRecruitOffer({id,name:c.identity.name},state,{sharedGoal:{worldSeed:a.worldSeed,goalId:a.goalId,sitePath:a.sitePath}});
  if(!verdict.willJoin)return {patch:{}};
  c.travelAgreement={...a,response:'accepted',respondedAt:now};
  words='I agree to inspect the temple together on those terms.';
  reply=`Then I will travel with you to inspect the ${a.destinationName}, on those terms. My provisions and restoration work remain mine. We should check our supplies and rest before leaving.`;
  event='terms-accepted';recruit=promoteCompanionToMember(c);
 }else if(choice==='decline_terms'&&!active&&c.travelAgreement?.response==='offered'){
  c.travelAgreement={...c.travelAgreement,response:'declined',respondedAt:now};
  words='I will not make that agreement.';reply='Then we have no travel agreement. I remember your help, and my restoration work remains my own.';event='terms-declined';
 }else if(['discuss_entry','accept_entry_terms','decline_entry_terms','recall_entry_terms'].includes(choice)){
  const context=companionSiteRiskContext(state,id);if(!active||!context)return {patch:{}};
  const previous=c.travelAgreement!.exploration,concerns=companionSiteRiskConcerns(state,id);
  if(choice==='recall_entry_terms'){
   if(!previous)return {patch:{}};
   words='What did we decide about going inside?';
   reply=previous.response==='accepted'?'We agreed to inspect the entrance floor for my restoration work and keep our way back. Going down another floor is a separate decision.'
    :previous.response==='offered'?'I offered an entrance-floor inspection on specific terms. You have not accepted them.'
    :previous.concerns.length?'I have not agreed to enter. '+previous.concerns.join(' '):'We decided not to enter together. My restoration work is still unfinished.';
  }else if(choice==='decline_entry_terms'){
   if(previous?.response!=='offered')return {patch:{}};
   c.travelAgreement={...c.travelAgreement!,exploration:{...previous,response:'declined',respondedAt:now}};
   words='Let us not enter on those terms.';reply='Then we stay outside. My restoration work matters to me, but neither of us owes the other a dangerous expedition.';event='entry-terms-declined';
  }else if(choice==='accept_entry_terms'&&previous?.response!=='offered')return {patch:{}};
  else if(concerns.length){
   c.travelAgreement={...c.travelAgreement!,exploration:{response:previous?.response==='accepted'?'withdrawn':'declined',discussedAt:now,respondedAt:now,terms:[...ENTRANCE_SURVEY_TERMS],concerns}};
   words='Shall we inspect the entrance floor together?';reply='Not yet. '+concerns.join(' ')+' I still want to restore this temple. Let us address that before adding another risk.';event='entry-refused';
  }else if(choice==='accept_entry_terms'){
   c.travelAgreement={...c.travelAgreement!,exploration:{...previous!,response:'accepted',respondedAt:now}};
   words='I agree to inspect the entrance floor on those terms.';reply='Then we inspect the entrance floor together for my restoration work. We keep our way back, and either of us can call for retreat. This does not include going down another floor.';event='entry-terms-accepted';
  }else if(previous?.response==='accepted'){
   words='Do you still agree to inspect the entrance floor together?';reply='Yes, on the entrance-floor terms we agreed to. My restoration work remains my own, and either of us can call for retreat.';
  }else{
   c.travelAgreement={...c.travelAgreement!,exploration:{response:'offered',discussedAt:now,terms:[...ENTRANCE_SURVEY_TERMS],concerns:[]}};
   words='Shall we inspect the entrance floor together?';reply='I want a better account for my restoration work, but we do not know what is inside. I would inspect the entrance floor with you and keep our way back. This is an inspection, not a promise of treasure. Either of us can call for retreat. This is not an agreement to descend further. Do you agree?';event='entry-terms-offered';
  }
 }else if(choice==='recall_journey'){

  const recalled=sharedJourneyRecall(c,state.worldSeed,state.currentLocationId,state.party.find(person=>person.id===id)?.conditions?.includes('exhaustion'));
  if(!recalled)return {patch:{}};
  words='What do you make of the journey we just shared?';reply=recalled;
 }else if(choice==='recall_terms'&&c.travelAgreement?.worldSeed===state.worldSeed){
  words='What travel terms did we agree on?';
  reply=c.travelAgreement.response==='accepted'
   ?`We agreed to travel to the ${c.travelAgreement.destinationName} to inspect the way inside, judge deeper risks together and keep a way back. My restoration remains my own work.`
   :c.travelAgreement.response==='declined'?'You declined my proposed terms. We have not agreed to travel together.':'I offered to inspect the temple together, with deeper risks decided together and a way back. You have not accepted those terms.';
 }else return {patch:{}};
 if(event){
  const tags=[event.startsWith('entry-')?'expedition-risk':'recruitment',event,`world:${state.worldSeed}`];
  // Repeating the same refusal is a reminder, not a stream of new memories.
  const memoryText=event==='refused'?reply:`${traveler}: ${words} ${c.identity.name}: ${reply}`;
  const duplicate=(event==='refused'||event==='entry-refused')&&c.memories.some(m=>tags.every(t=>m.tags.includes(t))&&m.text===memoryText);
  if(!duplicate){const memory:CompanionMemory={id:generateId(),type:'event',timestamp:now,importance:7,tags,
   text:memoryText};c={...c,memories:[...c.memories,memory]};}
 }
 if(recruit)recruit={...recruit,companion:{...c,inParty:true}};
 return {recruit,patch:{companions:{...state.companions,[id]:c},activeConversation:{...conversation,messages:[...conversation.messages,
  {id:generateId(),speakerId:'player',text:words,timestamp:now,memoryHandled:true},
  {id:generateId(),speakerId:id,text:reply,timestamp:now,memoryHandled:true}],isPlayerTurn:true,pendingResponse:false}}};
}
