/** Public activities give authored people a place in the world before a player
 * chooses where to start. They are not meetings, jobs awarded by the player,
 * secret disclosures or travel consent. Saved activity and whereabouts survive
 * joining; an old observed person is never relocated by a new selector. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 29/10/2026, 07:13:28
 * Dependents: components/World3D/World3DWrapper.tsx, hooks/actions/handleNpcInteraction.ts, systems/companions/companionJourneyReadiness.ts, systems/companions/companionWorldActivitySource.ts, systems/intrigue/TavernGossipSystem.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {CompanionPublicActivity} from '@/types/companions';
import type {GameState} from '@/types/state';
import type {WorldRumor} from '@/types/world';
import {childSeedPath,rootSeedPath,rngFromPath,streamPath} from '@/systems/worldforge/seedPath';

export interface ActivityTown {i:number;cell:number;name:string;population?:number;removed?:boolean}
export interface PublicRestorationSource {worldSeed:number;companionId:string;goalId:string;nearbyBurgId:number;sitePath:string}

/** These authored activities extend the existing public restoration ambition and
 * Kaelen's stated freedom/profit values. Seeking work is not employment with an
 * invented keeper, and it never discloses why he privately needs the money. */
export function planCompanionWorldActivities(worldSeed:number,towns:readonly ActivityTown[],restoration:PublicRestorationSource|undefined):CompanionPublicActivity[] {
 if(!Number.isSafeInteger(worldSeed)||worldSeed<0)return [];
 const live=towns.filter(t=>t&&Number.isInteger(t.i)&&t.i>0&&Number.isInteger(t.cell)&&t.cell>=0&&!t.removed&&typeof t.name==='string'&&t.name.trim()).sort((a,b)=>a.i-b.i);
 const plans:CompanionPublicActivity[]=[];
 const make=(town:ActivityTown,companionId:string,kind:CompanionPublicActivity['kind'],summary:string):CompanionPublicActivity=>({
  sourceId:`companion-activity-v1:${worldSeed}:${companionId}`,version:1,worldSeed,companionId,kind,
  burgId:town.i,burgName:town.name,cellId:town.cell,locationId:`cell_${town.cell}`,summary,
 });
 if(restoration?.worldSeed===worldSeed&&restoration.companionId==='elara_vance'&&restoration.goalId==='restore_temple'){
  const town=live.find(t=>t.i===restoration.nearbyBurgId);
  if(town)plans.push({...make(town,'elara_vance','restoration-preparations','Preparing provisions for her journey to restore the Temple of the Morning.'),goalId:'restore_temple',sitePath:restoration.sitePath});
 }
 const others=live.filter(t=>t.i!==plans[0]?.burgId);
 const candidates=others.length?others:live;
 // Favor settlements with an existing trade population; the activity makes no
 // claim about an employer, a contract, a family tie or an illegal undertaking.
 const large=candidates.filter(t=>(t.population??0)>=10),pool=large.length?large:candidates;
 if(pool.length){
  const root=childSeedPath(rootSeedPath(worldSeed),`companion-world:${worldSeed}`);
  const rng=rngFromPath(streamPath(root,'independent-activities-v1'));
  plans.push(make(pool[rng.nextInt(0,pool.length)],'kaelen_thorne','seeking-independent-work','Looking for paid work he can undertake on his own terms.'));
 }
 return plans;
}

/** Local, public hearsay uses the existing purchase/receipt system. Presence is
 * checked against actual retained whereabouts, so a joined or departed person
 * is not advertised as waiting at the old square. No extra knowledge is granted. */
export function companionActivityRumors(state:GameState,day:number):WorldRumor[] {
 return Object.values(state.companions).flatMap(companion=>{
  const activity=companion.publicActivity,where=companion.whereabouts;
  if(!activity||activity.worldSeed!==state.worldSeed||where?.worldSeed!==state.worldSeed
   ||where.source!=='world-activity'||where.locationId!==activity.locationId
   ||activity.locationId!==state.currentLocationId||!where.position||companion.inParty
   ||state.party.some(p=>p.id===companion.id)||state.metNpcIds.includes(companion.id))return [];
  return [{id:`companion-work-${activity.sourceId}`,type:'misc' as const,
   text:`${companion.identity.name} is using the public square or nearby streets in ${activity.burgName}. ${activity.summary}`,
   timestamp:day,expiration:day+1,locationId:activity.locationId,spreadDistance:0,virality:0}];
 });
}

export function companionActivityMeetingLine(companion:GameState['companions'][string],worldSeed:number|null):string {
 const activity=companion.publicActivity,where=companion.whereabouts;
 if(!activity||activity.worldSeed!==worldSeed||where?.source!=='world-activity'||where.locationId!==activity.locationId)return '';
 if(activity.kind==='restoration-preparations'){
  if(companion.travelAgreement?.worldSeed===worldSeed&&companion.travelAgreement.response==='accepted')
   return ` We agreed to inspect the ${companion.travelAgreement.destinationName} together. We still decide deeper risks together; the restoration remains my own work.`;
  // A handover has consequences for her current account of her own work.
  // Keep the public source place intact; this updates speech, never her feet.
  if(companion.questline?.currentStageId==='supplied'&&companion.questline.origin?.worldSeed===worldSeed)
   return ' I remember the provisions you brought. I am weighing the road ahead and the restoration work still to do.';
  return ' I am getting my provisions together here before setting out on the restoration journey.';
 }
 return ' I am looking for paid work here, on terms that leave me my independence.';
}

/** A local rumor or a nameplate is not physical contact. The action owner also
 * calls this before memory, recruitment or dialogue effects can occur. Legacy
 * saves without the new public activity retain their established entry route. */
export function companionActivityContactError(state:GameState,id:string,feet?:{xM:number;yM:number;zM:number}):string|null {
 const companion=state.companions?.[id];if(!companion?.publicActivity)return null;
 const where=companion.whereabouts,point=where?.position,player=feet??state.playerGroundPos;
 if(companion.inParty||state.party.some(p=>p.id===id))return null;
 if(where?.worldSeed!==state.worldSeed||where.locationId!==state.currentLocationId||!point
  ||!player||![point.xM,point.yM,point.zM,player.xM,player.yM,player.zM].every(Number.isFinite)
  ||Math.hypot(point.xM-player.xM,point.zM-player.zM,point.yM-player.yM!)>3)
  return `Approach ${companion.identity.name} before speaking. They remain at their own location.`;
 return null;
}
