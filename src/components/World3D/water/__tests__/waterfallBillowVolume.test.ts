import {describe,it,expect} from 'vitest';
import {BillowDensityField,billowShape,billowUpperSkyFactor,billowMaterialSection,billowEventSample,billowEventPartition,buildBillowLobes,type BillowLobe} from '../waterfallBillowVolume';
const lobe=(center:readonly[number,number,number],volume:number):BillowLobe=>({center,tangent:[0,-1],radii:[1,.6,.6],volume,transfer:.5});
describe('matched compact billow medium',()=>{
 it('deposits overlapping local budgets with positive bounded fractions',()=>{
  const field=new BillowDensityField({min:[0,0,0],max:[4,4,4]},[20,20,20]);
  const receipt=field.fill([lobe([2,2,2],.4),lobe([2.3,2,2],.7)]);
  let mass=0;for(let i=0;i<field.data.length;i+=4){mass+=field.data[i]*field.voxelVolume;expect(field.data[i]).toBeGreaterThanOrEqual(0);expect(field.data[i]).toBeLessThanOrEqual(1);expect(field.data[i+1]).toBeLessThanOrEqual(field.data[i]);}
  expect(mass).toBeCloseTo(1.1,6);expect(receipt.residualVolume).toBeLessThan(1e-7);
  expect(field.sample([0,0,0])).toBe(0);
 });
 it('retains positive subvoxel birth budgets and exact zero-source vacuum',()=>{
  const field=new BillowDensityField({min:[0,0,0],max:[4,4,4]},[8,8,8]);
  const tiny={...lobe([1.01,1.02,1.03],1e-8),radii:[.001,.0001,.002]as const,tangent:[Math.SQRT1_2,-Math.SQRT1_2]as const};
  expect(field.fill([tiny]).depositedVolume).toBeCloseTo(1e-8,14);expect(field.receipt.residualVolume).toBeLessThan(1e-14);
  field.fill([lobe([2,2,2],0)]);expect(field.data.every(v=>v===0)).toBe(true);
 });
 it('reports clipped local support and unfillable capacity honestly',()=>{
  const field=new BillowDensityField({min:[0,0,0],max:[2,2,2]},[12,12,12]);
  expect(field.fill([lobe([.02,1,1],.03)]).depositedVolume).toBeCloseTo(.03,7);
  const impossible=field.fill([lobe([1,1,1],100)]);expect(impossible.maximumFraction).toBe(1);expect(impossible.residualVolume).toBeGreaterThan(91);
  expect(impossible.depositedVolume+impossible.residualVolume).toBeCloseTo(100,5);
 });
 it('integrates separate occupied intervals rather than stopping at the first exit',()=>{
  const field=new BillowDensityField({min:[0,0,0],max:[6,3,3]},[60,20,20]);
  field.fill([{...lobe([1.5,1.5,1.5],.002),radii:[.4,.4,.4]},{...lobe([4.5,1.5,1.5],.002),radii:[.4,.4,.4]}]);
  expect(field.sample([3,1.5,1.5])).toBe(0);
  const integral=(samples:number)=>{let sum=0;for(let i=0;i<samples;i++)sum+=field.sample([(i+.5)*6/samples,1.5,1.5])*6/samples;return sum;};
  const refined=integral(240);expect(refined).toBeGreaterThan(0);expect(integral(48)).toBeCloseTo(refined,3);
  let first=0,second=0;for(let i=0;i<120;i++){first+=field.sample([(i+.5)*3/120,1.5,1.5])*3/120;second+=field.sample([3+(i+.5)*3/120,1.5,1.5])*3/120;}
  expect(first).toBeGreaterThan(0);expect(second).toBeCloseTo(first,8);expect(first+second).toBeCloseTo(refined,10);
  expect(Math.exp(-500*refined)).toBeLessThan(1);expect(Math.exp(-500*refined)).toBeGreaterThan(0);
 });
 it('moves a fixed emitted family through occupied world positions, without a height lattice',()=>{
  const field=new BillowDensityField({min:[-3,0,-3],max:[3,22,3]},[24,96,24]);
  const build=(time:number)=>Array.from({length:12},(_,k)=>{const emission=19.5+k*.04,age=time-emission,shape=billowShape(age,emission,.5),speed=1.7,vertical=-9.81*age,norm=Math.hypot(speed,vertical);return {center:[speed*age-vertical/norm*shape.offset,20-4.905*age*age+speed/norm*shape.offset,0]as const,tangent:[speed/norm,vertical/norm]as const,radii:shape.radii,volume:.001,transfer:.4};});
  const centroid=()=>{let y=0,mass=0;for(let z=0;z<24;z++)for(let j=0;j<96;j++)for(let x=0;x<24;x++){const v=field.data[(x+24*(j+96*z))*4];mass+=v;y+=v*(j+.5)*22/96;}return y/mass;};
  field.fill(build(20.5));const before=centroid();field.fill(build(20.875));const after=centroid();expect(before-after).toBeGreaterThan(3);expect(field.receipt.depositedVolume).toBeCloseTo(.012,7);
 });
 it('keeps the upper-sky energy factor bounded, with exact open uniform limits',()=>{
  expect(billowUpperSkyFactor(1)).toBe(1);expect(billowUpperSkyFactor(0)).toBe(.5);expect(billowUpperSkyFactor(-1)).toBe(0);
  for(const y of [-2,-.7,.3,1.5])expect(billowUpperSkyFactor(y)).toBeGreaterThanOrEqual(0);
  expect(()=>new BillowDensityField({min:[0,0,0],max:[1,1,1]},[0,8,8])).toThrow();
  expect(()=>new BillowDensityField({min:[0,0,0],max:[1,1,1]}).fill([{...lobe([.5,.5,.5],1),volume:NaN}])).toThrow();
 });
});

describe('localized shared material breakup events',()=>{
 it('partitions the actual core and deposits the identical per-emission debit',()=>{
  const q=12,speed=12/7,flight=3.8,time=20,width=10,depth=.7;
  const built=buildBillowLobes({time,flight,historyScale:1,width,depth,top:78,sectionAt:()=>({q,speed})});
  let independentlyRemoved=0;
  for(let n=Math.floor((time-flight)/.04);n<=Math.floor(time/.04);n++){
   const low=Math.max(time-flight,n*.04),high=Math.min(time,(n+1)*.04);if(high<=low)continue;
   const age=time-(low+high)*.5,partition=billowMaterialSection(q/speed,width,age,(low+high)*.5,speed);
   let clear=0,removed=0;for(let k=0;k<24;k++){const dx=partition.section.across[k+1]-partition.section.across[k];clear+=(partition.section.thickness[k]+partition.section.thickness[k+1])*.5*dx;removed+=(partition.debit.removed[k]+partition.debit.removed[k+1])*.5*dx;}
   expect(clear+removed).toBeCloseTo(q/speed,10);independentlyRemoved+=removed*speed*(high-low);
  }
  expect(built.expectedVolume).toBeCloseTo(independentlyRemoved,10);expect(built.invalidBirths).toBe(0);
  expect(buildBillowLobes({time,flight,historyScale:1,width,depth,top:78,sectionAt:()=>({q:0,speed:0})}).lobes).toHaveLength(0);
 });
 it('develops at independent transverse labels, stays continuous, and retains released liquid',()=>{
  const at=(age:number,e:number,speed:number)=>Array.from({length:25},(_,k)=>billowEventSample(age,e,k/24,10,speed).transfer);
  const crest=at(0,19,1.7);expect(crest.every(v=>v===0)).toBe(true);
  const mature=at(2.7,19,1.7),earlier=at(.5,19,1.7),later=at(4.3,19,1.7),slow=at(2.7,19,.06);
  expect(Math.max(...mature)-Math.min(...mature)).toBeGreaterThan(.08);
  expect(mature.some((v,k)=>v>earlier[k]+.1)).toBe(true);
  expect(later.every((v,k)=>v>=mature[k]-1e-12)).toBe(true);
  expect(mature.reduce((a,b)=>a+b,0)).toBeGreaterThan(slow.reduce((a,b)=>a+b,0));
  const shifted=at(2.700001,19.000001,1.7);expect(Math.max(...mature.map((v,k)=>Math.abs(v-shifted[k])))).toBeLessThan(.0001);
  expect(mature.every(v=>v>=0&&v<.85)).toBe(true);
 });
});

describe('curved material-carried billow support',()=>{
 it('keeps curved occupied support asymmetric while fitting the local budget',()=>{
  const field=new BillowDensityField({min:[0,0,0],max:[4,4,4]},[40,40,40]);
  const receipt=field.fill([{...lobe([2,2,2],.03),curve:{bend:.6,twist:.4,feather:.5}}]);
  let mass=0,mirrorDifference=0;for(let z=0;z<40;z++)for(let y=0;y<40;y++)for(let x=0;x<40;x++){
   const phi=field.data[(x+40*(y+40*z))*4],other=field.data[(39-x+40*(y+40*z))*4];mass+=phi*field.voxelVolume;mirrorDifference+=Math.abs(phi-other)*field.voxelVolume;
  }
  expect(mass).toBeCloseTo(.03,8);expect(mirrorDifference).toBeGreaterThan(.008);expect(receipt.residualVolume).toBeLessThan(1e-8);expect(receipt.maximumFraction).toBeLessThanOrEqual(1);expect(field.sample([0,0,0])).toBe(0);
 });
 it('narrows slow source support into separated material intervals without a floor',()=>{
  const count=(speed:number)=>Array.from({length:97},(_,k)=>billowEventSample(2.7,19,k/96,10,speed).transfer).filter(v=>v>0).length;
  expect(count(.06)).toBeLessThan(count(1.7));
  expect(billowEventSample(3,19,.5,10,0).transfer).toBe(0);
  expect(billowEventSample(0,19,.5,10,1.7).offset).toBe(0);
 });
 it('carries stable event segments in world space without averaging away their oblique frames',()=>{
  const build=(time:number)=>buildBillowLobes({time,flight:3.8,historyScale:1,width:10,depth:.7,top:78,sectionAt:()=>({q:12,speed:12/7})});
  const before=build(20),after=build(20.1875),near=build(20.000001);
  const family=before.lobes.filter(l=>l.emission!>18.5&&l.emission!<19);
  expect(family.length).toBeGreaterThan(10);let matched=0;
  for(const l of family){const n=near.lobes.find(n=>n.patchId===l.patchId),a=after.lobes.find(n=>n.patchId===l.patchId);if(!n||!a)continue;matched++;
   expect(l.center[1]-a.center[1]).toBeGreaterThan(1);
   expect(Math.hypot(...l.center.map((v,k)=>v-n.center[k]))).toBeLessThan(.001);
   expect(n.volume).toBeCloseTo(l.volume,5);
  }
  expect(matched).toBeGreaterThan(10);expect(before.lobes.some(l=>Math.abs(l.frame!.tangent[2])>.2)).toBe(true);
  expect(before.eventCount).toBeGreaterThan(20);expect(before.eventCapacityExceeded).toBe(false);
 });
 it('preserves every existing nodal debit across flow, age and emission boundaries',()=>{
  for(const [q,width,depth] of [[.5,6,1.4],[1.5,10,.7],[12,10,.7]])for(const age of [0,.3,1,2.7,4.3])for(const emission of [18.96,18.960001,19,19.2]){
   const speed=q/(width*depth),p=billowEventPartition(q/speed,width,age,emission,speed);
   for(let k=0;k<25;k++)expect(p.nodeAssigned[k]).toBeCloseTo(p.debit.removed[k],13);
   expect(p.events.reduce((sum,event)=>sum+event.area,0)).toBeCloseTo(p.debit.removedArea,12);
   expect(p.residualArea).toBeCloseTo(0,13);
  }
 });
 it('deposits an oblique event in the same rotated support and retains its local budget',()=>{
  const field=new BillowDensityField({min:[-3,-3,-3],max:[3,3,3]},[40,40,40]);
  const c=Math.SQRT1_2;
  const receipt=field.fill([{...lobe([0,0,0],.08),radii:[1.5,.3,.4],frame:{tangent:[c,0,c],normal:[0,1,0],across:[-c,0,c]}}]);
  expect(receipt.depositedVolume).toBeCloseTo(.08,8);expect(receipt.residualVolume).toBeLessThan(1e-9);
  expect(field.sample([.6,0,.6])).toBeGreaterThan(0);expect(field.sample([-.6,0,.6])).toBe(0);
  expect(()=>field.fill([{...lobe([0,0,0],.1),frame:{tangent:[1,0,0],normal:[1,0,0],across:[0,0,1]}}])).toThrow('Invalid billow frame');
 });
 it('rejects excessive event history explicitly instead of dropping represented liquid',()=>{
  const built=buildBillowLobes({time:20,flight:20,historyScale:1,width:10,depth:.7,top:78,sectionAt:()=>({q:12,speed:12/7})});
  expect(built.eventCapacityExceeded).toBe(true);expect(built.invalidBirths).toBeGreaterThan(0);expect(built.lobes).toHaveLength(0);
 });
});
