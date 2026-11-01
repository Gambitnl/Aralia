/** Frozen prescribed structure is tested for budget, cap and actual support
 * development. None of these receipts establishes natural waterfall motion. */
import{describe,it,expect}from'vitest';
import{createHash}from'node:crypto';
import{DataUtils}from'three';
import{waterfallLiquidSection}from'@/components/World3D/water/riverWaterfallView';
import{WaterfallDensityAtlas,waterfallAtlasOccupancy,waterfallAtlasEdgeMean}from'../waterfallDensityAtlas';
function check(a:WaterfallDensityAtlas,q:number,w:number,v:number,age:number,time:number){
 const s=waterfallLiquidSection(q,w,v,age,time),edge=waterfallAtlasEdgeMean(s);let integral=0,phi=0;
 // Resolve the actual narrow taper, whose duration varies with discharge.
 // An age-only cutoff underintegrates LOW even after age.07.
 const taper=Math.min((1-s.coherence)*.4,(1-s.fraction)*.5);
 const nx=taper>0&&taper<.01?768:taper>0&&taper<.03?384:192,ny=nx/2;
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
  const x=(i+.5)*2/nx-1,y=(j+.5)*2/ny-1,d=s.fraction*waterfallAtlasOccupancy(s,x,y)*a.sample(x,y,age)/edge;
  integral+=d*s.width*s.thickness/(nx*ny);phi=Math.max(phi,d);
 }return {ratio:integral/s.area,phi};
}
function columns(a:WaterfallDensityAtlas,age:number){
 const s=a.section(age),edge=waterfallAtlasEdgeMean(s);
 const col=Array.from({length:48},(_,i)=>{let sum=0;for(let j=0;j<96;j++){
  const x=(i+.5)/24-1,y=(j+.5)/48-1;sum+=waterfallAtlasOccupancy(s,x,y)*a.sample(x,y,age)*s.fraction/edge*s.thickness/96;
 }return sum;});const total=col.reduce((a,b)=>a+b);return col.map(v=>v/total);
}
function components(data:Uint16Array,age:number){
 const z=Math.round(age/4.5*512),active=Array.from(data.slice(z*1152,(z+1)*1152),v=>DataUtils.fromHalfFloat(v)>0),seen=new Set<number>();let parts=0,largest=0;
 for(let i=0;i<active.length;i++)if(active[i]&&!seen.has(i)){
  parts++;let count=0;const queue=[i];seen.add(i);
  while(queue.length){const at=queue.pop()!,x=at%48,y=Math.floor(at/48);count++;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,k=yy*48+xx;if(xx>=0&&xx<48&&yy>=0&&yy<24&&active[k]&&!seen.has(k)){seen.add(k);queue.push(k);}}
  }largest=Math.max(largest,count);
 }return {parts,largest,total:active.filter(Boolean).length};
}
describe('frozen descent-forming density',()=>{
 it('preserves actual LOW/HIGH budgets and bounds between age rows',()=>{
  const receipts=[];let massError=0,phi=0;
  for(const [q,w,v]of [[.5,6,.059523809523809534],[12,10,12/7]]){
   const a=new WaterfallDensityAtlas(age=>waterfallLiquidSection(q,w,v,age,0),'formation');a.update(20);
   const fill=a.lastUpdateMs;
   for(const age of [0,.009,.027,.079,.167,.333,.717,1.739,2.517,3.647,4.497]){
    const r=check(a,q,w,v,age,20);massError=Math.max(massError,Math.abs(r.ratio-1));phi=Math.max(phi,r.phi);
    expect(Math.abs(r.ratio-1),`Q${q}, age${age}`).toBeLessThan(.005);expect(r.phi).toBeLessThanOrEqual(1.001);
   }
   for(let k=0;k<=100;k++){const age=k/100*.8,s=a.section(age),edge=waterfallAtlasEdgeMean(s);let max=0;
    for(let j=0;j<24;j++)for(let i=0;i<48;i++)max=Math.max(max,a.sample((i+.5)/24-1,(j+.5)/12-1,age));
    expect(max*s.fraction/edge).toBeLessThanOrEqual(1.0001);
   }
   expect(a.textureBytes).toBe(2363904);expect(a.sample(.21,-.14,0)).toBe(1);
   receipts.push({q,initializationMs:a.initializationMs,snapshotMs:fill,bytes:a.textureBytes,fallbackMaxAge:a.maximumFallbackAge,expansions:a.supportExpansions});
  }console.log('formation mass/cost',JSON.stringify({massError,phi,receipts}));
 },30000);
 it('forms new projected support within the SAME parcel during descent',()=>{
  const q=12,w=10,v=12/7,e=18,a=new WaterfallDensityAtlas(age=>waterfallLiquidSection(q,w,v,age,0),'formation');
  let prior:number[]|null=null,maxChange=0,meanChange=0;const receipts=[];
  for(const drop of [12,15,18,21,24]){
   const age=Math.sqrt(drop*2/9.81);a.freezeAt(e+age);const c=columns(a,age),p=components(a.first,age);
   expect(p.total).toBeGreaterThan(0);expect(p.largest/p.total).toBeGreaterThan(.95);
   if(prior){const difference=c.reduce((sum,x,i)=>sum+Math.abs(x-prior![i]),0);maxChange=Math.max(maxChange,difference);meanChange+=difference;}
   receipts.push({drop,age,emission:e,time:a.frozenTime,components:p,column:c});prior=c;
  }
  expect(maxChange).toBeGreaterThan(.08);expect(meanChange/4).toBeGreaterThan(.03);
  console.log('formation sameparcel',JSON.stringify({maxChange,meanChange:meanChange/4,receipts}));
 },30000);
 it('freezes deliberately, refreshes explicitly and stays continuous for small refreshes',()=>{
  const a=new WaterfallDensityAtlas(age=>waterfallLiquidSection(12,10,12/7,age,0),'formation');
  a.update(20);const old=a.first.slice(),version=a.version;expect(a.update(22)).toBe(false);expect(a.first).toEqual(old);expect(a.version).toBe(version);
  const before=columns(a,2.3);a.freezeAt(20.0001);const after=columns(a,2.3);
  expect(after.reduce((sum,v,i)=>sum+Math.abs(v-before[i]),0)).toBeLessThan(.02);
  expect(a.first).toEqual(a.second);expect(a.blend).toBe(0);expect(()=>a.freezeAt(NaN)).toThrow('finite');
 },30000);
 it('retains exact pre-change legacy texture bytes and clock',()=>{
  const q=12,w=10,v=12/7,a=new WaterfallDensityAtlas(age=>waterfallLiquidSection(q,w,v,age,0),'legacy');a.update(20.061);
  const sha=(data:Uint16Array)=>createHash('sha256').update(Buffer.from(data.buffer)).digest('hex');
  // Captured before introducing formation; this protects the user's native
  // six-track baseline and resident flood profile from an incidental change.
  expect(sha(a.first)).toBe('25f1c917c760de4f93480d85e3dd23cc19bec5f25f3f55f7d5e48d48cf76e213');
  expect(sha(a.second)).toBe('34b48545735aa74e09538152a3c787dbf11f0251d65e474c8ef99ab3f68757fc');
  expect(a.blend).toBe(0.48799999999999955);expect(a.frozenTime).toBeNull();expect(a.config.ages).toBe(65);
 });
});
