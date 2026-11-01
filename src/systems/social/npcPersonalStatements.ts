/** Factual identity and family words shared by conversation and its memory publisher.
 * Both read the same admitted household life. Unresolved legacy biographies may
 * still be spoken, but cannot become attributed historical testimony. No state is written here. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 16:30:24
 * Dependents: services/dialogueService.ts, systems/social/npcDialogueMemory.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {GameState} from '../../types/state';
import type {RichNPC} from '../../types/world';
import {getGameDay} from '../../utils/core';
import {householdNpcAliveAt,householdFamilyAt,householdInstitutionRole} from '../worldforge/townsim/householdNpc';

export type PersonalStatementTopic = 'global_who_are_you' | 'household_family';
export function resolveNpcPersonalStatement(state: GameState,npcId: string,topicId: PersonalStatementTopic): {text:string;snapshot?:string}|undefined {
  const resident=state.generatedNpcs?.[npcId] as (RichNPC & {worldforgeHousehold?:{burgId:number;memberId:string;legacyNameUnique?:boolean}})|undefined;
  const identity=resident?.worldforgeHousehold;
  const day=getGameDay(state.gameTime);
  if (!resident || !identity || !householdNpcAliveAt(resident,state.townSim,day) || resident.knowledgeProfile?.topicOverrides?.[topicId]) return undefined;
  const family=householdFamilyAt(state.townSim?.[identity.burgId],identity.memberId,resident.name,day,identity.legacyNameUnique);
  if (topicId==='global_who_are_you') {
    const work=resident.occupation?.trim();
    const workLine=!work ? '' : work==='keeps the household' ? ' I keep the household.'
      : work==='helps the household' ? ' I help the household.' : work==='retired' ? " I'm retired."
      : ' I work as '+(/^[aeiou]/i.test(work)?'an':'a')+' '+work+'.';
    const businesses=Object.values(state.worldBusinesses??{}).filter(b=>b.ownerId===resident.id&&b.name?.trim());
    const names=[...new Set(businesses.map(b=>b.name.trim()))];
    const office=householdInstitutionRole(family?.person,day);
    const text="I'm "+resident.name+'.'+workLine+(office?" I serve as the town's "+office+'.':'')+(names.length?' I own '+names.join(' and ')+'.':'');
    return {text,...(family?{snapshot:JSON.stringify({name:resident.name,work:work??null,office:office??null,businesses:businesses.map(b=>[b.id,b.name.trim()])})}:{})};
  }
  if (family) {
    // Snapshot only the admitted account, not unrelated wealth or daily routines.
    const life=(p:typeof family.person)=>[p.occupantId,p.name,p.bornDay,p.diedDay??null];
    return {text:family.reply,snapshot:JSON.stringify({person:life(family.person),relatives:family.relatives.map(r=>({person:life(r.person),relation:r.relation,partner:r.partner?life(r.partner):null,homeElsewhere:r.homeElsewhere}))})};
  }
  const relatives=(resident.biography?.family??[]).filter(r=>r.lifeStatus!=='not-born');
  if (!relatives.length) return undefined;
  return {text:relatives.map(r=>r.name+' is my '+r.relation+(r.lifeStatus==='unresolved'?' (I am unsure of their current situation)':r.lifeStatus==='deceased'||(!r.lifeStatus&&r.isAlive===false)?' (deceased)':'')+'.').join(' ')};
}
