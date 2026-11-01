/** One attempted Film tick's first prescribed-outflow rejection. The observer
 * keeps one preceding substep and the current assembly, then extracts the
 * receiver and incident neighbours. It never supplies values to the solver.
 * Signed zero and invalid numbers remain explicit in the detached JSON receipt.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/10/2026, 23:42:22
 * Dependents: systems/world3d/river/waterfallContactFilm.ts, systems/world3d/river/waterfallContactFlow.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { ContactVec3 } from './waterfallContactFlow';
import type { FilmLayerColumn } from './waterfallLayeredFilm';
export function backpressureNumericValue(value: unknown): unknown {
  if (typeof value === 'number') return Number.isNaN(value) ? { number: 'NaN' } : value === Infinity ? { number: '+Infinity' } : value === -Infinity ? { number: '-Infinity' } : Object.is(value,-0) ? { number: '-0' } : value;
  if (Array.isArray(value)) return value.map(backpressureNumericValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,backpressureNumericValue(v)]));
  return value;
}
export interface BackpressureGuardOperands {
  cell: number; sampleIndex: number; side: 'minus' | 'plus'; sample: unknown;
  port: { velocity: ContactVec3; normal: ContactVec3; height: number };
  column: FilmLayerColumn; area: number; bed: number; gn: number; rho: number;
  H: number; up: number; slowest: number; mapping: unknown;
}
interface Frame { index:number; start:number; end:number; before:FilmLayerColumn[]; horizontal?:FilmLayerColumn[]; gravity?:FilmLayerColumn[]; vertical:{cell:number;before:FilmLayerColumn;remapped:FilmLayerColumn;diffused:FilmLayerColumn;stress:unknown}[]; operations:{cell:number;[key:string]:unknown}[]; records:number; bytes:number }
export interface FilmBackpressureDiagnostic { stage:'finite-source-backpressure'; reason:'film-junction-backpressure'; complete:boolean; failures:string[]; witness:unknown }
export class FilmBackpressureFailure extends Error { constructor(readonly diagnostic:FilmBackpressureDiagnostic){super('film-junction-backpressure');} }
export class FilmBackpressureObserver {
  readonly limits={cells:512,records:350000,estimatedRawBytes:128*1024*1024};
  private clock:unknown; private outerTick=0; private used=false; private closed=false;
  private geometry:unknown; private previous?:Frame; private current?:Frame;
  private passing=new Map<number,unknown>(); private diagnostic?:FilmBackpressureDiagnostic;
  private failures:string[]=[]; private bytes=0; private geometryBytes=0;
  tick(index:number){this.outerTick=index;}
  private safe(work:()=>void){try{work();}catch(e){if(this.failures.length<8)this.failures.push(e instanceof Error?e.message:String(e));}}
  private copy<T>(value:T):T {
    const size=(v:unknown):number=>typeof v==='number'?8:typeof v==='string'?16+v.length*2:v&&typeof v==='object'?32+Object.values(v).reduce<number>((s,x)=>s+size(x),0):8;
    this.bytes+=size(value);if(this.bytes>this.limits.estimatedRawBytes)throw Error('backpressure-observer-byte-capacity');return structuredClone(value);
  }
  beginTick(start:number,duration:number,geometry:unknown){this.safe(()=>{if(this.used)return;this.used=true;this.clock={outerTick:this.outerTick,start,end:start+duration};this.geometry=this.copy(geometry);this.geometryBytes=this.bytes;});}
  beginSubstep(index:number,start:number,end:number,columns:FilmLayerColumn[]){this.safe(()=>{
    if(this.closed)return;if(columns.length>this.limits.cells||index>=64)throw Error('backpressure-observer-mesh-capacity');
    this.bytes=this.geometryBytes+(this.previous?.bytes??0);this.passing.clear();this.current={index,start,end,before:this.copy(columns),vertical:[],operations:[],records:0,bytes:0};
  });}
  operation(row:{cell:number;[key:string]:unknown}){this.safe(()=>{if(!this.current||this.closed)return;if(++this.current.records+(this.previous?.records??0)>this.limits.records)throw Error('backpressure-observer-record-capacity');this.current.operations.push(this.copy(row));});}
  stage(stage:'horizontal'|'gravity',columns:FilmLayerColumn[]){this.safe(()=>{if(this.current&&!this.closed)this.current[stage]=this.copy(columns);});}
  vertical(cell:number,before:FilmLayerColumn,remapped:FilmLayerColumn,diffused:FilmLayerColumn,stress:unknown){this.safe(()=>{if(stress&&typeof stress==='object'&&'observationError' in stress)throw Error(`backpressure-diffusion-observation:${String(stress.observationError)}`);if(this.current&&!this.closed)this.current.vertical.push(this.copy({cell,before,remapped,diffused,stress}));});}
  completeSubstep(){this.safe(()=>{if(this.current&&!this.closed){this.current.bytes=this.bytes-this.geometryBytes-(this.previous?.bytes??0);this.previous=this.current;this.current=undefined;}});}
  private guard(input:BackpressureGuardOperands,passed:boolean){
    const cp=Math.sqrt(input.gn*input.port.height),cr=Math.sqrt(input.gn*input.H),mp=input.up-cp,mr=input.H>0?input.slowest-cr:input.up-cp;
    const layers=input.column.volumes.map((V,k)=>{const mass=input.rho*V,velocity=V>0?input.column.momenta[k].map(P=>P/mass):null;return {layer:k,V,P:input.column.momenta[k],mass,positive:V>0,velocity,projection:velocity?velocity.reduce((s,v,j)=>s+v*input.port.normal[j],0):input.up};});
    const totalVolume=input.column.volumes.reduce((s,v)=>s+v,0),totalMomentum=input.column.momenta.reduce((s,p)=>s.map((v,k)=>v+p[k]) as ContactVec3,[0,0,0] as ContactVec3);
    const invalid=!(input.rho>0&&input.gn>0&&input.area>0&&input.H>=0&&input.port.height>=0)||layers.some(l=>l.V<0||l.V===0&&l.P.some(P=>P!==0))||![input.H,input.up,input.slowest,cp,cr,mp,mr,...layers.flatMap(l=>[l.V,...l.P,l.mass,...(l.velocity??[])])].every(Number.isFinite);
    return { ...input,passed,cp,cr,portMargin:mp,receiverMargin:mr,layers,positiveMask:layers.map(l=>l.positive),volumeFractions:layers.map(l=>totalVolume>0?l.V/totalVolume:0),depthMeanVelocity:totalVolume>0?totalMomentum.map(P=>P/(input.rho*totalVolume)):null,minimizers:layers.filter(l=>l.projection===input.slowest).map(l=>l.layer),classification:invalid?'nonfinite-or-invalid-operand':!(mp>0)&&!(mr>0)?'both-margins-nonpositive':!(mp>0)?'port-margin-nonpositive':!(mr>0)?'receiver-margin-nonpositive':'passing',generation:{outerTick:this.outerTick,substep:this.current?.index},hydrostaticResultant:.5*input.rho*input.gn*input.H*input.H };
  }
  pass(input:BackpressureGuardOperands){this.safe(()=>{if(!this.closed)this.passing.set(input.cell,this.copy(this.guard(input,true)));});}
  reject(input:BackpressureGuardOperands):FilmBackpressureDiagnostic {
    this.safe(()=>{if(this.diagnostic)return;const relevant=new Set([input.cell]);
      const geometry=this.geometry as {faces?:{left:number;right:number}[]};for(const face of geometry?.faces??[])if(face.left===input.cell||face.right===input.cell){if(face.left>=0)relevant.add(face.left);if(face.right>=0)relevant.add(face.right);}
      if(!this.previous&&this.current?.index!==0)this.failures.push('backpressure-missing-preceding-substep');
      if(this.previous)for(const cell of relevant)if(!this.previous.before[cell]||!this.previous.horizontal?.[cell]||!this.previous.gravity?.[cell]||!this.previous.vertical.some(v=>v.cell===cell))this.failures.push(`backpressure-incomplete-preceding-cell:${cell}`);
      const extract=(frame:Frame|undefined)=>frame?{index:frame.index,start:frame.start,end:frame.end,cells:[...relevant].map(cell=>({cell,before:frame.before[cell],horizontal:frame.horizontal?.[cell],gravity:frame.gravity?.[cell],vertical:frame.vertical.find(v=>v.cell===cell)})),operations:frame.operations.filter(row=>relevant.has(row.cell))}:null;
      const witness=this.copy({clock:this.clock,geometry:this.geometry,guard:this.guard(input,false),lastPassingSameGeneration:this.passing.get(input.cell)??null,precedingStatus:this.previous?'retained':this.current?.index===0?'first-substep-no-preceding':'missing',precedingCompletedSubstep:extract(this.previous),currentProvisionalSubstep:extract(this.current)});
      this.diagnostic={stage:'finite-source-backpressure',reason:'film-junction-backpressure',complete:this.failures.length===0&&Boolean(this.current),failures:[...this.failures],witness:backpressureNumericValue(witness)};
    });this.closed=true;
    if(!this.diagnostic)this.diagnostic={stage:'finite-source-backpressure',reason:'film-junction-backpressure',complete:false,failures:[...this.failures],witness:null};
    return structuredClone(this.diagnostic);
  }
  finish(){this.closed=true;}
  report(){return structuredClone(this.diagnostic??{stage:'finite-source-backpressure',reason:'film-junction-backpressure',complete:false,failures:[...this.failures],witness:null});}
}
