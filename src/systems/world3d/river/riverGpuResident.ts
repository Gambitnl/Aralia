/** Advances a bounded native-river interval on water that stays on the device.
 * This candidate uses the existing renderer device and HLL equations. It owns
 * frontier, stability, ledgers and time-weighted flow inside one transaction.
 * The caller still chooses explicit inlet-refresh boundaries. No spill/contact
 * coupling or source change may be hidden inside an interval. It is not wired
 * into the live default until native landing/event and rendered checks pass.
 *
 * 2026-10-21 (resident session): the device buffers are made once per grid and
 * kept between intervals. Each request uploads only what the CPU changed (all
 * cells once, rows after a bed edit, single cells for inlet changes). Each
 * interval reads back only the cells the device changed: their water, reach
 * flags and time integrals. The earlier design made nine buffers, uploaded and
 * read back the whole 5.9 million-cell grid each interval (0.11x real time on
 * the seven-falls course). The water equations and the stage order are unchanged.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 21/10/2026, 13:13:41
 * Dependents: components/World3D/water/riverLiveClient.ts, systems/world3d/river/riverLive.ts, systems/world3d/river/riverSolver.ts, systems/world3d/river/riverWorker.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { assertRiverGpuBufferSizes, residentBufferSizes, riverGpuDispatch, RIVER_RESIDENT_MAX_STEPS, RIVER_RESIDENT_TAIL } from './riverGpuLimits';

import {RIVER_GPU_SHADER} from './riverGpuKernel';

/** CPU changes since the last accepted interval. Each array follows the native
 * cell layout: state = (h, hu, hv, bed - datum), source = (inlet rate x, y, z,
 * Manning n squared), flags = 1 reach | 2 flood eligible | 4 inlet | 8 transient. */
export interface RiverGpuResidentUpload {
 /** Every cell. Required for a new session and after any failed interval. */
 full?:{state:Float32Array;source:Float32Array;flags:Uint32Array}|null;
 /** Whole rows j0..j1 (inclusive), after a bed edit or added water there. */
 rows?:{j0:number;j1:number;state:Float32Array;source:Float32Array;flags:Uint32Array}|null;
 /** Single cells (inlet changes, landed spill water): source, flags and water. */
 cells?:{index:Uint32Array;source:Float32Array;flags:Uint32Array;state:Float32Array}|null;
 /** Rebuild the active runs from the accepted flags before the first step. */
 resync:boolean;
}
export interface RiverGpuResidentInput {
 /** The solver's identity. A new value starts a new device session. */
 session:number;
 nx:number; nz:number; dx:number; outEdge:number;
 /** Wet-front expansion is on (the solver has flood-eligible cells). */
 expansion:boolean;
 maxDt:number; cfl:number; lastMaxSpeed:number; slots:number;
 /** Accepted inlet discharge for this explicit refresh interval, m3/s. */
 discharge:number;
 /** Native batches stop after crossing their requested span; no new dt clipping. */
 duration?:number;
 /** Tests whole-transaction rejection, without altering the water equations. */
 rejectStep?:number;
 /** Airborne spill in detect mode (GG-429): the device runs the separation
  * test of RiverSpillTransfer.launch on every face and returns its launches. */
 spill?:{gravity:number}|null;
 upload:RiverGpuResidentUpload;
}
export interface RiverGpuResidentOutput {
 /** Eight words for each changed cell: (cell << 4 | flags), then h, hu, hv as
  * Float32 bits, then the four time integrals (h, hu, hv, hu^2/h) x dt. */
 records:Uint32Array;
 /** Twelve words for each spill launch: receiving-side cell R of the face,
  * axis (0 x, 1 z) | 2 when water flows from R to the lower-index cell, the
  * step, a spare word, then Float32 bits of the face mass, normal and tangent
  * fluxes, the donor depth, donor u and v, and the donor slope. Any order. */
 launches:Uint32Array;
 journal:Float32Array;
 steps:number; duration:number; inVolume:number; outVolume:number; lastMaxSpeed:number;
 /** Awake cells after the last step: the native active-run cell count. */
 awakeCells:number;
 uploadBytes:number;
 elapsedMs:number;
}
export type RiverGpuResidentExecutor=(input:RiverGpuResidentInput)=>Promise<RiverGpuResidentOutput>;

/** Cell indices share a word with four flag bits. */
export const RIVER_RESIDENT_MAX_CELLS=2**28;

// Retain the native arithmetic; only its state access and execution controls
// change. Separate dispatches provide the global ordering between stages.
const base=RIVER_GPU_SHADER
 .replace('var<storage,read> state:','var<storage,read_write> state:')
 .replace('var<storage,read> topology:','var<storage,read_write> topology:')
 .replace('var<storage,read> source:','var<storage,read_write> source:')
 .replace('var<storage,read> awakeCells:','var<storage,read_write> awakeCells:')
 .replaceAll('cfg.activeCount','awakeCells[2u*cfg.count+2u*cfg.nz]')
 .replaceAll('cfg.dt','source[cfg.count].x')
 .replaceAll('if(linearInvocation(id)>=awakeCells[','if(source[cfg.count].x<=0.0){return;}if(linearInvocation(id)>=awakeCells[');

// AIRBORNE SPILL (GG-429): a face launched by the spill stage gives its
// receiving cell only its bed correction, as riverSolver.step removes the
// receiver's HLL gain (mass, normal and tangent flux). The spill bits of
// cell c sit in topology[count + c]: 1 = x face (c-1, c) launched into c,
// 2 = into c-1; 4 = z face (c-nx, c) launched into c, 8 = into c-nx.
// Without a launch the select keeps the exact earlier sum.
function must(text:string,from:string,to:string):string{if(!text.includes(from))throw Error('Resident shader anchor missing: '+from.slice(0,48));return text.replace(from,to);}
const spillBase=[
 ['if((topology[c]&2u)==0u){let f=faceX[c];d+=vec3<f32>(f.x,f.y+bedCorrection(c,c-1u),f.z);}',
  'if((topology[c]&2u)==0u){let f=faceX[c];let b=bedCorrection(c,c-1u);d+=select(vec3<f32>(f.x,f.y+b,f.z),vec3<f32>(0.0,b,0.0),(topology[cfg.count+c]&1u)!=0u);}'],
 ['if((topology[c]&4u)==0u){let f=faceX[c+1u];d-=vec3<f32>(f.x,f.y+bedCorrection(c,c+1u),f.z);}',
  'if((topology[c]&4u)==0u){let f=faceX[c+1u];let b=bedCorrection(c,c+1u);d-=select(vec3<f32>(f.x,f.y+b,f.z),vec3<f32>(0.0,b,0.0),(topology[cfg.count+c+1u]&2u)!=0u);}'],
 ['if(j>0u){let f=faceZ[c];d+=vec3<f32>(f.x,f.z,f.y+bedCorrection(c,c-cfg.nx));}',
  'if(j>0u){let f=faceZ[c];let b=bedCorrection(c,c-cfg.nx);d+=select(vec3<f32>(f.x,f.z,f.y+b),vec3<f32>(0.0,0.0,b),(topology[cfg.count+c]&4u)!=0u);}'],
 ['if(j+1u<cfg.nz&&(topology[c+cfg.nx]&1u)!=0u){let f=faceZ[c+cfg.nx];d-=vec3<f32>(f.x,f.z,f.y+bedCorrection(c,c+cfg.nx));}',
  'if(j+1u<cfg.nz&&(topology[c+cfg.nx]&1u)!=0u){let f=faceZ[c+cfg.nx];let b=bedCorrection(c,c+cfg.nx);d-=select(vec3<f32>(f.x,f.z,f.y+b),vec3<f32>(0.0,0.0,b),(topology[cfg.count+c+cfg.nx]&8u)!=0u);}'],
].reduce((text,[from,to])=>must(text,from,to),base);

const shader=spillBase+/* wgsl */ `
// topology: current run flags, (unused) proposed flags, accepted reach flags,
// changed-cell marks for read-back. Reach flags:1=reach,2=flood eligible,
// 4=inlet,8=transient reach.
// source tail: dt/wave/time/resync; step/in/out/speed; cfl/maxdt/span/history;
// failure/witness; reject-step diagnostic; discharge; reach-changed flag.
// Then journal, reductions, averages.
//
// 2026-10-21 (sparse topology): wake visits only awake cells and their four
// neighbors, the only cells whose reach can change, and writes the accepted
// flags in place. Each cell has exactly one owner thread, and a thread reads
// only its own cell's flags, so the result does not depend on thread order.
// The run-building stages run only in a step where some reach bit changed.
// A rejected step can leave changed flags behind; the host then discards the
// whole device copy and uploads every cell again, so no proposed copy is kept.
fn countOffset()->u32{return 2u*cfg.count+2u*cfg.nz;}
fn groups()->u32{return (cfg.count+63u)/64u;}
fn partialOffset()->u32{return cfg.count+${RIVER_RESIDENT_TAIL}u;}
fn averageOffset()->u32{return partialOffset()+groups();}
fn historyOffset()->u32{return averageOffset()+cfg.count;}
// The resync flag (control.w) lets the run-building stages run before the
// first step of an interval whose flags were uploaded; begin clears it.
fn enabled()->bool{return source[cfg.count].x>0.0||source[cfg.count].w>0.0;}
fn rebuild()->bool{return enabled()&&source[cfg.count+6u].x!=0.0;}
// One word per row after the counts: 1 = the row's runs need a rebuild.
// control+6.y forces every row (after an upload).
fn rowDirtyOffset()->u32{return countOffset()+4u;}
fn rowDirty(j:u32)->bool{return source[cfg.count+6u].y!=0.0||awakeCells[rowDirtyOffset()+j]!=0u;}
fn threads()->u32{return ((cfg.count+63u)/64u)*64u;}
fn finite4(v:vec4<f32>)->bool{return all(abs(v)<=vec4<f32>(3.402823e38));}
@compute @workgroup_size(1) fn begin(){
 let control=cfg.count;var dt=0.0;
 if(source[control+3u].x==0.0 && source[control].z<source[control+2u].z){dt=min(source[control+2u].y,source[control+2u].x*cfg.dx/max(0.5,source[control].y));}
 source[control].x=dt;source[control].w=0.0;source[control+6u]=vec4<f32>(0.0);
}
// The native flood-front law for one cell, from its own old flags, the current
// runs and the water. Unchanged from the whole-grid version.
fn wakeCell(c:u32){
 let old=topology[2u*cfg.count+c];var flags=old;
 let h=state[c].x;let i=c%cfg.nx;let j=c/cfg.nx;var keep=(old&1u)!=0u;
 if((topology[c]&1u)!=0u && keep && h==0.0 && (old&4u)==0u){
  var dry=true;if(i>0u){dry=dry&&state[c-1u].x==0.0;}if(i+1u<cfg.nx){dry=dry&&state[c+1u].x==0.0;}
  if(j>0u){dry=dry&&state[c-cfg.nx].x==0.0;}if(j+1u<cfg.nz){dry=dry&&state[c+cfg.nx].x==0.0;}
  if(dry){keep=false;flags=flags&~8u;}
 }
 if(!keep && (old&2u)!=0u && abs(state[c].w)<=3.402823e38){
  if((topology[c]&1u)!=0u && h>0.0){keep=true;}
  for(var side=0u;side<4u;side++){
   var other=c;var valid=false;
   if(side==0u&&i>0u){other=c-1u;valid=true;}if(side==1u&&i+1u<cfg.nx){other=c+1u;valid=true;}
   if(side==2u&&j>0u){other=c-cfg.nx;valid=true;}if(side==3u&&j+1u<cfg.nz){other=c+cfg.nx;valid=true;}
   if(valid&&(topology[other]&1u)!=0u&&state[other].x>cfg.dry&&state[other].w+state[other].x>state[c].w+cfg.dry){keep=true;}
  }
  if(keep){flags=flags|8u;}
 }
 flags=(flags&~1u)|select(0u,1u,keep);
 if(flags!=old){
  topology[2u*cfg.count+c]=flags;topology[3u*cfg.count+c]=1u;
  // A reach change alters the runs of its own row and of the rows beside it.
  if(((flags^old)&1u)!=0u){source[cfg.count+6u].x=1.0;for(var r=max(j,1u)-1u;r<=min(j+1u,cfg.nz-1u);r++){awakeCells[rowDirtyOffset()+r]=1u;}}
 }
}
// The 4-neighbor of awake cell a in direction side-1 (side 1..4), or a itself.
fn candidate(a:u32,side:u32)->u32{
 let i=a%cfg.nx;let j=a/cfg.nx;
 if(side==1u&&i>0u){return a-1u;}if(side==2u&&i+1u<cfg.nx){return a+1u;}
 if(side==3u&&j>0u){return a-cfg.nx;}if(side==4u&&j+1u<cfg.nz){return a+cfg.nx;}
 return 0xffffffffu;
}
// A sleeping cell belongs to its awake 4-neighbor with the smallest index.
fn ownsNeighbor(a:u32,m:u32)->bool{
 if((topology[m]&1u)!=0u){return false;}
 let i=m%cfg.nx;let j=m/cfg.nx;
 if(j>0u&&m-cfg.nx<a&&(topology[m-cfg.nx]&1u)!=0u){return false;}
 if(i>0u&&m-1u<a&&(topology[m-1u]&1u)!=0u){return false;}
 if(i+1u<cfg.nx&&m+1u<a&&(topology[m+1u]&1u)!=0u){return false;}
 return true;
}
@compute @workgroup_size(64) fn wake(@builtin(global_invocation_id) id:vec3<u32>){
 // Without wet-front expansion (activeCount=0) the native law changes nothing.
 if(!enabled()||cfg.activeCount==0u||linearInvocation(id)>=threads()){return;}
 let total=5u*awakeCells[countOffset()];
 for(var t=linearInvocation(id);t<total;t+=threads()){
  let a=awakeCells[t/5u];let side=t%5u;
  if(side==0u){wakeCell(a);continue;}
  let m=candidate(a,side);if(m!=0xffffffffu&&ownsNeighbor(a,m)){wakeCell(m);}
 }
}
fn isAwake(c:u32)->bool{
 let i=i32(c%cfg.nx);let j=i32(c/cfg.nx);
 for(var dj=-1;dj<=1;dj++){for(var di=-1;di<=1;di++){
  let x=i+di;let z=j+dj;if(x>=0&&x<i32(cfg.nx)&&z>=0&&z<i32(cfg.nz)){
   if((topology[2u*cfg.count+u32(z)*cfg.nx+u32(x)]&1u)!=0u){return true;}
  }
 }}return false;
}
@compute @workgroup_size(64) fn build(@builtin(global_invocation_id) id:vec3<u32>){
 let c=linearInvocation(id);if(c>=cfg.count||!rebuild()||!rowDirty(c/cfg.nx)){return;}var flags=0u;
 if(isAwake(c)){flags=1u;let i=c%cfg.nx;if(i==0u){flags|=2u;}else if(!isAwake(c-1u)){flags|=2u;}
 if(i+1u==cfg.nx){flags|=4u;}else if(!isAwake(c+1u)){flags|=4u;}}
 topology[c]=flags;
}
// Deterministic row compaction preserves the native row/cell reduction order.
// These bounded topology scans do not run HLL in sleeping dry cells.
// 2026-10-21: one workgroup per row; each lane scans one contiguous chunk, so
// the row's cells keep ascending order. A clean row keeps its earlier list.
var<workgroup> rowGo:u32;var<workgroup> rowCounts:array<u32,64>;
@compute @workgroup_size(64) fn rows(@builtin(local_invocation_index) lane:u32,@builtin(workgroup_id) group:vec3<u32>){
 let j=linearWorkgroup(group);
 if(lane==0u){rowGo=select(0u,1u,j<cfg.nz&&rebuild()&&rowDirty(j));}
 if(workgroupUniformLoad(&rowGo)==0u){return;}
 let chunk=(cfg.nx+63u)/64u;let first=min(lane*chunk,cfg.nx);let last=min(first+chunk,cfg.nx);
 var count=0u;for(var i=first;i<last;i++){if((topology[j*cfg.nx+i]&1u)!=0u){count++;}}
 rowCounts[lane]=count;workgroupBarrier();
 if(lane==0u){var sum=0u;for(var k=0u;k<64u;k++){let v=rowCounts[k];rowCounts[k]=sum;sum+=v;}awakeCells[2u*cfg.count+j]=sum;awakeCells[rowDirtyOffset()+j]=0u;}
 workgroupBarrier();
 var used=rowCounts[lane];
 for(var i=first;i<last;i++){let c=j*cfg.nx+i;if((topology[c]&1u)!=0u){awakeCells[cfg.count+j*cfg.nx+used]=c;used++;}}
}
@compute @workgroup_size(1) fn prefix(){
 if(!rebuild()){return;}var count=0u;
 for(var j=0u;j<cfg.nz;j++){awakeCells[2u*cfg.count+cfg.nz+j]=count;count+=awakeCells[2u*cfg.count+j];}
 // Indirect arguments for the per-cell stages, in the 2D shape of linearWorkgroup.
 let launch=(count+63u)/64u;
 awakeCells[countOffset()]=count;awakeCells[countOffset()+1u]=min(launch,65535u);awakeCells[countOffset()+2u]=(launch+65534u)/65535u;awakeCells[countOffset()+3u]=1u;
}
@compute @workgroup_size(64) fn compact(@builtin(global_invocation_id) id:vec3<u32>){
 let j=linearInvocation(id);if(j>=cfg.nz||!rebuild()){return;}let size=awakeCells[2u*cfg.count+j];let start=awakeCells[2u*cfg.count+cfg.nz+j];
 for(var k=0u;k<size;k++){awakeCells[start+k]=awakeCells[cfg.count+j*cfg.nx+k];}
}
var<workgroup> waves:array<f32,64>;var<workgroup> speeds:array<f32,64>;
var<workgroup> outlets:array<f32,64>;var<workgroup> failures:array<f32,64>;
// 2026-10-21: the native advance law and the reduction in one stage. The
// values the reduction reads were stored to result and loaded again; here
// they stay in registers, so every bit is the same. Only the water goes to
// result, for commit. A separate advance and reduce stored 32 bytes per cell
// three times, and that cost about 3 ms per step on the seven-falls grid.
// Keep this law the same as advance in riverGpuKernel.ts.
@compute @workgroup_size(64) fn advanceReduce(@builtin(global_invocation_id) id:vec3<u32>,@builtin(local_invocation_index) lane:u32,@builtin(workgroup_id) group:vec3<u32>){
 if(linearWorkgroup(group)>=groups()){return;}
 var wave=0.0;var speed=0.0;var q=0.0;var bad=0.0;
 let k=linearInvocation(id);
 if(enabled()&&k<awakeCells[countOffset()]){
  let c=awakeCells[k];let old=state[c];let dt=source[cfg.count].x;
  var water=vec4<f32>(old.xyz,0.0);var stats=vec4<f32>(0.0);
  if((topology[c]&1u)!=0u){
   let h=old.x+dt*delta[c].x;var flow=old.yz+dt*delta[c].yz;var fast=0.0;var front=0.0;
   if(h<=cfg.dry){flow=vec2<f32>(0.0);}else{let before=length(flow)/h;let drag=G*source[c].w*before/(h*pow(h,1.0/3.0));let damp=1.0/(1.0+dt*drag);flow*=damp;fast=before*damp;front=fast+sqrt(G*h);}
   front=max(front,max(faceX[c].w,faceZ[c].w));
   if((topology[c]&4u)==0u){front=max(front,faceX[c+1u].w);}if(c+cfg.nx<cfg.count&&(topology[c+cfg.nx]&1u)!=0u){front=max(front,faceZ[c+cfg.nx].w);}
   water=vec4<f32>(max(0.0,h),flow,front);stats=vec4<f32>(fast,delta[c].w,0.0,0.0);
  }
  result[k].water=water;
  wave=water.w;speed=stats.x;q=stats.y;
  if(!finite4(water)||!finite4(stats)||water.x<0.0||wave<0.0||speed<0.0||q<0.0){bad=f32(c+1u);}
 }
 waves[lane]=wave;speeds[lane]=speed;outlets[lane]=q;failures[lane]=bad;workgroupBarrier();
 for(var stride=32u;stride>0u;stride/=2u){if(lane<stride){waves[lane]=max(waves[lane],waves[lane+stride]);speeds[lane]=max(speeds[lane],speeds[lane+stride]);outlets[lane]+=outlets[lane+stride];let b=failures[lane+stride];if(b>0.0&&(failures[lane]==0.0||b<failures[lane])){failures[lane]=b;}}workgroupBarrier();}
 if(lane==0u){source[partialOffset()+linearWorkgroup(group)]=vec4<f32>(waves[0],speeds[0],outlets[0],failures[0]);}
}
@compute @workgroup_size(1) fn finish(){
 if(!enabled()){return;}let control=cfg.count;var wave=0.5;var speed=0.0;var q=0.0;var bad=0.0;
 // Groups past the awake count hold only zero partials (max with 0, +0.0),
 // so this shorter serial scan gives the same bits as a scan of every group.
 let used=(awakeCells[countOffset()]+63u)/64u;
 for(var k=0u;k<used;k++){let p=source[partialOffset()+k];wave=max(wave,p.x);speed=max(speed,p.y);q+=p.z;if(p.w>0.0&&(bad==0.0||p.w<bad)){bad=p.w;}}
 let step=u32(source[control+1u].x);let dt=source[control].x;
 if(bad>0.0 || (source[control+4u].x>0.0&&source[control+4u].x==f32(step+1u)) || source[control].z+dt<=source[control].z){source[control+3u]=vec4<f32>(1.0,bad,f32(step+1u),source[control].z);return;}
 // The native owner already normalized this interval's inlet and uses Q for
 // its ledger. Do not rescan the full dry domain serially to reconstruct Q.
 let incoming=source[control+5u].x;
 source[control].y=wave;source[control].z+=dt;
 source[control+1u]+=vec4<f32>(1.0,incoming*dt,q*dt,0.0);source[control+1u].w=speed;
 source[control+8u+2u*step]=vec4<f32>(dt,wave,q,f32(awakeCells[countOffset()]));
 source[control+9u+2u*step]=vec4<f32>(source[control].z,source[control+1u].yz,speed);
}
@compute @workgroup_size(64) fn commit(@builtin(global_invocation_id) id:vec3<u32>){
 if(!enabled()||source[cfg.count+3u].x!=0.0||linearInvocation(id)>=awakeCells[countOffset()]){return;}
 let c=awakeCells[linearInvocation(id)];let old=state[c].xyz;let water=result[linearInvocation(id)].water.xyz;state[c]=vec4<f32>(water,state[c].w);let dt=source[cfg.count].x;
 var kinetic=0.0;if(water.x>cfg.dry){kinetic=dot(water.yz,water.yz)/water.x;}
 source[averageOffset()+c]+=dt*vec4<f32>(water,kinetic);
 // Mark the cell for read-back when its water changed or its integral grew.
 if(any(water!=old)||any(water!=vec3<f32>(0.0))){topology[3u*cfg.count+c]=1u;}
}
// The diagnostic per-step history of the earlier per-interval design is not
// kept: no live caller used it, and its proposed-flag copy cost a whole-grid
// pass every step. residentBufferSizes still sizes it for capacity checks.
`;

/** The resident shader text, for device benches; the session compiles it once. */
export const RIVER_RESIDENT_SHADER=shader;

// Apply single-cell uploads, and collect the changed cells into the result
// buffer (which is scratch between steps). A separate module keeps the main
// layout at eight storage bindings, the WebGPU default per stage.
const auxShader=/* wgsl */ `
fn linearInvocation(id:vec3<u32>)->u32{return id.x+id.y*4194240u;}
struct Params { nx:u32,nz:u32,count:u32,outEdge:u32,dx:f32,dt:f32,dry:f32,activeCount:u32 }
@group(0) @binding(0) var<uniform> cfg:Params;
@group(0) @binding(1) var<storage,read_write> state:array<vec4<f32>>;
@group(0) @binding(2) var<storage,read_write> topology:array<u32>;
@group(0) @binding(3) var<storage,read_write> source:array<vec4<f32>>;
@group(0) @binding(4) var<storage,read_write> records:array<vec4<u32>>;
// aux: record count, patch count, 2 spare words; then 12 words per patch:
// cell, flags, 2 spare words, source vec4 and state vec4 as Float32 bits.
@group(0) @binding(5) var<storage,read_write> aux:array<atomic<u32>>;
fn averageOffset()->u32{return cfg.count+${RIVER_RESIDENT_TAIL}u+(cfg.count+63u)/64u;}
@compute @workgroup_size(64) fn scatter(@builtin(global_invocation_id) id:vec3<u32>){
 let k=linearInvocation(id);if(k>=atomicLoad(&aux[1])){return;}
 let p=4u+12u*k;let c=atomicLoad(&aux[p]);
 source[c]=bitcast<vec4<f32>>(vec4<u32>(atomicLoad(&aux[p+4u]),atomicLoad(&aux[p+5u]),atomicLoad(&aux[p+6u]),atomicLoad(&aux[p+7u])));
 topology[2u*cfg.count+c]=atomicLoad(&aux[p+1u]);
 // The CPU copy equals the device water, so its value rewrites the same bits,
 // or adds landed spill water (GG-429).
 state[c]=bitcast<vec4<f32>>(vec4<u32>(atomicLoad(&aux[p+8u]),atomicLoad(&aux[p+9u]),atomicLoad(&aux[p+10u]),atomicLoad(&aux[p+11u])));
}
// Record order is not deterministic; each record names its cell, so the
// host scatter gives the same arrays in any order.
@compute @workgroup_size(64) fn collect(@builtin(global_invocation_id) id:vec3<u32>){
 let c=linearInvocation(id);if(c>=cfg.count||topology[3u*cfg.count+c]==0u){return;}
 let k=atomicAdd(&aux[0],1u);let a=averageOffset()+c;
 records[2u*k]=vec4<u32>((c<<4u)|(topology[2u*cfg.count+c]&15u),bitcast<vec3<u32>>(state[c].xyz));
 records[2u*k+1u]=bitcast<vec4<u32>>(source[a]);
 source[a]=vec4<f32>(0.0);topology[3u*cfg.count+c]=0u;
}
`;

// THE SPILL STAGE (GG-429): RiverSpillTransfer.launch in detect mode, run on
// the device after the face fluxes and before gather. Keep its tests the same
// as riverSpillTransfer.ts (launch and separates). Bed differences use the
// relative bed in state.w. Launches go to an append list for the CPU replay.
const spillShader=/* wgsl */ `
fn linearInvocation(id:vec3<u32>)->u32{return id.x+id.y*4194240u;}
struct Params { nx:u32,nz:u32,count:u32,outEdge:u32,dx:f32,dt:f32,dry:f32,activeCount:u32 }
@group(0) @binding(0) var<uniform> cfg:Params;
@group(0) @binding(1) var<storage,read> state:array<vec4<f32>>;
@group(0) @binding(2) var<storage,read_write> topology:array<u32>;
@group(0) @binding(3) var<storage,read> faceX:array<vec4<f32>>;
@group(0) @binding(4) var<storage,read> faceZ:array<vec4<f32>>;
@group(0) @binding(5) var<storage,read> source:array<vec4<f32>>;
@group(0) @binding(6) var<storage,read> awakeCells:array<u32>;
// launches: count, capacity, enabled, gravity bits; then 12 words per launch.
@group(0) @binding(7) var<storage,read_write> launches:array<atomic<u32>>;
fn countOffset()->u32{return 2u*cfg.count+2u*cfg.nz;}
fn velocity(c:u32)->vec2<f32>{if(state[c].x>cfg.dry){return state[c].yz/state[c].x;}return vec2<f32>(0.0);}
// The slope the donor came down, or -1 when the water stays on the bed.
fn separates(donor:u32,recv:u32,axis:u32,un:f32)->f32{
 if(!(un>0.0)){return -1.0;}
 let step=i32(recv)-i32(donor);let back=i32(donor)-step;var slope=0.0;
 if(back>=0&&back<i32(cfg.count)&&(axis==1u||u32(back)/cfg.nx==donor/cfg.nx)){
  let b=u32(back);if(state[b].x>1e-4&&state[b].w>state[donor].w){slope=(state[b].w-state[donor].w)/cfg.dx;}
 }
 let tau=cfg.dx*sqrt(1.0+slope*slope)/un;let fall=slope*cfg.dx+0.5*bitcast<f32>(atomicLoad(&launches[3]))*tau*tau;
 return select(-1.0,slope,state[donor].w-state[recv].w>fall);
}
// 1 = launched donor L into R, 2 = donor R into L, 0 = no launch.
fn tryFace(L:u32,R:u32,axis:u32,f:vec4<f32>)->u32{
 let m=f.x;if(!(m!=0.0)){return 0u;}
 let plus=m>0.0;let sign=select(-1.0,1.0,plus);let donor=select(R,L,plus);let recv=select(L,R,plus);
 if(!(state[donor].w-state[recv].w>state[donor].x)){return 0u;}
 let vf=velocity(donor);let un=sign*select(vf.y,vf.x,axis==0u);
 let slope=separates(donor,recv,axis,un);if(slope<0.0){return 0u;}
 if(state[donor].x<=1e-4||un<=0.0||sign*m<=0.0||state[recv].w+state[recv].x>=state[donor].w-1e-6){return 0u;}
 let k=atomicAdd(&launches[0],1u);
 if(k<atomicLoad(&launches[1])){
  let p=4u+12u*k;
  atomicStore(&launches[p],R);atomicStore(&launches[p+1u],axis|select(2u,0u,plus));atomicStore(&launches[p+2u],u32(source[cfg.count+1u].x));atomicStore(&launches[p+3u],0u);
  atomicStore(&launches[p+4u],bitcast<u32>(f.x));atomicStore(&launches[p+5u],bitcast<u32>(f.y));atomicStore(&launches[p+6u],bitcast<u32>(f.z));
  atomicStore(&launches[p+7u],bitcast<u32>(state[donor].x));atomicStore(&launches[p+8u],bitcast<u32>(vf.x));atomicStore(&launches[p+9u],bitcast<u32>(vf.y));
  atomicStore(&launches[p+10u],bitcast<u32>(slope));atomicStore(&launches[p+11u],0u);
 }
 return select(2u,1u,plus);
}
@compute @workgroup_size(64) fn spill(@builtin(global_invocation_id) id:vec3<u32>){
 let k=linearInvocation(id);if(k>=awakeCells[countOffset()]){return;}
 let c=awakeCells[k];var bits=0u;
 // Same faces as the native step: x faces inside a run, z faces donor row 1.
 if(atomicLoad(&launches[2])!=0u&&source[cfg.count].x>0.0){
  if((topology[c]&2u)==0u){bits|=tryFace(c-1u,c,0u,faceX[c]);}
  if(c>=cfg.nx){bits|=tryFace(c-cfg.nx,c,1u,faceZ[c])<<2u;}
 }
 topology[cfg.count+c]=bits;
}
`;

/** Scan every readback value with the same finite predicate, without a callback
 * invocation for every float. The owned copies retain all original bits, order,
 * rejection checks and physics. Empty/detached arrays keep native semantics. */
export function residentReadbackIsFinite(values:Float32Array):boolean {
 if(values.length===0)return values.every(Number.isFinite);
 for(let i=0;i<values.length;i++)if(!Number.isFinite(values[i]))return false;
 return true;
}

export type ResidentCpuWork=(phase:'prepare'|'publish',startMs:number,endMs:number)=>void;

const STAGES=['begin','wake','build','rows','prefix','compact','faces','gather','advanceReduce','finish','commit'] as const;
const FINISH=STAGES.indexOf('finish'),GATHER=STAGES.indexOf('gather');
// Read-back layout: the control tail (24 vec4), awake count, record count, then records.
// The tail holds the control vec4s and each step's journal (RIVER_RESIDENT_TAIL);
// the records start on the next 256-byte boundary after it and the two counts.
const TAIL_BYTES=RIVER_RESIDENT_TAIL*16,RECORDS_AT=Math.ceil((TAIL_BYTES+8)/256)*256,FIRST_RECORDS=65536,FIRST_PATCHES=1024;
/** Spill launches one interval can hold (48 bytes each). More is an error. */
export const RIVER_RESIDENT_SPILL_LAUNCHES=65536;

interface ResidentSession {
 id:number; nx:number; nz:number; n:number;
 buffers:GPUBuffer[]; group:GPUBindGroup;
 aux:GPUBuffer; auxPatches:number; auxGroup:GPUBindGroup;
 staging:GPUBuffer; stagingRecords:number;
 /** Spill launch list (GG-429), its read-back copy and its bind group. */
 launches:GPUBuffer; launchStaging:GPUBuffer; spillGroup:GPUBindGroup;
 /** A copy of the work-list launch size (the list itself is bound writable). */
 indirect:GPUBuffer;
 /** False after any failed interval: the device water is then unknown. */
 valid:boolean;
}

export class RiverGpuResident {
 private pending=false;
 private session:ResidentSession|null=null;
 private constructor(private device:GPUDevice,private pipelines:GPUComputePipeline[],private layout:GPUBindGroupLayout,
  private auxPipelines:{scatter:GPUComputePipeline;collect:GPUComputePipeline},private auxLayout:GPUBindGroupLayout,
  private spillPipeline:GPUComputePipeline,private spillLayout:GPUBindGroupLayout){}
 static async create(device:GPUDevice):Promise<RiverGpuResident>{
  const compile=async(code:string)=>{const module=device.createShaderModule({code});const info=await module.getCompilationInfo();const errors=info.messages.filter(m=>m.type==='error');if(errors.length)throw Error(errors.map(m=>`${m.lineNum}: ${m.message}`).join('\n'));return module;};
  const [module,auxModule,spillModule]=await Promise.all([compile(shader),compile(auxShader),compile(spillShader)]);
  const entry=(binding:number,type:GPUBufferBindingType)=>({binding,visibility:GPUShaderStage.COMPUTE,buffer:{type}});
  const layout=device.createBindGroupLayout({entries:Array.from({length:9},(_,binding)=>entry(binding,binding===0?'uniform':'storage'))});
  const auxLayout=device.createBindGroupLayout({entries:[entry(0,'uniform'),entry(1,'storage'),entry(2,'storage'),entry(3,'storage'),entry(4,'storage'),entry(5,'storage')]});
  const spillLayout=device.createBindGroupLayout({entries:[entry(0,'uniform'),entry(1,'read-only-storage'),entry(2,'storage'),entry(3,'read-only-storage'),entry(4,'read-only-storage'),entry(5,'read-only-storage'),entry(6,'read-only-storage'),entry(7,'storage')]});
  const pipelineLayout=device.createPipelineLayout({bindGroupLayouts:[layout]}),auxPipelineLayout=device.createPipelineLayout({bindGroupLayouts:[auxLayout]});
  const pipelines=await Promise.all(STAGES.map(entryPoint=>device.createComputePipelineAsync({layout:pipelineLayout,compute:{module,entryPoint}})));
  const [scatter,collect]=await Promise.all(['scatter','collect'].map(entryPoint=>device.createComputePipelineAsync({layout:auxPipelineLayout,compute:{module:auxModule,entryPoint}})));
  const spillPipeline=await device.createComputePipelineAsync({layout:device.createPipelineLayout({bindGroupLayouts:[spillLayout]}),compute:{module:spillModule,entryPoint:'spill'}});
  return new RiverGpuResident(device,pipelines,layout,{scatter,collect},auxLayout,spillPipeline,spillLayout);
 }

 /** Release the device copy of the water. A later request must upload every cell. */
 dispose():void{this.close();}

 private close():void{
  const s=this.session;this.session=null;if(!s)return;
  for(const b of [...s.buffers,s.aux,s.staging,s.indirect,s.launches,s.launchStaging])b.destroy();
 }

 private makeAuxGroup(s:ResidentSession):GPUBindGroup{
  const [params,state,topology,source,,,,result]=s.buffers;
  return this.device.createBindGroup({layout:this.auxLayout,entries:[params,state,topology,source,result,s.aux].map((buffer,binding)=>({binding,resource:{buffer}}))});
 }

 private open(input:RiverGpuResidentInput):ResidentSession{
  const {nx,nz}=input,n=nx*nz;
  const current=this.session;
  if(current&&current.id===input.session&&current.nx===nx&&current.nz===nz&&current.valid)return current;
  if(!input.upload.full)throw Error(current&&current.id===input.session?'Resident device water is unknown after a failed interval; a full upload is required':'A new resident session requires a full upload');
  if(current&&current.id===input.session&&current.nx===nx&&current.nz===nz){current.valid=true;return current;}
  this.close();
  // Reject insufficient device capacity before allocation or dispatch.
  const sizes=residentBufferSizes(nx,nz,8,false);
  assertRiverGpuBufferSizes(this.device.limits,sizes,[1,2,3,4,5,6,7,8]);
  const storage=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC;
  const buffers=sizes.map((size,i)=>this.device.createBuffer({size:Math.max(4,size),usage:i===0?GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST:storage|(i===8?GPUBufferUsage.INDIRECT:0)}));
  const group=this.device.createBindGroup({layout:this.layout,entries:buffers.map((buffer,binding)=>({binding,resource:{buffer}}))});
  const auxPatches=FIRST_PATCHES,aux=this.device.createBuffer({size:16+32*auxPatches,usage:storage});
  const stagingRecords=Math.min(n,FIRST_RECORDS),staging=this.device.createBuffer({size:RECORDS_AT+32*stagingRecords,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
  const indirect=this.device.createBuffer({size:16,usage:GPUBufferUsage.INDIRECT|GPUBufferUsage.COPY_DST});
  const launchBytes=16+48*RIVER_RESIDENT_SPILL_LAUNCHES;
  const launches=this.device.createBuffer({size:launchBytes,usage:storage}),launchStaging=this.device.createBuffer({size:launchBytes,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
  const [,state,topology,,faceX,faceZ,,,list]=buffers;
  const spillGroup=this.device.createBindGroup({layout:this.spillLayout,entries:[buffers[0],state,topology,faceX,faceZ,buffers[3],list,launches].map((buffer,binding)=>({binding,resource:{buffer}}))});
  const s:ResidentSession={id:input.session,nx,nz,n,buffers,group,aux,auxPatches,auxGroup:null as unknown as GPUBindGroup,staging,stagingRecords,indirect,launches,launchStaging,spillGroup,valid:true};
  s.auxGroup=this.makeAuxGroup(s);
  this.session=s;
  return s;
 }

 /** No caller arrays/clocks are changed before this complete promise validates.
  * A failed interval leaves the device water unknown; the next request must
  * upload every cell from the caller's last accepted state.
  * Inlets and terrain are fixed only between explicit caller sync boundaries.
  */
 async run(input:RiverGpuResidentInput,onCpuWork?:ResidentCpuWork):Promise<RiverGpuResidentOutput>{
  if(this.pending)throw Error('Resident river interval already pending');
  const {nx,nz}=input,n=nx*nz,slots=input.slots,blocks=Math.ceil(n/64);
  if(!Number.isInteger(slots)||slots<1||slots>RIVER_RESIDENT_MAX_STEPS)throw Error(`Resident interval capacity is one to ${RIVER_RESIDENT_MAX_STEPS} steps`);
  if(!Number.isSafeInteger(n)||n<1||n>RIVER_RESIDENT_MAX_CELLS)throw Error('Resident river dimensions mismatch');
  if(![input.dx,input.maxDt,input.cfl,input.lastMaxSpeed].every(x=>Number.isFinite(x)&&x>0))throw Error('Resident river timing must be finite and positive');
  if(!Number.isFinite(input.discharge)||input.discharge<0)throw Error('Resident inlet discharge must be finite and nonnegative');
  const {full,rows,cells}=input.upload;
  if(full&&(full.state.length!==n*4||full.source.length!==n*4||full.flags.length!==n))throw Error('Resident river dimensions mismatch');
  if(rows){const m=(rows.j1-rows.j0+1)*nx;if(!Number.isInteger(rows.j0)||!Number.isInteger(rows.j1)||rows.j0<0||rows.j1>=nz||rows.j1<rows.j0||rows.state.length!==m*4||rows.source.length!==m*4||rows.flags.length!==m)throw Error('Resident row upload mismatch');}
  if(cells&&(cells.source.length!==cells.index.length*4||cells.state.length!==cells.index.length*4||cells.flags.length!==cells.index.length||cells.index.some(c=>c>=n)))throw Error('Resident cell upload mismatch');
  if(input.spill&&!(Number.isFinite(input.spill.gravity)&&input.spill.gravity>=0))throw Error('Resident spill gravity must be finite and nonnegative');
  this.pending=true;const start=performance.now();
  // The readback continuation is main-thread work between rendered frames.
  // Report only synchronous preparation/publication; GPU waiting overlaps frames.
  // Diagnostic failures must never change an accepted or rejected water epoch.
  const report=(phase:'prepare'|'publish',at:number)=>{if(onCpuWork)try{onCpuWork(phase,at,performance.now());}catch{/* diagnostic only */}};
  // THE ERROR SCOPE (2026-10-27) holds only this interval's own calls. It is
  // popped right after the submit, in the same task: an open scope across the
  // read-back wait also caught the renderer's errors on the shared device (an
  // over-size instance uniform stopped the solver as "Resident GPU validation
  // failed"). The overflow re-copy below has its own scope.
  this.device.pushErrorScope('validation');
  let scope:Promise<GPUError|null>|null=null;
  let session:ResidentSession|null=null,accepted=false;
  // The validation error still wins over the body's own outcome; it is thrown
  // after the cleanup instead of from inside it (no-unsafe-finally).
  let published:RiverGpuResidentOutput|undefined,failure:unknown,failed=false,error:GPUError|null=null;
  try{
   session=this.open(input);
   const s=session,q=this.device.queue,[params,state,topology,source,,,,result,list]=s.buffers;
   const averageOffset=n+RIVER_RESIDENT_TAIL+blocks,countOffset=2*n+2*nz;
   let uploadBytes=0;
   const write=(buffer:GPUBuffer,offset:number,data:Float32Array|Uint32Array)=>{q.writeBuffer(buffer,offset,data as unknown as ArrayBuffer);uploadBytes+=data.byteLength;};
   const paramData=new ArrayBuffer(32);new Uint32Array(paramData).set([nx,nz,n,input.outEdge]);new Float32Array(paramData).set([input.dx,input.maxDt,1e-4,0],4);new Uint32Array(paramData)[7]=input.expansion?1:0;
   q.writeBuffer(params,0,paramData);
   if(full){write(state,0,full.state);write(source,0,full.source);write(topology,2*n*4,full.flags);}
   if(rows){const at=rows.j0*nx;write(state,at*16,rows.state);write(source,at*16,rows.source);write(topology,(2*n+at)*4,rows.flags);}
   const patches=cells?.index.length??0;
   if(patches>s.auxPatches){s.aux.destroy();s.auxPatches=2**Math.ceil(Math.log2(patches));s.aux=this.device.createBuffer({size:16+48*s.auxPatches,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});s.auxGroup=this.makeAuxGroup(s);}
   const auxData=new ArrayBuffer(16+48*patches),auxWords=new Uint32Array(auxData),auxFloats=new Float32Array(auxData);auxWords[1]=patches;
   for(let k=0;k<patches;k++){const p=4+12*k;auxWords[p]=cells!.index[k];auxWords[p+1]=cells!.flags[k];auxFloats.set(cells!.source.subarray(k*4,k*4+4),p+4);auxFloats.set(cells!.state.subarray(k*4,k*4+4),p+8);}
   q.writeBuffer(s.aux,0,auxData);uploadBytes+=auxData.byteLength;
   const launchHeader=new Uint32Array(4);launchHeader[1]=RIVER_RESIDENT_SPILL_LAUNCHES;launchHeader[2]=input.spill?1:0;new Float32Array(launchHeader.buffer)[3]=input.spill?.gravity??0;
   q.writeBuffer(s.launches,0,launchHeader);
   const resync=!!full||!!rows||input.upload.resync;
   const control=new Float32Array(28);control.set([0,input.lastMaxSpeed,0,resync?1:0],0);control[24]=control[25]=resync?1:0;control.set([input.cfl,input.maxDt,input.duration??1e30,0],8);control[16]=input.rejectStep??0;control[20]=input.discharge;
   q.writeBuffer(source,n*16,control);
   const encoder=this.device.createCommandEncoder();
   // A full upload also clears the spill bits (topology[n, 2n)).
   if(full){encoder.clearBuffer(topology,n*4,n*4);encoder.clearBuffer(topology,3*n*4,n*4);encoder.clearBuffer(source,averageOffset*16,n*16);}
   const size=(stage:number)=>stage===0||stage===4||stage===FINISH?1:stage===3?nz:stage===5?Math.ceil(nz/64):blocks;
   let pass=encoder.beginComputePass();
   const dispatch=(stage:number)=>{pass.setPipeline(this.pipelines[stage]);pass.dispatchWorkgroups(...riverGpuDispatch(size(stage)));};
   if(patches){pass.setBindGroup(0,s.auxGroup);pass.setPipeline(this.auxPipelines.scatter);pass.dispatchWorkgroups(...riverGpuDispatch(Math.ceil(patches/64)));}
   pass.setBindGroup(0,s.group);
   if(resync)for(const stage of [2,3,4,5])dispatch(stage);
   // A bounded launch uses the GPU count guard in the native entry points.
   // Do not bind a writable work-list buffer as indirect arguments in the
   // same usage scope. Sleeping threads return before any fluid calculation.
   // 2026-10-21: the per-cell stages (faces, gather, advanceReduce, commit)
   // launch only the awake cells' workgroups. The launch size is copied out of
   // the work list between passes; a whole-grid launch of early-returning
   // workgroups cost about 4 ms per step on the seven-falls grid.
   for(let slot=0;slot<slots;slot++){
    for(let stage=0;stage<6;stage++)dispatch(stage);
    pass.end();encoder.copyBufferToBuffer(list,(countOffset+1)*4,s.indirect,0,12);
    pass=encoder.beginComputePass();pass.setBindGroup(0,s.group);
    for(let stage=6;stage<STAGES.length;stage++){
     if(stage===FINISH){dispatch(stage);continue;}
     if(stage===GATHER){
      // The spill stage writes every awake cell's spill bits (zero when off).
      pass.setBindGroup(0,s.spillGroup);pass.setPipeline(this.spillPipeline);pass.dispatchWorkgroupsIndirect(s.indirect,0);pass.setBindGroup(0,s.group);
     }
     pass.setPipeline(this.pipelines[stage]);pass.dispatchWorkgroupsIndirect(s.indirect,0);
    }
   }
   pass.setBindGroup(0,s.auxGroup);pass.setPipeline(this.auxPipelines.collect);pass.dispatchWorkgroups(...riverGpuDispatch(blocks));
   pass.end();
   const copyOut=(e:GPUCommandEncoder,count:number)=>{
    e.copyBufferToBuffer(source,n*16,s.staging,0,TAIL_BYTES);e.copyBufferToBuffer(list,countOffset*4,s.staging,TAIL_BYTES,4);e.copyBufferToBuffer(s.aux,0,s.staging,TAIL_BYTES+4,4);
    if(count)e.copyBufferToBuffer(result,0,s.staging,RECORDS_AT,count*32);
   };
   copyOut(encoder,s.stagingRecords);
   encoder.copyBufferToBuffer(s.launches,0,s.launchStaging,0,16+48*RIVER_RESIDENT_SPILL_LAUNCHES);
   q.submit([encoder.finish()]);scope=this.device.popErrorScope();
   let map=s.staging.mapAsync(GPUMapMode.READ);const launchMap=s.launchStaging.mapAsync(GPUMapMode.READ);report('prepare',start);await Promise.all([map,launchMap]);
   // Read the launch list first; a record overflow below copies records only.
   const launchCount=new Uint32Array(s.launchStaging.getMappedRange(0,16))[0];
   if(launchCount>RIVER_RESIDENT_SPILL_LAUNCHES)throw Error(`Resident spill launches (${launchCount}) exceed the capacity ${RIVER_RESIDENT_SPILL_LAUNCHES}; previous epoch retained`);
   const launches=launchCount?new Uint32Array(s.launchStaging.getMappedRange(16,launchCount*48).slice(0)):new Uint32Array(0);
   s.launchStaging.unmap();
   let publicationStart=performance.now();
   let head=s.staging.getMappedRange(0,RECORDS_AT).slice(0);
   const counts=new Uint32Array(head,TAIL_BYTES,2),changed=counts[1];
   if(changed>s.stagingRecords){
    // More changed cells than the read-back buffer holds: grow it and copy
    // the same records again. Nothing ran on the device in between.
    s.staging.unmap();report('publish',publicationStart);s.staging.destroy();
    s.stagingRecords=Math.min(n,2**Math.ceil(Math.log2(changed)));
    s.staging=this.device.createBuffer({size:RECORDS_AT+32*s.stagingRecords,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    this.device.pushErrorScope('validation');
    const again=this.device.createCommandEncoder();copyOut(again,changed);q.submit([again.finish()]);
    const againError=await this.device.popErrorScope();if(againError)throw Error('Resident GPU validation failed: '+againError.message);
    map=s.staging.mapAsync(GPUMapMode.READ);await map;publicationStart=performance.now();
    head=s.staging.getMappedRange(0,RECORDS_AT).slice(0);
   }
   try{
    const tail=new Float32Array(head,0,TAIL_BYTES/4),awakeCells=new Uint32Array(head,TAIL_BYTES,1)[0];
    const failure=tail[3*4];if(failure)throw Error(`Resident interval rejected at step ${tail[3*4+2]}, cell ${tail[3*4+1]-1}; previous epoch retained`);
    const steps=tail[4],duration=tail[2];if(!residentReadbackIsFinite(tail)||!Number.isInteger(steps)||steps<1||steps>slots||changed>n)throw Error('Invalid resident interval publication');
    const records=changed?new Uint32Array(s.staging.getMappedRange(RECORDS_AT,changed*32).slice(0)):new Uint32Array(0);
    accepted=true;
    published={records,launches,journal:tail.slice(8*4,(8+2*steps)*4),steps,duration,inVolume:tail[5],outVolume:tail[6],lastMaxSpeed:tail[1],awakeCells,uploadBytes,elapsedMs:performance.now()-start};
   }finally{report('publish',publicationStart);}
  }catch(cause){failed=true;failure=cause;}finally{
   // A validation error must reject even if a failed dispatch left finite,
   // unchanged entry buffers. No such buffers may masquerade as publication.
   try{error=await (scope??this.device.popErrorScope());}
   finally{
    const s=this.session;if(s&&s.staging.mapState==='mapped')s.staging.unmap();if(s&&s.launchStaging.mapState==='mapped')s.launchStaging.unmap();
    // The device ran some steps of a rejected interval: its water no longer
    // matches the caller's accepted state until a full upload replaces it.
    if(s&&(!accepted||error))s.valid=false;
    this.pending=false;
   }
  }
  if(error)throw Error('Resident GPU validation failed: '+error.message);
  if(failed)throw failure;
  return published!;
 }
}
