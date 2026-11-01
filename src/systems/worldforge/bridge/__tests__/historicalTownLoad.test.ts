/** Real deterministic generation plus focused joins. These disposable generated
 * fixtures are not imported campaign data and do not claim native traversal. */
import {beforeAll,describe,it,expect} from 'vitest';
import {createMockGameState,createMockPlayerCharacter} from '../../../../utils/core/factories';
import {DiscoveryType,type GameState} from '../../../../types';
import {getWorldforgeLocalForCell} from '../legacySubmapBridge';
import {makeGroundWorld,groundSurfaceY,type GroundWorld} from '../groundChunkLoader';
import {siteOrientationFromQuad} from '../sitePartTransform';
import {buildTownSimStateForBurg,townRosterForBurg} from '../../townsim/townSimRegistration';
import {computeBurgMerchants} from '../../townsim/registerBurgMerchants';
import {townBuildingVisit} from '../../../../components/Worldforge/townBuildingVisit';
import {captureObservedBuildingSource,buildingPlanSignature} from '../../interior/buildingSource';
import {guestBedsForVisit} from '../../../gameplay/lodging';
import {historicalTownLoadJoinError,prepareHistoricalTownLoad} from '../../town/prepareHistoricalTownLoad';
import type {TownRoster} from '../../roster/types';

let baseline:GameState,ground:GroundWorld,roster:TownRoster;
beforeAll(()=>{
 const worldSeed=1793432134128,burgId=188,cellId=1506;
 const life=buildTownSimStateForBurg(worldSeed,burgId,1,1);
 roster=townRosterForBurg(worldSeed,burgId,1);
 const merchants=computeBurgMerchants(worldSeed,burgId,1,{}, {},life);
 const generatedNpcs=Object.fromEntries(merchants.npcs.map(n=>[n.id,n]));
 const worldBusinesses=Object.fromEntries(merchants.businesses.map(b=>[b.id,b]));
 const frame=getWorldforgeLocalForCell(worldSeed,cellId,{centerPx:[376.7,199.25],townLayouts:{188:life}});
 ground=makeGroundWorld(frame.local,worldSeed,frame.region,{skipProps:true,hour:10,day:1,anchorCellId:cellId,
  townLife:{188:life},generatedNpcs,worldBusinesses,buildingEventLogs:{188:life.buildingEvents??{}}});
 const feet={tileX:cellId,tileY:0,xM:492.82113197569385,zM:474.7253580686169,
  yM:groundSurfaceY(ground,492.82113197569385,474.7253580686169)};
 for(const plotId of [19,66]){
  const building=ground.buildings.find(b=>b.id===`wf-plot-188-${plotId}`)!;
  const visit=townBuildingVisit(worldSeed,burgId,plotId,life.buildingEvents?.[plotId],undefined,1);
  const source=captureObservedBuildingSource({worldSeed,burgId,cellId,plotId,observedAt:'0351-01-01T09:00:00Z',
   position:feet,site:{xM:building.xM,zM:building.zM,surfaceY:groundSurfaceY(ground,building.xM,building.zM),
    ...siteOrientationFromQuad(building.cornersM)},historySignature:JSON.stringify(life.buildingEvents?.[plotId]??null),
   plan:visit.plan,household:visit.household,workplaceOnly:visit.workplaceOnly,manifests:visit.manifests,
  },building.blueprintSignature);
  expect(buildingPlanSignature(visit.plan)).toBe(building.blueprintSignature);
  life.buildingSources={...life.buildingSources,[plotId]:source};
 }
 const inn=worldBusinesses.biz_burg_188_plot_8;
 const innVisit=townBuildingVisit(worldSeed,burgId,8,life.buildingEvents?.[8],undefined,1);
 const bed=guestBedsForVisit(innVisit)[0];expect(bed).toBeDefined();
 const door=ground.buildings.find(b=>b.id==='wf-plot-188-66')!.parts.find(p=>p.door)!.door!;
 life.buildingDoors={66:{[door.id]:false}};
 baseline=createMockGameState({worldSeed,gameTime:new Date('0351-01-01T10:00:00Z'),party:[createMockPlayerCharacter({id:'hero'})],
  playerCell:{cellId,localeCoords:null},currentLocationId:'cell_1506',entry3DAnchor:{cellId,centerPx:[376.7,199.25]},
  playerGroundPos:feet,worldViewMode:'3d',townSim:{188:life},generatedNpcs,worldBusinesses,worldforgeDeltas:[],
  lodgingReservations:[{id:'paid-room',businessId:inn.id,businessName:inn.name,keeperId:inn.ownerId,
   keeperName:generatedNpcs[inn.ownerId].name,worldSeed,burgId,cellId,locationId:'cell_1506',plotId:8,
   partyIds:['hero'],beds:[bed],costGp:.5,quotedAt:'0351-01-01T09:00:00Z',paidAt:'0351-01-01T09:00:00Z',
   expiresAt:'0351-01-02T09:00:00Z'}],
  discoveryLog:[{id:'inn-visit',type:DiscoveryType.LOCATION_DISCOVERY,title:`Place Visited: ${inn.name}`,
   content:'An earned public visit.',timestamp:1,isRead:true,isQuestRelated:false,gameTime:'0351-01-01T09:00:00Z',
   source:{type:'LOCATION',id:`world:${worldSeed}:cell:1506:building:wf-plot-188-8`,name:inn.name},
   flags:[{key:'knowledgeKind',value:'firsthand-public-visit'},{key:'businessId',value:inn.id},
    {key:'floorLevel',value:'0'},{key:'roomId',value:String(innVisit.plan.floors[0].rooms.find(r=>!r.forSlot)!.id)}]}],
 });
 delete baseline.townSim[188].layoutRevision;
},120000);

describe('independent historical-town load producer and existing site joins',()=>{
 it('regenerates both readers and qualifies the earlier source without changing the generated saved state',()=>{
  const state=structuredClone(baseline),before=JSON.stringify(state);
  expect(prepareHistoricalTownLoad(state)).toMatchObject({status:'qualified',burgId:188,revision:1,observations:2,founders:237});
  expect(JSON.stringify(state)).toBe(before);expect(state.townSim[188].layoutRevision).toBeUndefined();
 },120000);
 it('matches actual merchants, owned sources, recorded doors and the paid inn visit before mount',()=>{
  expect(historicalTownLoadJoinError(baseline,ground,188,1,roster)).toBeUndefined();
 });
 it.each(['business','proprietor','door','bed','keeper','lore','inn-name','height','interior'] as const)('refuses unresolved %s joins without changing records',kind=>{
  const state=structuredClone(baseline);
  if(kind==='business')state.worldBusinesses.biz_burg_188_plot_8.businessType='farm';
  if(kind==='proprietor')state.worldBusinesses.biz_burg_188_plot_8.ownerId='missing-owner';
  if(kind==='door')state.townSim[188].buildingDoors![66]['missing-leaf']=false;
  if(kind==='bed')state.lodgingReservations![0].beds[0].index+=999;
  if(kind==='keeper')state.lodgingReservations![0].keeperId='other-keeper';
  if(kind==='lore')state.discoveryLog[0].source!.id=`world:${state.worldSeed}:cell:1506:building:wf-plot-188-1`;
  if(kind==='inn-name')state.discoveryLog[0].source!.name='A different inn';
  if(kind==='height')state.playerGroundPos!.yM!+=1;
  if(kind==='interior'){
   const building=ground.buildings.find(b=>b.id==='wf-plot-188-19')!;
   state.playerGroundPos!.xM=building.xM;state.playerGroundPos!.zM=building.zM;
  }
  const before=JSON.stringify(state);
  expect(historicalTownLoadJoinError(state,ground,188,1,roster)).toBeTypeOf('string');
  expect(JSON.stringify(state)).toBe(before);
 });
 it('rejects a stale rendered foundation even when its saved plan is still readable',()=>{
  const altered={...ground,buildings:ground.buildings.map(b=>b.id==='wf-plot-188-19'?{...b,blueprintSignature:'stale'}:b)};
  expect(historicalTownLoadJoinError(baseline,altered,188,1,roster)).toContain('interaction source');
 });
 it('refuses multi-body admission before generation instead of placing companions by guess',()=>{
  const state=structuredClone(baseline);state.party.push(createMockPlayerCharacter({id:'companion'}));
  expect(prepareHistoricalTownLoad(state)).toMatchObject({status:'unresolved'});
 });
});
