/** Farm identities and source facts, not physical field attendance or native reload. */
import {describe,it,expect,vi} from 'vitest';
import type {TownPlan} from '../../artifacts';
import {initTownSimState} from '../../townsim/townSim';
import {DAYS_PER_YEAR} from '../../townsim/constants';
import {livingRosterAt} from '../agentLife';
import {householdFamilyAt} from '../../townsim/householdNpc';
import {rootSeedPath} from '../../seedPath';
import {generateTownRoster} from '../generateTownRoster';
import {appendRuralHouseholds} from '../ruralHouseholds';
import {assignFamilies} from '../family';
import {generateHousehold} from '../../town/household';
import {householdMemberIdentity} from '../../town/householdBrief';
import {householdResidentAliveAt,householdResidentLifeStatusAt,type TownLifeState} from '../agentLife';
const seed=rootSeedPath(42);
const quad=(x:number,y:number,w:number,h:number):Array<[number,number]>=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
function fixture(indices:number[]=[0,2]):TownPlan{
 const plan:TownPlan={burgId:7,streets:[{id:0,centerline:[[0,0],[200,0]],widthFt:12}],plots:[
  {id:10,role:'house',storeys:2,footprint:quad(0,20,35,40),pop:{buildingType:'cottage',residential:true,occupants:4,homeId:'b10',district:'common',workRole:'proprietor',workplaceId:'b20'}},
  {id:11,role:'house',storeys:1,footprint:quad(45,20,35,40),pop:{buildingType:'cottage',residential:true,occupants:3,homeId:'b11',district:'common'}},
  {id:20,role:'workshop',storeys:1,footprint:quad(90,20,35,40),pop:{buildingType:'smithy',residential:false,occupants:0,homeId:'b20',proprietorHomeId:'b10',district:'common'}},
 ],ruralSources:{layoutRecipe:'rural-family-v1',homesteads:{version:1,sites:[],declined:[{farmId:'f9',farmParcelIndex:9,occupants:8,reason:'unplaced'}]},fields:[]}};
 for(const index of indices){const plotId=1_000_000+index,x=100+index*100,occupants=index===0?5:4;
  plan.plots.push({id:plotId,role:'farm',storeys:1,footprint:quad(x,100,30,40),pop:{buildingType:'farmstead',residential:true,occupants,homeId:'f'+index,district:'common'}});
  plan.ruralSources!.homesteads.sites.push({farmId:'f'+index,plotId,farmParcelIndex:index,occupants,crop:'grain',yardSource:{kind:'field',id:'farm:'+index},sourceCenter:[x,120],center:[x+15,120],house:quad(x,100,30,40),yard:quad(x-4,94,38,52),approach:{points:[[x+15,0],[x+15,100]],width:8,streetIndex:0}});
  plan.ruralSources!.fields.push({farmParcelIndex:index,polygon:quad(x-30,70,100,120),crop:'grain'});
 }
 return plan;
}
const options=()=>({nameFor:vi.fn((rng:{next():number})=>'Town '+Math.floor(rng.next()*100000))});

describe('explicit source farm roster',()=>{
 it('appends the complete original farm families after unchanged urban people and jobs',()=>{
  const old=fixture([]);delete old.ruralSources;const candidate=fixture(),before=JSON.stringify(candidate),a=options(),b=options();
  const urban=generateTownRoster(old,seed,a),withFarms=generateTownRoster(candidate,seed,b);
  expect(withFarms.occupants.slice(0,urban.occupants.length)).toEqual(urban.occupants);
  expect(b.nameFor).toHaveBeenCalledTimes(a.nameFor.mock.calls.length);
  expect(JSON.stringify(candidate)).toBe(before);
  const added=withFarms.occupants.slice(urban.occupants.length);expect(added).toHaveLength(9);
  expect(new Set(withFarms.occupants.map(o=>o.id)).size).toBe(withFarms.occupants.length);
  for(const index of [0,2]){const family=generateHousehold(seed,'f'+index,index===0?5:4,'farmstead');
   for(const [memberIndex,member]of family.members.entries()){
    const person=added.find(o=>o.householdMemberId===householdMemberIdentity(family,memberIndex))!;
    expect(person).toMatchObject({name:member.name,ageBand:member.ageBand,homePlotId:1_000_000+index,occupation:'resident',ruralHousehold:{farmId:'f'+index,farmParcelIndex:index,member:{age:member.age,race:member.race,role:member.role,occupation:member.occupation}}});
    expect(person.workPlotId).toBeUndefined();expect(person.civicWorkplace).toBeUndefined();
   }
  }
  expect(added.some(o=>o.householdMemberId?.startsWith('f9:'))).toBe(false);
 });
 it('keeps existing farm member ids when an earlier ordinal is admitted later',()=>{
  const previous=generateTownRoster(fixture([2]),seed,options()),next=generateTownRoster(fixture([0,2]),seed,options());
  expect(next.occupants.filter(o=>o.ruralHousehold?.farmId==='f2')).toEqual(previous.occupants.filter(o=>o.ruralHousehold?.farmId==='f2'));
  expect(next).toEqual(generateTownRoster(JSON.parse(JSON.stringify(fixture([2,0]))),seed,options()));
 });
 it('requires explicit source joins and refuses id collisions instead of renumbering',()=>{
  const unmarked=fixture();delete unmarked.ruralSources;
  expect(generateTownRoster(unmarked,seed,options()).occupants.some(o=>o.ruralHousehold)).toBe(false);
  for(const issue of ['count','field','home','duplicate'] as const){const plan=fixture();
   if(issue==='count'){const pop=plan.plots.find(p=>p.id===1_000_000)!.pop!;pop.occupants=(pop.occupants??0)+1;}
   if(issue==='field')plan.ruralSources!.fields=[];
   if(issue==='home')plan.plots.find(p=>p.id===1_000_000)!.pop!.homeId='other';
   if(issue==='duplicate')plan.ruralSources!.homesteads.sites.push(structuredClone(plan.ruralSources!.homesteads.sites[0]));
   expect(()=>generateTownRoster(plan,seed,options())).toThrow(/source|household|collid/);
  }
  expect(()=>appendRuralHouseholds(fixture(),seed,[{id:1_000_000,name:'Existing person',ageBand:'adult',homePlotId:10,occupation:'resident'}])).toThrow(/collid/);
 });
 it('retains source ages, ancestry and reciprocal family links without redrawing urban ties',()=>{
  const legacy=fixture([]);delete legacy.ruralSources;const urban=generateTownRoster(legacy,seed,options()),all=generateTownRoster(fixture(),seed,options());
  const before=assignFamilies(urban.occupants,seed),after=assignFamilies(all.occupants,seed);
  for(const person of urban.occupants)expect(after.get(person.id)).toEqual(before.get(person.id));
  for(const farm of ['f0','f2']){const members=all.occupants.filter(o=>o.ruralHousehold?.farmId===farm),parents=members.filter(o=>['head','spouse'].includes(o.ruralHousehold!.member.role)),children=members.filter(o=>o.ruralHousehold!.member.role==='child');
   for(const person of members){const facts=person.ruralHousehold!.member,ties=after.get(person.id)!;expect(ties.age).toBe(facts.age);expect(ties.race).toBe(facts.race);
    if(facts.role==='child'){expect(ties.parentIds).toEqual(parents.map(p=>p.id));expect(ties.siblingIds).toEqual(children.filter(c=>c.id!==person.id).map(c=>c.id));}
   }
   for(const parent of parents)expect(after.get(parent.id)!.childIds).toEqual(children.map(c=>c.id));
   if(parents.length===2){expect(after.get(parents[0].id)!.spouseId).toBe(parents[1].id);expect(after.get(parents[1].id)!.spouseId).toBe(parents[0].id);}
  }
  expect([...assignFamilies(JSON.parse(JSON.stringify(all.occupants)),seed)]).toEqual([...after]);
 });
});

describe('source-keyed rural life projection',()=>{
 it('honors tracked death and birth without decoding a guessed plot from the household id',()=>{
  const state:TownLifeState={villagers:{1:{occupantId:1,householdMemberId:'f0:head',name:'Known farmer',homePlotId:1_000_000,bornDay:0,diedDay:5}}};
  expect(householdResidentLifeStatusAt(state,'f0:head','Known farmer',4)).toBe('alive');
  expect(householdResidentAliveAt(state,'f0:head','Known farmer',5)).toBe(false);
  const loaded=JSON.parse(JSON.stringify(state));expect(householdResidentLifeStatusAt(loaded,'f0:head','Known farmer',6)).toBe('deceased');
  loaded.villagers[1].bornDay=10;delete loaded.villagers[1].diedDay;
  expect(householdResidentLifeStatusAt(loaded,'f0:head','Known farmer',9)).toBe('not-born');
  expect(householdResidentAliveAt(loaded,'f0:head','Known farmer',9)).toBe(false);
 });
 it('leaves missing or ambiguous life evidence unresolved instead of attaching another person',()=>{
  const state:TownLifeState={villagers:{1:{occupantId:1,householdMemberId:'f0:head',name:'Known farmer',homePlotId:1_000_000,bornDay:0,diedDay:5},2:{occupantId:2,householdMemberId:'f0:head',name:'Other',homePlotId:1_000_001,bornDay:0}}};
  expect(householdResidentLifeStatusAt(state,'f0:head','Known farmer',6)).toBe('unresolved');
  expect(householdResidentAliveAt(state,'f0:head','Known farmer',6)).toBe(true);
  expect(householdResidentLifeStatusAt(state,'f8:head','Known farmer',6)).toBe('untracked');
  expect(householdResidentAliveAt(undefined,'f8:head','Known farmer',6)).toBe(true);
 });
});


it('reads reciprocal saved farm relatives without changing biography or history',()=>{
 const life={villagers:{1:{occupantId:1,householdMemberId:'f0:head',name:'Known farmer',homePlotId:1_000_000,bornDay:0,parentIds:[],childIds:[2]},2:{occupantId:2,householdMemberId:'f0:child:0',name:'Known child',homePlotId:1_000_000,bornDay:2,parentIds:[1],childIds:[]}}};
 const before=JSON.stringify(life),family=householdFamilyAt(life,'f0:head','Known farmer',6);
 expect(family?.person.occupantId).toBe(1);
 expect(family?.relatives).toHaveLength(1);expect(family?.relatives[0]).toMatchObject({person:{occupantId:2,name:'Known child'},relation:'child',homeElsewhere:false});
 expect(JSON.stringify(life)).toBe(before);
 expect(householdFamilyAt(JSON.parse(before),'f0:head','Known farmer',6)).toEqual(family);
 expect(householdFamilyAt(life,'f0:head','A different person',6)).toBeUndefined();
});


it('carries original farm facts through actual town-life initialization and JSON projection',()=>{
 const roster=generateTownRoster(fixture(),seed,options()),families=assignFamilies(roster.occupants,seed);
 const town=initTownSimState(7,roster,families,new Map(),0),loaded=JSON.parse(JSON.stringify(town));
 const live=livingRosterAt(loaded,roster,0);
 for(const person of roster.occupants.filter(o=>o.ruralHousehold)){
  const recorded=loaded.villagers[person.id],facts=person.ruralHousehold!.member;
  expect(recorded).toMatchObject({householdMemberId:person.householdMemberId,name:person.name,homePlotId:person.homePlotId,race:facts.race,bornDay:-facts.age*DAYS_PER_YEAR});
  expect(live.occupants.find(o=>o.householdMemberId===person.householdMemberId)).toEqual(person);
 }
 expect(JSON.stringify(loaded)).toBe(JSON.stringify(town));
});
