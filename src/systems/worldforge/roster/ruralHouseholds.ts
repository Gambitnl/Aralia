/** Append explicitly admitted farm families after urban residents and jobs.
 * Source facts replace a second random household draw. Reserved member ids
 * remain stable when another farm is admitted; established urban ids and jobs
 * are never renumbered or recruited to staff the newly represented fields. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/11/2026, 13:03:15
 * Dependents: systems/worldforge/roster/generateTownRoster.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {TownPlan} from '../artifacts';
import type {Occupant} from './types';
import type {SeedPath} from '../seedPath';
import {householdForPlot,householdMemberIdentity,householdPopulationForPlot,householdPopulationsForPlan} from '../town/householdBrief';
import {RURAL_PLOT_ID_BASE} from '../town/ruralHomesteads';

const MEMBER_ID_BASE=1_000_000,MEMBER_STRIDE=16;

export function appendRuralHouseholds(plan:TownPlan,seedPath:SeedPath,urban:Occupant[]):Occupant[]{
 const sources=plan.ruralSources;
 if(!sources)return urban;
 if(sources.layoutRecipe!=='rural-family-v1'||sources.homesteads.version!==1)throw new Error('Farm roster requires explicit supported rural sources');
 const populations=householdPopulationsForPlan(plan),ids=new Set(urban.map(o=>o.id));
 const memberIds=new Set(urban.flatMap(o=>o.householdMemberId?[o.householdMemberId]:[])),farms=new Set<string>();
 const rural:Occupant[]=[];
 for(const site of [...sources.homesteads.sites].sort((a,b)=>a.plotId-b.plotId)){
  const ordinal=/^f(0|[1-9]\d*)$/.exec(site.farmId),index=ordinal?Number(ordinal[1]):NaN;
  const matches=plan.plots.filter(p=>p.id===site.plotId),plot=matches[0];
  const field=sources.fields.filter(f=>f.farmParcelIndex===site.farmParcelIndex);
  if(!Number.isSafeInteger(index)||index<0||site.plotId!==RURAL_PLOT_ID_BASE+index||farms.has(site.farmId)
   ||matches.length!==1||plot.role!=='farm'||plot.pop?.buildingType!=='farmstead'||plot.pop.residential!==true
   ||plot.pop.homeId!==site.farmId||plot.pop.occupants!==site.occupants||!Number.isInteger(site.occupants)||site.occupants<1||site.occupants>8
   ||!Number.isSafeInteger(site.farmParcelIndex)||site.farmParcelIndex<0||field.length!==1||field[0].crop!==site.crop)
    throw new Error('Farm roster household, plot or field source is inconsistent');
  const population=householdPopulationForPlot(plot)!;
  const resolved=householdForPlot(population,populations,seedPath),household=resolved?.household;
  if(!household||household.homeId!==site.farmId||household.dwelling!=='farmstead'||household.members.length!==site.occupants)
   throw new Error('Farm roster must retain the complete source household');
  farms.add(site.farmId);
  for(const [memberIndex,member]of household.members.entries()){
   const id=MEMBER_ID_BASE+index*MEMBER_STRIDE+memberIndex,householdMemberId=householdMemberIdentity(household,memberIndex);
   if(!Number.isSafeInteger(id)||ids.has(id)||memberIds.has(householdMemberId))throw new Error('Farm roster source identity collides with an existing resident');
   ids.add(id);memberIds.add(householdMemberId);
   rural.push({id,name:member.name,ageBand:member.ageBand,homePlotId:site.plotId,occupation:'resident',householdMemberId,
    ...(/^retired\b/i.test(member.occupation)?{retired:true}:{}),
    ruralHousehold:{farmId:site.farmId,farmParcelIndex:site.farmParcelIndex,
     member:{age:member.age,race:member.race,role:member.role,occupation:member.occupation}}});
  }
 }
 return [...urban,...rural];
}
