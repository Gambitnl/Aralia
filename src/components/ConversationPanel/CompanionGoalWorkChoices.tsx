/** A person can offer work without assuming the player accepted it. Explicit
 * choices and saved recall keep her own ambition separate from that promise. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 22:39:44
 * Dependents: components/ConversationPanel/ConversationPanel.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React from 'react';
import type {GameState} from '@/types/state';
import {QuestStatus} from '@/types/quests';
import type {AppAction} from '@/state/actionTypes';
import {BTN_BASE,BTN_SECONDARY} from '@/styles/buttonStyles';
import type {CompanionGoalWorkChoice} from '@/types/companions';
import {companionTempleWork,firsthandTempleAccount} from '@/systems/companions/companionGoalWork';

export function CompanionGoalWorkChoices({state,dispatch,disabled}:{state:GameState;dispatch:React.Dispatch<AppAction>;disabled:boolean}) {
  return <>{state.activeConversation?.participants.map(id=>{
    const work=companionTempleWork(state,id);if(!work)return null;
    const quest=work.quest;
    const choices:Array<{choice:CompanionGoalWorkChoice;label:string}>=[];
    if(!quest||quest.status===QuestStatus.Abandoned)choices.push({choice:'ask',label:quest?'Ask whether help is still needed':'Ask how I could help'});
    if(quest?.status===QuestStatus.Available){choices.push({choice:'accept',label:'Promise a firsthand report'});if(quest.companionWork?.response!=='declined')choices.push({choice:'decline',label:'Decline this offer'});}
    if(quest?.status===QuestStatus.Active){if(firsthandTempleAccount(state,work.site))choices.push({choice:'report',label:'Give my firsthand account'});choices.push({choice:'withdraw',label:'Withdraw my scouting promise'});}
    if(quest)choices.push({choice:'recall',label:'Recall our agreement'});
    return <section key={id} aria-label={`Discuss work with ${work.companion.identity.name}`} className="rounded-lg border border-amber-500/30 bg-slate-900 p-3 text-xs text-gray-200">
      <p className="font-semibold text-amber-200">A firsthand account</p>
      <p className="mt-1 text-gray-300">{quest?.status===QuestStatus.Active?'You promised to return with a report.':quest?.status===QuestStatus.Completed?'Your report is remembered. The restoration remains unfinished.':quest?.status===QuestStatus.Abandoned?'You withdrew your promise.':'Discuss a contribution to her restoration work.'}</p>
      <div className="mt-2 flex flex-col gap-2">{choices.map(({choice,label})=><button key={choice} type="button" disabled={disabled} className={`${BTN_BASE} ${BTN_SECONDARY} px-3 py-2 text-left text-xs`}
        onClick={()=>dispatch({type:'COMPANION_GOAL_WORK_CHOICE',payload:{companionId:id,choice}})}>{label}</button>)}</div>
    </section>;
  })}</>;
}
