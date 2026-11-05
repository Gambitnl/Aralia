/** Protocol/transaction proof only. Real generator and site qualification is
 * exercised separately; this fake worker cannot prove terrain or identity. */
import {describe,it,expect,vi} from 'vitest';
import {loadHistoricalTownSource} from '../loadHistoricalTownSource';
import {liveWorkerCount} from '../../../workers/workerClient';
import {createMockGameState} from '../../../utils/core/factories';
import type {HistoricalTownLoadResult} from '../../../systems/worldforge/town/historicalTownLoadContract';
import type {ObservedBuildingSource} from '../../../systems/worldforge/interior/buildingSource';

class FakeWorker {
 onmessage:((event:{data:unknown})=>void)|null=null;
 onerror:((event:unknown)=>void)|null=null;
 onmessageerror:((event:unknown)=>void)|null=null;
 terminated=false;
 sent:unknown[]=[];
 postMessage(message:unknown){this.sent.push(message);}
 emit(result:HistoricalTownLoadResult,id=1){this.onmessage?.({data:{type:'historicalTownLoad',id,result}});}
 terminate(){this.terminated=true;}
}
function fixture(){
 // Only the source cell is relevant to this storage/worker protocol fixture.
 // The worker's independent source-validation suite owns the complete record.
 const source={cellId:9} as ObservedBuildingSource;
 const person={occupantId:1,name:'Mara',race:'Human',bornDay:-9000,homePlotId:1,parentIds:[],childIds:[],wealth:20};
 return createMockGameState({worldSeed:77,worldforgeTerrainRevision:2,playerCell:{cellId:9,localeCoords:null},
  playerGroundPos:{tileX:9,tileY:0,xM:20,zM:30,yM:2},
  townSim:{8:{burgId:8,villagers:{1:person},buildingSources:{1:source},
   chronicle:{burgId:8,events:[],nextEventId:1},lastSimDay:1,nextVillagerId:2}}});
}
const qualified={status:'qualified',burgId:8,revision:1,terrainRevision:2,observations:1,founders:1,surfaceY:2} as const;

describe('saved-town one-shot load transaction',()=>{
 it.each([3,4] as const)('copies qualified source %i metadata without changing the campaign or body',async terrainRevision=>{
  const state=fixture(),worker=new FakeWorker();delete state.worldforgeTerrainRevision;
  const before=JSON.stringify(state);
  const pending=loadHistoricalTownSource(state,{workerFactory:()=>worker as unknown as Worker});
  worker.emit({...qualified,terrainRevision});
  const admitted=await pending;
  expect(admitted.result.status).toBe('qualified');
  expect(admitted.state.worldforgeTerrainRevision).toBe(terrainRevision);
  expect(admitted.state.townSim[8]).toEqual({...state.townSim[8],layoutRevision:1});
  for(const key of Object.keys(state) as Array<keyof typeof state>){
   if(key!=='townSim'&&key!=='worldforgeTerrainRevision')expect(admitted.state[key]).toBe(state[key]);
  }
  expect(JSON.stringify(state)).toBe(before);expect(worker.terminated).toBe(true);
 });
 it('checks a pre-capture played exterior and copies only its qualified cell-affine revision',async()=>{
  const state=fixture();state.townSim[8].buildingSources={};delete state.worldforgeTerrainRevision;
  state.worldBusinesses={legacy:{id:'legacy',burgId:8,locationId:'cell_9'} as never};
  const worker=new FakeWorker(),before=JSON.stringify(state);
  const pending=loadHistoricalTownSource(state,{workerFactory:()=>worker as unknown as Worker});
  expect(worker.sent).toHaveLength(1);
  worker.emit({...qualified,revision:4,terrainRevision:1,observations:0});
  const admitted=await pending;
  expect(admitted.state.townSim[8].layoutRevision).toBe(4);
  expect(admitted.state.worldforgeTerrainRevision).toBe(1);
  expect(admitted.state.worldBusinesses).toBe(state.worldBusinesses);
  expect(admitted.state.playerGroundPos).toBe(state.playerGroundPos);
  expect(JSON.stringify(state)).toBe(before);
 });
 it('does not infer unknown terrain from a qualified town number without terrain evidence',async()=>{
  const state=fixture(),worker=new FakeWorker();delete state.worldforgeTerrainRevision;
  const pending=loadHistoricalTownSource(state,{workerFactory:()=>worker as unknown as Worker});
  const {terrainRevision:_notSupplied,...townOnly}=qualified;worker.emit(townOnly);
  expect((await pending).result.status).toBe('unresolved');expect(state.worldforgeTerrainRevision).toBeUndefined();
 });
 it('keeps an already recorded terrain source when a worker proposes another one',async()=>{
  const state=fixture(),worker=new FakeWorker(),before=JSON.stringify(state);
  const pending=loadHistoricalTownSource(state,{workerFactory:()=>worker as unknown as Worker});
  worker.emit({...qualified,terrainRevision:1});expect((await pending).result.status).toBe('unresolved');
  expect(JSON.stringify(state)).toBe(before);
 });
 it('does not mistake another cell business for local historical evidence',async()=>{
  const state=fixture();state.townSim[8].buildingSources={};
  state.worldBusinesses={elsewhere:{id:'elsewhere',burgId:8,locationId:'cell_10'} as never};
  const factory=vi.fn();expect((await loadHistoricalTownSource(state,{workerFactory:factory})).result.status).toBe('not-needed');
  expect(factory).not.toHaveBeenCalled();
 });
 it('skips the worker for new, known and unobserved saves without adding a revision',async()=>{
  const factory=vi.fn();const state=fixture();state.townSim[8].buildingSources={};
  expect(await loadHistoricalTownSource(state,{workerFactory:factory})).toEqual({state,result:{status:'not-needed'}});
  expect(factory).not.toHaveBeenCalled();expect(state.townSim[8].layoutRevision).toBeUndefined();
  state.townSim[8].layoutRevision=2;
  await loadHistoricalTownSource(state,{workerFactory:factory});expect(factory).not.toHaveBeenCalled();
 });
 it('copies only the selected town revision and terminates its worker without writing storage or moving feet',async()=>{
  const state=fixture(),before=JSON.stringify(state),worker=new FakeWorker(),count=liveWorkerCount();
  const pending=loadHistoricalTownSource(state,{workerFactory:()=>worker as unknown as Worker});
  expect(worker.sent).toEqual([{type:'historicalTownLoad',id:1,state}]);
  worker.emit(qualified);const admitted=await pending;
  expect(admitted.state.townSim[8].layoutRevision).toBe(1);
  expect(admitted.state.townSim[8].buildingSources).toBe(state.townSim[8].buildingSources);
  for(const key of Object.keys(state) as (keyof typeof state)[]){if(key!=='townSim')expect(admitted.state[key]).toBe(state[key]);}
  const town={...admitted.state.townSim[8]};delete town.layoutRevision;
  expect(town).toEqual(state.townSim[8]);expect(JSON.stringify(state)).toBe(before);
  expect(worker.terminated).toBe(true);expect(liveWorkerCount()).toBe(count);
 });
 it('preserves the input and original refusal when the worker cannot qualify a town',async()=>{
  const state=fixture(),worker=new FakeWorker(),before=JSON.stringify(state);
  const pending=loadHistoricalTownSource(state,{workerFactory:()=>worker as unknown as Worker});
  const refusal={status:'unresolved',message:'The remembered library does not match.'} as const;
  worker.emit(refusal);expect(await pending).toEqual({state,result:refusal});
  expect(JSON.stringify(state)).toBe(before);expect(worker.terminated).toBe(true);
 });
 it('ignores another request ID before settling its own result',async()=>{
  const worker=new FakeWorker(),pending=loadHistoricalTownSource(fixture(),{workerFactory:()=>worker as unknown as Worker});
  worker.emit(qualified,2);expect(worker.terminated).toBe(false);
  worker.emit(qualified);expect((await pending).result).toEqual(qualified);expect(worker.terminated).toBe(true);
 });
 it.each(['height','burg','revision','count','founders','not-needed'] as const)('refuses a mismatched worker result: %s',async kind=>{
  const state=fixture(),worker=new FakeWorker(),before=JSON.stringify(state);
  const pending=loadHistoricalTownSource(state,{workerFactory:()=>worker as unknown as Worker});
  const result:HistoricalTownLoadResult=kind==='not-needed'?{status:'not-needed'}:{...qualified,
   ...(kind==='height'?{surfaceY:3}:{}),...(kind==='burg'?{burgId:10}:{}),
   ...(kind==='revision'?{revision:99 as 1}:{}),...(kind==='count'?{observations:2}:{}),
   ...(kind==='founders'?{founders:2}:{})};
  worker.emit(result);const admission=await pending;
  expect(admission.result.status).toBe('unresolved');expect(admission.state).toBe(state);
  expect(JSON.stringify(state)).toBe(before);expect(worker.terminated).toBe(true);
 });
 it('refuses a result after its input changes, without overwriting that change',async()=>{
  const state=fixture(),worker=new FakeWorker();
  const pending=loadHistoricalTownSource(state,{workerFactory:()=>worker as unknown as Worker});
  state.gold+=1;worker.emit(qualified);const admission=await pending;
  expect(admission.result).toMatchObject({status:'unresolved'});expect(admission.state).toBe(state);
  expect(state.townSim[8].layoutRevision).toBeUndefined();
 });
 it.each(['reported','crash','abort'] as const)('rejects and cleans up on %s failure',async kind=>{
  const worker=new FakeWorker(),count=liveWorkerCount(),abort=new AbortController();
  const pending=loadHistoricalTownSource(fixture(),{workerFactory:()=>worker as unknown as Worker,signal:abort.signal});
  const rejected=expect(pending).rejects.toThrow();
  if(kind==='reported')worker.onmessage?.({data:{type:'error',id:1,message:'Candidate source failed.'}});
  if(kind==='crash')worker.onerror?.({message:'worker crashed'});
  if(kind==='abort')abort.abort();
  await rejected;expect(worker.terminated).toBe(true);expect(liveWorkerCount()).toBe(count);
 });
});
