/** Directions must belong to the speaking resident's actual town and public workplace. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockGameState } from '../../../utils/core/factories';
import type { GameState, RichNPC } from '../../../types';
import { resolveNpcLocalDirections, resolveNpcLocalStockDirections } from '../npcLocalDirections';

const source = vi.hoisted(() => ({ present: true, alive: true, x: 300, y: -300,
  revisions:[] as unknown[], home: 'b143', residential: false, valid: true, cell: 1885, onDuty:true,
  visitArgs:[] as unknown[][], attendanceArgs:[] as unknown[][], gates:[] as Array<[number,number]> }));
vi.mock('../../worldforge/bridge/legacySubmapBridge', () => ({ getBridgeAtlas: () => ({
  pack: { burgs: { 253: { i: 253, cell: source.cell, name: 'Putivl' } } },
}) }));
vi.mock('../../worldforge/townsim/chronicleForLocation', () => ({ burgIdForLocation: () => source.present ? 253 : undefined }));
vi.mock('../../worldforge/townsim/householdNpc', async importOriginal => ({ ...(await importOriginal() as object), householdNpcAliveAt: () => source.alive }));
vi.mock('../../economy/businessAttendance',()=>({attendanceForVisit:(...args:unknown[])=>{source.attendanceArgs.push(args);return {open:source.onDuty};}}));
vi.mock('../../worldforge/town/townBuildingVisit',()=>({townBuildingVisit:(...args:unknown[])=>{source.visitArgs.push(args);const plotId=args[2] as number;return {plot:{id:plotId,role:'market'},household:{homeId:'b143',members:[{role:'head',name:'Hilda Fairbourne'}]}};}}));
vi.mock('../../worldforge/town/canonicalTown', () => ({ townSpanFtForBurg: () => 1000,
  canonicalArtifactTownForSiteFromAtlas: (_atlas:unknown,_seed:number,_site:unknown,revision?:unknown) => (source.revisions.push(revision),{ plan: { plots: [{ id: 27, role: 'market',
    footprint: source.valid ? [[source.x-5,source.y-5],[source.x+5,source.y-5],[source.x+5,source.y+5],[source.x-5,source.y+5]] : [[NaN,0]],
    pop: { buildingType: 'tavern', residential: source.residential, proprietorHomeId: source.home },
  }],gates:source.gates } }),
}));
const make = () => {
  const npc = { id:'hilda', name:'Hilda Fairbourne', businessId:'tavern', role:'merchant',
    worldforgeHousehold:{burgId:253,memberId:'b143:head'} } as unknown as RichNPC & {
      worldforgeHousehold:{burgId:number;memberId:string};
    };
  const state = createMockGameState({worldSeed:7,currentLocationId:'cell_1885',playerCell:{cellId:1885,localeCoords:{x:0,y:0}},
    generatedNpcs:{hilda:npc},worldBusinesses:{tavern:{id:'tavern',name:'The Gilded Wonders',ownerId:'hilda',
      burgId:253,plotId:27,locationId:'cell_1885',businessType:'enchanter_shop'}} as unknown as GameState['worldBusinesses']});
  return {state,npc};
};
beforeEach(() => Object.assign(source,{revisions:[],present:true,alive:true,x:300,y:-300,home:'b143',residential:false,valid:true,cell:1885,onDuty:true,visitArgs:[],attendanceArgs:[],gates:[]}));
describe('source-bound local directions', () => {
  it('uses the fitted tavern and north-up geometry, not a legacy enchanter ledger', () => {
    const {state,npc}=make(),before=JSON.stringify(state);
    expect(resolveNpcLocalDirections(state,npc)).toBe("You're in Putivl. The Gilded Wonders is my tavern, in the northeastern part of town.");
    expect(JSON.stringify(state)).toBe(before);
  });
  it.each([[0,-300,'northern'],[300,0,'eastern'],[0,300,'southern'],[-300,0,'western'],
    [-300,-300,'northwestern'],[-300,300,'southwestern'],[300,300,'southeastern']] as const)('keeps map orientation at %s/%s', (x,y,sector) => {
    Object.assign(source,{x,y}); const {state,npc}=make();
    expect(resolveNpcLocalDirections(state,npc)).toContain(`in the ${sector} part of town`);
  });
  it('calls a central workplace central rather than assigning an arbitrary north bearing', () => {
    Object.assign(source,{x:0,y:0}); const {state,npc}=make();
    expect(resolveNpcLocalDirections(state,npc)).toContain('near the town center');
  });
  it.each(['outside','dead','foreign-cell'] as const)('does not claim local presence for %s', kind => {
    if(kind==='outside')source.present=false;
    if(kind==='dead')source.alive=false;
    if(kind==='foreign-cell')source.cell=9;
    const {state,npc}=make(); expect(resolveNpcLocalDirections(state,npc)).toBeUndefined();
  });
  it.each(['private-home','different-household','invalid-footprint'] as const)('withholds workplace directions for %s', kind => {
    if(kind==='private-home')source.residential=true;
    if(kind==='different-household')source.home='b999';
    if(kind==='invalid-footprint')source.valid=false;
    const {state,npc}=make(); expect(resolveNpcLocalDirections(state,npc)).toBe("You're in Putivl.");
  });
  it('does not borrow another owner or foreign town business', () => {
    const {state,npc}=make(); state.worldBusinesses.tavern.ownerId='someone-else';
    expect(resolveNpcLocalDirections(state,npc)).toBe("You're in Putivl.");
    state.worldBusinesses.tavern.ownerId=npc.id; state.worldBusinesses.tavern.burgId=99;
    expect(resolveNpcLocalDirections(state,npc)).toBe("You're in Putivl.");
  });
  it('retains authored directions and identity uncertainty', () => {
    source.gates=[[-300,-300]];
    const {state,npc}=make(); npc.knowledgeProfile={baseOpenness:0,topicOverrides:{global_directions:{known:true,willingnessModifier:-10}}};
    expect(resolveNpcLocalDirections(state,npc)).toBeUndefined();
    delete npc.knowledgeProfile;
    expect(resolveNpcLocalDirections(state,{...npc,name:'Different person'})).toBeUndefined();
  });
  it('gives a non-owner the actual public gate numbers without borrowing another business',()=>{
    const {state,npc}=make();state.worldBusinesses.tavern.ownerId='someone-else';
    source.gates=[[-300,-300],[300,0]];
    const before=JSON.stringify(state);
    expect(resolveNpcLocalDirections(state,npc)).toBe("You're in Putivl. Gate 1 is in the northwestern part of town. Gate 2 is in the eastern part of town.");
    expect(JSON.stringify(state)).toBe(before);
  });
  it.each(([[[NaN,1]],[[10,20],[10,20]],[[0,0]]] as Array<Array<[number,number]>>).map(gates=>({gates})))('withholds ambiguous or malformed public gate geometry $gates',({gates})=>{
    const {state,npc}=make();state.worldBusinesses={};source.gates=gates;
    expect(resolveNpcLocalDirections(state,npc)).toBe("You're in Putivl.");
  });
});

describe('saved business direction layout',()=>{
 it('reads the saved earlier workplace plan and retains its owned name',()=>{
  const {state,npc}=make();state.townSim={253:{burgId:253,layoutRevision:1,villagers:{},chronicle:{burgId:253,events:[],nextEventId:1},lastSimDay:0,nextVillagerId:1}};
  const before=JSON.stringify(state);expect(resolveNpcLocalDirections(state,npc)).toContain('The Gilded Wonders is my tavern');
  expect(source.revisions).toEqual([1]);expect(JSON.stringify(state)).toBe(before);
 });
 it('keeps a verified town name without inventing directions from an unresolved layout',()=>{
  source.gates=[[-300,-300]];
  const {state,npc}=make();state.townSim={253:{burgId:253,villagers:{},chronicle:{burgId:253,events:[],nextEventId:1},lastSimDay:0,nextVillagerId:1}};
  expect(resolveNpcLocalDirections(state,npc)).toBe("You're in Putivl.");expect(source.revisions).toEqual([]);
 });
});

describe('source-bound local stock directions',()=>{
 it('names only one open, explicitly linked seller with persisted stock',()=>{
  const {state,npc}=make();
  const event={saved:'event'},buildingSource={saved:'source'};
  state.townSim={253:{burgId:253,layoutRevision:1,villagers:{7:{occupantId:7,name:'Hilda Fairbourne',bornDay:0,homePlotId:143,householdMemberId:'b143:head'}},shops:{27:{keeperId:7,sinceDay:0}},buildingEvents:{27:event},buildingSources:{27:buildingSource},chronicle:{burgId:253,events:[],nextEventId:1},lastSimDay:0,nextVillagerId:8}} as unknown as GameState['townSim'];
  state.worldBusinesses={tavern:{id:'tavern',name:'The Gilded Wonders',ownerId:'hilda',ownerType:'npc',burgId:253,plotId:27,locationId:'cell_1885',stock:[{itemId:'rations',quantity:4}]}} as unknown as GameState['worldBusinesses'];
  expect(resolveNpcLocalStockDirections(state,npc,'rations')).toMatchObject({status:'found',businessId:'tavern',itemId:'rations'});
  expect(source.visitArgs[0]).toEqual([state.worldSeed,253,27,event,buildingSource,1]);
  expect(source.attendanceArgs[0][1]).toBe(new Date(state.gameTime).getUTCHours());
 });
 it('does not let a nearby resident read another owner’s private stock',()=>{
  const {state,npc}=make();
  state.townSim={253:{burgId:253,layoutRevision:1,villagers:{7:{occupantId:7,name:'Keeper',bornDay:0,homePlotId:143,householdMemberId:'b143:head'}},shops:{27:{keeperId:7,sinceDay:0}},chronicle:{burgId:253,events:[],nextEventId:1},lastSimDay:0,nextVillagerId:8}} as unknown as GameState['townSim'];
  state.generatedNpcs.keeper={id:'keeper',name:'Keeper',worldforgeHousehold:{burgId:253,memberId:'b143:head'}} as unknown as RichNPC;
  state.worldBusinesses={seller:{id:'seller',name:'The Provisions',ownerId:'keeper',ownerType:'npc',burgId:253,plotId:27,locationId:'cell_1885',stock:[{itemId:'rations',quantity:4}]}} as unknown as GameState['worldBusinesses'];
  expect(resolveNpcLocalStockDirections(state,npc,'rations')).toMatchObject({status:'unknown'});
 });
 it('does not infer a seller from a zero-stock, closed, or unlinked business',()=>{
  const {state,npc}=make();
  state.townSim={253:{burgId:253,layoutRevision:1,villagers:{7:{occupantId:7,name:'Keeper',bornDay:0}},shops:{27:{keeperId:null,sinceDay:0,closedDay:1}},chronicle:{burgId:253,events:[],nextEventId:1},lastSimDay:0,nextVillagerId:8}} as unknown as GameState['townSim'];
  expect(resolveNpcLocalStockDirections(state,npc,'rations')).toMatchObject({status:'unknown'});
 });
 it.each(['missing-stock','zero-stock','bad-owner-join','guarded-speaker'] as const)('withholds %s inventory',kind=>{
  const {state,npc}=make();state.townSim={253:{burgId:253,layoutRevision:1,villagers:{7:{occupantId:7,name:'Keeper',bornDay:0,homePlotId:143,householdMemberId:'b143:head'}},shops:{27:{keeperId:7,sinceDay:0}},chronicle:{burgId:253,events:[],nextEventId:1},lastSimDay:0,nextVillagerId:8}} as unknown as GameState['townSim'];
  if(kind==='bad-owner-join')npc.worldforgeHousehold={burgId:253,memberId:'b999:head'};
  state.worldBusinesses={seller:{id:'seller',name:'The Provisions',ownerId:'hilda',ownerType:'npc',burgId:253,plotId:27,locationId:'cell_1885',...(kind==='missing-stock'?{}:{stock:[{itemId:'rations',quantity:kind==='zero-stock'?0:4}]})}} as unknown as GameState['worldBusinesses'];
  if(kind==='guarded-speaker')npc.knowledgeProfile={baseOpenness:0,topicOverrides:{global_directions:{known:true,willingnessModifier:0}}};
  expect(resolveNpcLocalStockDirections(state,npc,'rations')).toMatchObject({status:'unknown'});
 });
 it('withholds stock when more than one current seller matches',()=>{
  const {state,npc}=make();state.townSim={253:{burgId:253,layoutRevision:1,villagers:{7:{occupantId:7,name:'Keeper',bornDay:0,homePlotId:143,householdMemberId:'b143:head'}},shops:{27:{keeperId:7,sinceDay:0}},chronicle:{burgId:253,events:[],nextEventId:1},lastSimDay:0,nextVillagerId:8}} as unknown as GameState['townSim'];
  const seller={ownerId:'hilda',ownerType:'npc',burgId:253,plotId:27,locationId:'cell_1885',stock:[{itemId:'rations',quantity:4}]};
  state.worldBusinesses={one:{...seller,id:'one',name:'One'},two:{...seller,id:'two',name:'Two'}} as unknown as GameState['worldBusinesses'];
  expect(resolveNpcLocalStockDirections(state,npc,'rations')).toMatchObject({status:'unknown'});
 });
 it('does not call a living off-duty keeper an open shop',()=>{
  source.onDuty=false;const {state,npc}=make();
  state.townSim={253:{burgId:253,layoutRevision:1,villagers:{7:{occupantId:7,name:'Hilda Fairbourne',bornDay:0,homePlotId:143,householdMemberId:'b143:head'}},shops:{27:{keeperId:7,sinceDay:0}},buildingEvents:{27:{saved:true}},buildingSources:{27:{kind:'observed'}},chronicle:{burgId:253,events:[],nextEventId:1},lastSimDay:0,nextVillagerId:8}} as unknown as GameState['townSim'];
  state.worldBusinesses={tavern:{id:'tavern',name:'The Gilded Wonders',ownerId:'hilda',ownerType:'npc',burgId:253,plotId:27,locationId:'cell_1885',stock:[{itemId:'rations',quantity:4}]}} as unknown as GameState['worldBusinesses'];
  expect(resolveNpcLocalStockDirections(state,npc,'rations')).toMatchObject({status:'unknown'});
 });
});
