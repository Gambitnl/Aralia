/** Reconstruct an unversioned played town before loading it into a newer game.
 * The world-gen worker calls this before any scene mounts. Both generators are
 * tried independently; retained observations cannot validate themselves.
 *
 * Success selects metadata only. People, property, history, clock and feet are
 * never regenerated into the save. This first admission supports one exterior
 * body on its exact terrain height; interior/deck/party admission stays explicit.
 * Source preflight is not proof that a rendered native reload has succeeded.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/11/2026, 23:06:19
 * Dependents: components/World3D/worldGenWorker.ts
 * Imports: 24 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {GameState, RichNPC} from '../../../types';
import {getGameDay} from '../../../utils/core';
import {getBridgeAtlas,getBurgCultureType,getWorldforgeLocalForCell} from '../bridge/legacySubmapBridge';
import {makeGroundWorld,groundSurfaceY,type GroundWorld} from '../bridge/groundChunkLoader';
import {siteOrientationFromQuad,siteDoorKey} from '../bridge/sitePartTransform';
import {inspectGroundWater} from '../bridge/groundWaterSurfaceQuery';
import {restoreAtlasGroundDrilldown} from '../leaf3d/atlasGroundRestore';
import {townRosterForBurg} from '../townsim/townSimRegistration';
import {blueprintForPlot} from '../interior/generateInterior';
import {buildingPlanSignature} from '../interior/buildingSource';
import {buildingPlotInput} from './buildingPlotInput';
import {canonicalTownSeedPath} from './canonicalTown';
import {climateForBiomeId} from './architectureStyle';
import {qualifyHistoricalTownLayout,type HistoricalTownLayoutCandidate} from './historicalTownLayout';
import {townBuildingVisit} from './townBuildingVisit';
import {guestBedsForVisit} from '../../gameplay/lodging';
import {businessTypeForTownPlot} from '../townsim/townBusinessIdentity';
import {shopKeeperAt} from '../townsim/shopLife';
import {pointInPolygon} from '../submap/submapEngine';
import {isGroundFootingSupported} from '../../world3d/groundBuildingMotion';
import {HISTORICAL_TOWN_LAYOUT_REVISIONS,type TownLayoutRevision} from './townLayoutRevision';
import type {TownRoster} from '../roster/types';
import {needsHistoricalTownLoad,type HistoricalTownLoadResult} from './historicalTownLoadContract';
import {TERRAIN_SOURCE_REVISIONS,requireTerrainSourceRevision,type TerrainSourceRevision} from '../region/terrainSource';

type SourceFrame=Pick<ReturnType<typeof getWorldforgeLocalForCell>,'local'|'region'>;

export function prepareHistoricalTownLoad(state:GameState):HistoricalTownLoadResult {
  if(!needsHistoricalTownLoad(state))return {status:'not-needed'};
  // A town reader does not identify its terrain. Independently reconstruct each
  // available terrain source and accept only one complete, exact physical join.
  const revisions=state.worldforgeTerrainRevision===undefined ? TERRAIN_SOURCE_REVISIONS
    : [requireTerrainSourceRevision(state.worldforgeTerrainRevision)];
  const results=revisions.map(revision=>prepareForTerrainSource(state,revision));
  const qualified=results.filter((result):result is Extract<HistoricalTownLoadResult,{status:'qualified'}>=>result.status==='qualified');
  if(qualified.length===1)return qualified[0];
  if(qualified.length===0&&results.length===1)return results[0];
  return {status:'unresolved',message:`This saved town could not be loaded safely: ${qualified.length
    ? 'more than one terrain source matches its recorded position.'
    : 'none of the retained terrain sources matches all recorded identities and exact dry support.'} Your saved game has not been changed.`};
}

function prepareForTerrainSource(state:GameState,terrainRevision:TerrainSourceRevision):HistoricalTownLoadResult {
  const refuse=(detail:string):HistoricalTownLoadResult=>({status:'unresolved',
    message:`This saved town could not be loaded safely: ${detail} Your saved game has not been changed.`});
  const cellId=state.playerCell!.cellId;
  const atlas=getBridgeAtlas(state.worldSeed);
  const burgId=atlas.pack.cells.burg?.[cellId];
  const town=burgId?state.townSim?.[burgId]:undefined;
  if(!burgId||!town)return refuse('the recorded town does not match this location.');
  const feet=state.playerGroundPos;
  if(state.party.length!==1||!feet||!Number.isFinite(feet.yM)
    ||![feet.xM,feet.zM].every(Number.isFinite)||feet.tileX!==cellId||feet.tileY!==0)
    return refuse('the saved party position needs a separate admission check.');
  if(!state.atlasGroundAddress && (!state.entry3DAnchor||state.entry3DAnchor.cellId!==cellId))
    return refuse('the original ground window is unavailable.');
  const time=new Date(state.gameTime),day=getGameDay(time);
  if(!Number.isFinite(Number(time)))return refuse('the saved date is invalid.');
  const burg=atlas.pack.burgs?.[burgId];
  const biome=burg?atlas.pack.cells.biome?.[burg.cell]:undefined;
  if(biome===undefined)return refuse('the settlement climate is unavailable.');
  const seed=canonicalTownSeedPath(state.worldSeed,burgId);
  const observations=Object.values(town.buildingSources??{});
  const candidates:HistoricalTownLayoutCandidate[]=[];
  const frames=new Map<TownLayoutRevision,SourceFrame>();
  const lifeFor=(revision:TownLayoutRevision)=>({...state.townSim,[burgId]:{...town,layoutRevision:revision}});
  const events=Object.fromEntries(Object.entries(state.townSim??{}).map(([id,t])=>[id,t.buildingEvents??{}]));
  const build=(frame:SourceFrame,revision:TownLayoutRevision,retained=false)=>
    makeGroundWorld(frame.local,state.worldSeed,frame.region,{
      hour:time.getUTCHours(),day,skipProps:true,anchorCellId:cellId,townLife:lifeFor(revision),
      worldBusinesses:state.worldBusinesses,generatedNpcs:state.generatedNpcs,deltas:state.worldforgeDeltas??[],
      buildingEventLogs:events,
      ...(retained?{buildingSources:Object.fromEntries(Object.entries(state.townSim??{})
        .map(([id,t])=>[id,t.buildingSources??{}]))}:{}),
    });
  for(const revision of HISTORICAL_TOWN_LAYOUT_REVISIONS){
    if(town.layoutRevision!==undefined&&town.layoutRevision!==revision)continue;
    let frame:SourceFrame;
    if(state.atlasGroundAddress){
      const restored=restoreAtlasGroundDrilldown(state.atlasGroundAddress,state.worldSeed,lifeFor(revision),terrainRevision);
      if(restored.status!=='ready'){
        candidates.push({revision,worldSeed:state.worldSeed,burgId,cellId,plotIds:[],
          foundingRoster:{burgId,occupants:[]},buildings:{}});
        continue;
      }
      frame={local:restored.drilldown.local,region:restored.drilldown.region};
    }else frame=getWorldforgeLocalForCell(state.worldSeed,cellId,{
      centerPx:state.entry3DAnchor!.centerPx,townLayouts:lifeFor(revision),terrainRevision,
    });
    frames.set(revision,frame);
    const ground=build(frame,revision),artifact=ground.townPlans?.find(t=>t.burgId===burgId)?.plan;
    if(!artifact)return refuse('a candidate town is missing from its original ground window.');
    const buildings:Record<number,HistoricalTownLayoutCandidate['buildings'][number]>={};
    for(const source of observations){
      const plot=artifact.plots.find(p=>p.id===source.plotId);
      const building=ground.buildings.find(b=>b.id===`wf-plot-${burgId}-${source.plotId}`);
      if(!plot||!building)continue;
      buildings[source.plotId]={plan:blueprintForPlot(buildingPlotInput(artifact,plot,seed,{
        cultureType:getBurgCultureType(state.worldSeed,burgId),climate:climateForBiomeId(biome),
        eventLog:JSON.parse(source.historySignature)??undefined,
      }),seed),site:{xM:building.xM,zM:building.zM,surfaceY:groundSurfaceY(ground,building.xM,building.zM),
        ...siteOrientationFromQuad(building.cornersM)}};
    }
    candidates.push({revision,worldSeed:state.worldSeed,burgId,cellId,plotIds:artifact.plots.map(p=>p.id),
      foundingRoster:townRosterForBurg(state.worldSeed,burgId,revision),buildings});
  }
  // A pre-capture exterior save can identify its layout by the complete saved
  // founding population. It still must pass all business, knowledge and exact
  // dry-footing checks below; this does not invent an observed building plan.
  // The qualification helper expects an unversioned input. A temporary view
  // lets it verify a known layout without deleting or replacing saved metadata;
  // the candidate loop above remains constrained to that exact known reader.
  const result=qualifyHistoricalTownLayout({worldSeed:state.worldSeed,cellId,gameTime:state.gameTime,
    town:{...town,layoutRevision:undefined},candidates,
    allowUnobservedExterior:observations.length===0});
  if(result.status!=='qualified')return refuse(`its historical layout is unresolved (${result.reason}).`);
  const frame=frames.get(result.revision)!,ground=build(frame,result.revision,true);
  const roster=candidates.find(c=>c.revision===result.revision)!.foundingRoster;
  const joinError=historicalTownLoadJoinError(state,ground,burgId,result.revision,roster);
  if(joinError)return refuse(joinError);
  return {status:'qualified',burgId,revision:result.revision,terrainRevision,observations:result.observations,
    founders:result.founders,surfaceY:groundSurfaceY(ground,feet.xM,feet.zM)};
}

/** Reusable join checks over the independently selected/current replay. This
 * is also exercised directly so failures do not need another heavy world bake.
 * It never qualifies a candidate itself or grants access to a door or bed. */
export function historicalTownLoadJoinError(state:GameState,ground:GroundWorld,burgId:number,
  revision:TownLayoutRevision,roster:TownRoster):string|undefined {
  const town=state.townSim[burgId],feet=state.playerGroundPos!,cellId=state.playerCell!.cellId;
  const day=getGameDay(new Date(state.gameTime));
  const observations=Object.values(town.buildingSources??{});
  const plan=ground.townPlans?.find(t=>t.burgId===burgId)?.plan;
  if(!plan)return 'the selected town is absent from its ground window.';
  const refuse=(detail:string)=>detail;
  const visits=new Map<number,ReturnType<typeof townBuildingVisit>>();
  const visit=(plotId:number)=>{
    let value=visits.get(plotId);
    if(!value){value=townBuildingVisit(state.worldSeed,burgId,plotId,town.buildingEvents?.[plotId],
      town.buildingSources?.[plotId],revision);visits.set(plotId,value);}
    return value;
  };
  for(const source of observations){
    const mounted=ground.buildings.find(b=>b.id===`wf-plot-${burgId}-${source.plotId}`);
    if(!mounted||mounted.blueprintSignature!==buildingPlanSignature(visit(source.plotId).plan))
      return refuse('a retained building no longer agrees with its interaction source.');
  }
  for(const [id,raw] of Object.entries(state.generatedNpcs??{})){
    const npc=raw as RichNPC&{worldforgeHousehold?:{burgId:number;memberId:string}};
    if(npc.worldforgeHousehold?.burgId!==burgId)continue;
    const people=Object.values(town.villagers).filter(p=>p.householdMemberId===npc.worldforgeHousehold!.memberId);
    if(people.length!==1||people[0].name!==npc.name)return refuse(`a recorded character (${id}) has an unresolved identity.`);
  }
  for(const business of Object.values(state.worldBusinesses??{})){
    if(business.burgId!==burgId)continue;
    const plot=plan.plots.find(p=>p.id===business.plotId);
    if(!plot||!['market','workshop'].includes(plot.role)
      ||business.businessType!==businessTypeForTownPlot(plot.role,plot.id,plot.pop?.buildingType))
      return refuse('a saved business no longer matches its original workplace.');
    if(business.ownerId==='player')continue;
    const owner=state.generatedNpcs?.[business.ownerId] as RichNPC&{worldforgeHousehold?:{memberId:string}}|undefined;
    const worker=roster.occupants.find(p=>p.workPlotId===plot.id);
    // GG-603: since GG-595 an heir or a new owner can take a shop in the town
    // sim, and the merchant follows that keeper (`computeBurgMerchants`). A
    // save from before GG-595 still names the founding worker. Accept either
    // real keeper of this workplace on the save's day, and nobody else.
    const shop=shopKeeperAt(town,plot.id,day);
    const keepers=[worker&&{name:worker.name,memberId:worker.householdMemberId},
      shop.status==='open'&&{name:shop.keeper.name,memberId:shop.keeper.householdMemberId}];
    if(!owner||!keepers.some(k=>k&&owner.name===k.name&&owner.worldforgeHousehold?.memberId===k.memberId))
      return refuse('a saved proprietor no longer matches the workplace roster.');
  }
  const openDoors=new Set<string>();
  for(const [plotId,doors] of Object.entries(town.buildingDoors??{})){
    const building=ground.buildings.find(b=>b.id===`wf-plot-${burgId}-${plotId}`);
    if(!building)return refuse('a recorded door has lost its building.');
    for(const [id,open] of Object.entries(doors)){
      const part=building.parts.find(p=>p.door?.id===id);
      if(!part||typeof open!=='boolean')return refuse('a recorded door no longer matches its original leaf.');
      if(open)openDoors.add(siteDoorKey(building.id,part));
    }
  }
  for(const stay of state.lodgingReservations??[]){
    if(stay.burgId!==burgId)continue;
    const business=state.worldBusinesses?.[stay.businessId];
    if(stay.worldSeed!==state.worldSeed||stay.cellId!==cellId||!business||business.plotId!==stay.plotId
      ||business.ownerId!==stay.keeperId)return refuse('a paid room has lost its original inn or keeper.');
    const beds=guestBedsForVisit(visit(stay.plotId));
    if(stay.beds.some(b=>!beds.some(current=>current.level===b.level&&current.index===b.index&&current.roomId===b.roomId)))
      return refuse('a paid room no longer contains its reserved bed.');
  }
  // These stable observations qualify the old building identity. A remembered
  // plot without its reached foundation cannot be reassigned during admission.
  for(const entry of state.discoveryLog??[]){
    const prefix=`world:${state.worldSeed}:cell:${cellId}:building:wf-plot-${burgId}-`;
    if(entry.source?.id?.startsWith(prefix)){
      const plot=Number(entry.source.id.slice(prefix.length));
      if(!town.buildingSources?.[plot]){
        // The original inn visit predates foundation capture. Its actual paid
        // bed, named business and recorded public room provide narrower joins;
        // that receipt cannot stand in for a temple dedication or other lore.
        const flags=entry.flags??[];
        const businessId=flags.find(flag=>flag.key==='businessId')?.value;
        const business=typeof businessId==='string'?state.worldBusinesses?.[businessId]:undefined;
        const room=Number(flags.find(flag=>flag.key==='roomId')?.value);
        const floor=Number(flags.find(flag=>flag.key==='floorLevel')?.value);
        const paid=state.lodgingReservations?.some(stay=>stay.burgId===burgId&&stay.plotId===plot
          &&stay.businessId===businessId);
        if(!paid||!business||business.plotId!==plot||entry.source.name!==business.name
          ||!flags.some(flag=>flag.key==='knowledgeKind'&&flag.value==='firsthand-public-visit')
          ||!Number.isSafeInteger(room)||!Number.isSafeInteger(floor)
          ||!visit(plot).plan.floors.find(f=>f.level===floor)?.rooms.some(r=>r.id===room&&!r.forSlot))
          return refuse('a remembered building needs its original source qualified.');
      }
    }
  }
  const support=exteriorSupportError(ground,feet,openDoors);
  if(support)return refuse(support);
}

function exteriorSupportError(ground:GroundWorld,feet:NonNullable<GameState['playerGroundPos']>,doors:ReadonlySet<string>):string|undefined {
  if(ground.buildings.some(b=>pointInPolygon([feet.xM,feet.zM],b.cornersM.map(p=>[p.x,p.z]))))
    return 'the saved interior position needs a separate admission check.';
  if(Math.abs(groundSurfaceY(ground,feet.xM,feet.zM)-feet.yM!)>1e-6
    ||!isGroundFootingSupported(ground,{...feet,yM:feet.yM!},doors))
    return 'the saved feet no longer have their original terrain support.';
  const evidence=inspectGroundWater(ground,feet.xM,feet.zM);
  if(evidence.status==='unavailable')return 'the saved position has unverified water evidence.';
  const water=evidence.surfaceY;
  if(water!==undefined&&water!==null&&water>feet.yM!+.1)return 'the saved position is covered by water.';
}
