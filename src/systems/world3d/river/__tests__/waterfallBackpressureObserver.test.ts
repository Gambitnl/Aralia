/** Synthetic guard and transaction evidence only. These checks do not advance
 * the native waterfall or qualify the prescribed-outflow closure physically. */
import {describe,it,expect,vi} from 'vitest';
import {FilmBackpressureObserver,FilmBackpressureFailure,backpressureNumericValue,type BackpressureGuardOperands} from '../waterfallBackpressureObserver';
import {WaterfallContactFlow,type ContactOriginalReleaseRouting} from '../waterfallContactFlow';
import {WaterfallContactFilm} from '../waterfallContactFilm';
import {FOUR_LAYER_FILM_MODE,diffuseFilmLayers,type FilmLayerColumn} from '../waterfallLayeredFilm';
import {FINITE_SOURCE_SUPPORT_MODE} from '../waterfallSourceSupport';
import type {FiniteSourceSample} from '../waterfallSourceSupport';
const column:FilmLayerColumn={volumes:[.001,.001,.001,.001],momenta:[[0,0,0],[5,0,0],[5,0,0],[5,0,0]]};
const operands=(changes:Partial<BackpressureGuardOperands>={}):BackpressureGuardOperands=>({cell:0,sampleIndex:3,side:'plus',sample:{originalId:17},port:{velocity:[5,0,0],normal:[1,0,0],height:.0001},column:structuredClone(column),area:1,bed:600,gn:9.81,rho:1000,H:.004,up:5,slowest:0,mapping:{face:7},...changes});
const arm=()=>{const observer=new FilmBackpressureObserver();observer.tick(4);observer.beginTick(.1,.02,{faces:[{left:0,right:1}]});observer.beginSubstep(0,.1,.11,[column,column]);return observer;};
describe('first finite source backpressure observer',()=>{
  it('separates port, receiver and combined margins with consumed P/(rho V)',()=>{
    for(const [input,label] of [[operands(),'receiver-margin-nonpositive'],[operands({up:.001,H:0}),'both-margins-nonpositive'],[operands({up:.001,slowest:5}),'port-margin-nonpositive']] as const){
      const report=arm().reject(input),w=report.witness as {guard:{classification:string;layers:{velocity:number[]}[]}};
      expect(w.guard.classification).toBe(label);expect(w.guard.layers[1].velocity).toEqual([5,0,0]);
    }
  });
  it('retains one preceding generation, actual operation operands and last passing same receiver by value',()=>{
    const observer=arm();observer.operation({cell:0,kind:'actual-face',momentum:[-0,2,3]});observer.stage('horizontal',[column,column]);observer.stage('gravity',[column,column]);
    observer.vertical(0,column,column,column,{wallImpulse:[1,2,3],internalImpulses:[{onLower:[4,5,6]}]});observer.completeSubstep();observer.beginSubstep(1,.11,.12,[column,column]);
    const input=operands();observer.pass(input);input.sample={originalId:99};const diagnostic=observer.reject(input);input.column.momenta[1][0]=999;
    const w=diagnostic.witness as {lastPassingSameGeneration:{sample:{originalId:number}};precedingCompletedSubstep:{cells:unknown[];operations:unknown[]};guard:{column:FilmLayerColumn}};
    expect(w.lastPassingSameGeneration.sample.originalId).toBe(17);expect(w.precedingCompletedSubstep.cells).toHaveLength(2);expect(w.precedingCompletedSubstep.operations).toHaveLength(1);expect(w.guard.column.momenta[1][0]).toBe(5);
    expect(diagnostic.complete).toBe(false);expect(diagnostic.failures).toContain('backpressure-incomplete-preceding-cell:1');
    (observer.report().witness as {guard:{cell:number}}).guard.cell=999;expect(observer.report()).toEqual(diagnostic);
  });
  it('a complete preceding stage buffer and explicit first-substep absence are distinguished',()=>{
    const first=arm().reject(operands());expect(first.complete).toBe(true);expect(first.witness).toMatchObject({precedingStatus:'first-substep-no-preceding'});
    const observer=arm();observer.stage('horizontal',[column,column]);observer.stage('gravity',[column,column]);for(const cell of [0,1])observer.vertical(cell,column,column,column,{wallImpulse:[0,0,0],internalImpulses:[]});observer.completeSubstep();observer.beginSubstep(1,.11,.12,[column,column]);expect(observer.reject(operands()).complete).toBe(true);
    const failed=arm();failed.vertical(0,column,column,column,{observationError:'synthetic'});expect(failed.reject(operands()).complete).toBe(false);
  });
  it('encodes signed zero and nonfinite numbers before JSON and marks overflow incomplete',()=>{
    const encoded=backpressureNumericValue([-0,NaN,Infinity,-Infinity]);expect(JSON.parse(JSON.stringify(encoded))).toEqual([{number:'-0'},{number:'NaN'},{number:'+Infinity'},{number:'-Infinity'}]);
    const observer=arm();observer.limits.records=0;observer.operation({cell:0,kind:'too-many'});expect(observer.reject(operands()).complete).toBe(false);
  });
  const routing:ContactOriginalReleaseRouting={ownerId:'observer-unit-terminal',capacity:1000,select:rows=>rows.map(r=>r.id)};
  const make=()=>new WaterfallContactFlow({startTime:0,dt:1/120,parcelsPerStep:2,impactMode:'junction',filmMode:FOUR_LAYER_FILM_MODE,sourceSupportMode:FINITE_SOURCE_SUPPORT_MODE,originalReleaseRouting:routing});
  const source={q:.006,width:10,depth:.7,speed:.1,top:78,pool:18};
  it('observer on and off preserve the same accepted physical checkpoint',()=>{
    const a=make(),b=make();a.advanceTo(1/120,()=>source);b.advanceTo(1/120,()=>source);b.armBackpressureObservation(new FilmBackpressureObserver());
    a.advanceTo(2/120,()=>source);b.advanceTo(2/120,()=>source);const sa=a.saveState(),sb=b.saveState();sa.snapshot.receipt.lastAdvanceMilliseconds=sb.snapshot.receipt.lastAdvanceMilliseconds=0;expect(sa).toEqual(sb);
  });
  it('typed rejected operands survive compact rollback and public checkpoint copies',()=>{
    const flow=make();flow.advanceTo(1/120,()=>source);const before=flow.saveState(),observer=arm(),diagnostic=observer.reject(operands());
    const film=(flow as unknown as {film:WaterfallContactFilm}).film,spy=vi.spyOn(film,'advance').mockImplementation(()=>{throw new FilmBackpressureFailure(diagnostic);});
    flow.advanceTo(2/120,()=>source);spy.mockRestore();const after=flow.saveState();expect(after.snapshot.parcels).toEqual(before.snapshot.parcels);expect(after.filmState).toEqual(before.filmState);expect(after.snapshot.receipt.failureDiagnostic).toEqual(diagnostic);
    (after.snapshot.receipt.failureDiagnostic as {stage:string}).stage='mutated';expect(flow.snapshot().receipt.failureDiagnostic).toEqual(diagnostic);
  });
  it('observed diffusion stress operands do not alter physical output, including weak stress',()=>{
    for(const dt of [.001,1e-300]){const wet={volumes:[1,1,1,1],momenta:[[1,0,0],[2,0,0],[3,0,0],[4,0,0]]} as FilmLayerColumn;let captured:unknown;
      const off=diffuseFilmLayers(wet,1,dt),on=diffuseFilmLayers(wet,1,dt,{observeDiffusion:value=>{captured=value;}});expect(on).toEqual(off);expect(captured).toMatchObject({stressQualification:'read-only reconstruction of solved equation'});
    }
  });
  it('the actual finite guard keeps its original rejection and physical state with observation off/on',()=>{
    for(const receiver of [false,true]){
      const reports:unknown[]=[];
      for(const observed of [false,true]){
        const film=new WaterfallContactFilm({id:'synthetic-horizontal',vertices:[[0,0,0],[2,0,0],[2,0,2],[0,0,2]],normal:[0,1,0]},2,2,64,.35,FOUR_LAYER_FILM_MODE);
        const internals=film as unknown as {faces:{left:number;right:number}[];volumes:number[];layered:{columns:FilmLayerColumn[]};applyFiniteSourceSample(sample:FiniteSourceSample,next:FilmLayerColumn[],start:number,end:number,observation?:{sampleIndex:number;ordinaryChordMeasure:number;coveredChordMeasure:number}):void};
        const face=internals.faces.findIndex(f=>f.left>=0&&f.right>=0),cell=internals.faces[face].left;
        if(receiver){internals.layered.columns[cell]=structuredClone(column);internals.volumes[cell]=.004;}
        const port={volume:1e-6,velocity:[receiver?5:.001,0,0] as [number,number,number],normal:[1,0,0] as [number,number,number],height:.0001,advectiveMomentum:[0,0,0] as [number,number,number],pressureImpulse:[0,0,0] as [number,number,number],pressureWork:0,profileKinetic:0,potential:0,advectiveEnergy:0,energy:0};
        const sample:FiniteSourceSample={originalId:19,face,position:[1,0,1],arrivalTimeMean:0,incoming:{volume:0,momentum:[0,0,0],positionMoment:[0,0,0],kinetic:0,potential:0,arrivalTimeMoment:0},measureLengthTime:.01,strikeJacobian:1,minus:port,plus:port,reaction:[0,0,0]};
        if(observed){film.backpressureObserver=new FilmBackpressureObserver();film.backpressureObserver.beginTick(0,.01,{faces:internals.faces});film.backpressureObserver.beginSubstep(0,0,.01,internals.layered.columns);}
        const before=film.saveState();try{internals.applyFiniteSourceSample(sample,structuredClone(internals.layered.columns),0,.01,observed?{sampleIndex:0,ordinaryChordMeasure:0,coveredChordMeasure:.01}:undefined);throw Error('missing guard');}
        catch(error){expect((error as Error).message).toBe('film-junction-backpressure');if(observed){expect(error).toBeInstanceOf(FilmBackpressureFailure);reports.push((error as FilmBackpressureFailure).diagnostic.witness);}}
        expect(film.saveState()).toEqual(before);
      }
      expect(reports[0]).toMatchObject({guard:{passed:false,classification:receiver?'receiver-margin-nonpositive':'both-margins-nonpositive'}});
    }
  });
});
