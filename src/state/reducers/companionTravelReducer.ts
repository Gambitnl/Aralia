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

import {companionSiteRiskContext,companionSiteRiskConcerns,companionReturnWaterOffer,ENTRANCE_SURVEY_TERMS} from '@/systems/companions/companionSiteRisk';
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
 }else if(['discuss_return_water','accept_return_water','decline_return_water'].includes(choice)){
  const offer=companionReturnWaterOffer(state,id);if(!active||!offer)return {patch:{}};
  const previous=c.travelAgreement!.returnWater;
  if(choice==='accept_return_water'){
   if(previous?.response!=='offered'||offer.reason||previous.amount!==offer.amount||previous.journeyId!==c.journey?.id
    ||previous.fromLocationId!==state.currentLocationId||previous.destinationCellId!==offer.home.cellId||!offer.water)return {patch:{}};
   // The water remains in its actual owner's bag. Only the later, reviewed
   // return may consume this limited surplus; no spare vessel is invented.
   c.travelAgreement={...c.travelAgreement!,returnWater:{...previous,response:'accepted',respondedAt:now}};
   words=`I agree to share up to ${offer.amount} water-days from your supplies on our return to ${offer.home.burgName}.`;
   reply=`Then we may share up to ${offer.amount} water-days from my supplies on that return. I will keep carrying the water until we drink it. We still need to review the route and choose how to ration or forage. This does not change my decision about entering the temple. My restoration remains unfinished.`;event='return-water-accepted';
  }else if(choice==='decline_return_water'){
   if(previous?.response!=='offered')return {patch:{}};
   c.travelAgreement={...c.travelAgreement!,returnWater:{...previous,response:'declined',respondedAt:now}};
   words='Keep your water. I will not accept that offer.';reply='Then the water stays in my bag. We still need a workable way back.';event='return-water-declined';
  }else if(previous?.response==='accepted'&&previous.journeyId===c.journey?.id){
   words='What water did you agree to share?';reply=`We agreed to share up to ${previous.amount} extra water-days from my own bag on the return to ${offer.home.burgName}. The water stays with me until we drink it. My other supplies are mine. We still decide the route risks together.`;
  }else{
   c.travelAgreement={...c.travelAgreement!,returnWater:{response:offer.reason?'declined':'offered',amount:offer.amount,journeyId:c.journey!.id,fromLocationId:state.currentLocationId,destinationCellId:offer.home.cellId,discussedAt:now}};
   words=`Could we share water for the return to ${offer.home.burgName}?`;
   reply=offer.reason??`We should return to ${offer.home.burgName} to resupply before adding another risk here. I can share up to ${offer.amount} extra water-days from my road provisions on that return, keeping at least half a day reserved for myself. I will carry the water until we drink it. This is not a full journey's supply or permission to enter the temple. We must review the route and decide whether to ration or forage. Do you agree to that limited sharing?`;
   event=offer.reason?'return-water-refused':'return-water-offered';
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
  const tags=[event.startsWith('entry-')?'expedition-risk':event.startsWith('return-water-')?'return-provisions':'recruitment',event,`world:${state.worldSeed}`];
  // Repeating the same refusal is a reminder, not a stream of new memories.
  const memoryText=event==='refused'?reply:`${traveler}: ${words} ${c.identity.name}: ${reply}`;
  const duplicate=(event==='refused'||event==='entry-refused'||event==='return-water-refused'||event==='return-water-offered')&&c.memories.some(m=>tags.every(t=>m.tags.includes(t))&&m.text===memoryText);
  if(!duplicate){const memory:CompanionMemory={id:generateId(),type:'event',timestamp:now,importance:7,tags,
   text:memoryText};c={...c,memories:[...c.memories,memory]};}
 }
 if(recruit)recruit={...recruit,companion:{...c,inParty:true}};
 return {recruit,patch:{companions:{...state.companions,[id]:c},activeConversation:{...conversation,messages:[...conversation.messages,
  {id:generateId(),speakerId:'player',text:words,timestamp:now,memoryHandled:true},
  {id:generateId(),speakerId:id,text:reply,timestamp:now,memoryHandled:true}],isPlayerTurn:true,pendingResponse:false}}};
}
