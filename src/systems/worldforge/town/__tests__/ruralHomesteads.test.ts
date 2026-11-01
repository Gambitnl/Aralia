/** Source geometry gates do not substitute for furnished/native farm acceptance. */
import {describe,it,expect} from 'vitest';
import {planRuralHomesteads,RURAL_PLOT_ID_BASE} from '../ruralHomesteads';
import {transformTownPlan} from '../canonicalTown';
import type {TownPlan} from '../townEngine';
import type {Pt} from '../../submap/submapEngine';
import {rootSeedPath} from '../../seedPath';
import {footprintFitsLot,footprintDistance,footprintRouteDistance} from '../../props/propFootprint';
const seed=rootSeedPath(42);
const shape=(p:Pt[])=>p.map(([x,z])=>({x,z}));
const square=(x:number,y:number,w:number,h=w):Pt[]=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
function fixture():TownPlan{return{
 footprint:square(-200,-200,600),core:square(250,250,50),wards:[],plots:[],openLand:[],
 walls:{ring:[],gatehouses:[],waterGates:[]},civic:[],streets:[],courtyards:[],
 outskirts:[{kind:'farm',polygon:square(0,0,200)}],
 streetNetwork:[{centerline:[[-20,-100],[-20,300]],width:12,tier:'lane',role:'approach'}],
 farmsteads:[{id:'f0',x:100,y:100,occupants:5,farmParcelIndex:0,representedPopulation:50}],
};}
describe('candidate physical homestead planning',()=>{
 it('fits a house, working yard and eight-foot route without changing source facts',()=>{
  const plan=fixture(),before=JSON.stringify(plan),out=planRuralHomesteads(plan,seed,1);
  expect(out.declined).toEqual([]);expect(out.sites).toHaveLength(1);
  const site=out.sites[0];expect(site.plotId).toBe(RURAL_PLOT_ID_BASE);
  expect(site.farmId).toBe('f0');expect(site.occupants).toBe(5);expect(site.sourceCenter).toEqual([100,100]);
  expect(footprintFitsLot(shape(site.yard),shape(plan.outskirts[0].polygon),1)).toBe(true);
  expect(footprintFitsLot(shape(site.house),shape(site.yard),1)).toBe(true);
  expect(site.approach.width).toBe(8);expect(site.approach.streetIndex).toBe(0);
  expect(site.approach.points[1][0]).toBe(-20);
  expect(JSON.stringify(plan)).toBe(before);
 });
 it('packs a narrow parent from its frontage instead of bisecting later home sites',()=>{
  const plan=fixture();plan.outskirts[0].polygon=square(0,0,200,60);
  plan.farmsteads=[0,1,2].map(i=>({...plan.farmsteads[0],id:'f'+i,x:100,y:30}));
  const before=JSON.stringify(plan),out=planRuralHomesteads(plan,seed,1);
  expect(out.sites).toHaveLength(3);expect(out.declined).toEqual([]);
  expect(out.sites.map(s=>s.farmId).sort()).toEqual(['f0','f1','f2']);
  for(const site of out.sites){expect(site.occupants).toBe(5);expect(site.sourceCenter).toEqual([100,30]);}
  for(let i=0;i<out.sites.length;i++)for(let j=0;j<i;j++)expect(footprintDistance(shape(out.sites[i].yard),shape(out.sites[j].yard))).toBeGreaterThanOrEqual(2);
  expect(planRuralHomesteads({...plan,farmsteads:[...plan.farmsteads].reverse()},seed,1)).toEqual(out);
  expect(JSON.stringify(plan)).toBe(before);
 });
 it('gives larger households more usable envelope rather than dropping residents',()=>{
  const a=fixture(),b=fixture();a.farmsteads[0].occupants=1;b.farmsteads[0].occupants=8;
  const small=planRuralHomesteads(a,seed,1).sites[0],large=planRuralHomesteads(b,seed,1).sites[0];
  const area=(p:Pt[])=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2);
  expect(area(large.house)).toBeGreaterThan(area(small.house));expect(large.occupants).toBe(8);
 });
 it('recovers an out-of-field marker only for a new planned home, retaining the source point',()=>{
  const plan=fixture();plan.farmsteads[0].x=300;
  const out=planRuralHomesteads(plan,seed,1);expect(out.sites).toHaveLength(1);
  expect(out.sites[0].sourceCenter).toEqual([300,100]);expect(out.sites[0].center[0]).toBeLessThan(200);
  expect(plan.farmsteads[0].x).toBe(300);
 });
 it('keeps neighboring working yards separate and identities stable in reversed input order',()=>{
  const plan=fixture();plan.farmsteads.push({...plan.farmsteads[0],id:'f2'});
  const out=planRuralHomesteads(plan,seed,1);expect(out.sites).toHaveLength(2);
  expect(footprintDistance(shape(out.sites[0].yard),shape(out.sites[1].yard))).toBeGreaterThanOrEqual(2);
  expect(out.sites.map(s=>s.plotId)).toEqual([RURAL_PLOT_ID_BASE,RURAL_PLOT_ID_BASE+2]);
  expect(planRuralHomesteads({...plan,farmsteads:[...plan.farmsteads].reverse()},seed,1)).toEqual(out);
 });
 it('follows a narrow field grain while keeping a full-width bent road approach',()=>{
  const plan=fixture(),a=0.65,u=[Math.cos(a),Math.sin(a)],v=[-u[1],u[0]];
  plan.outskirts[0]={kind:'farm',furrowAngle:a,polygon:[[-1,-1],[1,-1],[1,1],[-1,1]].map(([s,t])=>[100+u[0]*s*100+v[0]*t*23,100+u[1]*s*100+v[1]*t*23] as Pt)};
  const out=planRuralHomesteads(plan,seed,1);expect(out.sites).toHaveLength(1);
  const site=out.sites[0];expect(site.approach.points).toHaveLength(3);expect(site.approach.width).toBe(8);
  expect(footprintFitsLot(shape(site.yard),shape(plan.outskirts[0].polygon),1)).toBe(true);
 });
 it('uses an explicit agricultural parent for a yard while retaining the worked strip identity',()=>{
  const plan=fixture();plan.outskirts[0].polygon=square(0,0,20,200);
  plan.farmsteads[0].x=10;
  expect(planRuralHomesteads(plan,seed,1).sites).toHaveLength(0);
  plan.outskirts[0].farmParent={id:'source-field:7',polygon:square(0,0,200)};
  const out=planRuralHomesteads(plan,seed,1);expect(out.sites).toHaveLength(1);
  expect(out.sites[0].farmParcelIndex).toBe(0);
  expect(out.sites[0].yardSource).toEqual({kind:'parent-parcel',id:'source-field:7'});
  expect(footprintFitsLot(shape(out.sites[0].yard),shape(plan.outskirts[0].farmParent.polygon),1)).toBe(true);
 });
 it('shares a proven track outside its source yard when a direct approach is blocked',()=>{
  const plan=fixture();plan.outskirts[0].polygon=square(73,80,54,40);
  plan.outskirts.push({kind:'farm',polygon:square(40,150,200,150)});
  plan.farmsteads.push({...plan.farmsteads[0],id:'f1',x:100,y:180,farmParcelIndex:1});
  // The second source field cannot move around the end of this barrier to
  // obtain a direct road connection; its clear option is the existing track.
  plan.plots=[{polygon:square(20,140,20,260),frontageEdge:0}];
  const out=planRuralHomesteads(plan,seed,1);expect(out.sites).toHaveLength(2);
  const branch=out.sites.find(s=>s.farmId==='f1')!;
  expect(branch.approach.sharedWithFarmId).toBe('f0');expect(branch.approach.streetIndex).toBe(0);
  expect(footprintDistance(shape(out.sites[0].yard),shape(branch.yard))).toBeGreaterThanOrEqual(2);
 });
 it('routes a fixed clear homestead around a lot when a direct connection is blocked',()=>{
  const plan=fixture();plan.outskirts[0].polygon=square(73,80,54,40);
  plan.plots=[{polygon:square(20,80,20,40),frontageEdge:0}];
  const before=JSON.stringify(plan),out=planRuralHomesteads(plan,seed,1);
  expect(out.sites).toHaveLength(1);expect(out.declined).toEqual([]);
  const site=out.sites[0];expect(site.center).toEqual([100,100]);
  expect(site.occupants).toBe(5);expect(site.farmId).toBe('f0');
  expect(site.approach.points.length).toBeGreaterThan(2);expect(site.approach.width).toBe(8);
  expect(site.approach.streetIndex).toBe(0);
  const end=site.approach.points.at(-1)!;expect(end[0]).toBe(-20);expect(end[1]).toBeGreaterThanOrEqual(-100);expect(end[1]).toBeLessThanOrEqual(300);
  const blocker=shape(plan.plots[0].polygon),from=(p:Pt)=>({x:p[0],z:p[1]});
  for(let i=1;i<site.approach.points.length;i++)expect(footprintRouteDistance(blocker,from(site.approach.points[i-1]),from(site.approach.points[i]))).toBeGreaterThanOrEqual(5);
  expect(JSON.stringify(plan)).toBe(before);
 });
 it('records a tight field instead of shrinking a family or omitting its need',()=>{
  const plan=fixture();plan.outskirts[0].polygon=square(0,0,20);
  const out=planRuralHomesteads(plan,seed,1);expect(out.sites).toEqual([]);
  expect(out.declined[0]).toMatchObject({farmId:'f0',farmParcelIndex:0,occupants:5,reason:'no-house-yard-and-public-approach-fit'});
  expect(out.declined[0].rejections!['yard-source-land']).toBeGreaterThan(0);
 });
 it('does not invent a public connection when the source town has no road',()=>{
  const plan=fixture();plan.streetNetwork=[];expect(planRuralHomesteads(plan,seed,1).declined[0].reason).toBe('no-public-road-source');
 });
 it('joins an external approach rather than shortcut through a walled town',()=>{
  const plan=fixture();plan.walls.ring=square(150,0,200);
  plan.streetNetwork.unshift({centerline:[[175,0],[175,200]],width:10,tier:'lane',role:'ward'});
  const out=planRuralHomesteads(plan,seed,1);expect(out.sites).toHaveLength(1);
  expect(out.sites[0].approach.streetIndex).toBe(1);
  const blocked=fixture();blocked.walls.ring=square(-50,-50,300);
  expect(planRuralHomesteads(blocked,seed,1).sites).toHaveLength(0);
 });
 it('keeps a public suburban lane outside the wall available to rural homes',()=>{
  const plan=fixture();plan.walls.ring=square(150,0,200);plan.streetNetwork[0].role='ward';
  expect(planRuralHomesteads(plan,seed,1).sites).toHaveLength(1);
 });
 it('does not put a yard or its route through an existing building',()=>{
  const plan=fixture();plan.plots=[{polygon:square(-50,-50,300),frontageEdge:0}];
  expect(planRuralHomesteads(plan,seed,1).sites).toEqual([]);
 });
 it('refuses ambiguous duplicated farm identity and invalid field joins',()=>{
  const plan=fixture();plan.farmsteads.push({...plan.farmsteads[0]});
  expect(planRuralHomesteads(plan,seed,1).sites).toEqual([]);
  const other=fixture();other.farmsteads[0].farmParcelIndex=7;
  expect(planRuralHomesteads(other,seed,1).declined[0].reason).toBe('invalid-household-or-field-source');
 });
 it.each([0,-1,NaN])('refuses unknown physical scale %s',scale=>{
  expect(()=>planRuralHomesteads(fixture(),seed,scale)).toThrow('real plan scale');
 });
 it('preserves physical dimensions, source identity and route width across canonical transforms',()=>{
  const plan=fixture();plan.outskirts[0].farmParent={id:'parent',polygon:square(0,0,200)};
  plan.ruralHomesteads=planRuralHomesteads(plan,seed,1);
  const before=JSON.stringify(plan),moved=transformTownPlan(plan,2,7,-9),a=plan.ruralHomesteads.sites[0],b=moved.ruralHomesteads!.sites[0];
  expect(b.house).toEqual(a.house.map(([x,y])=>[x*2+7,y*2-9]));
  expect(b.yard).toEqual(a.yard.map(([x,y])=>[x*2+7,y*2-9]));
  expect(b.approach.points).toEqual(a.approach.points.map(([x,y])=>[x*2+7,y*2-9]));
  expect(b.approach.width).toBe(16);expect(b.farmParcelIndex).toBe(a.farmParcelIndex);expect(b.crop).toBe(a.crop);
  expect(moved.outskirts[0].farmParent!.polygon).toEqual(plan.outskirts[0].farmParent!.polygon.map(([x,y])=>[x*2+7,y*2-9]));
  expect(moved.outskirts[0].farmParent!.polygon).not.toBe(plan.outskirts[0].farmParent!.polygon);
  expect(JSON.stringify(plan)).toBe(before);expect(b.house).not.toBe(a.house);
  expect(JSON.parse(JSON.stringify(moved)).ruralHomesteads).toEqual(moved.ruralHomesteads);
  const unplanned=fixture();expect(Object.hasOwn(transformTownPlan(unplanned,2),'ruralHomesteads')).toBe(false);
 });
});

// Use the actual fitted leaf and renderer transform, not a second doorway
// formula, to verify the planner's shared-grid anchor for small and large homes.
describe('fresh farm track reaches its fitted entrance',()=>{
 it.each([1,2,3,4,5,6,7,8])('retains all %i residents and reaches the real leaf',async count=>{
  const {toArtifactPlan}=await import('../townPlanAdapter');
  const {buildingPlotInput}=await import('../buildingPlotInput');
  const {blueprintForPlot}=await import('../../interior/generateInterior');
  const {buildInterior}=await import('../../bridge/interiorParts');
  const {physicalResidentDoor}=await import('../../bridge/residentDoorRoutes');
  const plan=fixture();plan.farmsteads[0].occupants=count;
  plan.ruralHomesteads=planRuralHomesteads(plan,seed,1);
  const artifact=toArtifactPlan(plan,7,undefined,undefined,{includeRuralHomesteads:true}).plan;
  const site=artifact.ruralSources!.homesteads.sites[0],plot=artifact.plots.find(p=>p.id===site.plotId)!;
  const input=buildingPlotInput(artifact,plot,seed,{cultureType:'Generic',climate:'temperate'});
  const blueprint=blueprintForPlot(input,seed),interior=buildInterior(input,seed,3,[],false,false,blueprint),ft=.3048;
  const center=plot.footprint.reduce((point,p)=>[point[0]+p[0]/4,point[1]+p[1]/4],[0,0]);
  const door=physicalResidentDoor({cornersM:plot.footprint.map(([x,z])=>({x:x*ft,z:z*ft})),parts:interior.parts,
    frontDoorOffsetX:(site.approach.points[0][0]-center[0])*ft,frontDoorOffsetZ:(site.approach.points[0][1]-center[1])*ft} as Parameters<typeof physicalResidentDoor>[0])!;
  expect(center[0]+door.x/ft).toBeCloseTo(site.approach.points[0][0],8);
  expect(center[1]+door.z/ft).toBeCloseTo(site.approach.points[0][1],8);
  expect(blueprint.household!.slots).toHaveLength(count);
 });
});

describe('fresh rural home ground on existing scrub',()=>{
 function constrained(){const plan=fixture();plan.outskirts[0].polygon=square(0,0,10);plan.farmsteads[0]={...plan.farmsteads[0],x:5,y:5};return plan;}
 it('uses classified scrub only after farm land fails and retains the working field and source marker',()=>{
  const plan=constrained();plan.outskirts.push({kind:'scrub',polygon:square(50,0,150)});
  const before=JSON.stringify(plan),out=planRuralHomesteads(plan,seed,1),site=out.sites[0];
  expect(out.declined).toEqual([]);expect(site).toMatchObject({farmId:'f0',plotId:RURAL_PLOT_ID_BASE,farmParcelIndex:0,occupants:5,sourceCenter:[5,5],yardSource:{kind:'scrub-parcel',id:'scrub-parcel:1'}});
  expect(footprintFitsLot(shape(site.yard),shape(plan.outskirts[1].polygon),1)).toBe(true);
  expect(footprintDistance(shape(site.yard),shape(plan.outskirts[0].polygon))).toBeGreaterThan(0);
  expect(JSON.stringify(plan)).toBe(before);expect(planRuralHomesteads(plan,seed,1)).toEqual(out);
 });
 it('preserves every original admitted site before adding a previously refused family',()=>{
  const plan=fixture();plan.outskirts.push({kind:'farm',polygon:square(300,0,10)});
  plan.farmsteads.push({...plan.farmsteads[0],id:'f1',x:305,y:5,farmParcelIndex:1});
  const old=planRuralHomesteads(plan,seed,1);expect(old.sites.map(s=>s.farmId)).toEqual(['f0']);
  plan.outskirts.push({kind:'scrub',polygon:square(0,-180,200,70)});
  const next=planRuralHomesteads(plan,seed,1);expect(next.sites.slice(0,old.sites.length)).toEqual(old.sites);
  expect(next.sites.map(s=>s.farmId).sort()).toEqual(['f0','f1']);expect(next.declined).toEqual([]);
  expect(planRuralHomesteads({...plan,farmsteads:[...plan.farmsteads].reverse()},seed,1)).toEqual(next);
 });
 it('retains refusal instead of taking pasture, tiny scrub or occupied scrub',()=>{
  for(const kind of ['pasture','tiny','occupied'] as const){
   const plan=constrained();plan.outskirts.push({kind:kind==='pasture'?'pasture':'scrub',polygon:kind==='tiny'?square(50,0,5):square(50,0,150)});
   if(kind==='occupied')plan.plots.push({polygon:square(50,0,150)} as TownPlan['plots'][number]);
   const out=planRuralHomesteads(plan,seed,1);expect(out.sites).toEqual([]);expect(out.declined).toHaveLength(1);expect(out.declined[0].farmId).toBe('f0');
  }
 });
});
