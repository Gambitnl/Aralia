/** Reconstruct an unversioned played town before loading it into a newer game.
 * The world-gen worker calls this before any scene mounts. Both generators are
 * tried independently; retained observations cannot validate themselves.
 *
 * Success selects metadata only. People, property, history, clock and feet are
 * never regenerated into the save. This first admission supports one exterior
 * party on each body's exact terrain height; interior/deck admission stays explicit.
 * Source preflight is not proof that a rendered native reload has succeeded.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 03/11/2026, 03:31:46
 * Dependents: components/World3D/worldGenWorker.ts, hooks/app/useAppTravelActions.ts
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
import {needsHistoricalTownLoad,historicalTownArrivalSignature,type HistoricalTownLoadResult,type HistoricalTownArrivalResult} from './historicalTownLoadContract';
import {CURRENT_TERRAIN_REVISION,TERRAIN_SOURCE_REVISIONS,requireTerrainSourceRevision,type TerrainSourceRevision} from '../region/terrainSource';

type SourceFrame=Pick<ReturnType<typeof getWorldforgeLocalForCell>,'local'|'region'>;

export function prepareHistoricalTownLoad(state:GameState,
  observeSource?:(revision:TerrainSourceRevision,result:HistoricalTownLoadResult)=>void):HistoricalTownLoadResult {
  if(!needsHistoricalTownLoad(state))return {status:'not-needed'};
  // A town reader does not identify its terrain. Independently reconstruct each
  // available terrain source and accept only one complete, exact physical join.
  const revisions=state.worldforgeTerrainRevision===undefined ? TERRAIN_SOURCE_REVISIONS
    : [requireTerrainSourceRevision(state.worldforgeTerrainRevision)];
  // Optional operator diagnostics report each independent attempt. They never
  // select a source or relax the ordinary unique-match admission decision.
  const results=revisions.map(revision=>{const result=prepareForTerrainSource(state,revision);observeSource?.(revision,result);return result;});
  const qualified=results.filter((result):result is Extract<HistoricalTownLoadResult,{status:'qualified'}>=>result.status==='qualified');
  if(qualified.length===1)return qualified[0];
  if(qualified.length===0&&results.length===1)return results[0];
  return {status:'unresolved',message:`This saved town could not be loaded safely: ${qualified.length
    ? 'more than one terrain source matches its recorded position.'
    : 'none of the retained terrain sources matches all recorded identities and exact dry support.'} Your saved game has not been changed.`};
}

/** Qualify an upcoming recorded town before the journey spends anything. The
 * existing source comparison owns identities/buildings/workplaces. Actual new
 * destination feet are established only after the normal move and scene mount.
 * This never repairs a mixed-source save or grants entry to a building. */
export function prepareHistoricalTownArrival(state:GameState,destination?:{cellId:number;anchor:{cellId:number;centerPx?:readonly [number,number]}}):HistoricalTownArrivalResult {
  // A saved village's people are evidence even when it has no shop or observed
  // interior. Check the atlas burg, not only the merchant-based load predicate.
  if(!destination||state.playerCell?.cellId===destination.cellId
    ||!Object.values(state.townSim??{}).some(t=>t.layoutRevision===undefined||state.worldforgeTerrainRevision===undefined))return {status:'not-needed'};
  const atlas=getBridgeAtlas(state.worldSeed),burgId=atlas.pack.cells.burg?.[destination.cellId],burg=burgId?atlas.pack.burgs?.[burgId]:undefined;
  const town=burgId?state.townSim?.[burgId]:undefined;
  if(!town||town.layoutRevision!==undefined&&state.worldforgeTerrainRevision!==undefined)return {status:'not-needed'};
  if(!burg||destination.anchor.cellId!==destination.cellId)return {status:'unresolved',message:'The destination cannot be prepared without changing its recorded people or places. You have not set out.'};
  // This is an explicit new-scene selection, not an inferred legacy terrain
  // migration. A retained foundation must still match this selected reader.
  const terrain=state.worldforgeTerrainRevision??CURRENT_TERRAIN_REVISION;
  return prepareForTerrainSource(state,terrain,{cellId:destination.cellId,centerPx:destination.anchor.centerPx??[burg.x,burg.y]});
}

type ArrivalContext={cellId:number;centerPx:readonly [number,number]};
function prepareForTerrainSource(state:GameState,terrainRevision:TerrainSourceRevision):HistoricalTownLoadResult;
function prepareForTerrainSource(state:GameState,terrainRevision:TerrainSourceRevision,arrival:ArrivalContext):HistoricalTownArrivalResult;
function prepareForTerrainSource(state:GameState,terrainRevision:TerrainSourceRevision,arrival?:ArrivalContext):HistoricalTownLoadResult|HistoricalTownArrivalResult {
  const origin=state;
  // A local view supplies the destination to the shared source reader. Party
  // whereabouts/feet are not invented: arrival mode never reads or admits them.
  if(arrival)state={...state,currentLocationId:'cell_'+arrival.cellId,playerCell:{cellId:arrival.cellId,localeCoords:null},
    entry3DAnchor:{cellId:arrival.cellId,centerPx:arrival.centerPx},atlasGroundAddress:null};
  const refuse=(detail:string)=>({status:'unresolved' as const,
    message:arrival?'The destination cannot be prepared without changing its recorded people or places. You have not set out.':`This saved town could not be loaded safely: ${detail} Your saved game has not been changed.`});
  const cellId=state.playerCell!.cellId;
  const atlas=getBridgeAtlas(state.worldSeed);
  const burgId=atlas.pack.cells.burg?.[cellId];
  const town=burgId?state.townSim?.[burgId]:undefined;
  if(!burgId||!town)return refuse('the recorded town does not match this location.');
  const feet=state.playerGroundPos;
  if(!arrival&&(!state.party.length||!feet||!Number.isFinite(feet.yM)
    ||![feet.xM,feet.zM].every(Number.isFinite)||feet.tileX!==cellId||feet.tileY!==0))
    return refuse('the saved party position needs a separate admission check.');
  const companionPlacement=arrival?undefined:companionExteriorPlacementError(state);
  if(companionPlacement)return refuse(companionPlacement);
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
    if(!arrival&&town.layoutRevision!==undefined&&town.layoutRevision!==revision)continue;
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
  if(town.layoutRevision!==undefined&&town.layoutRevision!==result.revision)return refuse('the recorded town source no longer agrees.');
  const frame=frames.get(result.revision)!,ground=build(frame,result.revision,true);
  const roster=candidates.find(c=>c.revision===result.revision)!.foundingRoster;
  const joinError=arrival?historicalTownSiteJoinError(state,ground,burgId,result.revision,roster)
    :historicalTownLoadJoinError(state,ground,burgId,result.revision,roster);
  if(joinError)return refuse(joinError);
  if(arrival)return {status:'qualified',receipt:{worldSeed:origin.worldSeed,cellId,burgId,revision:result.revision,
    terrainRevision,signature:historicalTownArrivalSignature(origin,burgId)}};
  return {status:'qualified',burgId,revision:result.revision,terrainRevision,observations:result.observations,
    founders:result.founders,surfaceY:groundSurfaceY(ground,feet!.xM,feet!.zM)};
}

/** Reusable join checks over the independently selected/current replay. This
 * is also exercised directly so failures do not need another heavy world bake.
 * It never qualifies a candidate itself or grants access to a door or bed. */
export function historicalTownLoadJoinError(state:GameState,ground:GroundWorld,burgId:number,
  revision:TownLayoutRevision,roster:TownRoster):string|undefined {
  const sourceError=historicalTownSiteJoinError(state,ground,burgId,revision,roster);
  if(sourceError)return sourceError;
  const town=state.townSim[burgId],feet=state.playerGroundPos!,openDoors=new Set<string>();
  for(const [plotId,doors] of Object.entries(town.buildingDoors??{})){
    const building=ground.buildings.find(b=>b.id===`wf-plot-${burgId}-${plotId}`)!;
    for(const [id,open] of Object.entries(doors))if(open){const part=building.parts.find(p=>p.door?.id===id)!;openDoors.add(siteDoorKey(building.id,part));}
  }
  const support=exteriorSupportError(ground,feet,openDoors);
  if(support)return support;
  const placement=companionExteriorPlacementError(state);
  if(placement)return placement;
  for(const person of state.party.slice(1)){
    const point=state.companions[person.id].whereabouts!.position!;
    const error=exteriorSupportError(ground,{...feet,...point},openDoors);
    if(error)return `${person.name}: ${error}`;
  }
}

/** Destination qualification compares the same saved people, property and
 * observations, without pretending a future arrival already has a body. Saved
 * loads always use the stricter body wrapper above, including exact support. */
function historicalTownSiteJoinError(state:GameState,ground:GroundWorld,burgId:number,
  revision:TownLayoutRevision,roster:TownRoster):string|undefined {
  const town=state.townSim[burgId],cellId=state.playerCell!.cellId;
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

}

/** Membership alone cannot qualify another body's location. This bounded
 * extension accepts a real arrived shared leg with its durable arrival memory;
 * unplaced or independently unresolved party members remain explicit refusals. */
function companionExteriorPlacementError(state:GameState):string|undefined {
  if(new Set(state.party.map(p=>p.id)).size!==state.party.length)return 'the saved party has duplicate identities.';
  for(const person of state.party.slice(1)){
    const c=state.companions[person.id],where=c?.whereabouts,point=where?.position,leg=c?.journey;
    if(!c?.inParty||!point||![point.xM,point.yM,point.zM].every(Number.isFinite)
      ||where?.worldSeed!==state.worldSeed||where.locationId!==state.currentLocationId||where.source!=='party'
      ||leg?.worldSeed!==state.worldSeed||leg.status!=='arrived'||leg.to.locationId!==state.currentLocationId
      ||leg.to.cellId!==state.playerCell?.cellId||leg.arrivalAt>Number(new Date(state.gameTime))
      ||!c.memories.some(m=>m.id===`${leg.id}:arrived`&&m.tags.includes('shared-journey')))
      return `${person.name} has no qualified saved arrival at this place. Their position has not been changed.`;
  }
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
