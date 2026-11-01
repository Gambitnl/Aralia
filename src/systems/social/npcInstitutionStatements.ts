/** A priest can discuss an earned temple reading and their actual career, or
 * point to a real public library. These are public facts, not personal belief,
 * magical powers, admission, or invented history connecting unrelated names. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 30/10/2026, 08:25:12
 * Dependents: services/dialogueService.ts, systems/social/npcDialogueMemory.ts
 * Imports: 12 files
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
import {householdFamilyAt,householdInstitutionRole} from '../worldforge/townsim/householdNpc';
import {getBridgeAtlas} from '../worldforge/bridge/legacySubmapBridge';
import {canonicalArtifactTownForSiteFromAtlas,townSpanFtForBurg} from '../worldforge/town/canonicalTown';
import {institutionPlotForRole} from '../worldforge/townsim/keyNpcs';
import {findRetainedTempleDedication,resolveWorldforgeTempleIdentity} from '../religion/worldforgeTemple';
import {resolveNpcLocalDirections} from '../travel/npcLocalDirections';
import {polygonCentroid} from '../worldforge/submap/submapEngine';
import {bearingToDirection} from '../travel/navDrift';
import {currentBuildingUse,isBuildingHistoryJournal} from '../worldforge/interior/buildingEventHistory';

export type InstitutionStatementTopic='household_temple'|'household_office_history'|'household_public_history';
export function resolveNpcInstitutionStatement(state:GameState,npcId:string,topic:InstitutionStatementTopic):{text:string;snapshot:string}|undefined {
  const npc=state.generatedNpcs?.[npcId] as (RichNPC&{worldforgeHousehold?:{burgId:number;memberId:string;legacyNameUnique?:boolean}})|undefined;
  const identity=npc?.worldforgeHousehold,day=getGameDay(state.gameTime);
  if (!npc || !identity || !Number.isSafeInteger(state.worldSeed) || !Number.isInteger(day)
    || npc.knowledgeProfile?.topicOverrides?.[topic]) return undefined;
  const town=state.townSim?.[identity.burgId];
  const family=householdFamilyAt(town,identity.memberId,npc.name,day,identity.legacyNameUnique);
  if (!town || !family || householdInstitutionRole(family.person,day)!=='priest') return undefined;
  const holders=Object.values(town.villagers).filter(p=>householdInstitutionRole(p,day)==='priest');
  if (holders.length!==1 || holders[0]!==family.person) return undefined;
  const person=family.person;

  if (topic==='household_public_history') {
    if (town.layoutRevision===undefined) return undefined;
    // A public directory is useful even when this priest cannot corroborate a
    // story. Locate an existing library; attendance and physical reading keep
    // their own owners. Never create a librarian, opening time or safe route.
    try {
      if (!resolveNpcLocalDirections(state,npc)) return undefined;
      const atlas=getBridgeAtlas(state.worldSeed),burg=atlas.pack.burgs?.[identity.burgId];
      if (!burg || burg.removed || !burg.name?.trim()) return undefined;
      const {plan}=canonicalArtifactTownForSiteFromAtlas(atlas,state.worldSeed,{burgId:identity.burgId,
        envelope:{x:0,y:0,width:0,height:0},gates:[]}, town.layoutRevision);
      const libraries=plan.plots.filter(plot=>{
        if (plot.role!=='civic' || plot.pop?.buildingType!=='library' || plot.pop.residential!==false
          || !Number.isSafeInteger(plot.id) || plan.plots.filter(p=>p.id===plot.id).length!==1
          || plot.footprint.length<3 || plot.footprint.some(p=>p.length!==2||!p.every(Number.isFinite))) return false;
        const history=town.buildingEvents?.[plot.id],journal=isBuildingHistoryJournal(history);
        if (history&&!Array.isArray(history)&&!journal) return false;
        if (journal&&(!history.snapshot?.history||!Number.isFinite(history.snapshot.throughDay)||history.snapshot.throughDay>day)) return false;
        const events=journal?history.events:history??[];
        if (!Array.isArray(events)||events.some(event=>!Number.isSafeInteger(event.day))) return false;
        const visible=events.filter(event=>event.day<=day);
        return currentBuildingUse(journal?{...history,events:visible}:visible)==='occupied';
      }).map(plot=>({plot,point:polygonCentroid(plot.footprint)}))
        .sort((a,b)=>Math.hypot(...a.point)-Math.hypot(...b.point)||a.plot.id-b.plot.id);
      const library=libraries[0],span=townSpanFtForBurg(atlas,identity.burgId);
      if (!library || !library.point.every(Number.isFinite) || !Number.isFinite(span)||span<=0) return undefined;
      const [x,y]=library.point;
      const sectors={N:'northern',NE:'northeastern',E:'eastern',SE:'southeastern',S:'southern',SW:'southwestern',W:'western',NW:'northwestern'};
      const area=Math.hypot(x,y)<=span*.12?'near the center of '+burg.name.trim()
        :'in the '+sectors[bearingToDirection(x,y)]+' part of '+burg.name.trim();
      return {text:'There is a public library '+area+'. Ask the librarian about the town chronicle.',
        snapshot:JSON.stringify({world:state.worldSeed,burg:identity.burgId,person:[person.occupantId,person.bornDay],
          library:{id:library.plot.id,footprint:library.plot.footprint,history:town.buildingEvents?.[library.plot.id]??null}})};
    } catch { return undefined; }
  }

  if (topic==='household_office_history') {
    // Succession currently follows a recorded death. Match the canonical event
    // template and both life ids; a matching name in a rumor proves no relation.
    const history=town.chronicle?.events;
    if (!Array.isArray(history)) return undefined;
    const events=history.filter(event=>{
      if (!event || event.kind!=='role_succession' || event.subjectId!==person.occupantId
        || !Number.isSafeInteger(event.id) || event.id<=0 || !Number.isSafeInteger(event.day)
        || event.day>day || event.day<person.bornDay || event.relatedIds?.length!==1) return false;
      const previous=town.villagers[event.relatedIds[0]];
      return previous && previous.occupantId!==person.occupantId && Number.isSafeInteger(previous.occupantId)
        && town.villagers[previous.occupantId]===previous && previous.bornDay<=event.day
        && previous.diedDay===event.day && !!previous.name?.trim()
        && event.summary===`${person.name} succeeded ${previous.name} as priest.`;
    });
    if (events.length!==1 || town.chronicle.events.filter(e=>e.id===events[0].id).length!==1) return undefined;
    const event=events[0],previous=town.villagers[event.relatedIds[0]],elapsed=day-event.day;
    const when=elapsed===0?'today':elapsed===1?'yesterday':`${elapsed} days ago`;
    return {text:`I became the town's priest ${when}, succeeding ${previous.name}.`,
      snapshot:JSON.stringify({world:state.worldSeed,burg:identity.burgId,person:[person.occupantId,person.bornDay],
        event,predecessor:[previous.occupantId,previous.name,previous.bornDay,previous.diedDay],day})};
  }

  // The career ledger above remains valid without spatial generation. A
  // temple or library statement also needs an identified layout; otherwise
  // a reused plot index could corroborate a different physical building.
  if (town.layoutRevision===undefined) return undefined;
  // Empty knowledge stays cheap: unrelated topic lists must not generate an
  // atlas merely to discover that the player never read this dedication.
  if (!state.discoveryLog?.some(entry=>Array.isArray(entry?.flags)&&entry.flags.some(flag=>flag?.key==='knowledgeKind'&&flag.value==='temple-dedication'))) return undefined;
  try {
    const atlas=getBridgeAtlas(state.worldSeed);
    const {plan}=canonicalArtifactTownForSiteFromAtlas(atlas,state.worldSeed,{burgId:identity.burgId,
      envelope:{x:0,y:0,width:0,height:0},gates:[]}, town.layoutRevision);
    const plot=institutionPlotForRole(plan,'priest');
    if (!plot) return undefined;
    const temple=resolveWorldforgeTempleIdentity(state.worldSeed,identity.burgId,plot.id,day,town);
    if (!temple || temple.clergy?.occupantId!==person.occupantId || temple.clergy.name!==npc.name) return undefined;
    const reading=findRetainedTempleDedication(state.discoveryLog,temple,state.gameTime);
    if (!reading) return undefined;
    const faith=temple.faith;
    return {text:`I serve as the priest of the temple in ${temple.townName}. Its dedication names ${faith.name}, with ${faith.form.toLowerCase()} as the recorded tradition`
      +(faith.deity?`, and ${faith.deity} as an associated deity.`:'.'),
      snapshot:JSON.stringify({temple,reading:reading.id,person:[person.occupantId,person.bornDay]})};
  } catch { return undefined; }
}
