/** Artifact identities and reservations do not substitute for native farm play. */
import {describe,it,expect} from 'vitest';
import {toArtifactPlan} from '../townPlanAdapter';
import {buildRuralHomesteadArtifacts,clearsRuralHomeReservations,ruralCultivationFits} from '../ruralHomesteadArtifacts';
import {planRuralHomesteads,RURAL_PLOT_ID_BASE} from '../ruralHomesteads';
import {householdForPlot,householdPopulationsForPlan,householdPopulationForPlot} from '../householdBrief';
import {generateHousehold} from '../household';
import {STYLE_FAMILIES} from '../architectureStyle';
import {rootSeedPath} from '../../seedPath';
import type {TownPlan} from '../townEngine';
import type {Pt} from '../../submap/submapEngine';
const square=(x:number,y:number,w:number,h=w):Pt[]=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const hull=(x:number,y:number,w:number,h=w)=>square(x,y,w,h).map(([x,z])=>({x,z}));
const seed=rootSeedPath(42);
function fixture():TownPlan{
 const plot={polygon:square(250,250,30),frontageEdge:0,buildingType:'cottage' as const,residential:true,occupants:4,homeId:'b0'};
 const plan:TownPlan={footprint:square(-200,-200,600),core:square(250,250,50),
  wards:[{polygon:square(240,240,60),block:square(240,240,60),plots:[plot]}],plots:[plot],openLand:[],
  walls:{ring:[],gatehouses:[],waterGates:[]},civic:[],streets:[],courtyards:[],
  outskirts:[{kind:'farm',polygon:square(0,0,200)}],
  streetNetwork:[{centerline:[[-20,-100],[-20,300]],width:12,tier:'lane',role:'approach'}],
  farmsteads:[{id:'f0',x:100,y:100,occupants:5,farmParcelIndex:0,representedPopulation:50}]};
 plan.ruralHomesteads=planRuralHomesteads(plan,seed,1);return plan;
}
describe('explicit rural artifact bridge',()=>{
 it('keeps default artifacts exact and appends stable plots/tracks only when requested',()=>{
  const engine=fixture(),before=JSON.stringify(engine),old=toArtifactPlan(engine,7),candidate=toArtifactPlan(engine,7,undefined,undefined,{includeRuralHomesteads:true,retainPropParcels:true});
  expect(old.plan.plots).toHaveLength(1);expect(old.plan.ruralSources).toBeUndefined();
  expect(candidate.plan.plots[0]).toEqual(old.plan.plots[0]);expect(candidate.plan.streets[0]).toEqual(old.plan.streets[0]);
  expect(candidate.plan.plots[1]).toMatchObject({id:RURAL_PLOT_ID_BASE,role:'farm',storeys:1,pop:{homeId:'f0',buildingType:'farmstead',occupants:5}});
  expect(candidate.plan.plots[1].footprint).toEqual(engine.ruralHomesteads!.sites[0].house);
  expect(candidate.plan.streets[1]).toMatchObject({id:RURAL_PLOT_ID_BASE,widthFt:8});
  expect(candidate.propParcels!.find(p=>p.plotId===RURAL_PLOT_ID_BASE)!.polygon).toEqual(engine.ruralHomesteads!.sites[0].yard);
  expect(JSON.stringify(engine)).toBe(before);
  const legacy=structuredClone(engine);delete legacy.ruralHomesteads;
  expect(toArtifactPlan(legacy,7)).toEqual(old);
 });
 it('reproduces the existing named farm family through the artifact household consumer',()=>{
  const engine=fixture(),artifact=toArtifactPlan(engine,7,STYLE_FAMILIES[Object.keys(STYLE_FAMILIES)[0] as keyof typeof STYLE_FAMILIES],undefined,{includeRuralHomesteads:true}).plan;
  const farm=artifact.plots.find(p=>p.id===RURAL_PLOT_ID_BASE)!,population=householdPopulationForPlot(farm)!;
  const household=householdForPlot(population,householdPopulationsForPlan(artifact),seed)!.household;
  expect(household).toEqual(generateHousehold(seed,'f0',5,'farmstead'));
  expect(household.occupation).toBe('farmer');expect(farm.architecture?.wealth).toBe('common');
 });
 it('copies fields, crops and all declined needs into a serializable source packet',()=>{
  const engine=fixture();engine.outskirts.push({kind:'farm',polygon:square(150,150,10)});
  engine.farmsteads.push({id:'f1',x:155,y:155,occupants:8,farmParcelIndex:1});
  engine.ruralHomesteads=planRuralHomesteads(engine,seed,1);
  const out=toArtifactPlan(engine,7,undefined,undefined,{includeRuralHomesteads:true}).plan;
  expect(out.ruralSources!.homesteads.declined).toHaveLength(1);expect(out.ruralSources!.homesteads.declined[0].farmId).toBe('f1');
  expect(out.ruralSources!.fields).toEqual([{farmParcelIndex:0,polygon:engine.outskirts[0].polygon,crop:engine.ruralHomesteads.sites[0].crop}]);
  expect(JSON.parse(JSON.stringify(out))).toEqual(out);
  out.ruralSources!.fields[0].polygon[0][0]=999;out.ruralSources!.homesteads.sites[0].house[0][0]=999;
  expect(engine.outskirts[0].polygon[0][0]).toBe(0);expect(engine.ruralHomesteads.sites[0].house[0][0]).not.toBe(999);
 });
 it('refuses absent sources, reserved-id collisions and mismatched family/field facts',()=>{
  const engine=fixture(),missing=structuredClone(engine);delete missing.ruralHomesteads;
  expect(()=>buildRuralHomesteadArtifacts(missing,[],[0])).toThrow(/explicit/);
  expect(()=>buildRuralHomesteadArtifacts(engine,[RURAL_PLOT_ID_BASE],[0])).toThrow(/inconsistent/);
  expect(()=>buildRuralHomesteadArtifacts(engine,[],[0,RURAL_PLOT_ID_BASE])).toThrow(/inconsistent/);
  for(const field of ['occupants','farmParcelIndex'] as const){const altered=structuredClone(engine);altered.farmsteads[0][field]++;expect(()=>buildRuralHomesteadArtifacts(altered,[],[0])).toThrow(/inconsistent/);}
  const lost=structuredClone(engine);lost.ruralHomesteads!.sites=[];expect(()=>buildRuralHomesteadArtifacts(lost,[],[0])).toThrow(/every/);
  const wrongFrame=structuredClone(engine);wrongFrame.ruralHomesteads!.sites[0].approach.width=4;expect(()=>buildRuralHomesteadArtifacts(wrongFrame,[],[0])).toThrow(/inconsistent/);
 });
});
describe('whole-footprint rural ground reservations',()=>{
 function sources(){return buildRuralHomesteadArtifacts(fixture(),[],[0]).sources;}
 it('keeps cultivation and unaffiliated props outside whole yards and approach widths',()=>{
  const source=sources(),site=source.homesteads.sites[0];
  expect(clearsRuralHomeReservations(site.house.map(([x,z])=>({x,z})),source)).toBe(false);
  const [a,b]=site.approach.points,x=(a[0]+b[0])/2,y=(a[1]+b[1])/2;
  expect(clearsRuralHomeReservations(hull(x-1,y+3.5,2),source)).toBe(false);
  expect(clearsRuralHomeReservations(hull(150,150,2),source)).toBe(true);
  expect(ruralCultivationFits(hull(150,150,2),0,source)).toBe(true);
  expect(ruralCultivationFits(hull(199,150,2),0,source)).toBe(false);
  expect(ruralCultivationFits(hull(150,150,2),9,source)).toBe(false);
 });
 it('reserves the full square bend beyond a round endpoint cap',()=>{
  const source=sources();source.homesteads.sites[0].approach.points=[[100,100],[150,100],[150,150]];
  expect(clearsRuralHomeReservations(hull(153.7,96.1,0.2),source)).toBe(false);
  expect(clearsRuralHomeReservations(hull(145,94,0.2),source)).toBe(true);
 });
 it('fails closed for invalid hulls or reservation margins',()=>{
  const source=sources();expect(clearsRuralHomeReservations([],source)).toBe(false);
  expect(clearsRuralHomeReservations(hull(150,150,2),source,-1)).toBe(false);
  expect(ruralCultivationFits(hull(150,150,2),0,source,NaN)).toBe(false);
 });
});

it('allows only its recorded serving yard while preserving full approach reservations',()=>{
  const sources=buildRuralHomesteadArtifacts(fixture(),[],[0]).sources,site=sources.homesteads.sites[0];
  const [a,b]=site.approach.points;
  // A small patch at the rear yard corner lies outside the front approach.
  const [rear]=site.yard.slice(2,3);
  const center=site.center,inside=rear.map((v,i)=>v*.9+center[i]*.1) as Pt;
  expect(clearsRuralHomeReservations(hull(inside[0],inside[1],.1),sources,0,site.plotId)).toBe(true);
  expect(clearsRuralHomeReservations(hull(a[0]-.1,a[1]-.1,.2),sources,0,site.plotId)).toBe(false);
  expect(clearsRuralHomeReservations(hull((a[0]+b[0])/2,(a[1]+b[1])/2,.2),sources,0,site.plotId)).toBe(false);
  expect(clearsRuralHomeReservations(hull(150,150,1),sources,0,site.plotId+1)).toBe(false);
});

it('binds a scrub home to real source scrub while keeping the original crop field',()=>{
 const engine=fixture();engine.outskirts[0].polygon=square(0,0,10);engine.farmsteads[0].x=5;engine.farmsteads[0].y=5;
 engine.outskirts.push({kind:'scrub',polygon:square(50,0,150)});engine.ruralHomesteads=planRuralHomesteads(engine,seed,1);
 const site=engine.ruralHomesteads.sites[0];expect(site.yardSource.kind).toBe('scrub-parcel');
 const artifact=buildRuralHomesteadArtifacts(engine,[],[0]);
 expect(artifact.sources.fields[0]).toEqual({farmParcelIndex:0,polygon:engine.outskirts[0].polygon,crop:site.crop});
 expect(artifact.plots[0].pop!.homeId).toBe('f0');
 expect(JSON.parse(JSON.stringify(artifact))).toEqual(artifact);
 const lostLand=structuredClone(engine);delete (lostLand.ruralHomesteads!.sites[0] as Partial<typeof site>).yardSource;expect(()=>buildRuralHomesteadArtifacts(lostLand,[],[0])).toThrow(/inconsistent/);
 const wrong=structuredClone(engine);wrong.outskirts[1].kind='pasture';expect(()=>buildRuralHomesteadArtifacts(wrong,[],[0])).toThrow(/inconsistent/);
 const moved=structuredClone(engine);moved.outskirts[1].polygon=square(250,0,100);expect(()=>buildRuralHomesteadArtifacts(moved,[],[0])).toThrow(/inconsistent/);
});
