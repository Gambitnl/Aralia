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
import {businessTypeForTownPlot} from '../../townsim/townBusinessIdentity';
import {townBuildingVisit} from '../../../../components/Worldforge/townBuildingVisit';
import {captureObservedBuildingSource,buildingPlanSignature} from '../../interior/buildingSource';
import {guestBedsForVisit} from '../../../gameplay/lodging';
import {historicalTownLoadJoinError,prepareHistoricalTownLoad,prepareHistoricalTownArrival} from '../../town/prepareHistoricalTownLoad';
import {historicalTownArrivalSignature,historicalTownArrivalUpdate} from '../../town/historicalTownLoadContract';
import type {TownRoster} from '../../roster/types';
import {COMPANIONS} from '../../../../data/companions';

let baseline:GameState,ground:GroundWorld,roster:TownRoster;
function legacyRecordedFounder(){
 const state=structuredClone(baseline);
 const npc=Object.values(state.generatedNpcs).find(raw=>{
  const tag=(raw as {worldforgeHousehold?:{burgId:number;memberId:string}}).worldforgeHousehold;
  return tag?.burgId===188&&roster.occupants.some(p=>p.householdMemberId===tag.memberId&&p.name===raw.name);
 })!;
 const tag=(npc as typeof npc&{worldforgeHousehold:{memberId:string}}).worldforgeHousehold;
 const founder=roster.occupants.find(p=>p.householdMemberId===tag.memberId)!;
 delete state.townSim[188].villagers[founder.id].householdMemberId;
 return {state,npc,founder,memberId:tag.memberId};
}
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
 // GG-603: the frame above reads the current terrain source (revision 2). Since
 // ADR 0015 a save with no terrain revision tries every source, and here both
 // give the same ground, so the producer refuses the match as ambiguous. Record
 // the source this fixture was built on; the layout readers stay unversioned.
 baseline=createMockGameState({worldSeed,worldforgeTerrainRevision:2,gameTime:new Date('0351-01-01T10:00:00Z'),party:[createMockPlayerCharacter({id:'hero'})],
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
 function returnedParty(){
  const state=structuredClone(baseline),c=structuredClone(COMPANIONS.elara_vance),feet=state.playerGroundPos!;
  c.inParty=true;const position={xM:feet.xM+0.1,zM:feet.zM,yM:groundSurfaceY(ground,feet.xM+0.1,feet.zM)},arrival=state.gameTime.getTime()-1000;
  c.whereabouts={worldSeed:state.worldSeed,locationId:state.currentLocationId,source:'party',observedAt:arrival,position};
  c.journey={id:'earned-return',worldSeed:state.worldSeed,from:{cellId:1507,locationId:'cell_1507',position},to:{cellId:1506,locationId:state.currentLocationId},intendedCellId:1506,routeCells:[1507,1506],departedAt:arrival-10000,arrivalAt:arrival,status:'arrived'};
  c.memories=[{id:'earned-return:arrived',type:'event',timestamp:arrival,importance:5,text:'Returned together',tags:['shared-journey','arrived']}];
  state.companions={...state.companions,[c.id]:c};state.party.push(createMockPlayerCharacter({id:c.id}));return state;
 }
 it('independently admits both actual exterior bodies without changing their identities, feet or journey',()=>{
  const state=returnedParty(),before=JSON.stringify(state);
  expect(prepareHistoricalTownLoad(state)).toMatchObject({status:'qualified',burgId:188,revision:1});
  expect(JSON.stringify(state)).toBe(before);
 },120000);
 it.each(['height','wrong-world','remote','no-arrival','unplaced'] as const)('does not admit a companion with unresolved %s evidence',kind=>{
  const state=returnedParty(),c=state.companions.elara_vance;
  if(kind==='height')c.whereabouts!.position!.yM+=0.1;
  if(kind==='wrong-world')c.whereabouts!.worldSeed+=1;
  if(kind==='remote')c.whereabouts!.locationId='cell_1507';
  if(kind==='no-arrival')c.memories=[];
  if(kind==='unplaced')delete c.whereabouts!.position;
  const before=JSON.stringify(state);
  expect(historicalTownLoadJoinError(state,ground,188,1,roster)).toBeTypeOf('string');
  expect(JSON.stringify(state)).toBe(before);
 });
 it('regenerates both readers and qualifies the earlier source without changing the generated saved state',()=>{
  const state=structuredClone(baseline),before=JSON.stringify(state);
  expect(prepareHistoricalTownLoad(state)).toMatchObject({status:'qualified',burgId:188,revision:1,observations:2,founders:237});
  expect(JSON.stringify(state)).toBe(before);expect(state.townSim[188].layoutRevision).toBeUndefined();
 },120000);
 it('matches actual merchants, owned sources, recorded doors and the paid inn visit before mount',()=>{
  expect(historicalTownLoadJoinError(baseline,ground,188,1,roster)).toBeUndefined();
 });
 it.each(['legacy','unrelated-trade','wrong-owner'] as const)('checks the retained registration trade without rewriting stock: %s',kind=>{
  const state=structuredClone(baseline),plan=ground.townPlans!.find(t=>t.burgId===188)!.plan;
  const business=Object.values(state.worldBusinesses).find(b=>{
   const plot=plan.plots.find(p=>p.id===b.plotId);
   return plot&&businessTypeForTownPlot(plot.role,plot.id)!==businessTypeForTownPlot(plot.role,plot.id,plot.pop?.buildingType);
  })!;
  expect(business).toBeDefined();
  const plot=plan.plots.find(p=>p.id===business.plotId)!;
  business.businessType=businessTypeForTownPlot(plot.role,plot.id);
  if(kind==='unrelated-trade')business.businessType=plot.role==='market'?'farm':'enchanter_shop';
  if(kind==='wrong-owner')business.ownerId='unrelated-owner';
  const before=JSON.stringify(state),result=historicalTownLoadJoinError(state,ground,188,1,roster);
  if(kind==='legacy')expect(result).toBeUndefined();
  else expect(result).toContain(kind==='wrong-owner'?'proprietor':'workplace');
  expect(JSON.stringify(state)).toBe(before);
 });
 it.each(['original-home','moved-home'] as const)('joins an unlinked legacy NPC through the qualified founding ID: %s',kind=>{
  const {state,founder}=legacyRecordedFounder();
  if(kind==='moved-home')state.townSim[188].villagers[founder.id].homePlotId=
   roster.occupants.find(p=>p.homePlotId!==founder.homePlotId)!.homePlotId;
  const before=JSON.stringify(state);
  expect(historicalTownLoadJoinError(state,ground,188,1,roster)).toBeUndefined();
  expect(JSON.stringify(state)).toBe(before);
 });
 it.each(['name','recorded-link','duplicate-source-role','duplicate-saved-id'] as const)('refuses a conflicting legacy NPC join: %s',kind=>{
  const {state,npc,founder,memberId}=legacyRecordedFounder(),source=structuredClone(roster);
  if(kind==='name')npc.name='Someone else';
  if(kind==='recorded-link')state.townSim[188].villagers[founder.id].householdMemberId='different:head';
  if(kind==='duplicate-source-role')source.occupants.push({...founder,id:999999,householdMemberId:memberId});
  if(kind==='duplicate-saved-id')state.townSim[188].villagers[999999]={...state.townSim[188].villagers[founder.id]};
  const before=JSON.stringify(state);
  expect(historicalTownLoadJoinError(state,ground,188,1,source)).toContain('recorded character');
  expect(JSON.stringify(state)).toBe(before);
 });
 it.each(['business','proprietor','other-keeper','door','bed','keeper','lore','inn-name','height','interior'] as const)('refuses unresolved %s joins without changing records',kind=>{
  const state=structuredClone(baseline);
  if(kind==='business')state.worldBusinesses.biz_burg_188_plot_8.businessType='farm';
  if(kind==='proprietor')state.worldBusinesses.biz_burg_188_plot_8.ownerId='missing-owner';
  // A real merchant from another workplace is neither the founder nor the sim keeper.
  if(kind==='other-keeper')state.worldBusinesses.biz_burg_188_plot_8.ownerId=Object.values(state.worldBusinesses)
   .find(b=>b.burgId===188&&b.plotId!==8&&b.ownerId!=='player')!.ownerId;
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


describe('recorded destination source before a new arrival',()=>{
  function departure(){const state=structuredClone(baseline);state.playerCell={cellId:1507,localeCoords:null};state.currentLocationId='cell_1507';state.playerGroundPos=null;state.entry3DAnchor={cellId:1507};return state;}
  const target={cellId:1506,anchor:{cellId:1506,centerPx:[376.7,199.25] as const}};
  it.each([3,4] as const)('retains explicitly qualified source %i in the arrival transaction',terrainRevision=>{
    const state=departure();delete state.worldforgeTerrainRevision;
    const before=JSON.stringify(state),receipt={worldSeed:state.worldSeed,cellId:1506,burgId:188,
      revision:1 as const,terrainRevision,signature:historicalTownArrivalSignature(state,188)};
    const update=historicalTownArrivalUpdate(state,1506,receipt);
    expect(update?.worldforgeTerrainRevision).toBe(terrainRevision);
    expect(update?.townSim[188]).toEqual({...state.townSim[188],layoutRevision:1});
    expect(JSON.stringify(state)).toBe(before);
    // An explicit current source cannot be replaced by a historical receipt.
    expect(historicalTownArrivalUpdate({...state,worldforgeTerrainRevision:2},1506,receipt)).toBeUndefined();
  });
  it('independently qualifies the recorded destination before a body exists there and commits only its metadata with normal movement',async()=>{
    const state=departure(),before=JSON.stringify(state),result=prepareHistoricalTownArrival(state,target);
    expect(result.status).toBe('qualified');if(result.status!=='qualified')return;
    expect(result.receipt).toMatchObject({worldSeed:state.worldSeed,cellId:1506,burgId:188,revision:1,terrainRevision:2});
    const update=historicalTownArrivalUpdate(state,1506,result.receipt)!;
    expect(update.townSim[188]).toEqual({...state.townSim[188],layoutRevision:1});
    expect(update.worldforgeTerrainRevision).toBe(2);expect(JSON.stringify(state)).toBe(before);
    const {appReducer}=await import('../../../../state/appState');
    const moved=appReducer(state,{type:'MOVE_PLAYER',payload:{newLocationId:'cell_1506',activeDynamicNpcIds:null,destinationCell:target,townArrivalSource:result.receipt}});
    expect(moved.playerCell?.cellId).toBe(1506);expect(moved.playerGroundPos).toBeNull();expect(moved.townSim[188]).toEqual(update.townSim[188]);
    for(const key of ['inventory','gold','gameTime','npcMemory','worldBusinesses','generatedNpcs'] as const)expect(moved[key]).toEqual(state[key]);
  },120000);
  it.each(['founder','business'] as const)('refuses unresolved %s evidence before creating an arrival',kind=>{
    const state=departure();if(kind==='founder')Object.values(state.townSim[188].villagers)[0].name='Different person';
    else state.worldBusinesses.biz_burg_188_plot_8.businessType='farm';
    const before=JSON.stringify(state);expect(prepareHistoricalTownArrival(state,target)).toMatchObject({status:'unresolved'});expect(JSON.stringify(state)).toBe(before);
  },120000);
  it('does not turn a local source request into an unsupported-body load or relocation',()=>{
    const state=structuredClone(baseline);state.playerGroundPos!.yM!+=.358;const before=JSON.stringify(state);
    expect(prepareHistoricalTownArrival(state,target)).toEqual({status:'not-needed'});
    expect(prepareHistoricalTownLoad(state)).toMatchObject({status:'unresolved'});expect(JSON.stringify(state)).toBe(before);
  },120000);
  it('refuses a source receipt after a record, clock, world or destination changes',()=>{
    const state=departure(),result=prepareHistoricalTownArrival(state,target);expect(result.status).toBe('qualified');if(result.status!=='qualified')return;
    const changed=structuredClone(state);changed.gameTime=new Date(changed.gameTime.getTime()+1000);
    expect(historicalTownArrivalUpdate(changed,1506,result.receipt)).toBeUndefined();
    expect(historicalTownArrivalUpdate(state,1507,result.receipt)).toBeUndefined();
    expect(historicalTownArrivalUpdate({...state,worldSeed:state.worldSeed+1},1506,result.receipt)).toBeUndefined();
    const townChanged=structuredClone(state);Object.values(townChanged.townSim[188].villagers)[0].name='Different person';
    expect(historicalTownArrivalUpdate(townChanged,1506,result.receipt)).toBeUndefined();
  },120000);
});


it('checks a recorded village population even without a merchant or observed interior',()=>{
  const state=structuredClone(baseline);state.playerCell={cellId:1507,localeCoords:null};state.currentLocationId='cell_1507';state.playerGroundPos=null;
  state.worldBusinesses={};state.generatedNpcs={};state.townSim[188].buildingSources={};state.lodgingReservations=[];state.discoveryLog=[];
  Object.values(state.townSim[188].villagers)[0].name='Different founder';const before=JSON.stringify(state);
  expect(prepareHistoricalTownArrival(state,{cellId:1506,anchor:{cellId:1506,centerPx:[376.7,199.25]}})).toMatchObject({status:'unresolved'});
  expect(JSON.stringify(state)).toBe(before);
},120000);
