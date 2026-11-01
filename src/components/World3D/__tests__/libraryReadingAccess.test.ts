import {describe, expect, it} from 'vitest';
import {isPublicLibraryDesk, libraryReadingAccessError} from '../libraryReadingAccess';
import type {TownBuildingVisit} from '../../Worldforge/townBuildingVisit';
import type {BuildingOccupantRender} from '../../../systems/world3d/types';
import type {FurnishingPick} from '../groundFurnishingInteraction';
const FT=.3048;
const pick:FurnishingPick={siteId:'wf-plot-675-30',part:{x:-3*FT,z:0,w:1,d:2,h:.78,colorHex:'#65462f',
  furnishing:{level:0,roomId:0,index:0,kind:'desk'}},transform:{groupX:20,groupZ:30,surfaceY:4,rotationY:0,doorZSign:-1}};
const foot={xM:20-6*FT,zM:30,yM:4};
const clock=(time:string)=>'0351-01-08T'+time+':00.000Z';
function visit():TownBuildingVisit{return {plot:{role:'civic',pop:{buildingType:'library'}},isBusiness:false,
  household:{homeId:'b80',members:[{name:'Rosa Colewick',role:'head',age:52,ageBand:'adult',occupation:'librarian'}]},
  plan:{widthFt:30,depthFt:15,floors:[{level:0,rooms:[{id:0,purpose:'study',cells:Array.from({length:9},(_,i)=>({cx:i%3,cy:Math.floor(i/3)}))}],
    furnishings:[{kind:'desk',roomId:0,x:12,y:7.5,rotation:0}]}]},
  occupancy:{stationsByHour:Array.from({length:24},(_,hour)=>hour>=8&&hour<17?[{memberIndex:0,where:'home',activity:'work'}]:[])},
} as unknown as TownBuildingVisit;}
function packet():BuildingOccupantRender{return {householdMemberId:'b80:head',
  stationsByHour:Array.from({length:24},(_,hour)=>hour>=8&&hour<17?{activity:'work'}:null),
  interiorOwnedByHour:Array.from({length:24},(_,hour)=>hour>=8&&hour<17),
  interiorArrivalDelayByHour:Array(24).fill(0),
} as unknown as BuildingOccupantRender;}
const check=(source=visit(),person=packet(),time=clock('09:00'))=>libraryReadingAccessError(source,pick,foot,time,undefined,person);
describe('public library reading admission',()=>{
  it('admits a physically reached civic desk with its source librarian on duty',()=>expect(check()).toBeNull());
  it('keeps household desks and unrelated civic buildings private',()=>{
    const home=visit();home.plot.role='house';expect(check(home)).toContain('private records');
    const school=visit();school.plot.pop!.buildingType='school';expect(check(school)).toContain('private records');
    const room=visit();room.plan.floors[0].rooms[0].purpose='bedroom';expect(check(room)).toContain('private records');
  });
  it('does not turn a shelf or a stale source receipt into a reading desk',()=>{
    expect(isPublicLibraryDesk(visit(),0,9)).toBe(false);
    expect(libraryReadingAccessError(visit(),{...pick,part:{...pick.part,furnishing:{...pick.part.furnishing!,kind:'shelf'}}},foot,clock('09:00'),undefined,packet())).toContain('no longer available');
  });
  it('requires actual same-room same-floor footfall',()=>{
    expect(libraryReadingAccessError(visit(),pick,null,clock('09:00'),undefined,packet())).toContain('arrives');
    expect(libraryReadingAccessError(visit(),pick,{...foot,yM:7},clock('09:00'),undefined,packet())).toContain('same floor');
    expect(libraryReadingAccessError(visit(),pick,{...foot,xM:20+.1*FT},clock('09:00'),undefined,packet())).toContain('Enter this room');
  });
  it('refuses off-duty and retired staff without assigning the family a shift',()=>{
    expect(check(visit(),packet(),clock('19:00'))).toContain('off duty');
    const retired=visit();retired.household!.members[0].occupation='retired librarian';expect(check(retired)).not.toBeNull();
  });
  it('never substitutes a child, stranger or absent librarian',()=>{
    const child=visit();child.household!.members[0].ageBand='child';expect(check(child)).toContain('verified librarian');
    const stranger=packet();stranger.householdMemberId='b81:head';expect(check(visit(),stranger)).toContain('arrive');
    expect(libraryReadingAccessError(visit(),pick,foot,clock('09:00'),undefined,undefined)).toContain('arrive');
  });
  it('waits for the existing physical arrival handoff even within staffed hours',()=>{
    const traveller=packet();traveller.interiorArrivalDelayByHour![8]=.1;
    expect(check(visit(),traveller,clock('08:05'))).toContain('arrive');
    expect(check(visit(),traveller,clock('08:07'))).toBeNull();
  });
  it('refuses deceased staff and preserves all source data',()=>{
    const source=visit(),person=packet(),life={villagers:{80:{occupantId:80,name:'Rosa Colewick',homePlotId:80,bornDay:-20000,diedDay:7}}};
    const before=JSON.stringify({source,person,life});
    expect(libraryReadingAccessError(source,pick,foot,clock('09:00'),life,person)).toContain('has died');
    expect(JSON.stringify({source,person,life})).toBe(before);
  });
  it('fails visibly when the clock is unavailable',()=>expect(check(visit(),packet(),'bad')).toContain('time is unavailable'));
});
