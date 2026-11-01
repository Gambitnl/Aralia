/** Borrowed equipment needs actual arrival and a staffed public room. */
import {describe, expect, it} from 'vitest';
import {workbenchAccessError} from '../workbenchAccess';
import type {TownBuildingVisit} from '../../Worldforge/townBuildingVisit';
import type {FurnishingPick} from '../groundFurnishingInteraction';
const FT = 0.3048;
const pick: FurnishingPick = {siteId:'wf-plot-10-1',part:{x:-3*FT,z:0,w:1,d:2,h:0.9,colorHex:'#b08968',
  furnishing:{level:0,roomId:0,index:0,kind:'workbench'}},
  transform:{groupX:20,groupZ:30,surfaceY:4,rotationY:0,doorZSign:-1}};
const foot = {xM:20-6*FT,zM:30,yM:4};
function visit(): TownBuildingVisit {return {
  isBusiness:true, household:{members:[{name:'Lys Greenford'}]},
  plan:{widthFt:30,depthFt:15,floors:[{level:0,rooms:[{id:0,purpose:'workshop',cells:Array.from({length:9},(_,i)=>({cx:i%3,cy:Math.floor(i/3)}))}],
    furnishings:[{kind:'workbench',roomId:0,x:12,y:7.5,rotation:0}]}]},
  occupancy:{stationsByHour:Array.from({length:24},(_,hour)=>hour>=8&&hour<12||hour>=14&&hour<17
    ?[{memberIndex:0,where:'home',activity:'work'}]:[])},
} as unknown as TownBuildingVisit;}
const clock = (time:string) => '0351-01-03T'+time+':00.000Z';
describe('source workbench access',()=>{
  it('refuses a deceased proprietor without granting the surviving household a shift',()=>{
    const source=visit(); source.household!.homeId='b151'; source.household!.members[0].role='head';
    const life={villagers:{395:{occupantId:395,name:'Lys Greenford',homePlotId:151,bornDay:-10000,diedDay:-253}}};
    const before=JSON.stringify(life);
    expect(workbenchAccessError(source,pick,foot,clock('09:00'),0,life)).toContain('proprietor has died');
    expect(JSON.stringify(life)).toBe(before);
  });
  it('admits a reached public bench during the keeper shift',()=>expect(workbenchAccessError(visit(),pick,foot,clock('09:00'),60)).toBeNull());
  it('refuses a household bench even during work hours',()=>expect(workbenchAccessError({...visit(),isBusiness:false},pick,foot,clock('09:00'))).toContain('private equipment'));
  it('refuses a private room inside a business',()=>{const source=visit();source.plan.floors[0].rooms[0].purpose='bedroom';expect(workbenchAccessError(source,pick,foot,clock('09:00'))).toContain('private equipment');});
  it('requires actual same-room and same-floor arrival',()=>{expect(workbenchAccessError(visit(),pick,null,clock('09:00'))).toContain('arrives');expect(workbenchAccessError(visit(),pick,{...foot,yM:7},clock('09:00'))).toContain('same floor');expect(workbenchAccessError(visit(),pick,{...foot,xM:20+0.1*FT},clock('09:00'))).toContain('Enter this room');});
  it('rejects a stale furnishing index',()=>expect(workbenchAccessError(visit(),{...pick,part:{...pick.part,furnishing:{...pick.part.furnishing!,index:2}}},foot,clock('09:00'))).toContain('public workshop'));
  it('refuses an off-duty or missing keeper',()=>{expect(workbenchAccessError(visit(),pick,foot,clock('13:00'))).toContain('off duty');expect(workbenchAccessError({...visit(),household:undefined},pick,foot,clock('09:00'))).toContain('keeper');});
  it('allows finishing exactly at closing but not crossing lunch or evening',()=>{expect(workbenchAccessError(visit(),pick,foot,clock('11:30'),30)).toBeNull();expect(workbenchAccessError(visit(),pick,foot,clock('11:30'),31)).toContain('not enough');expect(workbenchAccessError(visit(),pick,foot,clock('16:30'),31)).toContain('not enough');});
  it('fails closed on invalid time or unbounded duration',()=>{expect(workbenchAccessError(visit(),pick,foot,'bad')).not.toBeNull();expect(workbenchAccessError(visit(),pick,foot,clock('09:00'),Infinity)).not.toBeNull();expect(workbenchAccessError(visit(),pick,foot,clock('09:00'),1441)).toContain('longer arrangement');});
});
