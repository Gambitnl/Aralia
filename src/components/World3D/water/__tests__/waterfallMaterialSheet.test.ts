import{describe,it,expect}from'vitest';
import{materialSheetSection,materialSheetSupport,materialSheetBandVolume,materialSheetIndices,materialSheetCellVolume,materialSheetTrajectory,materialSheetDepthRayDerivative,materialSheetLocalDepthExit}from'../waterfallMaterialSheet';
import{waterfallHydraulics}from'@/systems/world3d/river/riverHeadwaters';
import{waterfallFloodSection}from'@/systems/world3d/river/waterfallFloodVisual';
describe('emitted coherent liquid strip',()=>{
 it('accounts discrete polygon section area at low/ordinary/high flow',()=>{
  for(const q of [.5,1.5,12,120])for(const age of [0,.2,1,2.5,3.8]){
   const width=q===.5?6:10,speed=q/(width*.7),area=q/Math.hypot(speed,9.81*age),s=materialSheetSection(area,width,age,20-age);
   // Shoelace is independent of the helper's trapezoidal normalization.
   const ring=Array.from(s.across,(x,k)=>[x,s.center[k]+s.thickness[k]*.5]).concat(Array.from(s.across,(x,k)=>[x,s.center[k]-s.thickness[k]*.5]).reverse());
   let polygon=0;for(let k=0;k<ring.length;k++){const a=ring[k],b=ring[(k+1)%ring.length];polygon+=a[0]*b[1]-b[0]*a[1];}
   expect(Math.abs(polygon)*.5).toBeCloseTo(area,10);
   s.thickness.forEach(t=>expect(t).toBeGreaterThan(0));expect(s.measuredArea).toBeCloseTo(area,12);
  }
 });
 it('integrates independently known capped straight/tapered/sheared mesh volumes',()=>{
  for(const shift of [0,.7])for(const endThickness of [1,2]){
   const positions=new Float32Array(2*6*3),xs=[-2,0,2];
   for(let j=0;j<2;j++)for(let k=0;k<6;k++){
    const col=k<3?k:5-k,sign=k<3?1:-1,t=j===0?1:endThickness;
    positions.set([xs[col]+j*shift,sign*t*.5,j*3],(j*6+k)*3);
   }
   // Width4, extrusion3, linearly tapered depth: an independently known prism.
   expect(Math.abs(materialSheetBandVolume(positions,0,3))).toBeCloseTo(4*3*(1+endThickness)/2,6);
  }
 });
 it('shares actual boundary support with local positive optical thickness',()=>{
  const s=materialSheetSection(.4,10,2,17.3);
  for(let k=1;k<s.across.length;k++){const x=(s.across[k-1]+s.across[k])*.5,c=(s.center[k-1]+s.center[k])*.5,t=(s.thickness[k-1]+s.thickness[k])*.5;
   expect(materialSheetSupport(s,x,c)).toBe(true);expect(materialSheetSupport(s,x,c+t*.499)).toBe(true);expect(materialSheetSupport(s,x,c+t*.501)).toBe(false);}
 });
 it('keeps exact coherent crest and zero launch deformation derivative',()=>{
  const crest=materialSheetSection(.7,10,0,20),near=materialSheetSection(.7,10,1e-5,20);
  crest.center.forEach(x=>expect(x).toBe(0));crest.thickness.forEach(t=>expect(t).toBeCloseTo(.07,14));
  expect(Math.max(...near.center)/1e-5).toBeLessThan(1e-4);
 });
 it('carries parcel identity downstream and changes at the emission rate',()=>{
  const a=materialSheetSection(.4,10,1,17.36),b=materialSheetSection(.4,10,2,17.36),advected=materialSheetSection(.4,10,2,(19.36)-2);
  expect(advected.center).toEqual(b.center);expect(Math.max(...b.center)).toBeGreaterThan(Math.max(...a.center));
  const fixedAge=materialSheetSection(.4,10,2,17.36+.24);let difference=0;for(let k=0;k<a.center.length;k++)difference+=Math.abs(b.center[k]-fixedAge.center[k]);expect(difference).toBeGreaterThan(.1);
  const eps=materialSheetSection(.4,10,2,17.36+1e-5);expect(Math.max(...Array.from(b.center,(v,k)=>Math.abs(v-eps.center[k])))).toBeLessThan(.0001);
 });
});
describe('fixed vertical emitted material coordinates',()=>{
 it('keeps native crest/impact centers without the old upward crest recovery',()=>{
  const depth=2,flight=3.8,top=78;
  const crest=materialSheetTrajectory(0,flight,depth,top,.1),near=materialSheetTrajectory(.05,flight,depth,top,.1),end=materialSheetTrajectory(flight,flight,depth,top,.1);
  expect(crest.y).toBe(top-depth/2);expect(crest.yDerivative).toBe(0);expect(near.yDerivative).toBeLessThan(0);
  expect((6*depth*Math.exp(-6*.05*.05)-9.81)*.05).toBeGreaterThan(0);
  expect(end.y).toBeCloseTo(top-depth*.5*Math.exp(-6*flight*flight)-4.905*flight*flight,12);
 });
 it('uses the historical launch derivative and rejects crossing characteristics',()=>{
  const p={startS:0,durationS:30,baseM3S:.5,extraPeakM3S:119.5,flightDelayS:3.8,cancelS:null,cancelExtraM3S:0,cancelDurationS:1};
  const source=waterfallFloodSection(p,4,2.5,3.8,10,.7),curve=materialSheetTrajectory(2.5,3.8,.7,78,source.speed,source.speedAgeDerivative);
  expect(curve.forwardDerivative).toBe(source.speed+2.5*source.speedAgeDerivative);expect(curve.forwardDerivative).toBeLessThan(0);expect(curve.valid).toBe(false);
 });
 it('retains a common material diagonal for thin, noncoplanar upper/lower faces',()=>{
  const indices=materialSheetIndices(2,3),triangles=Array.from({length:indices.length/3},(_,i)=>Array.from(indices.slice(i*3,i*3+3)));
  expect(triangles.some(t=>t.includes(1)&&t.includes(6))).toBe(true);
  expect(triangles.some(t=>t.includes(4)&&t.includes(11))).toBe(true);
  // Matching diagonal uses the same zero center interpolation on both faces;
  // the old opposite diagonal would use center1 under center0 and intersect.
  const thickness=.001,upper=0+thickness*.5,lower=0-thickness*.5;expect(upper-lower).toBe(thickness);
 });
 it('uses material-depth covectors for near-horizontal tilted-film rays',()=>{
  const t=.07,m=20,derivative=materialSheetDepthRayDerivative(1,0,0,m,0);
  expect(materialSheetLocalDepthExit(t,t*.5,derivative)).toBeCloseTo(t/m,14);
  const nLength=Math.hypot(m,1),normalThickness=t/nLength,facing=m/nLength;
  expect(materialSheetLocalDepthExit(t,t*.5,derivative)).toBeCloseTo(normalThickness/facing,14);
  expect(materialSheetLocalDepthExit(t,t*.5,-2,.4)).toBeCloseTo(t/1.8,14);
 });
 it('moves the same emitted material in world space and evolves its edges',()=>{
  const a=materialSheetSection(.7,10,2,18),b=materialSheetSection(.7,10,2.1875,18),c=materialSheetSection(.7,10,2,18.075);
  const pa=materialSheetTrajectory(2,3.8,.7,78,1.7),pb=materialSheetTrajectory(2.1875,3.8,.7,78,1.7);
  expect(pb.forward-pa.forward).toBeCloseTo(1.7*.1875,12);expect(pb.y-pa.y).toBeLessThan(-3);
  expect(b.emission).toBe(a.emission);expect(c.across[0]).not.toBe(a.across[0]);
 });
 it('independently audits finite signed cells and emitted volumes across native flow shapes',()=>{
  const receipts=[];
  for(const [name,q,widthScale,depthScale,time]of [['LOW',.5,.6,2,20],['NORMAL',1.5,1,1,20],['HIGH',12,1,1,20],['PULSE',12,1,1,5]]as const){
   const h=waterfallHydraulics({dischargeM3S:q,widthScale,depthScale}),rows=513,cols=49,ring=cols*2,positions=new Float32Array(rows*ring*3),ages:number[]=[],qs:number[]=[];
   const pulse=name==='PULSE'?{startS:0,durationS:180,baseM3S:12,extraPeakM3S:108,flightDelayS:h.flightS,cancelS:null,cancelExtraM3S:0,cancelDurationS:1}:null;
   for(let j=0;j<rows;j++){
    const age=h.flightS*Math.pow(j/(rows-1),1.45),source=pulse?waterfallFloodSection(pulse,time,age,h.flightS,h.width,h.depth):{q,speed:h.speed,speedAgeDerivative:0};
    const curve=materialSheetTrajectory(age,h.flightS,h.depth,h.top,source.speed,source.speedAgeDerivative);expect(curve.valid).toBe(true);
    const section=materialSheetSection(source.q/curve.forwardDerivative,h.width,age,time-age);ages.push(age);qs.push(source.q);
    for(let k=0;k<ring;k++){const col=k<cols?k:ring-1-k,sign=k<cols?1:-1;positions.set([curve.forward,curve.y+section.center[col]+sign*section.thickness[col]*.5,-section.across[col]],(j*ring+k)*3);}
   }
   let mesh=0,expected=0,orientation=0,maxBandError=0,minCell=Infinity;
   for(let j=0;j<rows-1;j++){
    const signed=materialSheetBandVolume(positions,j,cols);if(orientation===0)orientation=Math.sign(signed);expect(signed*orientation).toBeGreaterThan(0);
    const budget=.5*(qs[j]+qs[j+1])*(ages[j+1]-ages[j]);mesh+=Math.abs(signed);expected+=budget;maxBandError=Math.max(maxBandError,Math.abs(Math.abs(signed)/budget-1));
    for(let k=0;k<cols-1;k++)minCell=Math.min(minCell,materialSheetCellVolume(positions,j,k,cols)*orientation);
   }
   expect(minCell).toBeGreaterThan(0);expect(Math.abs(mesh/expected-1)).toBeLessThan(.005);expect(maxBandError).toBeLessThan(.02);
   receipts.push({name,mesh,expected,error:mesh/expected-1,maxBandError,minCell});
  }
  console.log('material volume independent audit',JSON.stringify(receipts));
 });
});
