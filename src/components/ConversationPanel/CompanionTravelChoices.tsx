// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 13:56:06
 * Dependents: components/ConversationPanel/ConversationPanel.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {companionSiteRiskContext} from '@/systems/companions/companionSiteRisk';
/** Invitations are separate from gifts, reports and accepting expedition terms.
 * Every button sends only an identity and choice; latest state decides consent. */

import React from 'react';
import type {GameState} from '@/types/state';
import type {AppAction} from '@/state/actionTypes';
import type {CompanionTravelChoice} from '@/types/companions';
import {travelConversationCompanion,companionJourneyReadiness,independentWorkConversation} from '@/systems/companions/companionJourneyReadiness';
import {sharedJourneyRecall} from '@/systems/companions/companionJourney';

export function CompanionTravelChoices({state,dispatch,disabled}:{state:GameState;dispatch:React.Dispatch<AppAction>;disabled:boolean}){
 return <>{state.activeConversation?.participants.map(id=>{
  const c=travelConversationCompanion(state,id);if(!c)return null;
  const active=state.party.some(p=>p.id===id)||c.inParty,a=c.travelAgreement?.worldSeed===state.worldSeed?c.travelAgreement:undefined;
  const choices:Array<{choice:CompanionTravelChoice;label:string}>=[];
  const work=independentWorkConversation(state,id);
  if(work)choices.push({choice:'discuss_work',label:work.memory?'Recall his work requirements':'Discuss independent paid work'});
  if(!active)choices.push({choice:'invite',label:'Ask to travel together'});
  if(!active&&a?.response==='offered')choices.push({choice:'accept_terms',label:'Agree to the temple inspection terms'},{choice:'decline_terms',label:'Do not make this agreement'});
  else if(!active&&companionJourneyReadiness(state,id))choices.push({choice:'propose_goal',label:'Propose inspecting the temple together'});
  if(companionSiteRiskContext(state,id)){
   choices.push({choice:'discuss_entry',label:'Discuss entering the temple together'});
   if(a?.exploration?.response==='offered')choices.push({choice:'accept_entry_terms',label:'Agree to the entrance-floor inspection'},{choice:'decline_entry_terms',label:'Stay outside for now'});
   if(a?.exploration)choices.push({choice:'recall_entry_terms',label:'Recall our decision about entering'});
  }
  if(a)choices.push({choice:'recall_terms',label:'Recall our travel terms'});
  if(sharedJourneyRecall(c,state.worldSeed,state.currentLocationId))choices.push({choice:'recall_journey',label:'Recall our shared journey'});
  if(!choices.length)return null;
  return <section key={id} aria-label={`Travel with ${c.identity.name}`} className="rounded-lg border border-amber-500/30 bg-slate-900 p-3 text-gray-200">
   <p className="font-semibold text-amber-200">{work?'Working together':'Travel together'}</p>
   {a&&<><p className="mt-2">{a.destinationName} — {a.response==='accepted'?'Agreed expedition':a.response==='declined'?'Terms declined':'Terms offered; no one has joined'}</p><ul className="my-2 list-disc pl-5 text-sm">{a.terms.map(term=><li key={term}>{term}</li>)}</ul></>}
   {a?.exploration&&<div className="my-3 border-t border-amber-500/30 pt-3"><p className="font-semibold">Entrance-floor inspection — {a.exploration.response}</p><ul className="my-2 list-disc pl-5 text-sm">{a.exploration.terms.map(term=><li key={term}>{term}</li>)}</ul>{a.exploration.concerns.map(concern=><p key={concern} className="mt-2 text-amber-200">{concern}</p>)}</div>}
   <div className="mt-2 flex flex-col gap-2">{choices.map(({choice,label})=><button key={choice} type="button" disabled={disabled}
    className="rounded border border-gray-600 bg-gray-800 px-3 py-2 text-left text-gray-100 hover:bg-gray-700 disabled:opacity-50"
    onClick={()=>dispatch({type:'COMPANION_TRAVEL_CHOICE',payload:{companionId:id,choice}})}>{label}</button>)}</div>
  </section>;
 })}</>;
}
