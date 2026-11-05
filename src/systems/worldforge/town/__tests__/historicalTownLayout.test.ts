/** Historical selection must follow the played town, without replacing its
 * people, moved households, goods or immutable observed building foundations. */
import {describe,it,expect} from 'vitest';
import {qualifyHistoricalTownLayout, type HistoricalTownLayoutCandidate} from '../historicalTownLayout';
import {generateBuilding} from '../../interior/generateBuilding';
import {captureObservedBuildingSource,buildingPlanSignature} from '../../interior/buildingSource';
import {rootSeedPath} from '../../seedPath';
import type {TownSimState} from '../../townsim/types';

function fixture(){
 const plan=structuredClone(generateBuilding({buildingId:1,type:'cottage',seedPath:rootSeedPath(77),storeys:1}));
 const site={xM:20,zM:30,surfaceY:2,rotationY:0,doorZSign:-1};
 const source=captureObservedBuildingSource({worldSeed:77,burgId:8,plotId:1,cellId:9,
  observedAt:'0351-01-01T09:00:00Z',position:{tileX:9,tileY:0,xM:20,zM:29,yM:2},
  site,historySignature:'null',plan,workplaceOnly:false,manifests:[]},buildingPlanSignature(plan));
 const town:TownSimState={burgId:8,villagers:{
  1:{occupantId:1,name:'Mara',householdMemberId:'b1:head',race:'Human',bornDay:-9000,
   homePlotId:2,parentIds:[],childIds:[],wealth:30},
  2:{occupantId:2,name:'Fin',householdMemberId:'b2:head',race:'Human',bornDay:-8000,
   homePlotId:2,parentIds:[],childIds:[],wealth:20},
 },chronicle:{burgId:8,events:[],nextEventId:1},buildingSources:{1:source},lastSimDay:1,nextVillagerId:3};
 const earlier:HistoricalTownLayoutCandidate={revision:1,worldSeed:77,burgId:8,cellId:9,plotIds:[1,2],
  foundingRoster:{burgId:8,occupants:[
   {id:1,name:'Mara',householdMemberId:'b1:head',homePlotId:1,workPlotId:2,ageBand:'adult',occupation:'artisan'},
   {id:2,name:'Fin',householdMemberId:'b2:head',homePlotId:2,ageBand:'adult',occupation:'resident'},
  ]},buildings:{1:{plan:structuredClone(plan),site:{...site}}}};
 const current=structuredClone(earlier);current.revision=2;current.buildings[1].plan.widthFt+=5;
 const cellAffine=structuredClone(earlier);cellAffine.revision=4;
 cellAffine.foundingRoster.occupants[0].name='Different founding household';
 return {worldSeed:77,cellId:9,gameTime:'0351-01-01T10:00:00Z',town,candidates:[earlier,current,cellAffine]};
}

describe('historical layout qualification',()=>{
 it.each(['all','some'] as const)('admits absent legacy household links (%s) without inventing them',kind=>{
  const input=fixture();
  delete input.town.villagers[1].householdMemberId;
  if(kind==='all')delete input.town.villagers[2].householdMemberId;
  const before=JSON.stringify(input);
  expect(qualifyHistoricalTownLayout(input)).toEqual({status:'qualified',revision:1,observations:1,founders:2});
  expect(JSON.stringify(input)).toBe(before);
  expect(input.town.villagers[1].householdMemberId).toBeUndefined();
 });
 it.each(['changed-name','recorded-role','undocumented-birth','duplicate-source-role'] as const)('keeps identity/history checks when legacy links are absent: %s',kind=>{
  const input=fixture();delete input.town.villagers[1].householdMemberId;
  if(kind==='changed-name')input.town.villagers[1].name='Different person';
  if(kind==='recorded-role')input.town.villagers[2].householdMemberId='b9:head';
  if(kind==='duplicate-source-role'){
   delete input.town.villagers[2].householdMemberId;
   input.candidates[0].foundingRoster.occupants[1].householdMemberId='b1:head';
  }
  if(kind==='undocumented-birth')input.town.villagers[3]={occupantId:3,name:'Pip',race:'Human',bornDay:0,
   homePlotId:2,parentIds:[1,2],childIds:[],wealth:0};
  const before=JSON.stringify(input);
  expect(qualifyHistoricalTownLayout(input)).toMatchObject({status:'unresolved',reason:'no-match'});
  expect(JSON.stringify(input)).toBe(before);
 });
 it('requires a unique full founding match for explicitly unobserved exterior admission',()=>{
  const input={...fixture(),allowUnobservedExterior:true};input.town.buildingSources={};
  // With no foundations, two identical founding rosters are ambiguous even
  // though their new blueprints differ. A timestamp cannot choose a reader.
  expect(qualifyHistoricalTownLayout(input)).toMatchObject({status:'unresolved',reason:'ambiguous'});
  input.candidates[0].foundingRoster.occupants[0].name='A different founder';
  expect(qualifyHistoricalTownLayout(input)).toMatchObject({status:'qualified',revision:2,observations:0});
  input.candidates[1].foundingRoster.occupants[0].name='Another different founder';
  expect(qualifyHistoricalTownLayout(input)).toMatchObject({status:'unresolved',reason:'no-match'});
 });
 it('does not qualify the cell-affine reader if that alternative was omitted',()=>{
  const input=fixture();input.candidates.pop();
  expect(qualifyHistoricalTownLayout(input)).toMatchObject({status:'unresolved',reason:'incomplete-readers'});
 });
 it('uniquely identifies independent foundations without moving a married resident back home or changing input',()=>{
  const input=fixture(),before=JSON.stringify(input);
  expect(qualifyHistoricalTownLayout(input)).toEqual({status:'qualified',revision:1,observations:1,founders:2});
  expect(JSON.stringify(input)).toBe(before);expect(input.town.villagers[1].homePlotId).toBe(2);
  expect(input.town.layoutRevision).toBeUndefined();
 });
 it('can qualify the current reader too; old does not mean revision one',()=>{
  const input=fixture();input.candidates[0].buildings[1].plan.widthFt+=5;
  input.candidates[1].buildings[1].plan.widthFt-=5;
  expect(qualifyHistoricalTownLayout(input)).toMatchObject({status:'qualified',revision:2});
 });
 it.each(['absent','ambiguous','omitted-reader','duplicate-reader','already-selected'] as const)('refuses unsupported inference: %s',kind=>{
  const input=fixture();
  if(kind==='absent')input.town.buildingSources={};
  if(kind==='ambiguous')input.candidates[1].buildings[1].plan=structuredClone(input.candidates[0].buildings[1].plan);
  if(kind==='omitted-reader')input.candidates.pop();
  if(kind==='duplicate-reader')input.candidates[1].revision=1;
  if(kind==='already-selected')input.town.layoutRevision=2;
  const before=JSON.stringify(input);
  const reasons={absent:'missing-observations',ambiguous:'ambiguous','omitted-reader':'incomplete-readers',
   'duplicate-reader':'incomplete-readers','already-selected':'already-selected'};
  expect(qualifyHistoricalTownLayout(input)).toMatchObject({status:'unresolved',reason:reasons[kind]});
  expect(JSON.stringify(input)).toBe(before);
 });
 it.each(['name','member','duplicate-person','missing-founder','missing-home','work-site','civic-site',
  'blueprint','position','wrong-world','wrong-cell','duplicate-plot'] as const)('rejects conflicting candidate %s',kind=>{
  const input=fixture(),candidate=input.candidates[0];
  if(kind==='name')candidate.foundingRoster.occupants[0].name='Another person';
  if(kind==='member')candidate.foundingRoster.occupants[0].householdMemberId='b1:spouse';
  if(kind==='duplicate-person')candidate.foundingRoster.occupants.push({...candidate.foundingRoster.occupants[0]});
  if(kind==='missing-founder')candidate.foundingRoster.occupants.pop();
  if(kind==='missing-home')input.town.villagers[1].homePlotId=3;
  if(kind==='work-site')candidate.foundingRoster.occupants[0].workPlotId=3;
  if(kind==='civic-site')candidate.foundingRoster.occupants[0].civicWorkplace={role:'librarian',plotId:3};
  if(kind==='blueprint')candidate.buildings[1].plan.floors[0].rooms[0].purpose='storage';
  if(kind==='position')candidate.buildings[1].site.xM+=.01;
  if(kind==='wrong-world')candidate.worldSeed++;
  if(kind==='wrong-cell')candidate.cellId++;
  if(kind==='duplicate-plot')candidate.plotIds=[1,2,2];
  expect(qualifyHistoricalTownLayout(input)).toMatchObject({status:'unresolved',reason:'no-match'});
 });
 it.each(['world','cell','key','plan','future','signature','history'] as const)('rejects damaged or mismatched saved observation %s',kind=>{
  const input=fixture(),source=input.town.buildingSources![1];
  if(kind==='world')source.worldSeed++;
  if(kind==='cell')source.cellId++;
  if(kind==='key')input.town.buildingSources={2:source};
  if(kind==='plan')source.plan.widthFt+=5;
  if(kind==='future')source.observedAt='0351-01-02T09:00:00Z';
  if(kind==='signature')source.planSignature='forged';
  if(kind==='history')source.historySignature='{bad JSON';
  expect(qualifyHistoricalTownLayout(input)).toMatchObject({status:'unresolved',reason:'invalid-observations'});
 });
 it('retains a dated child outside the founding roster, but requires the saved birth and real parent',()=>{
  const input=fixture();input.town.villagers[3]={occupantId:3,name:'Pip',race:'Human',bornDay:0,
   homePlotId:2,parentIds:[1,2],childIds:[],wealth:0};
  const birth={id:1,day:0,kind:'birth' as const,subjectId:3,relatedIds:[1,2],summary:'Pip was born.'};
  input.town.chronicle.events=[birth];
  expect(qualifyHistoricalTownLayout(input)).toMatchObject({status:'qualified',revision:1});
  input.town.chronicle.events=[];
  expect(qualifyHistoricalTownLayout(input)).toMatchObject({status:'unresolved',reason:'no-match'});
 });
 it('tolerates only negligible site dust and requires exact blueprint structure',()=>{
  const input=fixture();input.candidates[0].buildings[1].site.xM+=1e-10;
  expect(qualifyHistoricalTownLayout(input)).toMatchObject({status:'qualified'});
  input.candidates[0].buildings[1].plan.widthFt+=1e-10;
  expect(qualifyHistoricalTownLayout(input)).toMatchObject({status:'unresolved',reason:'no-match'});
 });
});
