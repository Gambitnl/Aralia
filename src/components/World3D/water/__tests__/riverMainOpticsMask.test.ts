/** The optical fork must taper only on the added branch, using the same
 * quantized ownership that native geometry and floating probes consume. */
import {describe,it,expect,beforeEach,afterEach} from 'vitest';
import {mainRapidsOpticsMask,RiverReachView} from '../riverReachScene';
import {RiverSurfaceMirror} from '../riverSurfaceMirror';
import {riverStandingGeometryFrom,riverWaterGeometryFrom} from '../riverWaterMaterial';
import type {BufferGeometry} from 'three/webgpu';
import type {WaterSheetArrays} from '@/systems/world3d/river/riverWaterSheet';
import {defaultRiverCourse,courseKeyAt} from '@/systems/world3d/river/riverReach';
import {projectMainRapids,MAIN_CHANNEL_S,setRiverHeadwaters} from '@/systems/world3d/river/riverHeadwaters';
import type {RiverReachData} from '@/systems/world3d/river/riverWorker';
import {toHalfArray} from '@/systems/world3d/river/riverWaterSheet';
import {RiverReceivingRefiner} from '../riverReceivingRefiner';
const grid={nx:180,nz:140,dx:.5,x0:0,z0:-20};
const original=defaultRiverCourse();
const smooth=(value:number)=>{const x=Math.max(0,Math.min(1,value));return x*x*(3-2*x);};
function fieldAt(cell:number){const x=grid.x0+(cell%grid.nx+.5)*grid.dx,z=grid.z0+(Math.floor(cell/grid.nx)+.5)*grid.dx,main=projectMainRapids(x,z),old=original.project(x,z);return{x,z,main,old,u:main.s-MAIN_CHANNEL_S,gap:old.d-main.d-2};}
describe('main-side optical ownership',()=>{
 it('installs the same live sheet from raw arrays and existing wrappers with optics on or off',()=>{
  const sheet={pos:new Float32Array([0,1,0,1,2,0,0,3,1]),nor:new Float32Array([0,1,0,0,1,0,0,1,0]),index:new Uint32Array([0,2,1])};
  const prepare=(RiverReachView.prototype as unknown as {prepareReceivingGeometry(input:BufferGeometry|WaterSheetArrays):BufferGeometry}).prepareReceivingGeometry;
  for(const enabled of [0,1]){
   const owned:(Uint32Array|null)[]=[];
   const receiver={mainOpticsMask:{},waterMat:{uniforms:{uMainRapidsOptics:{value:enabled}}},
    mirror:{mainRapidsShare:()=>1,broadStandingHeightAt:()=>.125,mainRapidsBounds:undefined},
    installReceivingGeometry:(g:BufferGeometry,indices:Uint32Array|null)=>{owned.push(indices);return g;}};
   const wrapped=riverWaterGeometryFrom(sheet);let disposed=false;wrapped.addEventListener('dispose',()=>{disposed=true;});
   const a=prepare.call(receiver,sheet),b=prepare.call(receiver,wrapped);
   for(const key of ['position','normal'])expect(a.getAttribute(key).array).toEqual(b.getAttribute(key).array);
   expect(a.getIndex()!.array).toEqual(b.getIndex()!.array);expect(owned[0]).toEqual(owned[1]);
   expect(a.boundingBox).toEqual(b.boundingBox);expect(a.boundingSphere).toEqual(b.boundingSphere);
   expect(disposed).toBe(!!enabled);a.dispose();b.dispose();
  }
 });
 it('preserves shared-edge topology and midpoint precision while packed storage grows',()=>{
  const sheet={pos:new Float32Array([0,1,0,2,3,0,0,5,2,2,7,2]),
   nor:new Float32Array([0,1,0,0,1,0,0,1,0,0,1,0]),index:new Uint32Array([0,2,1,1,2,3])};
  // Five shared-edge midpoints take four original vertices past the initial
  // capacity. The diagonal belongs to both triangles and must appear once.
  for(const height of [0,.125,-.75]){
   const geometry=riverStandingGeometryFrom(sheet,()=>1,()=>height);
   const expected=[0,1,0,2,3,0,0,5,2,2,7,2,0,3,1,1,4,1,1,2,0,1,6,2,2,5,1];
   for(let i=1;i<expected.length;i+=3)expected[i]+=height;
   expect(geometry.getAttribute('position').array).toEqual(Float32Array.from(expected));
   expect(geometry.getAttribute('normal').array).toEqual(Float32Array.from({length:27},(_,i)=>i%3===1?1:0));
   const triangles=new Uint32Array([0,4,6,4,2,5,6,5,1,4,5,6,1,5,8,5,2,7,8,7,3,5,7,8]);
   expect(geometry.getIndex()!.array).toEqual(triangles);
   expect(geometry.userData.mainStandingTriangles).toEqual(triangles);
   expect(geometry.userData.standingStats.vertices).toBe(9);
   expect(geometry.boundingBox!.min.y).toBe(1+height);expect(geometry.boundingBox!.max.y).toBe(7+height);
   geometry.dispose();
  }
  expect(sheet.pos[1]).toBe(1);
 });
 it('preserves unowned water and empty sheets without padding the output',()=>{
  for(const sheet of [{pos:new Float32Array([0,1,0,1,2,0,0,3,1]),nor:new Float32Array([0,1,0,0,1,0,0,1,0]),index:new Uint32Array([0,2,1])},
   {pos:new Float32Array(0),nor:new Float32Array(0),index:new Uint32Array(0)}]){
   const geometry=riverStandingGeometryFrom(sheet,()=>0,()=>{throw Error('Unowned water must not sample displacement');});
   expect(geometry.getAttribute('position').array).toEqual(sheet.pos);
   expect(geometry.getAttribute('normal').array).toEqual(sheet.nor);
   expect(geometry.getIndex()!.array).toEqual(sheet.index);
   expect(geometry.userData.mainStandingTriangles.length).toBe(0);geometry.dispose();
  }
 });
 beforeEach(()=>setRiverHeadwaters(true));
 afterEach(()=>setRiverHeadwaters(false));
 it('keeps original/source zero, preserves full main interiors, and removes the hard course-distance jump',()=>{
  const mask=mainRapidsOpticsMask(grid),bytes=mask.image.data as Uint8Array;let protectedCells=0,interior=0,tapered=0,entryCells=0,oldLargeJumps=0;
  for(let cell=0;cell<grid.nx*grid.nz;cell++){
   const f=fieldAt(cell),value=bytes[cell*4],width=2*courseKeyAt(f.main.s).halfW,oldShare=f.gap>0?smooth((f.u-35)/6)*smooth((113-f.u)/6)*smooth(8.5-f.main.d):0;
   if(f.gap<=0||f.u<=35||f.u>=113||f.main.d>=8.5){expect(value).toBe(0);protectedCells++;}
   if(f.gap>=width&&f.u>=35+width){expect(value).toBe(Math.round(255*oldShare));if(value===255)interior++;}
   if(f.gap>width*.25&&f.gap<width*.75&&f.u>=35+width&&f.u<=107&&f.main.d<=7.5){expect(value).toBeGreaterThan(0);expect(value).toBeLessThan(255);tapered++;}
   if(f.gap>0&&f.u>41&&f.u<35+width&&f.main.d<=7.5){
    expect(value).toBe(Math.round(255*smooth(f.gap/width)*smooth((f.u-35)/width)));expect(value).toBeLessThan(255);entryCells++;
   }
   if(cell%grid.nx===grid.nx-1)continue;const next=fieldAt(cell+1);
   if(f.u<35+width||f.u>107||next.u<35+width||next.u>107||f.main.d>7.5||next.main.d>7.5)continue;
   // Two distance gradients and smoothstep's maximum slope bound the
   // cross-fork byte jump. This is a channel-scale continuity check.
   expect(Math.abs(bytes[(cell+1)*4]-value)).toBeLessThanOrEqual(Math.ceil(255*3*grid.dx/width)+1);
   if((f.gap>0)!==(next.gap>0))oldLargeJumps++;
  }
  expect(protectedCells).toBeGreaterThan(100);expect(interior).toBeGreaterThan(100);expect(tapered).toBeGreaterThan(10);expect(entryCells).toBeGreaterThan(10);expect(oldLargeJumps).toBeGreaterThan(0);mask.dispose();
 });
 it('reuses the quantized mask for bilinear probes and standing geometry through a refresh',()=>{
  const mask=mainRapidsOpticsMask(grid),bytes=mask.image.data as Uint8Array,length=grid.nx*grid.nz*4;
  const data={grid,t0:new Float32Array(length),t1:new Float32Array(length),t2:new Float32Array(length),surface:new Float32Array(grid.nx*grid.nz)} as RiverReachData;
  for(let i=0;i<grid.nx*grid.nz;i++){data.t0[i*4]=2.6;data.t0[i*4+2]=.15;data.t2[i*4+2]=1;data.surface[i]=.1;}
  const mirror=new RiverSurfaceMirror(data);mirror.setMainRapidsMorphology(bytes,true);
  let sample=-1;for(let i=0;i<grid.nx*grid.nz;i++)if(bytes[i*4]>20&&bytes[i*4]<230){sample=i;break;}expect(sample).toBeGreaterThanOrEqual(0);
  const f=fieldAt(sample);expect(mirror.mainRapidsShare(f.x,f.z)).toBe(bytes[sample*4]/255);
  const midpointX=f.x+grid.dx*.5,expected=(bytes[sample*4]+bytes[(sample+1)*4])/(2*255);expect(mirror.mainRapidsShare(midpointX,f.z)).toBeCloseTo(expected,12);
  const sheet={pos:new Float32Array([f.x,0,f.z,f.x+.1,0,f.z,f.x,0,f.z+.1]),nor:new Float32Array([0,1,0,0,1,0,0,1,0]),index:new Uint32Array([0,2,1])};
  const calls:number[]=[];const geometry=riverStandingGeometryFrom(sheet,(x,z)=>{const share=mirror.mainRapidsShare(x,z);calls.push(share);return share;},(x,z)=>mirror.broadStandingHeightAt(x,z),(x,z)=>mirror.broadStandingHeightAt(x,z,true),mirror.mainRapidsBounds);
  expect(calls.some(share=>share>0&&share<1)).toBe(true);
  const snapshot={t0h:toHalfArray(data.t0),t1h:toHalfArray(data.t1),t2h:toHalfArray(data.t2),surface:data.surface,sheet};
  const prepared=new RiverReceivingRefiner(grid,bytes,1,'taper-fixture').refine(snapshot);
  expect(prepared.sheet.pos).toEqual(geometry.getAttribute('position').array);expect(prepared.sheet.nor).toEqual(geometry.getAttribute('normal').array);expect(prepared.sheet.index).toEqual(geometry.getIndex()!.array);
  const refreshed=mainRapidsOpticsMask(grid,mask);expect(refreshed).toBe(mask);expect(refreshed.image.data).toBe(bytes);expect(mirror.mainRapidsShare(f.x,f.z)).toBe(bytes[sample*4]/255);
  mirror.setMainRapidsMorphology(bytes,false);expect(mirror.mainRapidsShare(f.x,f.z)).toBe(0);geometry.dispose();mask.dispose();
 });
});
